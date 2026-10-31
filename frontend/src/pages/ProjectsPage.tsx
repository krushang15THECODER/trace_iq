import React, { useState } from 'react';
import {
  FolderPlus,
  Folder,
  FolderOpen,
  Trash2,
  FileText,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle,
  Plus,
  Clock
} from 'lucide-react';
import { ProjectRecord } from '../types';
import { api } from '../api/client';
import { ProjectDetailPage } from './ProjectDetailPage';

interface ProjectsPageProps {
  projects: ProjectRecord[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onRefreshProjects: () => void;
  onNavigateToInvestigate?: (projectId: string) => void;
  onNavigateToSources?: (projectId: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onRefreshProjects,
  onNavigateToInvestigate,
  onNavigateToSources
}) => {
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a project name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await api.createProject(name.trim(), description.trim());
      setSuccessMessage(`Project "${created.name}" created successfully!`);
      setName('');
      setDescription('');
      setShowCreateModal(false);
      onRefreshProjects();
      onSelectProject(created._id);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"? This will permanently delete all uploaded documents, chunks, and investigation history for this project.`)) {
      return;
    }

    try {
      await api.deleteProject(projectId);
      setSuccessMessage(`Project "${projectName}" deleted successfully.`);
      // Reset selected project if the deleted one was selected
      if (selectedProject && selectedProject._id === projectId) {
        setSelectedProject(null);
      }
      onRefreshProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    }
  };

  // If a project is selected, show its detail page
  if (selectedProject) {
    return (
      <ProjectDetailPage
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onNavigateToInvestigate={onNavigateToInvestigate || (() => {})}
        onNavigateToSources={onNavigateToSources || (() => {})}
      />
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Project Management</h1>
          <p className="page-subtitle">
            Organize incident investigations, isolate technical evidence, and manage document knowledge bases per project.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowCreateModal(true); setError(null); }}
        >
          <Plus size={15} />
          Create New Project
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--accent-forest-subtle)',
            color: 'var(--accent-forest)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            fontSize: '13px'
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderPlus size={20} style={{ color: 'var(--accent-forest)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Create Incident Project</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Project Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment Gateway Failure (INC-2024-09)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Description / Investigation Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the service affected, failure symptoms, or investigation objectives..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <Folder size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>No Projects Found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 20px' }}>
            Get started by creating your first incident project to isolate logs and run evidence-grounded investigations.
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Create First Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {projects.map((proj) => {
            const isActive = proj._id === activeProjectId;
            return (
              <div
                key={proj._id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isActive ? '2px solid var(--accent-forest)' : '1px solid var(--border-light)',
                  backgroundColor: isActive ? 'var(--accent-forest-subtle)' : 'var(--bg-surface)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Folder size={18} style={{ color: isActive ? 'var(--accent-forest)' : 'var(--text-muted)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {proj._id}
                      </span>
                    </div>
                    {isActive && (
                      <span className="badge badge-supported" style={{ fontSize: '10px' }}>
                        Active Project
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    {proj.name}
                  </h3>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5',
                      marginBottom: '16px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {proj.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  {/* Counts and Meta */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-light)',
                      marginBottom: '16px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FileText size={13} />
                      <strong>{proj.documentCount || 0}</strong> docs
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={13} />
                      <strong>{proj.investigationCount || 0}</strong> investigations
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                      <Calendar size={13} />
                      {new Date(proj.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedProject(proj);
                        onSelectProject(proj._id);
                      }}
                    >
                      <FolderOpen size={14} />
                      {isActive ? 'Current Project' : 'Open Project'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      title="Delete Project"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={() => handleDelete(proj._id, proj.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
