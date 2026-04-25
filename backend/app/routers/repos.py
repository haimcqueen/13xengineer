"""Per-company repo configuration: where to clone from, where to push to,
and the credential to use. One row per company."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Company, RepoConfig
from app.schemas import RepoConfigIn, RepoConfigOut

router = APIRouter()


def _validate_input(body: RepoConfigIn) -> None:
    if not (body.site_url.startswith("http://") or body.site_url.startswith("https://")):
        raise HTTPException(
            status_code=422,
            detail="site_url must start with http:// or https://",
        )
    if not body.repo_url.startswith("https://github.com/"):
        raise HTTPException(
            status_code=422,
            detail="repo_url must start with https://github.com/",
        )


def _to_out(cfg: RepoConfig) -> RepoConfigOut:
    return RepoConfigOut(
        company_id=cfg.company_id,
        site_url=cfg.site_url,
        repo_url=cfg.repo_url,
        default_branch=cfg.default_branch,
        has_token=bool(cfg.github_token),
    )


@router.get("/companies/{company_id}/repo", response_model=RepoConfigOut)
def get_repo(company_id: str, db: Session = Depends(get_db)) -> RepoConfigOut:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    cfg = db.query(RepoConfig).filter(RepoConfig.company_id == company_id).first()
    if cfg is None:
        raise HTTPException(status_code=404, detail="repo not configured")
    return _to_out(cfg)


@router.put("/companies/{company_id}/repo", response_model=RepoConfigOut)
def upsert_repo(
    company_id: str, body: RepoConfigIn, db: Session = Depends(get_db)
) -> RepoConfigOut:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    _validate_input(body)

    cfg = db.query(RepoConfig).filter(RepoConfig.company_id == company_id).first()
    if cfg is None:
        cfg = RepoConfig(
            id=f"rc_{uuid.uuid4()}",
            company_id=company_id,
            site_url=body.site_url,
            repo_url=body.repo_url,
            default_branch=body.default_branch,
            github_token=body.github_token,
        )
        db.add(cfg)
    else:
        cfg.site_url = body.site_url
        cfg.repo_url = body.repo_url
        cfg.default_branch = body.default_branch
        cfg.github_token = body.github_token
    db.commit()
    db.refresh(cfg)
    return _to_out(cfg)


@router.delete("/companies/{company_id}/repo", status_code=status.HTTP_204_NO_CONTENT)
def delete_repo(company_id: str, db: Session = Depends(get_db)) -> Response:
    cfg = db.query(RepoConfig).filter(RepoConfig.company_id == company_id).first()
    if cfg is not None:
        db.delete(cfg)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
