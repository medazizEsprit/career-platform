"""
Global in-memory application state.
Holds the scraped jobs, FAISS index, CV text, and top retrieved matches.
"""
from typing import List, Dict, Optional
import numpy as np

class AppState:
    def __init__(self):
        self.cv_text: str = ""
        self.cv_filename: str = ""
        self.jobs: List[Dict] = []
        self.index = None          # faiss.IndexFlatIP
        self.job_embeddings: Optional[np.ndarray] = None
        self.top_matches: List[Dict] = []
        self.pipeline_stage: str = "idle"  # idle | cv_loaded | jobs_scraped | indexed | ready

    def reset_jobs(self):
        self.jobs = []
        self.index = None
        self.job_embeddings = None
        self.top_matches = []
        self.pipeline_stage = "cv_loaded" if self.cv_text else "idle"

    def to_status(self) -> Dict:
        return {
            "stage": self.pipeline_stage,
            "cv_loaded": bool(self.cv_text),
            "cv_filename": self.cv_filename,
            "jobs_count": len(self.jobs),
            "index_built": self.index is not None,
            "top_matches_count": len(self.top_matches),
        }

# Singleton
state = AppState()
