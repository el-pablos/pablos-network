#!/usr/bin/env bash
# Stop Pablos Network services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$ROOT_DIR/.pids"

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

# Stop a service
stop_service() {
    local service_name=$1
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [ ! -f "$pid_file" ]; then
        warning "$service_name is not running (no PID file found)"
        return
    fi
    
    local pid=$(cat "$pid_file")
    
    if ! ps -p "$pid" > /dev/null 2>&1; then
        warning "$service_name is not running (PID $pid not found)"
        rm -f "$pid_file"
        return
    fi
    
    info "Stopping $service_name (PID: $pid)..."
    
    # Try graceful shutdown first (SIGTERM)
    kill -TERM "$pid" 2>/dev/null || true
    
    # Wait up to 5 seconds for graceful shutdown
    local count=0
    while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 5 ]; do
        sleep 1
        count=$((count + 1))
    done
    
    # Force kill if still running (SIGKILL)
    if ps -p "$pid" > /dev/null 2>&1; then
        warning "Forcing $service_name to stop..."
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
    fi
    
    # Remove PID file
    rm -f "$pid_file"
    
    success "$service_name stopped"
}

# Parse command line arguments
SERVICE=${1:-all}

info "=== Pablos Network Service Manager ==="
info "Stopping services..."
echo ""

# Define service list
SERVICES=()

if [ "$SERVICE" = "all" ]; then
    SERVICES=(
        "webtui"
        "worker-webdiscovery"
        "worker-osint"
        "worker-origin"
        "worker-dns"
        "worker-dast"
        "ai"
        "gateway"
    )
else
    SERVICES=("$SERVICE")
fi

# Stop services in reverse order (workers first, then core services)
for svc in "${SERVICES[@]}"; do
    stop_service "$svc"
done

echo ""
success "Service shutdown complete!"
info "Run './status.sh' to verify all services are stopped"

