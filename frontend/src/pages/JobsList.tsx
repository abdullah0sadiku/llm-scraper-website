import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { scrapingApi } from '../services/api';
import { ScrapingJob } from '../types';
import JobCard from '../components/JobCard';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

const JobsList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => scrapingApi.getJobs(100, 0),
    refetchInterval: 30000,
  });

  const handleViewJob = (job: ScrapingJob) => {
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

  // Filter jobs based on search and status
  const filteredJobs = React.useMemo(() => {
    if (!jobs) return [];

    return jobs.filter((job) => {
      const matchesSearch = searchTerm === '' || 
        job.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  // Group jobs by status for stats
  const stats = React.useMemo(() => {
    if (!jobs) return {};

    return jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="spinner h-8 w-8 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Scraping Jobs</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor all your web scraping jobs
          </p>
        </div>
        
        <Link to="/jobs/new" className="btn btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          New Job
        </Link>
      </div>

      {/* Stats */}
      {jobs && jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{stats.running || 0}</div>
            <div className="text-sm text-gray-600">Running</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{stats.completed || 0}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-red-600">{stats.failed || 0}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs by URL or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select pl-10"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredJobs.map((job) => (
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
            {searchTerm || statusFilter !== 'all' ? (
              <>
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                <p className="text-gray-600 mb-6">
                  Try adjusting your search criteria or filters
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                  }}
                  className="btn btn-outline"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <div className="bg-gray-100 p-4 rounded-lg mx-auto w-fit mb-4">
                  <Plus className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs yet</h3>
                <p className="text-gray-600 mb-6">
                  Create your first web scraping job to get started
                </p>
                <Link to="/jobs/new" className="btn btn-primary">
                  <Plus className="h-5 w-5 mr-2" />
                  Create First Job
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      {filteredJobs.length > 0 && (
        <div className="text-sm text-gray-600 text-center">
          Showing {filteredJobs.length} of {jobs?.length || 0} jobs
        </div>
      )}

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

export default JobsList;
