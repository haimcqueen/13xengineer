from typing import Protocol

from app.models import Action, Company


class Agent(Protocol):
    kind: str

    async def run(self, action: Action, company: Company, **kwargs: object) -> dict:
        """Produce the agent's deliverable as a JSON-serializable dict.

        Implementations may accept extra keyword arguments (e.g. `db`, `job_id`,
        `improvement_job_id`) — the router passes them by name when relevant.
        """
