import {
  HealthInfo,
  SourceDocument,
  ChunkDocument,
  IncidentRecord,
  InvestigationReport,
  EvaluationReport,
  ProjectRecord,
  UserRecord
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('traceiq_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Authentication
  setAuth(user: UserRecord | null, token: string | null) {
    if (user && token) {
      localStorage.setItem('traceiq_token', token);
      localStorage.setItem('traceiq_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('traceiq_token');
      localStorage.removeItem('traceiq_user');
    }
  },

  getCurrentUser(): UserRecord | null {
    try {
      const stored = localStorage.getItem('traceiq_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  async login(email: string, password: string): Promise<{ user: UserRecord; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed. Please check your credentials.');
    }
    const data = await res.json();
    this.setAuth(data.user, data.token);
    return data;
  },

  async register(email: string, password: string, name?: string): Promise<{ user: UserRecord; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    this.setAuth(data.user, data.token);
    return data;
  },

  async getMe(): Promise<{ user: UserRecord }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  logout() {
    this.setAuth(null, null);
  },

  // Projects
  async getProjects(): Promise<ProjectRecord[]> {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getProject(id: string): Promise<{ project: ProjectRecord; sources: SourceDocument[]; investigations: InvestigationReport[] }> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch project details');
    return res.json();
  },

  async createProject(name: string, description?: string): Promise<ProjectRecord> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create project' }));
      throw new Error(err.error || 'Failed to create project');
    }
    return res.json();
  },

  async deleteProject(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  // Health
  async getHealth(): Promise<HealthInfo> {
    const res = await fetch(`${API_BASE}/health`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  // Sources
  async getSources(projectId?: string, type?: string, status?: string): Promise<SourceDocument[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (type) params.append('type', type);
    if (status) params.append('status', status);

    const res = await fetch(`${API_BASE}/sources?${params.toString()}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch sources');
    return res.json();
  },

  async getSourceDetails(id: string): Promise<{ source: SourceDocument; chunks: ChunkDocument[] }> {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch source details');
    return res.json();
  },

  async uploadSource(formData: FormData): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/upload`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  async importWebpage(url: string, title?: string, projectId?: string): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/import-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ url, title, projectId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(err.error || 'Webpage import failed');
    }
    return res.json();
  },

  async createNote(data: {
    title: string;
    content: string;
    service?: string;
    incidentDate?: string;
    isOutdated?: boolean;
    projectId?: string;
  }): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Note creation failed' }));
      throw new Error(err.error || 'Note creation failed');
    }
    return res.json();
  },

  async reprocessSource(id: string): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/${id}/reprocess`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to reprocess source');
    return res.json();
  },

  async deleteSource(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to delete source');
  },

  async getChunks(limit: number = 30, sourceId?: string): Promise<ChunkDocument[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sourceId) params.append('sourceId', sourceId);
    const res = await fetch(`${API_BASE}/chunks?${params.toString()}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch chunks');
    return res.json();
  },

  async testSearch(params: {
    query: string;
    topK?: number;
    mode?: 'hybrid' | 'vector' | 'lexical';
    filter?: any;
  }): Promise<{
    chunks: ChunkDocument[];
    retrievalMode: string;
    vectorCount: number;
    lexicalCount: number;
    fusedCount: number;
  }> {
    const res = await fetch(`${API_BASE}/retrieval/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getIncidents(): Promise<IncidentRecord[]> {
    const res = await fetch(`${API_BASE}/incidents`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch incidents');
    return res.json();
  },

  async runInvestigation(params: {
    question: string;
    incidentId?: string;
    projectId?: string;
    sourceFilters?: string[];
    serviceFilter?: string;
    timeFilter?: string;
    topK?: number;
    llmProvider?: 'gemini' | 'openai' | 'rule_grounded';
  }): Promise<InvestigationReport> {
    const res = await fetch(`${API_BASE}/investigations/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Investigation failed' }));
      throw new Error(err.error || 'Investigation failed');
    }
    return res.json();
  },

  async getInvestigations(projectId?: string): Promise<InvestigationReport[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    const res = await fetch(`${API_BASE}/investigations?${params.toString()}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<InvestigationReport> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch investigation');
    return res.json();
  },

  async deleteInvestigation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to delete investigation');
  },

  async runEvaluation(): Promise<EvaluationReport> {
    const res = await fetch(`${API_BASE}/evaluations/run`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to execute evaluation suite');
    return res.json();
  },

  async getEvaluations(): Promise<EvaluationReport[]> {
    const res = await fetch(`${API_BASE}/evaluations`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Failed to fetch evaluation reports');
    return res.json();
  }
};
