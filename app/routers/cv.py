"""CV upload router — POST /api/upload-cv
Auto-triggers matching if jobs are already indexed.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.cv_parser import parse_cv
from app.services.rag import retrieve_top_jobs
from app.state import state
from app.config import TOP_K_RETRIEVE

router = APIRouter()


@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...)):
    allowed = {".pdf", ".docx"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    contents = await file.read()
    try:
        cv_text = parse_cv(contents, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    state.cv_text = cv_text
    state.cv_filename = file.filename
    state.pipeline_stage = "cv_loaded"
    state.top_matches = []

    # Auto-retrieve if jobs are already indexed
    if state.index is not None and state.jobs:
        try:
            matches = retrieve_top_jobs(
                cv_text=cv_text,
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
        "filename": file.filename,
        "char_count": len(cv_text),
        "preview": cv_text[:400],
        "matches": state.top_matches,
        "status": state.to_status(),
    }
