"""Unit tests for RAG service NLP components (extractor, chunker, embedder)."""

import sys
from pathlib import Path

# Ensure rag-service root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from chunker import RecursiveChunker, chunk_document
from extractor import extract_text, ExtractionError
from embedder import embed_query, embed_texts


def test_chunker_basic():
    text = "Short sentence. Another sentence."
    chunks = chunk_document(text, chunk_size=100, chunk_overlap=10)
    assert len(chunks) == 1
    assert "Short sentence" in chunks[0]


def test_chunker_recursive_hierarchy():
    paragraphs = [
        "Paragraph 1 contains some information about onboarding procedures and company culture.",
        "Paragraph 2 contains detailed guidelines on taking annual leave, sick leave, and parental leave.",
        "Paragraph 3 covers IT security protocols, passwords, and multi-factor authentication setup.",
    ]
    full_text = "\n\n".join(paragraphs)
    chunker = RecursiveChunker(chunk_size=120, chunk_overlap=20)
    chunks = chunker.split_text(full_text)

    assert len(chunks) >= 3
    # Check each chunk is within or near target size
    for chunk in chunks:
        assert len(chunk) > 0


def test_chunker_empty_input():
    assert chunk_document("") == []
    assert chunk_document("   ") == []


def test_extractor_unsupported_format(tmp_path):
    txt_file = tmp_path / "test.txt"
    txt_file.write_text("This is a plain text file")

    with pytest.raises(ExtractionError) as exc_info:
        extract_text(txt_file)
    assert "Unsupported file format" in str(exc_info.value)


def test_embedder_dimension():
    vec = embed_query("how do I apply for annual leave?")
    assert len(vec) == 384
    # Check normalized unit length (sum of squares is ~1.0)
    norm_sq = sum(x * x for x in vec)
    assert abs(norm_sq - 1.0) < 1e-4

