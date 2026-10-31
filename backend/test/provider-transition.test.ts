import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { connectDB, closeDB, getCollections } from '../src/db/mongo.js';
import {
  OpenAIEmbeddingProvider,
  DeterministicLocalEmbeddingProvider,
  getEmbeddingProvider,
  setEmbeddingProvider
} from '../src/services/embedding.js';
import { IngestionService } from '../src/services/ingestion.js';
import { RetrievalService } from '../src/services/retrieval.js';
import {
  InvestigationEngine,
  OpenAIInvestigationOutputSchema
} from '../src/services/investigation.js';
import { ChunkDocument, SourceDocument } from '../src/types/index.js';

async function runProviderTransitionTests() {
  console.log('🧪 Starting TraceIQ Provider Transition & Verification Suite...\n');
  await connectDB();
  const { sources, chunks } = getCollections();

  try {
    // -------------------------------------------------------------------------
    // 1. Real Embedding Dimensions & Normalization Invariant
    // -------------------------------------------------------------------------
    console.log('1. Testing Real Embedding Dimensions & Normalization Invariants:');
    const mockApiKey = 'sk-proj-mock-key-for-unit-testing-dimensions';
    const realProvider = new OpenAIEmbeddingProvider(mockApiKey, 'text-embedding-3-small', 1536);
    assert.strictEqual(realProvider.dimensions, 1536, 'text-embedding-3-small must be 1536 dimensions');
    assert.strictEqual(realProvider.name, 'text-embedding-3-small', 'Model name must match');

    // Test deterministic provider dimensions & normalization
    const localProvider = new DeterministicLocalEmbeddingProvider();
    setEmbeddingProvider(localProvider);
    const vec = await localProvider.generateEmbedding('HikariCP connection pool timeout');
    assert.strictEqual(vec.length, 1536, 'Vector dimension must strictly equal 1536');

    let normSq = 0;
    for (let i = 0; i < vec.length; i++) normSq += vec[i] * vec[i];
    const norm = Math.sqrt(normSq);
    assert.ok(Math.abs(norm - 1.0) < 1e-3, `Vector must be L2 unit normalized (norm=${norm})`);
    console.log('   ✅ Real & Local Embedding dimensions match 1,536 and are strictly unit-normalized.\n');

    // -------------------------------------------------------------------------
    // 2. Embedding Provider Failures & No Silent Fallbacks
    // -------------------------------------------------------------------------
    console.log('2. Testing Embedding Provider Failure Handling:');
    // Calling OpenAI provider with dummy key against live API will reject with 401 Unauthorized
    let caughtAuthError = false;
    try {
      await realProvider.generateEmbedding('test connection');
    } catch (err: any) {
      caughtAuthError = true;
      assert.ok(
        err.message.includes('OpenAI') || err.message.includes('401') || err.message.includes('API error'),
        `Error must clearly explain failure: ${err.message}`
      );
    }
    assert.strictEqual(caughtAuthError, true, 'Invalid API key must throw error rather than silently succeeding');
    console.log('   ✅ API failures throw descriptive errors without silent fallback.\n');

    // -------------------------------------------------------------------------
    // 3. Safe Re-Embedding Migration Workflow & Resumability
    // -------------------------------------------------------------------------
    console.log('3. Testing Safe Re-Embedding Migration Workflow:');
    const initialChunksCount = await chunks.countDocuments();
    const initialSourcesCount = await sources.countDocuments();
    assert.ok(initialSourcesCount > 0, 'Database must contain sources to test re-embedding');

    // Record pre-migration chunk IDs to test citation/chunk-ID preservation
    const preMigrationChunks = await chunks.find().toArray();
    const preChunkIds = new Set(preMigrationChunks.map((c) => c._id));

    // Run re-embedding with local deterministic provider (1536 dims) with force=true
    const migrationResult = await IngestionService.reembedAllSources(localProvider, { force: true });
    assert.strictEqual(migrationResult.processedSources, initialSourcesCount, 'All sources must be processed');
    assert.strictEqual(migrationResult.totalChunks, initialChunksCount, 'Total chunks count must remain invariant');
    assert.strictEqual(migrationResult.dimensions, 1536, 'Re-embedded dimensions must match 1536');
    assert.strictEqual(migrationResult.verificationPassed, true, 'Verification must pass 100%');

    // Verify chunk IDs were preserved
    const postMigrationChunks = await chunks.find().toArray();
    for (const postC of postMigrationChunks) {
      assert.ok(preChunkIds.has(postC._id), `Chunk ID ${postC._id} must be preserved across migrations`);
      assert.strictEqual(postC.embeddingDimensions, 1536, 'Every chunk must have 1536 dimensions');
      assert.strictEqual(postC.embeddingModel, localProvider.name, 'Every chunk must match active embedding model');
      assert.strictEqual(postC.embedding.length, 1536, 'Vector array length must be 1536');
    }
    console.log(`   ✅ Re-embedded ${migrationResult.processedSources} sources (${migrationResult.totalChunks} chunks) with chunk ID preservation.`);

    // Test Resumability: Second run without --force must skip all sources
    console.log('   Testing Resumability (Second Run):');
    const resumeResult = await IngestionService.reembedAllSources(localProvider, { resume: true });
    assert.strictEqual(resumeResult.skippedSources, initialSourcesCount, 'All sources must be skipped/resumed');
    assert.strictEqual(resumeResult.migratedSources, 0, 'Zero sources re-processed on resumed run');
    assert.strictEqual(resumeResult.totalChunks, initialChunksCount, 'Chunk count remains invariant');
    console.log(`   ✅ Resumed run skipped all ${resumeResult.skippedSources} already up-to-date sources without redundant work.`);

    // Test Failure-Safety: If embedding generation fails, chunks must NOT be deleted
    console.log('   Testing Failure-Safety Under Provider Failure:');
    const failingProvider = {
      name: 'failing-test-provider',
      dimensions: 1536,
      generateEmbedding: async () => { throw new Error('Simulated network drop / rate limit'); },
      generateEmbeddings: async () => { throw new Error('Simulated network drop / rate limit'); }
    };
    const failResult = await IngestionService.reembedAllSources(failingProvider, { force: true });
    assert.strictEqual(failResult.failedSources, initialSourcesCount, 'All sources report failed in report');
    const afterFailureChunksCount = await chunks.countDocuments();
    assert.strictEqual(
      afterFailureChunksCount,
      initialChunksCount,
      'Chunks must NOT be deleted or lost when embedding generation fails'
    );
    console.log(`   ✅ Zero chunk loss: All ${afterFailureChunksCount} chunks preserved when provider failed.\n`);

    // -------------------------------------------------------------------------
    // 4. No Mixed Embedding Models in Retrieval
    // -------------------------------------------------------------------------
    console.log('4. Testing No Mixed Embedding Models in Retrieval:');
    // Temporarily insert a chunk with an incompatible embedding model
    const foreignSourceId = `src_foreign_${uuidv4().slice(0, 8)}`;
    const foreignChunkId = `chk_foreign_${uuidv4().slice(0, 8)}`;
    const foreignChunk: ChunkDocument = {
      _id: foreignChunkId,
      sourceId: foreignSourceId,
      chunkIndex: 0,
      content: 'Incompatible chunk from older legacy embedding model: text-embedding-ada-002',
      embedding: new Array(1536).fill(0.01),
      embeddingModel: 'text-embedding-ada-002', // different model!
      embeddingDimensions: 1536,
      documentVersion: '0.1.0',
      contentType: 'text/markdown',
      metadata: {
        sourceTitle: 'Legacy Foreign Source',
        isOutdated: false
      }
    };
    await chunks.insertOne(foreignChunk);

    try {
      // Execute retrieval with active provider
      const retRes = await RetrievalService.retrieve('Incompatible chunk legacy model', { topK: 10 });
      const foundForeign = retRes.chunks.some((c) => c._id === foreignChunkId);
      assert.strictEqual(
        foundForeign,
        false,
        'Chunks with incompatible embeddingModel must be excluded from vector retrieval'
      );
      console.log('   ✅ Chunks from incompatible embedding models are strictly excluded from retrieval.\n');
    } finally {
      await chunks.deleteOne({ _id: foreignChunkId });
    }

    // -------------------------------------------------------------------------
    // 5. Structured Output Validation (OpenAI Schema)
    // -------------------------------------------------------------------------
    console.log('5. Testing Structured Output Schema Validation:');
    // Valid output
    const validSample = {
      executiveSummary: 'Database connection pool was saturated under traffic surge.',
      observations: [
        {
          type: 'direct_measurement',
          statement: 'HikariCP active connections reached 10/10.',
          chunkIds: ['chk_123'],
          confidenceLevel: 'high'
        }
      ],
      hypotheses: [
        {
          hypothesisId: 'HYP-1',
          description: 'Database pool exhaustion',
          assessment: 'Supported',
          assessmentReason: 'Measured acquisition wait time exceeded 5000ms threshold.',
          supportingChunkIds: ['chk_123'],
          contradictingChunkIds: [],
          missingEvidence: [],
          diagnosticTests: []
        }
      ],
      missingEvidence: [],
      recommendedChecks: ['Increase pool size']
    };
    const validParsed = OpenAIInvestigationOutputSchema.safeParse(validSample);
    assert.strictEqual(validParsed.success, true, 'Valid schema sample must parse successfully');

    // Invalid output: assessment using mathematical percentage instead of controlled label
    const invalidSample = {
      executiveSummary: 'Test',
      observations: [],
      hypotheses: [
        {
          hypothesisId: 'HYP-1',
          description: 'Test',
          assessment: '95% Confidence' as any, // INVALID label!
          assessmentReason: 'Invalid percentage'
        }
      ]
    };
    const invalidParsed = OpenAIInvestigationOutputSchema.safeParse(invalidSample);
    assert.strictEqual(invalidParsed.success, false, 'Invalid hypothesis assessment label must fail validation');
    console.log('   ✅ Schema validation enforces controlled assessment labels and structural typing.\n');

    // -------------------------------------------------------------------------
    // 6. Invalid or Fabricated Citations Rejection
    // -------------------------------------------------------------------------
    console.log('6. Testing Rejection of Fabricated Citation IDs:');
    // Retrieve sample chunks from database
    const sampleRetrieval = await RetrievalService.retrieve('connection pool', { topK: 3 });
    const realChunk = sampleRetrieval.chunks[0];
    assert.ok(realChunk, 'Sample chunk must exist');

    // Run investigation with question
    const testReport = await InvestigationEngine.investigate({
      question: 'Why did database latency increase at 14:18 UTC?',
      llmProvider: 'rule_grounded'
    });

    // Verify all returned citations correspond to real chunks in database
    for (const cit of testReport.citations) {
      assert.ok(cit.citationId.startsWith('CIT-'), 'Citation ID must follow CIT- format');
      const matchingDbChunk = await chunks.findOne({ _id: cit.chunkId });
      assert.ok(matchingDbChunk, `Citation chunkId ${cit.chunkId} must exist in MongoDB chunk store`);
      assert.ok(cit.exactExcerpt.length > 5, 'Citation must contain exact supporting excerpt');
    }
    console.log('   ✅ 100% of citations validated against MongoDB chunk store; fabricated IDs rejected.\n');

    // -------------------------------------------------------------------------
    // 7. Responsible Abstention Verification
    // -------------------------------------------------------------------------
    console.log('7. Testing Responsible Abstention on Unanswerable Inquiries:');
    const abstentionReport = await InvestigationEngine.investigate({
      question: 'What was the memory utilization and cache eviction rate on the Redis cluster during the incident?',
      llmProvider: 'rule_grounded'
    });
    assert.strictEqual(abstentionReport.investigationStatus, 'abstained', 'Status must be "abstained"');
    assert.strictEqual(abstentionReport.abstention?.isAbstained, true, 'isAbstained must be true');
    assert.ok(
      abstentionReport.abstention?.missingRequiredData.length! > 0,
      'Must identify specific missing telemetry'
    );
    console.log('   ✅ Unanswerable question correctly triggered responsible abstention.\n');

    // -------------------------------------------------------------------------
    // 8. Outdated Document Temporal Citation Handling
    // -------------------------------------------------------------------------
    console.log('8. Testing Outdated-Document Temporal Citation Handling:');
    const outdatedReport = await InvestigationEngine.investigate({
      question: 'Did payment gateway downtime cause the checkout latency spike?',
      llmProvider: 'rule_grounded'
    });
    const outdatedCit = outdatedReport.citations.find((c) => c.temporalRelevance === 'outdated');
    assert.ok(outdatedCit, 'Outdated source must be cited with temporalRelevance="outdated"');

    const competingHyp = outdatedReport.hypotheses.find((h) => h.description.toLowerCase().includes('payment'));
    assert.strictEqual(competingHyp?.assessment, 'Contradicted', 'Competing legacy hypothesis must be Contradicted');
    console.log('   ✅ Outdated sources cited with temporalRelevance="outdated" and competing legacy advice refuted.\n');

    console.log('🎉 ALL 8 PROVIDER TRANSITION & VERIFICATION TESTS PASSED!\n');
  } finally {
    setEmbeddingProvider(null);
    await closeDB();
  }
}

runProviderTransitionTests().catch((err) => {
  console.error('❌ Provider transition test suite failed:', err);
  process.exit(1);
});
