"""Recursive text chunking module.

A lightweight, dependency-free recursive character text splitter.
Splits text hierarchically across natural boundaries (paragraphs, sentences, words).
"""

from typing import Optional


class RecursiveChunker:
    """Recursively splits text into chunks of maximum size with a defined overlap."""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        separators: Optional[list[str]] = None,
    ):
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", " ", ""]

    def _split_text_with_separator(self, text: str, separator_idx: int) -> list[str]:
        """Recursively split text using the separator at separator_idx."""
        if len(text) <= self.chunk_size or separator_idx >= len(self.separators):
            return [text.strip()] if text.strip() else []

        sep = self.separators[separator_idx]

        if sep == "":
            # Character fallback when no separator fits
            return [
                text[i : i + self.chunk_size]
                for i in range(0, len(text), self.chunk_size - self.chunk_overlap)
            ]

        splits = text.split(sep)
        result: list[str] = []

        current_chunk: list[str] = []
        current_len = 0

        for split in splits:
            split_str = split.strip()
            if not split_str:
                continue

            # If a single split exceeds chunk_size, recursively split it with the next separator
            if len(split_str) > self.chunk_size:
                # Flush existing buffer
                if current_chunk:
                    joined = sep.join(current_chunk).strip()
                    if joined:
                        result.append(joined)
                    current_chunk = []
                    current_len = 0

                deeper_splits = self._split_text_with_separator(split_str, separator_idx + 1)
                result.extend(deeper_splits)
                continue

            sep_len = len(sep) if current_chunk else 0
            if current_len + sep_len + len(split_str) <= self.chunk_size:
                current_chunk.append(split_str)
                current_len += sep_len + len(split_str)
            else:
                if current_chunk:
                    joined = sep.join(current_chunk).strip()
                    if joined:
                        result.append(joined)

                # Keep overlap if possible
                overlap_text = current_chunk[-1] if current_chunk and len(current_chunk[-1]) <= self.chunk_overlap else ""
                if overlap_text and len(overlap_text) + len(sep) + len(split_str) <= self.chunk_size:
                    current_chunk = [overlap_text, split_str]
                    current_len = len(overlap_text) + len(sep) + len(split_str)
                else:
                    current_chunk = [split_str]
                    current_len = len(split_str)

        if current_chunk:
            joined = sep.join(current_chunk).strip()
            if joined:
                result.append(joined)

        return result

    def split_text(self, text: str) -> list[str]:
        """Split text into chunks of maximum size with overlap."""
        if not text or not text.strip():
            return []

        clean_text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
        raw_chunks = self._split_text_with_separator(clean_text, 0)

        # Filter out empty or duplicate trailing fragments
        final_chunks: list[str] = []
        for c in raw_chunks:
            stripped = c.strip()
            if stripped and (not final_chunks or final_chunks[-1] != stripped):
                final_chunks.append(stripped)

        return final_chunks


def chunk_document(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[str]:
    """Convenience helper to split document text into chunks."""
    chunker = RecursiveChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return chunker.split_text(text)
