import { Worker, Job } from 'bullmq';
import { connect } from 'mongoose';
import { spawn, execSync } from 'child_process';
import { redis, createLogger, generateFingerprint, saveEvidence, VerificationRequiredError } from '@pablos/utils';
import { Finding, Job as JobModel, Asset } from './models';

const logger = createLogger('worker-webdiscovery');

interface WebDiscoveryJobData {
  assetId: string;
  domain: string;
  mode?: string;
}

// Check if dirsearch is available
function checkDirsearchAvailability(): string | null {
  const dirsearchBin = process.env.DIRSEARCH_BIN || 'dirsearch';

  try {
    execSync(`${dirsearchBin} --version`, { stdio: 'ignore' });
    return dirsearchBin;
  } catch (error) {
    return null;
  }
}

async function processDirsearchJob(job: Job<WebDiscoveryJobData>) {
  const { assetId, domain, mode = 'safe' } = job.data;
  logger.info({ jobId: job.id, domain, mode }, 'Processing dirsearch job');

  try {
    // CRITICAL: Verify domain ownership before active scanning
    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    if (!asset.verifiedAt) {
      logger.warn({ domain, assetId }, 'Domain verification required for active scanning');
      throw new VerificationRequiredError(domain);
    }

    logger.info({ domain, verifiedAt: asset.verifiedAt }, 'Domain verification confirmed');

    // Check dirsearch availability
    const dirsearchBin = checkDirsearchAvailability();
    if (!dirsearchBin) {
      throw new Error(
        'dirsearch is not installed or not in PATH. ' +
        'Install it with: pip install dirsearch OR set DIRSEARCH_BIN environment variable'
      );
    }

    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    // Safe mode configuration
    const rateLimit = mode === 'safe' ? 50 : 100; // requests per second
    const threads = mode === 'safe' ? 5 : 10;

    logger.info({ domain, rateLimit, threads, dirsearchBin }, 'Starting dirsearch');

    await job.updateProgress(20);

    // Run dirsearch natively
    const args = [
      '-u', `https://${domain}`,
      '-e', 'php,html,js,txt',
      '--format', 'plain',
      '--rate-limit', rateLimit.toString(),
      '--threads', threads.toString(),
      '--max-time', '300', // 5 minutes max
      '--quiet-mode', // Reduce noise
    ];

    logger.info({ args }, 'Spawning dirsearch process');

    const dirsearch = spawn(dirsearchBin, args);

    let output = '';
    let errorOutput = '';

    dirsearch.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      logger.debug({ text: text.substring(0, 100) }, 'Dirsearch stdout');
    });

    dirsearch.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      errorOutput += text;
      logger.debug({ text: text.substring(0, 100) }, 'Dirsearch stderr');
    });

    await job.updateProgress(30);

    // Wait for process to finish
    await new Promise<void>((resolve, reject) => {
      dirsearch.on('close', (code) => {
        if (code === 0 || code === null) {
          logger.info({ jobId: job.id, code }, 'Dirsearch process finished');
          resolve();
        } else {
          logger.error({ jobId: job.id, code, errorOutput }, 'Dirsearch process failed');
          reject(new Error(`Dirsearch exited with code ${code}: ${errorOutput}`));
        }
      });

      dirsearch.on('error', (error) => {
        logger.error({ error }, 'Failed to spawn dirsearch');
        reject(error);
      });
    });

    await job.updateProgress(80);

    // Parse results and create findings
    const lines = output.split('\n').filter((l) => l.trim());
    let foundPaths = 0;

    for (const line of lines) {
      // Parse dirsearch plain output (format varies, look for status codes and URLs)
      // Example: "200   1234B  https://example.com/path"
      const match = line.match(/(\d{3})\s+(\d+[KMB]?)\s+(https?:\/\/[^\s]+)/);
      if (match) {
        const [, status, sizeStr, url] = match;
        const path = url.replace(`https://${domain}`, '').replace(`http://${domain}`, '');

        // Parse size (handle K, M, B suffixes)
        let size = 0;
        if (sizeStr.endsWith('K')) {
          size = parseInt(sizeStr) * 1024;
        } else if (sizeStr.endsWith('M')) {
          size = parseInt(sizeStr) * 1024 * 1024;
        } else if (sizeStr.endsWith('B')) {
          size = parseInt(sizeStr);
        } else {
          size = parseInt(sizeStr);
        }

        await Finding.findOneAndUpdate(
          {
            targetRef: assetId,
            provider: 'dirsearch',
            fingerprint: generateFingerprint({ domain, path, status }),
          },
          {
            targetRef: assetId,
            targetFqdn: domain,
            provider: 'dirsearch',
            category: 'WEB',
            title: `Path discovered: ${path}`,
            description: `HTTP ${status} - ${size} bytes`,
            severity: status.startsWith('2') ? 'info' : 'low',
            fingerprint: generateFingerprint({ domain, path, status }),
            metadata: { path, status: parseInt(status), size, url },
          },
          { upsert: true, new: true }
        );

        foundPaths++;
      }
    }

    // Save full output to GridFS
    const evidenceId = await saveEvidence(
      Buffer.from(output, 'utf-8'),
      {
        filename: `dirsearch-${domain}-${Date.now()}.txt`,
        contentType: 'text/plain',
        targetFqdn: domain,
        jobId: job.id,
      }
    );

    await job.updateProgress(100);
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { 
        status: 'done', 
        finishedAt: new Date(), 
        progress: 100,
        message: `Found ${foundPaths} paths`,
        metadata: { evidenceId: evidenceId.toString() }
      }
    );

    logger.info({ jobId: job.id, domain, foundPaths }, 'Dirsearch job completed');
    return { success: true, foundPaths };
  } catch (error: any) {
    logger.error({ error, jobId: job.id, domain }, 'Dirsearch job failed');
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'failed', finishedAt: new Date(), error: error.message }
    );
    throw error;
  }
}

async function start() {
  logger.info('Starting webdiscovery worker...');

  await connect(process.env.MONGODB_URI!, { dbName: 'pablos-network' });
  logger.info('Connected to MongoDB');

  const worker = new Worker<WebDiscoveryJobData>('dirsearch', processDirsearchJob, {
    connection: redis,
    concurrency: 2, // Limit concurrent scans
    limiter: { max: 3, duration: 60000 }, // 3 scans per minute
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
  });

  logger.info('Webdiscovery worker started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start webdiscovery worker');
  process.exit(1);
});

