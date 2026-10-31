import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Clock,
  Layers,
  FileText,
  Activity,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Download,
  History,
  RotateCcw,
  Folder,
  RefreshCw
} from 'lucide-react';
import {
  IncidentRecord,
  InvestigationReport,
  Citation,
  HypothesisAssessment,
  ProjectRecord
} from '../types';
import { api } from '../api/client';
import { CitationDrawer } from '../components/CitationDrawer';

interface InvestigationPageProps {
  incidents: IncidentRecord[];
  onNavigateToSource: (sourceId: string) => void;
  activeProjectId?: string | null;
  projects?: ProjectRecord[];
  onSelectProject?: (id: string) => void;
}

const PRESET_QUERIES = [
  {
    label: 'Checkout Latency Spike (Root Cause)',
    query: 'Why did the checkout API latency spike at 14:18 UTC during the flash promotion?'
  },
  {
    label: 'Competing Hypothesis (Payment Gateway)',
    query: 'Did an external payment gateway outage or API rate limit cause the checkout delays?'
  },
  {
    label: 'Exact Error Code Provenance',
    query: 'What caused ERR_CONN_POOL_ACQUIRE_TIMEOUT_0x54 in the checkout service pods?'
  },
  {
    label: 'Unanswerable Telemetry (Redis Cache)',
    query: 'What was the memory utilization and cache eviction rate on the Redis cluster during the incident?'
  }
];

