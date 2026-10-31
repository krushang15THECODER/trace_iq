import React from 'react';
import { X, FileText, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { Citation } from '../types';

interface CitationDrawerProps {
  citation: Citation | null;
  onClose: () => void;
  onNavigateToSource?: (sourceId: string) => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({
  citation,
  onClose,
  onNavigateToSource
}) => {
  if (!citation) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-badge" style={{ backgroundColor: 'var(--accent-forest-subtle)', color: 'var(--accent-forest)' }}>
              {citation.citationId}
            </span>
            <h3 style={{ fontSize: '17px', margin: 0 }}>Evidence Provenance</h3>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {citation.temporalRelevance === 'outdated' && (
            <div style={{
              backgroundColor: 'var(--accent-terracotta-subtle)',
              border: '1px solid rgba(163, 72, 53, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: 'var(--accent-terracotta)'
            }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Temporal Warning: Outdated Source</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>
                  This citation references deprecated documentation. Information may not represent active infrastructure.
                </p>
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Source Document
            </label>
            <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <FileText size={16} color="var(--accent-forest)" />
              {citation.sourceTitle}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Exact Supporting Excerpt
            </label>
            <div className="passage-quote" style={{ fontSize: '13.5px', lineHeight: '1.6', marginTop: '4px' }}>
              "{citation.exactExcerpt}"
            </div>
          </div>

          <div className="grid-2" style={{ gap: '12px', marginTop: '4px' }}>
            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SECTION / HEADING</div>
              <div style={{ fontWeight: 500, marginTop: '2px' }}>{citation.sectionHeading || 'General'}</div>
            </div>

            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>DOCUMENT VERSION</div>
              <div style={{ fontFamily: 'var(--font-mono)', marginTop: '2px' }}>v{citation.documentVersion}</div>
            </div>

            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>SOURCE TYPE</div>
              <div style={{ textTransform: 'capitalize', marginTop: '2px' }}>{citation.sourceType.replace('_', ' ')}</div>
            </div>

            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>CHUNK ID</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', marginTop: '2px' }}>{citation.chunkId}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <CheckCircle size={15} color="#2E7D32" />
            <span>Verification Status: <strong>{citation.verificationStatus}</strong> (Grounding verified against MongoDB chunk vector)</span>
          </div>
        </div>

        <div className="modal-footer">
          {onNavigateToSource && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                onNavigateToSource(citation.sourceId);
                onClose();
              }}
            >
              <ExternalLink size={14} />
              Open Source in Library
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
