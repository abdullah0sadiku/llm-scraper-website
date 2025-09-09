"""
Schema Conversion Utilities
Converts between different schema formats and validates data
"""

from typing import Dict, Any, List, Optional, Union
import json
import re
from ..schemas.extraction_schemas import (
    EnhancedSchemaDefinition, 
    ENHANCED_SCHEMAS,
    get_schema_by_name
)

class SchemaConverter:
    """Convert between different schema formats and validate data"""
    
    @staticmethod
    def enhanced_to_simple(enhanced_schema: EnhancedSchemaDefinition) -> Dict[str, Any]:
        """Convert enhanced schema to simple format used by AI service"""
        if enhanced_schema.type == "array":
            return {
                "type": "array",
                "items": {
                    field_name: field.type.value 
                    for field_name, field in enhanced_schema.fields.items()
                }
            }
        else:
            return {
                "type": "object",
                "properties": {
                    field_name: field.type.value 
                    for field_name, field in enhanced_schema.fields.items()
                }
            }
    
    @staticmethod
    def simple_to_enhanced_schema_def(simple_schema: Dict[str, Any], title: str = "Custom Schema") -> Dict[str, Any]:
        """Convert simple schema format to enhanced schema definition format"""
        
        if simple_schema.get("type") == "array" and "items" in simple_schema:
            # Array schema
            fields = {}
            items = simple_schema["items"]
            
            for field_name, field_type in items.items():
                fields[field_name] = {
                    "name": field_name,
                    "type": field_type,
                    "required": True,  # Default to required
                    "description": f"Extract {field_name} from the page",
                    "example": SchemaConverter._get_example_for_type(field_type),
                    "selector_hints": SchemaConverter._get_selector_hints_for_field(field_name)
                }
            
            return {
                "type": "array",
                "title": title,
                "description": f"Extract {title.lower()} data from web pages",
                "fields": fields
            }
        
        elif simple_schema.get("type") == "object":
            # Object schema
            fields = {}
            properties = simple_schema.get("properties", simple_schema.get("items", {}))
            
            for field_name, field_info in properties.items():
                field_type = field_info if isinstance(field_info, str) else field_info.get("type", "string")
                required = field_info.get("required", True) if isinstance(field_info, dict) else True
                
                fields[field_name] = {
                    "name": field_name,
                    "type": field_type,
                    "required": required,
                    "description": f"Extract {field_name} from the page",
                    "example": SchemaConverter._get_example_for_type(field_type),
                    "selector_hints": SchemaConverter._get_selector_hints_for_field(field_name)
                }
            
            return {
                "type": "object", 
                "title": title,
                "description": f"Extract {title.lower()} data from web pages",
                "fields": fields
            }
        
        else:
            raise ValueError(f"Unsupported schema format: {simple_schema}")
    
    @staticmethod
    def _get_example_for_type(field_type: str) -> str:
        """Get example value for field type"""
        examples = {
            "string": "Sample text value",
            "number": "123",
            "boolean": "true",
            "array": "['item1', 'item2']",
            "object": "{'key': 'value'}"
        }
        return examples.get(field_type, "Sample value")
    
    @staticmethod
    def _get_selector_hints_for_field(field_name: str) -> List[str]:
        """Get CSS selector hints based on field name"""
        selector_map = {
            # Text content
            "title": ["h1", "h2", "h3", ".title", ".headline", "[data-title]"],
            "name": [".name", "h1", ".product-name", "[data-name]"],
            "content": [".content", "article", "p", ".description", ".text"],
            "description": [".description", ".desc", ".summary", "p"],
            "text": ["p", ".text", ".content", "span"],
            
            # Links and URLs
            "url": ["a[href]", "link[href]", "[data-url]"],
            "link": ["a[href]", "[href]"],
            "website": ["a[href]", ".website", "[data-website]"],
            
            # Contact info
            "email": ["[href^='mailto:']", ".email", "[data-email]"],
            "phone": ["[href^='tel:']", ".phone", ".tel", "[data-phone]"],
            "address": [".address", ".location", "[data-address]"],
            
            # Metadata
            "author": [".author", ".byline", "[rel='author']", ".writer"],
            "date": ["time", ".date", ".published", "[datetime]"],
            "category": [".category", ".section", ".tag", "[data-category]"],
            "price": [".price", ".cost", "[data-price]", ".amount"],
            "rating": [".rating", ".stars", "[data-rating]", ".score"],
            
            # Media
            "image": ["img[src]", ".image img", "[data-image]"],
            "video": ["video[src]", ".video", "[data-video]"],
            
            # Social media
            "likes": [".likes", ".hearts", "[data-likes]"],
            "shares": [".shares", ".retweets", "[data-shares]"],
            "comments": [".comments", ".replies", "[data-comments]"],
            
            # Job listings
            "company": [".company", ".employer", "[data-company]"],
            "location": [".location", ".city", "[data-location]"],
            "salary": [".salary", ".pay", ".compensation", "[data-salary]"],
            
            # Products
            "brand": [".brand", ".manufacturer", "[data-brand]"],
            "availability": [".availability", ".stock", ".status", "[data-stock]"]
        }
        
        # Find the best match for field name
        field_lower = field_name.lower()
        for key, selectors in selector_map.items():
            if key in field_lower or field_lower in key:
                return selectors
        
        # Default selectors
        return [f".{field_name}", f"[data-{field_name}]", f"#{field_name}"]

