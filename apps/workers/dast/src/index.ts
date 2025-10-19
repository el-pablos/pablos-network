import { Worker, Job } from 'bullmq';
import { connect } from 'mongoose';
import { spawn } from 'child_process';
import { redis, createLogger, generateFingerprint, saveEvidence } from '@pablos/utils';
import { Finding, Job as JobModel } from './models';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const logger = createLogger('worker-dast');

interface DASTJobData {
  assetId: string;
  domain: string;
  mode?: string;
}

// Check if ZAP is available
function checkZAPAvailability(): { zapPath: string; baselinePath: string } | null {
  const zapPath = process.env.ZAP_PATH;
  const baselinePath = process.env.ZAP_BASELINE;

  if (!zapPath || !baselinePath) {
    logger.error('ZAP_PATH or ZAP_BASELINE environment variables not set');
    return null;
  }

  if (!fs.existsSync(baselinePath)) {
    logger.error({ baselinePath }, 'ZAP baseline script not found');
    return null;
  }

  return { zapPath, baselinePath };
}

async function processZAPJob(job: Job<DASTJobData>) {
  const { assetId, domain, mode = 'safe' } = job.data;
  logger.info({ jobId: job.id, domain, mode }, 'Processing OWASP ZAP job');

  try {
    // Check ZAP availability
    const zapConfig = checkZAPAvailability();
    if (!zapConfig) {
      throw new Error(
        'OWASP ZAP is not configured. ' +
        'Set ZAP_PATH and ZAP_BASELINE environment variables. ' +
        'Example: ZAP_PATH=/path/to/zap ZAP_BASELINE=/path/to/zap-baseline.py'
      );
    }

    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    // Only baseline scan in safe mode
    if (mode !== 'safe') {
      logger.warn({ mode }, 'Only safe mode supported for ZAP, forcing safe mode');
    }

    // Create temporary directory for reports
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zap-'));
    const jsonReport = path.join(tmpDir, 'report.json');
    const htmlReport = path.join(tmpDir, 'report.html');

    logger.info({ domain, tmpDir }, 'Starting OWASP ZAP Baseline scan');

    await job.updateProgress(20);

    // Run ZAP Baseline scan natively
    const args = [
      zapConfig.baselinePath,
      '-t', `https://${domain}`,
      '-J', jsonReport,
      '-r', htmlReport,
    ];

    logger.info({ args }, 'Spawning ZAP process');

    const zapProcess = spawn('python3', args, {
      env: {
        ...process.env,
        ZAP_PATH: zapConfig.zapPath,
      },
    });

    let output = '';
    let errorOutput = '';

    zapProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      logger.debug({ text: text.substring(0, 100) }, 'ZAP stdout');
    });

    zapProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      errorOutput += text;
      logger.debug({ text: text.substring(0, 100) }, 'ZAP stderr');
    });

    await job.updateProgress(30);

    // Wait for process to finish (ZAP can take a while)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        zapProcess.kill();
        reject(new Error('ZAP scan timeout (10 minutes)'));
      }, 10 * 60 * 1000); // 10 minutes

      zapProcess.on('close', (code) => {
        clearTimeout(timeout);
        // ZAP baseline returns non-zero if it finds issues, which is expected
        logger.info({ jobId: job.id, code }, 'ZAP process finished');
        resolve();
      });

      zapProcess.on('error', (error) => {
        clearTimeout(timeout);
        logger.error({ error }, 'Failed to spawn ZAP');
        reject(error);
      });
    });

    logger.info({ jobId: job.id }, 'ZAP scan completed');

    await job.updateProgress(80);

    // Parse JSON report if available
    let findings: any[] = [];
    let jsonReportContent = '';

    if (fs.existsSync(jsonReport)) {
      jsonReportContent = fs.readFileSync(jsonReport, 'utf-8');
      try {
        const zapReport = JSON.parse(jsonReportContent);

        // Parse ZAP alerts
        if (zapReport.site && zapReport.site[0] && zapReport.site[0].alerts) {
          for (const alert of zapReport.site[0].alerts) {
            const severity =
              alert.riskcode === '3' ? 'high' :
              alert.riskcode === '2' ? 'medium' :
              alert.riskcode === '1' ? 'low' : 'info';

            findings.push({
              title: alert.name || 'Unknown vulnerability',
              description: alert.desc || 'No description',
              severity,
              category: 'WEB' as const,
              metadata: {
                solution: alert.solution,
                reference: alert.reference,
                cweid: alert.cweid,
                wascid: alert.wascid,
                instances: alert.instances?.length || 0,
              },
            });
          }
        }
      } catch (error) {
        logger.warn({ error }, 'Failed to parse ZAP JSON report');
      }
    }

    // If no findings parsed, add summary finding
    if (findings.length === 0) {
      findings.push({
        title: 'ZAP Baseline Scan Completed',
        description: 'OWASP ZAP baseline scan finished. Review full report for details.',
        severity: 'info' as const,
        category: 'WEB' as const,
      });
    }

    for (const finding of findings) {
      await Finding.findOneAndUpdate(
        {
          targetRef: assetId,
          provider: 'zap',
          fingerprint: generateFingerprint({ domain, title: finding.title }),
        },
        {
          targetRef: assetId,
          targetFqdn: domain,
          provider: 'zap',
          ...finding,
          fingerprint: generateFingerprint({ domain, title: finding.title }),
        },
        { upsert: true, new: true }
      );
    }

    // Save JSON report to GridFS if available
    let evidenceId;
    if (jsonReportContent) {
      evidenceId = await saveEvidence(
        Buffer.from(jsonReportContent, 'utf-8'),
        {
          filename: `zap-baseline-${domain}-${Date.now()}.json`,
          contentType: 'application/json',
          targetFqdn: domain,
          jobId: job.id,
        }
      );
    } else {
      // Save console output as fallback
      evidenceId = await saveEvidence(
        Buffer.from(output, 'utf-8'),
        {
          filename: `zap-baseline-${domain}-${Date.now()}.txt`,
          contentType: 'text/plain',
          targetFqdn: domain,
          jobId: job.id,
        }
      );
    }

    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn({ error, tmpDir }, 'Failed to cleanup temp directory');
    }

    await job.updateProgress(100);
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      {
        status: 'done',
        finishedAt: new Date(),
        progress: 100,
        message: `ZAP baseline scan completed - ${findings.length} findings`,
        metadata: { evidenceId: evidenceId.toString(), findingsCount: findings.length },
      }
    );

    logger.info({ jobId: job.id, domain, findingsCount: findings.length }, 'ZAP job completed');
    return { success: true, findingsCount: findings.length };
  } catch (error: any) {
    logger.error({ error, jobId: job.id, domain }, 'ZAP job failed');
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'failed', finishedAt: new Date(), error: error.message }
    );
    throw error;
  }
}

async function start() {
  logger.info('Starting DAST worker...');

  await connect(process.env.MONGODB_URI!, { dbName: 'pablos-network' });
  logger.info('Connected to MongoDB');

  const worker = new Worker<DASTJobData>('zap', processZAPJob, {
    connection: redis,
    concurrency: 1, // Only 1 concurrent ZAP scan
    limiter: { max: 2, duration: 60000 }, // 2 scans per minute
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
  });

  logger.info('DAST worker started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start DAST worker');
  process.exit(1);
});

