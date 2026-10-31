import { getCollections, checkIndexCapabilities } from '../db/mongo.js';
import { env } from '../config/env.js';
import { ChunkDocument, RetrievedChunk, SourceType } from '../types/index.js';
import { getEmbeddingProvider } from './embedding.js';

export interface RetrievalFilter {
  sourceType?: SourceType | SourceType[];
  service?: string;
  incidentDate?: string;
  excludeOutdated?: boolean;
  sourceId?: string;
}

export interface RetrievalOptions {
  topK?: number;
  filter?: RetrievalFilter;
  mode?: 'hybrid' | 'vector' | 'lexical';
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  retrievalMode: 'hybrid_rrf' | 'vector_search' | 'lexical_search' | 'atlas_unavailable_fallback';
  vectorCount: number;
  lexicalCount: number;
  fusedCount: number;
  vectorIndexStatus: string;
  lexicalIndexStatus: string;
  isAtlas: boolean;
}

export class RetrievalService {
  /**
   * Main retrieval method: performs hybrid, vector-only, or lexical-only search
   */
  static async retrieve(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const topK = options.topK || 10;
    const mode = options.mode || 'hybrid';
    const filter = options.filter || {};

    const indexInfo = await checkIndexCapabilities();
    const embeddingProvider = getEmbeddingProvider();

    let vectorResults: RetrievedChunk[] = [];
    let lexicalResults: RetrievedChunk[] = [];

    // Candidate limit for RRF fusion pool: ensures candidates with high rank in one channel
    // and moderate rank in the other are not prematurely truncated before fusion.
    const candidateLimit = Math.max(topK * 4, 30);

    // 1. Vector Search
    if (mode === 'hybrid' || mode === 'vector') {
      try {
        const queryVector = await embeddingProvider.generateEmbedding(query);
        vectorResults = await this.executeVectorSearch(queryVector, candidateLimit, filter, indexInfo.isAtlas);
      } catch (err: any) {
        console.warn(`Vector search failed or unavailable: ${err.message}`);
        // Fall back gracefully if vector search execution fails
      }
    }

    // 2. Lexical Search
    if (mode === 'hybrid' || mode === 'lexical') {
      try {
        lexicalResults = await this.executeLexicalSearch(query, candidateLimit, filter, indexInfo.isAtlas);
      } catch (err: any) {
        console.warn(`Lexical search failed: ${err.message}`);
      }
    }

    // 3. Fusion & Ranking
    let finalChunks: RetrievedChunk[] = [];
    let activeMode: RetrievalResult['retrievalMode'] = 'atlas_unavailable_fallback';

    if (mode === 'hybrid') {
      if (vectorResults.length > 0 && lexicalResults.length > 0) {
        finalChunks = this.fuseRRF(vectorResults, lexicalResults, topK);
        activeMode = 'hybrid_rrf';
      } else if (vectorResults.length > 0) {
        finalChunks = vectorResults.slice(0, topK);
        activeMode = 'vector_search';
      } else {
        finalChunks = lexicalResults.slice(0, topK);
        activeMode = indexInfo.isAtlas ? 'lexical_search' : 'atlas_unavailable_fallback';
      }
    } else if (mode === 'vector') {
      finalChunks = vectorResults.slice(0, topK);
      activeMode = 'vector_search';
    } else {
      finalChunks = lexicalResults.slice(0, topK);
      activeMode = indexInfo.isAtlas ? 'lexical_search' : 'atlas_unavailable_fallback';
    }

    // Ensure no chunks with mismatched embedding models are returned
    finalChunks = finalChunks.filter(
      (c) => !c.embeddingModel || c.embeddingModel === embeddingProvider.name
    );

    return {
      chunks: finalChunks,
      retrievalMode: activeMode,
      vectorCount: vectorResults.length,
      lexicalCount: lexicalResults.length,
      fusedCount: finalChunks.length,
      vectorIndexStatus: indexInfo.vectorIndexStatus,
      lexicalIndexStatus: indexInfo.lexicalIndexStatus,
      isAtlas: indexInfo.isAtlas
    };
  }

