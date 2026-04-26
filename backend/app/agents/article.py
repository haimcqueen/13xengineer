"""ArticleAgent — runs a 4-step blog pipeline via Claude:
1. Brief (keyword strategy, search intent, competitor gaps)
2. Research (web search, data points, source hierarchy)
3. Outline (structure, headings, key points)
4. Write (full article in markdown)

Each step feeds into the next. Progress events are emitted per stage.
"""

import asyncio
import logging

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Action, Company
from app.services import jobs as jobs_svc
from app.services import tavily as tavily_svc

logger = logging.getLogger(__name__)

_BRIEF_SYSTEM = """\
You are an SEO/AEO strategist for a legal tech company. Generate a topic brief \
with keyword strategy, search intent analysis, competitor gaps, and content angle. \
Output in markdown with sections: Keywords, Search Intent, People Also Ask (5 questions), \
Competitor Gaps, Content Angle, Suggested Title. Be specific and data-driven."""

_RESEARCH_SYSTEM = """\
You are a legal industry researcher. Given a topic brief, produce deep research \
with real statistics, market data, expert quotes, and source citations. \
Include a competitor landscape table. Focus on Tier 1 sources (Thomson Reuters, \
McKinsey, Deloitte, ABA). Output in markdown with sections: Key Statistics, \
Market Context, Competitor Landscape, Expert Perspectives, Source List."""

_OUTLINE_SYSTEM = """\
You are a content architect. Given research, produce a detailed article outline \
with H2/H3 structure, key points per section, word count targets, and where to \
place tables, data callouts, and CTAs. Include a Quick Answer section for LLM \
citation and 5-7 FAQ questions. Output in markdown."""

_WRITE_SYSTEM = """\
You are an expert blog writer for a B2B legal tech company. Write the full article \
from the outline provided. Rules:
- 1,500-2,500 words in markdown
- H2 and H3 headings, bullet lists, tables where appropriate
- Compelling opening that addresses the reader's problem
- End with a clear takeaway, not a sales pitch
- Mention the company naturally 2-3 times, never forced
- Include 5-7 FAQ questions at the end as H3s
- Write like a domain expert, not a marketer
- No em dashes, no "not X, but Y" framing
- Every sentence should carry real insight
- Include markdown link references at the bottom"""


class ArticleAgent:
    kind = "article"

    async def run(self, action: Action, company: Company, **kwargs: object) -> dict:
        db: Session | None = kwargs.get("db")  # type: ignore[assignment]
        job_id: str | None = kwargs.get("job_id")  # type: ignore[assignment]

        title = action.title
        rationale = action.rationale or ""
        topic = (action.target or {}).get("topic", title)
        company_name = company.name
        domain = company.own_domain or ""

        if not settings.anthropic_api_key:
            logger.warning("No Anthropic API key, returning stub")
            return self._stub(action, company)

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        context = (
            f"Company: {company_name} ({domain})\n"
            f"Article title: {title}\n"
            f"Topic: {topic}\n"
            f"Context: {rationale}"
        )

        try:
            # Step 1: Brief
            self._emit(db, job_id, "Researching keywords & intent")
            brief = await self._call(client, _BRIEF_SYSTEM, (
                f"Create a topic brief for this article:\n\n{context}"
            ))

            # Step 2: Research — pull live web sources via Tavily, then have
            # Claude synthesize. Tavily failures fall through to Claude-only.
            self._emit(db, job_id, "Searching the web (Tavily)")
            tavily_query = f"{topic} {company_name} industry analysis 2025"
            tavily_search = await tavily_svc.search(tavily_query, max_results=6)
            if not tavily_search.is_empty:
                self._emit(
                    db,
                    job_id,
                    f"Found {len(tavily_search.results)} sources",
                )

            self._emit(db, job_id, "Deep research & data collection")
            web_block = tavily_search.to_prompt_block()
            research_user = (
                f"Research this topic deeply. Here is the brief:\n\n{brief}\n\n"
                f"Original context:\n{context}"
            )
            if web_block:
                research_user += (
                    f"\n\nLive web sources to cite where relevant "
                    f"(prefer these over generic claims):\n\n{web_block}"
                )
            research = await self._call(client, _RESEARCH_SYSTEM, research_user)

            # Step 3: Outline
            self._emit(db, job_id, "Structuring the article")
            outline = await self._call(client, _OUTLINE_SYSTEM, (
                f"Create a detailed article outline from this research:\n\n{research}\n\n"
                f"Brief:\n{brief}\n\nOriginal context:\n{context}"
            ))

            # Step 4: Write
            self._emit(db, job_id, "Writing the full article")
            article = await self._call(client, _WRITE_SYSTEM, (
                f"Write the full article from this outline:\n\n{outline}\n\n"
                f"Research:\n{research}\n\nBrief:\n{brief}\n\n"
                f"Original context:\n{context}"
            ))

            word_count = len(article.split())
            return {
                "type": "article",
                "title": title,
                "markdown": article,
                "word_count_estimate": word_count,
            }

        except Exception as e:
            logger.error("Article pipeline failed at stage: %s", e)
            return self._stub(action, company)

    async def _call(self, client: anthropic.AsyncAnthropic, system: str, user: str) -> str:
        response = await asyncio.wait_for(
            client.messages.create(
                model=settings.anthropic_model,
                max_tokens=4096,
                system=system,
                messages=[{"role": "user", "content": user}],
            ),
            timeout=120.0,
        )
        return response.content[0].text

    def _emit(self, db: Session | None, job_id: str | None, label: str) -> None:
        if db and job_id:
            jobs_svc.append_progress(db, job_id, "stage", {"label": label})

    def _stub(self, action: Action, company: Company) -> dict:
        topic = (action.target or {}).get("topic") or "your tracked topic"
        title = action.title
        markdown = (
            f"# {title}\n\n"
            f"_Draft article for {company.name}_\n\n"
            f"## Why this matters\n\n{action.rationale or 'High-impact content gap.'}\n\n"
            f"## Outline\n\n"
            f"1. Introduction to {topic}\n"
            f"2. The challenge {company.name} customers face\n"
            f"3. Step-by-step walkthrough\n"
            f"4. Pitfalls and edge cases\n"
            f"5. Closing call-to-action\n\n"
            f"---\n_Generated by MIDAS article agent (stub — no API key configured)._\n"
        )
        return {
            "type": "article",
            "title": title,
            "markdown": markdown,
            "word_count_estimate": 1200,
        }
