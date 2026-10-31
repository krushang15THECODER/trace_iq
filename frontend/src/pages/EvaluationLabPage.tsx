import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  FileCheck,
  Cpu,
  Clock,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { EvaluationReport } from '../types';
import { api } from '../api/client';

export const EvaluationLabPage: React.FC = () => {
  const [evaluations, setEvaluations] = useState<EvaluationReport[]>([]);
  const [activeReport, setActiveReport] = useState<EvaluationReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluations = async () => {
    try {
      const list = await api.getEvaluations();
      setEvaluations(list);
      if (list.length > 0 && !activeReport) {
        setActiveReport(list[0]);
      }
    } catch (err: any) {
      console.error('Failed to load evaluations:', err);
    }
  };

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const rep = await api.runEvaluation();
      setActiveReport(rep);
      await fetchEvaluations();
    } catch (err: any) {
      setError(err.message || 'Evaluation run failed');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Evaluation & Benchmark Lab</h1>
          <p className="page-subtitle">
            Systematic benchmark suite for multi-source retrieval, exact error code recall, citation validity, and hypothesis accuracy.
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={isRunning}
          onClick={handleRunEvaluation}
        >
          {isRunning ? (
            <>
              <Activity size={15} className="spin-animation" />
              Running Benchmark Suite...
            </>
          ) : (
            <>
              <Play size={15} />
              Run Benchmark Suite
            </>
          )}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'var(--accent-terracotta-subtle)',
          border: '1px solid rgba(163, 72, 53, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: '20px',
          color: 'var(--accent-terracotta)',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* Benchmark Summary Metrics */}
      {activeReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Metric Cards */}
          <div className="grid-4">
            <div className="metric-box">
              <div className="metric-label">Recall@K</div>
              <div className="metric-value">
                {(activeReport.metrics.recallAtK * 100).toFixed(0)}%
              </div>
              <div className="metric-meta">Multi-source evidence recall</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Mean Reciprocal Rank (MRR)</div>
              <div className="metric-value">
                {activeReport.metrics.mrr.toFixed(2)}
              </div>
              <div className="metric-meta">Exact error code search rank</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Citation ID Validity</div>
              <div className="metric-value">
                {(activeReport.metrics.citationIdValidity * 100).toFixed(0)}%
              </div>
              <div className="metric-meta">Zero fabricated citation IDs</div>
            </div>

            <div className="metric-box">
              <div className="metric-label">Abstention Adherence</div>
              <div className="metric-value">
                {(activeReport.metrics.abstentionQuality * 100).toFixed(0)}%
              </div>
              <div className="metric-meta">Unanswerable query handling</div>
            </div>
          </div>

          {/* Metric Separation: Automated vs Heuristic Validation */}
          <div className="grid-2">
            <div className="card">
              <div className="card-title">
                <span>Automated Retrieval Metrics</span>
                <span className="brand-badge">Deterministic</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Retrieval Recall@10</span>
                  <strong>{(activeReport.automatedMetrics.retrievalRecall * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Reciprocal Rank for Exact Code</span>
                  <strong>{activeReport.automatedMetrics.retrievalMRR.toFixed(3)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Exact Code Precision@1</span>
                  <strong>{(activeReport.automatedMetrics.exactCodePrecision * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span>Citation Syntax Pass Rate</span>
                  <strong>{(activeReport.automatedMetrics.citationSyntaxPassRate * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Heuristic & Semantic Validation Metrics</span>
                <span className="brand-badge">Ground Truth</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Outdated Conflict Detection</span>
                  <strong>{(activeReport.heuristicValidationMetrics.temporalConflictDetectionRate * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Abstention Adherence Rate</span>
                  <strong>{(activeReport.heuristicValidationMetrics.abstentionAdherenceRate * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>Hypothesis Ground-Truth Alignment</span>
                  <strong>{(activeReport.heuristicValidationMetrics.hypothesisAlignmentScore * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span>Expected Source Coverage</span>
                  <strong>{(activeReport.metrics.expectedSourceCoverage * 100).toFixed(1)}%</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Test Case Breakdown Table */}
          <div className="card">
            <div className="card-title">
              <span>Benchmark Test Case Results ({activeReport.testCases.length} Tests)</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Executed: {new Date(activeReport.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="table-container" style={{ marginTop: '12px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Test Case</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Details & Diagnostics</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReport.testCases.map((tc) => (
                    <tr key={tc.testId}>
                      <td style={{ width: '80px' }}>
                        {tc.passed ? (
                          <span className="badge badge-supported" style={{ gap: '4px' }}>
                            <CheckCircle2 size={12} /> PASS
                          </span>
                        ) : (
                          <span className="badge badge-contradicted" style={{ gap: '4px' }}>
                            <XCircle size={12} /> FAIL
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <div>{tc.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {tc.testId}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        {tc.category}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {tc.score}
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {tc.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Failure Analysis */}
          {activeReport.failureAnalysis.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--accent-terracotta)' }}>
              <div className="card-title" style={{ color: 'var(--accent-terracotta)' }}>
                <span>Failure Analysis & Remediation Recommendations</span>
                <AlertTriangle size={16} />
              </div>
              <ul style={{ margin: '8px 0 0 20px', fontSize: '13px', lineHeight: '1.6' }}>
                {activeReport.failureAnalysis.map((fa, i) => (
                  <li key={i}>{fa}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <TrendingUp size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <h3>No Evaluation Run Logged Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            Click "Run Benchmark Suite" above to execute all 8 automated and heuristic retrieval tests.
          </p>
        </div>
      )}
    </div>
  );
};
