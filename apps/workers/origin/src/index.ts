import { Worker, Job } from 'bullmq';
import { connect } from 'mongoose';
import { spawn } from 'child_process';
import { redis, createLogger, generateFingerprint, saveEvidence, VerificationRequiredError } from '@pablos/utils';
import { Finding, Job as JobModel, Asset } from './models';

const logger = createLogger('worker-origin');

interface OriginJobData {
  assetId: string;
  domain: string;
  mode?: string;
}

// Check if cf-hero is available
function checkCfHeroAvailability(): string | null {
  const cfHeroBin = process.env.CF_HERO_BIN || 'cf-hero';

  try {
    const { execSync } = require('child_process');
    execSync(`${cfHeroBin} -h`, { stdio: 'ignore' });
    return cfHeroBin;
  } catch (error) {
    return null;
  }
}

async function processCfHeroJob(job: Job<OriginJobData>) {
  const { assetId, domain, mode = 'safe' } = job.data;
  logger.info({ jobId: job.id, domain, mode }, 'Processing cf-hero job');

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

    // Check cf-hero availability
    const cfHeroBin = checkCfHeroAvailability();
    if (!cfHeroBin) {
      throw new Error(
        'cf-hero is not installed or not in PATH. ' +
        'Build it with: cd tools/cf-hero && go build OR set CF_HERO_BIN environment variable'
      );
    }

    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    // Safe mode configuration
    const workers = mode === 'safe' ? 8 : 16;

    logger.info({ domain, workers, cfHeroBin }, 'Starting cf-hero');

    await job.updateProgress(20);

    // Run cf-hero natively
    // cf-hero checks DNS records, OSINT sources, and validates origin IPs
    const args = [
      '-w', workers.toString(),
      '-v', // Verbose output
    ];

    // Create a temporary file with the domain
    const { writeFileSync, unlinkSync } = require('fs');
    const { join } = require('path');
    const tmpFile = join(require('os').tmpdir(), `cf-hero-${Date.now()}.txt`);
    writeFileSync(tmpFile, domain);

    args.push('-f', tmpFile);

    logger.info({ args }, 'Spawning cf-hero process');

    const cfHero = spawn(cfHeroBin, args);

    let output = '';
    let errorOutput = '';

    cfHero.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      logger.debug({ text: text.substring(0, 100) }, 'CF-Hero stdout');
    });

    cfHero.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      errorOutput += text;
      logger.debug({ text: text.substring(0, 100) }, 'CF-Hero stderr');
    });

    await job.updateProgress(30);

    // Wait for process to finish
    await new Promise<void>((resolve, reject) => {
      cfHero.on('close', (code) => {
        // Clean up temp file
        try {
          unlinkSync(tmpFile);
        } catch (e) {
          logger.warn({ error: e }, 'Failed to delete temp file');
        }

        if (code === 0 || code === null) {
          logger.info({ jobId: job.id, code }, 'CF-Hero process finished');
          resolve();
        } else {
          logger.error({ jobId: job.id, code, errorOutput }, 'CF-Hero process failed');
          reject(new Error(`CF-Hero exited with code ${code}: ${errorOutput}`));
        }
      });

      cfHero.on('error', (error) => {
        logger.error({ error }, 'Failed to spawn cf-hero');
        // Clean up temp file
        try {
          unlinkSync(tmpFile);
        } catch (e) {
          // Ignore
        }
        reject(error);
      });
    });

    await job.updateProgress(80);

    // Parse results and create findings
    // CF-Hero output format (example):
    // [REAL IP FOUND] example.com -> 203.0.113.10 (Title: Example Domain)
    // [DNS RECORD] example.com -> 203.0.113.11 (A record)
    // [OSINT] example.com -> 203.0.113.12 (ZoomEye)
    
    const lines = output.split('\n').filter((l) => l.trim());
    let foundOrigins = 0;

    for (const line of lines) {
      // Parse cf-hero output for real IP findings
      const realIpMatch = line.match(/\[REAL IP FOUND\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);
      if (realIpMatch) {
        const [, targetDomain, originIp] = realIpMatch;
        
        await Finding.findOneAndUpdate(
          {
            targetRef: assetId,
            provider: 'cfHero',
            fingerprint: generateFingerprint({ domain: targetDomain, originIp }),
          },
          {
            targetRef: assetId,
            targetFqdn: domain,
            provider: 'cfHero',
            category: 'NET',
            title: `Origin IP discovered: ${originIp}`,
            description: `Cloudflare bypass - Real origin IP found`,
            severity: 'high',
            fingerprint: generateFingerprint({ domain: targetDomain, originIp }),
            metadata: { originIp, method: 'cf-hero', line },
          },
          { upsert: true, new: true }
        );

        foundOrigins++;
        continue;
      }

      // Parse DNS records
      const dnsMatch = line.match(/\[DNS RECORD\]\s+([^\s]+)\s+->\s+([0-9.]+)/i);
      if (dnsMatch) {
        const [, targetDomain, ip] = dnsMatch;
        
        await Finding.findOneAndUpdate(
          {
            targetRef: assetId,
            provider: 'cfHero',
            fingerprint: generateFingerprint({ domain: targetDomain, ip, type: 'dns' }),
          },
          {
            targetRef: assetId,
            targetFqdn: domain,
            provider: 'cfHero',
            category: 'DNS',
            title: `DNS record: ${ip}`,
            description: `DNS A record discovered`,
            severity: 'info',
            fingerprint: generateFingerprint({ domain: targetDomain, ip, type: 'dns' }),
            metadata: { ip, method: 'dns', line },
          },
          { upsert: true, new: true }
        );

        foundOrigins++;
        continue;
      }

      // Parse OSINT findings
      const osintMatch = line.match(/\[OSINT\]\s+([^\s]+)\s+->\s+([0-9.]+)\s+\(([^)]+)\)/i);
      if (osintMatch) {
        const [, targetDomain, ip, source] = osintMatch;
        
        await Finding.findOneAndUpdate(
          {
            targetRef: assetId,
            provider: 'cfHero',
            fingerprint: generateFingerprint({ domain: targetDomain, ip, source }),
          },
          {
            targetRef: assetId,
            targetFqdn: domain,
            provider: 'cfHero',
            category: 'OSINT',
            title: `OSINT IP: ${ip} (${source})`,
            description: `IP discovered via ${source}`,
            severity: 'medium',
            fingerprint: generateFingerprint({ domain: targetDomain, ip, source }),
            metadata: { ip, source, method: 'osint', line },
          },
          { upsert: true, new: true }
        );

        foundOrigins++;
      }
    }

    // Save full output to GridFS
    const evidenceId = await saveEvidence(
      Buffer.from(output, 'utf-8'),
      {
        filename: `cf-hero-${domain}-${Date.now()}.txt`,
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
        message: `Found ${foundOrigins} origin IPs/records`,
        metadata: { evidenceId: evidenceId.toString() }
      }
    );

    logger.info({ jobId: job.id, domain, foundOrigins }, 'CF-Hero job completed');
    return { success: true, foundOrigins };
  } catch (error: any) {
    logger.error({ error, jobId: job.id, domain }, 'CF-Hero job failed');
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'failed', finishedAt: new Date(), error: error.message }
    );
    throw error;
  }
}

async function start() {
  logger.info('Starting origin worker...');

  await connect(process.env.MONGODB_URI!, { dbName: 'pablos-network' });
  logger.info('Connected to MongoDB');

  const worker = new Worker<OriginJobData>('cf-hero', processCfHeroJob, {
    connection: redis,
    concurrency: 1, // Limit concurrent scans (CF-Hero is resource-intensive)
    limiter: { max: 2, duration: 60000 }, // 2 scans per minute
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
  });

  logger.info('Origin worker started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start origin worker');
  process.exit(1);
});

