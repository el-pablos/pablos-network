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
- **Orchestration**: Turborepo monorepo + concurrently
- **Auth**: Auth.js (NextAuth) dengan JWT
- **Tool Execution**: Native binaries (dirsearch, OWASP ZAP) via child_process

### Services

```
pablos-network/
├── apps/
│   ├── webtui/         # Next.js WebTUI dengan xterm.js terminal
│   ├── gateway/        # NestJS API + WebSocket + SSE
│   ├── ai/             # Gemini planner + normalizer + scorer + reporter
│   └── workers/
│       ├── dns/        # Subdomain enumeration + IP resolution
│       ├── osint/      # ZoomEye + BinaryEdge adapters
│       ├── webdiscovery/ # Dirsearch via native Python execution
│       ├── dast/       # OWASP ZAP Baseline via native execution
│       ├── reverseip/  # Passive DNS/PTR (planned)
│       ├── domainwatch/ # WHOIS + zone diff (planned)
│       ├── policy/     # IP Geolocation Lock + WAF rules (planned)
│       ├── seo/        # DA/PA/DR checker (planned)
│       └── media/      # YT/Instagram downloader (planned)
└── packages/
    ├── contracts/      # Zod schemas untuk semua data types
    └── utils/          # Logger, Redis, GridFS, HTTP client, crypto
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** dan **pnpm 8+**
- **Python 3.11+** (untuk dirsearch dan ZAP)
- **dirsearch**: `pip install dirsearch`
- **OWASP ZAP**: Download dari https://www.zaproxy.org/download/
- **MongoDB Atlas** account (sudah dikonfigurasi di `.env`)
- **Redis Cloud** account (sudah dikonfigurasi di `.env`)

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

4. **Healthcheck** (Optional)

Verify all dependencies are available:

```bash
pnpm healthcheck
```

This will check:
- ✅ MongoDB Atlas connectivity
- ✅ Redis Cloud connectivity
- ✅ Gemini API key
- ⚠️ dirsearch availability (optional)
- ⚠️ OWASP ZAP availability (optional)

5. **Development Mode**

Run all services in one terminal:

```bash
pnpm dev
```

This starts:
- WebTUI (Next.js) on http://localhost:3000
- Gateway (NestJS) on http://localhost:4000
- AI Service on http://localhost:4001
- All workers (DNS, OSINT, webdiscovery, DAST)

Or run services individually:

```bash
# Terminal 1: WebTUI
pnpm dev:webtui

# Terminal 2: Gateway
pnpm dev:gateway

# Terminal 3: AI Service
pnpm dev:ai

# Terminal 4: Workers
pnpm dev:worker:dns
pnpm dev:worker:osint
pnpm dev:worker:webdiscovery
pnpm dev:worker:dast
```

6. **Access Services**

- **WebTUI**: http://localhost:3000
- **Gateway API**: http://localhost:4000
- **OpenAPI Docs**: http://localhost:4000/docs
- **AI Service**: http://localhost:4001
- **WebSocket**: ws://localhost:4000/ws
- **SSE Progress**: http://localhost:4000/progress/stream?jobId=<uuid>

## � WebTUI Usage

The WebTUI provides a terminal-based interface for interacting with Pablos Network.

### Available Commands

**Scope Management:**
- `:scope add <domain>` - Add domain to scope
- `:scope verify <domain>` - Verify domain ownership
- `:scope list` - List all assets in scope

**Scanning:**
- `:scan passive <domain>` - Run passive OSINT scan
- `:scan web <domain>` - Run web discovery (requires verification)
- `:scan dast <domain>` - Run DAST scan (requires verification)
- `:scan full <domain>` - AI-planned comprehensive scan

**Assets:**
- `:subs <domain>` - List discovered subdomains
- `:revip <ip>` - Reverse IP lookup (planned)
- `:whois <domain>` - WHOIS lookup (planned)

**Findings:**
- `:findings <domain>` - View security findings
- `:findings stats <domain>` - View findings statistics
- `:export <domain>` - Export findings to file

**Reporting:**
- `:report <domain>` - Generate AI-powered security report

**System:**
- `:jobs` - View active jobs
- `:metrics` - View system metrics
- `:clear` - Clear terminal
- `:help` - Show all commands

### Keyboard Shortcuts

- **Ctrl+K** / **Cmd+K** - Open command palette
- **Ctrl+L** - Clear terminal
- **Ctrl+C** - Cancel current command
- **↑/↓** - Navigate command history

### Real-time Panels

The WebTUI includes two real-time panels:

1. **Jobs Panel** (top right) - Shows running jobs with progress bars
2. **Findings Panel** (bottom right) - Shows discovered findings with severity filters

## �📡 API Usage

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

## �️ Native Tool Configuration

Pablos Network uses native binary execution instead of Docker for better performance and simpler deployment.

### dirsearch (Web Discovery)

Install via pip:

```bash
pip install dirsearch
```

Or set custom path in `.env`:

```env
DIRSEARCH_BIN="/path/to/dirsearch"
```

### OWASP ZAP (DAST)

Download from https://www.zaproxy.org/download/ and configure in `.env`:

```env
ZAP_PATH="/usr/share/zaproxy"
ZAP_BASELINE="/usr/share/zaproxy/zap-baseline.py"
```

On Windows:
```env
ZAP_PATH="C:\\Program Files\\ZAP\\Zed Attack Proxy"
ZAP_BASELINE="C:\\Program Files\\ZAP\\Zed Attack Proxy\\zap-baseline.py"
```

### Verification

Run healthcheck to verify all tools are available:

```bash
pnpm healthcheck
```

Expected output:
```
✅ MongoDB Atlas: Connected
✅ Redis Cloud: Connected
✅ Gemini API: Configured
⚠️ dirsearch: Available (optional)
⚠️ OWASP ZAP: Available (optional)
```

## �🔧 Development

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
3. Implement job processor with native tool execution
4. Add dev script to root `package.json`
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

