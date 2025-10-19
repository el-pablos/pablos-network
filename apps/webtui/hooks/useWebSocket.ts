import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useJobsStore } from '@/store/jobs';
import { useFindingsStore } from '@/store/findings';
import { GATEWAY_URL } from '@/lib/api-client';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { updateJob, addJob } = useJobsStore();
  const { addFinding } = useFindingsStore();

  useEffect(() => {
    // Connect to WebSocket
    const socket = io(`${GATEWAY_URL}/ws`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Listen for job updates
    socket.on('job:update', (job) => {
      console.log('Job update:', job);
      
      // Check if job exists in store
      const existingJob = useJobsStore.getState().jobs.find(j => j.jobId === job.jobId);
      
      if (existingJob) {
        updateJob(job.jobId, job);
      } else {
        addJob(job);
      }
    });

    // Listen for new findings
    socket.on('finding:new', (finding) => {
      console.log('New finding:', finding);
      addFinding(finding);
    });

    // Listen for job logs
    socket.on('job:log', ({ jobId, log, timestamp }) => {
      console.log(`[${jobId}] ${log}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [updateJob, addJob, addFinding]);

  const subscribeToJob = (jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe:job', { jobId });
    }
  };

  const unsubscribeFromJob = (jobId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:job', { jobId });
    }
  };

  const cancelJob = (jobId: string, provider: string) => {
    if (socketRef.current) {
      socketRef.current.emit('job:cancel', { jobId, provider });
    }
  };

  return {
    subscribeToJob,
    unsubscribeFromJob,
    cancelJob,
  };
}

