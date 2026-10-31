import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  Search,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { InvestigationReport, Citation } from '../types';
import { CitationDrawer } from '../components/CitationDrawer';

interface ReportsPageProps {
  investigations: InvestigationReport[];
  onNavigateToSource: (sourceId: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  investigations,
  onNavigateToSource
}) => {
  const [selectedReportId, setSelectedReportId] = useState<string>(
    investigations[0]?._id || ''
  );
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [search, setSearch] = useState<string>('');

  const filtered = investigations.filter((inv) =>
    inv.question.toLowerCase().includes(search.toLowerCase()) ||
    inv._id.toLowerCase().includes(search.toLowerCase())
  );

  const activeReport = investigations.find((inv) => inv._id === selectedReportId) || filtered[0] || null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Investigation Reports Archive</h1>
          <p className="page-subtitle">
            Historical evidence-grounded reports, markdown exports, and audited citation records.
          </p>
        </div>
        {activeReport && (
          <a
            href={`/api/investigations/${activeReport._id}/export`}
            download
            className="btn btn-secondary"
          >
            <Download size={14} />
            Download Markdown
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Left: Report List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search past reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '75vh', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No reports found.
              </div>
            ) : (
              filtered.map((inv) => (
                <div
                  key={inv._id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: inv._id === activeReport?._id ? 'var(--accent-forest)' : 'var(--border-light)',
                    backgroundColor: inv._id === activeReport?._id ? 'var(--accent-forest-subtle)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setSelectedReportId(inv._id)}
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
                  <div style={{ fontWeight: 500, fontSize: '13px', marginTop: '4px', lineHeight: '1.4' }}>
                    {inv.question}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {new Date(inv.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected Report Details */}
        <div>
          {activeReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div className="card-title">
                  <span>Report Summary: {activeReport._id}</span>
                  <span className="brand-badge">Mode: {activeReport.retrievalMetrics.retrievalMode}</span>
                </div>
                <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{activeReport.question}</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {activeReport.executiveSummary}
                </p>
              </div>

              {/* Hypotheses */}
              <div className="card">
                <div className="card-title">
                  <span>Evaluated Hypotheses</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {activeReport.hypotheses.map((h) => (
                    <div
                      key={h.hypothesisId}
                      style={{
                        padding: '14px',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong>{h.hypothesisId}: {h.description}</strong>
                        <span className="badge badge-supported">{h.assessment}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {h.assessmentReason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Citations */}
              <div className="card">
                <div className="card-title">
                  <span>Supporting Citations ({activeReport.citations.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {activeReport.citations.map((c) => (
                    <div
                      key={c.citationId}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-surface-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedCitation(c)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="brand-badge">[{c.citationId}] {c.sourceTitle}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.verificationStatus}</span>
                      </div>
                      <div className="passage-quote" style={{ margin: '6px 0 0 0' }}>
                        "{c.exactExcerpt}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              Select a report from the list to view details.
            </div>
          )}
        </div>
      </div>

      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        onNavigateToSource={onNavigateToSource}
      />
    </div>
  );
};
