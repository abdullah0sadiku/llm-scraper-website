import axios, { AxiosResponse } from 'axios';
import { 
  ScrapingJob, 
  CreateJobRequest, 
  ExtractedData, 
  GeneratedScript, 
  URLValidationResult,
  SuggestedSchema,
  ScriptTemplate,
  ApiError
} from '../types';

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  // In production (Docker), use relative path which will be proxied by nginx
  if (import.meta.env.PROD) {
    return '/api';
  }
  // In development, use the backend port directly
  return 'http://localhost:3020/api';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 90000, // Increased to 90 seconds for complex apps
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Transform error for consistent handling
    const apiError: ApiError = {
      detail: error.response?.data?.detail || error.message || 'Unknown error occurred',
      message: error.response?.data?.message,
      status: error.response?.status
    };
    
    return Promise.reject(apiError);
  }
);

// Scraping Jobs API
export const scrapingApi = {
  // Create a new scraping job
  createJob: async (jobData: CreateJobRequest): Promise<ScrapingJob> => {
    const response: AxiosResponse<ScrapingJob> = await api.post('/scraping/jobs', jobData);
    return response.data;
  },

  // Get all jobs
  getJobs: async (limit: number = 50, offset: number = 0): Promise<ScrapingJob[]> => {
    const response: AxiosResponse<ScrapingJob[]> = await api.get('/scraping/jobs', {
      params: { limit, offset }
    });
    return response.data;
  },

  // Get specific job
  getJob: async (jobId: string): Promise<ScrapingJob> => {
    const response: AxiosResponse<ScrapingJob> = await api.get(`/scraping/jobs/${jobId}`);
    return response.data;
  },

  // Get job results
  getJobResults: async (jobId: string): Promise<any> => {
    const response = await api.get(`/scraping/jobs/${jobId}/results`);
    return response.data;
  },

  // Get job script
  getJobScript: async (jobId: string): Promise<GeneratedScript> => {
    const response: AxiosResponse<GeneratedScript> = await api.get(`/scraping/jobs/${jobId}/script`);
    return response.data;
  },

  // Start a job
  startJob: async (jobId: string): Promise<{ status: string; message: string }> => {
    const response = await api.post(`/scraping/jobs/${jobId}/start`);
    return response.data;
  },

  // Cancel a job
  cancelJob: async (jobId: string): Promise<{ status: string; message: string }> => {
    const response = await api.post(`/scraping/jobs/${jobId}/cancel`);
    return response.data;
  },

  // Rerun a job
  rerunJob: async (jobId: string): Promise<{ status: string; message: string; new_job_id: string; original_job_id: string }> => {
    const response = await api.post(`/scraping/jobs/${jobId}/rerun`);
    return response.data;
  },

  // Delete a job
  deleteJob: async (jobId: string): Promise<{ status: string; message: string }> => {
    const response = await api.delete(`/scraping/jobs/${jobId}`);
    return response.data;
  },

  // Get active jobs
  getActiveJobs: async (): Promise<{ active_jobs_count: number; active_job_ids: string[] }> => {
    const response = await api.get('/scraping/active-jobs');
    return response.data;
  },

  // Validate URL
  validateUrl: async (url: string): Promise<URLValidationResult> => {
    const response: AxiosResponse<URLValidationResult> = await api.post('/scraping/validate-url', { url });
    return response.data;
  },

  // Suggest schema for URL
  suggestSchema: async (url: string): Promise<SuggestedSchema> => {
    const response: AxiosResponse<SuggestedSchema> = await api.post('/scraping/suggest-schema', { url });
    return response.data;
  },

  // Get script templates
  getTemplates: async (): Promise<{ templates: ScriptTemplate[] }> => {
    const response = await api.get('/scraping/templates');
    return response.data;
  },

  // Test extraction script
  testExtraction: async (url: string, scriptContent: string): Promise<any> => {
    const response = await api.post('/scraping/test-extraction', {
      url,
      script_content: scriptContent
    });
    return response.data;
  },

  // Analyze extraction method
  analyzeExtraction: async (url: string, schema_definition: Record<string, any>): Promise<any> => {
    const response = await api.post('/scraping/analyze-extraction', {
      url,
      schema_definition
    });
    return response.data;
  }
};

// Health check API
export const healthApi = {
  checkHealth: async (): Promise<{ status: string; database: string; timestamp: string }> => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Export the configured axios instance for direct use if needed
export { api };

// Utility functions for data export
export const exportUtils = {
  exportToJson: (data: any, filename: string = 'scraped-data.json') => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportToCsv: (data: any[], filename: string = 'scraped-data.csv') => {
    if (!Array.isArray(data) || data.length === 0) {
      console.error('Data must be a non-empty array for CSV export');
      return;
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
