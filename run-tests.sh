#!/bin/bash

# Script para executar testes Clarinet do Bitcoin Yield Copilot
# Usage: ./run-tests.sh [command]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}"
    echo "============================================"
    echo "  Bitcoin Yield Copilot - Test Runner"
    echo "============================================"
    echo -e "${NC}"
}

print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo "--------------------------------------------"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if Clarinet is installed
check_clarinet() {
    if ! command -v clarinet &> /dev/null; then
        print_error "Clarinet não encontrado. Instale em: https://github.com/hirosystems/clarinet"
        exit 1
    fi
    print_success "Clarinet instalado"
}

# Run syntax check
check_syntax() {
    print_section "Verificando sintaxe dos contratos..."
    clarinet check
    print_success "Sintaxe OK"
}

# Run all tests
run_all_tests() {
    print_section "Executando todos os testes..."
    clarinet test
    print_success "Testes completos"
}

# Run specific tests
run_alex_tests() {
    print_section "Executando testes do ALEX Adapter..."
    clarinet test --filter alex-adapter
    print_success "Testes ALEX completos"
}

# Run with coverage
run_coverage() {
    print_section "Executando testes com cobertura..."
    clarinet test --coverage
    print_success "Cobertura calculada"
}

# Start console
start_console() {
    print_section "Iniciando console Clarinet..."
    echo "Use 'Ctrl+C' para sair"
    clarinet console
}

# Deploy to testnet (requires additional setup)
deploy_testnet() {
    print_section "Preparando deploy para testnet..."
    print_error "Deploy para testnet requer configuração adicional de wallet"
    echo "Configure sua private key em: ~/.clarinet/settings/Testnet.toml"
}

# Main
print_header
check_clarinet

case "${1:-all}" in
    check)
        check_syntax
        ;;
    all)
        check_syntax
        run_all_tests
        ;;
    alex)
        check_syntax
        run_alex_tests
        ;;
    coverage)
        check_syntax
        run_coverage
        ;;
    console)
        start_console
        ;;
    deploy)
        deploy_testnet
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  check      - Verificar sintaxe dos contratos"
        echo "  all        - Executar todos os testes (padrão)"
        echo "  alex       - Executar testes do ALEX Adapter"
        echo "  coverage   - Executar testes com relatório de cobertura"
        echo "  console    - Iniciar console interativo"
        echo "  deploy     - Preparar deploy para testnet"
        echo ""
        exit 1
        ;;
esac

print_success "Concluído!"
