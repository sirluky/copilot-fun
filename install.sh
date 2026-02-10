#!/bin/bash

# Copilot Fun Mode Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/sirluky/copilot-fun/main/install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/sirluky/copilot-fun"
INSTALL_DIR="${COPILOT_FUN_INSTALL_DIR:-$HOME/.copilot-fun}"
BIN_DIR="${COPILOT_FUN_BIN_DIR:-$HOME/.local/bin}"

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Copilot Fun Mode Installer            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node > /dev/null 2>&1; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}  Please install Node.js 18+ from https://nodejs.org${NC}"
    exit 1
fi

# Check Node.js version  
NODE_VERSION=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ] 2>/dev/null; then
    echo -e "${RED}✗ Node.js version 18+ is required (found: $(node -v))${NC}"
    echo -e "${YELLOW}  Please upgrade Node.js from https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if npm is installed
if ! command -v npm > /dev/null 2>&1; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v) detected${NC}"

# Check if git is installed
if ! command -v git > /dev/null 2>&1; then
    echo -e "${RED}✗ git is not installed${NC}"
    echo -e "${YELLOW}  Please install git from your package manager${NC}"
    exit 1
fi
echo -e "${GREEN}✓ git detected${NC}"

# Check if GitHub Copilot CLI is installed
if ! command -v copilot > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠ GitHub Copilot CLI not detected${NC}"
    echo -e "${YELLOW}  Install it from: https://github.com/github/copilot-cli${NC}"
    echo -e "${YELLOW}  Installation will continue, but copilot-fun won't work without it${NC}"
else
    echo -e "${GREEN}✓ GitHub Copilot CLI detected${NC}"
fi

echo ""
echo -e "${BLUE}Installing to: ${INSTALL_DIR}${NC}"

# Remove existing installation
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Removing existing installation...${NC}"
    rm -rf "$INSTALL_DIR"
fi

# Clone repository
echo -e "${BLUE}Cloning repository...${NC}"
git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
cd "$INSTALL_DIR"
npm install --production

# Make index.js executable
chmod +x "$INSTALL_DIR/index.js"

# Create bin directory if it doesn't exist
mkdir -p "$BIN_DIR"

# Create symlink
echo -e "${BLUE}Creating symlink...${NC}"
ln -sf "$INSTALL_DIR/index.js" "$BIN_DIR/copilot-fun"

# Check if BIN_DIR is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo ""
    echo -e "${YELLOW}⚠ Warning: $BIN_DIR is not in your PATH${NC}"
    echo -e "${YELLOW}  Add this line to your ~/.bashrc or ~/.zshrc:${NC}"
    echo -e "${GREEN}  export PATH=\"\$PATH:$BIN_DIR\"${NC}"
    echo ""
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation Complete! 🎉              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Run with:${NC} ${GREEN}copilot-fun${NC}"
echo ""
echo -e "${BLUE}Controls:${NC}"
echo -e "  ${YELLOW}Ctrl-G${NC} - Toggle between Copilot and Games"
echo -e "  ${YELLOW}↑↓/WS/JK${NC} - Navigate game menu"
echo -e "  ${YELLOW}Enter${NC} - Launch/resume game"
echo -e "  ${YELLOW}Q${NC} - Quit game or return to Copilot"
echo ""
echo -e "${BLUE}To uninstall:${NC}"
echo -e "  rm -rf $INSTALL_DIR"
echo -e "  rm $BIN_DIR/copilot-fun"
echo ""
