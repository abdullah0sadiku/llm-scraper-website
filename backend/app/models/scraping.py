from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator, VARCHAR
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from ..core.database import Base

# Custom UUID type for SQLAlchemy
class GUID(TypeDecorator):
    impl = VARCHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID())
        else:
            return dialect.type_descriptor(VARCHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(value))
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(value)
            return value

# Database Models
class ScrapingJob(Base):
    __tablename__ = "scraping_jobs"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    url = Column(String(500), nullable=False)
    schema_definition = Column(JSON, nullable=False)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    user_id = Column(String(100), default="anonymous")
    
    # Relationships
    scripts = relationship("GeneratedScript", back_populates="job", cascade="all, delete-orphan")
    extracted_data = relationship("ExtractedData", back_populates="job", cascade="all, delete-orphan")

class GeneratedScript(Base):
    __tablename__ = "generated_scripts"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID(), ForeignKey("scraping_jobs.id", ondelete="CASCADE"), nullable=False)
    script_content = Column(Text, nullable=False)
    script_type = Column(String(50), default="playwright")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("ScrapingJob", back_populates="scripts")

class ExtractedData(Base):
    __tablename__ = "extracted_data"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID(), ForeignKey("scraping_jobs.id", ondelete="CASCADE"), nullable=False)
    data = Column(JSON, nullable=False)
    extracted_at = Column(DateTime(timezone=True), server_default=func.now())
    data_count = Column(Integer, default=0)
    
    # Relationships
    job = relationship("ScrapingJob", back_populates="extracted_data")

class ScriptTemplate(Base):
    __tablename__ = "script_templates"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    template_content = Column(Text, nullable=False)
    schema_pattern = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    usage_count = Column(Integer, default=0)

# Pydantic Models for API
class ScrapingJobCreate(BaseModel):
    url: str
    schema_definition: Dict[str, Any]

class ScrapingJobResponse(BaseModel):
    id: uuid.UUID
    url: str
    schema_definition: Dict[str, Any]
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    user_id: str
    
    class Config:
        from_attributes = True

class GeneratedScriptResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    script_content: str
    script_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ExtractedDataResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    data: Dict[str, Any]
    extracted_at: datetime
    data_count: int
    
    class Config:
        from_attributes = True

class ScriptTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    template_content: str
    schema_pattern: Dict[str, Any]
    created_at: datetime
    usage_count: int
    
    class Config:
        from_attributes = True

# Schema definitions for common extraction patterns
COMMON_SCHEMAS = {
    "news_articles": {
        "type": "array",
        "items": {
            "title": "string",
            "content": "string", 
            "author": "string",
            "date": "string",
            "url": "string"
        }
    },
    "product_listings": {
        "type": "array",
        "items": {
            "name": "string",
            "price": "string",
            "description": "string",
            "image": "string",
            "rating": "string"
        }
    },
    "social_media_posts": {
        "type": "array",
        "items": {
            "content": "string",
            "author": "string",
            "timestamp": "string",
            "likes": "string",
            "shares": "string"
        }
    },
    "job_listings": {
        "type": "array",
        "items": {
            "title": "string",
            "company": "string",
            "location": "string",
            "salary": "string",
            "description": "string",
            "requirements": "string"
        }
    }
}
