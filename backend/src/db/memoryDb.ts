import fs from 'fs';
import path from 'path';

function getNestedValue(obj: any, keyPath: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!keyPath.includes('.')) return obj[keyPath];
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj: any, keyPath: string, value: any): void {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function matchDoc(doc: any, query: any): boolean {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, expected] of Object.entries(query)) {
    if (key === '$text') {
      const searchStr = String((expected as any)?.$search || '').toLowerCase();
      const content = String(doc.content || '').toLowerCase();
      const heading = String(doc.sectionHeading || '').toLowerCase();
      const full = `${heading} ${content}`;
      const tokens = searchStr.split(/\s+/).filter((t) => t.length > 2);
      let matchCount = 0;
      for (const t of tokens) {
        if (full.includes(t)) matchCount++;
      }
      if (matchCount === 0) return false;
      doc._textScore = matchCount;
      doc.score = matchCount;
      continue;
    }

    const actual = getNestedValue(doc, key);

    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const expObj = expected as Record<string, any>;

      if ('$in' in expObj) {
        if (!Array.isArray(expObj.$in)) return false;
        if (!expObj.$in.includes(actual)) return false;
        continue;
      }

      if ('$ne' in expObj) {
        if (actual === expObj.$ne) return false;
        continue;
      }

      if ('$regex' in expObj) {
        const pattern = expObj.$regex;
        const flags = expObj.$options || '';
        const regex = new RegExp(pattern, flags);
        if (!regex.test(String(actual || ''))) return false;
        continue;
      }
    }

    if (Array.isArray(actual)) {
      if (!actual.includes(expected)) return false;
    } else {
      if (actual !== expected) return false;
    }
  }

  return true;
}

export class MemoryCollection<T extends { _id?: string }> {
  private docs: T[] = [];
  public name: string;
  private onChange?: () => void;

  constructor(name: string, initialDocs: T[] = [], onChange?: () => void) {
    this.name = name;
    this.docs = [...initialDocs];
    this.onChange = onChange;
  }

  getRawDocs(): T[] {
    return this.docs;
  }

  setRawDocs(docs: T[]): void {
    this.docs = docs;
  }

  find(query: any = {}, options: any = {}) {
    const filterFn = (doc: T) => matchDoc(doc, query);
    let results = this.docs.filter(filterFn);

    const cursor = {
      _sort: null as any,
      _limit: null as number | null,
      _skip: null as number | null,
      _project: null as any,

      sort(sortObj: any) {
        cursor._sort = sortObj;
        return cursor;
      },
      limit(n: number) {
        cursor._limit = n;
        return cursor;
      },
      skip(n: number) {
        cursor._skip = n;
        return cursor;
      },
      project(projObj: any) {
        cursor._project = projObj;
        return cursor;
      },
      async toArray(): Promise<T[]> {
        let list = [...results];

        if (cursor._sort) {
          const [sortKey, sortDir] = Object.entries(cursor._sort)[0] || [];
          if (sortKey) {
            const isTextMeta = typeof sortDir === 'object' && (sortDir as any)?.$meta === 'textScore';
            const dir = isTextMeta || sortDir === -1 ? -1 : 1;
            list.sort((a: any, b: any) => {
              const valA = sortKey === 'score' ? (a.score ?? a._textScore ?? 0) : getNestedValue(a, sortKey);
              const valB = sortKey === 'score' ? (b.score ?? b._textScore ?? 0) : getNestedValue(b, sortKey);
              if (valA === valB) return 0;
              if (valA == null) return 1;
              if (valB == null) return -1;
              return valA > valB ? dir : -dir;
            });
          }
        }

        if (cursor._skip != null && cursor._skip > 0) {
          list = list.slice(cursor._skip);
        }

        if (cursor._limit != null && cursor._limit > 0) {
          list = list.slice(0, cursor._limit);
        }

        if (cursor._project) {
          list = list.map((item: any) => {
            const copy: any = { ...item };
            for (const [projKey, projVal] of Object.entries(cursor._project)) {
              if (projVal === 0) {
                delete copy[projKey];
              } else if (typeof projVal === 'object' && (projVal as any)?.$meta === 'textScore') {
                copy[projKey] = item.score ?? item._textScore ?? 1;
              }
            }
            return copy;
          });
        }

        return list.map((d) => JSON.parse(JSON.stringify(d)));
      }
    };

    return cursor;
  }

  async findOne(query: any = {}, options: any = {}): Promise<T | null> {
    const cursor = this.find(query, options);
    const results = await cursor.limit(1).toArray();
    return results[0] || null;
  }

