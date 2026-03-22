#!/bin/bash
# Refresh Open Asset Pricing data
# Run this monthly to get the latest factor returns

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Activating Python environment..."
source data_pipeline/.venv/bin/activate

echo "Downloading and processing data..."
python3 data_pipeline/download_data.py "$@"

echo "Computing style factor returns..."
python3 data_pipeline/compute_styles.py

echo "Running walk-forward optimization..."
python3 data_pipeline/compute_walkforward.py

echo "Computing research analytics (decay, crises, crowding, momentum, tail risk)..."
python3 data_pipeline/compute_research.py

echo "Downloading macro data (requires FRED access)..."
python3 data_pipeline/download_macro.py || echo "  Macro download failed (FRED may be unavailable). Skipping."

echo ""
echo "Data refreshed! Start the dashboard with:"
echo "  cd dashboard && npm run dev"
