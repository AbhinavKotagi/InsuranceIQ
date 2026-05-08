"""
utils/pdf_processor.py
Handles PDF text extraction using PyMuPDF and text chunking using LangChain.
"""

import fitz  # PyMuPDF
import re
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract clean text from a PDF file using PyMuPDF.

    Args:
        pdf_path: Path to the PDF file.
    Returns:
        Cleaned concatenated text from all pages.
    """
    try:
        doc = fitz.open(pdf_path)
        all_text = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            # Extract text with layout preservation
            text = page.get_text("text")
            if text.strip():
                all_text.append(f"--- Page {page_num + 1} ---\n{text}")

        doc.close()
        raw_text = "\n".join(all_text)
        return clean_text(raw_text)

    except Exception as e:
        print(f"[PDF Processor] Error extracting {pdf_path}: {e}")
        return ""


def clean_text(text: str) -> str:
    """
    Remove noise from extracted PDF text.
    - Collapses excessive whitespace
    - Removes non-printable characters
    - Normalises line breaks
    """
    # Remove non-printable chars (but keep newlines)
    text = re.sub(r'[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]', ' ', text)
    # Collapse 3+ blank lines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove leading/trailing whitespace per line
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(lines)
    # Collapse multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def chunk_text(text: str,
               chunk_size: int = 1000,
               chunk_overlap: int = 200) -> List[str]:
    """
    Split extracted text into overlapping chunks using LangChain's
    RecursiveCharacterTextSplitter.

    Args:
        text: Full extracted text.
        chunk_size: Target size of each chunk in characters.
        chunk_overlap: Overlap between consecutive chunks.
    Returns:
        List of text chunks.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    chunks = splitter.split_text(text)
    # Filter out very short chunks (likely noise)
    chunks = [c for c in chunks if len(c.strip()) > 50]
    return chunks
