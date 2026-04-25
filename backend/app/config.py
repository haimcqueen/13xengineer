from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        extra="ignore",
    )

    database_url: str = "sqlite:///./app.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    peec_api_key: str = ""
    peec_api_base: str = "https://api.peec.ai/customer/v1"
    peec_mcp_url: str = "https://api.peec.ai/mcp"
    peec_oauth_metadata_url: str = (
        "https://api.peec.ai/.well-known/oauth-authorization-server/mcp"
    )
    peec_oauth_redirect_uri: str = "http://localhost:8765/oauth/callback"
    peec_use_real_mcp: bool = False

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    snapshot_ttl_seconds: int = 600


settings = Settings()
