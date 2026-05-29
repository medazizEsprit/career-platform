"""Jobs router — POST /api/search-jobs (auto-chains index + retrieve if CV is present)"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.scraper import search_jobs
from app.services.embeddings import build_faiss_index
from app.services.rag import retrieve_top_jobs
from app.state import state
from app.config import SEMANTIC_THRESHOLD, DEFAULT_LIMIT, TOP_K_RETRIEVE

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    location: Optional[str] = ""


@router.post("/search-jobs")
async def search_jobs_endpoint(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Please enter a role or skill to search for.")

    # 1. Scrape jobs
    result = search_jobs(
        query=req.query,
        location=req.location or "",
        limit=DEFAULT_LIMIT,
        semantic_threshold=SEMANTIC_THRESHOLD,
    )

    state.jobs = result["jobs"]
    state.index = None
    state.job_embeddings = None
    state.top_matches = []
    state.pipeline_stage = "jobs_scraped"

    # 2. Auto-build FAISS index
    if state.jobs:
        try:
            descriptions = [j.get("description", "") for j in state.jobs]
            index, embeddings = build_faiss_index(descriptions)
            state.index = index
            state.job_embeddings = embeddings
            state.pipeline_stage = "indexed"
        except Exception:
            pass  # Non-fatal — user can still browse jobs

    # 3. Auto-retrieve matches if CV already uploaded
    if state.cv_text and state.index is not None:
        try:
            matches = retrieve_top_jobs(
                cv_text=state.cv_text,
                jobs=state.jobs,
                index=state.index,
                top_k=TOP_K_RETRIEVE,
            )
            state.top_matches = matches
            state.pipeline_stage = "ready"
        except Exception:
            pass

    return {
        "ok": True,
        "jobs": result["jobs"],
        "matches": state.top_matches,
        "stats": result["stats"],
        "status": state.to_status(),
    }


@router.post("/retrieve-jobs")
async def retrieve_jobs_endpoint():
    """Re-run matching after CV is uploaded post-search."""
    if not state.cv_text:
        raise HTTPException(status_code=400, detail="Please upload your resume first.")
    if state.index is None:
        raise HTTPException(status_code=400, detail="Please search for jobs first.")

    matches = retrieve_top_jobs(
        cv_text=state.cv_text,
        jobs=state.jobs,
        index=state.index,
        top_k=TOP_K_RETRIEVE,
    )
    state.top_matches = matches
    state.pipeline_stage = "ready"

    return {
        "ok": True,
        "matches": matches,
        "status": state.to_status(),
    }
