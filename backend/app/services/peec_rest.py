import asyncio
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class PeecError(Exception):
    """Raised when Peec returns an unrecoverable error."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


_RETRY_STATUS = {500, 502, 503, 504}
_NO_RETRY_STATUS = {400, 401, 403, 404}


class PeecRestClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: httpx.Timeout | None = None,
    ):
        self._api_key = api_key or settings.peec_api_key
        self._base_url = (base_url or settings.peec_api_base).rstrip("/")
        self._timeout = timeout or httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "PeecRestClient":
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout,
            headers={"x-api-key": self._api_key},
        )
        return self

    async def __aexit__(self, *_) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return await self._request("GET", path, params=params)

    async def _post(self, path: str, body: dict[str, Any]) -> Any:
        return await self._request("POST", path, json_body=body)

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> Any:
        assert self._client is not None, "Use 'async with PeecRestClient() as client'"
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = await self._client.request(
                    method, path, params=params, json=json_body
                )
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                last_exc = e
                logger.warning(
                    "peec network error on %s %s (attempt %d): %s",
                    method, path, attempt + 1, e,
                )
                await asyncio.sleep(0.5 * (2**attempt))
                continue

            if resp.status_code in _NO_RETRY_STATUS:
                raise PeecError(
                    f"{method} {path} -> {resp.status_code}: {resp.text[:200]}",
                    status_code=resp.status_code,
                )
            if resp.status_code in _RETRY_STATUS:
                logger.warning(
                    "peec %d on %s %s (attempt %d)",
                    resp.status_code, method, path, attempt + 1,
                )
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            resp.raise_for_status()
            return resp.json()

        raise PeecError(
            f"{method} {path} failed after 3 attempts: {last_exc}",
            status_code=None,
        )

    async def list_projects(self) -> list[dict]:
        data = await self._get("/projects")
        return data.get("data", [])

    async def get_prompts(self, project_id: str) -> dict:
        return await self._get("/prompts", params={"project_id": project_id})

    async def get_brands(self, project_id: str) -> dict:
        return await self._get("/brands", params={"project_id": project_id})

    async def get_topics(self, project_id: str) -> dict:
        return await self._get("/topics", params={"project_id": project_id})

    async def get_tags(self, project_id: str) -> dict:
        return await self._get("/tags", params={"project_id": project_id})

    async def get_models(self, project_id: str) -> dict:
        return await self._get("/models", params={"project_id": project_id})

    # ---- Reports (analytics) ----------------------------------------------

    async def get_brand_report(
        self,
        project_id: str,
        start_date: str,
        end_date: str,
        dimensions: list[str] | None = None,
        filters: list[dict] | None = None,
        limit: int = 50,
    ) -> dict:
        body: dict[str, Any] = {
            "project_id": project_id,
            "start_date": start_date,
            "end_date": end_date,
            "limit": limit,
        }
        if dimensions:
            body["dimensions"] = dimensions
        if filters:
            body["filters"] = filters
        return await self._post("/reports/brands", body)

    async def get_domain_report(
        self,
        project_id: str,
        start_date: str,
        end_date: str,
        limit: int = 30,
        filters: list[dict] | None = None,
    ) -> dict:
        body: dict[str, Any] = {
            "project_id": project_id,
            "start_date": start_date,
            "end_date": end_date,
            "limit": limit,
            "order_by": [{"field": "retrieval_count", "direction": "desc"}],
        }
        if filters:
            body["filters"] = filters
        return await self._post("/reports/domains", body)

    async def get_url_report(
        self,
        project_id: str,
        start_date: str,
        end_date: str,
        limit: int = 30,
    ) -> dict:
        body = {
            "project_id": project_id,
            "start_date": start_date,
            "end_date": end_date,
            "limit": limit,
            "order_by": [{"field": "retrieval_count", "direction": "desc"}],
        }
        return await self._post("/reports/urls", body)