  /**
   * Executes MongoDB Atlas Vector Search ($vectorSearch stage)
   * Falls back to deterministic metric evaluation when running in non-Atlas local environments
   */
  private static async executeVectorSearch(
    queryVector: number[],
    limit: number,
    filter: RetrievalFilter,
    isAtlas: boolean
  ): Promise<RetrievedChunk[]> {
    const { chunks } = getCollections();
    const embeddingProvider = getEmbeddingProvider();

    // Build filter document for MongoDB
    const mongoFilter: Record<string, any> = {};
    if (filter.sourceType) {
      if (Array.isArray(filter.sourceType)) {
        mongoFilter['metadata.sourceType'] = { $in: filter.sourceType };
      } else {
        mongoFilter['metadata.sourceType'] = filter.sourceType;
      }
    }
    if (filter.service) {
      mongoFilter['metadata.service'] = filter.service;
    }
    if (filter.incidentDate) {
      mongoFilter['metadata.incidentDate'] = filter.incidentDate;
    }
    if (filter.excludeOutdated) {
      mongoFilter['metadata.isOutdated'] = { $ne: true };
    }
    if (filter.sourceId) {
      mongoFilter.sourceId = filter.sourceId;
    }

    if (isAtlas) {
      // Atlas $vectorSearch Aggregation Pipeline
      const vectorSearchStage: any = {
        $vectorSearch: {
          index: env.VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(limit * 5, 100),
          limit: limit
        }
      };

      if (Object.keys(mongoFilter).length > 0) {
        vectorSearchStage.$vectorSearch.filter = mongoFilter;
      }

      const pipeline = [
        vectorSearchStage,
        {
          $project: {
            _id: 1,
            sourceId: 1,
            chunkIndex: 1,
            content: 1,
            pageNumber: 1,
            sectionHeading: 1,
            contentType: 1,
            timestamps: 1,
            documentVersion: 1,
            metadata: 1,
            embeddingModel: 1,
            embeddingDimensions: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      const cursor = chunks.aggregate<RetrievedChunk>(pipeline);
      const docs = await cursor.toArray();
      // Ensure no mixed embedding models are accepted in vector retrieval
      const modelCompatibleDocs = docs.filter(
        (d) => !d.embeddingModel || d.embeddingModel === embeddingProvider.name
      );
      if (modelCompatibleDocs.length > 0) {
        return modelCompatibleDocs.map((d, rank) => ({
          ...d,
          retrievalSource: 'vector',
          vectorRank: rank + 1
        }));
      }
      // If Atlas vectorSearch returned 0 results (e.g. during an index sync/rebuild),
      // seamlessly fall through to direct cosine similarity evaluation below
    }

    // Local / Non-Atlas environment (or Atlas sync window fallback):
    // Execute MongoDB filter query matching active model to prevent mixed embedding vectors
    const modelFilter = {
      ...mongoFilter,
      embeddingModel: embeddingProvider.name,
      embeddingDimensions: embeddingProvider.dimensions
    };
    const cursor = chunks.find(modelFilter);
    const allChunks = await cursor.toArray();

    const scored = allChunks.map((chunk) => {
      const score = this.cosineSimilarity(queryVector, chunk.embedding);
      return {
        ...chunk,
        score,
        retrievalSource: 'vector' as const
      };
    });

    // Sort descending by score
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored.slice(0, limit).map((d, rank) => ({
      ...d,
      vectorRank: rank + 1
    }));
  }

  /**
   * Executes MongoDB Lexical Search ($search stage on Atlas, or text index on local)
   */
  private static async executeLexicalSearch(
    query: string,
    limit: number,
    filter: RetrievalFilter,
    isAtlas: boolean
  ): Promise<RetrievedChunk[]> {
    const { chunks } = getCollections();

    // Standard filter conditions
    const mongoFilter: Record<string, any> = {};
    if (filter.sourceType) {
      mongoFilter['metadata.sourceType'] = Array.isArray(filter.sourceType)
        ? { $in: filter.sourceType }
        : filter.sourceType;
    }
    if (filter.excludeOutdated) {
      mongoFilter['metadata.isOutdated'] = { $ne: true };
    }
    if (filter.sourceId) {
      mongoFilter.sourceId = filter.sourceId;
    }

    if (isAtlas) {
      try {
        const pipeline: any[] = [
          {
            $search: {
              index: env.SEARCH_INDEX_NAME,
              text: {
                query,
                path: ['content', 'sectionHeading']
              }
            }
          }
        ];

        if (Object.keys(mongoFilter).length > 0) {
          pipeline.push({ $match: mongoFilter });
        }

        pipeline.push(
          {
            $project: {
              _id: 1,
              sourceId: 1,
              chunkIndex: 1,
              content: 1,
              pageNumber: 1,
              sectionHeading: 1,
              contentType: 1,
              timestamps: 1,
              documentVersion: 1,
              metadata: 1,
              embeddingModel: 1,
              embeddingDimensions: 1,
              score: { $meta: 'searchScore' }
            }
          },
          { $limit: limit }
        );

        const cursor = chunks.aggregate<RetrievedChunk>(pipeline);
        const docs = await cursor.toArray();
        if (docs.length > 0) {
          return docs.map((d, rank) => ({
            ...d,
            retrievalSource: 'lexical',
            lexicalRank: rank + 1
          }));
        }
      } catch (err: any) {
        console.warn('Atlas $search failed, falling back to MongoDB $text index');
      }
    }

    // Local / Non-Atlas Fallback: Use MongoDB $text index with textScore
    try {
      const textQuery: any = {
        $text: { $search: query },
        ...mongoFilter
      };

      const docs = await chunks
        .find(textQuery, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .toArray();

      if (docs.length > 0) {
        return (docs as unknown as RetrievedChunk[]).map((d, rank) => ({
          ...d,
          retrievalSource: 'lexical',
          lexicalRank: rank + 1
        }));
      }
    } catch {
      // If text index not available yet, fall back to regex token search
    }

    // Regex token fallback for exact code terms
    const terms = query
      .split(/[\s,]+/)
      .filter((t) => t.length > 2)
      .slice(0, 5);

    if (terms.length === 0) return [];

    const regexPattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regexQuery = {
      content: { $regex: regexPattern, $options: 'i' },
      ...mongoFilter
    };

    const regexDocs = await chunks.find(regexQuery).limit(limit).toArray();
    return regexDocs.map((d, rank) => ({
      ...d,
      score: 1 / (rank + 1),
      retrievalSource: 'lexical',
      lexicalRank: rank + 1
    }));
  }

  /**
   * Reciprocal Rank Fusion (RRF) algorithm:
   * Score = 1 / (60 + vector_rank) + 1 / (60 + lexical_rank)
   */
  private static fuseRRF(
    vectorChunks: RetrievedChunk[],
    lexicalChunks: RetrievedChunk[],
    topK: number,
    kConstant: number = 60
  ): RetrievedChunk[] {
    const chunkMap = new Map<string, { chunk: RetrievedChunk; rrfScore: number }>();

    // Add vector chunks
    vectorChunks.forEach((c) => {
      const vRank = c.vectorRank || 999;
      const vScore = 1 / (kConstant + vRank);
      chunkMap.set(c._id, {
        chunk: { ...c, retrievalSource: 'vector' },
        rrfScore: vScore
      });
    });

    // Add/accumulate lexical chunks
    lexicalChunks.forEach((c) => {
      const lRank = c.lexicalRank || 999;
      const lScore = 1 / (kConstant + lRank);
      if (chunkMap.has(c._id)) {
        const existing = chunkMap.get(c._id)!;
        existing.rrfScore += lScore;
        existing.chunk.lexicalRank = lRank;
        existing.chunk.retrievalSource = 'hybrid';
      } else {
        chunkMap.set(c._id, {
          chunk: { ...c, lexicalRank: lRank, retrievalSource: 'lexical' },
          rrfScore: lScore
        });
      }
    });

    // Deduplicate and sort descending by combined RRF score
    const fusedList = Array.from(chunkMap.values());
    fusedList.sort((a, b) => b.rrfScore - a.rrfScore);

    return fusedList.slice(0, topK).map((entry) => ({
      ...entry.chunk,
      rrfScore: Number(entry.rrfScore.toFixed(6)),
      score: Number(entry.rrfScore.toFixed(6))
    }));
  }

  /**
   * Cosine similarity between two unit or arbitrary vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