  async insertOne(doc: T): Promise<{ insertedId: string; acknowledged: boolean }> {
    const toInsert = JSON.parse(JSON.stringify(doc));
    if (!toInsert._id) {
      toInsert._id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    this.docs.push(toInsert);
    this.onChange?.();
    return { insertedId: toInsert._id, acknowledged: true };
  }

  async insertMany(docs: T[]): Promise<{ insertedCount: number; acknowledged: boolean }> {
    for (const doc of docs) {
      await this.insertOne(doc);
    }
    return { insertedCount: docs.length, acknowledged: true };
  }

  async updateOne(query: any, update: any, options: any = {}): Promise<{ matchedCount: number; modifiedCount: number; acknowledged: boolean }> {
    const idx = this.docs.findIndex((d) => matchDoc(d, query));
    if (idx >= 0) {
      const doc = this.docs[idx] as any;
      if (update.$set) {
        for (const [keyPath, val] of Object.entries(update.$set)) {
          setNestedValue(doc, keyPath, val);
        }
      }
      this.onChange?.();
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    }

    if (options && options.upsert) {
      const newDoc: any = { ...query };
      if (update.$set) {
        for (const [keyPath, val] of Object.entries(update.$set)) {
          setNestedValue(newDoc, keyPath, val);
        }
      }
      if (!newDoc._id) {
        newDoc._id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      this.docs.push(newDoc);
      this.onChange?.();
      return { matchedCount: 0, modifiedCount: 1, acknowledged: true };
    }

    return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  }

  async deleteOne(query: any): Promise<{ deletedCount: number; acknowledged: boolean }> {
    const idx = this.docs.findIndex((d) => matchDoc(d, query));
    if (idx >= 0) {
      this.docs.splice(idx, 1);
      this.onChange?.();
      return { deletedCount: 1, acknowledged: true };
    }
    return { deletedCount: 0, acknowledged: true };
  }

  async deleteMany(query: any): Promise<{ deletedCount: number; acknowledged: boolean }> {
    const initial = this.docs.length;
    this.docs = this.docs.filter((d) => !matchDoc(d, query));
    const deleted = initial - this.docs.length;
    if (deleted > 0) {
      this.onChange?.();
    }
    return { deletedCount: deleted, acknowledged: true };
  }

  async countDocuments(query: any = {}): Promise<number> {
    const results = this.docs.filter((d) => matchDoc(d, query));
    return results.length;
  }

  async bulkWrite(ops: any[]): Promise<{ acknowledged: boolean }> {
    for (const op of ops) {
      if (op.replaceOne) {
        await this.updateOne(op.replaceOne.filter, { $set: op.replaceOne.replacement }, { upsert: op.replaceOne.upsert });
      } else if (op.insertOne) {
        await this.insertOne(op.insertOne.document);
      } else if (op.deleteOne) {
        await this.deleteOne(op.deleteOne.filter);
      }
    }
    return { acknowledged: true };
  }

  async createIndex(spec: any, options: any = {}): Promise<string> {
    return 'memory_index';
  }

  listSearchIndexes() {
    return {
      toArray: async () => []
    };
  }

  aggregate(pipeline: any[] = []) {
    let list = [...this.docs];

    for (const stage of pipeline) {
      if (stage.$match) {
        list = list.filter((d) => matchDoc(d, stage.$match));
      }
      if (stage.$limit) {
        list = list.slice(0, stage.$limit);
      }
      if (stage.$project) {
        list = list.map((item: any) => {
          const res: any = {};
          for (const [k, v] of Object.entries(stage.$project)) {
            if (v === 1) res[k] = item[k];
          }
          return res;
        });
      }
    }

    return {
      toArray: async () => list.map((d) => JSON.parse(JSON.stringify(d)))
    };
  }
}

export class MemoryDatabase {
  private collections: Map<string, MemoryCollection<any>> = new Map();
  private persistFilePath: string;

  constructor() {
    const cwd = process.cwd();
    const dataDir = cwd.endsWith('backend')
      ? path.resolve(cwd, 'data')
      : path.resolve(cwd, 'backend/data');

    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.persistFilePath = path.join(dataDir, 'local_db.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.persistFilePath)) {
        const raw = fs.readFileSync(this.persistFilePath, 'utf-8');
        const data = JSON.parse(raw);
        for (const [colName, docs] of Object.entries(data)) {
          if (Array.isArray(docs)) {
            const col = this.collection(colName);
            col.setRawDocs(docs);
          }
        }
      }
    } catch (err: any) {
      console.warn('MemoryDatabase load error:', err.message);
    }
  }

  public saveToDisk() {
    try {
      const dump: Record<string, any[]> = {};
      for (const [name, col] of this.collections.entries()) {
        dump[name] = col.getRawDocs();
      }
      fs.writeFileSync(this.persistFilePath, JSON.stringify(dump, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  collection<T extends { _id?: string }>(name: string): any {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MemoryCollection<T>(name, [], () => this.saveToDisk()));
    }
    return this.collections.get(name);
  }
}

export class MockClient {
  startSession() {
    return {
      withTransaction: async (fn: () => Promise<any>) => fn(),
      endSession: async () => {}
    };
  }
  async close() {}
}
