from typing import Protocol

from app.models import Action, Company


class Agent(Protocol):
    kind: str

    async def run(self, action: Action, company: Company) -> dict:
        """Produce the agent's deliverable as a JSON-serializable dict."""
