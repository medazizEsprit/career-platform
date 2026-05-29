"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import cv, jobs, chat
from app.state import state
from app.config import POWERBI_EMBED_URL

app = FastAPI(title="Career Platform", version="2.0.0")

# ── API routers ────────────────────────────────────────────────────────────────
app.include_router(cv.router,   prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/status")
async def get_status():
    return state.to_status()


@app.get("/api/config")
async def get_config():
    """Expose non-sensitive config to the frontend."""
    return {
        "powerbi_embed_url": POWERBI_EMBED_URL,
    }


# ── Serve frontend static files ────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


# ── Dev runner ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
