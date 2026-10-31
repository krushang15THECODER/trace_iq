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
  Folder,
  FolderPlus,
  LogOut,
  User,
  ChevronDown,
  Plus
} from 'lucide-react';
import {
  HealthInfo,
  SourceDocument,
  IncidentRecord,
  InvestigationReport,
  ProjectRecord,
  UserRecord
} from './types';
import { api } from './api/client';

import { LoginPage } from './components/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { OverviewPage } from './pages/OverviewPage';
import { InvestigationPage } from './pages/InvestigationPage';
import { SourceLibraryPage } from './pages/SourceLibraryPage';
import { EvidenceExplorerPage } from './pages/EvidenceExplorerPage';
import { EvaluationLabPage } from './pages/EvaluationLabPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>('projects');
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    localStorage.getItem('traceiq_active_project') || null
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState<boolean>(false);

  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationReport[]>([]);
  const [selectedSourceIdForLibrary, setSelectedSourceIdForLibrary] = useState<string | null>(null);

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const me = await api.getMe();
        setCurrentUser(me.user);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    initAuth();
  }, []);

  const loadInitialData = async () => {
    try {
      const h = await api.getHealth();
      setHealth(h);
    } catch {
      // offline / starting up
    }

    if (!currentUser) return;

    try {
      const [projs, incs, srcs, invs] = await Promise.all([
        api.getProjects(),
        api.getIncidents(),
        api.getSources(activeProjectId || undefined),
        api.getInvestigations(activeProjectId || undefined)
      ]);

      setProjects(projs);
      setIncidents(incs);
      setSources(srcs);
      setInvestigations(invs);

      // Auto-select first project if none is active
      if (!activeProjectId && projs.length > 0) {
        setActiveProjectId(projs[0]._id);
        localStorage.setItem('traceiq_active_project', projs[0]._id);
      }
    } catch (err: any) {
      console.warn('Data load warning:', err.message);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadInitialData();
      const interval = setInterval(loadInitialData, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser, activeProjectId]);

  const handleSelectProject = (projectId: string | null) => {
    setActiveProjectId(projectId);
    if (projectId) {
      localStorage.setItem('traceiq_active_project', projectId);
    } else {
      localStorage.removeItem('traceiq_active_project');
    }
    setIsProjectDropdownOpen(false);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setProjects([]);
    setSources([]);
    setInvestigations([]);
    localStorage.removeItem('traceiq_active_project');
  };

  const handleNavigateToSource = (sourceId: string) => {
    setSelectedSourceIdForLibrary(sourceId);
    setActiveTab('sources');
  };

  // 1. Initial Loading Screen while checking auth
  if (isCheckingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-logo" style={{ margin: '0 auto 16px', width: '40px', height: '40px' }}>
            <ShieldCheck size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-secondary)' }}>
            Initializing TraceIQ Session...
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadInitialData();
        }}
      />
    );
  }

  const activeProject = projects.find((p) => p._id === activeProjectId);

  // 3. Authenticated Application Layout
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
          <span className="brand-badge">RAG Engine</span>

          {/* Quick Project Switcher Dropdown */}
          <div style={{ position: 'relative', marginLeft: '12px' }}>
            <button
              className="project-select-trigger"
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              title="Switch Active Project"
            >
              <Folder size={14} color="var(--accent-forest)" />
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject ? activeProject.name : 'All Projects'}
              </span>
              <ChevronDown size={12} />
            </button>

            {isProjectDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: '220px',
                  zIndex: 100,
                  padding: '6px 0'
                }}
              >
                <div style={{ padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  ACTIVE PROJECT
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: !activeProjectId ? 'var(--accent-forest-subtle)' : 'transparent',
                    fontWeight: !activeProjectId ? 600 : 400
                  }}
                  onClick={() => handleSelectProject(null)}
                >
                  🌐 All Projects (Global)
                </div>
                {projects.map((p) => (
                  <div
                    key={p._id}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      backgroundColor: activeProjectId === p._id ? 'var(--accent-forest-subtle)' : 'transparent',
                      fontWeight: activeProjectId === p._id ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onClick={() => handleSelectProject(p._id)}
                  >
                    <Folder size={13} color="var(--accent-forest)" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: 'var(--accent-forest)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => {
                    setIsProjectDropdownOpen(false);
                    setActiveTab('projects');
                  }}
                >
                  <Plus size={13} />
                  Manage / Create Projects
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links">
          <button
            className={`nav-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FolderPlus size={14} />
            Projects
          </button>
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

        {/* User Section & Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="nav-status">
            <span
              className={`status-dot ${health?.database.connected ? 'online' : 'offline'}`}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {health?.database.connected
                ? health.database.isAtlas
                  ? 'Atlas Ready'
                  : 'MongoDB Local'
                : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--border-light)', paddingLeft: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
              <User size={14} color="var(--accent-forest)" />
              <span>{currentUser.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Sign Out"
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="main-content" onClick={() => isProjectDropdownOpen && setIsProjectDropdownOpen(false)}>
        {activeTab === 'projects' && (
          <ProjectsPage
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => {
              handleSelectProject(id);
              setActiveTab('investigate');
            }}
            onRefreshProjects={loadInitialData}
            onNavigateToInvestigate={(projectId) => {
              handleSelectProject(projectId);
              setActiveTab('investigate');
            }}
            onNavigateToSources={(projectId) => {
              handleSelectProject(projectId);
              setSelectedSourceIdForLibrary(null);
              setActiveTab('sources');
            }}
          />
        )}

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
            activeProjectId={activeProjectId}
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}

        {activeTab === 'sources' && (
          <SourceLibraryPage
            sources={sources}
            onRefresh={loadInitialData}
            selectedSourceId={selectedSourceIdForLibrary}
            activeProjectId={activeProjectId}
            projects={projects}
            onSelectProject={handleSelectProject}
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
