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
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['gemini', 'openai', 'mock']).default('gemini'),
  EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'rule_grounded']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-3.5-flash'),
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

// In production, enforce that required API keys are supplied based on chosen provider.
if (rawEnv.NODE_ENV === 'production') {
  if (rawEnv.EMBEDDING_PROVIDER === 'gemini' && !rawEnv.GEMINI_API_KEY) {
    throw new Error('Production error: EMBEDDING_PROVIDER=gemini requires GEMINI_API_KEY to be set.');
  }
  if (rawEnv.LLM_PROVIDER === 'gemini' && !rawEnv.GEMINI_API_KEY) {
    throw new Error('Production error: LLM_PROVIDER=gemini requires GEMINI_API_KEY to be set.');
  }
  if (rawEnv.EMBEDDING_PROVIDER === 'openai' && !rawEnv.OPENAI_API_KEY) {
    throw new Error('Production error: EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY to be set.');
  }
  if (rawEnv.LLM_PROVIDER === 'openai' && !rawEnv.OPENAI_API_KEY) {
    throw new Error('Production error: LLM_PROVIDER=openai requires OPENAI_API_KEY to be set.');
  }
}

export const env = rawEnv;
