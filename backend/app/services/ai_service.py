import openai
from typing import Dict, Any, Optional, List
import json
import re
import logging
from ..core.config import settings
from ..models.scraping import COMMON_SCHEMAS
from ..schemas.extraction_schemas import get_schema_by_name, ENHANCED_SCHEMAS
from .extraction_analyzer import ExtractionAnalyzer

logger = logging.getLogger(__name__)
from ..utils.schema_converter import SchemaConverter

class AIService:
    def __init__(self):
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.extraction_analyzer = ExtractionAnalyzer()
    
    async def analyze_webpage_and_generate_script(
        self,
        url: str,
        schema_definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze webpage HTML and generate extraction script (JavaScript or Playwright)
        """
        try:
            # Get page content first
            from .playwright_service import PlaywrightService
            async with PlaywrightService() as playwright_service:
                page_content = await playwright_service.get_page_content(url)
                
                if page_content["status"] == "error":
                    return {
                        "status": "error",
                        "error": f"Failed to load webpage: {page_content['error']}",
                        "script": None
                    }
                
                html_content = page_content["html_content"]
                
                # Analyze extraction requirements
                extraction_analysis = await self.extraction_analyzer.analyze_extraction_requirements(
                    url=url,
                    html_content=html_content,
                    schema_definition=schema_definition,
                    page_metrics=page_content.get("metrics")
                )
        
            # Truncate HTML content if too long (GPT has token limits)
            truncated_html = self._truncate_html(html_content, max_length=8000)
        
            # Create the prompt based on extraction method
            extraction_method = extraction_analysis["method"]
            
            if extraction_method == "javascript":
                system_prompt = self._create_javascript_system_prompt()
                user_prompt = self._create_javascript_user_prompt(
                    truncated_html, url, schema_definition, extraction_analysis
                )
            else:
                system_prompt = self._create_playwright_system_prompt()
                user_prompt = self._create_playwright_user_prompt(
                    truncated_html, url, schema_definition, extraction_analysis
                )
        
            # Generate script with AI
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # Low temperature for more consistent code generation
                max_tokens=2000
            )
            
            script_content = response.choices[0].message.content
            
            # Clean and validate the generated script
            try:
                cleaned_script = self._clean_generated_script(script_content)
                return {
                    "status": "success",
                    "script": cleaned_script,
                    "extraction_method": extraction_method,
                    "extraction_analysis": extraction_analysis,
                    "model": "gpt-4",
                    "usage": response.usage.model_dump() if response.usage else None
                }
            except Exception as clean_error:
                # If cleaning fails, generate a fallback script
                fallback_script = self._generate_fallback_script(schema_definition)
                return {
                    "status": "success",
                    "script": fallback_script,
                    "extraction_method": extraction_method,
                    "extraction_analysis": extraction_analysis,
                    "model": "gpt-4",
                    "usage": response.usage.model_dump() if response.usage else None
                }
            
        except Exception as e:
            # If AI fails completely, generate a fallback script
            fallback_script = self._generate_fallback_script(schema_definition)
            return {
                "status": "success", 
                "script": fallback_script
            }
    
    async def suggest_schema_improvements(
        self,
        html_content: str,
        current_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze HTML and suggest improvements to the current schema
        """
        
        truncated_html = self._truncate_html(html_content, max_length=6000)
        
        system_prompt = """You are an expert web scraper. Analyze the HTML content and suggest improvements to the extraction schema.
        
        Focus on:
        1. Identifying additional valuable data fields that could be extracted
        2. Suggesting better selectors or extraction methods
        3. Detecting patterns that might be missed
        4. Recommending data validation or cleaning steps
        
        Return your suggestions as a JSON object with 'suggested_fields', 'improvements', and 'warnings' keys."""
        
        user_prompt = f"""
        Current Schema: {json.dumps(current_schema, indent=2)}
        
        HTML Content to analyze:
        {truncated_html}
        
        Please suggest improvements to this extraction schema.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            suggestions_text = response.choices[0].message.content
            
            # Try to parse as JSON, fallback to structured text
            try:
                suggestions = json.loads(suggestions_text)
            except:
                suggestions = {"raw_response": suggestions_text}
            
            return suggestions
            
        except Exception as e:
            return {"error": f"Failed to generate suggestions: {str(e)}"}
    
    async def detect_schema_from_html(self, html_content: str, url: str) -> Dict[str, Any]:
        """
        SMART AI Schema Detection - Automatically analyze and suggest optimal extraction schema
        """
        
        truncated_html = self._truncate_html(html_content, max_length=8000)
        
        # Get available enhanced schema descriptions with examples
        schema_info = []
        for name, schema in ENHANCED_SCHEMAS.items():
            field_names = list(schema.fields.keys())
            schema_info.append(f"- {name}: {schema.description}\n  Fields: {', '.join(field_names[:5])}")
        
        system_prompt = f"""You are an EXPERT web scraper AI with deep understanding of website patterns and data structures.

MISSION: Analyze the webpage like a human expert and provide the SMARTEST possible schema suggestion.

INTELLIGENCE EXAMPLES:
- E-commerce sites like Gjirafa50.com: Extract site info, products with prices/discounts, categories, navigation, offers
- News sites: Articles with headlines, authors, dates, content, categories
- Corporate sites: Services, team info, contact details, testimonials
- Directories: Business listings, contact info, locations, categories

ADVANCED ANALYSIS FRAMEWORK:
1. WEBSITE TYPE DETECTION:
   - E-commerce: Look for .product, .price, .cart, .category patterns
   - News/Blog: Look for article, .post, .headline, .author patterns  
   - Corporate: Look for .service, .team, .about, .contact patterns
   - Directory: Look for .listing, .business, .location patterns

2. PATTERN RECOGNITION:
   - Product grids: .product-item, .card, .listing with price/image patterns
   - Navigation structures: .menu, .nav, .category-item with hierarchical links
   - Content blocks: article, .content, .section with text/media
   - Promotional elements: .offer, .deal, .discount, .special with time/price data

3. DATA RICHNESS ASSESSMENT:
   - High: Multiple data types (text, numbers, URLs, dates, structured content)
   - Medium: Some structured data with basic fields
   - Low: Mostly text content with minimal structure

4. SMART FIELD DETECTION:
   For E-commerce sites, extract:
   - Site metadata: title, description, branding
   - Products: name, price, originalPrice, discount, images, URLs, availability, categories
   - Navigation: categories, menus, links with hierarchy
   - Offers: promotions, deals, discounts with validity
   - UI elements: search, filters, pagination

AVAILABLE ENHANCED SCHEMAS:
{chr(10).join(schema_info)}

RESPONSE FORMAT:
{{
    "suggested_type": "schema_name_or_custom",
    "confidence": 0.95,
    "reasoning": "Detailed analysis of website patterns and why this schema captures maximum value",
    "page_analysis": {{
        "website_type": "e-commerce|news|blog|directory|social|corporate",
        "content_pattern": "product_grid|article_list|single_page|mixed_content",
        "key_elements": ["specific CSS classes and HTML patterns found"],
        "data_density": "high|medium|low",
        "business_context": "description of what the business does"
    }},
    "custom_fields": {{
        "field_name": "detailed_description_and_extraction_purpose",
        "another_field": "why this field adds business value"
    }}
}}

THINK LIKE AN EXPERT: What would a human scraper expert extract from this site to get maximum business value?"""
        
        user_prompt = f"""
        TARGET URL: {url}
        
        WEBPAGE CONTENT:
        {truncated_html}
        
        ANALYZE THIS WEBPAGE WITH MAXIMUM INTELLIGENCE:
        - What type of website is this?
        - What are the most valuable data points?
        - What schema will capture the MOST useful information?
        - Are there repeated patterns suggesting arrays?
        
        Provide your SMARTEST schema recommendation!
        """
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,  # Lower temperature for more consistent analysis
                max_tokens=2000
            )
            
            suggestion_text = response.choices[0].message.content
            
            try:
                suggestion = json.loads(suggestion_text)
                suggested_type = suggestion.get("suggested_type", "custom")
                
                # Enhanced response with AI analysis
                result = {
                    "suggested_type": suggested_type,
                    "confidence": suggestion.get("confidence", 0.8),
                    "reasoning": suggestion.get("reasoning", "AI analysis completed"),
                    "page_analysis": suggestion.get("page_analysis", {}),
                    "ai_enhanced": True
                }
                
                # If it's a known enhanced schema, return that with enhancements
                if suggested_type in ENHANCED_SCHEMAS:
                    enhanced_schema = ENHANCED_SCHEMAS[suggested_type]
                    result["schema"] = SchemaConverter.enhanced_to_simple(enhanced_schema)
                    result["schema_title"] = enhanced_schema.title
                    result["field_count"] = len(enhanced_schema.fields)
                else:
                    # Create intelligent custom schema
                    custom_fields = suggestion.get("custom_fields", {})
                    result["schema"] = self._create_intelligent_custom_schema(custom_fields, url, suggestion.get("page_analysis", {}))
                    result["schema_title"] = "Custom Smart Schema"
                    result["field_count"] = len(custom_fields)
                
                return result
                    
            except json.JSONDecodeError:
                # Fallback with content analysis
                return self._intelligent_content_analysis(truncated_html, url)
            
        except Exception as e:
            logger.error(f"AI schema detection failed: {str(e)}")
            return self._intelligent_fallback_schema(url, truncated_html)
    
    def _create_javascript_system_prompt(self) -> str:
        """Create system prompt for JavaScript-based extraction"""
        return """You are an expert JavaScript developer specializing in web scraping and data extraction.
        
        Your task is to generate clean, efficient JavaScript code that extracts data from HTML content.
        
        JAVASCRIPT EXTRACTION RULES:
        1. Generate ONLY JavaScript code - no explanations, no markdown blocks
        2. Code should work in browser console or be executable via Playwright's evaluate()
        3. Start directly with const result = [] or const result = {}
        4. End with return result;
        5. Use modern JavaScript (ES6+) features
        
        EXTRACTION PATTERNS:
        1. Use document.querySelectorAll() and document.querySelector()
        2. Handle multiple fallback selectors per field
        3. Clean and normalize text content: .textContent.replace(/\\s+/g, ' ').trim()
        4. Convert relative URLs to absolute URLs
        5. Extract numbers from text when needed
        6. Handle null/undefined gracefully
        
        DATA VALIDATION:
        1. Skip empty or invalid items
        2. Validate data types match schema requirements
        3. Apply Zod-like validation patterns where specified
        4. Use comprehensive null checks: if (element && element.textContent)
        
        PERFORMANCE:
        1. Minimize DOM queries - cache selectors when possible
        2. Use efficient selectors - prefer IDs and classes over complex paths
        3. Handle large datasets efficiently
        4. Fail gracefully with partial results rather than complete failure"""
    
    def _create_playwright_system_prompt(self) -> str:
        """Create system prompt for Playwright-based extraction"""
        return """You are a WORLD-CLASS JavaScript web scraper expert with deep understanding of e-commerce, news, and content websites.

        🎯 MISSION: Analyze webpage structure like a human expert and generate INTELLIGENT, PRODUCTION-READY extraction code.

        INTELLIGENCE FRAMEWORK:
        1. WEBSITE PATTERN RECOGNITION:
           - E-commerce sites: Products, prices, categories, navigation, offers, discounts
           - News sites: Articles, headlines, authors, dates, categories
           - Corporate sites: Services, team, contact info, testimonials
           - Directories: Listings, contact details, locations, categories

        2. SMART ELEMENT DETECTION:
           - Product grids: .product, .item, .card, [data-product], .product-item
           - Price indicators: .price, .cost, .amount, [data-price], .old-price
           - Navigation: nav, .menu, .navigation, .header-menu, .category-item
           - Categories: .category, .cat, .section, .department, .main-cat
           - Offers/Promotions: .offer, .deal, .promotion, .discount, .special-offer
           - Content blocks: article, .content, .post, .section

        3. ADVANCED EXTRACTION STRATEGIES:
           - Use semantic HTML first: <article>, <section>, <nav>, <header>
           - Fallback to class patterns: .product-item, .news-article, .menu-item
           - Try data attributes: [data-product-id], [data-price], [data-category]
           - Look for common e-commerce patterns like Gjirafa50.com

        4. INTELLIGENT DATA PROCESSING:
           - Clean prices: extract numbers and currency symbols
           - Normalize URLs: convert relative to absolute using window.location.origin
           - Handle discounts: look for original vs sale prices
           - Extract availability: "In stock", "E shitur", "Out of stock"
           - Process product metadata: brands, categories, ratings

        CRITICAL JAVASCRIPT RULES:
        1. Generate ONLY JavaScript - NO Python syntax whatsoever
        2. Use proper JavaScript operators: ===, !==, &&, ||, !
        3. Use JavaScript keywords: const, let, var, return, if, else, for, while
        4. Use JavaScript booleans: true, false, null, undefined
        5. NO Python: is, and, or, not, True, False, None, def, elif, pass

        EXTRACTION PATTERN - Adapt this structure based on the schema:
        ```javascript
        const result = [];
        const elements = document.querySelectorAll('article, .item, .card, .post, .listing');
        
        for (const element of elements) {
            const item = {};
            
            // Extract title
            const titleEl = element.querySelector('h1, h2, h3, .title, [class*="title"]');
            item.title = titleEl ? titleEl.textContent.trim() : '';
            
            // Extract content
            const contentEl = element.querySelector('p, .content, .description, [class*="content"]');
            item.content = contentEl ? contentEl.textContent.trim() : '';
            
            // Extract link
            const linkEl = element.querySelector('a');
            item.link = linkEl ? linkEl.href : '';
            
            if (item.title || item.content) {
                result.push(item);
            }
        }
        
        return result;
        ```

        🚀 ADVANCED EXTRACTION TECHNIQUES:
        
        1. MULTI-STRATEGY SELECTOR APPROACH:
           - Try multiple selectors for each field (fallback chain)
           - Use semantic selectors first, then class-based, then generic
        
        2. INTELLIGENT DATA CLEANING:
           - Remove extra whitespace: text.replace(/\\s+/g, ' ').trim()
           - Handle special characters and encoding
           - Extract numbers from text when needed
           - Clean URLs (make absolute if relative)
        
        3. ROBUST ERROR HANDLING:
           - Multiple fallback selectors per field
           - Graceful degradation when elements missing
           - Skip malformed items instead of failing entirely
           - Comprehensive null/undefined checks
        
        4. PRODUCTION-GRADE PATTERNS:
           - Use explicit checks: if (element && element.textContent)
           - Extract relative URLs and make them absolute
           - Handle edge cases (empty results, malformed HTML)
        
        CRITICAL RULES:
        - Use multiple selector strategies for each field
        - Always validate data before adding to results
        - Handle relative URLs by making them absolute
        - Clean and normalize text content
        - Skip empty or invalid items
        - NO function wrappers - start directly with const result = []
        - End with return result;
        - Use explicit error checking at every step
        
        PLAYWRIGHT-SPECIFIC FEATURES:
        - Handle dynamic content loading with page.waitForSelector()
        - Manage user interactions: clicks, scrolling, form filling
        - Wait for network requests to complete
        - Handle authentication flows and session management
        - Deal with infinite scroll and pagination
        - Manage modal dialogs and popups"""
    
    def _create_javascript_user_prompt(
        self, 
        html: str, 
        url: str, 
        schema: Dict[str, Any], 
        analysis: Dict[str, Any]
    ) -> str:
        """Create user prompt for JavaScript extraction"""
        return f"""
        TARGET WEBSITE: {url}
        EXTRACTION METHOD: JavaScript (Simple/Fast)
        COMPLEXITY SCORE: {analysis['complexity_score']:.2f}
        
        ANALYSIS INSIGHTS:
        {chr(10).join(f'• {reason}' for reason in analysis.get('reasons', [])[:5])}
        
        EXTRACTION HINTS:
        {chr(10).join(f'• {hint}' for hint in analysis.get('extraction_hints', []))}
        
        HTML CONTENT TO ANALYZE:
        {html}
        
        SCHEMA TO EXTRACT:
        {json.dumps(schema, indent=2)}
        
        ZOD VALIDATION REQUIREMENTS:
        {json.dumps(analysis['zod_validation'], indent=2)}
        
        Generate clean JavaScript code that:
        1. Extracts data matching the schema structure
        2. Applies Zod-style validation patterns
        3. Handles edge cases and missing elements
        4. Returns clean, validated data
        5. Works efficiently with the detected page structure
        
        CRITICAL: Generate ONLY JavaScript code - no explanations, no markdown blocks.
        Start with const result = [] or const result = {{}} and end with return result;
        """
    
    def _create_playwright_user_prompt(
        self, 
        html: str, 
        url: str, 
        schema: Dict[str, Any], 
        analysis: Dict[str, Any]
    ) -> str:
        """Create user prompt for Playwright extraction"""
        return f"""
        TARGET WEBSITE: {url}
        EXTRACTION METHOD: Playwright (Complex/Interactive)
        COMPLEXITY SCORE: {analysis['complexity_score']:.2f}
        REQUIRES INTERACTION: {analysis['requires_interaction']}
        ESTIMATED LOAD TIME: {analysis['estimated_load_time']} seconds
        
        COMPLEXITY ANALYSIS:
        {chr(10).join(f'• {reason}' for reason in analysis.get('reasons', [])[:5])}
        
        EXTRACTION HINTS:
        {chr(10).join(f'• {hint}' for hint in analysis.get('extraction_hints', []))}
        
        HTML CONTENT TO ANALYZE:
        {html}
        
        SCHEMA TO EXTRACT:
        {json.dumps(schema, indent=2)}
        
        ZOD VALIDATION REQUIREMENTS:
        {json.dumps(analysis['zod_validation'], indent=2)}
        
        Generate sophisticated JavaScript that:
        1. Handles dynamic content loading and JavaScript rendering
        2. Manages user interactions (clicks, scrolling, form filling)
        3. Waits for content to load using appropriate strategies
        4. Applies Zod-style validation patterns
        5. Handles authentication and session requirements
        6. Manages pagination and infinite scroll
        7. Deals with modal dialogs and popups
        8. Returns comprehensive, validated data
        
        PLAYWRIGHT-SPECIFIC CONSIDERATIONS:
        - Use await page.waitForSelector() for dynamic elements
        - Handle timeouts gracefully
        - Manage network requests and API calls
        - Deal with single-page application routing
        
        CRITICAL: Generate ONLY JavaScript code - no explanations, no markdown blocks.
        Start with const result = [] or const result = {{}} and end with return result;
        """
    
    def _analyze_schema_for_context(self, schema: Dict[str, Any], url: str) -> Dict[str, Any]:
        """Analyze the schema to understand what type of extraction is needed"""
        schema_str = json.dumps(schema).lower()
        
        # Detect e-commerce patterns
        if any(term in schema_str for term in ['product', 'price', 'discount', 'cart', 'category', 'offer']):
            return {
                'site_type': 'E-commerce',
                'description': 'Online shopping platform with products, prices, and categories',
                'extraction_hints': """
                - Extract site title and description from meta tags and headers
                - Look for product grids with .product, .item, .card, .product-item classes
                - Find price elements with .price, .cost, .amount, [data-price] patterns
                - Detect discounts with .discount, .sale, .offer, .old-price patterns
                - Extract navigation from .menu, .nav, .category, .header-menu structures
                - Look for promotional offers in .offer, .deal, .promotion sections
                - Handle availability status like "In stock", "Out of stock", "E shitur"
                """,
                'selector_patterns': """
                Products: '.product, .product-item, .card, .listing, [data-product]'
                Prices: '.price, .cost, .amount, [data-price]'
                Original Prices: '.old-price, .original-price, .was-price'
                Discounts: '.discount, .sale, .offer, .bg-primary'
                Categories: '.category, .cat, .main-cat, .department'
                Navigation: 'nav a, .menu a, .category-item, .nav-link'
                Offers: '.offer, .deal, .promotion, .special-offer'
                """
            }
        
        # Detect news/blog patterns
        elif any(term in schema_str for term in ['article', 'headline', 'author', 'news', 'blog', 'post']):
            return {
                'site_type': 'News/Blog',
                'description': 'Content platform with articles, headlines, and editorial content',
                'extraction_hints': """
                - Extract articles from article, .post, .news-item, .content structures
                - Look for headlines in h1, h2, .headline, .title elements
                - Find authors in .author, .byline, .writer elements
                - Extract dates from .date, .published, .timestamp elements
                - Get categories from .category, .tag, .section elements
                """,
                'selector_patterns': """
                Articles: 'article, .post, .news-item, .content, .story'
                Headlines: 'h1, h2, h3, .headline, .title, .post-title'
                Authors: '.author, .byline, .writer, .contributor'
                Dates: '.date, .published, .timestamp, time'
                Categories: '.category, .tag, .section, .topic'
                """
            }
        
        # Default/general content
        else:
            return {
                'site_type': 'General Content',
                'description': 'General content website with mixed information',
                'extraction_hints': """
                - Extract main content from article, .content, .main sections
                - Look for titles in h1, h2, .title elements
                - Find descriptions in p, .description, .summary elements
                - Extract links from navigation and content areas
                """,
                'selector_patterns': """
                Content: 'article, .content, .main, section'
                Titles: 'h1, h2, h3, .title, .heading'
                Descriptions: 'p, .description, .summary, .excerpt'
                Links: 'a[href]'
                """
            }
    
    def _truncate_html(self, html: str, max_length: int = 8000) -> str:
        """Intelligently truncate HTML to fit token limits"""
        if len(html) <= max_length:
            return html
        
        # Try to keep the most relevant parts
        # Priority: head section, main content, structured data
        lines = html.split('\n')
        
        important_lines = []
        current_length = 0
        
        # First pass: collect important structural elements
        for line in lines:
            line_lower = line.lower().strip()
            
            # Keep important meta tags, structured data, and semantic elements
            if any(tag in line_lower for tag in ['<title>', '<meta', '<script type="application/ld+json"', 
                                                '<article', '<main', '<section', '<header', '<nav']):
                if current_length + len(line) < max_length:
                    important_lines.append(line)
                    current_length += len(line)
        
        # Second pass: fill remaining space with body content
        for line in lines:
            if current_length >= max_length:
                break
            if line not in important_lines and line.strip():
                if current_length + len(line) < max_length:
                    important_lines.append(line)
                    current_length += len(line)
        
        return '\n'.join(important_lines)
    
    def _clean_generated_script(self, script: str) -> str:
        """Clean and validate the generated Playwright script"""
        
        # Remove markdown code blocks if present
        script = re.sub(r'```javascript\n?', '', script)
        script = re.sub(r'```js\n?', '', script)
        script = re.sub(r'```\n?', '', script)
        
        # Remove any function wrappers that might cause syntax errors
        script = re.sub(r'async\s*\(\s*\)\s*=>\s*{', '', script)
        script = re.sub(r'\(\s*\)\s*=>\s*{', '', script)
        script = re.sub(r'function\s*\(\s*\)\s*{', '', script)
        
        # Remove trailing function closing braces
        script = re.sub(r'}\s*$', '', script)
        
        # Fix common Python-to-JavaScript syntax errors
        script = self._fix_python_syntax_errors(script)
        
        # Ensure the script is properly formatted
        script = script.strip()
        
        # Validate JavaScript syntax
        if self._has_python_keywords(script):
            raise Exception("Generated script contains Python syntax. Please regenerate.")
        
        # Add basic error handling if missing (but not wrapped in function)
        if 'try' not in script.lower() and 'catch' not in script.lower():
            script = f"""try {{
{script}
}} catch (error) {{
    console.error('Extraction error:', error);
    return {{ error: error.message }};
}}"""
        
        return script
    
    def _fix_python_syntax_errors(self, script: str) -> str:
        """Fix common Python syntax errors in JavaScript code"""
        
        # Fix Python boolean values
        script = re.sub(r'\bTrue\b', 'true', script)
        script = re.sub(r'\bFalse\b', 'false', script)
        script = re.sub(r'\bNone\b', 'null', script)
        
        # Fix Python operators
        script = re.sub(r'\band\b', '&&', script)
        script = re.sub(r'\bor\b', '||', script)
        script = re.sub(r'\bnot\b', '!', script)
        
        # Fix Python keywords
        script = re.sub(r'\bis\b', '===', script)
        script = re.sub(r'\bis not\b', '!==', script)
        script = re.sub(r'\belif\b', 'else if', script)
        script = re.sub(r'\bdef\b', 'function', script)
        
        # Fix Python string methods
        script = re.sub(r'\.startswith\(', '.startsWith(', script)
        script = re.sub(r'\.endswith\(', '.endsWith(', script)
        script = re.sub(r'\.find\(', '.indexOf(', script)
        
        # Fix Python list methods
        script = re.sub(r'\.append\(', '.push(', script)
        script = re.sub(r'\.extend\(', '.push(...', script)
        
        # Fix Python dictionary syntax
        script = re.sub(r'\.keys\(\)', 'Object.keys()', script)
        script = re.sub(r'\.values\(\)', 'Object.values()', script)
        
        return script
    
    def _has_python_keywords(self, script: str) -> bool:
        """Check if script contains Python keywords that shouldn't be in JavaScript"""
        python_keywords = [
            r'\bdef\b', r'\bimport\b', r'\bfrom\b', r'\bpass\b',
            r'\bexcept\b', r'\braise\b', r'\bfinally\b', r'\bwith\b',
            r'\bas\b', r'\byield\b', r'\blambda\b', r'\bclass\b'
        ]
        
        for keyword in python_keywords:
            if re.search(keyword, script):
                return True
        return False
    
    def _generate_field_extractions(self, fields: Dict[str, Any]) -> str:
        """Generate clean JavaScript field extractions"""
        extractions = []
        
        for field_name, field_config in fields.items():
            if field_name.lower() in ['title', 'name', 'heading']:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('h1, h2, h3, .title, .name, [class*="title"]');
        item.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
            
            elif field_name.lower() in ['link', 'url', 'href']:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('a');
        item.{field_name} = {field_name}El ? {field_name}El.href : '';""")
            
            elif field_name.lower() in ['content', 'description', 'text']:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('p, .content, .description, [class*="content"]');
        item.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
            
            elif field_name.lower() in ['image', 'img', 'photo']:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('img');
        item.{field_name} = {field_name}El ? {field_name}El.src : '';""")
            
            elif field_name.lower() in ['price', 'cost']:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('.price, .cost, [class*="price"]');
        item.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
            
            else:
                extractions.append(f"""        // Extract {field_name}
        const {field_name}El = element.querySelector('*');
        item.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
        
        return '\n'.join(extractions)
    
    def _generate_single_field_extractions(self, fields: Dict[str, Any]) -> str:
        """Generate clean JavaScript field extractions for single objects"""
        extractions = []
        
        for field_name, field_config in fields.items():
            if field_name.lower() in ['title', 'name', 'heading']:
                extractions.append(f"""    // Extract {field_name}
    const {field_name}El = document.querySelector('h1, h2, h3, .title, .name, [class*="title"]');
    result.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
            
            elif field_name.lower() in ['content', 'description', 'text']:
                extractions.append(f"""    // Extract {field_name}
    const {field_name}El = document.querySelector('p, .content, .description, [class*="content"]');
    result.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
            
            elif field_name.lower() in ['image', 'img', 'photo']:
                extractions.append(f"""    // Extract {field_name}
    const {field_name}El = document.querySelector('img');
    result.{field_name} = {field_name}El ? {field_name}El.src : '';""")
            
            else:
                extractions.append(f"""    // Extract {field_name}
    const {field_name}El = document.querySelector('body');
    result.{field_name} = {field_name}El ? {field_name}El.textContent.trim() : '';""")
        
        return '\n'.join(extractions)
    
    def _generate_fallback_script(self, schema_definition: Dict[str, Any]) -> str:
        """Generate a simple fallback extraction script when AI fails"""
        
        if schema_definition.get('type') == 'array':
            # Generate array extraction script
            fields = schema_definition.get('items', {})
            field_extractions = []
            
            for field_name, field_config in fields.items():
                if isinstance(field_config, dict):
                    field_type = field_config.get('type', 'string')
                else:
                    field_type = 'string'
                
                if field_name.lower() in ['title', 'name', 'heading']:
                    field_extractions.append(f"        {field_name}: element.querySelector('h1, h2, h3, .title, .name')?.textContent?.trim() || '',")
                elif field_name.lower() in ['link', 'url', 'href']:
                    field_extractions.append(f"        {field_name}: element.querySelector('a')?.href || '',")
                elif field_name.lower() in ['content', 'description', 'text']:
                    field_extractions.append(f"        {field_name}: element.querySelector('p, .content, .description')?.textContent?.trim() || '',")
                elif field_name.lower() in ['image', 'img', 'photo']:
                    field_extractions.append(f"        {field_name}: element.querySelector('img')?.src || '',")
                elif field_name.lower() in ['price', 'cost']:
                    field_extractions.append(f"        {field_name}: element.querySelector('.price, .cost, [class*=\"price\"]')?.textContent?.trim() || '',")
                else:
                    field_extractions.append(f"        {field_name}: element.textContent?.trim() || '',")
            
            return f"""
try {{
    const result = [];
    const elements = document.querySelectorAll('article, .item, .card, .product, .listing, .post, li');
    
    for (const element of elements) {{
        const item = {{}};
        
{self._generate_field_extractions(fields)}
        
        if (Object.keys(item).length > 0) {{
            result.push(item);
        }}
    }}
    
    return result;
}} catch (error) {{
    console.error('Extraction error:', error);
    return {{ error: error.message }};
}}"""
        
        else:
            # Generate single object extraction script
            fields = schema_definition.get('properties', {})
            
            return f"""
try {{
    const result = {{}};
    
{self._generate_single_field_extractions(fields)}
    
    return result;
}} catch (error) {{
    console.error('Extraction error:', error);
    return {{ error: error.message }};
}}"""
    
    def _create_custom_schema_from_fields(self, custom_fields: Dict[str, str], url: str = "") -> Dict[str, Any]:
        """Create schema from custom field suggestions"""
        if not custom_fields:
            return self._create_fallback_schema(url)
        
        # Determine if it should be array or object based on field names
        is_listing = any(word in url.lower() for word in ['list', 'catalog', 'search', 'results', 'feed'])
        schema_type = "array" if is_listing else "object"
        
        items = {}
        for field_name, description in custom_fields.items():
            # Infer field type from name and description
            field_type = "string"  # Default
            if any(word in field_name.lower() for word in ['price', 'cost', 'amount', 'rating', 'score']):
                field_type = "string"  # Keep as string for easier extraction
            elif any(word in field_name.lower() for word in ['count', 'number', 'quantity']):
                field_type = "number"
            elif any(word in field_name.lower() for word in ['active', 'available', 'enabled']):
                field_type = "boolean"
                
            items[field_name] = field_type
        
        return {
            "type": schema_type,
            "items": items
        }
    
    def _match_content_to_schema(self, html: str, url: str) -> Dict[str, Any]:
        """Match HTML content to best available enhanced schema"""
        html_lower = html.lower()
        url_lower = url.lower()
        
        # Score each schema based on content indicators
        schema_scores = {}
        
        for schema_name, schema in ENHANCED_SCHEMAS.items():
            score = 0
            
            # Check URL patterns
            if schema_name == "news_articles":
                if any(word in url_lower for word in ['news', 'article', 'blog', 'post']):
                    score += 30
                if any(word in html_lower for word in ['article', 'headline', 'byline', 'author']):
                    score += 20
                    
            elif schema_name == "product_listings":
                if any(word in url_lower for word in ['shop', 'store', 'product', 'buy', 'catalog']):
                    score += 30
                if any(word in html_lower for word in ['price', 'cart', 'buy', 'product']):
                    score += 20
                    
            elif schema_name == "contact_information":
                if any(word in url_lower for word in ['contact', 'about', 'team']):
                    score += 30
                if any(word in html_lower for word in ['email', 'phone', 'address', 'contact']):
                    score += 20
            
            # Check for schema-specific HTML patterns
            for field_name, field in schema.fields.items():
                if field.selector_hints:
                    for hint in field.selector_hints:
                        # Simple check for CSS selector presence
                        selector = hint.replace('[', '').replace(']', '').replace('.', '').replace('#', '')
                        if selector.lower() in html_lower:
                            score += 5
            
            schema_scores[schema_name] = score
        
        # Return the highest scoring schema
        if schema_scores:
            best_schema = max(schema_scores, key=schema_scores.get)
            if schema_scores[best_schema] > 10:  # Minimum confidence threshold
                return SchemaConverter.enhanced_to_simple(ENHANCED_SCHEMAS[best_schema])
        
        # Fallback to basic schema
        return self._create_fallback_schema(url)
    
    def _create_intelligent_custom_schema(self, custom_fields: Dict[str, str], url: str, page_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Create intelligent custom schema based on AI analysis"""
        if not custom_fields:
            return self._intelligent_fallback_schema(url, "")
        
        # Determine schema type based on page analysis
        content_pattern = page_analysis.get("content_pattern", "single_page")
        is_listing = content_pattern in ["product_grid", "article_list"] or any(word in url.lower() for word in ['list', 'catalog', 'search', 'results'])
        schema_type = "array" if is_listing else "object"
        
        items = {}
        for field_name, description in custom_fields.items():
            # Intelligent field type inference
            field_type = self._infer_field_type(field_name, description)
            items[field_name] = {"type": field_type, "required": self._is_field_likely_required(field_name)}
        
        return {
            "type": schema_type,
            "items" if schema_type == "array" else "properties": items
        }
    
    def _intelligent_content_analysis(self, html: str, url: str) -> Dict[str, Any]:
        """Intelligent fallback content analysis"""
        html_lower = html.lower()
        url_lower = url.lower()
        
        # Smart pattern detection
        patterns = {
            "news_articles": ["article", "news", "blog", "post", "headline"],
            "product_listings": ["product", "shop", "store", "price", "buy", "cart"],
            "contact_information": ["contact", "about", "team", "phone", "email"]
        }
        
        best_match = None
        best_score = 0
        
        for schema_name, keywords in patterns.items():
            score = sum(1 for keyword in keywords if keyword in url_lower or keyword in html_lower)
            if score > best_score:
                best_score = score
                best_match = schema_name
        
        if best_match and best_match in ENHANCED_SCHEMAS:
            enhanced_schema = ENHANCED_SCHEMAS[best_match]
            return {
                "suggested_type": best_match,
                "confidence": min(0.7, best_score * 0.1),
                "reasoning": f"Content analysis detected {best_match} patterns",
                "schema": SchemaConverter.enhanced_to_simple(enhanced_schema),
                "ai_enhanced": False
            }
        
        return self._intelligent_fallback_schema(url, html)
    
    def _intelligent_fallback_schema(self, url: str, html: str = "") -> Dict[str, Any]:
        """Intelligent fallback when AI analysis fails"""
        # Smart URL analysis
        url_lower = url.lower()
        
        if any(word in url_lower for word in ['shop', 'store', 'product', 'buy']):
            return {
                "suggested_type": "product_listings",
                "confidence": 0.6,
                "reasoning": "URL suggests e-commerce content",
                "schema": SchemaConverter.enhanced_to_simple(ENHANCED_SCHEMAS["product_listings"]),
                "ai_enhanced": False
            }
        elif any(word in url_lower for word in ['news', 'blog', 'article']):
            return {
                "suggested_type": "news_articles", 
                "confidence": 0.6,
                "reasoning": "URL suggests news/blog content",
                "schema": SchemaConverter.enhanced_to_simple(ENHANCED_SCHEMAS["news_articles"]),
                "ai_enhanced": False
            }
        else:
            # Generic fallback
            return {
                "suggested_type": "custom",
                "confidence": 0.4,
                "reasoning": "Generic content extraction schema",
                "schema": {
                    "type": "array",
                    "items": {
                        "title": {"type": "string", "required": True},
                        "content": {"type": "string", "required": True},
                        "link": {"type": "string", "required": False}
                    }
                },
                "ai_enhanced": False
            }
    
    def _infer_field_type(self, field_name: str, description: str) -> str:
        """Intelligently infer field type from name and description"""
        field_lower = field_name.lower()
        desc_lower = description.lower()
        
        if any(word in field_lower for word in ['price', 'cost', 'amount', 'rating', 'score']) or 'number' in desc_lower:
            return "string"  # Keep as string for easier parsing
        elif any(word in field_lower for word in ['active', 'available', 'enabled']) or 'boolean' in desc_lower:
            return "boolean"
        else:
            return "string"
    
    def _is_field_likely_required(self, field_name: str) -> bool:
        """Determine if field is likely required based on name"""
        essential_fields = ['title', 'name', 'content', 'text', 'id']
        return any(essential in field_name.lower() for essential in essential_fields)

    def _create_fallback_schema(self, url: str) -> Dict[str, Any]:
        """Create a basic fallback schema when AI detection fails"""
        
        # Try to guess based on URL patterns
        if any(pattern in url.lower() for pattern in ['news', 'blog', 'article']):
            return COMMON_SCHEMAS.get('news_articles', {})
        elif any(pattern in url.lower() for pattern in ['shop', 'store', 'product', 'buy']):
            return COMMON_SCHEMAS.get('product_listings', {})
        elif any(pattern in url.lower() for pattern in ['job', 'career', 'hiring']):
            return COMMON_SCHEMAS.get('job_listings', {})
        else:
            # Generic content extraction
            return {
                "type": "array",
                "items": {
                    "title": "string",
                    "content": "string",
                    "links": "array",
                    "images": "array"
                }
            }
    
    async def validate_extraction_results(
        self,
        extracted_data: Dict[str, Any],
        expected_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate extracted data against the expected schema and suggest improvements
        """
        
        validation_prompt = f"""
        Analyze the following extracted data and expected schema:
        
        Expected Schema:
        {json.dumps(expected_schema, indent=2)}
        
        Extracted Data:
        {json.dumps(extracted_data, indent=2)}
        
        Please provide:
        1. Validation results (does data match schema?)
        2. Data quality assessment
        3. Suggestions for improvement
        4. Any anomalies or issues detected
        
        Return as JSON with 'is_valid', 'quality_score', 'issues', and 'suggestions' keys.
        """
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",  # Use cheaper model for validation
                messages=[
                    {"role": "system", "content": "You are a data validation expert."},
                    {"role": "user", "content": validation_prompt}
                ],
                temperature=0.1,
                max_tokens=800
            )
            
            validation_text = response.choices[0].message.content
            
            try:
                validation_result = json.loads(validation_text)
            except:
                validation_result = {
                    "is_valid": True,
                    "quality_score": 0.7,
                    "issues": [],
                    "suggestions": ["Could not parse validation response"]
                }
            
            return validation_result
            
        except Exception as e:
            return {
                "is_valid": True,
                "quality_score": 0.5,
                "issues": [f"Validation failed: {str(e)}"],
                "suggestions": ["Manual review recommended"]
            }
