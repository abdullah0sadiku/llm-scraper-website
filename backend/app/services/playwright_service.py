from playwright.async_api import async_playwright, Browser, Page
from typing import Dict, Any, Optional, List
import asyncio
import json
import logging
from datetime import datetime, timedelta
import re
from urllib.parse import urlparse, urljoin
from ..core.config import settings

logger = logging.getLogger(__name__)

class PlaywrightService:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.playwright = None
        self.max_timeout = settings.job_timeout_minutes * 60 * 1000  # Convert to milliseconds
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def initialize(self):
        """Initialize Playwright browser"""
        try:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080'
                ]
            )
            logger.info("Playwright browser initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Playwright: {str(e)}")
            raise
    
    async def close(self):
        """Clean up browser resources"""
        try:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
            logger.info("Playwright browser closed successfully")
        except Exception as e:
            logger.error(f"Error closing Playwright: {str(e)}")
    
    async def get_page_content(self, url: str) -> Dict[str, Any]:
        """
        Load a webpage and return its content and metadata
        """
        if not self.browser:
            await self.initialize()
        
        page = None
        try:
            page = await self.browser.new_page()
            
            # Set viewport and user agent
            await page.set_viewport_size({"width": 1920, "height": 1080})
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            })
            
            # Navigate to the page with extended timeout for complex apps
            response = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            if not response or response.status >= 400:
                raise Exception(f"Failed to load page: HTTP {response.status if response else 'No response'}")
            
            # Wait for content to load with multiple strategies for complex apps
            try:
                # First, wait for network to be mostly idle (with timeout)
                await page.wait_for_load_state("networkidle", timeout=10000)
            except:
                # If networkidle fails, just wait a bit for dynamic content
                await asyncio.sleep(2)
                
            # Additional wait for JavaScript-heavy applications
            try:
                # Wait for common loading indicators to disappear
                await page.wait_for_function(
                    """
                    () => {
                        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [id*="loading"]');
                        return loadingElements.length === 0 || Array.from(loadingElements).every(el => 
                            el.style.display === 'none' || !el.offsetParent
                        );
                    }
                    """,
                    timeout=5000
                )
            except:
                # If no loading indicators found or timeout, continue
                pass
            
            # Get page content and metadata
            html_content = await page.content()
            title = await page.title()
            
            # Extract metadata using JavaScript evaluation (more reliable)
            metadata = await page.evaluate("""
                () => {
                    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                                          document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                                          document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || 
                                          "";
                    
                    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || 
                                        document.querySelector('meta[property="og:url"]')?.getAttribute('content') || 
                                        window.location.href;
                    
                    return {
                        metaDescription,
                        canonicalUrl
                    };
                }
            """)
            
            meta_description = metadata.get('metaDescription', '')
            canonical_url = metadata.get('canonicalUrl', url)
            
            # Get page dimensions and scroll height
            page_info = await page.evaluate("""
                () => ({
                    scrollHeight: document.body.scrollHeight,
                    clientHeight: document.documentElement.clientHeight,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                })
            """)
            
            return {
                "url": url,
                "final_url": page_info["url"],
                "title": title,
                "html_content": html_content,
                "meta_description": meta_description,
                "canonical_url": canonical_url,
                "page_info": page_info,
                "status": "success"
            }
            
        except Exception as e:
            error_message = str(e)
            logger.error(f"Error loading page {url}: {error_message}")
            
            # Provide more user-friendly error messages
            if "Timeout" in error_message:
                if "30000ms" in error_message or "timeout" in error_message.lower():
                    error_message = "Page took too long to load. This might be a slow website or network issue."
                else:
                    error_message = f"Timeout while loading page: {error_message}"
            elif "net::ERR_NAME_NOT_RESOLVED" in error_message:
                error_message = "Cannot resolve domain name. Please check if the URL is correct."
            elif "net::ERR_CONNECTION_REFUSED" in error_message:
                error_message = "Connection refused. The server might be down or blocking requests."
            elif "net::ERR_CERT" in error_message:
                error_message = "SSL certificate error. The website might have security issues."
            elif "HTTP 4" in error_message:
                error_message = "Page not found or access denied. Please check the URL."
            elif "HTTP 5" in error_message:
                error_message = "Server error. The website is experiencing technical difficulties."
            
            return {
                "url": url,
                "error": error_message,
                "status": "error"
            }
        finally:
            if page:
                await page.close()
    
    async def execute_extraction_script(
        self,
        url: str,
        script_content: str,
        schema_definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a generated Playwright script to extract data
        """
        if not self.browser:
            await self.initialize()
        
        page = None
        try:
            page = await self.browser.new_page()
            
            # Set viewport and user agent
            await page.set_viewport_size({"width": 1920, "height": 1080})
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            })
            
            # Navigate to the page with extended timeout for complex apps
            response = await page.goto(url, wait_until="domcontentloaded", timeout=90000)
            
            # Wait for content to load with multiple strategies
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except:
                # Fallback wait for complex apps
                await asyncio.sleep(3)
            
            if not response or response.status >= 400:
                raise Exception(f"Failed to load page: HTTP {response.status if response else 'No response'}")
            
            # Execute the extraction script
            extracted_data = await self._execute_script_safely(page, script_content)
            
            # Validate and clean the extracted data
            cleaned_data = self._clean_extracted_data(extracted_data, schema_definition)
            
            return {
                "status": "success",
                "data": cleaned_data,
                "data_count": self._count_extracted_items(cleaned_data),
                "extracted_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error executing extraction script for {url}: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "data": {},
                "data_count": 0,
                "extracted_at": datetime.utcnow().isoformat()
            }
        finally:
            if page:
                await page.close()
    
    async def _execute_script_safely(self, page: Page, script_content: str) -> Any:
        """
        Safely execute the extraction script with timeout and error handling
        """
        try:
            # Clean the script content first
            cleaned_script = script_content.strip()
            
            # Remove any function wrappers if present
            if cleaned_script.startswith('async ()') or cleaned_script.startswith('()'):
                # Extract the function body
                start = cleaned_script.find('{')
                end = cleaned_script.rfind('}')
                if start != -1 and end != -1:
                    cleaned_script = cleaned_script[start+1:end].strip()
            
            # Execute the script directly without wrapping
            result = await asyncio.wait_for(
                page.evaluate(f"(() => {{ {cleaned_script} }})()"),
                timeout=60.0  # 60 second timeout for script execution
            )
            return result
            
        except Exception as e:
            logger.error(f"Script execution failed: {str(e)}")
            raise Exception(f"Script execution failed: {str(e)}")
    
    def _clean_extracted_data(self, data: Any, schema: Dict[str, Any]) -> Any:
        """
        Clean and validate extracted data according to schema
        """
        if not data or isinstance(data, dict) and "error" in data:
            return data
        
        try:
            # If data is a list, clean each item
            if isinstance(data, list):
                cleaned_items = []
                for item in data:
                    cleaned_item = self._clean_data_item(item)
                    if cleaned_item:  # Only add non-empty items
                        cleaned_items.append(cleaned_item)
                return cleaned_items
            
            # If data is a single item, clean it
            elif isinstance(data, dict):
                return self._clean_data_item(data)
            
            # Return as-is if not dict or list
            return data
            
        except Exception as e:
            logger.error(f"Error cleaning extracted data: {str(e)}")
            return data
    
    def _clean_data_item(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Clean a single data item
        """
        if not isinstance(item, dict):
            return item
        
        cleaned_item = {}
        
        for key, value in item.items():
            if value is not None:
                # Clean string values
                if isinstance(value, str):
                    cleaned_value = value.strip()
                    # Remove extra whitespace
                    cleaned_value = re.sub(r'\s+', ' ', cleaned_value)
                    if cleaned_value:  # Only add non-empty strings
                        cleaned_item[key] = cleaned_value
                
                # Clean list values
                elif isinstance(value, list):
                    cleaned_list = [v.strip() if isinstance(v, str) else v for v in value if v]
                    if cleaned_list:
                        cleaned_item[key] = cleaned_list
                
                # Keep other types as-is
                else:
                    cleaned_item[key] = value
        
        return cleaned_item if cleaned_item else None
    
    def _count_extracted_items(self, data: Any) -> int:
        """
        Count the number of items extracted
        """
        if isinstance(data, list):
            return len(data)
        elif isinstance(data, dict) and "error" not in data:
            return 1
        else:
            return 0
    
    async def test_extraction_script(
        self,
        url: str,
        script_content: str,
        limit_items: int = 3
    ) -> Dict[str, Any]:
        """
        Test an extraction script with limited results for validation
        """
        if not self.browser:
            await self.initialize()
        
        page = None
        try:
            page = await self.browser.new_page()
            
            # Set viewport and user agent
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # Navigate to the page
            await page.goto(url, wait_until="networkidle", timeout=20000)
            
            # Modify script to limit results for testing
            limited_script = self._limit_script_results(script_content, limit_items)
            
            # Execute the test script
            test_result = await self._execute_script_safely(page, limited_script)
            
            return {
                "status": "success",
                "test_data": test_result,
                "item_count": self._count_extracted_items(test_result)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "test_data": None,
                "item_count": 0
            }
        finally:
            if page:
                await page.close()
    
    def _limit_script_results(self, script: str, limit: int) -> str:
        """
        Modify script to return limited results for testing
        """
        # Add a slice operation to limit results
        # This is a simple approach - could be more sophisticated
        if "return" in script and "[" in script:
            # Try to add .slice(0, limit) to array results
            script = re.sub(
                r'return\s+([^;]+);',
                f'return (\\1).slice(0, {limit});',
                script
            )
        
        return script
    
    async def get_page_screenshots(self, url: str) -> Dict[str, Any]:
        """
        Take screenshots of the page for debugging/preview purposes
        """
        if not self.browser:
            await self.initialize()
        
        page = None
        try:
            page = await self.browser.new_page()
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            await page.goto(url, wait_until="networkidle")
            
            # Take full page screenshot
            screenshot_buffer = await page.screenshot(full_page=True)
            
            # Convert to base64 for easy transport
            import base64
            screenshot_base64 = base64.b64encode(screenshot_buffer).decode()
            
            return {
                "status": "success",
                "screenshot": screenshot_base64,
                "format": "png"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
        finally:
            if page:
                await page.close()
    
    async def analyze_page_structure(self, url: str) -> Dict[str, Any]:
        """
        Analyze page structure to help with selector generation
        """
        if not self.browser:
            await self.initialize()
        
        page = None
        try:
            page = await self.browser.new_page()
            await page.goto(url, wait_until="networkidle")
            
            # Get structural information
            structure_info = await page.evaluate("""
                () => {
                    const getElementInfo = (element) => {
                        return {
                            tagName: element.tagName.toLowerCase(),
                            id: element.id || null,
                            classes: Array.from(element.classList),
                            textContent: element.textContent?.substring(0, 100) || '',
                            attributes: Array.from(element.attributes).reduce((acc, attr) => {
                                acc[attr.name] = attr.value;
                                return acc;
                            }, {})
                        };
                    };
                    
                    const result = {
                        title: document.title,
                        headings: [],
                        links: [],
                        images: [],
                        forms: [],
                        lists: [],
                        articles: [],
                        sections: []
                    };
                    
                    // Collect headings
                    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                        result.headings.push(getElementInfo(h));
                    });
                    
                    // Collect links
                    document.querySelectorAll('a[href]').forEach(a => {
                        result.links.push(getElementInfo(a));
                    });
                    
                    // Collect images
                    document.querySelectorAll('img[src]').forEach(img => {
                        result.images.push(getElementInfo(img));
                    });
                    
                    // Collect articles and sections
                    document.querySelectorAll('article, section').forEach(el => {
                        result[el.tagName.toLowerCase() + 's'].push(getElementInfo(el));
                    });
                    
                    return result;
                }
            """)
            
            return {
                "status": "success",
                "structure": structure_info
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
        finally:
            if page:
                await page.close()
