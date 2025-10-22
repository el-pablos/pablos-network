#!/usr/bin/env bash
# Restart Pablos Network services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color output functions
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

# Parse command line arguments
SERVICE=${1:-all}

info "=== Pablos Network Service Manager ==="
info "Restarting services..."
echo ""

# Stop services
info "Stopping services..."
"$SCRIPT_DIR/stop.sh" "$SERVICE"

echo ""
sleep 2

# Start services
info "Starting services..."
"$SCRIPT_DIR/start.sh" "$SERVICE"

echo ""
info "Restart complete!"

