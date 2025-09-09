/**
 * Enhanced Schema Definitions for LLM Scraper Frontend
 * Provides Zod validation schemas and TypeScript types
 */

import { z } from 'zod';

// Base field types
export const FieldTypeEnum = z.enum(['string', 'number', 'boolean', 'array', 'object']);
export type FieldType = z.infer<typeof FieldTypeEnum>;

// Schema field definition
export const SchemaFieldSchema = z.object({
  name: z.string().describe("Field name for extraction"),
  type: FieldTypeEnum.describe("Data type of the field"),
  required: z.boolean().default(true).describe("Whether field is required"),
  description: z.string().describe("Human-readable field description"),
  example: z.string().optional().describe("Example value for this field"),
  selectorHints: z.array(z.string()).optional().describe("CSS selector hints for extraction"),
  validationPattern: z.string().optional().describe("Regex pattern for validation"),
  minLength: z.number().optional().describe("Minimum string length"),
  maxLength: z.number().optional().describe("Maximum string length")
});

export type SchemaField = z.infer<typeof SchemaFieldSchema>;

// Enhanced schema definition
export const EnhancedSchemaDefinitionSchema = z.object({
  type: z.enum(['object', 'array']).describe("Schema root type"),
  title: z.string().describe("Human-readable schema title"),
  description: z.string().describe("Schema purpose and usage description"),
  fields: z.record(z.string(), SchemaFieldSchema).describe("Field definitions"),
  examples: z.array(z.record(z.string(), z.any())).optional().describe("Example data structures")
});

export type EnhancedSchemaDefinition = z.infer<typeof EnhancedSchemaDefinitionSchema>;

// News Articles Schema
export const newsArticlesSchema = z.array(
  z.object({
    title: z.string().min(5).max(200).describe("Article headline or main title"),
    content: z.string().min(50).describe("Main article body content, cleaned and formatted"),
    author: z.string().optional().describe("Article author name or byline"),
    published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}|^\w+\s+\d{1,2},\s+\d{4}/).optional().describe("Publication date in ISO format or human-readable format"),
    url: z.string().regex(/^https?:\/\//).optional().describe("Direct URL to the full article"),
    category: z.string().optional().describe("Article category or section"),
    summary: z.string().optional().describe("Article summary or excerpt")
  })
).min(1).describe("Extract structured news article data including headlines, content, metadata, and publication details");

export type NewsArticles = z.infer<typeof newsArticlesSchema>;

// Product Listings Schema
export const productListingsSchema = z.array(
  z.object({
    name: z.string().min(3).max(150).describe("Product name or title"),
    price: z.string().regex(/[\$€£¥]?\d+\.?\d*/).describe("Product price with currency symbol"),
    description: z.string().optional().describe("Detailed product description and features"),
    image_url: z.string().regex(/^https?:\/\/.*\.(jpg|jpeg|png|webp)/).optional().describe("Main product image URL"),
    rating: z.string().regex(/\d\.?\d*\/?\d?|★+/).optional().describe("Product rating score (e.g., '4.5/5' or '4.5 stars')"),
    availability: z.string().optional().describe("Stock status or availability information"),
    brand: z.string().optional().describe("Product brand or manufacturer")
  })
).min(1).describe("Extract e-commerce product information including pricing, descriptions, ratings, and availability");

export type ProductListings = z.infer<typeof productListingsSchema>;

// Contact Information Schema
export const contactInformationSchema = z.object({
  name: z.string().min(2).describe("Full name or business name"),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/).optional().describe("Email address"),
  phone: z.string().regex(/[\+]?[\d\s\-\(\)]{10,}/).optional().describe("Phone number in any format"),
  address: z.string().optional().describe("Physical address or location"),
  website: z.string().regex(/^https?:\/\//).optional().describe("Website URL"),
  social_media: z.string().optional().describe("Social media profiles or handles")
}).describe("Extract business or personal contact details from web pages");

export type ContactInformation = z.infer<typeof contactInformationSchema>;

