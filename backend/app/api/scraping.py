from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
import uuid
import logging

from ..core.database import get_db
from ..models.scraping import (
    ScrapingJobCreate,
    ScrapingJobResponse,
    GeneratedScriptResponse,
    ExtractedDataResponse
)
# Will import scraping_service locally to avoid circular imports
from ..services.extraction_analyzer import ExtractionAnalyzer
from ..services.playwright_service import PlaywrightService

logger = logging.getLogger(__name__)

def get_scraping_service():
    """Get scraping service instance to avoid circular imports"""
    from ..services.scraping_service import scraping_service
    return scraping_service

router = APIRouter(prefix="/api/scraping", tags=["scraping"])

@router.post("/analyze-extraction")
async def analyze_extraction_method(
    analysis_data: Dict[str, Any]
):
    """Analyze webpage and recommend extraction method (JavaScript vs Playwright)"""
    try:
        url = analysis_data.get("url")
        schema_definition = analysis_data.get("schema_definition")
        
        if not url or not schema_definition:
            raise HTTPException(status_code=400, detail="URL and schema_definition are required")
        
        # Get page content
        async with PlaywrightService() as playwright_service:
            page_content = await playwright_service.get_page_content(url)
            
            if page_content["status"] == "error":
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to load webpage: {page_content['error']}"
                )
        
        # Analyze extraction requirements
        analyzer = ExtractionAnalyzer()
        analysis = await analyzer.analyze_extraction_requirements(
            url=url,
            html_content=page_content["html_content"],
            schema_definition=schema_definition,
            page_metrics=page_content.get("metrics")
        )
        
        # Generate human-readable recommendation
        recommendation = analyzer.get_extraction_method_recommendation(analysis)
        
        return {
            "status": "success",
            "analysis": analysis,
            "recommendation": recommendation,
            "page_info": {
                "title": page_content.get("title"),
                "description": page_content.get("description"),
                "url": url
            }
        }
        
    except Exception as e:
        logger.error(f"Extraction analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs", response_model=ScrapingJobResponse)
async def create_scraping_job(
    job_data: ScrapingJobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = "anonymous"
):
    """
    Create a new scraping job
    """
    try:
        scraping_service = get_scraping_service()
        # Create the job
        job = await scraping_service.create_scraping_job(job_data, db, user_id)
        
        # Start the job in the background
        background_tasks.add_task(
            scraping_service.start_scraping_job_background,
            job.id
        )
        
        return job
        
    except Exception as e:
        logger.error(f"Error creating scraping job: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs", response_model=List[ScrapingJobResponse])
async def list_scraping_jobs(
    db: AsyncSession = Depends(get_db),
    user_id: str = "anonymous",
    limit: int = 50,
    offset: int = 0
):
    """
    List scraping jobs for a user
    """
    try:
        scraping_service = get_scraping_service()
        jobs = await scraping_service.list_jobs(db, user_id, limit, offset)
        return jobs
        
    except Exception as e:
        logger.error(f"Error listing scraping jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}", response_model=ScrapingJobResponse)
async def get_scraping_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific scraping job
    """
    try:
        scraping_service = get_scraping_service()
        job = await scraping_service.get_job_status(job_id, db)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return job
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scraping job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/results")
async def get_scraping_results(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the extracted data for a scraping job
    """
    try:
        scraping_service = get_scraping_service()
        results = await scraping_service.get_job_results(job_id, db)
        
        if not results:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scraping results for {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}/script")
