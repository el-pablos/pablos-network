#!/usr/bin/env bash
# View logs from Pablos Network services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$ROOT_DIR/logs"

# Color output functions
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Usage information
usage() {
    cat << EOF
Usage: $0 [SERVICE] [OPTIONS]

View logs from Pablos Network services

Arguments:
    SERVICE     Service to view logs for (default: all)
                Valid values: gateway, ai, worker-dast, worker-dns, worker-origin,
                             worker-osint, worker-webdiscovery, webtui, all

Options:
    -f, --follow    Follow log output (like tail -f)
    -n, --lines N   Number of lines to display (default: 50)
    -h, --help      Show this help message

Examples:
    $0                          Show last 50 lines from all service logs
    $0 gateway -f               Follow gateway service logs in real-time
    $0 ai -n 100                Show last 100 lines from AI service logs
EOF
}

# Parse command line arguments
SERVICE="all"
FOLLOW=false
LINES=50

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        gateway|ai|worker-dast|worker-dns|worker-origin|worker-osint|worker-webdiscovery|webtui|all)
            SERVICE="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Check if logs directory exists
if [ ! -d "$LOGS_DIR" ]; then
    warning "Logs directory not found: $LOGS_DIR"
    info "No services have been started yet."
    exit 0
fi

# Get latest log file for a service
get_latest_log() {
    local service_name=$1
    local log_file=$(ls -t "$LOGS_DIR/$service_name"-*.log 2>/dev/null | head -n 1)
    echo "$log_file"
}

# Display logs for a service
show_logs() {
    local service_name=$1
    local follow_mode=$2
    local line_count=$3
    
    local log_file=$(get_latest_log "$service_name")
    
    if [ -z "$log_file" ]; then
        warning "No logs found for $service_name"
        return
    fi
    
    info "=== $service_name logs ($log_file) ==="
    echo ""
    
    if [ "$follow_mode" = true ]; then
        # Follow mode (like tail -f)
        tail -n "$line_count" -f "$log_file"
    else
        # Show last N lines
        tail -n "$line_count" "$log_file"
    fi
}

# Define service list
SERVICES=()

if [ "$SERVICE" = "all" ]; then
    SERVICES=(
        "gateway"
        "ai"
        "worker-dast"
        "worker-dns"
        "worker-origin"
        "worker-osint"
        "worker-webdiscovery"
        "webtui"
    )
else
    SERVICES=("$SERVICE")
fi

# If following a single service, use tail -f mode
if [ "$FOLLOW" = true ] && [ ${#SERVICES[@]} -eq 1 ]; then
    show_logs "${SERVICES[0]}" true "$LINES"
    exit 0
fi

# If following multiple services, warn and show static logs
if [ "$FOLLOW" = true ] && [ ${#SERVICES[@]} -gt 1 ]; then
    warning "Follow mode (-f) only works with a single service"
    info "Showing static logs instead..."
    echo ""
fi

# Show logs for all requested services
for svc in "${SERVICES[@]}"; do
    show_logs "$svc" false "$LINES"
    echo ""
    echo -e "${GRAY}$(printf '%.0s-' {1..80})${NC}"
    echo ""
done

info "Tip: Use -f to tail logs in real-time for a single service"
info "Example: ./logs.sh gateway -f"

