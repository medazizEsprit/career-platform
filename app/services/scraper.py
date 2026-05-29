"""
Job Scrapers — ported from nlp-v2.ipynb.
Pulls from JSearch (LinkedIn/Indeed), Remotive, Jobicy, We Work Remotely, Findwork.
"""
import re
import html
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict

import requests
import numpy as np
import cohere

from app.config import (
    RAPIDAPI_KEY, FINDWORK_API_KEY, COHERE_API_KEY,
    EMBED_MODEL, SEMANTIC_THRESHOLD, MAX_DESC_CHARS,
)

# ── Shared HTTP headers ────────────────────────────────────────────────────────
_H = {"User-Agent": "CareerCoachApp/1.0", "Accept": "application/json, text/html, */*"}

# Cohere client (module-level singleton)
_co = cohere.Client(COHERE_API_KEY) if COHERE_API_KEY else None


# ── HTML cleaner ───────────────────────────────────────────────────────────────
def _clean(text: str) -> str:
    if not text:
        return ""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator=" ")
    except ImportError:
        text = re.sub(r"<[^>]+>", " ", html.unescape(text))
    return re.sub(r"\s+", " ", text).strip()


# ── Individual scrapers ────────────────────────────────────────────────────────

def _fetch_jsearch(query: str, location: str, n: int) -> List[Dict]:
    if not RAPIDAPI_KEY:
        return []
    url = "https://jsearch.p.rapidapi.com/search"
    headers = {**_H, "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"}
    params = {"query": f"{query} {location}".strip(), "num_pages": 1, "page": 1, "results_per_page": min(n, 10)}
    data = requests.get(url, headers=headers, params=params, timeout=15).json()
    out = []
    for item in data.get("data", [])[:n]:
        out.append({
            "title":       item.get("job_title", "Unknown"),
            "company":     item.get("employer_name", "Unknown"),
            "location":    f"{item.get('job_city','')} {item.get('job_country','')}".strip() or "Remote",
            "description": item.get("job_description", "")[:MAX_DESC_CHARS],
            "source":      "LinkedIn/Indeed",
        })
    return out


def _fetch_remotive(query: str, n: int) -> List[Dict]:
    url = "https://remotive.com/api/remote-jobs"
    params = {"category": "software-dev", "limit": min(n, 100), "search": query}
    resp = requests.get(url, params=params, timeout=12, headers=_H)
    resp.raise_for_status()
    out = []
    for item in resp.json().get("jobs", [])[:n]:
        out.append({
            "title":       item.get("title", "Unknown"),
            "company":     item.get("company_name", "Unknown"),
            "location":    item.get("candidate_required_location", "Remote"),
            "description": _clean(item.get("description", ""))[:MAX_DESC_CHARS],
            "source":      "Remotive",
        })
    return out


def _fetch_jobicy(query: str, n: int) -> List[Dict]:
    url = "https://jobicy.com/api/v2/remote-jobs"
    params = {"count": min(n, 50), "industry": "engineering", "tag": query}
    resp = requests.get(url, params=params, timeout=12, headers=_H)
    resp.raise_for_status()
    out = []
    for item in resp.json().get("jobs", [])[:n]:
        out.append({
            "title":       item.get("jobTitle", "Unknown"),
            "company":     item.get("companyName", "Unknown"),
            "location":    item.get("jobGeo", "Remote"),
            "description": _clean(item.get("jobDescription", ""))[:MAX_DESC_CHARS],
            "source":      "Jobicy",
        })
    return out


def _fetch_wwr(query: str, n: int) -> List[Dict]:
    r = requests.get("https://weworkremotely.com/remote-jobs.rss", timeout=18, headers=_H)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    qw = query.lower().split()
    out = []
    for item in root.iter("item"):
        t = item.find("title")
        d = item.find("description")
        if t is None:
            continue
        raw = html.unescape(t.text or "")
        company, title = raw.split(": ", 1) if ": " in raw else ("Unknown", raw)
        desc = _clean(d.text or "" if d is not None else "")
        if not any(w in f"{title} {desc}".lower() for w in qw):
            continue
        out.append({
            "title":       title.strip(),
            "company":     company.strip(),
            "location":    "Remote",
            "description": desc[:MAX_DESC_CHARS],
            "source":      "We Work Remotely",
        })
        if len(out) >= n:
            break
    return out


