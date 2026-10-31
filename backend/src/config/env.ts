import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env from backend directory or project root reliably
const envPaths = [
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../.env') : null,
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../../.env') : null
].filter(Boolean) as string[];

for (const p of envPaths) {
  dotenv.config({ path: p });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/traceiq'),
  DB_NAME: z.string().default('traceiq'),
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['openai', 'mock']).default('mock'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  LLM_PROVIDER: z.enum(['openai', 'rule_grounded']).default('rule_grounded'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  VECTOR_INDEX_NAME: z.string().default('vector_index'),
  SEARCH_INDEX_NAME: z.string().default('search_index'),
  CORS_ORIGIN: z.string().default('*')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

const rawEnv = parsed.data;

// In production, enforce that if OpenAI provider is chosen, the API key must be supplied.
if (rawEnv.NODE_ENV === 'production') {
  if (rawEnv.EMBEDDING_PROVIDER === 'openai' && !rawEnv.OPENAI_API_KEY) {
    throw new Error('Production error: EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY to be set.');
  }
  if (rawEnv.LLM_PROVIDER === 'openai' && !rawEnv.OPENAI_API_KEY) {
    throw new Error('Production error: LLM_PROVIDER=openai requires OPENAI_API_KEY to be set.');
  }
}

export const env = rawEnv;
