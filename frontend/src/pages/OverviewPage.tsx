import React from 'react';
import {
  Database,
  Layers,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';
import { HealthInfo, InvestigationReport, SourceDocument } from '../types';

interface OverviewPageProps {
  health: HealthInfo | null;
  sources: SourceDocument[];
  investigations: InvestigationReport[];
  onNavigate: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  health,
  sources,
  investigations,
  onNavigate
}) => {
  const failedSources = sources.filter((s) => s.ingestionStatus === 'failed');
  const recentInvestigations = investigations.slice(0, 5);

  const isAtlasReady = health?.database.isAtlas && health?.database.vectorIndex.status === 'ready';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operational Overview</h1>
          <p className="page-subtitle">
            Evidence-grounded engineering incident triage platform powered by MongoDB Atlas Vector Search.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('eval')}>
            <TrendingUp size={15} />
            View Benchmarks
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('investigate')}>
            <Sparkles size={15} />
            New Investigation
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={13} />
            Total Knowledge Sources
          </div>
          <div className="metric-value">{sources.length}</div>
          <div className="metric-meta">Architecture, logs, metrics & runbooks</div>
        </div>

        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={13} />
            Indexed Vector Chunks
          </div>
          <div className="metric-value">{health?.counts.totalChunks ?? 0}</div>
          <div className="metric-meta">1,536-dim embeddings stored</div>
        </div>

        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSearch size={13} />
            Past Investigations
          </div>
          <div className="metric-value">{investigations.length}</div>
          <div className="metric-meta">Evidence-backed post-mortems</div>
        </div>

        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={13} />
            Atlas Vector Search
          </div>
          <div className="metric-value" style={{ fontSize: '20px', paddingTop: '6px' }}>
            {isAtlasReady ? (
              <span style={{ color: '#2E7D32', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={20} /> Active
              </span>
            ) : health?.database.connected ? (
              <span style={{ color: '#B06000', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={20} /> Local Hybrid
              </span>
            ) : (
              <span style={{ color: 'var(--accent-terracotta)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={20} /> Standby
              </span>
            )}
          </div>
          <div className="metric-meta">
            Index: <code>{health?.database.vectorIndex.name || 'vector_index'}</code>
          </div>
        </div>
      </div>

      {/* Ingestion Alerts if any */}
      {failedSources.length > 0 && (
        <div style={{
          backgroundColor: 'var(--accent-terracotta-subtle)',
          border: '1px solid rgba(163, 72, 53, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--accent-terracotta)" />
            <div>
              <strong>{failedSources.length} Source Ingestion Failure(s) Detected</strong>
              <div style={{ fontSize: '12px', color: 'var(--accent-terracotta)' }}>
                Some documents failed extraction or vector indexing. Inspect the Source Library to retry.
              </div>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ borderColor: 'var(--accent-terracotta)' }} onClick={() => onNavigate('sources')}>
            Resolve Failures
          </button>
        </div>
      )}

      {/* Main Grid: Infrastructure Readiness & Recent Activity */}
      <div className="grid-2">
        {/* Left: Infrastructure & Provider Readiness */}
        <div className="card">
          <div className="card-title">
            <span>Core Infrastructure Status</span>
            <span className="brand-badge">MongoDB Sponsor Stack</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>MongoDB Atlas Deployment</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Database: <code>{health?.database.name || 'traceiq'}</code>
                </div>
              </div>
              <span className={`badge ${health?.database.connected ? 'badge-supported' : 'badge-weak'}`}>
                {health?.database.connected ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Vector Search ($vectorSearch Stage)</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Index: <code>{health?.database.vectorIndex.name}</code> ({health?.database.vectorIndex.status})
                </div>
              </div>
              <span className="badge badge-supported">Cosine Similarity (1536)</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Lexical Retrieval & RRF Fusion</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Atlas Search / MongoDB Text Index + Reciprocal Rank Fusion (k=60)
                </div>
              </div>
              <span className="badge badge-supported">Hybrid Enabled</span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-surface-secondary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Inference & Investigation Engine</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Provider: <code>{health?.providers.llm.provider}</code> ({health?.providers.llm.model})
                </div>
              </div>
              <span className="badge badge-plausible">Zero Hallucination</span>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => onNavigate('settings')}>
              View Detailed Settings & Index JSON
            </button>
          </div>
        </div>

        {/* Right: Recent Investigations */}
        <div className="card">
          <div className="card-title">
            <span>Recent Incident Investigations</span>
            <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => onNavigate('reports')}>
              View All
            </button>
          </div>

          {recentInvestigations.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)'
            }}>
              <FileSearch size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No investigations logged yet</div>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>
                Run your first incident triage in the Investigation Workspace.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '14px' }}
                onClick={() => onNavigate('investigate')}
              >
                Start Triaging
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {recentInvestigations.map((inv) => (
                <div
                  key={inv._id}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                  onClick={() => onNavigate('reports')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {inv._id}
                    </span>
                    <span
                      className={`badge ${
                        inv.investigationStatus === 'completed'
                          ? 'badge-supported'
                          : inv.investigationStatus === 'abstained'
                          ? 'badge-weak'
                          : 'badge-insufficient'
                      }`}
                    >
                      {inv.investigationStatus}
                    </span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: '13.5px' }}>{inv.question}</div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>{inv.hypotheses.length} hypotheses</span>
                    <span>{inv.citations.length} citations</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={11} /> {new Date(inv.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
