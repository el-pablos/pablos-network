'use client';

import { useJobsStore } from '@/store/jobs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect } from 'react';

export function JobsPanel() {
  const { jobs } = useJobsStore();
  const { cancelJob } = useWebSocket();

  // Initialize WebSocket connection
  useWebSocket();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'running':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return '✓';
      case 'failed':
        return '✗';
      case 'running':
        return '⟳';
      default:
        return '○';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-100">Jobs</h2>
        <p className="text-sm text-gray-400">
          {jobs.filter(j => j.status === 'running').length} running
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {jobs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No jobs yet</p>
            <p className="text-sm mt-2">Start a scan to see jobs here</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.jobId}
              className="bg-gray-900 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                    </span>
                    <span className="font-medium text-gray-200 truncate">
                      {job.provider}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono truncate mt-1">
                    {job.jobId}
                  </p>
                </div>

                {job.status === 'running' && (
                  <button
                    onClick={() => cancelJob(job.jobId, job.provider)}
                    className="text-xs text-red-400 hover:text-red-300 ml-2"
                    title="Cancel job"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {job.status === 'running' && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Message */}
              {job.message && (
                <p className="text-xs text-gray-400 mt-2">{job.message}</p>
              )}

              {/* Error */}
              {job.error && (
                <p className="text-xs text-red-400 mt-2">{job.error}</p>
              )}

              {/* Timestamp */}
              <p className="text-xs text-gray-600 mt-2">
                {new Date(job.createdAt).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

