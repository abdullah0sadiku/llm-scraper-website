"""
Enhanced Schema Definitions for LLM Scraper
Provides both Zod-equivalent validation and JSON Schema formats
"""

from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field
from enum import Enum

class FieldType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ARRAY = "array"
    OBJECT = "object"

class SchemaField(BaseModel):
    """Enhanced schema field definition with validation and descriptions"""
    name: str = Field(..., description="Field name for extraction")
    type: FieldType = Field(..., description="Data type of the field")
    required: bool = Field(default=True, description="Whether field is required")
    description: str = Field(..., description="Human-readable field description")
    example: Optional[str] = Field(None, description="Example value for this field")
    selector_hints: Optional[List[str]] = Field(None, description="CSS selector hints for extraction")
    validation_pattern: Optional[str] = Field(None, description="Regex pattern for validation")
    min_length: Optional[int] = Field(None, description="Minimum string length")
    max_length: Optional[int] = Field(None, description="Maximum string length")

class EnhancedSchemaDefinition(BaseModel):
    """Enhanced schema definition with full validation support"""
    type: str = Field(..., description="Schema root type: 'object' or 'array'")
    title: str = Field(..., description="Human-readable schema title")
    description: str = Field(..., description="Schema purpose and usage description")
    fields: Dict[str, SchemaField] = Field(..., description="Field definitions")
    examples: Optional[List[Dict[str, Any]]] = Field(None, description="Example data structures")
    
    def to_json_schema(self) -> Dict[str, Any]:
        """Convert to standard JSON Schema format"""
        if self.type == "array":
            return {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "array",
                "title": self.title,
                "description": self.description,
                "items": {
                    "type": "object",
                    "properties": {
                        name: {
                            "type": field.type.value,
                            "description": field.description,
                            **({"pattern": field.validation_pattern} if field.validation_pattern else {}),
                            **({"minLength": field.min_length} if field.min_length else {}),
                            **({"maxLength": field.max_length} if field.max_length else {}),
                            **({"examples": [field.example]} if field.example else {})
                        }
                        for name, field in self.fields.items()
                    },
                    "required": [name for name, field in self.fields.items() if field.required],
                    "additionalProperties": False
                },
                "minItems": 1,
                **({"examples": self.examples} if self.examples else {})
            }
        else:  # object
            return {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "title": self.title,
                "description": self.description,
                "properties": {
                    name: {
                        "type": field.type.value,
                        "description": field.description,
                        **({"pattern": field.validation_pattern} if field.validation_pattern else {}),
                        **({"minLength": field.min_length} if field.min_length else {}),
                        **({"maxLength": field.max_length} if field.max_length else {}),
                        **({"examples": [field.example]} if field.example else {})
                    }
                    for name, field in self.fields.items()
                },
                "required": [name for name, field in self.fields.items() if field.required],
                "additionalProperties": False,
                **({"examples": self.examples} if self.examples else {})
            }
    
    def to_zod_schema(self) -> str:
        """Generate equivalent Zod schema string"""
        if self.type == "array":
            object_fields = []
            for name, field in self.fields.items():
                zod_type = self._get_zod_type(field)
                optional = "" if field.required else ".optional()"
                description = f'.describe("{field.description}")'
                object_fields.append(f'  {name}: {zod_type}{optional}{description}')
            
            return f"""import {{ z }} from 'zod';

// {self.title}
// {self.description}
export const {self._to_camel_case(self.title)}Schema = z.array(
  z.object({{
{chr(10).join(object_fields)}
  }})
).min(1).describe("{self.description}");

export type {self._to_pascal_case(self.title)} = z.infer<typeof {self._to_camel_case(self.title)}Schema>;"""
        
        else:  # object
            object_fields = []
            for name, field in self.fields.items():
                zod_type = self._get_zod_type(field)
                optional = "" if field.required else ".optional()"
                description = f'.describe("{field.description}")'
                object_fields.append(f'  {name}: {zod_type}{optional}{description}')
            
            return f"""import {{ z }} from 'zod';

// {self.title}
// {self.description}
export const {self._to_camel_case(self.title)}Schema = z.object({{
{chr(10).join(object_fields)}
}}).describe("{self.description}");

export type {self._to_pascal_case(self.title)} = z.infer<typeof {self._to_camel_case(self.title)}Schema>;"""
    
    def _get_zod_type(self, field: SchemaField) -> str:
        """Convert field type to Zod type"""
        type_map = {
            FieldType.STRING: "z.string()",
            FieldType.NUMBER: "z.number()",
            FieldType.BOOLEAN: "z.boolean()",
            FieldType.ARRAY: "z.array(z.string())",  # Simple array, can be enhanced
            FieldType.OBJECT: "z.object({})"  # Empty object, can be enhanced
        }
        
        base_type = type_map[field.type]
        
        # Add validation constraints
        if field.type == FieldType.STRING:
            constraints = []
            if field.min_length:
                constraints.append(f".min({field.min_length})")
            if field.max_length:
                constraints.append(f".max({field.max_length})")
            if field.validation_pattern:
                constraints.append(f'.regex(/{field.validation_pattern}/)')
            base_type = f"z.string(){''.join(constraints)}"
        
        return base_type
    
    def _to_camel_case(self, text: str) -> str:
        """Convert text to camelCase"""
        words = text.replace('_', ' ').replace('-', ' ').split()
        return words[0].lower() + ''.join(word.capitalize() for word in words[1:])
    
    def _to_pascal_case(self, text: str) -> str:
        """Convert text to PascalCase"""
        words = text.replace('_', ' ').replace('-', ' ').split()
        return ''.join(word.capitalize() for word in words)

