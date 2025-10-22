#!/usr/bin/env bash
# Start Pablos Network services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$ROOT_DIR/.pids"
LOGS_DIR="$ROOT_DIR/logs"

# Create directories if they don't exist
mkdir -p "$PIDS_DIR"
mkdir -p "$LOGS_DIR"

# Color output functions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if service is already running
is_running() {
    local service_name=$1
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # Stale PID file
            rm -f "$pid_file"
        fi
    fi
    return 1
}

# Start a service
start_service() {
    local service_name=$1
    local command=$2
    local port=${3:-0}
    
    if is_running "$service_name"; then
        warning "$service_name is already running"
        return
    fi
    
    info "Starting $service_name..."
    
    local log_file="$LOGS_DIR/$service_name-$(date +%Y%m%d-%H%M%S).log"
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    # Start the process in the background
    cd "$ROOT_DIR"
    nohup bash -c "$command" > "$log_file" 2>&1 &
    local pid=$!
    
    # Save PID
    echo "$pid" > "$pid_file"
    
    # Wait a moment to check if process started successfully
    sleep 2
    
    if ! ps -p "$pid" > /dev/null 2>&1; then
        error "$service_name failed to start (exited immediately)"
        rm -f "$pid_file"
        return 1
    fi
    
    if [ "$port" -gt 0 ]; then
        success "$service_name started (PID: $pid, Port: $port)"
    else
        success "$service_name started (PID: $pid)"
    fi
    
    info "Logs: $log_file"
}

# Load environment variables from .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    info "Loading environment variables from .env"
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Get ports from environment or use defaults
GATEWAY_PORT=${GATEWAY_PORT:-4000}
AI_PORT=${AI_SERVICE_PORT:-4001}
WEBTUI_PORT=${WEBTUI_PORT:-3000}

# Parse command line arguments
SERVICE=${1:-all}

info "=== Pablos Network Service Manager ==="
info "Starting services..."
echo ""

# Start services based on parameter
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "mongodb" ]; then
    info "Checking MongoDB..."
    MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017}
    info "MongoDB should be running at: $MONGODB_URI"
    warning "Please ensure MongoDB is running as a system service"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "redis" ]; then
    info "Checking Redis..."
    REDIS_URL=${REDIS_URL:-redis://localhost:6379}
    info "Redis should be running at: $REDIS_URL"
    warning "Please ensure Redis is running as a system service or Docker container"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "gateway" ]; then
    start_service "gateway" "pnpm --filter @pablos/gateway start" "$GATEWAY_PORT"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "ai" ]; then
    start_service "ai" "pnpm --filter @pablos/ai start" "$AI_PORT"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "worker-dast" ]; then
    start_service "worker-dast" "pnpm --filter @pablos/worker-dast start"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "worker-dns" ]; then
    start_service "worker-dns" "pnpm --filter @pablos/worker-dns start"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "worker-origin" ]; then
    start_service "worker-origin" "pnpm --filter @pablos/worker-origin start"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "worker-osint" ]; then
    start_service "worker-osint" "pnpm --filter @pablos/worker-osint start"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "worker-webdiscovery" ]; then
    start_service "worker-webdiscovery" "pnpm --filter @pablos/worker-webdiscovery start"
fi

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "webtui" ]; then
    start_service "webtui" "pnpm --filter @pablos/webtui start" "$WEBTUI_PORT"
fi

echo ""
success "Service startup complete!"
info "Run './status.sh' to check service status"
info "Run './logs.sh' to view service logs"

