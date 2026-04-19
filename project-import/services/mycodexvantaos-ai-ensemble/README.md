# CodexVanta OS — AI Engine

**codexvanta-os-ai-engine** is the artificial intelligence and machine learning service layer of CodexVanta OS. It provides LLM orchestration, embedding generation, agent execution, and retrieval-augmented generation (RAG) capabilities through a provider-agnostic interface.

---

## Purpose

The AI Engine exists to give every other module in CodexVanta OS access to intelligent text generation, semantic search, autonomous agent workflows, and context-aware retrieval — without binding the platform to any single AI vendor or model provider.

In **Native mode**, the AI Engine operates with local template-based inference, hash-based embeddings, and in-memory vector search. In **Connected mode**, it delegates to external LLM APIs, hosted embedding services, and managed vector databases.

---

## Core Capabilities

### LLM Service
- Text completion and chat-based interaction
- Streaming response support
- Model listing and selection
- Response caching via StateStoreProvider
- Token estimation and context window management
- Native fallback: template-based response generation

### Agent Service
- Autonomous agent creation and lifecycle management
- Multi-step execution with tool calling
- Result collection and history tracking
- Queue-backed asynchronous agent dispatch
- Database-persisted agent definitions and run logs

### Embedding Service
- Text-to-vector embedding generation
- Semantic similarity search across indexed documents
- Index creation, deletion, and management
- Native fallback: deterministic hash-based vector generation
- Cosine similarity computation for search ranking

### RAG Service
- Document ingestion and chunking
- Collection-based document organization
- Context-aware query with retrieval from indexed sources
- Storage-backed document persistence
- Database-indexed metadata for efficient lookup

---

## Architecture

```
┌─────────────────────────────────────────┐
│             AI Engine                    │
│  ┌───────────┐  ┌───────────────────┐   │
│  │LLMService │  │ EmbeddingService  │   │
│  └─────┬─────┘  └────────┬──────────┘   │
│  ┌─────┴─────┐  ┌────────┴──────────┐   │
│  │AgentService│  │   RAGService      │   │
│  └─────┬─────┘  └────────┬──────────┘   │
│        │                  │              │
│  ┌─────┴──────────────────┴──────────┐   │
│  │         Provider Layer            │   │
│  │  database · stateStore · queue    │   │
│  │  storage · observability          │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Provider Dependencies

| Provider | Usage |
|----------|-------|
| database | Persist agent definitions, embeddings metadata, RAG collections |
| stateStore | Cache LLM responses, track agent execution state |
| queue | Asynchronous agent task dispatch |
| storage | Store indexed documents, embedding data |
| observability | Log inference requests, trace agent workflows |

---

## Services

| Service | Methods | Description |
|---------|---------|-------------|
| LLMService | complete, chat, stream, listModels | Large language model orchestration |
| AgentService | create, execute, getResult, listAgents | Autonomous agent lifecycle |
| EmbeddingService | embed, search, index, deleteIndex | Vector embedding and search |
| RAGService | index, query, deleteCollection, listCollections | Retrieval-augmented generation |

---

## Operational Modes

### Native Mode
- Template-based LLM responses with variable substitution
- Hash-based embedding vectors (deterministic, reproducible)
- In-memory cosine similarity search
- Local document storage and SQLite metadata

### Connected Mode
- External LLM API integration (OpenAI, Anthropic, etc.)
- Hosted embedding services (OpenAI, Cohere, etc.)
- Managed vector databases (Pinecone, Weaviate, etc.)
- Cloud storage for document persistence

### Hybrid Mode
- Mix native and external providers per capability
- Auto-fallback from external to native on failure

---

## Configuration

```bash
# Mode selection
CODEXVANTA_MODE=native|connected|hybrid

# Connected mode (optional)
AI_LLM_PROVIDER=openai|anthropic|native
AI_EMBEDDING_PROVIDER=openai|cohere|native
AI_VECTOR_DB=pinecone|weaviate|native
```

---

## Directory Structure

```
codexvanta-os-ai-engine/
├── REPO_MANIFEST.yaml
├── README.md
├── ARCHITECTURE.md
├── LICENSE
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.ts
│   ├── providers.ts
│   ├── types/
│   │   └── index.ts
│   └── services/
│       ├── index.ts
│       ├── llm.service.ts
│       ├── agent.service.ts
│       ├── embedding.service.ts
│       └── rag.service.ts
└── tests/
    └── index.test.ts
```

---

## Tier

**Tier 3** — Depends on core-kernel, data-pipeline

---

## Philosophy

> Third-party AI services are extension points, not foundational requirements.
> The platform can reason, search, and generate without any external API key.

---

## License

MIT — see LICENSE
