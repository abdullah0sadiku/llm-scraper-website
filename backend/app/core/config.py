from pydantic_settings import BaseSettings
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Database settings
    postgres_user: str = os.getenv("POSTGRES_USER", "llm_scraper_user")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "your_secure_password")
    postgres_host: str = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port: str = os.getenv("POSTGRES_PORT", "5432")
    postgres_db: str = os.getenv("POSTGRES_DB", "llm_scraper_db")
    
    # OpenAI settings
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    
    # Application settings
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS settings
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    backend_url: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    # Redis settings (for job queue)
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Scraping settings
    max_concurrent_jobs: int = 5
    job_timeout_minutes: int = 45  # Increased timeout for complex apps
    page_load_timeout_seconds: int = 90  # Page load timeout
    
    # Debug
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    class Config:
        env_file = ".env"

settings = Settings()
