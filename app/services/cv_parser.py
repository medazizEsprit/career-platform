"""
CV Parser — extracts and cleans text from PDF or DOCX files.
Ported directly from nlp-v2.ipynb with improvements for robustness.
"""
import re
import unicodedata
import os
from io import BytesIO

import docx
import pymupdf as fitz


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extract raw text from uploaded file bytes (PDF or DOCX)."""
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".docx":
        doc = docx.Document(BytesIO(file_bytes))
        return "\n".join(para.text for para in doc.paragraphs)

    elif ext == ".pdf":
        pdf = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page in pdf:
            pages.append(page.get_text())
        pdf.close()
        return "\n".join(pages)

    else:
        raise ValueError(f"Unsupported file type: {ext}. Only PDF and DOCX are supported.")


def clean_cv_text(text: str) -> str:
    """Normalize and clean raw CV text."""
    # Fix encoding artifacts
    text = unicodedata.normalize("NFKC", text)
    # Remove control characters
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)
    # Remove lone page numbers
    text = re.sub(r"^\s*\d{1,3}\s*$", "", text, flags=re.MULTILINE)
    # Remove decorative separator lines
    text = re.sub(r"^[\s\-_=|•·.★✓✗▪▸►>+*~]{1,}$", "", text, flags=re.MULTILINE)
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_cv(file_bytes: bytes, filename: str) -> str:
    """Full pipeline: extract + clean. Returns cleaned CV text."""
    raw = extract_text_from_bytes(file_bytes, filename)
    return clean_cv_text(raw)