# Enhanced Schema Definitions
ENHANCED_SCHEMAS = {
    "news_articles": EnhancedSchemaDefinition(
        type="array",
        title="News Articles",
        description="Extract structured news article data including headlines, content, metadata, and publication details",
        fields={
            "title": SchemaField(
                name="title",
                type=FieldType.STRING,
                required=True,
                description="Article headline or main title",
                example="Breaking: Major Technology Breakthrough Announced",
                selector_hints=["h1", "h2", ".headline", ".title", "[data-testid='headline']"],
                min_length=5,
                max_length=200
            ),
            "content": SchemaField(
                name="content",
                type=FieldType.STRING,
                required=True,
                description="Main article body content, cleaned and formatted",
                example="Scientists at MIT have developed a revolutionary new approach...",
                selector_hints=["article", ".content", ".article-body", "p", ".text"],
                min_length=50
            ),
            "author": SchemaField(
                name="author",
                type=FieldType.STRING,
                required=False,
                description="Article author name or byline",
                example="John Smith, Technology Reporter",
                selector_hints=[".author", ".byline", "[rel='author']", ".writer"]
            ),
            "published_date": SchemaField(
                name="published_date",
                type=FieldType.STRING,
                required=False,
                description="Publication date in ISO format or human-readable format",
                example="2024-01-15T10:30:00Z",
                selector_hints=["time", ".date", ".published", "[datetime]"],
                validation_pattern=r"^\d{4}-\d{2}-\d{2}|^\w+\s+\d{1,2},\s+\d{4}"
            ),
            "url": SchemaField(
                name="url",
                type=FieldType.STRING,
                required=False,
                description="Direct URL to the full article",
                example="https://example.com/news/article-123",
                selector_hints=["a[href]", "link[rel='canonical']"],
                validation_pattern=r"^https?://"
            ),
            "category": SchemaField(
                name="category",
                type=FieldType.STRING,
                required=False,
                description="Article category or section",
                example="Technology",
                selector_hints=[".category", ".section", ".tag", "[data-category]"]
            ),
            "summary": SchemaField(
                name="summary",
                type=FieldType.STRING,
                required=False,
                description="Article summary or excerpt",
                example="A brief overview of the main points...",
                selector_hints=[".summary", ".excerpt", ".description", "meta[name='description']"]
            )
        },
        examples=[
            {
                "title": "AI Breakthrough in Medical Diagnosis",
                "content": "Researchers have developed an AI system that can diagnose rare diseases...",
                "author": "Dr. Sarah Johnson",
                "published_date": "2024-01-15T09:00:00Z",
                "url": "https://medicalnews.com/ai-diagnosis-breakthrough",
                "category": "Healthcare",
                "summary": "New AI system shows 95% accuracy in diagnosing rare conditions"
            }
        ]
    ),
    
    "product_listings": EnhancedSchemaDefinition(
        type="array",
        title="Product Listings",
        description="Extract e-commerce product information including pricing, descriptions, ratings, and availability",
        fields={
            "name": SchemaField(
                name="name",
                type=FieldType.STRING,
                required=True,
                description="Product name or title",
                example="Wireless Bluetooth Headphones - Premium Quality",
                selector_hints=[".product-title", "h1", ".name", "[data-testid='product-name']"],
                min_length=3,
                max_length=150
            ),
            "price": SchemaField(
                name="price",
                type=FieldType.STRING,
                required=True,
                description="Product price with currency symbol",
                example="$99.99",
                selector_hints=[".price", ".cost", "[data-price]", ".amount"],
                validation_pattern=r"[\$€£¥]?\d+\.?\d*"
            ),
            "description": SchemaField(
                name="description",
                type=FieldType.STRING,
                required=False,
                description="Detailed product description and features",
                example="High-quality wireless headphones with noise cancellation...",
                selector_hints=[".description", ".details", ".features", ".product-info"]
            ),
            "image_url": SchemaField(
                name="image_url",
                type=FieldType.STRING,
                required=False,
                description="Main product image URL",
                example="https://example.com/images/product-123.jpg",
                selector_hints=["img[src]", ".product-image img", "[data-image]"],
                validation_pattern=r"^https?://.*\.(jpg|jpeg|png|webp)"
            ),
            "rating": SchemaField(
                name="rating",
                type=FieldType.STRING,
                required=False,
                description="Product rating score (e.g., '4.5/5' or '4.5 stars')",
                example="4.5/5",
                selector_hints=[".rating", ".stars", "[data-rating]", ".score"],
                validation_pattern=r"\d\.?\d*/?\d?|★+"
            ),
            "availability": SchemaField(
                name="availability",
                type=FieldType.STRING,
                required=False,
                description="Stock status or availability information",
                example="In Stock",
                selector_hints=[".availability", ".stock", ".status", "[data-stock]"]
            ),
            "brand": SchemaField(
                name="brand",
                type=FieldType.STRING,
                required=False,
                description="Product brand or manufacturer",
                example="TechBrand",
                selector_hints=[".brand", ".manufacturer", "[data-brand]"]
            )
        },
        examples=[
            {
                "name": "Sony WH-1000XM4 Wireless Headphones",
                "price": "$349.99",
                "description": "Industry-leading noise canceling with Dual Noise Sensor technology",
                "image_url": "https://example.com/images/sony-headphones.jpg",
                "rating": "4.7/5",
                "availability": "In Stock",
                "brand": "Sony"
            }
        ]
    ),
    
    "contact_information": EnhancedSchemaDefinition(
        type="object",
        title="Contact Information",
        description="Extract business or personal contact details from web pages",
        fields={
            "name": SchemaField(
                name="name",
                type=FieldType.STRING,
                required=True,
                description="Full name or business name",
                example="John Smith / Acme Corporation",
                selector_hints=[".name", "h1", ".company", ".business-name"],
                min_length=2
            ),
            "email": SchemaField(
                name="email",
                type=FieldType.STRING,
                required=False,
                description="Email address",
                example="contact@example.com",
                selector_hints=["[href^='mailto:']", ".email", "[data-email]"],
                validation_pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            ),
            "phone": SchemaField(
                name="phone",
                type=FieldType.STRING,
                required=False,
                description="Phone number in any format",
                example="+1 (555) 123-4567",
                selector_hints=["[href^='tel:']", ".phone", ".tel", "[data-phone]"],
                validation_pattern=r"[\+]?[\d\s\-\(\)]{10,}"
            ),
            "address": SchemaField(
                name="address",
                type=FieldType.STRING,
                required=False,
                description="Physical address or location",
                example="123 Main St, New York, NY 10001",
                selector_hints=[".address", ".location", "[data-address]"]
            ),
            "website": SchemaField(
                name="website",
                type=FieldType.STRING,
                required=False,
                description="Website URL",
                example="https://www.example.com",
                selector_hints=["[href^='http']", ".website", ".url"],
                validation_pattern=r"^https?://"
            ),
            "social_media": SchemaField(
                name="social_media",
                type=FieldType.STRING,
                required=False,
                description="Social media profiles or handles",
                example="@company_handle",
                selector_hints=[".social", "[href*='twitter']", "[href*='linkedin']", "[href*='facebook']"]
            )
        },
        examples=[
            {
                "name": "Tech Solutions Inc.",
                "email": "info@techsolutions.com",
                "phone": "+1 (555) 987-6543",
                "address": "456 Innovation Drive, San Francisco, CA 94107",
                "website": "https://www.techsolutions.com",
                "social_media": "@techsolutions"
            }
        ]
    )
}

def get_schema_by_name(name: str) -> Optional[EnhancedSchemaDefinition]:
    """Get enhanced schema definition by name"""
    return ENHANCED_SCHEMAS.get(name)

def list_available_schemas() -> List[str]:
    """List all available schema names"""
    return list(ENHANCED_SCHEMAS.keys())

def validate_schema_data(data: Any, schema: EnhancedSchemaDefinition) -> Dict[str, Any]:
    """Validate extracted data against schema definition"""
    # This would implement actual validation logic
    # For now, return the data as-is
    return data
