# Pablos Network WebTUI

**Status:** 🚧 Not yet implemented

Web-based Terminal User Interface for Pablos Network OSINT + AppSec orchestrator.

## Planned Features

### Terminal Interface (xterm.js)
- Full terminal emulation with xterm.js
- Command history and autocomplete
- Syntax highlighting for commands
- Real-time log streaming from workers
- Copy/paste support
- Customizable themes

### Command Palette
- Quick command access (Cmd/Ctrl+K)
- Fuzzy search
- Recent commands
- Command templates
- Keyboard shortcuts

### Real-time Panels
- **Jobs Panel**: Active/completed jobs with progress bars
- **Findings Panel**: Live findings feed with severity filters
- **Assets Panel**: Discovered assets tree view
- **Metrics Panel**: System metrics and statistics

### Commands

```bash
# Scope management
:scope add example.com --verify=dns
:scope verify example.com <token>
:scope list

# Scanning
:scan passive example.com
:scan web example.com --mode=safe --include=dirsearch
:scan dast example.com --safe
:scan full example.com  # AI-planned comprehensive scan

# Asset exploration
:subs example.com --all
:revip 203.0.113.10
:whois example.com

# Findings
:findings example.com --severity=high
:findings --since=24h --category=WEB
:export findings example.com --format=json

# Reporting
:report example.com
:report example.com --format=pdf --output=report.pdf

# System
:jobs --status=running
:jobs cancel <job-id>
:metrics
:help
:clear
```

### Dashboard Views
- Executive summary
- Findings heatmap
- Timeline view
- Asset graph visualization
- Risk score trends

### Authentication
- Auth.js (NextAuth) integration
- JWT-based sessions
- Role-based access control (admin, analyst, viewer)
- API key management

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Terminal**: xterm.js + addons
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **Real-time**: Socket.IO client + SSE
- **Auth**: NextAuth.js
- **Charts**: Recharts or Chart.js

## Implementation Plan

### Phase 1: Basic Terminal
- [ ] Setup Next.js project
- [ ] Integrate xterm.js
- [ ] Command parser
- [ ] Basic commands (scope, scan)
- [ ] API client

### Phase 2: Real-time
- [ ] WebSocket integration
- [ ] SSE progress streaming
- [ ] Live findings feed
- [ ] Job status updates

### Phase 3: UI Panels
- [ ] Jobs panel with progress
- [ ] Findings panel with filters
- [ ] Assets tree view
- [ ] Command palette

### Phase 4: Advanced Features
- [ ] AI-powered command suggestions
- [ ] Report generation UI
- [ ] Export functionality
- [ ] Dashboard views

### Phase 5: Auth & Polish
- [ ] NextAuth integration
- [ ] User management
- [ ] Themes (dark/light)
- [ ] Keyboard shortcuts
- [ ] Mobile responsive

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm --filter @pablos/webtui dev

# Build
pnpm --filter @pablos/webtui build

# Start production
pnpm --filter @pablos/webtui start
```

## Directory Structure (Planned)

```
apps/webtui/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/
│   │   └── auth/[...nextauth]/route.ts
│   └── dashboard/
│       ├── page.tsx
│       └── layout.tsx
├── components/
│   ├── terminal/
│   │   ├── Terminal.tsx
│   │   ├── CommandParser.ts
│   │   └── CommandHistory.ts
│   ├── panels/
│   │   ├── JobsPanel.tsx
│   │   ├── FindingsPanel.tsx
│   │   └── AssetsPanel.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Badge.tsx
│   └── CommandPalette.tsx
├── lib/
│   ├── api-client.ts
│   ├── websocket.ts
│   └── commands/
│       ├── scope.ts
│       ├── scan.ts
│       └── findings.ts
├── hooks/
│   ├── useWebSocket.ts
│   ├── useSSE.ts
│   └── useCommands.ts
├── store/
│   ├── jobs.ts
│   ├── findings.ts
│   └── terminal.ts
└── styles/
    └── globals.css
```

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

WebTUI-specific:
- Follow Next.js App Router conventions
- Use Tailwind for styling
- Keep components small and focused
- Write TypeScript with strict mode
- Test commands thoroughly

## References

- [xterm.js Documentation](https://xtermjs.org/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)
- [NextAuth.js](https://next-auth.js.org/)

