#!/usr/bin/env bash
set -euo pipefail

SERVICE_ACCOUNT_PATH="/Users/qairel/Downloads/spendly-68ea0-firebase-adminsdk-fbsvc-442cd67962.json"
PROJECT_DIR="/Users/qairel/last semester/Qairel'sfyp/spendly"

node "$PROJECT_DIR/scripts/audit-attendance-shifts.js" "$SERVICE_ACCOUNT_PATH"
