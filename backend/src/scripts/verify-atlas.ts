import { connectDB, closeDB, getCollections } from '../db/mongo.js';
import { env } from '../config/env.js';
import { getEmbeddingProvider } from '../services/embedding.js';

async function verifyAtlas() {
  console.log('🌐 Connecting to MongoDB Atlas...');
  await connectDB();
  const { chunks } = getCollections();

  console.log('\n--- 1. ATLAS SEARCH INDEXES STATUS & DEFINITIONS ---');
  const cursor = chunks.listSearchIndexes();
  const indexes = await cursor.toArray();
  for (const idx of indexes as any[]) {
    console.log(`Index Name: ${idx.name}`);
    console.log(`Status:     ${idx.status}`);
    console.log(`Queryable:  ${idx.queryable}`);
    console.log(`Definition: ${JSON.stringify(idx.latestDefinition || idx.definition, null, 2)}`);
    console.log('--------------------------------------------------');
  }

  // Live vectorSearch query test
  console.log('\n--- 2. EXECUTING LIVE $vectorSearch QUERY ---');
  const provider = getEmbeddingProvider();
  const qVec = await provider.generateEmbedding('HikariCP connection pool saturation');
  const vResults = await chunks
    .aggregate([
      {
        $vectorSearch: {
          index: env.VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: qVec,
          numCandidates: 20,
          limit: 3
        }
      },
      {
        $project: {
          _id: 1,
          content: 1,
          sectionHeading: 1,
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ])
    .toArray();

  console.log(`Vector search hits returned: ${vResults.length}`);
  for (const [idx, hit] of vResults.entries()) {
    console.log(`  [Hit #${idx + 1}] ID: ${hit._id} | Score: ${(hit as any).score?.toFixed(4)} | Section: ${(hit as any).sectionHeading}`);
  }

  // Live Atlas $search query test
  console.log('\n--- 3. EXECUTING LIVE Atlas $search (LEXICAL) QUERY ---');
  const sResults = await chunks
    .aggregate([
      {
        $search: {
          index: env.SEARCH_INDEX_NAME,
          text: {
            query: 'pool saturation timeout',
            path: ['content', 'sectionHeading']
          }
        }
      },
      {
        $project: {
          _id: 1,
          content: 1,
          sectionHeading: 1,
          score: { $meta: 'searchScore' }
        }
      },
      { $limit: 3 }
    ])
    .toArray();

  console.log(`Atlas Search lexical hits returned: ${sResults.length}`);
  for (const [idx, hit] of sResults.entries()) {
    console.log(`  [Hit #${idx + 1}] ID: ${hit._id} | Score: ${(hit as any).score?.toFixed(4)} | Section: ${(hit as any).sectionHeading}`);
  }

  await closeDB();
  console.log('\n✅ ATLAS VERIFICATION COMPLETED SUCCESSFULLY.');
}

verifyAtlas().catch(async (e) => {
  console.error('❌ Atlas Verification failed:', e);
  await closeDB();
  process.exit(1);
});
