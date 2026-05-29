"""
Embeddings & FAISS index — Cohere multilingual embeddings + FAISS IndexFlatIP.
Ported from nlp-v2.ipynb.
"""
from typing import List
import numpy as np
import faiss
import cohere

from app.config import COHERE_API_KEY, EMBED_MODEL

_co = cohere.Client(COHERE_API_KEY) if COHERE_API_KEY else None


def cohere_embed(texts: List[str], input_type: str = "search_document") -> np.ndarray:
    """
    Embed a list of texts via Cohere multilingual model.
    input_type: 'search_document' for jobs, 'search_query' for CV.
    Batched at 96 to respect Cohere API limits.
    """
    if not _co:
        raise RuntimeError("COHERE_API key not set.")

    all_embeddings = []
    for i in range(0, len(texts), 96):
        batch = texts[i : i + 96]
        response = _co.embed(
            texts=batch,
            model=EMBED_MODEL,
            input_type=input_type,
            truncate="END",
        )
        all_embeddings.extend(response.embeddings)
    return np.array(all_embeddings, dtype="float32")


def build_faiss_index(job_descriptions: List[str]) -> tuple:
    """
    Embed job descriptions and build a normalised FAISS flat inner-product index.
    Returns (index, embeddings).
    """
    embeddings = cohere_embed(job_descriptions, input_type="search_document")
    faiss.normalize_L2(embeddings)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    return index, embeddings
