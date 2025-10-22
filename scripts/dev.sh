#!/usr/bin/env bash
# Start Pablos Network services in development mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Color output functions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
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

# Parse command line arguments
SERVICE=${1:-all}

info "=== Pablos Network Development Mode ==="
info "Starting services with hot reload..."
echo ""

# Load environment variables from .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    info "Loading environment variables from .env"
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Get ports from environment or use defaults
GATEWAY_PORT=${GATEWAY_PORT:-4000}
AI_PORT=${AI_SERVICE_PORT:-4001}
WEBTUI_PORT=${WEBTUI_PORT:-3000}

info "Service URLs:"
info "  Gateway:  http://localhost:$GATEWAY_PORT"
info "  AI:       http://localhost:$AI_PORT"
info "  WebTUI:   http://localhost:$WEBTUI_PORT"
echo ""
warning "Press Ctrl+C to stop all services"
echo ""

# Change to root directory
cd "$ROOT_DIR"

# Start services based on parameter
if [ "$SERVICE" = "all" ]; then
    # Start all services using Turborepo
    info "Starting all services in parallel..."
    pnpm dev
else
    # Start specific service
    case "$SERVICE" in
        gateway)
            PACKAGE_NAME="@pablos/gateway"
            ;;
        ai)
            PACKAGE_NAME="@pablos/ai"
            ;;
        worker-dast)
            PACKAGE_NAME="@pablos/worker-dast"
            ;;
        worker-dns)
            PACKAGE_NAME="@pablos/worker-dns"
            ;;
        worker-origin)
            PACKAGE_NAME="@pablos/worker-origin"
            ;;
        worker-osint)
            PACKAGE_NAME="@pablos/worker-osint"
            ;;
        worker-webdiscovery)
            PACKAGE_NAME="@pablos/worker-webdiscovery"
            ;;
        webtui)
            PACKAGE_NAME="@pablos/webtui"
            ;;
        *)
            error "Unknown service: $SERVICE"
            exit 1
            ;;
    esac
    
    info "Starting $SERVICE ($PACKAGE_NAME) in development mode..."
    pnpm --filter "$PACKAGE_NAME" dev
fi

