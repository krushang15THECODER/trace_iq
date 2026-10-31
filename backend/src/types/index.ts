export type SourceType =
  | 'incident_report'
  | 'architecture'
  | 'api_doc'
  | 'log'
  | 'db_metrics'
  | 'deployment'
  | 'runbook'
  | 'webpage'
  | 'note'
  | 'other';

export type IngestionStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface UserRecord {
  _id: string;
  email: string;
  name: string;
  passwordHash?: string;
  createdAt: string;
}

export interface ProjectRecord {
  _id: string;
  name: string;
  description: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  investigationCount?: number;
}

export interface SourceDocument {
  _id: string;
  title: string;
  sourceType: SourceType;
  originalFilename: string;
  originalContent: string;
  sourceUrl?: string;
  documentVersion: string;
  projectId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  contentHash: string;
  ingestionStatus: IngestionStatus;
  errorMessage?: string;
  metadata: {
    service?: string;
    author?: string;
    incidentDate?: string;
    fileSize?: number;
    mimeType?: string;
    chunkCount?: number;
    isOutdated?: boolean;
    deprecationNote?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface ChunkDocument {
  _id: string;
  sourceId: string;
  projectId?: string;
  userId?: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  embeddingModel: string;
  embeddingDimensions: number;
  pageNumber?: number;
  sectionHeading?: string;
  contentType: string;
  timestamps?: string[];
  documentVersion: string;
  metadata: {
    sourceTitle?: string;
    sourceType?: SourceType;
    service?: string;
    incidentDate?: string;
    isOutdated?: boolean;
    rowId?: number;
    logLevel?: string;
    [key: string]: any;
  };
}

export interface IncidentRecord {
  _id: string;
  title: string;
  description: string;
  incidentDate: string;
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';
  associatedSourceIds: string[];
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  tags: string[];
  serviceAffected?: string;
}

export type HypothesisAssessment =
  | 'Supported'
  | 'Plausible'
  | 'Weakly supported'
  | 'Contradicted'
  | 'Insufficient evidence';

export interface Citation {
  citationId: string;
  sourceId: string;
  sourceTitle: string;
  chunkId: string;
  exactExcerpt: string;
  pageNumber?: number;
  sectionHeading?: string;
  documentVersion: string;
  sourceType: SourceType;
  relevanceScore?: number;
  verificationStatus: 'verified_supported' | 'partial_context' | 'unverified';
  temporalRelevance?: 'current' | 'outdated' | 'unknown';
}

export interface Observation {
  id: string;
  type: 'direct_measurement' | 'source_statement' | 'inference' | 'unknown';
  statement: string;
  citationIds: string[];
  confidenceLevel: 'high' | 'moderate' | 'low';
}

export interface Hypothesis {
  hypothesisId: string;
  description: string;
  assessment: HypothesisAssessment;
  assessmentReason: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  missingEvidence: string[];
  diagnosticTests: string[];
}

export interface InvestigationReport {
  _id: string;
  question: string;
  incidentId?: string;
  projectId?: string;
  userId?: string;
  executiveSummary: string;
  hypotheses: Hypothesis[];
  observations: Observation[];
  citations: Citation[];
  missingEvidence: string[];
  recommendedChecks: string[];
  abstention?: {
    isAbstained: boolean;
    reason: string;
    missingRequiredData: string[];
    suggestedTelemetry: string[];
  };
  investigationStatus: 'in_progress' | 'completed' | 'abstained' | 'failed';
  createdAt: string;
  executionTimeMs: number;
  retrievalMetrics: {
    totalChunksRetrieved: number;
    vectorChunksCount: number;
    lexicalChunksCount: number;
    fusedChunksCount: number;
    retrievalMode: 'hybrid_rrf' | 'vector_search' | 'lexical_search' | 'atlas_unavailable_fallback';
    filterApplied?: Record<string, any>;
  };
}

export interface RetrievedChunk extends ChunkDocument {
  score?: number;
  retrievalSource?: 'vector' | 'lexical' | 'hybrid';
  vectorRank?: number;
  lexicalRank?: number;
  rrfScore?: number;
}

export interface EvaluationTestCaseResult {
  testId: string;
  name: string;
  category:
    | 'multi_source_retrieval'
    | 'exact_error_code'
    | 'date_filtered'
    | 'conflicting_doc'
    | 'outdated_doc'
    | 'unanswerable_question'
    | 'citation_validity'
    | 'hypothesis_assessment';
  passed: boolean;
  score: number;
  recallAtK?: number;
  reciprocalRank?: number;
  expectedSourcesFound: string[];
  missingSources: string[];
  citationValidityRate?: number;
  assessmentAccurate?: boolean;
  abstentionAppropriate?: boolean;
  details: string;
  failureNotes?: string;
}

export interface EvaluationReport {
  _id: string;
  suiteName: string;
  timestamp: string;
  metrics: {
    recallAtK: number;
    mrr: number;
    expectedSourceCoverage: number;
    citationIdValidity: number;
    citationSupportReview: number;
    hypothesisAssessmentAccuracy: number;
    abstentionQuality: number;
  };
  automatedMetrics: {
    retrievalRecall: number;
    retrievalMRR: number;
    exactCodePrecision: number;
    citationSyntaxPassRate: number;
  };
  heuristicValidationMetrics: {
    temporalConflictDetectionRate: number;
    abstentionAdherenceRate: number;
    hypothesisAlignmentScore: number;
  };
  testCases: EvaluationTestCaseResult[];
  failureAnalysis: string[];
  environment: {
    embeddingModel: string;
    llmProvider: string;
    vectorSearchAvailable: boolean;
    totalSources: number;
    totalChunks: number;
  };
}
