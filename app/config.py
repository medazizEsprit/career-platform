import os
from dotenv import load_dotenv

load_dotenv(override=True)

COHERE_API_KEY   = os.getenv("COHERE_API", "")
RAPIDAPI_KEY     = os.getenv("RAPIDAPI_KEY", "")
FINDWORK_API_KEY = os.getenv("FINDWORK_API_KEY", "")
POWERBI_EMBED_URL = os.getenv("POWERBI_EMBED_URL", "")

# Cohere models
EMBED_MODEL   = "embed-multilingual-v3.0"
RERANK_MODEL  = "rerank-multilingual-v3.0"
CHAT_MODEL    = "command-r-plus"          # No GPU needed

# Scraping defaults
SEMANTIC_THRESHOLD = 0.38
DEFAULT_LIMIT      = 15
MAX_DESC_CHARS     = 2500

# RAG defaults
TOP_K_RETRIEVE  = 5
TOP_K_RERANK    = 3
