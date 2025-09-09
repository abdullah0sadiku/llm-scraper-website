-- Initialize the LLM Scraper database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Scraping Jobs table
CREATE TABLE scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(500) NOT NULL,
    schema_definition JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    user_id VARCHAR(100) DEFAULT 'anonymous' -- For future user management
);

-- Generated Scripts table
CREATE TABLE generated_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    script_content TEXT NOT NULL,
    script_type VARCHAR(50) DEFAULT 'playwright' CHECK (script_type IN ('playwright', 'selenium')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extracted Data table
CREATE TABLE extracted_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES scraping_jobs(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_count INTEGER DEFAULT 0 -- Number of items extracted
);

-- Script Templates table (for reusable patterns)
CREATE TABLE script_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    schema_pattern JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_created_at ON scraping_jobs(created_at);
CREATE INDEX idx_scraping_jobs_url ON scraping_jobs(url);
CREATE INDEX idx_generated_scripts_job_id ON generated_scripts(job_id);
CREATE INDEX idx_extracted_data_job_id ON extracted_data(job_id);
CREATE INDEX idx_extracted_data_extracted_at ON extracted_data(extracted_at);

-- Sample data for testing
INSERT INTO script_templates (name, description, template_content, schema_pattern) VALUES 
(
    'News Articles',
    'Extract news articles with title, content, author, and date',
    'const articles = await page.$$eval("article", articles => articles.map(article => ({ title: article.querySelector("h1, h2, h3")?.textContent?.trim(), content: article.querySelector("p")?.textContent?.trim(), author: article.querySelector(".author")?.textContent?.trim(), date: article.querySelector(".date, time")?.textContent?.trim() })));',
    '{"type": "array", "items": {"title": "string", "content": "string", "author": "string", "date": "string"}}'
),
(
    'Product Listings',
    'Extract product information including name, price, description, and images',
    'const products = await page.$$eval(".product", products => products.map(product => ({ name: product.querySelector("h3, .product-title")?.textContent?.trim(), price: product.querySelector(".price")?.textContent?.trim(), description: product.querySelector(".description")?.textContent?.trim(), image: product.querySelector("img")?.src })));',
    '{"type": "array", "items": {"name": "string", "price": "string", "description": "string", "image": "string"}}'
);

-- Function to update job status
CREATE OR REPLACE FUNCTION update_job_status(job_uuid UUID, new_status VARCHAR(50), error_msg TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE scraping_jobs 
    SET status = new_status, 
        completed_at = CASE WHEN new_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
        error_message = COALESCE(error_msg, error_message)
    WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql;
