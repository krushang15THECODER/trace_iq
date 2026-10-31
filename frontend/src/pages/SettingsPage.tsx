import React, { useState } from 'react';
import {
  Settings,
  Database,
  Cpu,
  Shield,
  Layers,
  Code2,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { HealthInfo } from '../types';

interface SettingsPageProps {
  health: HealthInfo | null;
}

const VECTOR_INDEX_DEFINITION = {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 1536,
      similarity: "cosine"
    },
    {
      type: "filter",
      path: "sourceId"
    },
    {
      type: "filter",
      path: "metadata.sourceType"
    },
    {
      type: "filter",
      path: "metadata.incidentDate"
    },
    {
      type: "filter",
      path: "metadata.isOutdated"
    },
    {
      type: "filter",
      path: "metadata.service"
    }
  ]
};

const SEARCH_INDEX_DEFINITION = {
  mappings: {
    dynamic: false,
    fields: {
      content: {
        type: "string",
        analyzer: "lucene.standard"
      },
      sectionHeading: {
        type: "string",
        analyzer: "lucene.standard"
      },
      sourceId: {
        type: "string",
        analyzer: "lucene.keyword"
      },
      metadata: {
        type: "document",
        fields: {
          sourceType: {
            type: "string",
            analyzer: "lucene.keyword"
          },
          service: {
            type: "string",
            analyzer: "lucene.keyword"
          },
          isOutdated: {
            type: "boolean"
          }
        }
      }
    }
  }
};

export const SettingsPage: React.FC<SettingsPageProps> = ({ health }) => {
  const [copiedVector, setCopiedVector] = useState(false);
  const [copiedSearch, setCopiedSearch] = useState(false);

  const copyToClipboard = (text: string, isVector: boolean) => {
    navigator.clipboard.writeText(text);
    if (isVector) {
      setCopiedVector(true);
      setTimeout(() => setCopiedVector(false), 2000);
    } else {
      setCopiedSearch(true);
      setTimeout(() => setCopiedSearch(false), 2000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System Settings & Index Definitions</h1>
          <p className="page-subtitle">
            Inspect MongoDB Atlas Vector Search configuration, AI provider statuses, and security boundaries.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Environment Readiness Grid */}
        <div className="grid-3">
          <div className="card">
            <div className="card-title">
              <span>Database Connection</span>
              <Database size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>STATUS</span>
                <div>
                  <span className={`badge ${health?.database.connected ? 'badge-supported' : 'badge-contradicted'}`}>
                    {health?.database.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>DATABASE NAME</span>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{health?.database.name || 'traceiq'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>DEPLOYMENT TYPE</span>
                <div>{health?.database.isAtlas ? 'MongoDB Atlas Cloud' : 'Local / Standalone Fallback'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Vector Search Index</span>
              <Cpu size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>INDEX NAME</span>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{health?.database.vectorIndex.name}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>STATUS</span>
                <div>
                  <span className="badge badge-supported">
                    {health?.database.vectorIndex.status}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>METRIC & DIMENSIONS</span>
                <div>Cosine Similarity • 1,536 Dims</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>AI Engine Providers</span>
              <Shield size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>EMBEDDING MODEL</span>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  {health?.providers.embedding.model} ({health?.providers.embedding.provider})
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>INVESTIGATION ENGINE</span>
                <div style={{ fontFamily: 'var(--font-mono)' }}>
                  {health?.providers.llm.model} ({health?.providers.llm.provider})
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SECRETS PROTECTION</span>
                <div style={{ color: '#2E7D32', fontSize: '12px' }}>✓ Zero API keys exposed to frontend</div>
              </div>
            </div>
          </div>
        </div>

        {/* Index JSON Definitions */}
        <div className="grid-2">
          {/* Atlas Vector Search Definition */}
          <div className="card">
            <div className="card-title">
              <span>MongoDB Atlas Vector Search Index Definition</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => copyToClipboard(JSON.stringify(VECTOR_INDEX_DEFINITION, null, 2), true)}
              >
                <Copy size={12} />
                {copiedVector ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Collection: <code>chunks</code> | Index Name: <code>{health?.database.vectorIndex.name || 'vector_index'}</code>
            </p>
            <pre style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              overflowX: 'auto',
              maxHeight: '300px'
            }}>
              {JSON.stringify(VECTOR_INDEX_DEFINITION, null, 2)}
            </pre>
          </div>

          {/* Atlas Search Definition */}
          <div className="card">
            <div className="card-title">
              <span>MongoDB Atlas Search (Lexical) Index Definition</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => copyToClipboard(JSON.stringify(SEARCH_INDEX_DEFINITION, null, 2), false)}
              >
                <Copy size={12} />
                {copiedSearch ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Collection: <code>chunks</code> | Index Name: <code>{health?.database.lexicalIndex.name || 'search_index'}</code>
            </p>
            <pre style={{
              backgroundColor: 'var(--bg-surface-secondary)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              overflowX: 'auto',
              maxHeight: '300px'
            }}>
              {JSON.stringify(SEARCH_INDEX_DEFINITION, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
