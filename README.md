# Pablos Network

**OSINT + AppSec Orchestrator** dengan WebTUI real-time dan integrasi AI (Gemini).

⚠️ **LEGAL NOTICE**: Semua scan aktif **HANYA untuk aset yang telah diverifikasi kepemilikannya**. Penggunaan ilegal adalah tanggung jawab pengguna.

## 🏗️ Arsitektur

### Stack Teknologi

- **Frontend**: Next.js 14+ (TypeScript, App Router) + xterm.js + Tailwind + TanStack Query + Zustand
- **Backend**: NestJS (Fastify) + BullMQ + Socket.IO + SSE
- **Database**: MongoDB (Mongoose) + GridFS untuk evidence storage
- **Cache/Queue**: Redis Cloud (ioredis + BullMQ)
- **AI**: Google Gemini (`@google/generative-ai`)
- **Orchestration**: Docker + Turborepo monorepo
- **Auth**: Auth.js (NextAuth) dengan JWT

### Services

```
pablos-network/
├── apps/
│   ├── webtui/         # Next.js WebTUI (belum diimplementasi)
│   ├── gateway/        # NestJS API + WebSocket + SSE
│   ├── ai/             # Gemini planner + normalizer + scorer + reporter
│   └── workers/
│       ├── dns/        # Subdomain enumeration + IP resolution
│       ├── osint/      # ZoomEye + BinaryEdge adapters
│       ├── webdiscovery/ # Dirsearch via Docker
│       ├── dast/       # OWASP ZAP Baseline (belum diimplementasi)
│       ├── reverseip/  # Passive DNS/PTR (belum diimplementasi)
│       ├── domainwatch/ # WHOIS + zone diff (belum diimplementasi)
│       ├── policy/     # IP Geolocation Lock + WAF rules (belum diimplementasi)
│       ├── seo/        # DA/PA/DR checker (belum diimplementasi)
│       └── media/      # YT/Instagram downloader (belum diimplementasi)
└── packages/
    ├── contracts/      # Zod schemas untuk semua data types
    └── utils/          # Logger, Redis, GridFS, HTTP client, crypto
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Redis Cloud account (sudah dikonfigurasi di `.env`)

### Setup

1. **Clone & Install**

```bash
git clone <repo-url>
cd pablos-network
pnpm install
```

2. **Environment Variables**

File `.env` sudah dibuat dengan kredensial yang diperlukan:

```env
# MongoDB (Cloud)
MONGODB_URI="mongodb+srv://pabs:kontol@pablosnet.dfdtudp.mongodb.net/?retryWrites=true&w=majority&appName=pablosnet"

# Redis Cloud
REDIS_HOST="redis-17540.c1.ap-southeast-1-1.ec2.redns.redis-cloud.com"
REDIS_PORT="17540"
REDIS_USERNAME="default"
REDIS_PASSWORD="MpwtzB4egNzhWENcLpi52hiYtjsmS2RS"

# Gemini AI
GEMINI_API_KEY="AIzaSyB4GcnFHqLi2V5KsFiOBprhTksqmOa6OFg"

# External providers (opsional)
ZOOMEYE_API_KEY=""
BINARYEDGE_API_KEY=""
```

⚠️ **JANGAN commit `.env` ke repository publik!**

3. **Build Packages**

```bash
pnpm --filter @pablos/contracts build
pnpm --filter @pablos/utils build
```

4. **Development Mode**

```bash
# Terminal 1: Gateway
pnpm --filter @pablos/gateway dev

# Terminal 2: AI Service
pnpm --filter @pablos/ai dev

# Terminal 3: DNS Worker
pnpm --filter @pablos/worker-dns dev

# Terminal 4: OSINT Worker
pnpm --filter @pablos/worker-osint dev

# Terminal 5: Webdiscovery Worker
pnpm --filter @pablos/worker-webdiscovery dev
```

Atau gunakan Docker Compose:

```bash
docker-compose up -d
```

5. **Access Services**

- Gateway API: http://localhost:4000
- OpenAPI Docs: http://localhost:4000/docs
- AI Service: http://localhost:4001
- WebSocket: ws://localhost:4000/ws
- SSE Progress: http://localhost:4000/progress/stream?jobId=<uuid>

## 📡 API Usage

### 1. Add Domain to Scope

```bash
curl -X POST http://localhost:4000/scope \
  -H "Content-Type: application/json" \
  -d '{
    "type": "domain",
    "fqdn": "example.com",
    "verify": "dns"
  }'
```

Response:
```json
{
  "asset": {
    "id": "...",
    "fqdn": "example.com",
    "verified": false
  },
  "verification": {
    "method": "dns",
    "instructions": "Add TXT record: pablos-verify-...",
    "record": "_pablos-verify.example.com TXT pablos-verify-..."
  }
}
```

### 2. Verify Domain

```bash
curl -X POST http://localhost:4000/scope/verify \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "method": "dns",
    "token": "pablos-verify-..."
  }'
```

### 3. Run Passive Scan

```bash
curl -X POST http://localhost:4000/scan/passive \
  -H "Content-Type: application/json" \
  -d '{ "domain": "example.com" }'
```

### 4. Run Web Discovery (Requires Verification)

```bash
curl -X POST http://localhost:4000/scan/web \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "mode": "safe",
    "include": ["dirsearch"]
  }'
