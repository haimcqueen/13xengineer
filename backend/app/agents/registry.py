from app.agents.article import ArticleAgent
from app.agents.base import Agent
from app.agents.code_pr import CodePrAgent
from app.agents.improvement import ImprovementAgent
from app.agents.video import VideoAgent

REGISTRY: dict[str, type[Agent]] = {
    "article": ArticleAgent,
    "video": VideoAgent,
    "code-pr": CodePrAgent,
    "improvement": ImprovementAgent,
}


def get_agent(kind: str) -> Agent:
    cls = REGISTRY.get(kind)
    if cls is None:
        raise KeyError(f"unknown agent kind: {kind}")
    return cls()