def _fetch_findwork(query: str, n: int) -> List[Dict]:
    if not FINDWORK_API_KEY:
        return []
    url = "https://findwork.dev/api/jobs/"
    params = {"search": query, "remote": "true", "order_by": "relevance"}
    headers = {**_H, "Authorization": f"Token {FINDWORK_API_KEY}"}
    resp = requests.get(url, params=params, headers=headers, timeout=12)
    resp.raise_for_status()
    out = []
    for item in resp.json().get("results", [])[:n]:
        keywords = ", ".join(item.get("keywords", []))
        out.append({
            "title":       item.get("role", "Unknown"),
            "company":     item.get("name", "Unknown"),
            "location":    item.get("location", "Remote"),
            "description": _clean(f"{item.get('text', '')} Required skills: {keywords}")[:MAX_DESC_CHARS],
            "source":      "Findwork",
        })
    return out


# ── Semantic filter ────────────────────────────────────────────────────────────

def _semantic_filter(jobs: List[Dict], threshold: float) -> List[Dict]:
    if not jobs or not _co:
        return jobs

    anchor = (
        "This is a technology, IT, software engineering, web development, coding, "
        "data science, AI/ML, DevOps, cybersecurity, tech product management, or UI/UX design job."
    )
    job_texts = [f"Title: {j['title']}\nDescription: {j['description'][:500]}" for j in jobs]
    all_texts = [anchor] + job_texts
    all_embeddings = []

    for i in range(0, len(all_texts), 96):
        batch = all_texts[i : i + 96]
        response = _co.embed(
            texts=batch,
            model=EMBED_MODEL,
            input_type="search_document",
            truncate="END",
        )
        all_embeddings.extend(response.embeddings)

    embeddings = np.array(all_embeddings, dtype="float32")
    ref = embeddings[0] / np.linalg.norm(embeddings[0])
    valid = []
    for job, emb in zip(jobs, embeddings[1:]):
        norm_emb = emb / np.linalg.norm(emb)
        score = float(np.dot(ref, norm_emb))
        if score >= threshold:
            job["semantic_score"] = round(score, 3)
            valid.append(job)
    return valid


# ── Main entry point ───────────────────────────────────────────────────────────

def search_jobs(
    query: str,
    location: str = "",
    limit: int = 15,
    semantic_threshold: float = SEMANTIC_THRESHOLD,
) -> List[Dict]:
    """
    Scrape from all sources concurrently, deduplicate, semantically filter, return.
    """
    fetch_n = limit * 4
    sources = [
        ("LinkedIn/Indeed",  lambda: _fetch_jsearch(query, location, fetch_n)),
        ("Remotive",         lambda: _fetch_remotive(query, fetch_n)),
        ("Jobicy",           lambda: _fetch_jobicy(query, fetch_n)),
        ("We Work Remotely", lambda: _fetch_wwr(query, fetch_n)),
        ("Findwork",         lambda: _fetch_findwork(query, fetch_n)),
    ]

    pool = []
    logs = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_map = {executor.submit(fn): name for name, fn in sources}
        for future in as_completed(future_map):
            name = future_map[future]
            try:
                jobs = future.result()
                pool.extend(jobs)
                logs.append({"source": name, "count": len(jobs), "ok": True})
            except Exception as e:
                logs.append({"source": name, "error": str(e), "ok": False})

    # Deduplicate
    seen, unique = set(), []
    for job in pool:
        key = (
            (job.get("title") or "").lower().strip()[:40],
            (job.get("company") or "").lower().strip()[:40],
        )
        if key not in seen:
            seen.add(key)
            unique.append(job)

    # Quality filter
    unique = [j for j in unique if j.get("title", "Unknown") != "Unknown"]
    unique = [j for j in unique if len(j.get("description", "")) > 100]

    # Semantic filter
    filtered = _semantic_filter(unique, threshold=semantic_threshold)

    return {
        "jobs":  filtered[:limit],
        "logs":  logs,
        "stats": {
            "raw":      len(pool),
            "deduped":  len(unique),
            "filtered": len(filtered),
            "returned": len(filtered[:limit]),
        },
    }
