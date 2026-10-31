import { connectDB, closeDB } from '../db/mongo.js';
import { EvaluationRunner } from '../services/evaluation.js';
import { setEmbeddingProvider, DeterministicLocalEmbeddingProvider } from '../services/embedding.js';

async function runEvaluationScript() {
  console.log('🧪 Starting TraceIQ Automated Benchmark Evaluation...');
  await connectDB();
  setEmbeddingProvider(new DeterministicLocalEmbeddingProvider());

  try {
    const report = await EvaluationRunner.runBenchmark();
    console.log('\n================ BENCHMARK SUMMARY ================');
    console.log(`Suite: ${report.suiteName} (${report._id})`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Recall@K: ${report.metrics.recallAtK}`);
    console.log(`MRR: ${report.metrics.mrr}`);
    console.log(`Expected Source Coverage: ${(report.metrics.expectedSourceCoverage * 100).toFixed(1)}%`);
    console.log(`Citation ID Validity: ${(report.metrics.citationIdValidity * 100).toFixed(1)}%`);
    console.log(`Hypothesis Accuracy: ${(report.metrics.hypothesisAssessmentAccuracy * 100).toFixed(1)}%`);
    console.log(`Abstention Quality: ${(report.metrics.abstentionQuality * 100).toFixed(1)}%`);
    console.log('---------------- TEST DETAILS ----------------');
    report.testCases.forEach((tc) => {
      console.log(`[${tc.passed ? 'PASS' : 'FAIL'}] ${tc.name} (${tc.testId}) - Score: ${tc.score}`);
      console.log(`       ${tc.details}`);
    });
    console.log('===================================================\n');
  } catch (err: any) {
    console.error('❌ Evaluation runner failed:', err);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

runEvaluationScript();
