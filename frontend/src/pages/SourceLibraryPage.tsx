import React, { useState } from 'react';
import {
  Upload,
  Globe,
  FilePlus,
  RefreshCw,
  Trash2,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  Filter,
  Layers,
  Calendar,
  Tag
} from 'lucide-react';
import { SourceDocument, SourceType, ProjectRecord } from '../types';
import { api } from '../api/client';

interface SourceLibraryPageProps {
  sources: SourceDocument[];
  onRefresh: () => void;
  selectedSourceId?: string | null;
  activeProjectId?: string | null;
  projects?: ProjectRecord[];
  onSelectProject?: (id: string) => void;
}

export const SourceLibraryPage: React.FC<SourceLibraryPageProps> = ({
  sources,
  onRefresh,
  selectedSourceId,
  activeProjectId,
  projects = [],
  onSelectProject
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'webpage' | 'note'>('upload');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>(activeProjectId || 'all');
  const [inspectSource, setInspectSource] = useState<SourceDocument | null>(
    sources.find((s) => s._id === selectedSourceId) || null
  );

  // Sync projectFilter if activeProjectId prop changes
  React.useEffect(() => {
    if (activeProjectId) {
      setProjectFilter(activeProjectId);
      setSelectedUploadProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [sourceType, setSourceType] = useState<SourceType>('log');
  const [service, setService] = useState<string>('');
  const [incidentDate, setIncidentDate] = useState<string>('');
  const [isOutdated, setIsOutdated] = useState<boolean>(false);
  const [selectedUploadProjectId, setSelectedUploadProjectId] = useState<string>(activeProjectId || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Webpage Import State
  const [webUrl, setWebUrl] = useState<string>('');
  const [webTitle, setWebTitle] = useState<string>('');

  // Note State
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteService, setNoteService] = useState<string>('');

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatusMessage({ text: 'Please select a file to upload.', error: true });
      return;
    }

    // Validation: empty file
    if (file.size === 0) {
      setStatusMessage({ text: 'File is empty (0 bytes). Please upload a valid document or log.', error: true });
      return;
    }

    // Validation: file size
    if (file.size > 10 * 1024 * 1024) {
      setStatusMessage({ text: 'File size exceeds maximum allowed limit (10MB).', error: true });
      return;
    }

    // Validation: file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['log', 'txt', 'pdf', 'json', 'md', 'csv'];
    if (!ext || !allowed.includes(ext)) {
      setStatusMessage({
        text: `Invalid file format (.${ext || 'unknown'}). Supported formats are LOG, TXT, PDF, and JSON.`,
        error: true
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('sourceType', sourceType);
    if (service) formData.append('service', service);
    if (incidentDate) formData.append('incidentDate', incidentDate);
    if (isOutdated) formData.append('isOutdated', 'true');
    const projId = selectedUploadProjectId || activeProjectId;
    if (projId) formData.append('projectId', projId);

    try {
      await api.uploadSource(formData);
      setStatusMessage({ text: `Source "${file.name}" ingested and indexed into MongoDB Vector Search!` });
      setFile(null);
      setTitle('');
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Upload failed', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWebImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await api.importWebpage(webUrl, webTitle || undefined);
      setStatusMessage({ text: 'Webpage imported and indexed securely.' });
      setWebUrl('');
      setWebTitle('');
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoteCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle || !noteContent) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await api.createNote({
        title: noteTitle,
        content: noteContent,
        service: noteService || undefined,
        isOutdated
      });
      setStatusMessage({ text: 'Markdown note saved and indexed into chunks.' });
      setNoteTitle('');
      setNoteContent('');
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.reprocessSource(id);
      onRefresh();
      alert('Reprocessed source successfully!');
    } catch (err: any) {
      alert(`Reprocess failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source and its vector chunks?')) return;
    try {
      await api.deleteSource(id);
      if (inspectSource?._id === id) setInspectSource(null);
      onRefresh();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Filter sources
  const filteredSources = sources.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.metadata?.service || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || s.sourceType === typeFilter;
    const matchesProject = projectFilter === 'all' || s.projectId === projectFilter;
    return matchesSearch && matchesType && matchesProject;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Technical Knowledge Library</h1>
          <p className="page-subtitle">
            Manage incident reports, architecture diagrams, runbooks, logs, and telemetry sources.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh Sources
        </button>
      </div>

      {/* Ingestion Input Card */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px' }}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={14} />
            Upload File (LOG · TXT · PDF · JSON)
          </button>
          <button
            className={`btn ${activeTab === 'webpage' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px' }}
            onClick={() => setActiveTab('webpage')}
          >
            <Globe size={14} />
            Import Webpage (SSRF-Protected)
          </button>
          <button
            className={`btn ${activeTab === 'note' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px' }}
            onClick={() => setActiveTab('note')}
          >
            <FilePlus size={14} />
            Add Engineering Note
          </button>
        </div>

        {statusMessage && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: statusMessage.error ? 'var(--accent-terracotta-subtle)' : '#E6F4EA',
            color: statusMessage.error ? 'var(--accent-terracotta)' : '#137333',
            border: `1px solid ${statusMessage.error ? 'rgba(163, 72, 53, 0.3)' : '#CEEAD6'}`
          }}>
            {statusMessage.error ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {statusMessage.text}
          </div>
        )}

        {/* Tab 1: Upload File */}
        {activeTab === 'upload' && (
          <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2">
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Select File (LOG, TXT, PDF, JSON, MD, CSV • Max 10MB)
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.txt,.md,.markdown,.csv,.json,.log"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. SRE Runbook: Database Pool Tuning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: projects.length > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '14px' }}>
              {projects.length > 0 && (
                <div>
                  <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Target Project
                  </label>
                  <select
                    value={selectedUploadProjectId}
                    onChange={(e) => setSelectedUploadProjectId(e.target.value)}
                    style={{ marginTop: '4px' }}
                  >
                    <option value="">-- No Specific Project (Global) --</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        📁 {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Source Category
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceType)}
                  style={{ marginTop: '4px' }}
                >
                  <option value="incident_report">Incident Report</option>
                  <option value="architecture">Architecture Document</option>
                  <option value="api_doc">API Specification</option>
                  <option value="log">Application Log</option>
                  <option value="db_metrics">Database Metrics</option>
                  <option value="deployment">Deployment Record</option>
                  <option value="runbook">Runbook</option>
                  <option value="other">Other Technical Document</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Affected Service (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. checkout-service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Incident Date (Optional)
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>


            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="outdatedCheck"
                checked={isOutdated}
                onChange={(e) => setIsOutdated(e.target.checked)}
              />
              <label htmlFor="outdatedCheck" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Mark as Outdated / Deprecated Source (flags temporal contradiction in hypotheses)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit" disabled={isSubmitting || !file}>
                {isSubmitting ? 'Extracting & Ingesting...' : 'Ingest & Index Document'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Webpage Import */}
        {activeTab === 'webpage' && (
          <form onSubmit={handleWebImport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2">
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Webpage URL (Protected against SSRF & Private IP Access)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://docs.github.com/..."
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Source Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cloud Provider Status Incident Report"
                  value={webTitle}
                  onChange={(e) => setWebTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              🛡️ TraceIQ checks DNS resolution and rejects private IP ranges (127.0.0.1, 10.x, 192.168.x, 169.254.169.254 metadata).
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit" disabled={isSubmitting || !webUrl}>
                {isSubmitting ? 'Fetching & Ingesting...' : 'Import & Index Webpage'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Engineering Note */}
        {activeTab === 'note' && (
          <form onSubmit={handleNoteCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid-2">
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Note Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Observation: Redis evictions before failover"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Service (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. cart-service"
                  value={noteService}
                  onChange={(e) => setNoteService(e.target.value)}
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Markdown Content
              </label>
              <textarea
                rows={5}
                required
                placeholder="Write technical observations, logs or notes in Markdown..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit" disabled={isSubmitting || !noteTitle || !noteContent}>
                {isSubmitting ? 'Indexing Note...' : 'Save & Chunk Note'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search documents by title, filename or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ width: '210px' }}
          >
            <option value="all">All Projects ({sources.length})</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                📁 {p.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: '190px' }}
        >
          <option value="all">All Source Categories</option>
          <option value="incident_report">Incident Reports</option>
          <option value="architecture">Architecture</option>
          <option value="api_doc">API Specs</option>
          <option value="log">Logs</option>
          <option value="db_metrics">DB Metrics</option>
          <option value="deployment">Deployments</option>
          <option value="runbook">Runbooks</option>
        </select>
      </div>

      {/* Source Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Document Title</th>
              <th>Category</th>
              {projects.length > 0 && <th>Project</th>}
              <th>Version</th>
              <th>Chunks</th>
              <th>Status</th>
              <th>Date / Service</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.length === 0 ? (
              <tr>
                <td colSpan={projects.length > 0 ? 8 : 7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No sources match your filter criteria.
                </td>
              </tr>
            ) : (
              filteredSources.map((s) => {
                const assignedProject = projects.find((p) => p._id === s.projectId);
                return (
                  <tr key={s._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {s.originalFilename}
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-surface-secondary)' }}>
                        {s.sourceType.replace('_', ' ')}
                      </span>
                    </td>
                    {projects.length > 0 && (
                      <td style={{ fontSize: '12px' }}>
                        {assignedProject ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-forest)', fontWeight: 500 }}>
                            📁 {assignedProject.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Global</span>
                        )}
                      </td>
                    )}
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      v{s.documentVersion}
                      {s.metadata?.isOutdated && (
                        <span className="badge badge-outdated" style={{ marginLeft: '4px' }}>
                          Outdated
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{s.metadata?.chunkCount || 0}</td>
                    <td>
                      {s.ingestionStatus === 'indexed' && (
                        <span className="badge badge-supported" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={11} /> Indexed
                        </span>
                      )}
                      {s.ingestionStatus === 'processing' && (
                        <span className="badge badge-plausible" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <RefreshCw size={11} className="spin-animation" /> Processing
                        </span>
                      )}
                      {s.ingestionStatus === 'pending' && (
                        <span className="badge badge-weak" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Pending
                        </span>
                      )}
                      {s.ingestionStatus === 'failed' && (
                        <span
                          className="badge badge-contradicted"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'help' }}
                          title={s.errorMessage || 'Ingestion failed'}
                        >
                          <AlertCircle size={11} /> Failed
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {s.metadata?.service || 'N/A'}
                    </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="View Details"
                        onClick={() => setInspectSource(s)}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Reprocess & Re-chunk"
                        onClick={() => handleReprocess(s._id)}
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Delete Source"
                        onClick={() => handleDelete(s._id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>

        </table>
      </div>

      {/* Inspect Source Modal */}
      {inspectSource && (
        <div className="modal-overlay" onClick={() => setInspectSource(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Source Inspection: {inspectSource.title}</h3>
              <button onClick={() => setInspectSource(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="grid-2">
                <div>
                  <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    SOURCE ID
                  </label>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{inspectSource._id}</div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    SHA-256 CONTENT HASH
                  </label>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all' }}>
                    {inspectSource.contentHash}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  EXTRACTED CONTENT PREVIEW
                </label>
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-secondary)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {inspectSource.originalContent || 'No preview available.'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setInspectSource(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
