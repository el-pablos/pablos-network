'use client';

import { useFindingsStore } from '@/store/findings';
import { useState } from 'react';

export function FindingsPanel() {
  const { findings, filter, setFilter } = useFindingsStore();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const severities = ['all', 'critical', 'high', 'medium', 'low', 'info'];

  const filteredFindings = findings.filter((finding) => {
    if (selectedSeverity !== 'all' && finding.severity !== selectedSeverity) {
      return false;
    }
    if (filter.severity && finding.severity !== filter.severity) {
      return false;
    }
    if (filter.category && finding.category !== filter.category) {
      return false;
    }
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-purple-400 bg-purple-900/30 border-purple-700';
      case 'high':
        return 'text-red-400 bg-red-900/30 border-red-700';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
      case 'low':
        return 'text-blue-400 bg-blue-900/30 border-blue-700';
      case 'info':
        return 'text-gray-400 bg-gray-900/30 border-gray-700';
      default:
        return 'text-gray-400 bg-gray-900/30 border-gray-700';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-purple-500';
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      case 'info':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-gray-100">Findings</h2>
        <p className="text-sm text-gray-400">{filteredFindings.length} total</p>
      </div>

      {/* Severity filter */}
      <div className="px-4 py-2 border-b border-gray-700 flex gap-2 overflow-x-auto">
        {severities.map((severity) => (
          <button
            key={severity}
            onClick={() => setSelectedSeverity(severity)}
            className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              selectedSeverity === severity
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {severity}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No findings yet</p>
            <p className="text-sm mt-2">Run scans to discover findings</p>
          </div>
        ) : (
          filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className={`rounded-lg p-3 border ${getSeverityColor(finding.severity)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-2 h-2 rounded-full ${getSeverityBadgeColor(finding.severity)}`}
                    />
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      {finding.severity}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-200 text-sm leading-tight">
                    {finding.title}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                {finding.description}
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-0.5 bg-gray-800 rounded">
                  {finding.provider}
                </span>
                <span className="px-2 py-0.5 bg-gray-800 rounded">
                  {finding.category}
                </span>
              </div>

              <p className="text-xs text-gray-600 mt-2">
                {finding.targetFqdn}
              </p>

              <p className="text-xs text-gray-600 mt-1">
                {new Date(finding.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

