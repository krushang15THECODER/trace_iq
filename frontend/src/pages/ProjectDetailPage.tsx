import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Upload,
  Sparkles,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Clock,
  History,
  Eye,
  Calendar,
  Layers
} from 'lucide-react';
import { ProjectRecord, SourceDocument, InvestigationReport } from '../types';
import { api } from '../api/client';

interface ProjectDetailPageProps {
  project: ProjectRecord;
  onBack: () => void;
  onNavigateToInvestigate: (projectId: string) => void;
  onNavigateToSources: (projectId: string) => void;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'indexed':
      return 'badge badge-supported';
    case 'processing':
      return 'badge badge-plausible';
    case 'pending':
      return 'badge badge-insufficient';
    case 'failed':
      return 'badge badge-contradicted';
    default:
      return 'badge';
  }
}

function getInvStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'badge badge-supported';
    case 'in_progress':
      return 'badge badge-plausible';
    case 'abstained':
      return 'badge badge-weak';
    case 'failed':
      return 'badge badge-contradicted';
    default:
      return 'badge badge-insufficient';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project,
  onBack,
  onNavigateToInvestigate,
  onNavigateToSources
}) => {
  const [activeTab, setActiveTab] = useState<'documents' | 'history'>('documents');
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationReport[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [isLoadingInvs, setIsLoadingInvs] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [invError, setInvError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    setDocError(null);
    try {
      const docs = await api.getSources(project._id);
      setDocuments(docs);
    } catch (err: any) {
      setDocError(err.message || 'Failed to load documents');
    } finally {
      setIsLoadingDocs(false);
    }
  }, [project._id]);

  const fetchInvestigations = useCallback(async () => {
    setIsLoadingInvs(true);
    setInvError(null);
    try {
      const invs = await api.getInvestigations(project._id);
      setInvestigations(invs);
    } catch (err: any) {
      setInvError(err.message || 'Failed to load investigations');
    } finally {
      setIsLoadingInvs(false);
    }
  }, [project._id]);

  useEffect(() => {
    fetchDocuments();
    fetchInvestigations();
  }, [fetchDocuments, fetchInvestigations]);

  // Auto-refresh if any document is pending/processing
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.ingestionStatus === 'processing' || d.ingestionStatus === 'pending'
    );
    if (!hasPending) return;
    const timer = setInterval(() => {
      fetchDocuments();
    }, 10000);
    return () => clearInterval(timer);
  }, [documents, fetchDocuments]);

  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm('Delete this document and all its indexed chunks?')) return;
    try {
      await api.deleteSource(id);
      setActionMessage({ text: 'Document deleted successfully.' });
      fetchDocuments();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to delete document.', error: true });
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.reprocessSource(id);
      setActionMessage({ text: 'Reprocessing started.' });
      fetchDocuments();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to reprocess document.', error: true });
    }
  };

  // Computed stats
  const indexedCount = documents.filter((d) => d.ingestionStatus === 'indexed').length;
  const failedCount = documents.filter((d) => d.ingestionStatus === 'failed').length;
  const pendingCount = documents.filter(
    (d) => d.ingestionStatus === 'pending' || d.ingestionStatus === 'processing'
  ).length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <button
            className="btn btn-secondary"
            onClick={onBack}
            style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            Back to Projects
          </button>
          <h1 className="page-title">{project.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-raised)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)'
              }}
            >
              {project._id}
            </code>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Calendar size={12} />
              Created {formatDate(project.createdAt)}
            </span>
          </div>
          {project.description && (
            <p className="page-subtitle" style={{ marginTop: '8px' }}>
              {project.description}
            </p>
          )}
        </div>

        {/* Quick Action Bar */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0, marginTop: '4px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => onNavigateToSources(project._id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Upload size={14} />
            Upload Evidence Files
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onNavigateToInvestigate(project._id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} />
            Run Investigation
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText size={13} /> Documents
          </div>
          <div className="metric-value">{documents.length}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={13} /> Investigations
          </div>
          <div className="metric-value">{investigations.length}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle size={13} /> Indexed
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-forest)' }}>
            {indexedCount}
          </div>
        </div>
        <div className="metric-box">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} /> Failed / Pending
          </div>
          <div
            className="metric-value"
            style={{ color: failedCount > 0 ? '#dc2626' : pendingCount > 0 ? '#d97706' : 'var(--text-secondary)' }}
          >
            {failedCount} / {pendingCount}
          </div>
        </div>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: actionMessage.error ? '#fee2e2' : 'var(--accent-forest-subtle)',
            color: actionMessage.error ? '#991b1b' : 'var(--accent-forest)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            {actionMessage.error ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '2px solid var(--border-light)',
          marginBottom: '20px'
        }}
      >
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '8px 18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'documents' ? 700 : 500,
            color: activeTab === 'documents' ? 'var(--accent-forest)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'documents' ? '2px solid var(--accent-forest)' : '2px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <FileText size={14} />
          Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 18px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'history' ? 700 : 500,
            color: activeTab === 'history' ? 'var(--accent-forest)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-forest)' : '2px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <History size={14} />
          Investigation History ({investigations.length})
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          {isLoadingDocs ? (
            <div
              className="card"
              style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}
            >
              <RefreshCw size={24} style={{ marginBottom: '12px', opacity: 0.5 }} className="spin" />
              <div style={{ fontSize: '14px' }}>Loading documents...</div>
            </div>
          ) : docError ? (
            <div
              className="card"
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                backgroundColor: '#fee2e2',
                color: '#991b1b'
              }}
            >
              <AlertCircle size={22} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '14px' }}>{docError}</div>
              <button className="btn btn-secondary" onClick={fetchDocuments} style={{ marginTop: '12px' }}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <FileText size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>No Documents Yet</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px' }}>
                Upload evidence files such as logs, reports, or runbooks to start building this project's knowledge base.
              </p>
              <button className="btn btn-primary" onClick={() => onNavigateToSources(project._id)}>
                <Upload size={14} /> Upload Evidence Files
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Title
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Type
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Status
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Chunks
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Date
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-light)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, idx) => (
                    <tr
                      key={doc._id}
                      style={{
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-raised)',
                        borderBottom: '1px solid var(--border-light)'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.title}
                          </span>
                        </div>
                        {doc.errorMessage && (
                          <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '3px', marginLeft: '21px' }}>
                            {doc.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {doc.sourceType}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={getStatusBadgeClass(doc.ingestionStatus)}>
                          {doc.ingestionStatus === 'processing' && <RefreshCw size={11} style={{ marginRight: '3px' }} />}
                          {doc.ingestionStatus === 'pending' && <Clock size={11} style={{ marginRight: '3px' }} />}
                          {doc.ingestionStatus === 'indexed' && <CheckCircle size={11} style={{ marginRight: '3px' }} />}
                          {doc.ingestionStatus === 'failed' && <AlertCircle size={11} style={{ marginRight: '3px' }} />}
                          {doc.ingestionStatus}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          <Layers size={12} />
                          {doc.metadata?.chunkCount ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            title="Reprocess document"
                            onClick={() => handleReprocess(doc._id)}
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RefreshCw size={11} />
                            Reprocess
                          </button>
                          <button
                            className="btn btn-secondary"
                            title="Delete document"
                            onClick={() => handleDeleteDoc(doc._id)}
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Investigation History Tab */}
      {activeTab === 'history' && (
        <div>
          {isLoadingInvs ? (
            <div
              className="card"
              style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}
            >
              <RefreshCw size={24} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div style={{ fontSize: '14px' }}>Loading investigation history...</div>
            </div>
          ) : invError ? (
            <div
              className="card"
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                backgroundColor: '#fee2e2',
                color: '#991b1b'
              }}
            >
              <AlertCircle size={22} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '14px' }}>{invError}</div>
              <button className="btn btn-secondary" onClick={fetchInvestigations} style={{ marginTop: '12px' }}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : investigations.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <History size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>No Investigations Yet</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px' }}>
                Run your first investigation to start building an evidence-grounded analysis history for this project.
              </p>
              <button className="btn btn-primary" onClick={() => onNavigateToInvestigate(project._id)}>
                <Sparkles size={14} /> Run Investigation
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {investigations.map((inv) => (
                <div
                  key={inv._id}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className={getInvStatusBadgeClass(inv.investigationStatus)}>
                        {inv.investigationStatus}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        {formatDate(inv.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '6px',
                        lineHeight: '1.4'
                      }}
                    >
                      {inv.question}
                    </p>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Eye size={12} />
                        {inv.citations?.length ?? 0} citations
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} />
                        {inv.hypotheses?.length ?? 0} hypotheses
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onNavigateToInvestigate(project._id)}
                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                  >
                    <History size={13} />
                    Reopen in Workspace
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
