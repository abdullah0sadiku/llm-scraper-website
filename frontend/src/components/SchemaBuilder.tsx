import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Lightbulb, Copy, Check, AlertTriangle, Edit3, Eye, Code2 } from 'lucide-react';
import { ScriptTemplate, EXAMPLE_SCHEMAS } from '../types';
import { z } from 'zod';
import { SchemaFieldSchema, EnhancedSchemaDefinitionSchema, FieldTypeEnum } from '../schemas/extraction-schemas';

// Use Zod schema for validation
const ZodSchemaFieldSchema = SchemaFieldSchema.extend({
  id: z.string(),
  selectorHints: z.array(z.string()).optional(),
  validationPattern: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
});

type ZodSchemaField = z.infer<typeof ZodSchemaFieldSchema>;

interface SchemaField extends ZodSchemaField {}

interface SchemaBuilderProps {
  initialSchema?: Record<string, any>;
  onSchemaChange: (schema: Record<string, any>) => void;
  templates?: ScriptTemplate[];
}

// Validation error type
interface ValidationError {
  field: string;
  message: string;
}

const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  initialSchema,
  onSchemaChange,
  templates = []
}) => {
  const [schemaType, setSchemaType] = useState<'object' | 'array'>('array');
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showAdvancedFields, setShowAdvancedFields] = useState<Record<string, boolean>>({});
  
  // Manual editor states
  const [editorMode, setEditorMode] = useState<'visual' | 'manual'>('visual');
  const [manualSchemaText, setManualSchemaText] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [isEditingManual, setIsEditingManual] = useState(false);

  // Generate unique ID for fields
  const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Initialize from initial schema (only once)
  useEffect(() => {
    if (initialSchema && fields.length === 0) {
      if (initialSchema.type === 'array' && initialSchema.items) {
        setSchemaType('array');
        const itemFields = Object.entries(initialSchema.items).map(([name, config]: [string, any]) => ({
          id: generateFieldId(),
          name,
          type: config.type || 'string',
          required: config.required || false,
          description: config.description || ''
        }));
        setFields(itemFields);
      } else if (initialSchema.type === 'object' && initialSchema.properties) {
        setSchemaType('object');
        const propFields = Object.entries(initialSchema.properties).map(([name, config]: [string, any]) => ({
          id: generateFieldId(),
          name,
          type: config.type || 'string',
          required: config.required || false,
          description: config.description || ''
        }));
        setFields(propFields);
      }
    } else if (!initialSchema && fields.length === 0) {
      // Default fields for new schema
      setFields([
        { 
          id: generateFieldId(),
          name: 'title', 
          type: 'string', 
          required: true, 
          description: 'Main title or heading' 
        },
        { 
          id: generateFieldId(),
          name: 'content', 
          type: 'string', 
          required: false, 
          description: 'Main content or description' 
        }
      ]);
    }
  }, [initialSchema]); // Only depend on initialSchema

  // Build schema from current state with Zod validation
  const buildSchema = useCallback(() => {
    const fieldDefinitions = fields.reduce((acc, field) => {
      if (field.name.trim()) { // Only include fields with names
        acc[field.name] = {
          type: field.type,
          required: field.required,
          ...(field.description && { description: field.description }),
          ...(field.selectorHints && field.selectorHints.length > 0 && { selectorHints: field.selectorHints }),
          ...(field.validationPattern && { validationPattern: field.validationPattern }),
          ...(field.minLength && { minLength: field.minLength }),
          ...(field.maxLength && { maxLength: field.maxLength }),
          ...(field.example && { example: field.example })
        };
      }
      return acc;
    }, {} as Record<string, any>);

    if (schemaType === 'array') {
      return {
        type: 'array',
        items: fieldDefinitions
      };
    } else {
      return {
        type: 'object',
        properties: fieldDefinitions
      };
    }
  }, [schemaType, fields]);

  // Memoize the schema to prevent unnecessary re-renders
  const currentSchema = useMemo(() => buildSchema(), [buildSchema]);

  // Update parent when schema changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSchemaChange(currentSchema);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [currentSchema, onSchemaChange]);

  const validateField = useCallback((field: SchemaField): string[] => {
    const errors: string[] = [];
    
    try {
      ZodSchemaFieldSchema.parse(field);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      }
    }
    
    // Additional custom validation
    if (field.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
      errors.push('Field name must be a valid identifier (letters, numbers, underscore)');
    }
    
    if (field.type === 'string') {
      if (field.minLength && field.maxLength && field.minLength > field.maxLength) {
        errors.push('Minimum length cannot be greater than maximum length');
      }
    }
    
    return errors;
  }, []);

  const addField = useCallback(() => {
    const newField: SchemaField = {
      id: generateFieldId(),
      name: `field_${fields.length + 1}`,
      type: 'string',
      required: false,
      description: ''
    };
    setFields(prev => [...prev, newField]);
  }, [fields.length]);

  const removeField = useCallback((fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
  }, []);

  const updateField = useCallback((fieldId: string, updates: Partial<SchemaField>) => {
    setFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        const updatedField = { ...field, ...updates };
        
        // Validate the updated field
        const fieldErrors = validateField(updatedField);
        setValidationErrors(prevErrors => {
          const otherErrors = prevErrors.filter(e => !e.field.startsWith(fieldId));
          const newErrors = fieldErrors.map(message => ({ field: fieldId, message }));
          return [...otherErrors, ...newErrors];
        });
        
        return updatedField;
      }
      return field;
    }));
  }, [validateField]);

  const applyTemplate = useCallback((templateId: string) => {
    const template = EXAMPLE_SCHEMAS[templateId as keyof typeof EXAMPLE_SCHEMAS];
    if (template) {
      setSchemaType(template.type as 'object' | 'array');
      
      const templateFields = template.type === 'array' 
        ? Object.entries(template.items).map(([name, config]: [string, any]) => ({
            id: generateFieldId(),
            name,
            type: config.type || 'string',
            required: config.required || false,
            description: `Template field: ${name}`
          }))
        : Object.entries(template.properties || {}).map(([name, config]: [string, any]) => ({
            id: generateFieldId(),
            name,
            type: config.type || 'string',
            required: config.required || false,
            description: `Template field: ${name}`
          }));
      
      setFields(templateFields);
      setSelectedTemplate(templateId);
      setShowTemplates(false);
    }
  }, []);

  const copySchemaToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentSchema, null, 2));
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
    } catch (err) {
      console.error('Failed to copy schema:', err);
    }
  };

  // Validate JSON input
  const validateJsonSchema = useCallback((jsonText: string): { isValid: boolean; errors: string[]; schema?: any } => {
    const errors: string[] = [];
    
    if (!jsonText.trim()) {
      return { isValid: false, errors: ['Schema cannot be empty'] };
    }
    
    try {
      const parsed = JSON.parse(jsonText);
      
      // Basic schema validation
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('Schema must be a valid JSON object');
      }
      
      if (!parsed.type) {
        errors.push('Schema must have a "type" property');
      }
      
      if (parsed.type === 'object' && !parsed.properties) {
        errors.push('Object schemas must have a "properties" field');
      }
      
      if (parsed.type === 'array' && !parsed.items) {
        errors.push('Array schemas must have an "items" field');
      }
      
      return { isValid: errors.length === 0, errors, schema: parsed };
    } catch (e) {
      errors.push(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return { isValid: false, errors };
    }
  }, []);

  // Handle manual schema text change
  const handleManualSchemaChange = useCallback((value: string) => {
    setManualSchemaText(value);
    setIsEditingManual(true);
    
    const validation = validateJsonSchema(value);
    setJsonErrors(validation.errors);
    
    if (validation.isValid && validation.schema) {
      // Convert manual schema back to visual builder format
      try {
        if (validation.schema.type === 'array' && validation.schema.items) {
          setSchemaType('array');
          const itemFields = Object.entries(validation.schema.items).map(([name, config]: [string, any]) => ({
            id: generateFieldId(),
            name,
            type: config.type || 'string',
            required: config.required || false,
            description: config.description || ''
          }));
          setFields(itemFields);
        } else if (validation.schema.type === 'object' && validation.schema.properties) {
          setSchemaType('object');
          const propFields = Object.entries(validation.schema.properties).map(([name, config]: [string, any]) => ({
            id: generateFieldId(),
            name,
            type: config.type || 'string',
            required: config.required || false,
            description: config.description || ''
          }));
          setFields(propFields);
        }
      } catch (e) {
        console.error('Error parsing manual schema:', e);
      }
    }
  }, [validateJsonSchema]);

  // Switch between editor modes
  const switchEditorMode = useCallback((mode: 'visual' | 'manual') => {
    if (mode === 'manual' && editorMode === 'visual') {
      // Switching to manual mode - populate text area with current schema
      setManualSchemaText(JSON.stringify(currentSchema, null, 2));
      setJsonErrors([]);
      setIsEditingManual(false);
    } else if (mode === 'visual' && editorMode === 'manual') {
      // Switching to visual mode - validate and apply manual changes
      if (jsonErrors.length === 0 && isEditingManual) {
        const validation = validateJsonSchema(manualSchemaText);
        if (!validation.isValid) {
          // Don't switch if there are errors
          return;
        }
      }
    }
    setEditorMode(mode);
  }, [editorMode, currentSchema, manualSchemaText, jsonErrors, isEditingManual, validateJsonSchema]);

  // Update manual schema text when current schema changes in visual mode
  useEffect(() => {
    if (editorMode === 'visual' && !isEditingManual) {
      setManualSchemaText(JSON.stringify(currentSchema, null, 2));
    }
  }, [currentSchema, editorMode, isEditingManual]);

  return (
    <div className="space-y-6">
      {/* Schema Type Selection */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Data Structure Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="relative flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
            <input
              type="radio"
              name="schemaType"
              value="array"
              checked={schemaType === 'array'}
              onChange={(e) => setSchemaType(e.target.value as 'array')}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
              schemaType === 'array' ? 'border-primary-600' : 'border-gray-300'
            }`}>
              {schemaType === 'array' && (
                <div className="w-2 h-2 rounded-full bg-primary-600"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Array (List)</div>
              <div className="text-xs text-gray-500">Extract multiple items</div>
            </div>
          </label>
          
          <label className="relative flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
            <input
              type="radio"
              name="schemaType"
              value="object"
              checked={schemaType === 'object'}
              onChange={(e) => setSchemaType(e.target.value as 'object')}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
              schemaType === 'object' ? 'border-primary-600' : 'border-gray-300'
            }`}>
              {schemaType === 'object' && (
                <div className="w-2 h-2 rounded-full bg-primary-600"></div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Object (Single)</div>
              <div className="text-xs text-gray-500">Extract one item</div>
            </div>
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {schemaType === 'array' 
            ? 'Perfect for extracting lists like articles, products, or search results'
            : 'Ideal for single items like contact info, page metadata, or specific details'
          }
        </p>
      </div>

      {/* Templates */}
      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-primary-600" />
            <span className="font-medium text-gray-900">Use Template</span>
            <span className="text-sm text-gray-500">Quick start with common schemas</span>
          </div>
          {showTemplates ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
        </button>

        {showTemplates && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(EXAMPLE_SCHEMAS).map(([key, schema]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  className={`
                    p-4 text-left border rounded-lg hover:shadow-sm transition-all duration-200
                    ${selectedTemplate === key 
                      ? 'border-primary-500 bg-primary-50 shadow-sm' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="font-medium text-sm text-gray-900 capitalize mb-1">
                    {key.replace('_', ' ')}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {schema.type === 'array' ? 'Multiple items' : 'Single item'} •{' '}
                    {Object.keys(schema.type === 'array' ? schema.items : schema.properties || {}).length} fields
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">
                    Fields: {Object.keys(schema.type === 'array' ? schema.items : schema.properties || {}).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fields */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">
              Fields to Extract
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Define what data you want to extract from each item
            </p>
          </div>
          <button
            type="button"
            onClick={addField}
            className="btn btn-primary btn-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const fieldErrors = validationErrors.filter(e => e.field === field.id);
            const hasErrors = fieldErrors.length > 0;
            
            return (
              <div key={field.id} className={`border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow ${
                hasErrors ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Field Name *
                    </label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      className={`input input-sm ${hasErrors ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="field_name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Data Type
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                      className="select select-sm"
                    >
                      <option value="string">Text</option>
                      <option value="number">Number</option>
                      <option value="boolean">True/False</option>
                      <option value="array">List</option>
                      <option value="object">Object</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <div className="mt-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-xs font-medium text-gray-700">Required</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-end justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFields(prev => ({ ...prev, [field.id]: !prev[field.id] }))}
                      className="btn btn-outline btn-sm text-blue-600 border-blue-300 hover:bg-blue-50"
                      title="Show advanced validation options"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(field.id)}
                      className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={field.description || ''}
                    onChange={(e) => updateField(field.id, { description: e.target.value })}
                    className="input input-sm"
                    placeholder="Describe what this field should contain..."
                  />
                </div>

                {/* Advanced Fields */}
                {showAdvancedFields[field.id] && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Advanced Validation</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Example Value
                        </label>
                        <input
                          type="text"
                          value={field.example || ''}
                          onChange={(e) => updateField(field.id, { example: e.target.value })}
                          className="input input-sm"
                          placeholder="Example: John Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Validation Pattern (Regex)
                        </label>
                        <input
                          type="text"
                          value={field.validationPattern || ''}
                          onChange={(e) => updateField(field.id, { validationPattern: e.target.value })}
                          className="input input-sm"
                          placeholder="^[a-zA-Z]+$"
                        />
                      </div>
                    </div>

                    {field.type === 'string' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Min Length
                          </label>
                          <input
                            type="number"
                            value={field.minLength || ''}
                            onChange={(e) => updateField(field.id, { minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="input input-sm"
                            min="0"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Max Length
                          </label>
                          <input
                            type="number"
                            value={field.maxLength || ''}
                            onChange={(e) => updateField(field.id, { maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="input input-sm"
                            min="0"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        CSS Selector Hints (one per line)
                      </label>
                      <textarea
                        value={(field.selectorHints || []).join('\n')}
                        onChange={(e) => updateField(field.id, { 
                          selectorHints: e.target.value.split('\n').filter(hint => hint.trim()) 
                        })}
                        className="input input-sm resize-none"
                        rows={3}
                        placeholder=".product-title&#10;h1&#10;[data-testid='title']"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        CSS selectors to help the AI find this field
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {hasErrors && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Validation Errors:</p>
                        <ul className="text-xs text-red-700 mt-1 space-y-1">
                          {fieldErrors.map((error, idx) => (
                            <li key={idx}>• {error.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {fields.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <div className="max-w-sm mx-auto">
                <Lightbulb className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No fields defined yet.</p>
                <button
                  type="button"
                  onClick={addField}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Field
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schema Editor */}
      <div className="border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">
                Schema {editorMode === 'visual' ? 'Preview' : 'Editor'}
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {editorMode === 'visual' 
                  ? 'JSON schema generated from your fields' 
                  : 'Edit the JSON schema directly'
                }
              </p>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex bg-white rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => switchEditorMode('visual')}
                className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  editorMode === 'visual'
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="h-3 w-3 mr-1" />
                Visual
              </button>
              <button
                type="button"
                onClick={() => switchEditorMode('manual')}
                className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  editorMode === 'manual'
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code2 className="h-3 w-3 mr-1" />
                JSON
              </button>
            </div>
          </div>
          
          <button
            type="button"
            onClick={copySchemaToClipboard}
            className="btn btn-outline btn-sm"
          >
            {copiedSchema ? (
              <>
                <Check className="h-4 w-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </button>
        </div>
        
        <div className="p-4">
          {editorMode === 'visual' ? (
            /* Visual Preview */
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto font-mono">
              {JSON.stringify(currentSchema, null, 2)}
            </pre>
          ) : (
            /* Manual JSON Editor */
            <div className="space-y-3">
              {jsonErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-1">JSON Validation Errors</h4>
                      <ul className="text-xs text-red-700 space-y-1">
                        {jsonErrors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="relative">
                <textarea
                  value={manualSchemaText}
                  onChange={(e) => handleManualSchemaChange(e.target.value)}
                  className={`w-full h-96 p-4 font-mono text-xs bg-gray-900 text-gray-100 rounded-lg border resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    jsonErrors.length > 0 ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your JSON schema here..."
                  spellCheck={false}
                />
                
                {/* JSON Status Indicator */}
                <div className="absolute top-2 right-2">
                  {isEditingManual && (
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      jsonErrors.length === 0 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {jsonErrors.length === 0 ? 'Valid JSON' : 'Invalid JSON'}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Tip: Use Ctrl+A to select all, then paste your JSON schema</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>Lines: {manualSchemaText.split('\n').length}</span>
                  <span>•</span>
                  <span>Chars: {manualSchemaText.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemaBuilder;