#!/bin/bash
# Windsor.ai REST API Helper Script
# Usage: ./windsor-api.sh <command> [args...]
#
# Commands:
#   accounts [datasource]     - List connected accounts (default: all)
#   fields <connector>        - List available fields for a connector
#   options <connector>       - List connector options
#   query <connector> <fields> [date_preset] - Query data
#   custom-fields             - List custom fields
#   connectors                - List all available connectors
#
# Requires: WINDSOR_API_KEY environment variable
# Get your API key from: https://onboard.windsor.ai/app/data-preview

set -euo pipefail

API_BASE="https://connectors.windsor.ai"
ONBOARD_BASE="https://onboard.windsor.ai/api"

if [ -z "${WINDSOR_API_KEY:-}" ]; then
    echo "Error: WINDSOR_API_KEY environment variable not set"
    echo "Get your API key from: https://onboard.windsor.ai/app/data-preview"
    exit 1
fi

command="${1:-help}"
shift || true

case "$command" in
    accounts)
        datasource="${1:-all}"
        curl -s "${ONBOARD_BASE}/common/ds-accounts?datasource=${datasource}&api_key=${WINDSOR_API_KEY}" | python3 -m json.tool 2>/dev/null || cat
        ;;
    fields)
        connector="${1:?Usage: windsor-api.sh fields <connector>}"
        curl -s "${API_BASE}/${connector}/fields?api_key=${WINDSOR_API_KEY}" | python3 -m json.tool 2>/dev/null || cat
        ;;
    options)
        connector="${1:?Usage: windsor-api.sh options <connector>}"
        curl -s "${API_BASE}/${connector}/options?api_key=${WINDSOR_API_KEY}" | python3 -m json.tool 2>/dev/null || cat
        ;;
    query)
        connector="${1:?Usage: windsor-api.sh query <connector> <fields> [date_preset]}"
        fields="${2:?Usage: windsor-api.sh query <connector> <fields> [date_preset]}"
        date_preset="${3:-last_7d}"
        curl -s "${API_BASE}/${connector}?api_key=${WINDSOR_API_KEY}&fields=${fields}&date_preset=${date_preset}&_renderer=json" | python3 -m json.tool 2>/dev/null || cat
        ;;
    custom-fields)
        curl -s "${ONBOARD_BASE}/custom-fields?api_key=${WINDSOR_API_KEY}" | python3 -m json.tool 2>/dev/null || cat
        ;;
    connectors)
        curl -s "${API_BASE}/list_connectors" | python3 -m json.tool 2>/dev/null || cat
        ;;
    help|*)
        echo "Windsor.ai REST API Helper"
        echo ""
        echo "Usage: ./windsor-api.sh <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  accounts [datasource]            List connected accounts (default: all)"
        echo "  fields <connector>               List available fields"
        echo "  options <connector>               List connector options"
        echo "  query <connector> <fields> [preset] Query data (default preset: last_7d)"
        echo "  custom-fields                    List custom fields"
        echo "  connectors                       List all available connectors"
        echo ""
        echo "Examples:"
        echo "  ./windsor-api.sh accounts facebook"
        echo "  ./windsor-api.sh fields googleanalytics4"
        echo "  ./windsor-api.sh query linkedin 'campaign,spend,clicks,date' last_30d"
        echo ""
        echo "Requires: WINDSOR_API_KEY environment variable"
        ;;
esac
