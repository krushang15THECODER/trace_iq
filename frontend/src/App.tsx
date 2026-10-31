import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  Sparkles,
  BookOpen,
  Layers,
  TrendingUp,
  FileText,
  Settings,
  CircleDot
} from 'lucide-react';
import { HealthInfo, SourceDocument, IncidentRecord, InvestigationReport } from './types';
import { api } from './api/client';

import { OverviewPage } from './pages/OverviewPage';
import { InvestigationPage } from './pages/InvestigationPage';
import { SourceLibraryPage } from './pages/SourceLibraryPage';
import { EvidenceExplorerPage } from './pages/EvidenceExplorerPage';
import { EvaluationLabPage } from './pages/EvaluationLabPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationReport[]>([]);
  const [selectedSourceIdForLibrary, setSelectedSourceIdForLibrary] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      // offline / starting up
    }

    try {
      const [srcs, incs, invs] = await Promise.all([
        api.getSources(),
        api.getIncidents(),
        api.getInvestigations()
      ]);
      setSources(srcs);
      setIncidents(incs);
      setInvestigations(invs);
    } catch (err: any) {
      console.warn('Data load warning:', err.message);
    }
  };

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadInitialData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleNavigateToSource = (sourceId: string) => {
    setSelectedSourceIdForLibrary(sourceId);
    setActiveTab('sources');
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="brand-title">TraceIQ</div>
          </div>
          <span className="brand-badge">RAG Engine • MongoDB Track</span>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={14} />
            Overview
          </button>
          <button
            className={`nav-tab ${activeTab === 'investigate' ? 'active' : ''}`}
            onClick={() => setActiveTab('investigate')}
          >
            <Sparkles size={14} />
            Investigation
          </button>
          <button
            className={`nav-tab ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => {
              setSelectedSourceIdForLibrary(null);
              setActiveTab('sources');
            }}
          >
            <BookOpen size={14} />
            Source Library
          </button>
          <button
            className={`nav-tab ${activeTab === 'evidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            <Layers size={14} />
            Evidence Explorer
          </button>
          <button
            className={`nav-tab ${activeTab === 'eval' ? 'active' : ''}`}
            onClick={() => setActiveTab('eval')}
          >
            <TrendingUp size={14} />
            Evaluation Lab
          </button>
          <button
            className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileText size={14} />
            Reports
          </button>
          <button
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={14} />
            Settings
          </button>
        </nav>

        {/* Connection Status Indicator */}
        <div className="nav-status">
          <span
            className={`status-dot ${health?.database.connected ? 'online' : 'offline'}`}
          />
          <span style={{ color: 'var(--text-secondary)' }}>
            {health?.database.connected
              ? health.database.isAtlas
                ? 'Atlas Vector Search Ready'
                : 'MongoDB Connected'
              : 'MongoDB Offline'}
          </span>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <OverviewPage
            health={health}
            sources={sources}
            investigations={investigations}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'investigate' && (
          <InvestigationPage
            incidents={incidents}
            onNavigateToSource={handleNavigateToSource}
          />
        )}

        {activeTab === 'sources' && (
          <SourceLibraryPage
            sources={sources}
            onRefresh={loadInitialData}
            selectedSourceId={selectedSourceIdForLibrary}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceExplorerPage onNavigateToSource={handleNavigateToSource} />
        )}

        {activeTab === 'eval' && <EvaluationLabPage />}

        {activeTab === 'reports' && (
          <ReportsPage
            investigations={investigations}
            onNavigateToSource={handleNavigateToSource}
          />
        )}

        {activeTab === 'settings' && <SettingsPage health={health} />}
      </main>
    </div>
  );
};
