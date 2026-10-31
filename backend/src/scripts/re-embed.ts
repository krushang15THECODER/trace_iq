import { connectDB, closeDB } from '../db/mongo.js';
import { IngestionService } from '../services/ingestion.js';
import { getEmbeddingProvider } from '../services/embedding.js';

async function runReEmbedScript() {
  console.log('🔄 Starting TraceIQ Safe Re-Embedding Migration Script...');
  await connectDB();

  const isForce = process.argv.includes('--force');

  try {
    const provider = getEmbeddingProvider();
    const isRealOpenAI = provider.name === 'text-embedding-3-small';

    console.log(`Target Embedding Provider: ${provider.name} (${provider.dimensions} dimensions)`);
    console.log(`Execution Mode: ${isRealOpenAI ? '🌐 Real OpenAI Embeddings API' : '🧪 Deterministic Local Projections'}`);
    console.log(`Resumable Mode: ${isForce ? 'DISABLED (--force passed)' : 'ENABLED (skipping already up-to-date sources)'}`);

    const result = await IngestionService.reembedAllSources(provider, {
      force: isForce,
      resume: !isForce
    });

    console.log('\n================ RE-EMBEDDING MIGRATION REPORT ================');
    console.log(`Success:              ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Sources Scanned:      ${result.processedSources}`);
    console.log(`Sources Migrated:     ${result.migratedSources}`);
    console.log(`Sources Resumed/Skip: ${result.skippedSources}`);
    console.log(`Sources Failed:       ${result.failedSources}`);
    console.log(`Initial Chunks:       ${result.initialChunks}`);
    console.log(`Final Total Chunks:   ${result.totalChunks}`);
    console.log(`Embedding Model:      ${result.embeddingModel}`);
    console.log(`Vector Dimensions:    ${result.dimensions}`);
    console.log(`100% Uniformity:      ${result.verificationPassed ? 'VERIFIED (0 mismatched chunks)' : 'FAILED'}`);
    if (result.failedSourceDetails && result.failedSourceDetails.length > 0) {
      console.log('\n❌ Failure Details:');
      for (const f of result.failedSourceDetails) {
        console.log(`  - [${f.sourceId}] ${f.title}: ${f.error}`);
      }
    }
    console.log('=================================================================\n');

    if (!result.success) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Re-embedding migration fatal error:', err.message);
    process.exit(1);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

runReEmbedScript();
