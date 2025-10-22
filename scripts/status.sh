#!/usr/bin/env bash
# Check status of Pablos Network services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$ROOT_DIR/.pids"

# Color output functions
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}$1${NC}"
}

info() {
    echo -e "${CYAN}$1${NC}"
}

warning() {
    echo -e "${YELLOW}$1${NC}"
}

error() {
    echo -e "${RED}$1${NC}"
}

# Get service status
get_service_status() {
    local service_name=$1
    local port=${2:-0}
    local pid_file="$PIDS_DIR/$service_name.pid"
    
    if [ ! -f "$pid_file" ]; then
        echo "STOPPED|-|-|-|-"
        return
    fi
    
    local pid=$(cat "$pid_file")
    
    if ! ps -p "$pid" > /dev/null 2>&1; then
        # Stale PID file
        rm -f "$pid_file"
        echo "STOPPED|-|-|-|-"
        return
    fi
    
    # Get memory usage (in MB)
    local memory=""
    if command -v ps &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            memory=$(ps -p "$pid" -o rss= | awk '{printf "%.2f MB", $1/1024}')
        else
            # Linux
            memory=$(ps -p "$pid" -o rss= | awk '{printf "%.2f MB", $1/1024}')
        fi
    else
        memory="-"
    fi
    
    # Get uptime
    local uptime=""
    if command -v ps &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            uptime=$(ps -p "$pid" -o etime= | xargs)
        else
            # Linux
            uptime=$(ps -p "$pid" -o etime= | xargs)
        fi
    else
        uptime="-"
    fi
    
    local port_str="-"
    if [ "$port" -gt 0 ]; then
        port_str="$port"
    fi
    
    echo "RUNNING|$pid|$port_str|$memory|$uptime"
}

# Load environment variables from .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Get ports from environment or use defaults
GATEWAY_PORT=${GATEWAY_PORT:-4000}
AI_PORT=${AI_SERVICE_PORT:-4001}
WEBTUI_PORT=${WEBTUI_PORT:-3000}

info "=== Pablos Network Service Status ==="
echo ""

# Display table header
printf "${WHITE}%-25s %-10s %-10s %-10s %-15s %-15s${NC}\n" "SERVICE" "STATUS" "PID" "PORT" "MEMORY" "UPTIME"
echo -e "${GRAY}$(printf '%.0s-' {1..95})${NC}"

# Get status for all services
declare -A services=(
    ["gateway"]="$GATEWAY_PORT"
    ["ai"]="$AI_PORT"
    ["worker-dast"]="0"
    ["worker-dns"]="0"
    ["worker-origin"]="0"
    ["worker-osint"]="0"
    ["worker-webdiscovery"]="0"
    ["webtui"]="$WEBTUI_PORT"
)

running_count=0
total_count=0

for service_name in gateway ai worker-dast worker-dns worker-origin worker-osint worker-webdiscovery webtui; do
    port=${services[$service_name]}
    status_line=$(get_service_status "$service_name" "$port")
    
    IFS='|' read -r status pid port_str memory uptime <<< "$status_line"
    
    total_count=$((total_count + 1))
    
    case "$status" in
        "RUNNING")
            running_count=$((running_count + 1))
            printf "${GREEN}%-25s %-10s %-10s %-10s %-15s %-15s${NC}\n" "$service_name" "$status" "$pid" "$port_str" "$memory" "$uptime"
            ;;
        "STOPPED")
            printf "${YELLOW}%-25s %-10s %-10s %-10s %-15s %-15s${NC}\n" "$service_name" "$status" "$pid" "$port_str" "$memory" "$uptime"
            ;;
        *)
            printf "${RED}%-25s %-10s %-10s %-10s %-15s %-15s${NC}\n" "$service_name" "$status" "$pid" "$port_str" "$memory" "$uptime"
            ;;
    esac
done

echo ""

# Summary
if [ $running_count -eq $total_count ]; then
    success "All services are running ($running_count/$total_count)"
elif [ $running_count -eq 0 ]; then
    warning "All services are stopped (0/$total_count)"
else
    warning "Some services are not running ($running_count/$total_count)"
fi

echo ""
info "External Dependencies:"
info "  MongoDB: ${MONGODB_URI:-mongodb://localhost:27017}"
info "  Redis:   ${REDIS_URL:-redis://localhost:6379}"
echo ""
info "Service URLs:"
info "  Gateway:  http://localhost:$GATEWAY_PORT"
info "  AI:       http://localhost:$AI_PORT"
info "  WebTUI:   http://localhost:$WEBTUI_PORT"