export const InvestigationPage: React.FC<InvestigationPageProps> = ({
  incidents,
  onNavigateToSource,
  activeProjectId,
  projects = [],
  onSelectProject
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    incidents[0]?._id || 'INC-2024-0882'
  );
  const [question, setQuestion] = useState<string>(
    'Why did the checkout API latency spike at 14:18 UTC during the flash promotion?'
  );
  const [selectedSourceTypes, setSelectedSourceTypes] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<string>('2024-10-14');
  const [topK, setTopK] = useState<number>(12);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Investigation History State
  const [history, setHistory] = useState<InvestigationReport[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const activeProject = projects.find((p) => p._id === activeProjectId);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const list = await api.getInvestigations(activeProjectId || undefined);
      setHistory(list);
    } catch (e: any) {
      console.warn('Could not load history:', e.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [activeProjectId]);

  const handleRunInvestigation = async (queryText?: string) => {
    const q = queryText || question;
    if (!q.trim()) return;

    setIsLoading(true);
    setLoadingStep(1);
    setError(null);

    // Progress stepper simulation while Gemini + RAG are computing
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);

    try {
      const result = await api.runInvestigation({
        question: q,
        projectId: activeProjectId || undefined,
        incidentId: selectedIncidentId || undefined,
        sourceFilters: selectedSourceTypes.length > 0 ? selectedSourceTypes : undefined,
        timeFilter: timeFilter || undefined,
        topK
      });
      setReport(result);
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to complete investigation');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: InvestigationReport) => {
    setReport(item);
    setQuestion(item.question);
    setError(null);
  };

  const toggleSourceType = (type: string) => {
    if (selectedSourceTypes.includes(type)) {
      setSelectedSourceTypes(selectedSourceTypes.filter((t) => t !== type));
    } else {
      setSelectedSourceTypes([...selectedSourceTypes, type]);
    }
  };

  const getAssessmentBadgeClass = (assessment: HypothesisAssessment) => {
    switch (assessment) {
      case 'Supported':
        return 'badge-supported';
      case 'Plausible':
        return 'badge-plausible';
      case 'Weakly supported':
        return 'badge-weak';
      case 'Contradicted':
        return 'badge-contradicted';
      case 'Insufficient evidence':
      default:
        return 'badge-insufficient';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Incident Investigation Workspace</h1>
            {activeProject && (
              <span className="badge badge-supported" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Folder size={12} /> {activeProject.name}
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Formulate incident queries, retrieve multi-source evidence, evaluate hypotheses, and audit citations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={14} />
            History ({history.length})
          </button>
          {report && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setReport(null)}
                title="Clear current report and start fresh query"
              >
                <RotateCcw size={14} />
                New Query
              </button>
              <a
                href={`/api/investigations/${report._id}/export`}
                download
                className="btn btn-secondary"
              >
                <Download size={14} />
                Export Markdown
              </a>
            </>
          )}
        </div>
      </div>

      {/* Investigation History Drawer / Accordion */}
      {showHistory && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--bg-surface-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <History size={16} />
              <span>Project Investigation History {activeProject ? `for "${activeProject.name}"` : '(All Projects)'}</span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={loadHistory}
            >
              <RefreshCw size={12} className={loadingHistory ? 'spin-animation' : ''} />
              Refresh
            </button>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No previous investigations saved for this project yet. Run a query below to start building history.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {history.map((h) => (
                <div
                  key={h._id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: report?._id === h._id ? 'var(--accent-forest-subtle)' : 'var(--bg-surface)',
                    border: '1px solid',
                    borderColor: report?._id === h._id ? 'var(--accent-forest)' : 'var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSelectHistoryItem(h)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.question}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '3px' }}>
                      <span>{new Date(h.createdAt).toLocaleString()}</span>
                      <span>{h.citations.length} Citations</span>
                      <span>{h.hypotheses.length} Hypotheses</span>
                      <span>{h.executionTimeMs}ms</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className={`badge ${
                        h.investigationStatus === 'completed'
                          ? 'badge-supported'
                          : h.investigationStatus === 'abstained'
                          ? 'badge-weak'
                          : 'badge-insufficient'
                      }`}
                      style={{ fontSize: '11px' }}
                    >
                      {h.investigationStatus}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectHistoryItem(h);
                      }}
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Query Formulation Card */}
      <div className="card" style={{ marginBottom: '24px' }}>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Target Incident Context
            </label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              style={{ marginTop: '4px' }}
            >
              {incidents.map((inc) => (
                <option key={inc._id} value={inc._id}>
                  [{inc.severity}] {inc._id}: {inc.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '160px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Incident Date Filter
            </label>
            <input
              type="text"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              placeholder="YYYY-MM-DD"
              style={{ marginTop: '4px' }}
            />
          </div>

          <div style={{ width: '120px' }}>
            <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Retrieval Top-K
            </label>
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ marginTop: '4px' }}
            >
              <option value={8}>Top 8 Chunks</option>
              <option value={12}>Top 12 Chunks</option>
              <option value={20}>Top 20 Chunks</option>
            </select>
          </div>
        </div>

        {/* Source Filter Tags */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Source Type Scoping (Leave unselected for all sources)
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'incident_report', label: 'Incident Reports' },
              { id: 'architecture', label: 'Architecture Docs' },
              { id: 'log', label: 'Application Logs' },
              { id: 'db_metrics', label: 'DB Metrics' },
              { id: 'deployment', label: 'Deployments' },
              { id: 'runbook', label: 'Runbooks' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                className={`btn ${selectedSourceTypes.includes(st.id) ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => toggleSourceType(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Query Input */}
        <div>
          <label style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Investigation Query
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRunInvestigation()}
              placeholder="Ask an evidence-based question about the incident..."
              style={{ fontSize: '14px', padding: '12px 14px' }}
            />
            <button
              className="btn btn-primary"
              disabled={isLoading || !question.trim()}
              onClick={() => handleRunInvestigation()}
              style={{ whiteSpace: 'nowrap', padding: '0 24px' }}
            >
              {isLoading ? (
                <>
                  <Activity size={16} className="spin-animation" />
                  Triaging...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Investigate
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preset scenario prompt chips */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quick Scenarios:</span>
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              className="btn btn-secondary"
              style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '12px' }}
              onClick={() => {
                setQuestion(preset.query);
                handleRunInvestigation(preset.query);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          backgroundColor: 'var(--accent-terracotta-subtle)',
          border: '1px solid rgba(163, 72, 53, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '14px',
          color: 'var(--accent-terracotta)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                {error.includes('429') || error.toLowerCase().includes('rate') || error.toLowerCase().includes('quota')
                  ? 'Gemini API Rate Limit / Quota Exceeded'
                  : 'Investigation Engine Error'}
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                {error.includes('429') || error.toLowerCase().includes('rate')
                  ? 'The Gemini service is temporarily throttled or experiencing rate limits. Please wait 10 seconds and retry.'
                  : error}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '12px', whiteSpace: 'nowrap', backgroundColor: '#fff' }}
            onClick={() => handleRunInvestigation()}
          >
            <RefreshCw size={12} />
            Retry Query
          </button>
        </div>
      )}

      {/* Step-by-Step Investigation Loading Stepper */}
      {isLoading && (
        <div className="card" style={{ padding: '36px 28px', marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Activity size={32} color="var(--accent-forest)" className="spin-animation" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '18px', margin: 0 }}>Executing Evidence Investigation Engine...</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
              Synthesizing multi-source logs, runbooks, metrics, and temporal facts with strict citation grounding
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '850px', margin: '0 auto' }}>
            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: loadingStep >= 1 ? 'var(--accent-forest)' : 'var(--border-light)',
              backgroundColor: loadingStep >= 1 ? 'var(--accent-forest-subtle)' : 'var(--bg-surface-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {loadingStep > 1 ? (
                  <CheckCircle size={16} color="var(--accent-forest)" />
                ) : (
                  <Activity size={16} color="var(--accent-forest)" className="spin-animation" />
                )}
                <strong style={{ fontSize: '12.5px' }}>1. Hybrid Retrieval</strong>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Querying project vectors (1536-dim) & Atlas text scoring with RRF fusion.
              </p>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: loadingStep >= 2 ? 'var(--accent-forest)' : 'var(--border-light)',
              backgroundColor: loadingStep >= 2 ? 'var(--accent-forest-subtle)' : 'var(--bg-surface-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {loadingStep > 2 ? (
                  <CheckCircle size={16} color="var(--accent-forest)" />
                ) : loadingStep === 2 ? (
                  <Activity size={16} color="var(--accent-forest)" className="spin-animation" />
                ) : (
                  <Clock size={16} color="var(--text-muted)" />
                )}
                <strong style={{ fontSize: '12.5px' }}>2. Temporal Filtering</strong>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Verifying chunk provenance, timestamps, and detecting superseded documents.
              </p>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: loadingStep >= 3 ? 'var(--accent-forest)' : 'var(--border-light)',
              backgroundColor: loadingStep >= 3 ? 'var(--accent-forest-subtle)' : 'var(--bg-surface-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {loadingStep === 3 ? (
                  <Activity size={16} color="var(--accent-forest)" className="spin-animation" />
                ) : (
                  <Clock size={16} color="var(--text-muted)" />
                )}
                <strong style={{ fontSize: '12.5px' }}>3. Gemini Synthesis</strong>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>
                Reasoning across competing hypotheses with verified citation IDs.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Investigation Results */}
      {report && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Abstention Card if applicable */}
          {report.abstention?.isAbstained && (
            <div style={{
              backgroundColor: '#FEF7E0',
              border: '1px solid #FEEFC3',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B06000', fontWeight: 600, fontSize: '15px' }}>
                <ShieldAlert size={20} />
                <span>Responsible Investigation Abstention</span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                {report.abstention.reason}
              </p>
              <div>
                <strong style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Missing Required Data:
                </strong>
                <ul style={{ margin: '4px 0 0 20px', fontSize: '13px' }}>
                  {report.abstention.missingRequiredData.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div className="card">
            <div className="card-title">
              <span>Executive Investigation Findings</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="brand-badge">Report ID: {report._id}</span>
                <span className="brand-badge">Mode: {report.retrievalMetrics.retrievalMode}</span>
                <span className="brand-badge">{report.executionTimeMs}ms</span>
              </div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
              {report.executiveSummary}
            </p>
          </div>

          {/* Observations: Separating Facts, Measurements, Inferences & Unknowns */}
          <div className="card">
            <div className="card-title">
              <span>Classified Observations & Source Provenance</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Facts separated from inferences & unknowns
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {report.observations.map((obs) => {
                let badgeTypeClass = 'badge-supported';
                let typeLabel = 'Direct Measurement';
                if (obs.type === 'source_statement') {
                  badgeTypeClass = 'badge-plausible';
                  typeLabel = 'Source-Reported Statement';
                } else if (obs.type === 'inference') {
                  badgeTypeClass = 'badge-weak';
                  typeLabel = 'Inference';
                } else if (obs.type === 'unknown') {
                  badgeTypeClass = 'badge-insufficient';
                  typeLabel = 'Unknown / Absent Data';
                }

                return (
                  <div
                    key={obs.id}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-surface-secondary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${badgeTypeClass}`}>{typeLabel}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {obs.id} • Confidence: {obs.confidenceLevel}
                      </span>
                    </div>
                    <div style={{ fontSize: '13.5px' }}>{obs.statement}</div>
                    {obs.citationIds.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Evidence Citations:</span>
                        {obs.citationIds.map((cid) => {
                          const cit = report.citations.find((c) => c.citationId === cid);
                          return (
                            <span
                              key={cid}
                              className="citation-pill"
                              onClick={() => cit && setSelectedCitation(cit)}
                            >
                              [{cid}]
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hypotheses Comparison with Controlled Assessment Labels */}
          <div className="card">
            <div className="card-title">
              <span>Candidate Hypotheses Comparison</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Controlled Assessment (Supported / Plausible / Weak / Contradicted / Insufficient)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {report.hypotheses.map((hyp) => (
                <div
                  key={hyp.hypothesisId}
                  style={{
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px',
                    backgroundColor: 'var(--bg-surface)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{hyp.hypothesisId}</span>
                      <h4 style={{ fontSize: '16px', margin: 0 }}>{hyp.description}</h4>
                    </div>
                    <span className={`badge ${getAssessmentBadgeClass(hyp.assessment)}`} style={{ fontSize: '12px', padding: '3px 10px' }}>
                      {hyp.assessment}
                    </span>
                  </div>

                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
                    <strong>Evidence Analysis:</strong> {hyp.assessmentReason}
                  </p>

                  {/* Supporting and Contradicting Evidence Citations */}
                  <div className="grid-2" style={{ gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#137333', fontWeight: 600 }}>
                        SUPPORTING EVIDENCE
                      </div>
                      {hyp.supportingEvidenceIds.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>None identified</div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {hyp.supportingEvidenceIds.map((cid) => {
                            const cit = report.citations.find((c) => c.citationId === cid);
                            return (
                              <button
                                key={cid}
                                className="citation-pill"
                                onClick={() => cit && setSelectedCitation(cit)}
                              >
                                [{cid}] {cit?.sourceTitle.slice(0, 24)}...
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-terracotta)', fontWeight: 600 }}>
                        CONTRADICTING EVIDENCE
                      </div>
                      {hyp.contradictingEvidenceIds.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>None identified</div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {hyp.contradictingEvidenceIds.map((cid) => {
                            const cit = report.citations.find((c) => c.citationId === cid);
                            return (
                              <button
                                key={cid}
                                className="citation-pill"
                                style={{ backgroundColor: 'var(--accent-terracotta-subtle)', color: 'var(--accent-terracotta)' }}
                                onClick={() => cit && setSelectedCitation(cit)}
                              >
                                [{cid}] {cit?.sourceTitle.slice(0, 24)}...
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proposed Diagnostic Tests */}
                  {hyp.diagnosticTests.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Proposed Diagnostic Tests / Telemetry Verification:
                      </div>
                      <ul style={{ margin: '4px 0 0 18px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {hyp.diagnosticTests.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Missing Evidence & Recommended Telemetry Checks */}
          <div className="grid-2">
            <div className="card">
              <div className="card-title">
                <span>Missing Evidence & Data Gaps</span>
                <HelpCircle size={16} color="var(--text-muted)" />
              </div>
              <ul style={{ margin: '8px 0 0 20px', fontSize: '13px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                {report.missingEvidence.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Recommended Diagnostic Action Items</span>
                <Activity size={16} color="var(--accent-forest)" />
              </div>
              <ul style={{ margin: '8px 0 0 20px', fontSize: '13px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                {report.recommendedChecks.map((chk, idx) => (
                  <li key={idx}>{chk}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Verified Citations List */}
          <div className="card">
            <div className="card-title">
              <span>Retrieved Evidence Passages & Citations ({report.citations.length})</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click any citation passage to inspect full source provenance
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {report.citations.map((cit) => (
                <div
                  key={cit.citationId}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedCitation(cit)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="brand-badge" style={{ backgroundColor: 'var(--accent-forest-subtle)', color: 'var(--accent-forest)' }}>
                        {cit.citationId}
                      </span>
                      <strong style={{ fontSize: '13px' }}>{cit.sourceTitle}</strong>
                    </div>
                    {cit.temporalRelevance === 'outdated' ? (
                      <span className="badge badge-outdated">Outdated Document</span>
                    ) : (
                      <span className="badge badge-supported">Current Provenance</span>
                    )}
                  </div>
                  <div className="passage-quote" style={{ margin: '4px 0 0 0' }}>
                    "{cit.exactExcerpt}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citation Detail Modal */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
        onNavigateToSource={onNavigateToSource}
      />
    </div>
  );
};
