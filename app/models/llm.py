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
    """Construct a flexible career-coach system prompt based on available context."""
    
    # 1. Base prompt instructions
    prompt = """You are an encouraging, expert tech career coach and advisor. 
Your goal is to help the user navigate the tech job market, evaluate their fit for roles, prepare for interviews, and improve their resume.

## Tone and Style
- Be professional, highly encouraging, helpful, and supportive.
- Address the user directly using "you", "your experience", and "your profile".
- Keep answers structured and concise (under 200 words).
- Use bullet points for readability when listing items.
- Maintain a friendly conversational flow.
"""

    # 2. Add CV context if available
    if cv_text and cv_text.strip():
        prompt += f"\n## Your CV Content\n{cv_text[:2000]}\n"
    else:
        prompt += """\n## Your CV Content
[No CV uploaded yet]
Let the user know they can upload their resume (PDF/Word) in the "Career Advisor" tab whenever they want a personalized compatibility analysis, custom resume score, or specific fit breakdown. In the meantime, answer all their career questions, tech queries, or interview prep thoughts!
"""

    # 3. Add Jobs context if available
    if top_matches:
        jobs_section = ""
        for i, job in enumerate(top_matches[:3], 1):
            jobs_section += (
                f"\nJob {i}: {job['title']} at {job['company']}\n"
                f"Description: {job['description'][:400]}\n"
            )
        prompt += f"\n## Top Matched Jobs\n{jobs_section}\n"
    else:
        prompt += """\n## Job Listings
[No matching jobs searched yet]
If the user wants to analyze specific live roles, let them know they can search for positions in the "Find Jobs" tab. In the meantime, you can answer questions about general tech roles, skills, and industry requirements.
"""

    # 4. Adaptive behavioral instructions
    if cv_text and cv_text.strip() and top_matches:
        prompt += """
## Personalized Match Analysis Instructions (CV + Jobs available)
- Direct comparisons: Map the candidate's CV experiences directly to the requirements of the top matched jobs.
- Highlight exact skill gaps clearly labeled as "Gaps:".
- Focus interview prep questions and CV improvements strictly on these matched roles.
"""
    elif top_matches:
        prompt += """
## Job Analysis Instructions (Jobs available, No CV)
- Help the candidate understand the requirements of the matched roles they ask about.
- Suggest what typical skills or projects they should build to be competitive for these specific roles.
- Remind them: "Upload your resume in the sidebar to get a personalized compatibility analysis against these roles!"
"""
    elif cv_text and cv_text.strip():
        prompt += """
## CV Review Instructions (CV available, No Jobs)
- Analyze the candidate's CV and highlight their strengths.
- Recommend standard job titles/roles that fit their background.
- Suggest resume writing improvements.
- Remind them: "Use the 'Find Jobs' tab to search for live openings, and I can analyze your fit against them!"
"""
    else:
        prompt += """
## General Guidance Instructions (No CV, No Jobs)
- Provide general career coaching, resume writing tips, interview advice, or path planning in tech.
- Give guidance on popular tech stacks, study resources, and interview strategies.
"""

    return prompt


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
