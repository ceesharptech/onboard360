"""FastAPI RAG Microservice for HR Onboarding Platform.

Provides text extraction, recursive chunking, and sentence-transformers embedding generation.
Exposes internal endpoints consumed exclusively by the Express backend.
No LLM or Groq generation calls exist in this phase (Phase 3: retrieval only).
"""

import logging
from pathlib import Path
from typing import Optional, Union

from fastapi import FastAPI, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from extractor import extract_text, ExtractionError
from chunker import chunk_document
from embedder import embed_texts, embed_query

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("rag_service")

app = FastAPI(
    title="RAG Microservice - HR Onboarding Platform",
    description="NLP processing, text extraction, chunking, and embedding generation",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessFileRequest(BaseModel):
    file_path: str = Field(..., description="Absolute or relative path to the document file")
    filename: Optional[str] = Field(None, description="Original filename for format detection")


class ChunkResponse(BaseModel):
    content: str
    chunk_index: int
    embedding: list[float]


class ProcessFileResponse(BaseModel):
    filename: str
    total_chunks: int
    chunks: list[ChunkResponse]


class EmbedRequest(BaseModel):
    text: Optional[str] = Field(None, description="Single text string to embed")
    texts: Optional[list[str]] = Field(None, description="Batch of texts to embed")


class EmbedResponse(BaseModel):
    embedding: Optional[list[float]] = None
    embeddings: Optional[list[list[float]]] = None


@app.get("/health")
def health_check():
    """Health check endpoint for service liveness."""
    return {"status": "ok", "service": "rag-service"}


@app.post("/process-file", response_model=ProcessFileResponse)
def process_file(request: ProcessFileRequest):
    """Extract text from a document, chunk it recursively, and generate embeddings."""
    logger.info("Processing file: %s (filename: %s)", request.file_path, request.filename)

    file_path = Path(request.file_path)
    if not file_path.exists():
        logger.error("File does not exist at path: %s", request.file_path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found at path: {request.file_path}",
        )

    try:
        extracted_text = extract_text(file_path, filename=request.filename)
    except ExtractionError as exc:
        logger.warning("Extraction failed for %s: %s", request.file_path, str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error extracting text from %s", request.file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(exc)}",
        ) from exc

    # Chunk the extracted text using recursive chunker
    raw_chunks = chunk_document(extracted_text, chunk_size=500, chunk_overlap=50)
    if not raw_chunks:
        logger.warning("Chunking returned 0 chunks for %s", request.file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document contained no usable text chunks after processing",
        )

    logger.info("Generated %d chunks. Computing embeddings...", len(raw_chunks))

    try:
        embeddings = embed_texts(raw_chunks)
    except Exception as exc:
        logger.exception("Failed to generate embeddings for %s", request.file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute embeddings: {str(exc)}",
        ) from exc

    chunk_objects: list[ChunkResponse] = []
    for idx, (content, emb) in enumerate(zip(raw_chunks, embeddings)):
        chunk_objects.append(
            ChunkResponse(
                content=content,
                chunk_index=idx,
                embedding=emb,
            )
        )

    logger.info("Successfully processed %s into %d chunks", request.file_path, len(chunk_objects))
    return ProcessFileResponse(
        filename=request.filename or file_path.name,
        total_chunks=len(chunk_objects),
        chunks=chunk_objects,
    )


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    """Embed query text or a batch of texts using sentence-transformers all-MiniLM-L6-v2."""
    if request.text:
        query_vec = embed_query(request.text)
        return EmbedResponse(embedding=query_vec)
    elif request.texts is not None:
        batch_vecs = embed_texts(request.texts)
        return EmbedResponse(embeddings=batch_vecs)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'text' or 'texts' must be provided in request body",
        )
