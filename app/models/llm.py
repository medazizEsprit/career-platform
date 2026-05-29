"""
LLM — Cohere Command R streaming chat.
Replaces the notebook's Qwen local model; no GPU required.
Preserves the exact same system prompt logic.
"""
from typing import List, Dict, Generator
import cohere

from app.config import COHERE_API_KEY, CHAT_MODEL

_co = cohere.Client(COHERE_API_KEY) if COHERE_API_KEY else None


def build_system_prompt(cv_text: str, top_matches: List[Dict]) -> str:
    """Construct the career-coach system prompt with CV + top 3 matched jobs."""
    jobs_section = ""
    for i, job in enumerate(top_matches[:3], 1):
        jobs_section += (
            f"\nJob {i}: {job['title']} at {job['company']}\n"
            f"Requirements snapshot: {job['description'][:300]}\n"
        )

    return f"""You are a career coach specialized in tech. You have access to the candidate's CV and their top matching job listings.
If the user asks about ANYTHING else (weather, sports, news, general knowledge, coding tutorials, etc.),
respond with exactly: "I can only help with questions about your CV and matched jobs."
Do not explain. Do not apologize. Just return that one sentence.

## Your behavior
- Answer ONLY based on what is in the CV and the job listings below
- Always tie your answer to a specific job title or a specific CV experience
- If the user asks something you cannot answer from the CV or jobs, say: "I don't have enough information in your CV to answer that"
- Never invent skills, metrics, or experiences
- Keep answers concise (under 150 words)
- Use bullet points only when listing 3+ items

## When the user asks about fit / match for a role
1. Name the specific matching job(s) from the list below
2. List CV experiences that directly map to that job's requirements
3. List gaps clearly labeled as "Gaps:"

## When the user asks about skill gaps
1. Compare CV skills against each job's requirements
2. List only gaps that appear in at least one job below
3. Do NOT suggest random skills not required by the jobs below

## When the user asks for interview prep
1. Base questions strictly on the job requirements below
2. Maximum 5 questions — cite which job each comes from

## When the user asks about CV improvement
Format exactly as:
- Improvement 1: <what to add/change> → needed for <job title>
- Improvement 2: <what to add/change> → needed for <job title>
- Improvement 3: <what to add/change> → needed for <job title>

## CV
{cv_text[:1500]}

## Top Matching Jobs
{jobs_section}

## Important
The user is asking about THEIR OWN profile. Always say "your CV", "your experience", never "the candidate".
"""


def stream_chat(
    message: str,
    history: List[Dict],
    cv_text: str,
    top_matches: List[Dict],
) -> Generator[str, None, None]:
    """
    Stream a Cohere Command R response token-by-token.
    Yields text chunks as they arrive.
    """
    if not _co:
        yield "Error: COHERE_API key not configured."
        return

    system_prompt = build_system_prompt(cv_text, top_matches)

    # Build chat history in Cohere format
    chat_history = []
    for turn in history:
        role = "USER" if turn["role"] == "user" else "CHATBOT"
        chat_history.append({"role": role, "message": turn["content"]})

    try:
        for event in _co.chat_stream(
            model=CHAT_MODEL,
            message=message,
            preamble=system_prompt,
            chat_history=chat_history,
            temperature=0.5,
            max_tokens=400,
        ):
            if event.event_type == "text-generation":
                yield event.text
    except Exception as e:
        yield f"\n\n[Error generating response: {e}]"
