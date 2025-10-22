# Pablos Network - Process Management Scripts

This directory contains comprehensive process management scripts for running Pablos Network services in production and development environments.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Available Scripts](#available-scripts)
- [Usage Examples](#usage-examples)
- [Service Architecture](#service-architecture)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Pablos Network is a full-stack TypeScript OSINT and Application Security orchestrator with real-time WebTUI capabilities. The platform consists of multiple microservices:

- **Gateway** - NestJS API gateway (Port 4000)
- **AI Service** - Fastify-based AI/ML service (Port 4001)
- **Workers** - BullMQ workers for background processing
  - DAST Worker - ZAP security scanner
  - DNS Worker - DNS enumeration
  - Origin Worker - CF-Hero origin discovery
  - OSINT Worker - Open-source intelligence gathering
  - WebDiscovery Worker - Directory/path discovery
- **WebTUI** - Next.js web interface (Port 3000)

## 📦 Prerequisites

### Required Services

1. **MongoDB** - Must be running before starting Pablos Network services
   ```bash
   # Ubuntu/Debian
   sudo systemctl start mongodb
   
   # macOS (Homebrew)
   brew services start mongodb-community
   
   # Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Redis** - Required for BullMQ job queues
   ```bash
   # Ubuntu/Debian
   sudo systemctl start redis
   
   # macOS (Homebrew)
   brew services start redis
   
   # Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/pablos-network

# Redis
REDIS_URL=redis://localhost:6379

# Gateway
GATEWAY_PORT=4000

# AI Service
AI_SERVICE_PORT=4001
GEMINI_API_KEY=your_gemini_api_key_here

# WebTUI
WEBTUI_PORT=3000

# Workers
CF_HERO_BIN=cf-hero
DIRSEARCH_BIN=dirsearch
ZAP_PATH=/path/to/zap.sh
```

## 🚀 Available Scripts

### Windows (PowerShell)

| Script | Description |
|--------|-------------|
| `start.ps1` | Start all or specific services |
| `stop.ps1` | Stop all or specific services gracefully |
| `restart.ps1` | Restart all or specific services |
| `status.ps1` | Check status of all services (PID, port, memory, uptime) |
| `logs.ps1` | View/tail logs from services |
| `dev.ps1` | Start services in development mode with hot reload |

### Unix/Linux/macOS (Bash)

| Script | Description |
|--------|-------------|
| `start.sh` | Start all or specific services |
| `stop.sh` | Stop all or specific services gracefully |
| `restart.sh` | Restart all or specific services |
| `status.sh` | Check status of all services (PID, port, memory, uptime) |
| `logs.sh` | View/tail logs from services |
| `dev.sh` | Start services in development mode with hot reload |

## 📖 Usage Examples

### Starting Services

**Start all services:**
```bash
# Windows
.\scripts\start.ps1

# Unix/Linux/macOS
./scripts/start.sh
```

**Start a specific service:**
```bash
# Windows
.\scripts\start.ps1 -Service gateway
.\scripts\start.ps1 -Service ai
.\scripts\start.ps1 -Service webtui

# Unix/Linux/macOS
./scripts/start.sh gateway
./scripts/start.sh ai
./scripts/start.sh webtui
```

**Available service names:**
- `gateway` - API Gateway
- `ai` - AI Service
- `worker-dast` - DAST Worker
- `worker-dns` - DNS Worker
- `worker-origin` - Origin Worker
- `worker-osint` - OSINT Worker
- `worker-webdiscovery` - WebDiscovery Worker
- `webtui` - Web Interface
- `all` - All services (default)

### Stopping Services

**Stop all services:**
```bash
# Windows
.\scripts\stop.ps1

# Unix/Linux/macOS
./scripts/stop.sh
```

**Stop a specific service:**
```bash
# Windows
.\scripts\stop.ps1 -Service gateway

# Unix/Linux/macOS
./scripts/stop.sh gateway
```

### Restarting Services

**Restart all services:**
```bash
# Windows
.\scripts\restart.ps1

# Unix/Linux/macOS
./scripts/restart.sh
```

**Restart a specific service:**
```bash
# Windows
.\scripts\restart.ps1 -Service gateway

# Unix/Linux/macOS
./scripts/restart.sh gateway
```

### Checking Status

**View status of all services:**
```bash
# Windows
.\scripts\status.ps1

# Unix/Linux/macOS
./scripts/status.sh
```

**Example output:**
```
=== Pablos Network Service Status ===

SERVICE                   STATUS     PID        PORT       MEMORY          UPTIME
-----------------------------------------------------------------------------------------------
gateway                   RUNNING    12345      4000       156.32 MB       00h 15m 23s
ai                        RUNNING    12346      4001       98.45 MB        00h 15m 22s
worker-dast               RUNNING    12347      -          45.67 MB        00h 15m 21s
worker-dns                RUNNING    12348      -          42.11 MB        00h 15m 20s
worker-origin             RUNNING    12349      -          48.90 MB        00h 15m 19s
worker-osint              RUNNING    12350      -          44.23 MB        00h 15m 18s
worker-webdiscovery       RUNNING    12351      -          46.78 MB        00h 15m 17s
webtui                    RUNNING    12352      3000       201.45 MB       00h 15m 16s

✓ All services are running (8/8)
```

### Viewing Logs

**View logs from all services (last 50 lines):**
```bash
# Windows
.\scripts\logs.ps1

# Unix/Linux/macOS
./scripts/logs.sh
```

**View logs from a specific service:**
```bash
# Windows
.\scripts\logs.ps1 -Service gateway

# Unix/Linux/macOS
./scripts/logs.sh gateway
```

**Follow logs in real-time (like tail -f):**
```bash
# Windows
.\scripts\logs.ps1 -Service gateway -Follow

# Unix/Linux/macOS
./scripts/logs.sh gateway -f
```

**View more lines:**
```bash
# Windows
.\scripts\logs.ps1 -Service ai -Lines 100

# Unix/Linux/macOS
./scripts/logs.sh ai -n 100
```

### Development Mode

**Start all services in development mode with hot reload:**
```bash
# Windows
.\scripts\dev.ps1

# Unix/Linux/macOS
./scripts/dev.sh
```

**Start a specific service in development mode:**
```bash
# Windows
.\scripts\dev.ps1 -Service webtui

# Unix/Linux/macOS
./scripts/dev.sh webtui
```

Development mode features:
- Hot reload on code changes
- Source maps enabled
- Detailed error messages
- All services run in foreground (Ctrl+C to stop)

## 🏗️ Service Architecture

### Process Management

- **PID Files**: Stored in `.pids/` directory
  - Format: `.pids/<service-name>.pid`
  - Automatically cleaned up on service stop
  - Stale PIDs are detected and removed

- **Log Files**: Stored in `logs/` directory
  - Format: `logs/<service-name>-YYYYMMDD-HHMMSS.log`
  - Timestamped for each service start
  - Rotated automatically (latest log is used)

### Service Dependencies

```
┌─────────────────────────────────────────┐
│         External Dependencies           │
│  ┌──────────┐        ┌──────────┐      │
│  │ MongoDB  │        │  Redis   │      │
│  └────┬─────┘        └────┬─────┘      │
└───────┼──────────────────┼─────────────┘
        │                  │
        ▼                  ▼
┌─────────────────────────────────────────┐
│         Core Services                   │
│  ┌──────────┐        ┌──────────┐      │
│  │ Gateway  │        │    AI    │      │
│  │ (NestJS) │        │(Fastify) │      │
│  └────┬─────┘        └────┬─────┘      │
└───────┼──────────────────┼─────────────┘
        │                  │
        ▼                  ▼
┌─────────────────────────────────────────┐
│         Workers (BullMQ)                │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐│
│  │ DAST │ │ DNS  │ │ Origin │ │OSINT ││
│  └──────┘ └──────┘ └────────┘ └──────┘│
│  ┌──────────────┐                      │
│  │ WebDiscovery │                      │
│  └──────────────┘                      │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│         Frontend                        │
│  ┌──────────────────────────────────┐  │
│  │   WebTUI (Next.js)               │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Startup Order

1. **External Dependencies** (must be running first)
   - MongoDB
   - Redis

2. **Core Services** (started in parallel)
   - Gateway
   - AI Service

3. **Workers** (started in parallel)
   - DAST Worker
   - DNS Worker
   - Origin Worker
   - OSINT Worker
   - WebDiscovery Worker

4. **Frontend**
   - WebTUI

### Shutdown Order

Services are stopped in reverse order to ensure graceful shutdown:

1. WebTUI
2. Workers (all in parallel)
3. AI Service
4. Gateway

## 🔧 Troubleshooting

### Service Won't Start

**Check if port is already in use:**
```bash
# Windows
netstat -ano | findstr :4000

# Unix/Linux/macOS
lsof -i :4000
```

**Check MongoDB connection:**
```bash
# Test MongoDB connection
mongosh $MONGODB_URI --eval "db.adminCommand('ping')"
```

**Check Redis connection:**
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Service Crashes Immediately

**View the logs:**
```bash
# Windows
.\scripts\logs.ps1 -Service <service-name>

# Unix/Linux/macOS
./scripts/logs.sh <service-name>
```

**Common issues:**
- Missing environment variables in `.env`
- MongoDB/Redis not running
- Port already in use
- Missing dependencies (run `pnpm install`)

### Stale PID Files

If a service shows as "running" but isn't actually running:

```bash
# Windows
Remove-Item .pids\<service-name>.pid

# Unix/Linux/macOS
rm .pids/<service-name>.pid
```

The status script automatically detects and removes stale PID files.

### Permission Denied (Unix/Linux/macOS)

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### View All Logs

To view all log files:
```bash
# Windows
Get-ChildItem logs\

# Unix/Linux/macOS
ls -lh logs/
```

## 📊 Monitoring

### Health Checks

**Gateway Health:**
```bash
curl http://localhost:4000/health
```

**AI Service Health:**
```bash
curl http://localhost:4001/health
```

### Resource Usage

The `status` script shows memory usage and uptime for each service. For more detailed monitoring:

```bash
# Windows
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Unix/Linux/macOS
ps aux | grep node
```

## 🔐 Security Notes

- Never commit `.env` files to version control
- Ensure MongoDB and Redis are properly secured
- Use strong passwords for production databases
- Consider using environment-specific `.env` files (`.env.production`, `.env.staging`)
- Restrict access to log files (may contain sensitive information)

## 📝 License

This project is part of Pablos Network. See the main repository for license information.

