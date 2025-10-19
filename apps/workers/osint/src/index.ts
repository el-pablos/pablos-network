import { Worker, Job } from 'bullmq';
import { connect } from 'mongoose';
import { redis, createLogger, HttpClient, generateFingerprint } from '@pablos/utils';
import { Asset, Finding, Job as JobModel } from './models';

const logger = createLogger('worker-osint');

interface OSINTJobData {
  assetId: string;
  domain: string;
}

async function processZoomEyeJob(job: Job<OSINTJobData>) {
  const { assetId, domain } = job.data;
  logger.info({ jobId: job.id, domain }, 'Processing ZoomEye job');

  const apiKey = process.env.ZOOMEYE_API_KEY;
  if (!apiKey) {
    logger.warn('ZOOMEYE_API_KEY not configured, skipping');
    return { skipped: true };
  }

  try {
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    const client = new HttpClient('https://api.zoomeye.org', {
      headers: { 'API-KEY': apiKey },
    });

    // Search for domain
    const results = await client.get(`/host/search?query=hostname:${domain}&page=1`);

    await job.updateProgress(50);

    // Process results
    const matches = results.matches || [];
    for (const match of matches.slice(0, 10)) {
      await Finding.findOneAndUpdate(
        {
          targetRef: assetId,
          provider: 'zoomEye',
          fingerprint: generateFingerprint({ ip: match.ip, port: match.portinfo?.port }),
        },
        {
          targetRef: assetId,
          targetFqdn: domain,
          provider: 'zoomEye',
          category: 'OSINT',
          title: `Open Port ${match.portinfo?.port} on ${match.ip}`,
          description: `Service: ${match.portinfo?.service || 'unknown'}`,
          severity: 'info',
          fingerprint: generateFingerprint({ ip: match.ip, port: match.portinfo?.port }),
          metadata: { ip: match.ip, port: match.portinfo?.port, service: match.portinfo?.service },
        },
        { upsert: true, new: true }
      );
    }

    await job.updateProgress(100);
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'done', finishedAt: new Date(), progress: 100, message: `Found ${matches.length} results` }
    );

    logger.info({ jobId: job.id, domain, results: matches.length }, 'ZoomEye job completed');
    return { success: true, results: matches.length };
  } catch (error: any) {
    logger.error({ error, jobId: job.id, domain }, 'ZoomEye job failed');
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'failed', finishedAt: new Date(), error: error.message }
    );
    throw error;
  }
}

async function processBinaryEdgeJob(job: Job<OSINTJobData>) {
  const { assetId, domain } = job.data;
  logger.info({ jobId: job.id, domain }, 'Processing BinaryEdge job');

  const apiKey = process.env.BINARYEDGE_API_KEY;
  if (!apiKey) {
    logger.warn('BINARYEDGE_API_KEY not configured, skipping');
    return { skipped: true };
  }

  // Similar implementation to ZoomEye
  logger.info({ jobId: job.id }, 'BinaryEdge worker stub - implement API integration');
  
  await JobModel.findOneAndUpdate(
    { jobId: job.id },
    { status: 'done', finishedAt: new Date(), progress: 100, message: 'Stub implementation' }
  );

  return { success: true, stub: true };
}

async function start() {
  logger.info('Starting OSINT workers...');

  await connect(process.env.MONGODB_URI!, { dbName: 'pablos-network' });
  logger.info('Connected to MongoDB');

  // ZoomEye worker
  const zoomEyeWorker = new Worker<OSINTJobData>('zoomEye', processZoomEyeJob, {
    connection: redis,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  });

  // BinaryEdge worker
  const binaryEdgeWorker = new Worker<OSINTJobData>('binaryEdge', processBinaryEdgeJob, {
    connection: redis,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 },
  });

  logger.info('OSINT workers started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start OSINT workers');
  process.exit(1);
});

