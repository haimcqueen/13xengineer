from fastapi import APIRouter

from app.schemas import PingResponse

router = APIRouter()


@router.get("/ping", response_model=PingResponse)
def ping() -> PingResponse:
    return PingResponse(message="pong")