// Job Listings Schema
export const jobListingsSchema = z.array(
  z.object({
    title: z.string().min(3).max(100).describe("Job title or position name"),
    company: z.string().min(2).max(100).describe("Company or organization name"),
    location: z.string().optional().describe("Job location (city, state, remote, etc.)"),
    salary: z.string().optional().describe("Salary range or compensation details"),
    description: z.string().min(20).describe("Job description and responsibilities"),
    requirements: z.string().optional().describe("Required skills, experience, and qualifications"),
    employment_type: z.string().optional().describe("Full-time, part-time, contract, etc."),
    posted_date: z.string().optional().describe("When the job was posted"),
    apply_url: z.string().regex(/^https?:\/\//).optional().describe("Direct link to apply for the job")
  })
).min(1).describe("Extract job posting information from career pages and job boards");

export type JobListings = z.infer<typeof jobListingsSchema>;

// Social Media Posts Schema
export const socialMediaPostsSchema = z.array(
  z.object({
    content: z.string().min(1).max(2000).describe("Post content or text"),
    author: z.string().optional().describe("Post author username or display name"),
    timestamp: z.string().optional().describe("When the post was created"),
    likes: z.string().optional().describe("Number of likes, hearts, or similar reactions"),
    shares: z.string().optional().describe("Number of shares, retweets, or reposts"),
    comments: z.string().optional().describe("Number of comments or replies"),
    hashtags: z.string().optional().describe("Hashtags used in the post"),
    media_url: z.string().regex(/^https?:\/\//).optional().describe("URL of attached image or video")
  })
).min(1).describe("Extract social media post data including engagement metrics and metadata");

export type SocialMediaPosts = z.infer<typeof socialMediaPostsSchema>;

// Event Listings Schema
export const eventListingsSchema = z.array(
  z.object({
    title: z.string().min(3).max(150).describe("Event name or title"),
    description: z.string().optional().describe("Event description and details"),
    date: z.string().optional().describe("Event date and time"),
    location: z.string().optional().describe("Event venue or location"),
    price: z.string().optional().describe("Ticket price or admission cost"),
    organizer: z.string().optional().describe("Event organizer or host"),
    category: z.string().optional().describe("Event type or category"),
    registration_url: z.string().regex(/^https?:\/\//).optional().describe("Link to register or buy tickets")
  })
).min(1).describe("Extract event information from event listing pages and calendars");

export type EventListings = z.infer<typeof eventListingsSchema>;

// Enhanced schema registry
export const ENHANCED_SCHEMAS = {
  news_articles: {
    schema: newsArticlesSchema,
    definition: {
      type: 'array' as const,
      title: 'News Articles',
      description: 'Extract structured news article data including headlines, content, metadata, and publication details',
      fields: {
        title: {
          name: 'title',
          type: 'string' as FieldType,
          required: true,
          description: 'Article headline or main title',
          example: 'Breaking: Major Technology Breakthrough Announced',
          selectorHints: ['h1', 'h2', '.headline', '.title', '[data-testid="headline"]'],
          minLength: 5,
          maxLength: 200
        },
        content: {
          name: 'content',
          type: 'string' as FieldType,
          required: true,
          description: 'Main article body content, cleaned and formatted',
          example: 'Scientists at MIT have developed a revolutionary new approach...',
          selectorHints: ['article', '.content', '.article-body', 'p', '.text'],
          minLength: 50
        },
        author: {
          name: 'author',
          type: 'string' as FieldType,
          required: false,
          description: 'Article author name or byline',
          example: 'John Smith, Technology Reporter',
          selectorHints: ['.author', '.byline', '[rel="author"]', '.writer']
        },
        published_date: {
          name: 'published_date',
          type: 'string' as FieldType,
          required: false,
          description: 'Publication date in ISO format or human-readable format',
          example: '2024-01-15T10:30:00Z',
          selectorHints: ['time', '.date', '.published', '[datetime]'],
          validationPattern: '^\\d{4}-\\d{2}-\\d{2}|^\\w+\\s+\\d{1,2},\\s+\\d{4}'
        },
        url: {
          name: 'url',
          type: 'string' as FieldType,
          required: false,
          description: 'Direct URL to the full article',
          example: 'https://example.com/news/article-123',
          selectorHints: ['a[href]', 'link[rel="canonical"]'],
          validationPattern: '^https?://'
        },
        category: {
          name: 'category',
          type: 'string' as FieldType,
          required: false,
          description: 'Article category or section',
          example: 'Technology',
          selectorHints: ['.category', '.section', '.tag', '[data-category]']
        },
        summary: {
          name: 'summary',
          type: 'string' as FieldType,
          required: false,
          description: 'Article summary or excerpt',
          example: 'A brief overview of the main points...',
          selectorHints: ['.summary', '.excerpt', '.description', 'meta[name="description"]']
        }
      },
      examples: [
        {
          title: 'AI Breakthrough in Medical Diagnosis',
          content: 'Researchers have developed an AI system that can diagnose rare diseases...',
          author: 'Dr. Sarah Johnson',
          published_date: '2024-01-15T09:00:00Z',
          url: 'https://medicalnews.com/ai-diagnosis-breakthrough',
          category: 'Healthcare',
          summary: 'New AI system shows 95% accuracy in diagnosing rare conditions'
        }
      ]
    }
  },
  
  product_listings: {
    schema: productListingsSchema,
    definition: {
      type: 'array' as const,
      title: 'Product Listings',
      description: 'Extract e-commerce product information including pricing, descriptions, ratings, and availability',
      fields: {
        name: {
          name: 'name',
          type: 'string' as FieldType,
          required: true,
          description: 'Product name or title',
          example: 'Wireless Bluetooth Headphones - Premium Quality',
          selectorHints: ['.product-title', 'h1', '.name', '[data-testid="product-name"]'],
          minLength: 3,
          maxLength: 150
        },
        price: {
          name: 'price',
          type: 'string' as FieldType,
          required: true,
          description: 'Product price with currency symbol',
          example: '$99.99',
          selectorHints: ['.price', '.cost', '[data-price]', '.amount'],
          validationPattern: '[\\$€£¥]?\\d+\\.?\\d*'
        },
        description: {
          name: 'description',
          type: 'string' as FieldType,
          required: false,
          description: 'Detailed product description and features',
          example: 'High-quality wireless headphones with noise cancellation...',
          selectorHints: ['.description', '.details', '.features', '.product-info']
        },
        image_url: {
          name: 'image_url',
          type: 'string' as FieldType,
          required: false,
          description: 'Main product image URL',
          example: 'https://example.com/images/product-123.jpg',
          selectorHints: ['img[src]', '.product-image img', '[data-image]'],
          validationPattern: '^https?://.*\\.(jpg|jpeg|png|webp)'
        },
        rating: {
          name: 'rating',
          type: 'string' as FieldType,
          required: false,
          description: 'Product rating score (e.g., "4.5/5" or "4.5 stars")',
          example: '4.5/5',
          selectorHints: ['.rating', '.stars', '[data-rating]', '.score'],
          validationPattern: '\\d\\.?\\d*/\\d?|★+'
        },
        availability: {
          name: 'availability',
          type: 'string' as FieldType,
          required: false,
          description: 'Stock status or availability information',
          example: 'In Stock',
          selectorHints: ['.availability', '.stock', '.status', '[data-stock]']
        },
        brand: {
          name: 'brand',
          type: 'string' as FieldType,
          required: false,
          description: 'Product brand or manufacturer',
          example: 'TechBrand',
          selectorHints: ['.brand', '.manufacturer', '[data-brand]']
        }
      },
      examples: [
        {
          name: 'Sony WH-1000XM4 Wireless Headphones',
          price: '$349.99',
          description: 'Industry-leading noise canceling with Dual Noise Sensor technology',
          image_url: 'https://example.com/images/sony-headphones.jpg',
          rating: '4.7/5',
          availability: 'In Stock',
          brand: 'Sony'
        }
      ]
    }
  },
  
  contact_information: {
    schema: contactInformationSchema,
    definition: {
      type: 'object' as const,
      title: 'Contact Information',
      description: 'Extract business or personal contact details from web pages',
      fields: {
        name: {
          name: 'name',
          type: 'string' as FieldType,
          required: true,
          description: 'Full name or business name',
          example: 'John Smith / Acme Corporation',
          selectorHints: ['.name', 'h1', '.company', '.business-name'],
          minLength: 2
        },
        email: {
          name: 'email',
          type: 'string' as FieldType,
          required: false,
          description: 'Email address',
          example: 'contact@example.com',
          selectorHints: ['[href^="mailto:"]', '.email', '[data-email]'],
          validationPattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        phone: {
          name: 'phone',
          type: 'string' as FieldType,
          required: false,
          description: 'Phone number in any format',
          example: '+1 (555) 123-4567',
          selectorHints: ['[href^="tel:"]', '.phone', '.tel', '[data-phone]'],
          validationPattern: '[\\+]?[\\d\\s\\-\\(\\)]{10,}'
        },
        address: {
          name: 'address',
          type: 'string' as FieldType,
          required: false,
          description: 'Physical address or location',
          example: '123 Main St, New York, NY 10001',
          selectorHints: ['.address', '.location', '[data-address]']
        },
        website: {
          name: 'website',
          type: 'string' as FieldType,
          required: false,
          description: 'Website URL',
          example: 'https://www.example.com',
          selectorHints: ['[href^="http"]', '.website', '.url'],
          validationPattern: '^https?://'
        },
        social_media: {
          name: 'social_media',
          type: 'string' as FieldType,
          required: false,
          description: 'Social media profiles or handles',
          example: '@company_handle',
          selectorHints: ['.social', '[href*="twitter"]', '[href*="linkedin"]', '[href*="facebook"]']
        }
      },
      examples: [
        {
          name: 'Tech Solutions Inc.',
          email: 'info@techsolutions.com',
          phone: '+1 (555) 987-6543',
          address: '456 Innovation Drive, San Francisco, CA 94107',
          website: 'https://www.techsolutions.com',
          social_media: '@techsolutions'
        }
      ]
    }
  }
} as const;

// Utility functions
export function getSchemaByName(name: keyof typeof ENHANCED_SCHEMAS) {
  return ENHANCED_SCHEMAS[name];
}

export function listAvailableSchemas(): string[] {
  return Object.keys(ENHANCED_SCHEMAS);
}

export function validateSchemaData<T extends keyof typeof ENHANCED_SCHEMAS>(
  data: unknown,
  schemaName: T
): any {
  const schema = ENHANCED_SCHEMAS[schemaName].schema;
  return schema.parse(data);
}

// Convert enhanced schema to JSON Schema format
export function toJsonSchema(definition: EnhancedSchemaDefinition): object {
  if (definition.type === "array") {
    return {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "array",
      "title": definition.title,
      "description": definition.description,
      "items": {
        "type": "object",
        "properties": Object.fromEntries(
          Object.entries(definition.fields).map(([name, field]) => [
            name,
            {
              "type": field.type,
              "description": field.description,
              ...(field.validationPattern && { "pattern": field.validationPattern }),
              ...(field.minLength && { "minLength": field.minLength }),
              ...(field.maxLength && { "maxLength": field.maxLength }),
              ...(field.example && { "examples": [field.example] })
            }
          ])
        ),
        "required": Object.entries(definition.fields)
          .filter(([, field]) => field.required)
          .map(([name]) => name),
        "additionalProperties": false
      },
      "minItems": 1,
      ...(definition.examples && { "examples": definition.examples })
    };
  } else {
    return {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "title": definition.title,
      "description": definition.description,
      "properties": Object.fromEntries(
        Object.entries(definition.fields).map(([name, field]) => [
          name,
          {
            "type": field.type,
            "description": field.description,
            ...(field.validationPattern && { "pattern": field.validationPattern }),
            ...(field.minLength && { "minLength": field.minLength }),
            ...(field.maxLength && { "maxLength": field.maxLength }),
            ...(field.example && { "examples": [field.example] })
          }
        ])
      ),
      "required": Object.entries(definition.fields)
        .filter(([, field]) => field.required)
        .map(([name]) => name),
      "additionalProperties": false,
      ...(definition.examples && { "examples": definition.examples })
    };
  }
}
