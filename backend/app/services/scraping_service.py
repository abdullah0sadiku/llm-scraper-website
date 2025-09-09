from typing import Dict, Any, Optional, List
import uuid
import asyncio
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from ..models.scraping import (
    ScrapingJob, GeneratedScript, ExtractedData, ScriptTemplate,
    ScrapingJobCreate, ScrapingJobResponse
)
from ..core.database import get_db
from .ai_service import AIService
from ..api.websocket import manager as connection_manager
from .playwright_service import PlaywrightService

logger = logging.getLogger(__name__)

class ScrapingService:
    def __init__(self):
        self.ai_service = AIService()
        self.active_jobs: Dict[uuid.UUID, asyncio.Task] = {}
    
    async def create_scraping_job(
        self,
        job_data: ScrapingJobCreate,
        db: AsyncSession,
        user_id: str = "anonymous"
    ) -> ScrapingJobResponse:
        """
        Create a new scraping job
        """
        try:
            # Create job record
            job = ScrapingJob(
                url=job_data.url,
                schema_definition=job_data.schema_definition,
                user_id=user_id,
                status="pending"
            )
            
            db.add(job)
            await db.commit()
            await db.refresh(job)
            
            logger.info(f"Created scraping job {job.id} for URL: {job.url}")
            
            return ScrapingJobResponse.from_orm(job)
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create scraping job: {str(e)}")
            raise Exception(f"Failed to create scraping job: {str(e)}")
    
    async def start_scraping_job_background(
        self,
        job_id: uuid.UUID
    ) -> None:
        """
        Start executing a scraping job asynchronously with its own database session
        """
        from ..core.database import AsyncSessionLocal
        
        async with AsyncSessionLocal() as db:
            try:
                await self.start_scraping_job(job_id, db)
            except Exception as e:
                logger.error(f"Background job {job_id} failed: {str(e)}")
                # Update job status to failed
                try:
                    await self._update_job_status(job_id, "failed", db, str(e))
                except Exception as update_error:
                    logger.error(f"Failed to update job status: {str(update_error)}")

    async def start_scraping_job(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Start executing a scraping job asynchronously
        """
        try:
            # Get job from database
            result = await db.execute(
                select(ScrapingJob).where(ScrapingJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                raise Exception(f"Job {job_id} not found")
            
            if job.status != "pending":
                raise Exception(f"Job {job_id} is not in pending status")
            
            # Update job status to running
            await self._update_job_status(job_id, "running", db)
            
            # Start the scraping task asynchronously
            task = asyncio.create_task(
                self._execute_scraping_job(job_id, job.url, job.schema_definition)
            )
            
            self.active_jobs[job_id] = task
            
            logger.info(f"Started scraping job {job_id}")
            
            return {
                "status": "started",
                "job_id": str(job_id),
                "message": "Scraping job started successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to start scraping job {job_id}: {str(e)}")
            raise Exception(f"Failed to start scraping job: {str(e)}")
    
    async def _execute_scraping_job(
        self,
        job_id: uuid.UUID,
        url: str,
        schema_definition: Dict[str, Any]
    ):
        """Execute scraping job with comprehensive logging and real-time updates"""
        async with AsyncSessionLocal() as db:
            try:
                # Log: Job started
                await self._log_job_progress(job_id, "started", "Initializing scraping job", db)
                
                # Log: Generating script
                await self._log_job_progress(job_id, "generating_script", "AI is generating extraction script", db)
                
                # Generate script using AI
                script_result = await self.ai_service.analyze_webpage_and_generate_script(url, schema_definition)
                
                if script_result.get("status") != "success":
                    raise Exception(f"Script generation failed: {script_result.get('error', 'Unknown error')}")
                
                # Log: Script generated
                await self._log_job_progress(job_id, "script_ready", f"Generated {len(script_result['script'])} character script", db)
                
                # Save generated script
                script = GeneratedScript(
                    job_id=job_id,
                    script_content=script_result["script"],
                    script_type="playwright"
                )
                db.add(script)
                await db.commit()
                
                # Log: Starting extraction
                await self._log_job_progress(job_id, "extracting", "Executing script and extracting data", db)
                
                # Execute extraction
                async with PlaywrightService() as playwright_service:
                    extraction_result = await playwright_service.execute_extraction_script(
                        url, script_result["script"], schema_definition
                    )
                
                if extraction_result["status"] != "success":
                    raise Exception(f"Extraction failed: {extraction_result.get('error', 'Unknown error')}")
                
                # Log: Data extracted
                data_count = extraction_result.get("data_count", 0)
                await self._log_job_progress(job_id, "data_extracted", f"Successfully extracted {data_count} items", db)
                
                # Save extracted data
                extracted_data = ExtractedData(
                    job_id=job_id,
                    data=extraction_result["data"],
                    data_count=data_count
                )
                db.add(extracted_data)
                await db.commit()
                
                # Log: Job completed
                await self._log_job_progress(job_id, "completed", f"Job completed successfully with {data_count} items", db)
                await self._update_job_status(job_id, "completed", db)
                
                logger.info(f"Scraping job {job_id} completed successfully with {data_count} items")
                
            except Exception as e:
                error_message = str(e)
                logger.error(f"Scraping job {job_id} failed: {error_message}")
                
                # Log: Job failed
                await self._log_job_progress(job_id, "failed", f"Job failed: {error_message}", db)
                await self._update_job_status(job_id, "failed", db, error_message)
                
            finally:
                # Remove from active jobs
                if job_id in self.active_jobs:
                    del self.active_jobs[job_id]

    async def _log_job_progress(
        self,
        job_id: uuid.UUID,
        stage: str,
        message: str,
        db: AsyncSession
    ):
        """Log job progress and broadcast real-time update"""
        timestamp = datetime.utcnow()
        
        # Broadcast real-time progress update
        try:
            await connection_manager.broadcast_to_all({
                "type": "job_progress",
                "job_id": str(job_id),
                "stage": stage,
                "message": message,
                "timestamp": timestamp.isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to broadcast progress update: {str(e)}")
        
        # Log to application logs
        logger.info(f"Job {job_id} [{stage}]: {message}")

    async def _execute_scraping_job_old(
        self,
        job_id: uuid.UUID,
        url: str,
        schema_definition: Dict[str, Any]
    ):
        """
        Execute the complete scraping workflow
        """
        async with AsyncSessionLocal() as db:
            try:
                logger.info(f"Executing scraping job {job_id} for URL: {url}")
                
                # Step 1: Load webpage content
                async with PlaywrightService() as playwright_service:
                    page_content = await playwright_service.get_page_content(url)
                    
                    if page_content["status"] == "error":
                        raise Exception(f"Failed to load webpage: {page_content['error']}")
                    
                    # Step 2: Generate extraction script using AI
                    script_content = await self.ai_service.analyze_webpage_and_generate_script(
                        page_content["html_content"],
                        url,
                        schema_definition
                    )
                    
                    # Step 3: Save generated script
                    script_record = GeneratedScript(
                        job_id=job_id,
                        script_content=script_content,
                        script_type="playwright"
                    )
                    db.add(script_record)
                    await db.commit()
                    
                    # Step 4: Execute extraction script
                    extraction_result = await playwright_service.execute_extraction_script(
                        url,
                        script_content,
                        schema_definition
                    )
                    
                    if extraction_result["status"] == "error":
                        raise Exception(f"Extraction failed: {extraction_result['error']}")
                    
                    # Step 5: Save extracted data
                    extracted_data_record = ExtractedData(
                        job_id=job_id,
                        data=extraction_result["data"],
                        data_count=extraction_result["data_count"]
                    )
                    db.add(extracted_data_record)
                    
                    # Step 6: Update job status to completed
                    await self._update_job_status(job_id, "completed", db)
                    await db.commit()
                    
                    logger.info(f"Successfully completed scraping job {job_id}")
                    
            except Exception as e:
                logger.error(f"Scraping job {job_id} failed: {str(e)}")
                
                # Update job status to failed
                await self._update_job_status(job_id, "failed", db, str(e))
                await db.commit()
                
            finally:
                # Remove from active jobs
                if job_id in self.active_jobs:
                    del self.active_jobs[job_id]
    
    async def get_job(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[ScrapingJob]:
        """
        Get a single job by ID
        """
        try:
            result = await db.execute(
                select(ScrapingJob).where(ScrapingJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            return job
            
        except Exception as e:
            logger.error(f"Error getting job {job_id}: {str(e)}")
            return None

    async def get_job_status(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[ScrapingJobResponse]:
        """
        Get the current status of a scraping job
        """
        try:
            result = await db.execute(
                select(ScrapingJob)
                .options(
                    selectinload(ScrapingJob.scripts),
                    selectinload(ScrapingJob.extracted_data)
                )
                .where(ScrapingJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                return None
            
            return ScrapingJobResponse.from_orm(job)
            
        except Exception as e:
            logger.error(f"Failed to get job status for {job_id}: {str(e)}")
            raise Exception(f"Failed to get job status: {str(e)}")
    
    async def get_job_results(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """
        Get the extracted data for a completed job
        """
        try:
            # Get job with extracted data
            result = await db.execute(
                select(ScrapingJob)
                .options(selectinload(ScrapingJob.extracted_data))
                .where(ScrapingJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                return None
            
            if job.status != "completed":
                return {
                    "status": job.status,
                    "message": f"Job is in {job.status} status",
                    "data": None
                }
            
            # Get the latest extracted data
            if job.extracted_data:
                latest_data = max(job.extracted_data, key=lambda x: x.extracted_at)
                return {
                    "status": "completed",
                    "job_id": str(job.id),
                    "url": job.url,
                    "data": latest_data.data,
                    "data_count": latest_data.data_count,
                    "extracted_at": latest_data.extracted_at.isoformat(),
                    "schema_definition": job.schema_definition
                }
            else:
                return {
                    "status": "completed",
                    "message": "No data extracted",
                    "data": None
                }
            
        except Exception as e:
            logger.error(f"Failed to get job results for {job_id}: {str(e)}")
            raise Exception(f"Failed to get job results: {str(e)}")
    
    async def get_job_script(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Optional[Dict[str, Any]]:
        """
        Get the generated script for a job
        """
        try:
            result = await db.execute(
                select(GeneratedScript)
                .where(GeneratedScript.job_id == job_id)
                .order_by(GeneratedScript.created_at.desc())
            )
            script = result.scalar_one_or_none()
            
            if not script:
                return None
            
            return {
                "script_id": str(script.id),
                "job_id": str(script.job_id),
                "script_content": script.script_content,
                "script_type": script.script_type,
                "created_at": script.created_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get job script for {job_id}: {str(e)}")
            raise Exception(f"Failed to get job script: {str(e)}")
    
    async def cancel_job(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Cancel a running or pending scraping job
        """
        try:
            # Cancel the async task if it's running
            if job_id in self.active_jobs:
                task = self.active_jobs[job_id]
                task.cancel()
                del self.active_jobs[job_id]
            
            # Update job status
            await self._update_job_status(job_id, "cancelled", db)
            await db.commit()
            
            return {
                "status": "cancelled",
                "job_id": str(job_id),
                "message": "Job cancelled successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to cancel job {job_id}: {str(e)}")
            raise Exception(f"Failed to cancel job: {str(e)}")
    
    async def list_jobs(
        self,
        db: AsyncSession,
        user_id: str = "anonymous",
        limit: int = 50,
        offset: int = 0
    ) -> List[ScrapingJobResponse]:
        """
        List scraping jobs for a user
        """
        try:
            result = await db.execute(
                select(ScrapingJob)
                .where(ScrapingJob.user_id == user_id)
                .order_by(ScrapingJob.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            jobs = result.scalars().all()
            
            return [ScrapingJobResponse.from_orm(job) for job in jobs]
            
        except Exception as e:
            logger.error(f"Failed to list jobs: {str(e)}")
            raise Exception(f"Failed to list jobs: {str(e)}")
    
    async def delete_job(
        self,
        job_id: uuid.UUID,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Delete a scraping job and all associated data
        """
        try:
            # Cancel if running
            if job_id in self.active_jobs:
                task = self.active_jobs[job_id]
                task.cancel()
                del self.active_jobs[job_id]
            
            # Delete job (cascading will delete related records)
            result = await db.execute(
                select(ScrapingJob).where(ScrapingJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                raise Exception(f"Job {job_id} not found")
            
            await db.delete(job)
            await db.commit()
            
            return {
                "status": "deleted",
                "job_id": str(job_id),
                "message": "Job deleted successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to delete job {job_id}: {str(e)}")
            raise Exception(f"Failed to delete job: {str(e)}")
    
    async def _update_job_status(
        self,
        job_id: uuid.UUID,
        status: str,
        db: AsyncSession,
        error_message: Optional[str] = None
    ):
        """
        Update job status in database
        """
        update_data = {"status": status}
        
        if status in ["completed", "failed", "cancelled"]:
            update_data["completed_at"] = datetime.utcnow()
        
        if error_message:
            update_data["error_message"] = error_message
        
        await db.execute(
            update(ScrapingJob)
            .where(ScrapingJob.id == job_id)
            .values(**update_data)
        )
        await db.commit()
        
        # Broadcast real-time update to all connected clients
        try:
            await connection_manager.broadcast_to_all({
                "type": "job_status_update",
                "job_id": str(job_id),
                "status": status,
                "error_message": error_message,
                "timestamp": datetime.utcnow().isoformat()
            })
            logger.info(f"Broadcasted status update for job {job_id}: {status}")
        except Exception as e:
            logger.error(f"Failed to broadcast job update: {str(e)}")
    
    async def suggest_schema_for_url(
        self,
        url: str
    ) -> Dict[str, Any]:
        """
        Analyze a URL and suggest an optimal extraction schema
        """
        try:
            async with PlaywrightService() as playwright_service:
                page_content = await playwright_service.get_page_content(url)
                
                if page_content["status"] == "error":
                    raise Exception(f"Failed to load webpage: {page_content['error']}")
                
                # Use AI to detect schema
                suggested_schema = await self.ai_service.detect_schema_from_html(
                    page_content["html_content"],
                    url
                )
                
                return {
                    "status": "success",
                    "url": url,
                    "suggested_schema": suggested_schema,
                    "page_title": page_content.get("title", ""),
                    "page_description": page_content.get("meta_description", "")
                }
                
        except Exception as e:
            logger.error(f"Failed to suggest schema for {url}: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "suggested_schema": None
            }
    
    def get_active_jobs_count(self) -> int:
        """
        Get the number of currently active jobs
        """
        return len(self.active_jobs)
    
    def get_active_job_ids(self) -> List[str]:
        """
        Get list of active job IDs
        """
        return [str(job_id) for job_id in self.active_jobs.keys()]

# Create a global instance
scraping_service = ScrapingService()

# Import AsyncSessionLocal here to avoid circular imports
from ..core.database import AsyncSessionLocal
