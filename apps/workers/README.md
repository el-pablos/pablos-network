# Pablos Network Workers

This directory contains BullMQ workers that process scan jobs.

## Implemented Workers

### ✅ DNS Worker (`dns/`)
- Subdomain enumeration (common subdomains)
- A/AAAA record resolution
- IP address collection
- Active/inactive subdomain marking

**Queue:** `dns`  
**Concurrency:** 5  
**Rate Limit:** 10 jobs/minute

### ✅ OSINT Worker (`osint/`)
- ZoomEye API integration
- BinaryEdge API integration (stub)
- Passive reconnaissance
- Port/service discovery

**Queues:** `zoomEye`, `binaryEdge`  
**Concurrency:** 2 each  
**Rate Limit:** 5 jobs/minute each

### ✅ Webdiscovery Worker (`webdiscovery/`)
- Dirsearch via Docker
- Path/directory enumeration
- Safe mode throttling (50 req/s, 5 threads)
- GridFS evidence storage

**Queue:** `dirsearch`  
**Concurrency:** 2  
**Rate Limit:** 3 jobs/minute

### ✅ DAST Worker (`dast/`)
- OWASP ZAP Baseline scan via Docker
- Safe mode only (no active attacks)
- Vulnerability detection (SQLi, XSS indicators)
- GridFS report storage

**Queue:** `zap`  
**Concurrency:** 1  
**Rate Limit:** 2 jobs/minute

## Workers to Implement

### 🚧 ReverseIP Worker (`reverseip/`)
**Purpose:** Map all domains hosted on an IP address

**Implementation:**
- Passive DNS lookup
- PTR record queries
- Ownership likelihood scoring
- Cross-reference with known assets

**Queue:** `reverseip`  
**Suggested Rate Limit:** 10 jobs/minute

### 🚧 DomainWatch Worker (`domainwatch/`)
**Purpose:** Monitor domain changes and WHOIS data

**Features:**
- WHOIS data collection
- Zone file diff detection
- **GRAB DOMAIN/SECOND**: Real-time domain registration monitoring
- **BY DATE**: Historical domain data tracking
- Expiration alerts

**Queue:** `domainwatch`  
**Suggested Rate Limit:** 5 jobs/minute

### 🚧 Policy Worker (`policy/`)
**Purpose:** Generate security policy recommendations

**Features:**
- **IP GEOLOCATION LOCK**: Analyze traffic patterns
- Generate WAF rules (Cloudflare, AWS WAF format)
- Firewall rule recommendations
- Access control policy suggestions
- Export as YAML/JSON

**Queue:** `policy`  
**Suggested Rate Limit:** 5 jobs/minute

### 🚧 SEO Worker (`seo/`)
**Purpose:** Mass domain authority and SEO metrics

**Features:**
- **MASS DA/PA/AGE/DR CHECKER**
- Domain Authority (Moz)
- Page Authority
- Domain Age
- Domain Rating (Ahrefs)
- Backlink analysis
- Cache results in MongoDB

**Queue:** `seo`  
**Suggested Rate Limit:** 10 jobs/minute  
**Note:** Requires paid API subscriptions

### 🚧 Media Worker (`media/`)
**Purpose:** Download media from social platforms

**Features:**
- YouTube video/audio download
- Instagram media download
- **Requires `hasRights=true` flag**
- Metadata extraction
- GridFS storage
- Source URL + hash tracking

**Queue:** `media`  
**Suggested Rate Limit:** 5 jobs/minute  
**Legal:** Only with explicit permission

## Worker Template

Use this template to create new workers:

```typescript
import { Worker, Job } from 'bullmq';
import { connect } from 'mongoose';
import { redis, createLogger, generateFingerprint } from '@pablos/utils';
import { Finding, Job as JobModel } from './models';

const logger = createLogger('worker-name');

interface JobData {
  assetId: string;
  domain: string;
  // Add custom fields
}

async function processJob(job: Job<JobData>) {
  const { assetId, domain } = job.data;
  logger.info({ jobId: job.id, domain }, 'Processing job');

  try {
    // Update job status
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'running', startedAt: new Date(), progress: 10 }
    );

    await job.updateProgress(10);

    // YOUR IMPLEMENTATION HERE
    // 1. Fetch data
    // 2. Process results
    // 3. Create findings
    // 4. Save evidence to GridFS

    await job.updateProgress(100);

    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'done', finishedAt: new Date(), progress: 100 }
    );

    logger.info({ jobId: job.id }, 'Job completed');
    return { success: true };
  } catch (error: any) {
    logger.error({ error, jobId: job.id }, 'Job failed');
    await JobModel.findOneAndUpdate(
      { jobId: job.id },
      { status: 'failed', finishedAt: new Date(), error: error.message }
    );
    throw error;
  }
}

async function start() {
  logger.info('Starting worker...');
  await connect(process.env.MONGODB_URI!, { dbName: 'pablos-network' });

  const worker = new Worker<JobData>('queue-name', processJob, {
    connection: redis,
    concurrency: 5,
    limiter: { max: 10, duration: 60000 },
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
  });

  logger.info('Worker started');
}

start().catch((error) => {
  logger.error({ error }, 'Failed to start worker');
  process.exit(1);
});
```

## Development

### Run Single Worker

```bash
pnpm --filter @pablos/worker-dns dev
```

### Run All Workers (Docker)

```bash
docker-compose up -d worker-dns worker-osint worker-webdiscovery worker-dast
```

### View Logs

```bash
# Development
# Logs appear in terminal

# Docker
docker-compose logs -f worker-dns
```

### Test Worker

```bash
# 1. Start worker
pnpm --filter @pablos/worker-dns dev

# 2. Queue a job via API
curl -X POST http://localhost:4000/scan/passive \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com"}'

# 3. Watch logs for processing
```

## Best Practices

1. **Always update job progress** (0-100%)
2. **Use fingerprints** for idempotent findings
3. **Save evidence to GridFS** for large outputs
4. **Implement rate limiting** via BullMQ limiter
5. **Handle errors gracefully** and update job status
6. **Log important events** with structured logging
7. **Respect safe mode** constraints
8. **Validate inputs** with Zod schemas

## Adding to Gateway

After creating a worker, register it in:

1. **Queue Service** (`apps/gateway/src/queue/queue.service.ts`)
2. **Contracts** (`packages/contracts/src/common.ts`)
3. **Scan Controller** (`apps/gateway/src/api/scan.controller.ts`)
4. **Docker Compose** (`docker-compose.yml`)

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed instructions.

