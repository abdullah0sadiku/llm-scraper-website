import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { 
  Globe, 
  Wand2, 
  Play, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  ExternalLink,
  Newspaper,
  ShoppingCart,
  User,
  FileText,
  CreditCard,
  MessageSquare,
  Calendar,
  Table
} from 'lucide-react';
import { scrapingApi } from '../services/api';
import { CreateJobRequest } from '../types';
import { ZOD_SCHEMAS, zodToJsonSchema } from '../schemas/zod-schemas';
import { z } from 'zod';
import SchemaBuilder from '../components/SchemaBuilder';
import toast from 'react-hot-toast';

const CreateJob: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [url, setUrl] = useState('');
  const [schema, setSchema] = useState<Record<string, any>>({});
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{
    valid: boolean;
    title?: string;
    description?: string;
    error?: string;
  } | null>(null);
  const [suggestedSchema, setSuggestedSchema] = useState<Record<string, any> | null>(null);
  const [isSuggestingSchema, setIsSuggestingSchema] = useState(false);
  const [autoSuggestionEnabled, setAutoSuggestionEnabled] = useState(true);
  const [schemaBuilderKey, setSchemaBuilderKey] = useState(0);
  const [extractionAnalysis, setExtractionAnalysis] = useState<any>(null);
  const [isAnalyzingExtraction, setIsAnalyzingExtraction] = useState(false);

  // Pre-fill from URL params if available
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const schemaParam = searchParams.get('schema');
    
    if (urlParam) {
      setUrl(urlParam);
      validateUrl(urlParam);
    }
    
    if (schemaParam) {
      try {
        const parsedSchema = JSON.parse(schemaParam);
        setSchema(parsedSchema);
      } catch (error) {
        console.error('Failed to parse schema from URL params:', error);
      }
    }
  }, [searchParams]);

  const createJobMutation = useMutation({
    mutationFn: (jobData: CreateJobRequest) => scrapingApi.createJob(jobData),
    onSuccess: (job) => {
      toast.success('Scraping job created successfully!');
      navigate(`/jobs/${job.id}`);
    },
    onError: (error: any) => {
      toast.error(`Failed to create job: ${error.detail}`);
    }
  });

  const validateUrl = async (urlToValidate: string) => {
    if (!urlToValidate) return;

    setIsValidatingUrl(true);
    try {
      const result = await scrapingApi.validateUrl(urlToValidate);
      setUrlValidation(result);
      
      if (result.valid) {
        toast.success('URL is accessible and ready for scraping');
        
        // Auto-trigger smart AI schema suggestion
        if (autoSuggestionEnabled) {
          setTimeout(() => {
            suggestSchemaForUrl();
          }, 500);
        }
      } else {
        toast.error(`URL validation failed: ${result.error}`);
      }
    } catch (error: any) {
      setUrlValidation({
        valid: false,
        error: error.detail || 'Failed to validate URL'
      });
      toast.error('Failed to validate URL');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const suggestSchemaForUrl = async () => {
    if (!url || !urlValidation?.valid) return;

    setIsSuggestingSchema(true);
    try {
      const result = await scrapingApi.suggestSchema(url);
      
      if (result.status === 'success' && result.suggested_schema) {
        setSuggestedSchema(result.suggested_schema);
        toast.success('Schema suggestion generated successfully!');
      } else {
        toast.error(`Failed to suggest schema: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Failed to suggest schema: ${error.detail}`);
    } finally {
      setIsSuggestingSchema(false);
    }
  };

  const applySuggestedSchema = () => {
    if (suggestedSchema) {
      // The AI service returns the schema in a nested format
      const schemaToApply = suggestedSchema.schema || suggestedSchema;
      setSchema(schemaToApply);
      // Force SchemaBuilder to re-initialize with new schema
      setSchemaBuilderKey(prev => prev + 1);
      setSuggestedSchema(null);
      toast.success('AI suggested schema applied');
    }
  };

  // Convert Zod schema to format that works with our system
  const convertZodToWorkingSchema = (zodSchema: any) => {
    try {
      // Convert Zod schema to JSON Schema first
      const jsonSchema = zodToJsonSchema(zodSchema);
      
      // For simple object schemas (like your dulla.me example)
      if (jsonSchema.type === 'object' && jsonSchema.properties) {
        const properties: any = {};
        
        Object.entries(jsonSchema.properties).forEach(([fieldName, fieldDef]: [string, any]) => {
          properties[fieldName] = {
            type: fieldDef.type || 'string',
            required: jsonSchema.required?.includes(fieldName) || false,
            description: fieldDef.description || ''
          };
        });
        
        return {
          type: 'object',
          properties
        };
      }
      
      // For array schemas (like our predefined templates)
      if (jsonSchema.type === 'object' && jsonSchema.properties) {
        // Check if it's a schema with array fields
        const firstProperty = Object.values(jsonSchema.properties)[0] as any;
        if (firstProperty && firstProperty.type === 'array' && firstProperty.items) {
          const arrayItems = firstProperty.items;
          if (arrayItems.type === 'object' && arrayItems.properties) {
            const items: any = {};
            
            Object.entries(arrayItems.properties).forEach(([fieldName, fieldDef]: [string, any]) => {
              items[fieldName] = {
                type: fieldDef.type || 'string',
                required: arrayItems.required?.includes(fieldName) || false,
                description: fieldDef.description || ''
              };
            });
            
            return {
              type: 'array',
              items
            };
          }
        }
      }
      
      // Fallback: return the JSON schema as-is
      return jsonSchema;
      
    } catch (error) {
      console.error('Error converting Zod schema:', error);
      // Ultimate fallback
      return {
        type: 'object',
        properties: {
          title: { type: 'string', required: true, description: 'Main title' },
          description: { type: 'string', required: false, description: 'Description' }
        }
      };
    }
  };

  const analyzeExtractionMethod = async () => {
    if (!url || !schema || Object.keys(schema).length === 0) {
      toast.error('Please enter a URL and define a schema first');
      return;
    }

    setIsAnalyzingExtraction(true);
    try {
      const result = await scrapingApi.analyzeExtraction(url, schema);
      setExtractionAnalysis(result);
      toast.success(`Analysis complete: ${result.analysis.method} extraction recommended`);
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.detail}`);
    } finally {
      setIsAnalyzingExtraction(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      toast.error('Please enter a URL');
      return;
    }

    if (!schema || Object.keys(schema).length === 0) {
      toast.error('Please define a schema');
      return;
    }

    if (urlValidation && !urlValidation.valid) {
      toast.error('Please fix URL validation errors first');
      return;
    }

    const jobData: CreateJobRequest = {
      url,
      schema_definition: schema
    };

    createJobMutation.mutate(jobData);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setUrlValidation(null);
    setSuggestedSchema(null);
  };

  const handleUrlBlur = () => {
    if (url && url !== searchParams.get('url')) {
      validateUrl(url);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Scraping Job</h1>
        <p className="text-gray-600 mt-2">
          Enter a URL and define what data you want to extract. Our AI will generate a custom Playwright script for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* URL Input */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Target Website
            </h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Website URL
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Validation may take up to 90 seconds for complex applications with heavy JavaScript
              </p>
              <div className="flex space-x-3">
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={handleUrlChange}
                  onBlur={handleUrlBlur}
                  placeholder="https://example.com"
                  className="input flex-1"
                  required
                />
                <button
                  type="button"
                  onClick={() => validateUrl(url)}
                  disabled={!url || isValidatingUrl}
                  className="btn btn-outline"
                  title={isValidatingUrl ? "Validating... This may take up to 90 seconds for complex apps" : "Validate URL accessibility"}
                >
                  {isValidatingUrl ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Validating...
                    </>
                  ) : (
                    'Validate'
                  )}
                </button>
              </div>
            </div>

            {/* URL Validation Results */}
            {urlValidation && (
              <div className={`
                p-4 rounded-lg border
                ${urlValidation.valid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
                }
              `}>
                <div className="flex items-start space-x-2">
                  {urlValidation.valid ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      urlValidation.valid ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {urlValidation.valid ? 'URL is accessible' : 'URL validation failed'}
                    </p>
                    
                    {urlValidation.valid && (
                      <div className="mt-2 space-y-1">
                        {urlValidation.title && (
                          <p className="text-sm text-green-700">
                            <strong>Title:</strong> {urlValidation.title}
                          </p>
                        )}
                        {urlValidation.description && (
                          <p className="text-sm text-green-700">
                            <strong>Description:</strong> {urlValidation.description}
                          </p>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-green-600 hover:text-green-700"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Preview website
                        </a>
                      </div>
                    )}
                    
                    {!urlValidation.valid && urlValidation.error && (
                      <p className="text-sm text-red-700 mt-1">
                        {urlValidation.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Schema Templates */}
            {urlValidation?.valid && (
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Choose a Schema Template</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select a pre-built schema template or let AI suggest one based on your URL
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {Object.entries(ZOD_SCHEMAS).map(([key, zodSchemaInfo]) => {
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            // Convert Zod schema to a format that SchemaBuilder can handle
                            const workingSchema = convertZodToWorkingSchema(zodSchemaInfo.schema);
                            setSchema(workingSchema);
                            setSchemaBuilderKey(prev => prev + 1);
                            setSuggestedSchema(null);
                            toast.success(`Applied ${zodSchemaInfo.name} template`);
                          }}
                          className="p-4 text-left border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            {key === 'news_articles' && <Newspaper className="h-5 w-5 text-blue-600" />}
                            {key === 'products' && <ShoppingCart className="h-5 w-5 text-green-600" />}
                            {key === 'contacts' && <User className="h-5 w-5 text-purple-600" />}
                            {key === 'jobs' && <User className="h-5 w-5 text-indigo-600" />}
                            {key === 'social_media' && <MessageSquare className="h-5 w-5 text-pink-600" />}
                            {key === 'events' && <Calendar className="h-5 w-5 text-yellow-600" />}
                            {key === 'table_data' && <Table className="h-5 w-5 text-gray-600" />}
                            {key === 'page_content' && <FileText className="h-5 w-5 text-orange-600" />}
                            {key === 'bank_dashboard' && <CreditCard className="h-5 w-5 text-emerald-600" />}
                            <h4 className="font-medium text-gray-900 group-hover:text-blue-900">
                              {zodSchemaInfo.name}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 group-hover:text-blue-700">
                            {zodSchemaInfo.description}
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
                            Zod Schema • {zodSchemaInfo.examples.length} examples
                          </div>
                          <div className="mt-1 text-xs text-blue-600">
                            {zodSchemaInfo.examples.slice(0, 2).join(', ')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="text-center">
                    <span className="text-sm text-gray-500">or</span>
                  </div>
                </div>

                {/* AI Schema Suggestion */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={suggestSchemaForUrl}
                    disabled={isSuggestingSchema}
                    className="btn btn-outline"
                  >
                    {isSuggestingSchema ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    AI Suggest Custom Schema
                  </button>
                  <p className="text-sm text-gray-600">
                    Let AI analyze the page and suggest a custom schema
                  </p>
                </div>
              </div>
            )}

            {/* Suggested Schema */}
            {suggestedSchema && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 animate-in slide-in-from-top duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Wand2 className="h-5 w-5 text-blue-600 animate-pulse" />
                    <div>
                      <h3 className="font-medium text-blue-900">AI Suggested Schema</h3>
                      <p className="text-xs text-blue-700 mt-1">Click "Apply" to use this schema in the builder below</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setSuggestedSchema(null)}
                      className="btn btn-outline btn-sm text-gray-600"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={applySuggestedSchema}
                      className="btn btn-primary btn-sm animate-pulse"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Apply Schema
                    </button>
                  </div>
                </div>
                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto shadow-inner">
                  {JSON.stringify(suggestedSchema, null, 2)}
                </pre>
                <div className="mt-3 text-xs text-blue-600 bg-blue-100 p-2 rounded">
                  💡 <strong>Tip:</strong> This schema will replace your current schema builder configuration
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schema Builder */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Data Schema</h2>
            <p className="text-sm text-gray-600 mt-1">
              Define what data you want to extract from the webpage
            </p>
          </div>
          <div className="card-body">
            <SchemaBuilder
              key={schemaBuilderKey}
              initialSchema={schema}
              onSchemaChange={setSchema}
            />
            
            {/* Extraction Analysis */}
            {urlValidation?.valid && schema && Object.keys(schema).length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-md font-medium text-gray-900">Extraction Method Analysis</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Analyze your URL and schema to determine the best extraction approach
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={analyzeExtractionMethod}
                    disabled={isAnalyzingExtraction}
                    className="btn btn-outline"
                  >
                    {isAnalyzingExtraction ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Analyze Extraction
                  </button>
                </div>

                {/* Analysis Results */}
                {extractionAnalysis && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {extractionAnalysis.analysis.method === 'playwright' ? (
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            🎭
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            ⚡
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {extractionAnalysis.analysis.method === 'playwright' ? 'Playwright' : 'JavaScript'} Recommended
                          </h4>
                          <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {Math.round(extractionAnalysis.analysis.complexity_score * 100)}% complexity
                          </div>
                        </div>
                        
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-line text-gray-700 text-sm mb-4">
                            {extractionAnalysis.recommendation}
                          </div>
                        </div>

                        {/* Analysis Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div className="bg-white rounded-lg p-4 border border-blue-100">
                            <h5 className="font-medium text-gray-900 mb-2">Analysis Reasons</h5>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {extractionAnalysis.analysis.reasons.slice(0, 4).map((reason: string, idx: number) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <div className="bg-white rounded-lg p-4 border border-blue-100">
                            <h5 className="font-medium text-gray-900 mb-2">Extraction Hints</h5>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {extractionAnalysis.analysis.extraction_hints.slice(0, 4).map((hint: string, idx: number) => (
                                <li key={idx} className="flex items-start space-x-2">
                                  <span className="text-green-500 mt-0.5">💡</span>
                                  <span>{hint}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Performance Estimates */}
                        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Estimated Load Time:</span>
                            <span className="font-medium text-gray-900">
                              {extractionAnalysis.analysis.estimated_load_time} seconds
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-600">User Interaction Required:</span>
                            <span className={`font-medium ${
                              extractionAnalysis.analysis.requires_interaction ? 'text-orange-600' : 'text-green-600'
                            }`}>
                              {extractionAnalysis.analysis.requires_interaction ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn btn-outline"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={
              !url || 
              !schema || 
              Object.keys(schema).length === 0 || 
              createJobMutation.isPending ||
              (urlValidation && !urlValidation.valid)
            }
            className="btn btn-primary"
          >
            {createJobMutation.isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Create Scraping Job
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateJob;
