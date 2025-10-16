#!/bin/bash

# ==============================================================================
# Start Script for Skelly Audio Tools (Full-Stack: React/Vite + FastAPI/Python)
#
# USAGE:
#   ./start.sh dev       - Development mode (both frontend & backend with auto-reload)
#   ./start.sh frontend  - Frontend only (development mode)
#   ./start.sh backend   - Backend only (development mode)
#   ./start.sh prod      - Production mode (PM2 for frontend, uvicorn for backend)
#   ./start.sh stop      - Stop all PM2 processes
#   ./start.sh logs      - Show logs
#   ./start.sh status    - Show status
#
# ENVIRONMENT VARIABLES (set in .env or override here):
#   FRONTEND_PORT=5173      - Frontend dev server port
#   BACKEND_PORT=8000       - Backend API port
#   FRONTEND_HOST=127.0.0.1 - Frontend bind address
#   BACKEND_HOST=127.0.0.1  - Backend bind address
# ==============================================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load .env if it exists
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓ Loaded configuration from .env${NC}"
else
    echo -e "${YELLOW}⚠ No .env file found. Run ./setup.sh first!${NC}"
    read -p "Continue with defaults? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Exiting. Run ./setup.sh to configure.${NC}"
        exit 1
    fi
fi

# Default configuration
APP_NAME="${APP_NAME:-skelly-audio}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BUILD_DIR="dist"

# Check for required tools
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 not found. Please install it first.${NC}"
        exit 1
    fi
}

# Check Node.js dependencies
check_node_modules() {
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
        npm install
    fi
}

# Check Python venv
check_venv() {
    if [ ! -d ".venv" ]; then
        echo -e "${YELLOW}Python virtual environment not found.${NC}"
        echo -e "${YELLOW}Creating it now...${NC}"
        uv venv
        source .venv/bin/activate
        uv pip install -r backend/requirements.txt
    fi
}

# Start frontend development server
start_frontend_dev() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          🎃  Starting Frontend (Development Mode)  🎃        ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    check_command node
    check_node_modules

    echo -e "${GREEN}Frontend will be available at:${NC}"
    echo -e "  ${CYAN}http://${FRONTEND_HOST}:${FRONTEND_PORT}${NC}\n"

    npm run dev
}

# Start backend development server
start_backend_dev() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           🎃  Starting Backend (Development Mode)  🎃        ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    check_command python3
    check_command uv
    check_venv

    echo -e "${GREEN}Activating Python virtual environment...${NC}"
    source .venv/bin/activate

    echo -e "${GREEN}Backend API will be available at:${NC}"
    echo -e "  ${CYAN}http://${BACKEND_HOST}:${BACKEND_PORT}${NC}"
    echo -e "  ${CYAN}http://${BACKEND_HOST}:${BACKEND_PORT}/docs${NC} (API docs)\n"

    cd backend
    uvicorn main:app --host ${BACKEND_HOST} --port ${BACKEND_PORT} --reload
}

# Start both frontend and backend in development mode
start_dev() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║      🎃  Starting Full Stack (Development Mode)  🎃          ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    check_command node
    check_command python3
    check_command uv
    check_node_modules
    check_venv

    echo -e "${GREEN}Starting services...${NC}\n"
    echo -e "${BLUE}Frontend:${NC} http://${FRONTEND_HOST}:${FRONTEND_PORT}"
    echo -e "${BLUE}Backend:${NC}  http://${BACKEND_HOST}:${BACKEND_PORT}"
    echo -e "${BLUE}API Docs:${NC} http://${BACKEND_HOST}:${BACKEND_PORT}/docs\n"

    # Start backend in background
    echo -e "${YELLOW}Starting backend...${NC}"
    source .venv/bin/activate
    cd backend
    uvicorn main:app --host ${BACKEND_HOST} --port ${BACKEND_PORT} --reload &
    BACKEND_PID=$!
    cd ..

    # Wait a moment for backend to start
    sleep 2

    # Start frontend (this will block)
    echo -e "${YELLOW}Starting frontend...${NC}"
    npm run dev &
    FRONTEND_PID=$!

    # Trap Ctrl+C to kill both processes
    trap "echo -e '\n${YELLOW}Shutting down...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

    # Wait for both processes
    wait
}

# Build frontend for production
build_frontend() {
    echo -e "${GREEN}Building frontend for production...${NC}"
    check_node_modules
    npm run build

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Build completed! Files in '${BUILD_DIR}/' directory.${NC}"
    else
        echo -e "${RED}✗ Build failed.${NC}"
        exit 1
    fi
}

# Start production mode with PM2
start_prod() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         🎃  Starting Production Mode (PM2)  🎃               ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}\n"

    check_command pm2
    check_venv

    # Build frontend if needed
    if [ ! -d "$BUILD_DIR" ]; then
        echo -e "${YELLOW}Production build not found. Building now...${NC}"
        build_frontend
    fi

    # Stop existing processes
    pm2 stop "${APP_NAME}-frontend" "${APP_NAME}-backend" 2>/dev/null || true
    pm2 delete "${APP_NAME}-frontend" "${APP_NAME}-backend" 2>/dev/null || true

    # Start backend with PM2
    echo -e "${GREEN}Starting backend with PM2...${NC}"
    source .venv/bin/activate
    cd backend
    pm2 start "uvicorn main:app --host ${BACKEND_HOST} --port ${BACKEND_PORT}" \
        --name "${APP_NAME}-backend" \
        --interpreter python3
    cd ..

    # Start frontend with PM2 (serve static files)
    echo -e "${GREEN}Starting frontend with PM2...${NC}"
    pm2 serve ${BUILD_DIR} ${FRONTEND_PORT} \
        --name "${APP_NAME}-frontend" \
        --spa

    pm2 save

    echo -e "\n${GREEN}✓ Production mode started!${NC}\n"
    echo -e "${BLUE}Access the application at:${NC}"
    echo -e "  ${CYAN}http://${FRONTEND_HOST}:${FRONTEND_PORT}${NC}"
    echo -e "\n${YELLOW}To make it restart on server reboot:${NC}"
    echo -e "  ${CYAN}pm2 startup${NC} (run the command it gives you)"
    echo -e "  ${CYAN}pm2 save${NC}\n"

    pm2 list
}

# Stop all PM2 processes
stop_all() {
    echo -e "${YELLOW}Stopping all PM2 processes...${NC}"
    pm2 stop "${APP_NAME}-frontend" "${APP_NAME}-backend" 2>/dev/null || true
    echo -e "${GREEN}✓ Stopped${NC}"
}

# Show logs
show_logs() {
    echo -e "${BLUE}Showing logs (Ctrl+C to exit)...${NC}\n"
    pm2 logs
}

# Show status
show_status() {
    pm2 list
}

# Main logic
if [ -z "$1" ]; then
    echo -e "${RED}Error: No command specified.${NC}"
    echo -e "Usage: $0 {dev|frontend|backend|prod|stop|logs|status}"
    exit 1
fi

case "$1" in
    dev)
        start_dev
        ;;
    frontend)
        start_frontend_dev
        ;;
    backend)
        start_backend_dev
        ;;
    prod)
        start_prod
        ;;
    build)
        build_frontend
        ;;
    stop)
        stop_all
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    *)
        echo -e "${RED}Error: Invalid command '$1'.${NC}"
        echo -e "Usage: $0 {dev|frontend|backend|prod|build|stop|logs|status}"
        exit 1
        ;;
esac
