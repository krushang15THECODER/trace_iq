import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import { connectDB, closeDB, getCollections } from '../src/db/mongo.js';
import { IngestionService } from '../src/services/ingestion.js';
import { RetrievalService } from '../src/services/retrieval.js';
import { InvestigationEngine } from '../src/services/investigation.js';
import { setEmbeddingProvider, DeterministicLocalEmbeddingProvider } from '../src/services/embedding.js';

async function runRegressionTests() {
  console.log('🧪 Running Temporal & Outdated Evidence Regression Test Suite...\n');
  await connectDB();
  setEmbeddingProvider(new DeterministicLocalEmbeddingProvider());
  const { sources, chunks } = getCollections();

  const testIdsToCleanup: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Test 1: Current Documentation in Knowledge Base
    // -------------------------------------------------------------------------
    console.log('Test 1: Current documentation ingestion and temporal classification');
    const curSource = await sources.findOne({ originalFilename: 'ARCH-CHECKOUT-SERVICE.md' });
    assert.ok(curSource, 'Current architecture source must exist');
    assert.strictEqual(curSource.metadata.isOutdated, false, 'Current source must have isOutdated=false');

    const curChunk = await chunks.findOne({ sourceId: curSource._id });
    assert.ok(curChunk, 'Current chunk must exist');
    assert.strictEqual(curChunk.metadata?.isOutdated, false, 'Current chunk must have isOutdated=false');

    const curReport = await InvestigationEngine.investigate({
      question: 'What is the active database connection pool settings under Spring Boot?',
      llmProvider: 'rule_grounded'
    });
    const curCitation = curReport.citations.find((c) => c.sourceId === curSource._id);
    if (curCitation) {
      assert.strictEqual(curCitation.temporalRelevance, 'current', 'Current citation must have temporalRelevance="current"');
    }
    console.log('   ✅ Test 1 Passed: Current documentation correctly preserved as current operational guidance.\n');

    // -------------------------------------------------------------------------
    // Test 2: Explicitly Outdated Documentation Identification & Filtering
    // -------------------------------------------------------------------------
    console.log('Test 2: Explicitly outdated documentation identification and isolation');
    const oldSource = await sources.findOne({ originalFilename: 'OLD-SRE-RUNBOOK-2021.md' });
    assert.ok(oldSource, 'Outdated source must exist');
    assert.strictEqual(oldSource.metadata.isOutdated, true, 'Outdated source must have isOutdated=true');

    const oldChunk = await chunks.findOne({ sourceId: oldSource._id });
    assert.ok(oldChunk, 'Outdated chunk must exist');
    assert.strictEqual(oldChunk.metadata?.isOutdated, true, 'Outdated chunk must have isOutdated=true');

    // Verify retrieval filter honoring excludeOutdated
    const filteredRes = await RetrievalService.retrieve('payment gateway cause checkout latency', {
      topK: 10,
      filter: { excludeOutdated: true }
    });
    const foundOutdatedInFiltered = filteredRes.chunks.some((c) => c.sourceId === oldSource._id);
    assert.strictEqual(foundOutdatedInFiltered, false, 'excludeOutdated=true filter must exclude outdated chunks');

    // Verify standard retrieval (excludeOutdated not set or false) preserves historical evidence
    const unfilteredRes = await RetrievalService.retrieve('payment gateway cause checkout latency', {
      topK: 10,
      filter: { excludeOutdated: false }
    });
    const foundOutdatedInUnfiltered = unfilteredRes.chunks.some((c) => c.sourceId === oldSource._id);
    assert.strictEqual(foundOutdatedInUnfiltered, true, 'Standard retrieval must preserve historical outdated evidence');

    // Verify investigation assigns temporalRelevance='outdated'
    const oldReport = await InvestigationEngine.investigate({
      question: 'Did payment gateway downtime cause checkout latency according to legacy runbooks?',
      llmProvider: 'rule_grounded'
    });
    const oldCitation = oldReport.citations.find((c) => c.sourceId === oldSource._id);
    assert.ok(oldCitation, 'Old runbook should be cited in historical inquiry');
    assert.strictEqual(oldCitation.temporalRelevance, 'outdated', 'Citation for outdated document must be marked "outdated"');
    console.log('   ✅ Test 2 Passed: Outdated documentation identified, filterable, and cited with temporalRelevance="outdated".\n');

    // -------------------------------------------------------------------------
    // Test 3: Historical Evidence That Remains Relevant (Old Date, Not Outdated)
    // -------------------------------------------------------------------------
    console.log('Test 3: Historical evidence with past dates that is NOT outdated');
    // SRE-RUNBOOK-POOL-TUNING.md was written in May 2024 (earlier date), but is valid active operational guidance
    const histSource = await sources.findOne({ originalFilename: 'SRE-RUNBOOK-POOL-TUNING.md' });
    assert.ok(histSource, 'SRE-RUNBOOK-POOL-TUNING.md source must exist');
    assert.strictEqual(histSource.metadata.isOutdated, false, 'Historical document without deprecation must NOT be marked outdated');

    const histChunk = await chunks.findOne({ sourceId: histSource._id });
    assert.ok(histChunk, 'Chunk must exist');
    assert.strictEqual(histChunk.metadata?.isOutdated, false, 'Historical document chunk must have isOutdated=false');
    console.log('   ✅ Test 3 Passed: Documents with older creation dates are not erroneously marked outdated without explicit metadata.\n');

    // -------------------------------------------------------------------------
    // Test 4: Mixed Current and Outdated Evidence in Investigation
    // -------------------------------------------------------------------------
    console.log('Test 4: Mixed current telemetry vs outdated advice in investigation');
    const mixedReport = await InvestigationEngine.investigate({
      question: 'Did payment gateway downtime cause the checkout latency spike?',
      llmProvider: 'rule_grounded'
    });

    // Check direct measurements
    const directMeasurements = mixedReport.observations.filter((o) => o.type === 'direct_measurement');
    for (const dm of directMeasurements) {
      for (const citId of dm.citationIds) {
        const cit = mixedReport.citations.find((c) => c.citationId === citId);
        assert.notStrictEqual(cit?.temporalRelevance, 'outdated', 'Direct measurements must NEVER cite outdated documentation as active measurement');
      }
    }

    // Check that outdated notice observation exists
    const hasDeprecationObservation = mixedReport.observations.some(
      (o) => o.statement.toLowerCase().includes('deprecated') || o.statement.toLowerCase().includes('outdated')
    );
    assert.strictEqual(hasDeprecationObservation, true, 'Investigation must surface an explicit deprecation notice observation');

    // Check competing hypothesis assessment
    const gatewayHyp = mixedReport.hypotheses.find(
      (h) => h.description.toLowerCase().includes('gateway') || h.description.toLowerCase().includes('payment')
    );
    assert.ok(gatewayHyp, 'Competing gateway hypothesis must be evaluated');
    assert.strictEqual(gatewayHyp.assessment, 'Contradicted', 'Hypothesis relying on refuted outdated advice must be Contradicted');
    console.log('   ✅ Test 4 Passed: Direct measurements protected from outdated contamination and competing legacy claims refuted.\n');

    // -------------------------------------------------------------------------
    // Test 5: Missing Outdated-Status Metadata Handling
    // -------------------------------------------------------------------------
    console.log('Test 5: Missing outdated metadata handling & metadata-only propagation');
    const test5aId = `test_missing_${uuidv4().slice(0, 8)}`;
    testIdsToCleanup.push(test5aId);

    // Case 5A: completely omitted
    const doc5a = await IngestionService.ingestDocument({
      title: 'Doc with completely omitted outdated flag',
      sourceType: 'note',
      originalFilename: `${test5aId}.md`,
      content: 'Standard technical note with no outdated metadata specified.'
    });
    assert.strictEqual(doc5a.metadata.isOutdated, false, 'Omitted isOutdated must default safely to false');

    // Case 5B: passed only inside metadata dictionary
    const test5bId = `test_metaonly_${uuidv4().slice(0, 8)}`;
    testIdsToCleanup.push(test5bId);

    const doc5b = await IngestionService.ingestDocument({
      title: 'Doc with isOutdated inside metadata object only',
      sourceType: 'note',
      originalFilename: `${test5bId}.md`,
      metadata: {
        isOutdated: true,
        note: 'Flagged via metadata sub-object'
      },
      content: 'Content flagged as outdated via nested metadata dictionary.'
    });
    assert.strictEqual(doc5b.metadata.isOutdated, true, 'Nested metadata.isOutdated must be recognized');
    const chunk5b = await chunks.findOne({ sourceId: doc5b._id });
    assert.strictEqual(chunk5b?.metadata?.isOutdated, true, 'Chunk metadata must propagate nested isOutdated=true');
    console.log('   ✅ Test 5 Passed: Missing and nested metadata handled safely without loss or corruption.\n');

    console.log('🎉 ALL 5 TEMPORAL EVIDENCE REGRESSION TESTS PASSED!\n');
  } finally {
    // Clean up temporary test sources and chunks
    for (const id of testIdsToCleanup) {
      const src = await sources.findOne({ originalFilename: `${id}.md` });
      if (src) {
        await chunks.deleteMany({ sourceId: src._id });
        await sources.deleteOne({ _id: src._id });
      }
    }
    setEmbeddingProvider(null);
    await closeDB();
  }
}

runRegressionTests().catch((err) => {
  console.error('❌ Regression test suite failed:', err);
  process.exit(1);
});
