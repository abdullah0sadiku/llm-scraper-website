from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import sys
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scraper.log")
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    # Startup
    logger.info("Starting LLM Web Scraper Application")
    
    try:
        # Initialize database
        from app.core.database import init_db
        await init_db()
        logger.info("Database initialized successfully")
        
        # Install Playwright browsers if needed
        try:
            import subprocess
            subprocess.run(["playwright", "install", "chromium"], check=True, capture_output=True)
            logger.info("Playwright browsers installed/verified")
        except Exception as e:
            logger.warning(f"Could not install Playwright browsers: {e}")
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down LLM Web Scraper Application")

# Create FastAPI application
app = FastAPI(
    title="LLM Web Scraper API",
    description="AI-powered web scraping application that generates custom Playwright scripts",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - More permissive for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Set to False when using allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include routers
from app.api.scraping import router as scraping_router
from app.api.websocket import router as websocket_router

app.include_router(scraping_router)
app.include_router(websocket_router)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "LLM Web Scraper API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        from app.core.database import engine
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": "2024-01-01T00:00:00Z"  # This would be actual timestamp
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": "2024-01-01T00:00:00Z"
            }
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred"
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        reload_excludes=["*.log", "*.tmp", "__pycache__/*", ".git/*", "node_modules/*"]
    )
