import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { 
  ExternalLink, 
  Play, 
  Square, 
  Trash2, 
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Newspaper,
  ShoppingCart,
  User,
  CreditCard,
  MessageSquare,
  Calendar,
  Table,
  FileText
} from 'lucide-react';
import { ScrapingJob, JOB_STATUS_COLORS } from '../types';
import { ZOD_SCHEMAS } from '../schemas/zod-schemas';

interface JobCardProps {
  job: ScrapingJob;
  onView: (job: ScrapingJob) => void;
  onCancel: (jobId: string) => void;
  onDelete: (job: ScrapingJob) => void;
  onRerun: (job: ScrapingJob) => void;
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  onView,
  onCancel,
  onDelete,
  onRerun
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    return JOB_STATUS_COLORS[status as keyof typeof JOB_STATUS_COLORS] || JOB_STATUS_COLORS.pending;
  };

  const canCancel = job.status === 'pending' || job.status === 'running';
  const canRerun = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const detectSchemaTemplate = (schema: any) => {
    // Compare the job's schema with known ZOD templates
    const schemaFields = schema.items || schema.properties || {};
    const schemaFieldNames = Object.keys(schemaFields).map(name => name.toLowerCase());
    
    for (const [templateKey, zodTemplate] of Object.entries(ZOD_SCHEMAS)) {
      // Create a simple field signature for comparison
      const templateSignature = getSchemaSignature(templateKey);
      
      // Check if field names match common patterns
      const matchingFields = schemaFieldNames.filter(field => 
        templateSignature.some(sig => field.includes(sig) || sig.includes(field))
      );
      const similarity = matchingFields.length / Math.max(schemaFieldNames.length, templateSignature.length);
      
      if (similarity >= 0.4) { // Lower threshold for more flexible matching
        return {
          name: templateKey,
          displayName: zodTemplate.name,
          icon: getTemplateIcon(templateKey),
          color: getTemplateColor(templateKey)
        };
      }
    }
    
    return null;
  };

  const getSchemaSignature = (templateKey: string): string[] => {
    switch (templateKey) {
      case 'news_articles':
        return ['title', 'headline', 'article', 'author', 'content', 'published'];
      case 'products':
        return ['product', 'name', 'price', 'discount', 'category', 'brand'];
      case 'contacts':
        return ['name', 'email', 'phone', 'address', 'contact'];
      case 'jobs':
        return ['title', 'company', 'location', 'salary', 'description'];
      case 'social_media':
        return ['post', 'author', 'content', 'likes', 'shares', 'comments'];
      case 'events':
        return ['title', 'date', 'location', 'description', 'event'];
      case 'table_data':
        return ['row', 'column', 'data', 'table', 'cell'];
      case 'page_content':
        return ['title', 'content', 'section', 'link', 'page'];
      case 'bank_dashboard':
        return ['balance', 'transaction', 'card', 'account', 'payment', 'user'];
      default:
        return [];
    }
  };

  const getTemplateIcon = (templateKey: string) => {
    switch (templateKey) {
      case 'news_articles': return Newspaper;
      case 'products': return ShoppingCart;
      case 'contacts': return User;
      case 'jobs': return User;
      case 'social_media': return MessageSquare;
      case 'events': return Calendar;
      case 'table_data': return Table;
      case 'page_content': return FileText;
      case 'bank_dashboard': return CreditCard;
      default: return null;
    }
  };

  const getTemplateColor = (templateKey: string): string => {
    switch (templateKey) {
      case 'news_articles': return 'text-blue-600';
      case 'products': return 'text-green-600';
      case 'contacts': return 'text-purple-600';
      case 'jobs': return 'text-indigo-600';
      case 'social_media': return 'text-pink-600';
      case 'events': return 'text-yellow-600';
      case 'table_data': return 'text-gray-600';
      case 'page_content': return 'text-orange-600';
      case 'bank_dashboard': return 'text-emerald-600';
      default: return 'text-gray-600';
    }
  };

  const schemaTemplate = detectSchemaTemplate(job.schema_definition);

  return (
    <div className={`card hover:shadow-md transition-shadow duration-200 ${
      job.status === 'failed' ? 'ring-2 ring-red-200 bg-red-50/30' : ''
    }`}>
      <div className="card-body">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`badge ${getStatusColor(job.status)} ${
                job.status === 'failed' ? 'animate-pulse' : ''
              }`}>
                {getStatusIcon(job.status)}
                <span className="ml-1 capitalize">{job.status}</span>
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary-600 truncate"
                title={job.url}
              >
                {truncateUrl(job.url)}
              </a>
            </div>
          </div>
        </div>

        {/* Schema Info */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-1">Schema</h4>
          <div className="text-xs bg-gray-50 rounded p-2">
            {schemaTemplate ? (
              <div className="flex items-center space-x-2">
                {schemaTemplate.icon && (
                  <schemaTemplate.icon className={`h-4 w-4 ${schemaTemplate.color}`} />
                )}
                <div>
                  <div className="font-medium text-gray-700">{schemaTemplate.displayName} Template</div>
                  <div className="text-gray-500">
                    {job.schema_definition.type === 'array' ? 'Array' : 'Object'} with{' '}
                    {Object.keys(job.schema_definition.items || job.schema_definition.properties || {}).length} fields
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                {job.schema_definition.type === 'array' ? (
                  <span>
                    Custom Array with {Object.keys(job.schema_definition.items || {}).length} fields
                  </span>
                ) : (
                  <span>
                    Custom Object with {Object.keys(job.schema_definition.properties || {}).length} fields
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {job.error_message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-medium text-red-800 mb-1">Job Failed</div>
                <div className="text-xs text-red-600">{job.error_message}</div>
                <div className="mt-2">
                  <button
                    onClick={() => onRerun(job)}
                    className="text-xs text-red-700 hover:text-red-800 underline font-medium"
                  >
                    Click to retry this job →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Completion Info */}
        {job.completed_at && job.status !== 'failed' && (
          <div className="text-xs text-gray-500 mb-4">
            Completed {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
          </div>
        )}
        
        {/* Failed Job Help */}
        {job.status === 'failed' && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <div className="text-xs text-yellow-800">
                <div className="font-medium mb-1">Job failed to complete</div>
                <div>This might be due to website changes or network issues. Try running it again.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card-footer">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onView(job)}
              className="btn btn-outline btn-sm"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </button>
            
            <Link
              to={`/jobs/${job.id}`}
              className="btn btn-primary btn-sm"
            >
              Details
            </Link>
            
            {/* Prominent Retry button for failed jobs */}
            {job.status === 'failed' && (
              <button
                onClick={() => onRerun(job)}
                className="btn btn-success btn-sm"
                title="Retry this failed job"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry Now
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {canRerun && (
              <button
                onClick={() => onRerun(job)}
                className={`btn btn-sm ${
                  job.status === 'failed' 
                    ? 'btn-primary' 
                    : 'btn-secondary'
                }`}
                title={
                  job.status === 'failed' 
                    ? 'Retry this failed job' 
                    : 'Create new job with same settings'
                }
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {job.status === 'failed' ? 'Retry' : 'Rerun'}
              </button>
            )}

            {canCancel && (
              <button
                onClick={() => onCancel(job.id)}
                className="btn btn-outline btn-sm text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                title="Cancel job"
              >
                <Square className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => onDelete(job)}
              className="btn btn-outline btn-sm text-red-600 border-red-300 hover:bg-red-50"
              title="Delete job"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
