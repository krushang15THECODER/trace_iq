import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import pdfParse from 'pdf-parse';
import { getCollections, getClient } from '../db/mongo.js';
import { SourceDocument, ChunkDocument, SourceType, IngestionStatus } from '../types/index.js';
import { getEmbeddingProvider } from './embedding.js';
import {
  chunkMarkdownAndText,
  chunkPdfPages,
  chunkCsv,
  chunkJson,
  RawChunk
} from './chunker.js';
import { validateSafeUrl } from '../utils/ssrfValidator.js';

export interface IngestionInput {
  title: string;
  sourceType: SourceType;
  originalFilename: string;
  content: string | Buffer;
  sourceUrl?: string;
  documentVersion?: string;
  projectId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  isOutdated?: boolean;
}

export interface ReembedOptions {
  force?: boolean;
  resume?: boolean;
}

export interface ReembedMigrationReport {
  success: boolean;
  processedSources: number;
  migratedSources: number;
  skippedSources: number;
  failedSources: number;
  totalChunks: number;
  initialChunks: number;
  embeddingModel: string;
  dimensions: number;
  verificationPassed: boolean;
  failedSourceDetails?: Array<{ sourceId: string; title: string; error: string }>;
}

/**
 * Calculates SHA-256 hash for deduplication and integrity
 */
export function calculateContentHash(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Strips HTML tags, styles, and scripts from webpage HTML
 */
function cleanHtmlContent(html: string): string {
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

export class IngestionService {
  /**
   * Main entry point to ingest any document
   */
  static async ingestDocument(input: IngestionInput): Promise<SourceDocument> {
    const { sources, chunks } = getCollections();
    const embeddingProvider = getEmbeddingProvider();

    // Check duplicate detection
    const rawBuffer = Buffer.isBuffer(input.content)
      ? input.content
      : Buffer.from(input.content, 'utf-8');
    const contentHash = calculateContentHash(rawBuffer);

    const existing = await sources.findOne({ contentHash });
    if (existing && existing.ingestionStatus === 'indexed') {
      console.log(`ℹ️ Duplicate source detected: ${existing.title} (${existing._id})`);
      return existing;
    }

    const sourceId = existing ? existing._id : `src_${uuidv4().slice(0, 12)}`;
    const now = new Date().toISOString();
    const version = input.documentVersion || '1.0.0';

    const isOutdated = Boolean(input.isOutdated ?? input.metadata?.isOutdated);

    const sourceDoc: SourceDocument = {
      _id: sourceId,
      title: input.title,
      sourceType: input.sourceType,
      originalFilename: input.originalFilename,
      originalContent: rawBuffer.toString('utf-8').slice(0, 50000), // Preview limit for large files
      sourceUrl: input.sourceUrl,
      documentVersion: version,
      projectId: input.projectId,
      userId: input.userId,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      contentHash,
      ingestionStatus: 'processing',
      metadata: {
        ...(input.metadata || {}),
        fileSize: rawBuffer.length,
        isOutdated
      }
    };

    if (existing) {
      await sources.updateOne({ _id: sourceId }, { $set: sourceDoc });
    } else {
      await sources.insertOne(sourceDoc);
    }

    try {
      // 1. Extract content and split into RawChunks
      const rawChunks = await this.extractAndChunk(input.sourceType, rawBuffer, input.originalFilename);

      if (rawChunks.length === 0) {
        throw new Error('No indexable text chunks could be extracted from this document.');
      }

      // 2. Remove any old chunks for this source (for reprocess or retry)
      await chunks.deleteMany({ sourceId });

      // 3. Generate embeddings batch-wise
      const chunkTexts = rawChunks.map((c) => c.content);
      const embeddings = await embeddingProvider.generateEmbeddings(chunkTexts);

      // 4. Construct ChunkDocument array
      const chunkDocs: ChunkDocument[] = rawChunks.map((rc, idx) => {
        const emb = embeddings[idx];
        if (emb.length !== embeddingProvider.dimensions) {
          throw new Error(
            `Embedding dimension mismatch: expected ${embeddingProvider.dimensions}, got ${emb.length}`
          );
        }

        return {
          _id: `chk_${uuidv4().slice(0, 16)}`,
          sourceId,
          projectId: input.projectId,
          userId: input.userId,
          chunkIndex: rc.chunkIndex,
          content: rc.content,
          embedding: emb,
          embeddingModel: embeddingProvider.name,
          embeddingDimensions: embeddingProvider.dimensions,
          pageNumber: rc.pageNumber,
          sectionHeading: rc.sectionHeading,
          contentType: rc.contentType,
          timestamps: rc.timestamps,
          documentVersion: version,
          metadata: {
            sourceTitle: input.title,
            sourceType: input.sourceType,
            service: input.metadata?.service,
            incidentDate: input.metadata?.incidentDate,
            isOutdated,
            rowId: rc.rowId,
            logLevel: rc.logLevel,
            ...(rc.metadata || {})
          }
        };
      });

      // 5. Bulk insert chunks
      if (chunkDocs.length > 0) {
        await chunks.insertMany(chunkDocs);
      }

      // 6. Update source status
      sourceDoc.ingestionStatus = 'indexed';
      sourceDoc.metadata.chunkCount = chunkDocs.length;
      await sources.updateOne(
        { _id: sourceId },
        {
          $set: {
            ingestionStatus: 'indexed',
            'metadata.chunkCount': chunkDocs.length,
            updatedAt: new Date().toISOString()
          }
        }
      );

      console.log(`✅ Ingested "${input.title}" with ${chunkDocs.length} chunks.`);
      return sourceDoc;
    } catch (err: any) {
      console.error(`❌ Ingestion failed for "${input.title}":`, err.message);
      await sources.updateOne(
        { _id: sourceId },
        {
          $set: {
            ingestionStatus: 'failed',
            errorMessage: err.message,
            updatedAt: new Date().toISOString()
          }
        }
      );
      throw err;
    }
  }

  /**
   * Safe webpage import with SSRF prevention
   */
  static async importWebpage(url: string, title?: string): Promise<SourceDocument> {
    const validatedUrl = await validateSafeUrl(url);

    const response = await axios.get(validatedUrl.toString(), {
      timeout: 7000,
      maxContentLength: 3 * 1024 * 1024, // 3MB limit
      headers: {
        'User-Agent': 'TraceIQ-DocFetcher/1.0 (+https://github.com/mongodb/traceiq)'
      }
    });

    const contentType = String(response.headers['content-type'] || '');
    let extractedText = '';

    if (contentType.includes('html')) {
      extractedText = cleanHtmlContent(response.data);
    } else {
      extractedText = String(response.data);
    }

    const docTitle = title || validatedUrl.hostname + validatedUrl.pathname;

    return this.ingestDocument({
      title: docTitle,
      sourceType: 'webpage',
      originalFilename: `${validatedUrl.hostname}.html`,
      content: extractedText,
      sourceUrl: validatedUrl.toString(),
      metadata: {
        url: validatedUrl.toString(),
        fetchedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Reprocess an existing source document
   */
  static async reprocessSource(sourceId: string): Promise<SourceDocument> {
    const { sources } = getCollections();
    const source = await sources.findOne({ _id: sourceId });
    if (!source) throw new Error(`Source not found: ${sourceId}`);

    return this.ingestDocument({
      title: source.title,
      sourceType: source.sourceType,
      originalFilename: source.originalFilename,
      content: source.originalContent,
      sourceUrl: source.sourceUrl,
      documentVersion: source.documentVersion,
      metadata: source.metadata,
      isOutdated: source.metadata?.isOutdated
    });
  }

  /**
   * Production-grade, failure-safe re-embedding migration workflow:
   * 1. Preserves original source documents without alteration.
   * 2. Generates & strictly validates all new embeddings in-memory BEFORE touching MongoDB.
   * 3. Preserves existing chunk IDs to maintain citation referential integrity across investigations.
   * 4. Uses MongoDB multi-document transactions (Atlas replica set) or staged non-destructive upserts (standalone).
   * 5. Supports resumability (skips already-migrated sources unless force=true).
   * 6. Verifies final chunk counts and model uniformity post-migration.
   */
  static async reembedAllSources(
    targetProvider?: import('./embedding.js').EmbeddingProvider,
    options?: ReembedOptions
  ): Promise<ReembedMigrationReport> {
    const { sources, chunks } = getCollections();
    const client = getClient();
    const provider = targetProvider || getEmbeddingProvider();

    console.log(
      `🔄 Starting safe re-embedding migration using provider: ${provider.name} (${provider.dimensions} dims)...`
    );

    const allSources = await sources.find().toArray();
    const initialChunks = await chunks.countDocuments();
    let migratedSourcesCount = 0;
    let skippedSourcesCount = 0;
    const failedSourceDetails: Array<{ sourceId: string; title: string; error: string }> = [];

    for (const source of allSources) {
      console.log(`   ⏳ Inspecting source: ${source.title} (${source._id})...`);

      // 1. Resumability check: Skip sources already successfully indexed with target model
      if (!options?.force && options?.resume !== false) {
        const existingMatchingChunks = await chunks
          .find({
            sourceId: source._id,
            embeddingModel: provider.name,
            embeddingDimensions: provider.dimensions
          })
          .toArray();

        if (
          existingMatchingChunks.length > 0 &&
          source.metadata?.chunkCount === existingMatchingChunks.length &&
          source.metadata?.lastEmbeddingModel === provider.name
        ) {
          console.log(
            `   ⏭️ Resumed/Skipped: "${source.title}" is already up-to-date with ${provider.name} (${existingMatchingChunks.length} chunks).`
          );
          skippedSourcesCount++;
          continue;
        }
      }

      try {
        // 2. Extract content buffer without touching source record
        const rawBuffer = Buffer.from(source.originalContent, 'utf-8');

        // 3. Re-chunk text preserving structure
        const rawChunks = await this.extractAndChunk(
          source.sourceType,
          rawBuffer,
          source.originalFilename
        );

        if (rawChunks.length === 0) {
          console.warn(`   ⚠️ No extractable chunks for source: ${source._id}`);
          continue;
        }

        // 4. Retrieve existing chunks for this source to preserve chunk IDs and citation integrity
        const existingChunks = await chunks.find({ sourceId: source._id }).toArray();
        const existingChunkMap = new Map(existingChunks.map((c) => [c.chunkIndex, c]));

        // 5. Generate embeddings with target provider (in-memory, pre-write)
        const chunkTexts = rawChunks.map((c) => c.content);
        const embeddings = await provider.generateEmbeddings(chunkTexts);

        if (embeddings.length !== rawChunks.length) {
          throw new Error(
            `Provider returned ${embeddings.length} embeddings for ${rawChunks.length} chunks.`
          );
        }

        // 6. Strictly validate all embeddings BEFORE modifying the database
        const newChunkDocs: ChunkDocument[] = rawChunks.map((rc, idx) => {
          const emb = embeddings[idx];
          if (!Array.isArray(emb) || emb.length !== provider.dimensions) {
            throw new Error(
              `Embedding dimension mismatch for chunk ${idx}: expected ${provider.dimensions}, got ${emb?.length}`
            );
          }

          // Verify all elements are finite numbers
          let normSq = 0;
          for (let i = 0; i < emb.length; i++) {
            const v = emb[i];
            if (!Number.isFinite(v)) {
              throw new Error(`Embedding vector contains invalid non-finite value at index ${i}`);
            }
            normSq += v * v;
          }

          const norm = Math.sqrt(normSq);
          if (norm <= 0) {
            throw new Error(`Embedding vector has zero norm at chunk ${idx}`);
          }

          // Preserve existing chunkId if it exists to maintain citation integrity across historical investigations
          const existing = existingChunkMap.get(rc.chunkIndex);
          const chunkId = existing?._id || `chk_${source._id.replace(/^src_/, '')}_${rc.chunkIndex}`;

          return {
            _id: chunkId,
            sourceId: source._id,
            chunkIndex: rc.chunkIndex,
            content: rc.content,
            embedding: emb,
            embeddingModel: provider.name,
            embeddingDimensions: provider.dimensions,
            pageNumber: rc.pageNumber,
            sectionHeading: rc.sectionHeading,
            contentType: rc.contentType,
            timestamps: rc.timestamps,
            documentVersion: source.documentVersion,
            metadata: {
              sourceTitle: source.title,
              sourceType: source.sourceType,
              service: source.metadata?.service,
              incidentDate: source.metadata?.incidentDate,
              isOutdated: Boolean(source.metadata?.isOutdated),
              rowId: rc.rowId,
              logLevel: rc.logLevel,
              ...(rc.metadata || {})
            }
          };
        });

        // 7. Atomic or staged replacement: Never delete existing chunks without verified replacements
        let replacedViaTransaction = false;
        const session = client.startSession();

        try {
          await session.withTransaction(async () => {
            await chunks.deleteMany({ sourceId: source._id }, { session });
            if (newChunkDocs.length > 0) {
              await chunks.insertMany(newChunkDocs, { session });
            }
            await sources.updateOne(
              { _id: source._id },
              {
                $set: {
                  'metadata.chunkCount': newChunkDocs.length,
                  'metadata.lastEmbeddingModel': provider.name,
                  updatedAt: new Date().toISOString()
                }
              },
              { session }
            );
          });
          replacedViaTransaction = true;
        } catch (txErr: any) {
          if (
            txErr.message?.includes('Transaction numbers are only allowed') ||
            txErr.message?.includes('standalone')
          ) {
            replacedViaTransaction = false;
          } else {
            throw txErr;
          }
        } finally {
          await session.endSession();
        }

        if (!replacedViaTransaction) {
          // Non-transactional fallback for standalone local MongoDB instances:
          // Stage 1: Upsert all replacement chunks first so the source NEVER has 0 chunks
          const bulkOps = newChunkDocs.map((doc) => ({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true
            }
          }));
          if (bulkOps.length > 0) {
            await chunks.bulkWrite(bulkOps);
          }

          // Stage 2: Prune any old chunks that are no longer part of the current chunk set
          const newIds = new Set(newChunkDocs.map((d) => d._id));
          const obsoleteIds = existingChunks.filter((c) => !newIds.has(c._id)).map((c) => c._id);
          if (obsoleteIds.length > 0) {
            await chunks.deleteMany({ _id: { $in: obsoleteIds } });
          }

          // Stage 3: Update source metadata
          await sources.updateOne(
            { _id: source._id },
            {
              $set: {
                'metadata.chunkCount': newChunkDocs.length,
                'metadata.lastEmbeddingModel': provider.name,
                updatedAt: new Date().toISOString()
              }
            }
          );
        }

        migratedSourcesCount++;
        console.log(`   ✅ Re-embedded "${source.title}" (${newChunkDocs.length} chunks).`);
      } catch (srcErr: any) {
        console.error(`   ❌ Failed to re-embed source "${source.title}":`, srcErr.message);
        failedSourceDetails.push({
          sourceId: source._id,
          title: source.title,
          error: srcErr.message
        });
        // Existing chunks remain untouched in MongoDB! Source is not left empty.
      }
    }

    // 8. Post-migration database verification
    const finalTotalChunks = await chunks.countDocuments();
    const mismatchedModelChunks = await chunks.countDocuments({
      embeddingModel: { $ne: provider.name }
    });
    const mismatchedDimChunks = await chunks.countDocuments({
      embeddingDimensions: { $ne: provider.dimensions }
    });

    const verificationPassed =
      mismatchedModelChunks === 0 &&
      mismatchedDimChunks === 0 &&
      failedSourceDetails.length === 0;

    console.log(
      `\n📊 Migration Complete: Scanned=${allSources.length}, Migrated=${migratedSourcesCount}, Skipped=${skippedSourcesCount}, Failed=${failedSourceDetails.length}, Total Chunks=${finalTotalChunks}`
    );

    return {
      success: verificationPassed,
      processedSources: allSources.length,
      migratedSources: migratedSourcesCount,
      skippedSources: skippedSourcesCount,
      failedSources: failedSourceDetails.length,
      totalChunks: finalTotalChunks,
      initialChunks,
      embeddingModel: provider.name,
      dimensions: provider.dimensions,
      verificationPassed,
      failedSourceDetails: failedSourceDetails.length > 0 ? failedSourceDetails : undefined
    };
  }

  /**
   * Delete a source and cascade delete all its chunks
   */
  static async deleteSource(sourceId: string): Promise<void> {
    const { sources, chunks } = getCollections();
    await chunks.deleteMany({ sourceId });
    await sources.deleteOne({ _id: sourceId });
    console.log(`🗑️ Deleted source ${sourceId} and associated chunks.`);
  }

  /**
   * Dispatches format-specific extraction and chunking
   */
  private static async extractAndChunk(
    sourceType: SourceType,
    buffer: Buffer,
    filename: string
  ): Promise<RawChunk[]> {
    const ext = filename.split('.').pop()?.toLowerCase();

    // 1. PDF
    if (ext === 'pdf' || buffer.slice(0, 4).toString() === '%PDF') {
      try {
        const pdfData = await pdfParse(buffer);
        // pdf-parse provides numpages and text
        // For structure-aware chunking:
        const pages: { pageNumber: number; text: string }[] = [];
        // Approximate page splits or single-stream split
        const pageSplits = pdfData.text.split(/\f|\n(?=Page\s+\d+)/i);
        if (pageSplits.length > 1) {
          pageSplits.forEach((pText: string, i: number) => {
            pages.push({ pageNumber: i + 1, text: pText });
          });
          return chunkPdfPages(pages);
        } else {
          return chunkPdfPages([{ pageNumber: 1, text: pdfData.text }]);
        }
      } catch (err: any) {
        throw new Error(`Failed to parse PDF: ${err.message}`);
      }
    }

    const text = buffer.toString('utf-8');

    // 2. CSV
    if (ext === 'csv' || sourceType === 'deployment') {
      if (text.includes(',') && text.split('\n')[0].includes(',')) {
        return chunkCsv(text);
      }
    }

    // 3. JSON
    if (ext === 'json' || (text.trim().startsWith('{') && text.trim().endsWith('}')) || (text.trim().startsWith('[') && text.trim().endsWith(']'))) {
      try {
        return chunkJson(text);
      } catch {
        // Fall back to text chunking if JSON parse fails
      }
    }

    // 4. Markdown, Logs, Architecture, Runbook, TXT
    return chunkMarkdownAndText(text);
  }
}