async def get_scraping_script(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the generated script for a scraping job
    """
    try:
        scraping_service = get_scraping_service()
        script = await scraping_service.get_job_script(job_id, db)
        
        if not script:
            raise HTTPException(status_code=404, detail="Script not found")
        
        return script
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scraping script for {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/start")
async def start_scraping_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually start a pending scraping job
    """
    try:
        scraping_service = get_scraping_service()
        result = await scraping_service.start_scraping_job(job_id, db)
        return result
        
    except Exception as e:
        logger.error(f"Error starting scraping job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/cancel")
async def cancel_scraping_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a running or pending scraping job
    """
    try:
        scraping_service = get_scraping_service()
        result = await scraping_service.cancel_job(job_id, db)
        return result
        
    except Exception as e:
        logger.error(f"Error cancelling scraping job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/jobs/{job_id}/rerun")
async def rerun_scraping_job(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = "anonymous"
):
    """
    Rerun an existing scraping job with the same configuration
    """
    try:
        # Get the existing job
        scraping_service = get_scraping_service()
        existing_job = await scraping_service.get_job(job_id, db)
        if not existing_job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Create a new job with the same configuration
        job_data = ScrapingJobCreate(
            url=existing_job.url,
            schema_definition=existing_job.schema_definition
        )
        
        # Create the new job
        new_job = await scraping_service.create_scraping_job(job_data, db, user_id)
        
        # Start the job in the background
        background_tasks.add_task(
            scraping_service.start_scraping_job_background,
            new_job.id
        )
        
        return {
            "status": "success", 
            "message": "Job rerun started successfully",
            "new_job_id": str(new_job.id),
            "original_job_id": str(job_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rerunning scraping job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/jobs/{job_id}")
async def delete_scraping_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a scraping job and all associated data
    """
    try:
        scraping_service = get_scraping_service()
        result = await scraping_service.delete_job(job_id, db)
        return result
        
    except Exception as e:
        logger.error(f"Error deleting scraping job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/suggest-schema")
async def suggest_schema(
    url_data: Dict[str, str]
):
    """
    Analyze a URL and suggest an optimal extraction schema
    """
    try:
        url = url_data.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        scraping_service = get_scraping_service()
        result = await scraping_service.suggest_schema_for_url(url)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suggesting schema for URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active-jobs")
async def get_active_jobs():
    """
    Get information about currently active scraping jobs
    """
    try:
        scraping_service = get_scraping_service()
        return {
            "active_jobs_count": scraping_service.get_active_jobs_count(),
            "active_job_ids": scraping_service.get_active_job_ids()
        }
        
    except Exception as e:
        logger.error(f"Error getting active jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
async def get_script_templates(
    db: AsyncSession = Depends(get_db)
):
    """
    Get available script templates
    """
    try:
        from ..models.scraping import COMMON_SCHEMAS
        
        # For now, return the common schemas
        # In the future, this could fetch from the script_templates table
        templates = []
        for name, schema in COMMON_SCHEMAS.items():
            templates.append({
                "name": name.replace("_", " ").title(),
                "id": name,
                "schema": schema,
                "description": f"Template for extracting {name.replace('_', ' ')}"
            })
        
        return {"templates": templates}
        
    except Exception as e:
        logger.error(f"Error getting script templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate-url")
async def validate_url(url_data: Dict[str, str]):
    """
    Validate if a URL is accessible for scraping
    """
    try:
        from ..services.playwright_service import PlaywrightService
        
        url = url_data.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        async with PlaywrightService() as playwright_service:
            page_content = await playwright_service.get_page_content(url)
            
            if page_content["status"] == "error":
                return {
                    "valid": False,
                    "error": page_content["error"],
                    "url": url
                }
            else:
                return {
                    "valid": True,
                    "url": url,
                    "final_url": page_content.get("final_url", url),
                    "title": page_content.get("title", ""),
                    "description": page_content.get("meta_description", "")
                }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-extraction")
async def test_extraction(
    test_data: Dict[str, Any]
):
    """
    Test an extraction script with limited results
    """
    try:
        url = test_data.get("url")
        script_content = test_data.get("script_content")
        
        if not url or not script_content:
            raise HTTPException(
                status_code=400, 
                detail="URL and script_content are required"
            )
        
        from ..services.playwright_service import PlaywrightService
        
        async with PlaywrightService() as playwright_service:
            test_result = await playwright_service.test_extraction_script(
                url, 
                script_content,
                limit_items=3
            )
            
            return test_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
