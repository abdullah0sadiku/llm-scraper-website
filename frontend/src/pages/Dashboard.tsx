import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Database,
  Globe
} from 'lucide-react';
import { scrapingApi } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { ScrapingJob } from '../types';
import JobCard from '../components/JobCard';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [recentJobs, setRecentJobs] = useState<ScrapingJob[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    jobId: string | null;
    jobTitle: string;
  }>({
    isOpen: false,
    jobId: null,
    jobTitle: ''
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const { ws, subscribe, onJobStatusUpdate, isConnected } = useWebSocket();

  // Fetch recent jobs
  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ['jobs', 'recent'],
    queryFn: () => scrapingApi.getJobs(10, 0),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch active jobs
  const { data: activeJobsData } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: () => scrapingApi.getActiveJobs(),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  useEffect(() => {
    if (jobs) {
      setRecentJobs(jobs);
    }
  }, [jobs]);

  // Real-time job status updates
  useEffect(() => {
    const unsubscribeStatus = onJobStatusUpdate((jobId: string, status: string, errorMessage?: string) => {
      setRecentJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId 
            ? { ...job, status: status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled', error_message: errorMessage || job.error_message }
            : job
        )
      );
      
      // Show toast notification for status changes
      if (status === 'completed') {
        toast.success(`Job completed successfully!`);
      } else if (status === 'failed') {
        toast.error(`Job failed: ${errorMessage || 'Unknown error'}`);
      }
    });

    // Real-time job progress updates
    const unsubscribeProgress = subscribe('job_progress', (message) => {
      if (message.job_id && message.stage && message.message) {
        toast(`${message.stage}: ${message.message}`, {
          duration: 2000,
          icon: '⚡'
        });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeProgress();
    };
  }, [onJobStatusUpdate, subscribe]);

  // Subscribe to job updates via WebSocket
  useEffect(() => {
    const unsubscribers = [
      subscribe('job_completed', (message) => {
        toast.success(`Job completed: ${message.data_count} items extracted`);
        refetch();
      }),
      subscribe('job_failed', (message) => {
        toast.error(`Job failed: ${message.error}`);
        refetch();
      }),
      subscribe('job_started', () => {
        refetch();
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [subscribe, refetch]);

  const handleViewJob = (job: ScrapingJob) => {
    // Navigate to job detail page
    window.location.href = `/jobs/${job.id}`;
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await scrapingApi.cancelJob(jobId);
      toast.success('Job cancelled successfully');
      refetch();
    } catch (error: any) {
      toast.error(`Failed to cancel job: ${error.detail}`);
    }
  };

  const handleDeleteJob = (job: ScrapingJob) => {
    setDeleteConfirm({
      isOpen: true,
      jobId: job.id,
      jobTitle: `${job.url} (${job.status})`
    });
  };

  const confirmDeleteJob = async () => {
    if (!deleteConfirm.jobId) return;

    setIsDeleting(true);
    try {
      await scrapingApi.deleteJob(deleteConfirm.jobId);
      toast.success('Job deleted successfully');
      setDeleteConfirm({ isOpen: false, jobId: null, jobTitle: '' });
      refetch();
    } catch (error: any) {
      toast.error(`Failed to delete job: ${error.detail}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRerunJob = async (job: ScrapingJob) => {
    try {
      const result = await scrapingApi.rerunJob(job.id);
      toast.success(`Job rerun started! New job ID: ${result.new_job_id.slice(0, 8)}...`);
      
      // Refresh the jobs list to show the new job
      refetch();
    } catch (error: any) {
      toast.error(`Failed to rerun job: ${error.detail}`);
    }
  };

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!jobs) return { total: 0, completed: 0, failed: 0, running: 0 };

    return {
      total: jobs.length,
      completed: jobs.filter(job => job.status === 'completed').length,
      failed: jobs.filter(job => job.status === 'failed').length,
      running: jobs.filter(job => job.status === 'running').length,
      pending: jobs.filter(job => job.status === 'pending').length
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner h-8 w-8 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor your web scraping jobs and performance
          </p>
        </div>
        
        <Link to="/jobs/new" className="btn btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          New Scraping Job
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeJobsData?.active_jobs_count || 0}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Activity className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/jobs/new" className="card hover:shadow-md transition-shadow group">
          <div className="card-body text-center py-8">
            <div className="bg-primary-100 p-4 rounded-lg mx-auto w-fit mb-4 group-hover:bg-primary-200 transition-colors">
              <Plus className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Job</h3>
            <p className="text-gray-600 text-sm">
              Start a new web scraping job with AI-generated extraction scripts
            </p>
          </div>
        </Link>

        <Link to="/jobs" className="card hover:shadow-md transition-shadow group">
          <div className="card-body text-center py-8">
            <div className="bg-blue-100 p-4 rounded-lg mx-auto w-fit mb-4 group-hover:bg-blue-200 transition-colors">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">View All Jobs</h3>
            <p className="text-gray-600 text-sm">
              Browse and manage all your scraping jobs and their results
            </p>
          </div>
        </Link>

        <div className="card">
          <div className="card-body text-center py-8">
            <div className="bg-green-100 p-4 rounded-lg mx-auto w-fit mb-4">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Success Rate</h3>
            <p className="text-gray-600 text-sm">
              {stats.total > 0 
                ? `${Math.round((stats.completed / stats.total) * 100)}%`
                : '0%'
              } of jobs completed successfully
            </p>
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Jobs</h2>
          <Link to="/jobs" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View all jobs →
          </Link>
        </div>

        {recentJobs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {recentJobs.slice(0, 6).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onView={handleViewJob}
                onCancel={handleCancelJob}
                onDelete={handleDeleteJob}
                onRerun={handleRerunJob}
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-body text-center py-12">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first web scraping job to get started
              </p>
              <Link to="/jobs/new" className="btn btn-primary">
                <Plus className="h-5 w-5 mr-2" />
                Create First Job
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, jobId: null, jobTitle: '' })}
        onConfirm={confirmDeleteJob}
        title="Delete Scraping Job"
        message={`Are you sure you want to delete the job "${deleteConfirm.jobTitle}"? This action cannot be undone.`}
        confirmText="Delete Job"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Dashboard;
