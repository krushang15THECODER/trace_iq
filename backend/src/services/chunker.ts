import Papa from 'papaparse';

export interface RawChunk {
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionHeading?: string;
  contentType: string;
  timestamps?: string[];
  rowId?: number;
  logLevel?: string;
  metadata?: Record<string, any>;
}

export interface ChunkerOptions {
  maxChunkChars?: number;
  chunkOverlapChars?: number;
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  maxChunkChars: 700,
  chunkOverlapChars: 120
};

// Regex for extracting ISO/common log timestamps
const TIMESTAMP_REGEX = /\b(?:\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2})\b/g;

// Regex for log levels
const LOG_LEVEL_REGEX = /\b(FATAL|ERROR|WARN|WARNING|INFO|DEBUG|TRACE|CRITICAL)\b/i;

/**
 * Structure-aware chunking for Markdown & plain text
 */
export function chunkMarkdownAndText(
  text: string,
  options: ChunkerOptions = {}
): RawChunk[] {
  const { maxChunkChars, chunkOverlapChars } = { ...DEFAULT_OPTIONS, ...options };
  const lines = text.split('\n');
  const chunks: RawChunk[] = [];

  let currentHeading = 'General';
  let currentParagraphs: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;

  const pushCurrentChunk = () => {
    if (currentParagraphs.length === 0) return;
    const content = currentParagraphs.join('\n\n').trim();
    if (content.length > 0) {
      const timestamps = content.match(TIMESTAMP_REGEX) || undefined;
      const levelMatch = content.match(LOG_LEVEL_REGEX);
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        sectionHeading: currentHeading,
        contentType: 'text/markdown',
        timestamps: timestamps ? Array.from(new Set(timestamps)) : undefined,
        logLevel: levelMatch ? levelMatch[1].toUpperCase() : undefined
      });
    }

    // Overlap: retain last paragraph if it fits within overlap limit
    if (currentParagraphs.length > 1 && chunkOverlapChars > 0) {
      const lastP = currentParagraphs[currentParagraphs.length - 1];
      if (lastP.length <= chunkOverlapChars * 1.5) {
        currentParagraphs = [lastP];
        currentLength = lastP.length;
        return;
      }
    }
    currentParagraphs = [];
    currentLength = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for Markdown headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (currentParagraphs.length > 0) {
        pushCurrentChunk();
      }
      currentHeading = headingMatch[2].trim();
      currentParagraphs.push(trimmed);
      currentLength = trimmed.length;
      continue;
    }

    // If paragraph boundary
    if (trimmed === '') {
      if (currentLength >= maxChunkChars) {
        pushCurrentChunk();
      }
      continue;
    }

    // Regular line
    if (currentLength + trimmed.length + 2 > maxChunkChars && currentParagraphs.length > 0) {
      pushCurrentChunk();
    }
    currentParagraphs.push(trimmed);
    currentLength += trimmed.length + 2;
  }

  // Flush remaining
  if (currentParagraphs.length > 0) {
    pushCurrentChunk();
  }

  return chunks;
}

/**
 * Structure-aware chunking for PDF pages
 */
export function chunkPdfPages(
  pages: { pageNumber: number; text: string }[],
  options: ChunkerOptions = {}
): RawChunk[] {
  const chunks: RawChunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkMarkdownAndText(page.text, options);
    for (const chunk of pageChunks) {
      chunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
        pageNumber: page.pageNumber,
        contentType: 'application/pdf'
      });
    }
  }

  return chunks;
}

/**
 * Structure-aware chunking for CSV files preserving column context and row IDs
 */
export function chunkCsv(csvText: string, rowsPerChunk: number = 8): RawChunk[] {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields || [];
  const rows = parsed.data as Record<string, string>[];
  const chunks: RawChunk[] = [];

  let chunkIndex = 0;
  for (let i = 0; i < rows.length; i += rowsPerChunk) {
    const rowBatch = rows.slice(i, i + rowsPerChunk);
    const lines: string[] = [];
    lines.push(`Columns: ${headers.join(', ')}`);

    const timestamps: string[] = [];

    rowBatch.forEach((row, idx) => {
      const rowId = i + idx + 1;
      const rowSummary = headers
        .map((h) => `${h}: ${row[h] || 'N/A'}`)
        .join(' | ');
      lines.push(`[Row ${rowId}] ${rowSummary}`);

      // Extract any dates/timestamps in the row
      const foundTs = rowSummary.match(TIMESTAMP_REGEX);
      if (foundTs) timestamps.push(...foundTs);
    });

    const content = lines.join('\n');
    chunks.push({
      content,
      chunkIndex: chunkIndex++,
      sectionHeading: `Rows ${i + 1} to ${Math.min(i + rowsPerChunk, rows.length)}`,
      contentType: 'text/csv',
      rowId: i + 1,
      timestamps: timestamps.length > 0 ? Array.from(new Set(timestamps)) : undefined
    });
  }

  return chunks;
}

/**
 * Structure-aware chunking for JSON files
 */
export function chunkJson(jsonText: string): RawChunk[] {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return chunkMarkdownAndText(jsonText);
  }

  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  if (Array.isArray(data)) {
    const batchSize = 5;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const content = `Array Elements [${i}..${Math.min(i + batchSize - 1, data.length - 1)}]:\n` +
        JSON.stringify(batch, null, 2);
      const timestamps = content.match(TIMESTAMP_REGEX) || undefined;
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        sectionHeading: `Array items ${i} to ${Math.min(i + batchSize, data.length)}`,
        contentType: 'application/json',
        timestamps: timestamps ? Array.from(new Set(timestamps)) : undefined
      });
    }
  } else if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    for (const key of keys) {
      const val = data[key];
      const content = `Object Path: .${key}\n` + JSON.stringify({ [key]: val }, null, 2);
      const timestamps = content.match(TIMESTAMP_REGEX) || undefined;
      chunks.push({
        content,
        chunkIndex: chunkIndex++,
        sectionHeading: `Property .${key}`,
        contentType: 'application/json',
        timestamps: timestamps ? Array.from(new Set(timestamps)) : undefined
      });
    }
  } else {
    chunks.push({
      content: String(data),
      chunkIndex: 0,
      contentType: 'application/json'
    });
  }

  return chunks;
}
