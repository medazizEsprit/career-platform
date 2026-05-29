"""
RAG retrieval — embeds CV, searches FAISS, reranks with Cohere.
Ported from nlp-v2.ipynb.
"""
from typing import List, Dict
import numpy as np
import faiss
import cohere

from app.config import COHERE_API_KEY, RERANK_MODEL, TOP_K_RETRIEVE, TOP_K_RERANK
from app.services.embeddings import cohere_embed

_co = cohere.Client(COHERE_API_KEY) if COHERE_API_KEY else None


def retrieve_top_jobs(
    cv_text: str,
    jobs: List[Dict],
    index,  # faiss.IndexFlatIP
    top_k: int = TOP_K_RETRIEVE,
) -> List[Dict]:
    """
    1. Embed CV as a search query.
    2. Search FAISS for top_k * 3 candidates.
    3. Rerank with Cohere reranker.
    4. Return top_k results with relevance_score attached.
    """
    if not jobs or index is None:
        return []

    # Step 1 — embed CV
    cv_emb = cohere_embed([cv_text[:2000]], input_type="search_query")
    faiss.normalize_L2(cv_emb)

    # Step 2 — FAISS search
    fetch_k = min(top_k * 3, len(jobs))
    scores, indices = index.search(cv_emb, fetch_k)

    candidates = []
    candidate_docs = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(jobs):
            continue
        job = dict(jobs[idx])
        job["faiss_score"] = float(score)
        candidates.append(job)
        candidate_docs.append(f"Title: {job['title']}\n{job['description'][:500]}")

    if not candidates:
        return []

    # Step 3 — Cohere rerank
    if _co and len(candidates) > 1:
        try:
            result = _co.rerank(
                model=RERANK_MODEL,
                query=cv_text[:1000],
                documents=candidate_docs,
                top_n=min(top_k, len(candidates)),
            )
            reranked = []
            for r in result.results:
                job = dict(candidates[r.index])
                job["relevance_score"] = round(r.relevance_score, 3)
                reranked.append(job)
            return reranked
        except Exception:
            pass  # Fall back to FAISS scores

    # Fallback — return FAISS top-k
    for c in candidates:
        c["relevance_score"] = c.get("faiss_score", 0.0)
    return candidates[:top_k]
