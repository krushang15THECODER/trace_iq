import assert from 'assert';
import { isPrivateIp } from '../src/utils/ssrfValidator.js';
import { chunkMarkdownAndText, chunkCsv, chunkJson } from '../src/services/chunker.js';
import {
  getEmbeddingProvider,
  DeterministicLocalEmbeddingProvider,
  GeminiEmbeddingProvider
} from '../src/services/embedding.js';

async function runUnitTests() {
  console.log('🧪 Running TraceIQ Core Unit & Logic Tests...\n');

  // Test 1: SSRF Protection
  console.log('1. Testing SSRF IP validation:');
  assert.strictEqual(isPrivateIp('127.0.0.1'), true, 'Should block loopback IPv4');
  assert.strictEqual(isPrivateIp('169.254.169.254'), true, 'Should block AWS metadata IP');
  assert.strictEqual(isPrivateIp('10.0.4.12'), true, 'Should block RFC1918 10.x.x.x');
  assert.strictEqual(isPrivateIp('192.168.1.1'), true, 'Should block RFC1918 192.168.x.x');
  assert.strictEqual(isPrivateIp('::1'), true, 'Should block IPv6 loopback');
  assert.strictEqual(isPrivateIp('8.8.8.8'), false, 'Should allow public IP 8.8.8.8');
  assert.strictEqual(isPrivateIp('104.244.42.1'), false, 'Should allow public IP 104.x');
  console.log('   ✅ SSRF IP validation passed.\n');

  // Test 2: Structure-Aware Markdown Chunker
  console.log('2. Testing Markdown structure-aware chunker:');
  const sampleMd = `# Incident Summary\nCheckout latency spiked.\n\n## Database Pool\nHikariPool saturated at 10 connections.\n\n## Mitigations\nIncreased pool size.`;
  const mdChunks = chunkMarkdownAndText(sampleMd, { maxChunkChars: 100 });
  assert.ok(mdChunks.length >= 2, 'Should create structured chunks');
  assert.ok(mdChunks.some((c) => c.sectionHeading === 'Database Pool'), 'Preserved heading');
  console.log(`   ✅ Markdown chunker produced ${mdChunks.length} section-aware chunks.\n`);

  // Test 3: CSV Chunker
  console.log('3. Testing CSV context preservation chunker:');
  const sampleCsv = `timestamp,metric,val\n2024-10-14T14:00:00Z,connections,10\n2024-10-14T14:05:00Z,connections,10`;
  const csvChunks = chunkCsv(sampleCsv, 2);
  assert.strictEqual(csvChunks.length, 1);
  assert.ok(csvChunks[0].content.includes('Columns: timestamp, metric, val'));
  assert.ok(csvChunks[0].content.includes('[Row 1]'));
  console.log('   ✅ CSV chunker preserved column names and row identifiers.\n');

  // Test 4: Embedding Provider Dimension Invariant
  console.log('4. Testing embedding dimensionality and normalization:');
  const provider = new DeterministicLocalEmbeddingProvider();
  const vector = await provider.generateEmbedding('HikariCP connection pool timeout');
  assert.strictEqual(vector.length, 1536, 'Vector dimension must be strictly 1536');
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  assert.ok(Math.abs(norm - 1.0) < 1e-3, 'Vector must be unit normalized');
  console.log(`   ✅ Generated vector has dimension ${vector.length} and unit norm ${norm.toFixed(4)}.\n`);

  // Test 5: Gemini Embedding Provider Invariants
  console.log('5. Testing Gemini Embedding Provider configuration invariants:');
  const gemini = new GeminiEmbeddingProvider('dummy-key-for-unit-test-spec', 'gemini-embedding-2', 1536);
  assert.strictEqual(gemini.dimensions, 1536, 'Gemini vector dimensions must be 1536');
  assert.strictEqual(gemini.name, 'gemini-embedding-2', 'Gemini model name must match');
  console.log('   ✅ Gemini Embedding Provider correctly configured for 1536-dimensional Vector Search.\n');

  console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runUnitTests().catch((err) => {
  console.error('❌ Unit test failure:', err);
  process.exit(1);
});
