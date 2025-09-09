// API Response Types
export interface ScrapingJob {
  id: string;
  url: string;
  schema_definition: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  error_message?: string;
  user_id: string;
}

export interface ExtractedData {
  id: string;
  job_id: string;
  data: Record<string, any>;
  extracted_at: string;
  data_count: number;
}

export interface GeneratedScript {
  script_id: string;
  job_id: string;
  script_content: string;
  script_type: string;
  created_at: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description?: string;
  schema: Record<string, any>;
}

// Form Types
export interface CreateJobRequest {
  url: string;
  schema_definition: Record<string, any>;
}

export interface URLValidationResult {
  valid: boolean;
  error?: string;
  url: string;
  final_url?: string;
  title?: string;
  description?: string;
}

export interface SuggestedSchema {
  status: 'success' | 'error';
  url: string;
  suggested_schema?: Record<string, any>;
  page_title?: string;
  page_description?: string;
  error?: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'job_started' | 'job_progress' | 'job_completed' | 'job_failed' | 'job_cancelled' | 'job_status_update' | 'subscribed' | 'unsubscribed' | 'error' | 'pong';
  job_id?: string;
  timestamp?: number | string;
  url?: string;
  status?: string;
  stage?: string;
  progress?: number;
  details?: string;
  data_count?: number;
  error?: string;
  error_message?: string;
  message?: string;
  results_available?: boolean;
}

// Schema Builder Types
export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  example?: string;
}

export interface SchemaDefinition {
  type: 'object' | 'array';
  items?: Record<string, SchemaField>;
  properties?: Record<string, SchemaField>;
}

// Component Props Types
export interface JobCardProps {
  job: ScrapingJob;
  onView: (job: ScrapingJob) => void;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onRerun: (job: ScrapingJob) => void;
}

export interface ResultsViewerProps {
  jobId: string;
  data: any;
  dataCount: number;
  extractedAt: string;
  onExport: (format: 'json' | 'csv') => void;
}

export interface ScriptViewerProps {
  script: GeneratedScript;
  onEdit?: (script: string) => void;
  onTest?: (script: string) => void;
  readOnly?: boolean;
}

export interface SchemaBuilderProps {
  initialSchema?: Record<string, any>;
  onSchemaChange: (schema: Record<string, any>) => void;
  templates: ScriptTemplate[];
}

// Utility Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Export utility type for API error handling
export interface ApiError {
  detail: string;
  message?: string;
  status?: number;
}

// Job status color mapping
export const JOB_STATUS_COLORS = {
  pending: 'text-yellow-600 bg-yellow-100',
  running: 'text-blue-600 bg-blue-100',
  completed: 'text-green-600 bg-green-100',
  failed: 'text-red-600 bg-red-100',
  cancelled: 'text-gray-600 bg-gray-100'
} as const;

// Enhanced schema types (temporarily simplified)
// export * from '../schemas/extraction-schemas';

// Common schema examples (fallback)
export const EXAMPLE_SCHEMAS = {
  news_articles: {
    type: 'array',
    items: {
      title: { type: 'string', required: true },
      content: { type: 'string', required: true },
      author: { type: 'string', required: false },
      date: { type: 'string', required: false },
      url: { type: 'string', required: false }
    }
  },
  product_listings: {
    type: 'array',
    items: {
      name: { type: 'string', required: true },
      price: { type: 'string', required: true },
      description: { type: 'string', required: false },
      image: { type: 'string', required: false },
      rating: { type: 'string', required: false }
    }
  },
  contact_info: {
    type: 'object',
    properties: {
      name: { type: 'string', required: true },
      email: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      address: { type: 'string', required: false }
    }
  }
} as const;
