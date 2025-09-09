import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  Code, 
  Database,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy
} from 'lucide-react';
import { scrapingApi, exportUtils } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { formatDistanceToNow } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import toast from 'react-hot-toast';

const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'script'>('overview');
  const { subscribeToJob, unsubscribeFromJob, subscribe } = useWebSocket();

  // Fetch job details
  const { data: job, isLoading: jobLoading, refetch: refetchJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => scrapingApi.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Refetch more frequently for active jobs
      if (data?.status === 'running' || data?.status === 'pending') {
        return 2000; // 2 seconds
      }
      return 30000; // 30 seconds for completed jobs
    }
  });

  // Fetch job results
  const { data: results, isLoading: resultsLoading, refetch: refetchResults } = useQuery({
    queryKey: ['job', jobId, 'results'],
    queryFn: () => scrapingApi.getJobResults(jobId!),
    enabled: !!jobId && job?.status === 'completed',
  });

  // Fetch job script
  const { data: script, isLoading: scriptLoading } = useQuery({
    queryKey: ['job', jobId, 'script'],
    queryFn: () => scrapingApi.getJobScript(jobId!),
    enabled: !!jobId && (job?.status === 'completed' || job?.status === 'failed'),
  });

  // Subscribe to job updates
  useEffect(() => {
    if (jobId) {
      subscribeToJob(jobId);

      const unsubscribers = [
        subscribe('job_completed', (message) => {
          if (message.job_id === jobId) {
            toast.success(`Job completed: ${message.data_count} items extracted`);
            refetchJob();
            refetchResults();
          }
        }),
        subscribe('job_failed', (message) => {
          if (message.job_id === jobId) {
            toast.error(`Job failed: ${message.error}`);
            refetchJob();
          }
        }),
        subscribe('job_progress', (message) => {
          if (message.job_id === jobId) {
            toast.success(`Progress: ${message.stage} (${message.progress}%)`);
          }
        })
      ];

      return () => {
        unsubscribeFromJob(jobId);
        unsubscribers.forEach(unsub => unsub());
      };
    }
  }, [jobId, subscribeToJob, unsubscribeFromJob, subscribe, refetchJob, refetchResults]);

  const handleCancelJob = async () => {
    if (!jobId) return;
    
    try {
      await scrapingApi.cancelJob(jobId);
      toast.success('Job cancelled successfully');
      refetchJob();
    } catch (error: any) {
      toast.error(`Failed to cancel job: ${error.detail}`);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobId || !confirm('Are you sure you want to delete this job?')) return;

    try {
      await scrapingApi.deleteJob(jobId);
      toast.success('Job deleted successfully');
      navigate('/jobs');
    } catch (error: any) {
      toast.error(`Failed to delete job: ${error.detail}`);
    }
  };

  const handleRerunJob = async () => {
    if (!job || !jobId) return;

    try {
      const result = await scrapingApi.rerunJob(jobId);
      toast.success(`Job rerun started! New job ID: ${result.new_job_id.slice(0, 8)}...`);
      
      // Navigate to the new job's detail page
      navigate(`/jobs/${result.new_job_id}`);
    } catch (error: any) {
      toast.error(`Failed to rerun job: ${error.detail}`);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (!results?.data) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `scraped-data-${jobId}-${timestamp}`;

    if (format === 'json') {
      exportUtils.exportToJson(results.data, `${filename}.json`);
    } else {
      if (Array.isArray(results.data)) {
        exportUtils.exportToCsv(results.data, `${filename}.csv`);
      } else {
        toast.error('CSV export is only available for array data');
      }
    }

    toast.success(`Data exported as ${format.toUpperCase()}`);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'running':
        return <Play className="h-5 w-5 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner h-8 w-8 border-primary-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Job not found</h2>
        <button onClick={() => navigate('/jobs')} className="btn btn-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </button>
      </div>
    );
  }

  const canCancel = job.status === 'pending' || job.status === 'running';
  const canRerun = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/jobs')}
            className="btn btn-outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
            <p className="text-gray-600 text-sm">ID: {job.id}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canRerun && (
            <button 
              onClick={handleRerunJob} 
              className={`btn ${
                job.status === 'failed' 
                  ? 'btn-primary' 
                  : 'btn-secondary'
              }`}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {job.status === 'failed' ? 'Run Job Again' : 'Rerun'}
            </button>
          )}
          
          {canCancel && (
            <button onClick={handleCancelJob} className="btn btn-outline text-yellow-600">
              <Square className="h-4 w-4 mr-2" />
              Cancel
            </button>
          )}
          
          <button 
            onClick={handleDeleteJob} 
            className="btn btn-outline text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Card */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(job.status)}
              <div>
                <h2 className="text-lg font-semibold capitalize">{job.status}</h2>
                <p className="text-sm text-gray-600">
                  Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <ExternalLink className="h-4 w-4 text-gray-400" />
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                View Target Site
              </a>
            </div>
          </div>

          <div className="text-sm text-gray-600 break-all">
            <strong>URL:</strong> {job.url}
          </div>

          {job.completed_at && (
            <div className="text-sm text-gray-600 mt-2">
              <strong>Completed:</strong> {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
            </div>
          )}

          {job.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {job.error_message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'results', 'script'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab === 'overview' && <Database className="h-4 w-4 mr-2 inline" />}
              {tab === 'results' && <Download className="h-4 w-4 mr-2 inline" />}
              {tab === 'script' && <Code className="h-4 w-4 mr-2 inline" />}
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Schema Definition</h3>
            </div>
            <div className="card-body">
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(job.schema_definition, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {job.status === 'completed' ? (
              <>
                {resultsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="spinner h-8 w-8 border-primary-600"></div>
                  </div>
                ) : results ? (
                  <>
                    <div className="card">
                      <div className="card-header">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Extracted Data</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {results.data_count} items extracted
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleExport('json')}
                              className="btn btn-outline btn-sm"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              JSON
                            </button>
                            {Array.isArray(results.data) && (
                              <button
                                onClick={() => handleExport('csv')}
                                className="btn btn-outline btn-sm"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                CSV
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto max-h-96 custom-scrollbar">
                          <pre className="text-sm">
                            {JSON.stringify(results.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card">
                    <div className="card-body text-center py-12">
                      <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                      <p className="text-gray-600">
                        The job completed but no data was extracted.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card">
                <div className="card-body text-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {job.status === 'running' ? 'Job is running' : 'No results yet'}
                  </h3>
                  <p className="text-gray-600">
                    {job.status === 'running' 
                      ? 'Results will appear here once the job completes.'
                      : 'Job must complete successfully to view results.'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Script Tab */}
        {activeTab === 'script' && (
          <div className="space-y-6">
            {scriptLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner h-8 w-8 border-primary-600"></div>
              </div>
            ) : script ? (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Generated Script</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {script.script_type} script generated by AI
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(script.script_content)}
                      className="btn btn-outline btn-sm"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </button>
                  </div>
                </div>
                <div className="card-body p-0">
                  <SyntaxHighlighter
                    language="javascript"
                    style={tomorrow}
                    customStyle={{
                      margin: 0,
                      borderRadius: '0 0 0.5rem 0.5rem'
                    }}
                  >
                    {script.script_content}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="card-body text-center py-12">
                  <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No script available</h3>
                  <p className="text-gray-600">
                    The generated script will appear here once the job starts processing.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