```

### 5. Get Findings

```bash
curl "http://localhost:4000/findings?domain=example.com&severity=high"
```

### 6. Get Subdomains

```bash
curl "http://localhost:4000/assets/example.com/subs?all=true"
```

## 🔌 Real-time Integration

### WebSocket (Socket.IO)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/ws');

// Subscribe to job updates
socket.on('job:update', (job) => {
  console.log('Job updated:', job);
});

// Subscribe to new findings
socket.on('finding:new', (finding) => {
  console.log('New finding:', finding);
});

// Subscribe to specific job logs
socket.emit('subscribe:job', { jobId: 'uuid' });
socket.on('job:log', ({ jobId, log, timestamp }) => {
  console.log(`[${jobId}] ${log}`);
});

// Cancel job
socket.emit('job:cancel', { jobId: 'uuid', provider: 'dirsearch' });
```

### Server-Sent Events (SSE)

```javascript
const eventSource = new EventSource('http://localhost:4000/progress/stream?jobId=uuid');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'progress') {
    console.log(`Progress: ${data.value}%`);
  }
};
```

## 🛡️ Legal Guardrails

### Domain Verification

Scan aktif (dirsearch, ZAP) **WAJIB** verifikasi kepemilikan domain:

1. **DNS TXT Record**: `_pablos-verify.domain.com TXT <token>`
2. **HTTP File**: `https://domain.com/.well-known/pablos-proof.txt` berisi `<token>`

Tanpa verifikasi, API akan return `403 Forbidden` dengan error `VERIFICATION_REQUIRED`.

### Rate Limiting

- **BullMQ Limiter**: Setiap worker memiliki rate limit (contoh: DNS = 10 jobs/menit)
- **Safe Mode**: Default untuk semua scan aktif
  - Dirsearch: 50 req/s, 5 threads, max 5 menit
  - ZAP: Baseline scan only (no active attacks)

### Audit Logging

Semua aksi dicatat di koleksi `audit_logs` (immutable):

```javascript
{
  userId: "user-id",
  action: "scan:web",
  target: "example.com",
  targetRef: ObjectId,
  timestamp: ISODate,
  success: true,
  metadata: { mode: "safe" }
}
```

## 🧠 AI Integration (Gemini)

### Planner

```bash
curl -X POST http://localhost:4001/plan \
  -H "Content-Type: application/json" \
  -d '{
    "command": "full scan",
    "target": "example.com",
    "mode": "safe"
  }'
```

Response: DAG of scan steps with dependencies.

### Normalizer

Converts raw scan results to standardized `Finding` objects.

### Risk Scorer

Calculates CVSS + severity based on finding + context.

### Report Generator

```bash
curl -X POST http://localhost:4001/report \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "findings": [...]
  }'
```

Returns markdown report (executive + technical).

## 📦 GridFS Evidence Storage

Semua evidence (reports, screenshots, raw output) disimpan di **GridFS** (bukan filesystem/S3):

```typescript
import { saveEvidence, getEvidence } from '@pablos/utils';

// Save
const fileId = await saveEvidence(buffer, {
  filename: 'report.pdf',
  contentType: 'application/pdf',
  targetFqdn: 'example.com',
  jobId: 'uuid',
});

// Retrieve
const stream = await getEvidence(fileId);
stream.pipe(response);
```

## 🔧 Development

### Build All

```bash
pnpm build
```

### Type Check

```bash
pnpm type-check
```

### Clean

```bash
pnpm clean
```

### Add New Worker

1. Copy template dari `apps/workers/dns`
2. Update `package.json` name
3. Implement job processor
4. Add to `docker-compose.yml`
5. Register queue di `apps/gateway/src/queue/queue.service.ts`

## 📊 MongoDB Indexes

Indexes otomatis dibuat saat startup:

- **assets**: `{ fqdn: 1 }` (unique), `{ parentFqdn: 1, active: 1 }`
- **jobs**: `{ jobId: 1 }` (unique), `{ status: 1, updatedAt: -1 }`
- **findings**: `{ targetRef: 1, provider: 1, fingerprint: 1 }` (unique)
- **metrics**: `{ ts: 1 }` (TTL 14 days)

## 🚨 Troubleshooting

### Redis Connection Error

Pastikan kredensial Redis Cloud benar di `.env`. Test koneksi:

```bash
redis-cli -h redis-17540.c1.ap-southeast-1-1.ec2.redns.redis-cloud.com -p 17540 -a <password> --tls ping
```

### MongoDB Change Streams Not Working

Change Streams memerlukan **replica set**. Jika pakai MongoDB Atlas, sudah otomatis. Jika lokal:

```bash
docker-compose up -d mongodb mongo-init
```

### Worker Not Processing Jobs

Check logs:

```bash
docker-compose logs worker-dns
```

Pastikan Redis dan MongoDB terhubung.

## 📝 TODO

- [ ] Implement Next.js WebTUI dengan xterm.js
- [ ] DAST worker (OWASP ZAP)
- [ ] ReverseIP worker
- [ ] DomainWatch worker (WHOIS + zone diff)
- [ ] Policy worker (IP Geolocation Lock + WAF rules)
- [ ] SEO worker (DA/PA/DR checker)
- [ ] Media worker (YT/Instagram downloader)
- [ ] Auth.js integration
- [ ] Command palette di WebTUI
- [ ] Real-time terminal output streaming
- [ ] Screenshot capture untuk web findings
- [ ] Integration tests
- [ ] Production deployment guide

## 📄 License

Proprietary - For authorized use only.

## ⚖️ Disclaimer

Tool ini **HANYA untuk pengujian keamanan pada aset yang Anda miliki atau memiliki izin tertulis**. Penyalahgunaan adalah tanggung jawab pengguna. Penulis tidak bertanggung jawab atas penggunaan ilegal.

