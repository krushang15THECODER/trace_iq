import assert from 'assert';
import { SYNTHETIC_GROUND_TRUTH, SYNTHETIC_SOURCES } from '../src/data/syntheticDataset.js';
import { chunkMarkdownAndText, chunkCsv, RawChunk } from '../src/services/chunker.js';
import { getEmbeddingProvider, DeterministicLocalEmbeddingProvider } from '../src/services/embedding.js';

async function testScenarioLogic() {
  console.log('🧪 Testing End-to-End Scenario & Logic Pipeline...\n');

  // 1. Ingestion & Chunking on all synthetic documents
  console.log('1. Chunking all 8 synthetic documents:');
  const allChunks: RawChunk[] = [];
  for (const src of SYNTHETIC_SOURCES) {
    let chunks: RawChunk[] = [];
    const contentStr = typeof src.content === 'string' ? src.content : src.content.toString();
    if (src.originalFilename.endsWith('.csv')) {
      chunks = chunkCsv(contentStr);
    } else {
      chunks = chunkMarkdownAndText(contentStr);
    }
    assert.ok(chunks.length > 0, `Document ${src.title} must produce chunks`);
    allChunks.push(...chunks);
    console.log(`   - "${src.originalFilename}": ${chunks.length} structured chunks`);
  }
  console.log(`   Total Chunks Extracted: ${allChunks.length}\n`);

  // 2. Embedding Verification
  console.log('2. Verifying Embedding Invariants:');
  const provider = new DeterministicLocalEmbeddingProvider();
  const testVec = await provider.generateEmbedding('HikariCP database pool saturation');
  assert.strictEqual(testVec.length, 1536, 'Vector dimensions must match 1536');
  console.log(`   Dimensions: ${testVec.length} • Provider: ${provider.name} ✅\n`);

  // 3. Exact Code Matching & Lexical Recall
  console.log('3. Exact Error Code Retrieval Verification:');
  const errorCode = 'ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54';
  const matchingChunks = allChunks.filter((c) => c.content.includes(errorCode));
  assert.ok(matchingChunks.length >= 2, 'Should locate exact error code in application logs');
  console.log(`   Found ${matchingChunks.length} chunks containing "${errorCode}" ✅\n`);

  // 4. Outdated Source Detection
  console.log('4. Outdated Document Flagging Verification:');
  const outdatedSources = SYNTHETIC_SOURCES.filter((s) => s.isOutdated || s.metadata?.isOutdated);
  assert.strictEqual(outdatedSources.length, 1, 'Exactly one outdated legacy document expected');
  assert.strictEqual(outdatedSources[0].originalFilename, 'OLD-SRE-RUNBOOK-2021.md');
  console.log(`   Outdated document correctly flagged: "${outdatedSources[0].title}" ✅\n`);

  // 5. Unanswerable Question Boundary
  console.log('5. Unanswerable Question Telemetry Verification:');
  const unanswerableQ = SYNTHETIC_GROUND_TRUTH.unanswerableQuestion;
  const hasCacheInfo = allChunks.some((c) =>
    c.content.toLowerCase().includes('redis') || c.content.toLowerCase().includes('cache cluster')
  );
  assert.strictEqual(hasCacheInfo, false, 'No cache telemetry should exist in ground-truth sources');
  console.log(`   Query: "${unanswerableQ}" confirmed absent from telemetry -> Abstention required ✅\n`);

  console.log('🎉 ALL SCENARIO TESTS PASSED SUCCESSFULLY!\n');
}

testScenarioLogic().catch((err) => {
  console.error('❌ Scenario test failed:', err);
  process.exit(1);
});
