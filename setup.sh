#!/bin/bash

# ==============================================================================
# Setup Wizard for Skelly Audio Tools
#
# This interactive wizard will:
# 1. Detect your environment
# 2. Ask about your deployment scenario
# 3. Generate the appropriate .env file
# 4. Set up Python virtual environment
# 5. Install dependencies
# ==============================================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║           🎃  SKELLY AUDIO TOOLS - SETUP WIZARD  🎃           ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file already exists!${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Setup cancelled. Existing .env file preserved.${NC}"
        exit 0
    fi
    mv .env .env.backup
    echo -e "${GREEN}Backed up existing .env to .env.backup${NC}\n"
fi

# Detect OS
OS_TYPE=$(uname -s)
echo -e "${BLUE}Detected OS:${NC} $OS_TYPE\n"

# Check for required tools
echo -e "${BLUE}Checking dependencies...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

MISSING_DEPS=0

if ! check_command node; then
    echo -e "${RED}  Please install Node.js 18+ from https://nodejs.org/${NC}"
    MISSING_DEPS=1
fi

if ! check_command npm; then
    echo -e "${RED}  npm should come with Node.js${NC}"
    MISSING_DEPS=1
fi

if ! check_command python3; then
    echo -e "${RED}  Please install Python 3.13+ from https://www.python.org/${NC}"
    MISSING_DEPS=1
fi

if ! check_command uv; then
    echo -e "${YELLOW}  uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh${NC}"
    MISSING_DEPS=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "\n${RED}Missing required dependencies. Please install them and run setup again.${NC}"
    exit 1
fi

echo -e "\n${GREEN}All dependencies found!${NC}\n"

# Deployment scenario
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. Select your deployment scenario:${NC}\n"
echo "  1) Local development (localhost only)"
echo "  2) Local network (accessible to other devices on LAN)"
echo "  3) Separate backend/frontend servers (same LAN)"
echo "  4) Production deployment (public server)"
echo ""
read -p "Enter choice [1-4]: " DEPLOYMENT_CHOICE

case $DEPLOYMENT_CHOICE in
    1)
        DEPLOYMENT_MODE="localhost"
        FRONTEND_HOST="127.0.0.1"
        BACKEND_HOST="127.0.0.1"
        BACKEND_URL="http://127.0.0.1:8000"
        ;;
    2)
        DEPLOYMENT_MODE="lan"
        FRONTEND_HOST="0.0.0.0"
        BACKEND_HOST="0.0.0.0"
        # Get local IP
        if [[ "$OS_TYPE" == "Darwin" ]]; then
            LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "0.0.0.0")
        else
            LOCAL_IP=$(hostname -I | awk '{print $1}' || echo "0.0.0.0")
        fi
        echo -e "\n${YELLOW}Detected local IP: $LOCAL_IP${NC}"
        read -p "Is this correct? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            read -p "Enter your local IP address: " LOCAL_IP
        fi
        BACKEND_URL="http://${LOCAL_IP}:8000"
        ;;
    3)
        DEPLOYMENT_MODE="split"
        read -p "Enter frontend host IP (default: 0.0.0.0): " FRONTEND_HOST
        FRONTEND_HOST=${FRONTEND_HOST:-0.0.0.0}
        read -p "Enter backend server IP: " BACKEND_IP
        BACKEND_HOST="0.0.0.0"
        BACKEND_URL="http://${BACKEND_IP}:8000"
        ;;
    4)
        DEPLOYMENT_MODE="production"
        read -p "Enter frontend domain (e.g., skelly.example.com): " FRONTEND_DOMAIN
        read -p "Enter backend domain (e.g., api.skelly.example.com): " BACKEND_DOMAIN
        read -p "Use HTTPS? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            BACKEND_URL="http://${BACKEND_DOMAIN}"
        else
            BACKEND_URL="https://${BACKEND_DOMAIN}"
        fi
        FRONTEND_HOST="0.0.0.0"
        BACKEND_HOST="0.0.0.0"
        ;;
    *)
        echo -e "${RED}Invalid choice. Defaulting to localhost.${NC}"
        DEPLOYMENT_MODE="localhost"
        FRONTEND_HOST="127.0.0.1"
        BACKEND_HOST="127.0.0.1"
        BACKEND_URL="http://127.0.0.1:8000"
        ;;
esac

