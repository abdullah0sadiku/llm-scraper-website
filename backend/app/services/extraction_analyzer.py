"""
Extraction Analyzer Service
Determines the best extraction method (JavaScript vs Playwright) based on page complexity
"""

from typing import Dict, Any, Optional, List, Tuple
import re
import logging
from urllib.parse import urlparse
from datetime import datetime

logger = logging.getLogger(__name__)

class ExtractionAnalyzer:
    def __init__(self):
        self.js_frameworks = [
            'react', 'angular', 'vue', 'svelte', 'ember',
            'backbone', 'knockout', 'polymer', 'lit'
        ]
        
        self.spa_indicators = [
            'data-reactroot', 'ng-app', 'ng-version', 'v-if', 'v-for',
            '__NEXT_DATA__', '__NUXT__', 'gatsby', 'webpack'
        ]
        
        self.heavy_js_domains = [
            'linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com',
            'youtube.com', 'netflix.com', 'spotify.com', 'slack.com',
            'discord.com', 'figma.com', 'notion.so', 'airtable.com'
        ]
    
    async def analyze_extraction_requirements(
        self, 
        url: str, 
        html_content: str, 
        schema_definition: Dict[str, Any],
        page_metrics: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze page and determine the best extraction method
        
        Returns:
        {
            "method": "javascript" | "playwright",
            "complexity_score": float,  # 0-1 scale
            "reasons": List[str],
            "estimated_load_time": int,  # seconds
            "requires_interaction": bool,
            "zod_validation": Dict[str, Any]
        }
        """
        
        try:
            # Parse URL for domain analysis
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            
            # Initialize analysis result
            analysis = {
                "method": "javascript",
                "complexity_score": 0.0,
                "reasons": [],
                "estimated_load_time": 3,
                "requires_interaction": False,
                "zod_validation": self._generate_zod_validation(schema_definition),
                "extraction_hints": self._generate_extraction_hints(schema_definition, html_content)
            }
            
            # Analyze different complexity factors
            complexity_factors = []
            
            # 1. Domain-based analysis
            domain_complexity = self._analyze_domain_complexity(domain)
            complexity_factors.append(domain_complexity)
            
            # 2. HTML content analysis
            content_complexity = self._analyze_html_complexity(html_content)
            complexity_factors.append(content_complexity)
            
            # 3. Schema complexity analysis
            schema_complexity = self._analyze_schema_complexity(schema_definition)
            complexity_factors.append(schema_complexity)
            
            # 4. Page metrics analysis (if available)
            if page_metrics:
                metrics_complexity = self._analyze_page_metrics(page_metrics)
                complexity_factors.append(metrics_complexity)
            
            # Calculate overall complexity
            analysis["complexity_score"] = sum(factor["score"] for factor in complexity_factors) / len(complexity_factors)
            
            # Collect all reasons
            for factor in complexity_factors:
                analysis["reasons"].extend(factor["reasons"])
            
            # Determine extraction method
            if analysis["complexity_score"] > 0.6:
                analysis["method"] = "playwright"
                analysis["estimated_load_time"] = min(90, int(10 + analysis["complexity_score"] * 80))
            else:
                analysis["method"] = "javascript"
                analysis["estimated_load_time"] = min(15, int(3 + analysis["complexity_score"] * 12))
            
            # Check for interaction requirements
            analysis["requires_interaction"] = self._requires_user_interaction(
                html_content, schema_definition, domain
            )
            
            if analysis["requires_interaction"]:
                analysis["method"] = "playwright"
                analysis["reasons"].append("Requires user interaction (clicks, scrolling, form filling)")
            
            logger.info(f"Extraction analysis for {url}: {analysis['method']} (score: {analysis['complexity_score']:.2f})")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing extraction requirements: {str(e)}")
            # Fallback to safe default
            return {
                "method": "playwright",
                "complexity_score": 0.8,
                "reasons": [f"Analysis error, defaulting to Playwright: {str(e)}"],
                "estimated_load_time": 30,
                "requires_interaction": False,
                "zod_validation": self._generate_zod_validation(schema_definition),
                "extraction_hints": []
            }
    
    def _analyze_domain_complexity(self, domain: str) -> Dict[str, Any]:
        """Analyze complexity based on domain patterns"""
        score = 0.0
        reasons = []
        
        # Check for known heavy JS domains
        for heavy_domain in self.heavy_js_domains:
            if heavy_domain in domain:
                score += 0.8
                reasons.append(f"Known heavy JavaScript domain: {heavy_domain}")
                break
        
        # Social media platforms
        social_indicators = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok']
        if any(indicator in domain for indicator in social_indicators):
            score += 0.7
            reasons.append("Social media platform - requires complex interaction")
        
        # E-commerce platforms
        ecommerce_indicators = ['amazon', 'ebay', 'shopify', 'etsy', 'alibaba']
        if any(indicator in domain for indicator in ecommerce_indicators):
            score += 0.5
            reasons.append("E-commerce platform - dynamic pricing and inventory")
        
        # SaaS applications
        saas_indicators = ['app', 'dashboard', 'admin', 'portal', 'console']
        if any(indicator in domain for indicator in saas_indicators):
            score += 0.6
            reasons.append("SaaS application - likely requires authentication")
        
        return {"score": min(score, 1.0), "reasons": reasons}
    
    def _analyze_html_complexity(self, html_content: str) -> Dict[str, Any]:
        """Analyze HTML content for complexity indicators"""
        score = 0.0
        reasons = []
        
        # Check for JavaScript frameworks
        for framework in self.js_frameworks:
            if framework.lower() in html_content.lower():
                score += 0.3
                reasons.append(f"JavaScript framework detected: {framework}")
        
        # Check for SPA indicators
        for indicator in self.spa_indicators:
            if indicator in html_content:
                score += 0.4
                reasons.append(f"Single Page Application indicator: {indicator}")
        
        # Analyze script tags
        script_count = len(re.findall(r'<script[^>]*>', html_content, re.IGNORECASE))
        if script_count > 20:
            score += 0.5
            reasons.append(f"High number of script tags: {script_count}")
        elif script_count > 10:
            score += 0.3
            reasons.append(f"Moderate number of script tags: {script_count}")
        
        # Check for dynamic content indicators
        dynamic_indicators = [
            'data-bind', 'ng-', 'v-', '@click', 'onclick',
            'data-react', 'data-vue', 'x-data', 'wire:'
        ]
        
        dynamic_count = sum(1 for indicator in dynamic_indicators 
                           if indicator in html_content.lower())
        
        if dynamic_count > 10:
            score += 0.4
            reasons.append(f"High dynamic content indicators: {dynamic_count}")
        elif dynamic_count > 5:
            score += 0.2
            reasons.append(f"Moderate dynamic content indicators: {dynamic_count}")
        
        # Check for loading indicators
        loading_indicators = ['loading', 'spinner', 'skeleton', 'placeholder']
        if any(indicator in html_content.lower() for indicator in loading_indicators):
            score += 0.3
            reasons.append("Loading indicators suggest dynamic content")
        
        # Check for AJAX/fetch patterns
        ajax_patterns = ['fetch(', 'axios', 'XMLHttpRequest', '$.ajax', '$.get', '$.post']
        ajax_count = sum(1 for pattern in ajax_patterns if pattern in html_content)
        if ajax_count > 0:
            score += 0.4
            reasons.append(f"AJAX/fetch patterns detected: {ajax_count}")
        
        return {"score": min(score, 1.0), "reasons": reasons}
    
    def _analyze_schema_complexity(self, schema_definition: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze schema complexity requirements"""
        score = 0.0
        reasons = []
        
        # Count fields
        if schema_definition.get("type") == "array":
            fields = schema_definition.get("items", {})
        else:
            fields = schema_definition.get("properties", {})
        
        field_count = len(fields)
        
        if field_count > 15:
            score += 0.3
            reasons.append(f"High number of fields to extract: {field_count}")
        elif field_count > 8:
            score += 0.1
            reasons.append(f"Moderate number of fields to extract: {field_count}")
        
        # Check for complex field types
        complex_fields = 0
        for field_name, field_config in fields.items():
            if isinstance(field_config, dict):
                field_type = field_config.get("type", "string")
                if field_type in ["array", "object"]:
                    complex_fields += 1
                    score += 0.2
        
        if complex_fields > 0:
            reasons.append(f"Complex field types detected: {complex_fields} array/object fields")
        
        # Check for validation patterns
        pattern_fields = 0
        for field_name, field_config in fields.items():
            if isinstance(field_config, dict) and field_config.get("validationPattern"):
                pattern_fields += 1
        
        if pattern_fields > 3:
            score += 0.1
            reasons.append(f"Multiple validation patterns: {pattern_fields}")
        
        return {"score": min(score, 1.0), "reasons": reasons}
    
    def _analyze_page_metrics(self, page_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze page performance metrics"""
        score = 0.0
        reasons = []
        
        # Load time analysis
        load_time = page_metrics.get("load_time", 0)
        if load_time > 10:
            score += 0.5
            reasons.append(f"Slow page load time: {load_time}s")
        elif load_time > 5:
            score += 0.2
            reasons.append(f"Moderate page load time: {load_time}s")
        
        # Network requests
        request_count = page_metrics.get("network_requests", 0)
        if request_count > 100:
            score += 0.4
            reasons.append(f"High number of network requests: {request_count}")
        elif request_count > 50:
            score += 0.2
            reasons.append(f"Moderate number of network requests: {request_count}")
        
        # JavaScript execution time
        js_time = page_metrics.get("js_execution_time", 0)
        if js_time > 5:
            score += 0.3
            reasons.append(f"High JavaScript execution time: {js_time}s")
        
        return {"score": min(score, 1.0), "reasons": reasons}
    
    def _requires_user_interaction(
        self, 
        html_content: str, 
        schema_definition: Dict[str, Any], 
        domain: str
    ) -> bool:
        """Determine if extraction requires user interaction"""
        
        # Check for authentication requirements
        auth_indicators = [
            'login', 'sign in', 'authenticate', 'password',
            'data-requires-auth', 'protected', 'unauthorized'
        ]
        
        if any(indicator in html_content.lower() for indicator in auth_indicators):
            return True
        
        # Check for pagination or infinite scroll
        pagination_indicators = [
            'load more', 'show more', 'next page', 'pagination',
            'infinite-scroll', 'lazy-load'
        ]
        
        if any(indicator in html_content.lower() for indicator in pagination_indicators):
            return True
        
        # Check for modal dialogs or popups
        modal_indicators = ['modal', 'popup', 'dialog', 'overlay']
        if any(indicator in html_content.lower() for indicator in modal_indicators):
            return True
        
        # Domain-specific interaction requirements
        interaction_domains = [
            'linkedin.com', 'facebook.com', 'instagram.com',
            'twitter.com', 'discord.com', 'slack.com'
        ]
        
        if any(domain_check in domain for domain_check in interaction_domains):
            return True
        
        return False
    
    def _generate_zod_validation(self, schema_definition: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Zod validation schema from field definitions"""
        
        if schema_definition.get("type") == "array":
            fields = schema_definition.get("items", {})
        else:
            fields = schema_definition.get("properties", {})
        
        zod_schema = {}
        
        for field_name, field_config in fields.items():
            if not isinstance(field_config, dict):
                continue
                
            field_type = field_config.get("type", "string")
            is_required = field_config.get("required", False)
            
            # Base Zod type
            if field_type == "string":
                zod_type = "z.string()"
                
                # Add string validations
                if field_config.get("minLength"):
                    zod_type += f".min({field_config['minLength']})"
                if field_config.get("maxLength"):
                    zod_type += f".max({field_config['maxLength']})"
                if field_config.get("validationPattern"):
                    pattern = field_config["validationPattern"].replace("\\", "\\\\")
                    zod_type += f".regex(/{pattern}/)"
                    
            elif field_type == "number":
                zod_type = "z.number()"
            elif field_type == "boolean":
                zod_type = "z.boolean()"
            elif field_type == "array":
                zod_type = "z.array(z.string())"  # Simplified array
            else:
                zod_type = "z.string()"  # Default fallback
            
            # Add optional/required
            if not is_required:
                zod_type += ".optional()"
            
            # Add description
            if field_config.get("description"):
                description = field_config["description"].replace('"', '\\"')
                zod_type += f'.describe("{description}")'
            
            zod_schema[field_name] = zod_type
        
        return {
            "schema_type": schema_definition.get("type", "object"),
            "fields": zod_schema,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def _generate_extraction_hints(
        self, 
        schema_definition: Dict[str, Any], 
        html_content: str
    ) -> List[str]:
        """Generate extraction hints based on schema and HTML analysis"""
        
        hints = []
        
        # Analyze HTML structure
        if '<article' in html_content:
            hints.append("Page contains <article> tags - likely news/blog content")
        
        if 'product' in html_content.lower():
            hints.append("Product-related content detected - use e-commerce selectors")
        
        if 'price' in html_content.lower():
            hints.append("Price information detected - look for currency symbols")
        
        if 'rating' in html_content.lower() or '★' in html_content:
            hints.append("Rating/review content detected")
        
        # Schema-based hints
        if schema_definition.get("type") == "array":
            hints.append("Array schema - look for repeated elements/lists")
        
        fields = (schema_definition.get("items", {}) if schema_definition.get("type") == "array" 
                 else schema_definition.get("properties", {}))
        
        for field_name in fields.keys():
            if 'title' in field_name.lower():
                hints.append("Title field - prioritize h1, h2, .title, .headline selectors")
            elif 'price' in field_name.lower():
                hints.append("Price field - look for currency symbols and .price, .cost selectors")
            elif 'image' in field_name.lower():
                hints.append("Image field - extract from img src attributes")
        
        return hints

    def get_extraction_method_recommendation(self, analysis: Dict[str, Any]) -> str:
        """Get a human-readable recommendation for extraction method"""
        
        method = analysis.get("method", "javascript")
        score = analysis.get("complexity_score", 0)
        reasons = analysis.get("reasons", [])
        
        if method == "playwright":
            return f"""
🎭 **Playwright Recommended** (Complexity: {score:.1%})

**Why Playwright?**
{chr(10).join(f'• {reason}' for reason in reasons[:5])}

**Expected Load Time:** {analysis.get('estimated_load_time', 30)} seconds
**User Interaction Required:** {'Yes' if analysis.get('requires_interaction') else 'No'}

Playwright will handle JavaScript rendering, dynamic content, and complex interactions.
            """.strip()
        else:
            return f"""
⚡ **JavaScript Recommended** (Complexity: {score:.1%})

**Why JavaScript?**
• Simple static content extraction
• Fast execution (estimated {analysis.get('estimated_load_time', 5)} seconds)
• Minimal server resources required

{chr(10).join(f'• {reason}' for reason in reasons[:3]) if reasons else '• Standard HTML parsing sufficient'}

JavaScript extraction will be faster and more efficient for this content.
            """.strip()
