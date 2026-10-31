# MongoDB Atlas & Vector Search Setup Guide for TraceIQ

TraceIQ uses **MongoDB Atlas** as its core database, leveraging:
1. **MongoDB Atlas Vector Search** (`$vectorSearch` aggregation stage) for semantic retrieval.
2. **MongoDB Atlas Search** (`$search` aggregation stage) for exact lexical token matching.
3. **Reciprocal Rank Fusion (RRF)** to fuse vector and lexical candidate rankings into an optimal evidence stream.

---

## 1. Prerequisites
- A MongoDB Atlas account (free M0 tier or dedicated M10+ cluster).
- Node.js v18+ and npm.

---

## 2. Atlas Vector Search Index Configuration

1. In MongoDB Atlas, go to **Database Deployments** -> click on your cluster.
2. Navigate to the **Atlas Search** tab -> Click **Create Search Index**.
3. Select **Atlas Vector Search** (JSON Editor).
4. Select the Database: `traceiq` and Collection: `chunks`.
5. Enter Index Name: `vector_index` (matches `VECTOR_INDEX_NAME` in `.env`).
6. Paste the index definition from `docs/vector-index-definition.json`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "sourceId"
    },
    {
      "type": "filter",
      "path": "metadata.sourceType"
    },
    {
      "type": "filter",
      "path": "metadata.incidentDate"
    },
    {
      "type": "filter",
      "path": "metadata.isOutdated"
    },
    {
      "type": "filter",
      "path": "metadata.service"
    }
  ]
}
```

7. Click **Create Vector Search Index**. Atlas will begin building the index.

---

## 3. Atlas Lexical Search Index Configuration (Optional for Hybrid Retrieval)

1. Under **Atlas Search**, click **Create Search Index**.
2. Select **Atlas Search** -> **JSON Editor**.
3. Target: Database `traceiq`, Collection `chunks`.
4. Index Name: `search_index` (matches `SEARCH_INDEX_NAME` in `.env`).
5. Paste definition from `docs/search-index-definition.json`:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "content": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "sectionHeading": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "sourceId": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "metadata": {
        "type": "document",
        "fields": {
          "sourceType": {
            "type": "string",
            "analyzer": "lucene.keyword"
          },
          "service": {
            "type": "string",
            "analyzer": "lucene.keyword"
          },
          "isOutdated": {
            "type": "boolean"
          }
        }
      }
    }
  }
}
```

---

## 4. Local Development Fallback Behavior

When running locally without an Atlas cluster or when Atlas Search is building:
- TraceIQ automatically detects cluster capabilities via `collection.listSearchIndexes()`.
- Standard MongoDB B-Tree indexes and native `$text` indexes are initialized automatically.
- The UI diagnostics and API health endpoint explicitly report index status (`ready`, `building`, `not_found`, or `unsupported`).
- Fallback retrieval preserves chunk provenance, source IDs, exact passages, and metadata filters without pretending that an unavailable Atlas index is active.
