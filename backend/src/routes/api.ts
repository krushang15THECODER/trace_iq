import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getCollections, checkIndexCapabilities, isDbConnected } from '../db/mongo.js';
import { env } from '../config/env.js';
import { IngestionService } from '../services/ingestion.js';
import { RetrievalService } from '../services/retrieval.js';
import { InvestigationEngine } from '../services/investigation.js';
import { EvaluationRunner } from '../services/evaluation.js';
import { SourceType } from '../types/index.js';

export const apiRouter = Router();

// Multer in-memory storage with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* -------------------------------------------------------------
 * 1. Health & Diagnostics
 * ------------------------------------------------------------- */
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const connected = isDbConnected();
  let indexInfo: any = { isAtlas: false, vectorIndexStatus: 'not_found', lexicalIndexStatus: 'not_found' };

  if (connected) {
    try {
      indexInfo = await checkIndexCapabilities();
    } catch {
      // index check fallback
    }
  }

  let totalSources = 0;
  let totalChunks = 0;
  let totalInvestigations = 0;

  if (connected) {
    try {
      const { sources, chunks, investigations } = getCollections();
      totalSources = await sources.countDocuments();
      totalChunks = await chunks.countDocuments();
      totalInvestigations = await investigations.countDocuments();
    } catch {
      // ignore
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      connected,
      name: env.DB_NAME,
      isAtlas: indexInfo.isAtlas,
      vectorIndex: {
        name: env.VECTOR_INDEX_NAME,
        status: indexInfo.vectorIndexStatus
      },
      lexicalIndex: {
        name: env.SEARCH_INDEX_NAME,
        status: indexInfo.lexicalIndexStatus
      }
    },
    providers: {
      embedding: {
        provider: env.EMBEDDING_PROVIDER,
        model: env.EMBEDDING_MODEL,
        dimensions: env.EMBEDDING_DIMENSIONS
      },
      llm: {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL
      }
    },
    counts: {
      totalSources,
      totalChunks,
      totalInvestigations
    }
  });
});

/* -------------------------------------------------------------
 * 2. Sources Management
 * ------------------------------------------------------------- */
