#!/bin/bash
# Network Information Script for Development Stack
# Helps find IP addresses and test connectivity

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}🌐 Network Information for Development Stack${NC}"
echo "=================================================="

# Get primary network interface and IP
PRIMARY_IP=$(hostname -I | awk '{print $1}')
HOSTNAME=$(hostname)

echo -e "${GREEN}📍 Your Development Machine:${NC}"
echo "   Hostname: $HOSTNAME"
echo "   Primary IP: $PRIMARY_IP"
echo ""

# Show all network interfaces
echo -e "${GREEN}🔌 All Network Interfaces:${NC}"
ip -4 addr show | grep -E '^[0-9]+:|inet ' | sed 's/^[0-9]*: //' | while read line; do
    if [[ $line == *"inet "* ]]; then
        echo "   $line"
    else
        echo -e "${YELLOW}$line${NC}"
    fi
done
echo ""

# Show Docker network info if Docker is running
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo -e "${GREEN}🐳 Docker Networks:${NC}"
    docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}" 2>/dev/null || echo "   Docker not running or no networks found"
    echo ""
fi

# Show development stack URLs
echo -e "${GREEN}🚀 Development Stack URLs:${NC}"
echo "   Main Application:"
echo "     http://$PRIMARY_IP:3000"
echo "     http://localhost:3000 (local only)"
echo ""
echo "   Development Tools:"
echo "     Redis Commander: http://$PRIMARY_IP:8081"
echo "     Mailhog: http://$PRIMARY_IP:8025"
echo ""
echo "   Database Connections:"
echo "     PostgreSQL: $PRIMARY_IP:5432"
echo "     Redis: $PRIMARY_IP:6379"
echo ""

# Test if ports are open (if development stack is running)
echo -e "${GREEN}🔍 Port Status Check:${NC}"
PORTS=(3000 5432 6379 8081 8025)
for port in "${PORTS[@]}"; do
    if nc -z localhost $port 2>/dev/null; then
        echo -e "   Port $port: ${GREEN}✅ Open${NC}"
    else
        echo -e "   Port $port: ${RED}❌ Closed${NC}"
    fi
done
echo ""

# Show firewall status
echo -e "${GREEN}🛡️ Firewall Information:${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1)
    echo "   UFW Status: $UFW_STATUS"
elif command -v firewall-cmd &> /dev/null; then
    FIREWALLD_STATUS=$(sudo firewall-cmd --state 2>/dev/null || echo "not running")
    echo "   Firewalld Status: $FIREWALLD_STATUS"
else
    echo "   No common firewall tools detected"
fi
echo ""

# Show QR code for mobile access (if qrencode is available)
if command -v qrencode &> /dev/null; then
    echo -e "${GREEN}📱 QR Code for Mobile Access:${NC}"
    echo "http://$PRIMARY_IP:3000" | qrencode -t UTF8
    echo ""
fi

echo -e "${CYAN}💡 Tips:${NC}"
echo "   • Share http://$PRIMARY_IP:3000 with team members"
echo "   • Test on mobile devices using the same WiFi network"
echo "   • If you can't access from other devices, check your firewall"
echo "   • Run './scripts/docker/dev-docker.sh start' to start the development stack"
echo ""