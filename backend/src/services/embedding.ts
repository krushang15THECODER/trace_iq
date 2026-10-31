import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Production OpenAI text-embedding-3-small provider (1536 dimensions)
 * Features:
 * - Exponential backoff retry on HTTP 429 (Rate Limits) and 5xx transient server errors
 * - Strict 1,536 dimension validation
 * - L2 unit normalization check
 * - Detailed error diagnostics without leaking secrets
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name: string = env.EMBEDDING_MODEL; // 'text-embedding-3-small'
  dimensions: number = env.EMBEDDING_DIMENSIONS; // 1536
  private apiKey: string;
  private maxRetries: number = 3;
  private timeoutMs: number = 20000;

  constructor(apiKey?: string, modelName?: string, dimensions?: number) {
    this.apiKey = apiKey || env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error(
        "OpenAI Embedding Provider initialization failed: OPENAI_API_KEY is not configured."
      );
    }
    if (modelName) this.name = modelName;
    if (dimensions) this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const res = await this.generateEmbeddings([text]);
    return res[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required for OpenAI embeddings. Verify your environment variables."
      );
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    // Sanitize input texts (trim empty / excessive whitespaces)
    const sanitized = texts.map((t) => (t && t.trim().length > 0 ? t.trim() : ' '));

    let attempt = 0;
    let delayMs = 1000;

    while (attempt <= this.maxRetries) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/embeddings',
          {
            model: this.name,
            input: sanitized,
            dimensions: this.dimensions
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.timeoutMs
          }
        );

        const data = response.data?.data;
        if (!Array.isArray(data) || data.length !== sanitized.length) {
          throw new Error(
            `Unexpected response format from OpenAI embeddings API. Expected ${sanitized.length} vectors, got ${data?.length}.`
          );
        }

        // Validate each vector: strictly matching dimensions and normalized
        return data.map((item: any, idx: number) => {
          const vec = item.embedding;
          if (!Array.isArray(vec)) {
            throw new Error(`Item ${idx} does not contain an embedding array.`);
          }
          if (vec.length !== this.dimensions) {
            throw new Error(
              `Embedding dimension mismatch: expected ${this.dimensions}, got ${vec.length} for model ${this.name}.`
            );
          }

          // Verify normalization: OpenAI returns unit-length vectors by default
          let normSq = 0;
          for (let i = 0; i < vec.length; i++) {
            normSq += vec[i] * vec[i];
          }
          const norm = Math.sqrt(normSq);
          if (norm > 0 && Math.abs(norm - 1.0) > 1e-2) {
            // Re-normalize if needed
            return vec.map((v: number) => v / norm);
          }

          return vec;
        });
      } catch (err: any) {
        attempt++;
        const axiosErr = err as AxiosError;
        const statusCode = axiosErr.response?.status;
        const errDetails = (axiosErr.response?.data as any)?.error?.message || axiosErr.message;

        const isRateLimit = statusCode === 429;
        const isTransientServer = statusCode && statusCode >= 500 && statusCode < 600;
        const isNetworkTimeout = axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT';

        if ((isRateLimit || isTransientServer || isNetworkTimeout) && attempt <= this.maxRetries) {
          console.warn(
            `⚠️ OpenAI Embeddings API request failed (attempt ${attempt}/${this.maxRetries}: HTTP ${statusCode || axiosErr.code}). Retrying in ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // exponential backoff
          continue;
        }

        throw new Error(
          `OpenAI Embeddings API error (${statusCode || axiosErr.code || 'Network'}): ${errDetails}`
        );
      }
    }

    throw new Error('OpenAI Embeddings max retries exceeded.');
  }
}

/**
 * Deterministic semantic-hash embedding provider for local/testing without OpenAI API key.
 * Generates unit-normalized 1536-dimensional vectors using SHA-256 token bucket projections.
 * This ensures exact vector dimension matching and repeatable similarity.
 */
export class DeterministicLocalEmbeddingProvider implements EmbeddingProvider {
  name: string = 'deterministic-token-projection-v1';
  dimensions: number = env.EMBEDDING_DIMENSIONS;

  async generateEmbedding(text: string): Promise<number[]> {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // Token frequency and position-based projection into 1536 dimensions
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const hash = crypto.createHash('sha256').update(token).digest();
      for (let j = 0; j < 4; j++) {
        const bucket = (hash.readUInt16BE(j * 4) + i * 37) % this.dimensions;
        const sign = hash.readInt8(j * 4 + 2) > 0 ? 1 : -1;
        vector[bucket] += sign * (1 + 1 / (i + 1));
      }
    }

    // L2 Normalize to unit vector
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] = vector[i] / norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

let activeProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (activeProvider) return activeProvider;

  if (env.EMBEDDING_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "EMBEDDING_PROVIDER is set to 'openai', but OPENAI_API_KEY is missing. Configure OPENAI_API_KEY in your environment, or set EMBEDDING_PROVIDER=mock."
      );
    }
    activeProvider = new OpenAIEmbeddingProvider();
  } else {
    activeProvider = new DeterministicLocalEmbeddingProvider();
  }

  return activeProvider;
}

/**
 * Allows switching provider explicitly (useful for isolated tests or migration routines)
 */
export function setEmbeddingProvider(provider: EmbeddingProvider | null): void {
  activeProvider = provider;
}