# Port configuration
echo -e "\n${BLUE}2. Port Configuration:${NC}\n"
read -p "Frontend port (default: 5173): " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-5173}

read -p "Backend port (default: 8000): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-8000}

# Update backend URL with custom port if not default
if [ "$BACKEND_PORT" != "8000" ]; then
    BACKEND_URL="${BACKEND_URL%:*}:${BACKEND_PORT}"
fi

# Vocal separator model
echo -e "\n${BLUE}3. Vocal Separation Model:${NC}\n"
echo "The vocal separation model files should be in vocal_model/"
echo "Required files:"
echo "  - model_vocals_tommy.safetensors (692 MB)"
echo "  - config_vocals_tommy.yaml"
echo ""

if [ -f "vocal_model/model_vocals_tommy.safetensors" ]; then
    echo -e "${GREEN}✓ Model file found${NC}"
else
    echo -e "${RED}✗ Model file not found${NC}"
    echo -e "${YELLOW}Download from: https://huggingface.co/Aname-Tommy/Mel_Band_Roformer_Full_Scratch${NC}"
fi

if [ -f "vocal_model/config_vocals_tommy.yaml" ]; then
    echo -e "${GREEN}✓ Config file found${NC}"
else
    echo -e "${RED}✗ Config file not found${NC}"
fi

# Generate .env file
echo -e "\n${BLUE}4. Generating configuration...${NC}\n"

cat > .env << EOF
# Skelly Audio Tools Configuration
# Generated by setup.sh on $(date)

# Deployment Mode: $DEPLOYMENT_MODE
VITE_BACKEND_URL=$BACKEND_URL/get-audio-url

# Frontend Configuration
FRONTEND_HOST=$FRONTEND_HOST
FRONTEND_PORT=$FRONTEND_PORT

# Backend Configuration
BACKEND_HOST=$BACKEND_HOST
BACKEND_PORT=$BACKEND_PORT

# Python/uv configuration (optional - uncomment if needed)
# QUANTIZED=0  # Set to 1 for CPU-optimized model (faster but lower quality)
EOF

echo -e "${GREEN}✓ .env file created${NC}"

# Summary
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Configuration Summary:${NC}\n"
echo -e "Deployment Mode:  ${YELLOW}$DEPLOYMENT_MODE${NC}"
echo -e "Frontend URL:     ${YELLOW}http://${FRONTEND_HOST}:${FRONTEND_PORT}${NC}"
echo -e "Backend URL:      ${YELLOW}$BACKEND_URL${NC}"
echo ""

# Install dependencies
echo -e "${BLUE}5. Installing dependencies...${NC}\n"

read -p "Install Node.js dependencies? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Running npm install...${NC}"
    npm install
    echo -e "${GREEN}✓ Node.js dependencies installed${NC}\n"
fi

read -p "Set up Python virtual environment? (Y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}Creating virtual environment with uv...${NC}"
    uv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"

    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    source .venv/bin/activate
    uv pip install -r backend/requirements.txt
    echo -e "${GREEN}✓ Python dependencies installed${NC}\n"
fi

# Final instructions
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup Complete! 🎃${NC}\n"
echo -e "${BLUE}To start the application:${NC}"
echo -e "  ${YELLOW}./start.sh dev${NC}     - Development mode (auto-reload)"
echo -e "  ${YELLOW}./start.sh prod${NC}    - Production mode (optimized)"
echo -e "  ${YELLOW}./start.sh backend${NC} - Backend only"
echo -e "  ${YELLOW}./start.sh frontend${NC}- Frontend only"
echo ""
echo -e "${BLUE}To reconfigure:${NC}"
echo -e "  ${YELLOW}./setup.sh${NC}         - Run this wizard again"
echo ""
echo -e "${BLUE}Access the application at:${NC}"

if [ "$DEPLOYMENT_MODE" = "localhost" ]; then
    echo -e "  ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
elif [ "$DEPLOYMENT_MODE" = "lan" ]; then
    echo -e "  ${CYAN}http://$LOCAL_IP:$FRONTEND_PORT${NC}"
elif [ "$DEPLOYMENT_MODE" = "split" ]; then
    echo -e "  ${CYAN}Frontend: http://$FRONTEND_HOST:$FRONTEND_PORT${NC}"
    echo -e "  ${CYAN}Backend:  $BACKEND_URL${NC}"
else
    echo -e "  ${CYAN}$FRONTEND_DOMAIN${NC}"
fi

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
