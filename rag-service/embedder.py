"""Embedding generation module using sentence-transformers.

Uses self-hosted all-MiniLM-L6-v2 (384 dimensions) matching the PostgreSQL
pgvector vector(384) schema column. No external embedding API is called.
"""

from typing import Optional
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EXPECTED_DIMENSION = 384

_model_instance: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """Lazy-load and cache the SentenceTransformer embedding model."""
    global _model_instance
    if _model_instance is None:
        _model_instance = SentenceTransformer(MODEL_NAME)
    return _model_instance


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate normalized 384-dimensional embeddings for a list of text strings.
    
    Returns a list of float lists, each of length 384.
    """
    if not texts:
        return []

    model = get_embedding_model()
    # normalize_embeddings=True ensures inner product equals cosine similarity
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    result: list[list[float]] = []
    for vector in embeddings:
        vec_list = [float(x) for x in vector]
        if len(vec_list) != EXPECTED_DIMENSION:
            raise ValueError(
                f"Generated embedding dimension {len(vec_list)} does not match expected {EXPECTED_DIMENSION}"
            )
        result.append(vec_list)

    return result


def embed_query(query: str) -> list[float]:
    """Generate a single normalized 384-dimensional embedding for a query string."""
    if not query or not query.strip():
        raise ValueError("Query string cannot be empty")

    vectors = embed_texts([query.strip()])
    return vectors[0]
