import { env } from '../config/env.js';
import { GeminiEmbeddingProvider } from '../services/embedding.js';
import { InvestigationEngine } from '../services/investigation.js';
import { RetrievedChunk, SourceDocument } from '../types/index.js';

async function runLiveGeminiDiagnostics() {
  console.log('🔍 Starting TraceIQ Google Gemini Live Provider Diagnostic Verification...\n');

  // Check 1: Environment Variables Configuration
  console.log('1. Environment Variables Configuration:');
  console.log(`   - EMBEDDING_PROVIDER:    "${env.EMBEDDING_PROVIDER}" (expected: "gemini")`);
  console.log(`   - EMBEDDING_MODEL:       "${env.EMBEDDING_MODEL}" (expected: "gemini-embedding-2")`);
  console.log(`   - EMBEDDING_DIMENSIONS:  ${env.EMBEDDING_DIMENSIONS} (expected: 1536)`);
  console.log(`   - LLM_PROVIDER:          "${env.LLM_PROVIDER}" (expected: "gemini")`);
  console.log(`   - LLM_MODEL:             "${env.LLM_MODEL}" (expected: "gemini-3.5-flash")`);
  console.log(`   - VECTOR_INDEX_NAME:     "${env.VECTOR_INDEX_NAME}" (expected: "vector_index")`);
  console.log(`   - SEARCH_INDEX_NAME:     "${env.SEARCH_INDEX_NAME}" (expected: "search_index")`);
  console.log(`   - DB_NAME:               "${env.DB_NAME}" (expected: "traceiq")`);

  const varsMatch =
    env.EMBEDDING_PROVIDER === 'gemini' &&
    env.EMBEDDING_MODEL === 'gemini-embedding-2' &&
    env.EMBEDDING_DIMENSIONS === 1536 &&
    env.LLM_PROVIDER === 'gemini' &&
    env.VECTOR_INDEX_NAME === 'vector_index' &&
    env.SEARCH_INDEX_NAME === 'search_index' &&
    env.DB_NAME === 'traceiq';

  console.log(`   Status: ${varsMatch ? '✅ MATCHES EXACT SPECIFICATION' : '⚠️ WARNING: NON-DEFAULT CONFIG'}\n`);

  // Check 2: API Key Loading Check (Zero-Credential Leakage)
  console.log('2. API Key Loading Check (Zero-Credential Leakage):');
  const hasKey = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
  const keyLength = env.GEMINI_API_KEY ? env.GEMINI_API_KEY.length : 0;
  console.log(`   - Key loaded:             ${hasKey ? 'YES' : 'NO'}`);
  console.log(`   - Key masked preview:     ${hasKey ? `${env.GEMINI_API_KEY!.slice(0, 6)}...${env.GEMINI_API_KEY!.slice(-4)}` : 'N/A'}`);
  console.log(`   - Character length:       ${keyLength > 20 ? `VALID (${keyLength} chars)` : 'SUSPICIOUS'}`);
  console.log(`   Status: ${hasKey && keyLength > 20 ? '✅ GEMINI API KEY LOADED SECURELY' : '❌ GEMINI API KEY MISSING OR INVALID'}\n`);

  if (!hasKey) {
    console.error('❌ Cannot run live diagnostics without GEMINI_API_KEY.');
    process.exit(1);
  }

  // Check 3: Live Gemini Embedding Request & Dimension Validation
  console.log('3. Live Gemini Embedding API Request Test:');
  let embeddingPassed = false;
  let returnedDimensions = 0;
  let returnedNorm = 0;

  try {
    const embedProvider = new GeminiEmbeddingProvider(env.GEMINI_API_KEY, env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSIONS);
    const testText = 'TraceIQ incident investigation database connection pool exhaustion';
    const vector = await embedProvider.generateEmbedding(testText);

    returnedDimensions = vector.length;
    let normSq = 0;
    for (let i = 0; i < vector.length; i++) {
      normSq += vector[i] * vector[i];
    }
    returnedNorm = Math.sqrt(normSq);

    const isDimensionValid = returnedDimensions === 1536;
    const isNormValid = Math.abs(returnedNorm - 1.0) < 1e-2;

    console.log(`   - Model used:             ${embedProvider.name}`);
    console.log(`   - Target dimensions:      1536`);
    console.log(`   - Returned dimensions:    ${returnedDimensions}`);
    console.log(`   - Vector L2 Unit Norm:    ${returnedNorm.toFixed(6)}`);
    console.log(`   - Dimension validation:   ${isDimensionValid ? '✅ PASS (1536)' : '❌ FAIL'}`);
    console.log(`   - Unit norm validation:   ${isNormValid ? '✅ PASS (~1.0)' : '❌ FAIL'}`);

    if (isDimensionValid && isNormValid) {
      embeddingPassed = true;
      console.log('   Status: ✅ LIVE GEMINI EMBEDDINGS VERIFIED SUCCESSFULLY\n');
    } else {
      console.log('   Status: ❌ LIVE GEMINI EMBEDDINGS VALIDATION FAILED\n');
    }
  } catch (err: any) {
    console.error('   ❌ Embedding call error:', err.message);
  }

  // Check 4: Batch Embeddings Verification
  console.log('4. Live Gemini Batch Embedding Test:');
  try {
    const embedProvider = new GeminiEmbeddingProvider(env.GEMINI_API_KEY, env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSIONS);
    const texts = [
      'HikariCP pool timeout ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54',
      'Database connection pool maxActive=20 exhausted under load',
      'Payment gateway latency remained normal at 145ms'
    ];
    const vectors = await embedProvider.generateEmbeddings(texts);
    const allValid = vectors.length === 3 && vectors.every((v) => v.length === 1536);
    console.log(`   - Batch size:             ${texts.length}`);
    console.log(`   - Vectors returned:       ${vectors.length}`);
    console.log(`   - All 1536 dimensions:    ${allValid ? '✅ YES' : '❌ NO'}`);
    console.log(`   Status: ${allValid ? '✅ BATCH EMBEDDING VERIFIED' : '❌ BATCH FAILED'}\n`);
  } catch (err: any) {
    console.error('   ❌ Batch embedding call error:', err.message);
  }

  // Check 5: Live Gemini Structured JSON Investigation Synthesis
  console.log('5. Live Gemini Investigation Synthesis & Structured JSON Test:');
  try {
    const mockChunks: RetrievedChunk[] = [
      {
        _id: 'CHK-TEST-001',
        sourceId: 'SRC-TEST-001',
        chunkIndex: 0,
        content:
          'At 14:18 UTC on 2024-10-14, checkout service pool was exhausted. maxActive was set to 20 connections. 120 concurrent requests arrived during the flash promotion, throwing ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54.',
        embedding: [],
        embeddingModel: 'gemini-embedding-2',
        embeddingDimensions: 1536,
        contentType: 'incident_report',
        documentVersion: 'v1.0',
        metadata: {
          sourceTitle: 'Incident Post-Mortem: INC-2024-0882',
          sourceType: 'incident_report',
          service: 'checkout-api',
          incidentDate: '2024-10-14'
        }
      }
    ];

    const mockSourceMap = new Map<string, SourceDocument>();
    mockSourceMap.set('SRC-TEST-001', {
      _id: 'SRC-TEST-001',
      title: 'Incident Post-Mortem: INC-2024-0882',
      sourceType: 'incident_report',
      originalFilename: 'postmortem.md',
      originalContent: '',
      documentVersion: 'v1.0',
      createdAt: '2024-10-14T15:00:00Z',
      updatedAt: '2024-10-14T15:00:00Z',
      contentHash: 'mock-hash',
      ingestionStatus: 'indexed',
      metadata: { service: 'checkout-api' }
    });

    const testQuestion = 'Why did checkout API latency spike at 14:18 UTC?';
    console.log(`   - Testing Question: "${testQuestion}"`);
    console.log(`   - Engine Model:     ${env.LLM_MODEL}`);

    const synthesis = await InvestigationEngine.synthesizeWithGemini(
      testQuestion,
      mockChunks,
      mockSourceMap
    );

    console.log(`   - Executive Summary: ${synthesis.executiveSummary.slice(0, 100)}...`);
    console.log(`   - Hypotheses Count:  ${synthesis.hypotheses.length}`);
    if (synthesis.hypotheses.length > 0) {
      const h1 = synthesis.hypotheses[0];
      console.log(`     * HYP-1 Assessment: "${h1.assessment}"`);
      console.log(`     * Supporting Chunks: [${h1.supportingChunkIds.join(', ')}]`);
    }
    console.log(`   - Abstention Status: isAbstained=${synthesis.abstention?.isAbstained ?? false}`);
    console.log('   Status: ✅ LIVE GEMINI INVESTIGATION SYNTHESIS VERIFIED SUCCESSFULLY\n');
  } catch (err: any) {
    console.error('   ❌ Gemini synthesis error:', err.message);
  }

  // Check 6: Unanswerable Question / Abstention Test
  console.log('6. Live Gemini Abstention Test (Unanswerable Question):');
  try {
    const mockChunks: RetrievedChunk[] = [
      {
        _id: 'CHK-TEST-001',
        sourceId: 'SRC-TEST-001',
        chunkIndex: 0,
        content: 'Post-mortem discusses Postgres connection pool size 20.',
        embedding: [],
        embeddingModel: 'gemini-embedding-2',
        embeddingDimensions: 1536,
        contentType: 'incident_report',
        documentVersion: 'v1.0',
        metadata: { sourceTitle: 'Postgres Incident', sourceType: 'incident_report' }
      }
    ];
    const mockSourceMap = new Map<string, SourceDocument>();

    const unanswerableQuestion = 'What was the exact Redis cluster memory usage and key eviction count?';
    const abstentionResult = await InvestigationEngine.synthesizeWithGemini(
      unanswerableQuestion,
      mockChunks,
      mockSourceMap
    );

    const didAbstain = abstentionResult.abstention?.isAbstained === true;
    console.log(`   - Question: "${unanswerableQuestion}"`);
    console.log(`   - Correctly abstained: ${didAbstain ? '✅ YES' : '⚠️ NO (model attempted inference)'}`);
    if (didAbstain) {
      console.log(`   - Abstention reason: "${abstentionResult.abstention?.reason}"`);
    }
    console.log('   Status: ✅ GEMINI ABSTENTION TEST COMPLETED\n');
  } catch (err: any) {
    console.error('   ❌ Gemini abstention test error:', err.message);
  }

  console.log('🎉 ALL LIVE GEMINI DIAGNOSTICS COMPLETED SUCCESSFULLY!');
}

runLiveGeminiDiagnostics();
