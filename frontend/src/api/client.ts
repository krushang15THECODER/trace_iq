import {
  HealthInfo,
  SourceDocument,
  ChunkDocument,
  IncidentRecord,
  InvestigationReport,
  EvaluationReport
} from '../types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<HealthInfo> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async getSources(type?: string, status?: string): Promise<SourceDocument[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}/sources?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch sources');
    return res.json();
  },

  async getSourceDetails(id: string): Promise<{ source: SourceDocument; chunks: ChunkDocument[] }> {
    const res = await fetch(`${API_BASE}/sources/${id}`);
    if (!res.ok) throw new Error('Failed to fetch source details');
    return res.json();
  },

  async uploadSource(formData: FormData): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  async importWebpage(url: string, title?: string): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title })
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
  }): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Note creation failed' }));
      throw new Error(err.error || 'Note creation failed');
    }
    return res.json();
  },

  async reprocessSource(id: string): Promise<SourceDocument> {
    const res = await fetch(`${API_BASE}/sources/${id}/reprocess`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reprocess source');
    return res.json();
  },

  async deleteSource(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete source');
  },

  async getChunks(limit: number = 30, sourceId?: string): Promise<ChunkDocument[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (sourceId) params.append('sourceId', sourceId);
    const res = await fetch(`${API_BASE}/chunks?${params.toString()}`);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getIncidents(): Promise<IncidentRecord[]> {
    const res = await fetch(`${API_BASE}/incidents`);
    if (!res.ok) throw new Error('Failed to fetch incidents');
    return res.json();
  },

  async runInvestigation(params: {
    question: string;
    incidentId?: string;
    sourceFilters?: string[];
    serviceFilter?: string;
    timeFilter?: string;
    topK?: number;
  }): Promise<InvestigationReport> {
    const res = await fetch(`${API_BASE}/investigations/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Investigation failed' }));
      throw new Error(err.error || 'Investigation failed');
    }
    return res.json();
  },

  async getInvestigations(): Promise<InvestigationReport[]> {
    const res = await fetch(`${API_BASE}/investigations`);
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<InvestigationReport> {
    const res = await fetch(`${API_BASE}/investigations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch investigation');
    return res.json();
  },

  async runEvaluation(): Promise<EvaluationReport> {
    const res = await fetch(`${API_BASE}/evaluations/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to execute evaluation suite');
    return res.json();
  },

  async getEvaluations(): Promise<EvaluationReport[]> {
    const res = await fetch(`${API_BASE}/evaluations`);
    if (!res.ok) throw new Error('Failed to fetch evaluation reports');
    return res.json();
  }
};
