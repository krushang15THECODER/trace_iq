import { connectDB, closeDB, getCollections } from '../db/mongo.js';
import { IngestionService } from '../services/ingestion.js';
import { SYNTHETIC_INCIDENT, SYNTHETIC_SOURCES } from '../data/syntheticDataset.js';

async function runSeed() {
  console.log('🚀 Starting TraceIQ Synthetic Dataset Seed...');
  await connectDB();
  const { incidents, sources, chunks } = getCollections();

  // 1. Insert or update synthetic incident
  await incidents.updateOne(
    { _id: SYNTHETIC_INCIDENT._id },
    { $set: SYNTHETIC_INCIDENT },
    { upsert: true }
  );
  console.log(`📌 Seeded Incident: ${SYNTHETIC_INCIDENT._id} - "${SYNTHETIC_INCIDENT.title}"`);

  // 2. Ingest synthetic sources
  const createdSourceIds: string[] = [];

  for (const src of SYNTHETIC_SOURCES) {
    console.log(`⏳ Ingesting: ${src.title} (${src.originalFilename})...`);
    const doc = await IngestionService.ingestDocument(src);
    createdSourceIds.push(doc._id);
  }

  // 3. Associate sources with incident
  await incidents.updateOne(
    { _id: SYNTHETIC_INCIDENT._id },
    { $set: { associatedSourceIds: createdSourceIds } }
  );

  const totalSrc = await sources.countDocuments();
  const totalChk = await chunks.countDocuments();

  console.log(`\n🎉 Seed completed successfully!`);
  console.log(`   Total Sources in MongoDB: ${totalSrc}`);
  console.log(`   Total Chunks in MongoDB: ${totalChk}`);
  console.log(`   Associated Incident: ${SYNTHETIC_INCIDENT._id}`);

  await closeDB();
  process.exit(0);
}

runSeed().catch(async (err) => {
  console.error('❌ Seed script error:', err);
  await closeDB();
  process.exit(1);
});
