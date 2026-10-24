#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null; then
  echo 'Instale Python 3.11 ou superior.' >&2
  exit 1
fi
exec python3 "$SCRIPT_DIR/dev.py" "$@"
