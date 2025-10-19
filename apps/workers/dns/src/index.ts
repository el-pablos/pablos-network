import { Worker, Job } from 'bullmq';
import { connect, connection, model, Schema } from 'mongoose';
import { redis, createLogger, generateFingerprint } from '@pablos/utils';
import { promises as dnsPromises } from 'dns';
import { Asset, Finding, Job as JobModel, Metric } from './models';

const logger = createLogger('worker-dns');

interface DNSJobData {
  assetId: string;
  domain: string;
  mode?: string;
}

async function processDNSJob(job: Job<DNSJobData>) {
  const { assetId, domain } = job.data;
  
  logger.info({ jobId: job.id, domain }, 'Processing DNS job');

  try {
    // Update job status
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    await job.updateProgress(10);

    // 1. Resolve A records
    logger.debug({ domain }, 'Resolving A records');
    const ipAddresses: string[] = [];
    try {
      const addresses = await dnsPromises.resolve4(domain);
      ipAddresses.push(...addresses);
      
      // Create finding for each IP
      for (const ip of addresses) {
        await Finding.findOneAndUpdate(
          {
            targetRef: assetId,
            provider: 'dns',
            fingerprint: generateFingerprint({ type: 'a-record', domain, ip }),
          },
          {
            targetRef: assetId,
            targetFqdn: domain,
            provider: 'dns',
            category: 'DNS',
            title: `A Record: ${ip}`,
            description: `Domain ${domain} resolves to ${ip}`,
            severity: 'info',
            fingerprint: generateFingerprint({ type: 'a-record', domain, ip }),
            metadata: { recordType: 'A', ip },
          },
          { upsert: true, new: true }
        );
      }
    } catch (error: any) {
      logger.warn({ domain, error: error.message }, 'Failed to resolve A records');
    }

    await job.updateProgress(30);

    // 2. Resolve AAAA records (IPv6)
    try {
      const addresses = await dnsPromises.resolve6(domain);
      ipAddresses.push(...addresses);
    } catch (error: any) {
      logger.debug({ domain }, 'No AAAA records found');
    }

    await job.updateProgress(50);

    // 3. Check common subdomains
    const commonSubdomains = ['www', 'mail', 'ftp', 'admin', 'api', 'dev', 'staging', 'test'];
    let foundSubdomains = 0;

    for (const sub of commonSubdomains) {
      const subdomain = `${sub}.${domain}`;
      try {
        const addresses = await dnsPromises.resolve4(subdomain);
        
        // Create or update subdomain asset
        await Asset.findOneAndUpdate(
          { fqdn: subdomain },
          {
            type: 'subdomain',
            fqdn: subdomain,
            parentFqdn: domain,
            active: true,
            ip: addresses,
          },
          { upsert: true, new: true }
        );

        foundSubdomains++;
        logger.info({ subdomain, ip: addresses }, 'Subdomain discovered');
      } catch (error) {
        // Subdomain doesn't exist, mark as inactive if it exists
        await Asset.findOneAndUpdate(
          { fqdn: subdomain },
          { active: false },
          { upsert: false }
        );
      }
    }

    await job.updateProgress(80);

    // Update parent asset with IPs
    await Asset.findByIdAndUpdate(assetId, { ip: ipAddresses });

    // Create metric
    await Metric.create({
      ts: new Date(),
      entity: { kind: 'job', id: job.id! },
      name: 'subdomains_found',
      value: foundSubdomains,
    });

    await job.updateProgress(100);

    // Update job status
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { 
        status: 'done', 
        finishedAt: new Date(), 
        progress: 100,
        message: `Found ${foundSubdomains} subdomains, ${ipAddresses.length} IPs`
      }
    );

    logger.info({ jobId: job.id, domain, foundSubdomains }, 'DNS job completed');

    return { success: true, foundSubdomains, ipAddresses: ipAddresses.length };
  } catch (error: any) {
    logger.error({ error, jobId: job.id, domain }, 'DNS job failed');
    
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { 
        status: 'failed', 
        finishedAt: new Date(),
        error: error.message
      }
    );

    throw error;
  }
}

async function start() {
  logger.info('Starting DNS worker...');

  // Connect to MongoDB
  await connect(process.env.MONGODB_URI!, {
    dbName: 'pablos-network',
  });
  logger.info('Connected to MongoDB');

  // Create worker
  const worker = new Worker<DNSJobData>('dns', processDNSJob, {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
  });

  logger.info('DNS worker started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start DNS worker');
  process.exit(1);
});

