"""RAG pipeline — placeholder for Phase 2.

Phase 1: stub that returns messages unchanged.
Phase 2: embed → pgvector search → rerank → inject context.
"""
from typing import Any


async def augment_with_rag(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Augment the last user message with relevant document context."""
    # Phase 2 implementation:
    # 1. Extract last user query
    # 2. Embed with local model (nomic-embed-text via Ollama)
    # 3. pgvector similarity search (top-k chunks)
    # 4. Rerank with cross-encoder
    # 5. Inject retrieved context into system prompt
    return messages


async def ingest_document(path: str, collection: str = "default") -> int:
    """Chunk and embed a document into pgvector. Returns chunk count."""
    # Phase 2 implementation:
    # 1. Load file (PDF, TXT, MD, DOCX)
    # 2. Chunk with overlap
    # 3. Embed each chunk
    # 4. Upsert to pgvector with metadata
    raise NotImplementedError("RAG ingest available in Phase 2")
