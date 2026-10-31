import dns from 'node:dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log('🌐 DNS configured: Google Public DNS');
import { MongoClient, Db, Collection } from 'mongodb';
import { env } from '../config/env.js';
import {
  SourceDocument,
  ChunkDocument,
  IncidentRecord,
  InvestigationReport,
  EvaluationReport
} from '../types/index.js';

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;
let vectorIndexStatus: 'ready' | 'building' | 'not_found' | 'unsupported' = 'not_found';
let lexicalIndexStatus: 'ready' | 'building' | 'not_found' | 'unsupported' = 'not_found';

export async function connectDB(): Promise<Db> {
  if (db && isConnected) return db;

  try {
    client = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });

    await client.connect();
    db = client.db(env.DB_NAME);
    isConnected = true;
    console.log(`✅ Connected to MongoDB: ${env.DB_NAME}`);

    await initDatabaseIndexes(db);
    return db;
  } catch (error: any) {
    console.warn(`⚠️ MongoDB connection warning: ${error.message}`);
    isConnected = false;
    throw error;
  }
}

export function getDB(): Db {
  if (!db || !isConnected) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client || !isConnected) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return client;
}

export function isDbConnected(): boolean {
  return isConnected;
}

export function getCollections() {
  const database = getDB();
  return {
    sources: database.collection<SourceDocument>('sources'),
    chunks: database.collection<ChunkDocument>('chunks'),
    incidents: database.collection<IncidentRecord>('incidents'),
    investigations: database.collection<InvestigationReport>('investigations'),
    evaluations: database.collection<EvaluationReport>('evaluations')
  };
}

export async function checkIndexCapabilities(): Promise<{
  vectorIndexName: string;
  searchIndexName: string;
  vectorIndexStatus: 'ready' | 'building' | 'not_found' | 'unsupported';
  lexicalIndexStatus: 'ready' | 'building' | 'not_found' | 'unsupported';
  isAtlas: boolean;
  message: string;
}> {
  if (!isConnected || !db) {
    return {
      vectorIndexName: env.VECTOR_INDEX_NAME,
      searchIndexName: env.SEARCH_INDEX_NAME,
      vectorIndexStatus: 'not_found',
      lexicalIndexStatus: 'not_found',
      isAtlas: false,
      message: 'MongoDB disconnected'
    };
  }

  const chunksCol = db.collection('chunks');
  let isAtlas = false;

  try {
    // Attempt listSearchIndexes (Atlas only)
    const searchIndexesCursor = chunksCol.listSearchIndexes();
    const indexes = await searchIndexesCursor.toArray();
    isAtlas = true;

    const vIdx = indexes.find((i: any) => i.name === env.VECTOR_INDEX_NAME) as any;
    if (vIdx) {
      vectorIndexStatus = vIdx.status === 'READY' ? 'ready' : 'building';
    } else {
      vectorIndexStatus = 'not_found';
    }

    const sIdx = indexes.find((i: any) => i.name === env.SEARCH_INDEX_NAME) as any;
    if (sIdx) {
      lexicalIndexStatus = sIdx.status === 'READY' ? 'ready' : 'building';
    } else {
      lexicalIndexStatus = 'not_found';
    }

    return {
      vectorIndexName: env.VECTOR_INDEX_NAME,
      searchIndexName: env.SEARCH_INDEX_NAME,
      vectorIndexStatus,
      lexicalIndexStatus,
      isAtlas: true,
      message: `Atlas Search Indexes checked. Vector index: ${vectorIndexStatus}, Lexical index: ${lexicalIndexStatus}`
    };
  } catch (err: any) {
    // If command is not recognized, it's a local/standalone MongoDB instance without Atlas Search
    vectorIndexStatus = 'unsupported';
    lexicalIndexStatus = 'unsupported';
    return {
      vectorIndexName: env.VECTOR_INDEX_NAME,
      searchIndexName: env.SEARCH_INDEX_NAME,
      vectorIndexStatus: 'unsupported',
      lexicalIndexStatus: 'unsupported',
      isAtlas: false,
      message:
        'Local or standalone MongoDB deployment detected. Atlas Vector Search requires MongoDB Atlas (M0+). Lexical fallback with text/regex indexes will be used.'
    };
  }
}

export async function initDatabaseIndexes(database: Db): Promise<void> {
  try {
    const sources = database.collection('sources');
    const chunks = database.collection('chunks');
    const incidents = database.collection('incidents');
    const investigations = database.collection('investigations');
    const evaluations = database.collection('evaluations');

    // Standard B-Tree indexes for fast exact queries
    await sources.createIndex({ contentHash: 1 }, { background: true });
    await sources.createIndex({ sourceType: 1, ingestionStatus: 1 }, { background: true });

    await chunks.createIndex({ sourceId: 1, chunkIndex: 1 }, { background: true });
    await chunks.createIndex({ 'metadata.sourceType': 1 }, { background: true });
    await chunks.createIndex({ 'metadata.incidentDate': 1 }, { background: true });
    await chunks.createIndex({ 'metadata.isOutdated': 1 }, { background: true });

    // Standard text index on chunks for local lexical search fallback
    await chunks.createIndex(
      { content: 'text', sectionHeading: 'text' },
      { name: 'chunks_text_index', background: true, default_language: 'english' }
    );

    await incidents.createIndex({ severity: 1, incidentDate: -1 }, { background: true });
    await investigations.createIndex({ createdAt: -1 }, { background: true });
    await evaluations.createIndex({ timestamp: -1 }, { background: true });

    console.log('✅ Standard MongoDB B-Tree and Text indexes initialized');
  } catch (error: any) {
    console.warn(`⚠️ Warning initializing standard indexes: ${error.message}`);
  }
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    isConnected = false;
    console.log('MongoDB connection closed');
  }
}