class SchemaValidator:
    """Validate extracted data against schemas"""
    
    @staticmethod
    def validate_data(data: Any, schema_name: str) -> Dict[str, Any]:
        """Validate extracted data against named schema"""
        enhanced_schema = get_schema_by_name(schema_name)
        if not enhanced_schema:
            return {"valid": False, "error": f"Schema '{schema_name}' not found"}
        
        return SchemaValidator.validate_against_enhanced_schema(data, enhanced_schema)
    
    @staticmethod
    def validate_against_enhanced_schema(data: Any, schema: EnhancedSchemaDefinition) -> Dict[str, Any]:
        """Validate data against enhanced schema definition"""
        try:
            if schema.type == "array":
                if not isinstance(data, list):
                    return {"valid": False, "error": "Data must be an array"}
                
                if len(data) == 0:
                    return {"valid": False, "error": "Array must contain at least one item"}
                
                # Validate each item
                for i, item in enumerate(data):
                    if not isinstance(item, dict):
                        return {"valid": False, "error": f"Item {i} must be an object"}
                    
                    item_validation = SchemaValidator._validate_object(item, schema.fields)
                    if not item_validation["valid"]:
                        return {"valid": False, "error": f"Item {i}: {item_validation['error']}"}
            
            else:  # object
                if not isinstance(data, dict):
                    return {"valid": False, "error": "Data must be an object"}
                
                validation = SchemaValidator._validate_object(data, schema.fields)
                if not validation["valid"]:
                    return validation
            
            return {"valid": True, "data": data}
            
        except Exception as e:
            return {"valid": False, "error": f"Validation error: {str(e)}"}
    
    @staticmethod
    def _validate_object(obj: Dict[str, Any], fields: Dict[str, Any]) -> Dict[str, Any]:
        """Validate object against field definitions"""
        # Check required fields
        for field_name, field_def in fields.items():
            if field_def.required and field_name not in obj:
                return {"valid": False, "error": f"Required field '{field_name}' is missing"}
        
        # Validate field types and constraints
        for field_name, value in obj.items():
            if field_name in fields:
                field_def = fields[field_name]
                
                # Type validation
                if field_def.type == "string" and not isinstance(value, str):
                    return {"valid": False, "error": f"Field '{field_name}' must be a string"}
                elif field_def.type == "number" and not isinstance(value, (int, float)):
                    return {"valid": False, "error": f"Field '{field_name}' must be a number"}
                elif field_def.type == "boolean" and not isinstance(value, bool):
                    return {"valid": False, "error": f"Field '{field_name}' must be a boolean"}
                
                # String constraints
                if field_def.type == "string" and isinstance(value, str):
                    if field_def.min_length and len(value) < field_def.min_length:
                        return {"valid": False, "error": f"Field '{field_name}' must be at least {field_def.min_length} characters"}
                    if field_def.max_length and len(value) > field_def.max_length:
                        return {"valid": False, "error": f"Field '{field_name}' must be at most {field_def.max_length} characters"}
                    
                    # Pattern validation
                    if field_def.validation_pattern:
                        try:
                            if not re.match(field_def.validation_pattern, value):
                                return {"valid": False, "error": f"Field '{field_name}' does not match required pattern"}
                        except re.error:
                            pass  # Skip invalid regex patterns
        
        return {"valid": True}

# Export convenience functions
def get_enhanced_schema(name: str) -> Optional[EnhancedSchemaDefinition]:
    """Get enhanced schema by name"""
    return get_schema_by_name(name)

def convert_simple_to_enhanced(simple_schema: Dict[str, Any], title: str = "Custom Schema") -> Dict[str, Any]:
    """Convert simple schema to enhanced format"""
    return SchemaConverter.simple_to_enhanced_schema_def(simple_schema, title)

def validate_extracted_data(data: Any, schema_name: str) -> Dict[str, Any]:
    """Validate extracted data"""
    return SchemaValidator.validate_data(data, schema_name)

def get_available_schemas() -> List[str]:
    """Get list of available schema names"""
    return list(ENHANCED_SCHEMAS.keys())

def get_schema_json(schema_name: str) -> Optional[Dict[str, Any]]:
    """Get schema as JSON Schema format"""
    schema = get_schema_by_name(schema_name)
    if schema:
        return schema.to_json_schema()
    return None

def get_schema_zod(schema_name: str) -> Optional[str]:
    """Get schema as Zod TypeScript code"""
    schema = get_schema_by_name(schema_name)
    if schema:
        return schema.to_zod_schema()
    return None