apiRouter.get('/sources', async (req: Request, res: Response) => {
  try {
    const { sources } = getCollections();
    const { type, status } = req.query;

    const query: Record<string, any> = {};
    if (type) query.sourceType = type;
    if (status) query.ingestionStatus = status;

    const docs = await sources.find(query).sort({ createdAt: -1 }).toArray();
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/sources/:id', async (req: Request, res: Response) => {
  try {
    const { sources, chunks } = getCollections();
    const source = await sources.findOne({ _id: req.params.id });
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const chunkList = await chunks
      .find({ sourceId: req.params.id })
      .project({ embedding: 0 })
      .sort({ chunkIndex: 1 })
      .toArray();

    res.json({ source, chunks: chunkList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sources/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const title = req.body.title || req.file.originalname;
    const sourceType = (req.body.sourceType as SourceType) || 'other';
    const isOutdated = req.body.isOutdated === 'true' || req.body.isOutdated === true;

    const result = await IngestionService.ingestDocument({
      title,
      sourceType,
      originalFilename: req.file.originalname,
      content: req.file.buffer,
      documentVersion: req.body.documentVersion || '1.0.0',
      isOutdated,
      metadata: {
        service: req.body.service,
        author: req.body.author,
        incidentDate: req.body.incidentDate,
        mimeType: req.file.mimetype
      }
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sources/import-url', async (req: Request, res: Response) => {
  const schema = z.object({
    url: z.string().url(),
    title: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const result = await IngestionService.importWebpage(parsed.data.url, parsed.data.title);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sources/note', async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    sourceType: z.string().default('note'),
    service: z.string().optional(),
    incidentDate: z.string().optional(),
    isOutdated: z.boolean().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const result = await IngestionService.ingestDocument({
      title: parsed.data.title,
      sourceType: parsed.data.sourceType as SourceType,
      originalFilename: `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`,
      content: parsed.data.content,
      isOutdated: parsed.data.isOutdated,
      metadata: {
        service: parsed.data.service,
        incidentDate: parsed.data.incidentDate
      }
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sources/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const doc = await IngestionService.reprocessSource(req.params.id);
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    await IngestionService.deleteSource(req.params.id);
    res.json({ message: 'Source deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------
 * 3. Chunks & Evidence Explorer
 * ------------------------------------------------------------- */
apiRouter.get('/chunks', async (req: Request, res: Response) => {
  try {
    const { chunks } = getCollections();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const sourceId = req.query.sourceId as string;

    const query: Record<string, any> = {};
    if (sourceId) query.sourceId = sourceId;

    const docs = await chunks
      .find(query)
      .project({ embedding: 0 })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/chunks/:id', async (req: Request, res: Response) => {
  try {
    const { chunks, sources } = getCollections();
    const chunk = await chunks.findOne({ _id: req.params.id }, { projection: { embedding: 0 } });
    if (!chunk) return res.status(404).json({ error: 'Chunk not found' });

    const source = await sources.findOne({ _id: chunk.sourceId });
    res.json({ chunk, source });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/retrieval/search', async (req: Request, res: Response) => {
  const schema = z.object({
    query: z.string().min(1),
    topK: z.number().optional().default(10),
    mode: z.enum(['hybrid', 'vector', 'lexical']).optional().default('hybrid'),
    filter: z
      .object({
        sourceType: z.union([z.string(), z.array(z.string())]).optional(),
        service: z.string().optional(),
        incidentDate: z.string().optional(),
        excludeOutdated: z.boolean().optional()
      })
      .optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const result = await RetrievalService.retrieve(parsed.data.query, {
      topK: parsed.data.topK,
      mode: parsed.data.mode,
      filter: parsed.data.filter as any
    });

    // Strip raw embedding arrays from response
    const sanitizedChunks = result.chunks.map((c) => {
      const { embedding, ...rest } = c;
      return rest;
    });

    res.json({ ...result, chunks: sanitizedChunks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------
 * 4. Incidents
 * ------------------------------------------------------------- */
apiRouter.get('/incidents', async (_req: Request, res: Response) => {
  try {
    const { incidents } = getCollections();
    const list = await incidents.find().sort({ incidentDate: -1 }).toArray();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/incidents/:id', async (req: Request, res: Response) => {
  try {
    const { incidents, sources } = getCollections();
    const inc = await incidents.findOne({ _id: req.params.id });
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const associatedSources = await sources
      .find({ _id: { $in: inc.associatedSourceIds } })
      .toArray();

    res.json({ incident: inc, sources: associatedSources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/incidents', async (req: Request, res: Response) => {
  const schema = z.object({
    _id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().min(1),
    incidentDate: z.string(),
    severity: z.enum(['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4']),
    status: z.enum(['open', 'investigating', 'mitigated', 'resolved']).default('investigating'),
    tags: z.array(z.string()).default([]),
    serviceAffected: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const { incidents } = getCollections();
    const id = parsed.data._id || `INC-${Date.now().toString().slice(-4)}`;
    const newInc = {
      _id: id,
      ...parsed.data,
      associatedSourceIds: []
    };
    await incidents.insertOne(newInc);
    res.status(201).json(newInc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------
 * 5. Investigations
 * ------------------------------------------------------------- */
apiRouter.post('/investigations/run', async (req: Request, res: Response) => {
  const schema = z.object({
    question: z.string().min(3),
    incidentId: z.string().optional(),
    sourceFilters: z.array(z.string()).optional(),
    serviceFilter: z.string().optional(),
    timeFilter: z.string().optional(),
    topK: z.number().optional().default(10)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const report = await InvestigationEngine.investigate(parsed.data);
    res.status(201).json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/investigations', async (_req: Request, res: Response) => {
  try {
    const { investigations } = getCollections();
    const list = await investigations.find().sort({ createdAt: -1 }).toArray();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/investigations/:id', async (req: Request, res: Response) => {
  try {
    const { investigations } = getCollections();
    const inv = await investigations.findOne({ _id: req.params.id });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });
    res.json(inv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/investigations/:id/export', async (req: Request, res: Response) => {
  try {
    const { investigations } = getCollections();
    const inv = await investigations.findOne({ _id: req.params.id });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });

    let md = `# TraceIQ Investigation Report: ${inv._id}\n\n`;
    md += `**Question:** ${inv.question}\n`;
    md += `**Date:** ${inv.createdAt}\n`;
    md += `**Status:** ${inv.investigationStatus}\n\n`;
    md += `## Executive Summary\n${inv.executiveSummary}\n\n`;

    md += `## Hypotheses & Evidence Assessment\n`;
    inv.hypotheses.forEach((h) => {
      md += `### [${h.assessment.toUpperCase()}] ${h.hypothesisId}: ${h.description}\n`;
      md += `*Assessment Reason:* ${h.assessmentReason}\n\n`;
      if (h.supportingEvidenceIds.length > 0) {
        md += `*Supporting Evidence:* ${h.supportingEvidenceIds.join(', ')}\n`;
      }
      if (h.contradictingEvidenceIds.length > 0) {
        md += `*Contradicting Evidence:* ${h.contradictingEvidenceIds.join(', ')}\n`;
      }
      if (h.diagnosticTests.length > 0) {
        md += `*Proposed Diagnostic Tests:*\n`;
        h.diagnosticTests.forEach((t) => (md += `- ${t}\n`));
      }
      md += `\n`;
    });

    md += `## Observations & Findings\n`;
    inv.observations.forEach((o) => {
      md += `- [${o.type.toUpperCase()}] ${o.statement} (Citations: ${o.citationIds.join(', ') || 'None'})\n`;
    });
    md += `\n`;

    md += `## Verified Citations\n`;
    inv.citations.forEach((c) => {
      md += `### ${c.citationId}: ${c.sourceTitle}\n`;
      md += `> "${c.exactExcerpt}"\n\n`;
      md += `*Type:* ${c.sourceType} | *Version:* ${c.documentVersion} | *Status:* ${c.verificationStatus} | *Temporal:* ${c.temporalRelevance || 'current'}\n\n`;
    });

    if (inv.missingEvidence.length > 0) {
      md += `## Missing Evidence & Telemetry\n`;
      inv.missingEvidence.forEach((m) => (md += `- ${m}\n`));
      md += `\n`;
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${inv._id}.md"`);
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------------------------------------------------
 * 6. Evaluations
 * ------------------------------------------------------------- */
apiRouter.post('/evaluations/run', async (_req: Request, res: Response) => {
  try {
    const report = await EvaluationRunner.runBenchmark();
    res.status(201).json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/evaluations', async (_req: Request, res: Response) => {
  try {
    const { evaluations } = getCollections();
    const list = await evaluations.find().sort({ timestamp: -1 }).limit(20).toArray();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/evaluations/:id', async (req: Request, res: Response) => {
  try {
    const { evaluations } = getCollections();
    const evalReport = await evaluations.findOne({ _id: req.params.id });
    if (!evalReport) return res.status(404).json({ error: 'Evaluation report not found' });
    res.json(evalReport);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
