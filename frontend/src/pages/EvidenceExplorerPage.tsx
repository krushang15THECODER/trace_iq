import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Filter,
  FileText,
  Clock,
  Tag,
  CheckCircle,
  ExternalLink,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { ChunkDocument } from '../types';
import { api } from '../api/client';

interface EvidenceExplorerPageProps {
  onNavigateToSource: (sourceId: string) => void;
}

export const EvidenceExplorerPage: React.FC<EvidenceExplorerPageProps> = ({
  onNavigateToSource
}) => {
  const [query, setQuery] = useState<string>('HikariPool connection timeout');
  const [retrievalMode, setRetrievalMode] = useState<'hybrid' | 'vector' | 'lexical'>('hybrid');
  const [topK, setTopK] = useState<number>(10);
  const [chunks, setChunks] = useState<ChunkDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<{
    mode: string;
    vCount: number;
    lCount: number;
    fused: number;
  } | null>(null);

  const performSearch = async (overrideQuery?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    if (!q.trim()) return;

    setIsLoading(true);
    try {
      const res = await api.testSearch({
        query: q,
        mode: retrievalMode,
        topK
      });
      setChunks(res.chunks);
      setStats({
        mode: res.retrievalMode,
        vCount: res.vectorCount,
        lCount: res.lexicalCount,
        fused: res.fusedCount
      });
    } catch (err: any) {
      console.error('Evidence search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Evidence & Vector Chunk Explorer</h1>
          <p className="page-subtitle">
            Inspect individual text chunks, embeddings, retrieval scores, and reciprocal rank fusion provenance.
          </p>
        </div>
      </div>

      {/* Query Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Search / Semantic Query
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Query chunks via Vector Search or Lexical match..."
              style={{ marginTop: '4px' }}
            />
          </div>

          <div style={{ width: '170px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Retrieval Strategy
            </label>
            <select
              value={retrievalMode}
              onChange={(e) => setRetrievalMode(e.target.value as any)}
              style={{ marginTop: '4px' }}
            >
              <option value="hybrid">Hybrid (RRF Fusion)</option>
              <option value="vector">Vector Only ($vectorSearch)</option>
              <option value="lexical">Lexical Only ($search)</option>
            </select>
          </div>

          <div style={{ width: '110px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Limit (Top-K)
            </label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ marginTop: '4px' }}
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            disabled={isLoading || !query.trim()}
            onClick={() => performSearch()}
            style={{ height: '38px', padding: '0 20px' }}
          >
            <Search size={14} />
            Search Evidence
          </button>
        </div>

        {stats && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Active Retrieval Mode: <strong>{stats.mode}</strong></span>
            <span>Vector Candidates: <strong>{stats.vCount}</strong></span>
            <span>Lexical Candidates: <strong>{stats.lCount}</strong></span>
            <span>Rank Fused: <strong>{stats.fused}</strong></span>
          </div>
        )}
      </div>

      {/* Chunk Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isLoading ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            Searching MongoDB chunks...
          </div>
        ) : chunks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No chunk evidence matched this query. Try a different search term or ingest more documents.
          </div>
        ) : (
          chunks.map((chunk, idx) => (
            <div key={chunk._id} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="brand-badge" style={{ backgroundColor: 'var(--accent-forest-subtle)', color: 'var(--accent-forest)' }}>
                      Rank #{idx + 1}
                    </span>
                    <strong style={{ fontSize: '14px' }}>
                      {chunk.metadata?.sourceTitle || chunk.sourceId}
                    </strong>
                    {chunk.metadata?.isOutdated && (
                      <span className="badge badge-outdated">Outdated</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Section: <em>{chunk.sectionHeading || 'General'}</em> • Version: <code>v{chunk.documentVersion}</code>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {chunk.score !== undefined && (
                    <span className="badge" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
                      Score: {chunk.score}
                    </span>
                  )}
                  {chunk.retrievalSource && (
                    <span className="badge badge-supported">
                      Source: {chunk.retrievalSource}
                    </span>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => onNavigateToSource(chunk.sourceId)}
                  >
                    <ExternalLink size={12} />
                    Source
                  </button>
                </div>
              </div>

              {/* Chunk Content */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-secondary)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)'
                }}
              >
                {chunk.content}
              </div>

              {/* Chunk Metadata Footer */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>ID: {chunk._id}</span>
                <span>Type: {chunk.contentType}</span>
                <span>Dim: {chunk.embeddingDimensions}</span>
                {chunk.timestamps && chunk.timestamps.length > 0 && (
                  <span>Timestamps: {chunk.timestamps.join(', ')}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
