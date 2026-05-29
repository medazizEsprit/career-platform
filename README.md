---
title: Career Platform
emoji: 🎯
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
---

# TBD Jobs — AI Career Platform

An AI-powered job search engine, personal career advisor, and market dashboard.

## Key Features

1. **Market Overview**: Integrated Power BI dashboard for global job market analytics.
2. **Find Jobs**: Semantic, embedding-powered job search powered by FAISS and Cohere.
3. **Career Advisor**: Upload a resume (PDF/Word), get instant compatibility matching, and ask career/interview preparation questions to a RAG-powered advisor.

## Deployment Details (Hugging Face Docker)

This application is built with:
* **Backend**: FastAPI (Python)
* **Frontend**: HTML5, JS (Vanilla), CSS3 (with custom premium styling)
* **Vector Database**: FAISS (in-memory)
* **Models**: Cohere Embed & Chat
