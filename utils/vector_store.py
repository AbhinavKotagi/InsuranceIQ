"""
utils/vector_store.py
Manages ChromaDB vector collections for each uploaded insurance policy.
Uses sentence-transformers (all-MiniLM-L6-v2) for embedding generation.
"""

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict
import hashlib


# ─── Singleton embedding model (loaded once) ──────────────────────────────────
_embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    """Return a cached SentenceTransformer model."""
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


class VectorStore:
    """
    Wrapper around ChromaDB that stores one collection per insurance policy.
    Supports adding, querying, and clearing policy embeddings.
    """

    def __init__(self, persist_dir: str = "chroma_db"):
        """
        Initialise the ChromaDB persistent client.

        Args:
            persist_dir: Directory where ChromaDB persists data.
        """
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self.model = get_embedding_model()
        self._collections: Dict[str, chromadb.Collection] = {}

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _sanitize_name(self, name: str) -> str:
        """Make a valid ChromaDB collection name (alphanumeric + underscores)."""
        import re
        safe = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
        return safe[:63]  # ChromaDB max collection name length

    def _embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of text strings."""
        return self.model.encode(texts, show_progress_bar=False).tolist()

    # ── Public API ────────────────────────────────────────────────────────────

    def add_policy(self, policy_name: str, chunks: List[str]) -> None:
        """
        Create (or recreate) a ChromaDB collection for a policy and
        store all text chunks as embeddings.

        Args:
            policy_name: Unique identifier for the policy.
            chunks: List of text chunks to index.
        """
        collection_name = self._sanitize_name(f"policy_{policy_name}")

        # Delete existing collection to avoid duplicates on re-upload
        try:
            self.client.delete_collection(collection_name)
        except Exception:
            pass

        collection = self.client.create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._collections[policy_name] = collection

        if not chunks:
            return

        # Generate embeddings in batches to avoid OOM on large docs
        batch_size = 64
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i: i + batch_size]
            embeddings = self._embed(batch)
            ids = [
                hashlib.md5(f"{policy_name}_{i+j}_{c[:30]}".encode()).hexdigest()
                for j, c in enumerate(batch)
            ]
            collection.add(
                documents=batch,
                embeddings=embeddings,
                ids=ids,
                metadatas=[{"policy": policy_name, "chunk_index": i + j}
                            for j in range(len(batch))],
            )

    def retrieve_context(self,
                         query: str,
                         policy_names: List[str],
                         top_k: int = 4) -> str:
        """
        Retrieve the most relevant chunks from all policy collections
        for a given query.

        Args:
            query: The question / search text.
            policy_names: List of policy names whose collections to search.
            top_k: Number of chunks to retrieve per policy.
        Returns:
            Concatenated context string with source labels.
        """
        query_embedding = self._embed([query])[0]
        context_parts = []

        for pname in policy_names:
            collection_name = self._sanitize_name(f"policy_{pname}")
            try:
                collection = self.client.get_collection(collection_name)
            except Exception:
                continue

            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count()),
                include=["documents"],
            )
            docs = results.get("documents", [[]])[0]
            if docs:
                context_parts.append(
                    f"=== {pname} ===\n" + "\n---\n".join(docs)
                )

        return "\n\n".join(context_parts) if context_parts else "No relevant context found."

    def clear_all(self) -> None:
        """Delete all collections from ChromaDB."""
        try:
            for col in self.client.list_collections():
                self.client.delete_collection(col.name)
        except Exception as e:
            print(f"[VectorStore] Error clearing collections: {e}")
        self._collections = {}
