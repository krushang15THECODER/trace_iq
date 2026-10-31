// import dns from "node:dns";

// // Use Google Public DNS
// dns.setServers([
//   "8.8.8.8",
//   "8.8.4.4"
// ]);

console.log("🌐 DNS configured: Google Public DNS");
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB, closeDB } from './db/mongo.js';
import { apiRouter } from './routes/api.js';

const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/ping', (_req: Request, res: Response) => {
  res.send('TraceIQ API Pong');
});

// Main API Router
app.use('/api', apiRouter);

// Centralized Error Handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    status
  });
});

let server: any = null;

async function startServer() {
  try {
    console.log(`🔌 Initializing database connection...`);
    await connectDB();
  } catch (err: any) {
    console.warn(`⚠️ Warning: MongoDB connection deferred or unavailable (${err.message}). TraceIQ will run in local-ready mode.`);
  }

  server = app.listen(env.PORT, () => {
    console.log(`🚀 TraceIQ Backend running on port ${env.PORT}`);
    console.log(`📡 Environment: ${env.NODE_ENV} | Embedding: ${env.EMBEDDING_PROVIDER} | LLM: ${env.LLM_PROVIDER}`);
  });
}

// Graceful termination
const shutdown = async () => {
  console.log('\nShutting down TraceIQ server...');
  if (server) {
    server.close();
  }
  await closeDB();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
