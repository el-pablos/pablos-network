import { useEffect, useState } from 'react';
import { GATEWAY_URL } from '@/lib/api-client';

interface SSEProgress {
  jobId: string;
  value: number;
  timestamp: string;
}

export function useSSE(jobId: string | null) {
  const [progress, setProgress] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`${GATEWAY_URL}/progress/stream?jobId=${jobId}`);

    eventSource.onopen = () => {
      console.log('SSE connected for job:', jobId);
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setProgress(data.value);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [jobId]);

  return { progress, isConnected };
}

