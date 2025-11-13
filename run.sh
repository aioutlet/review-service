#!/bin/bash
# Run Review Service with Dapr sidecar
# Usage: ./run.sh

echo "Starting Review Service with Dapr..."
echo "Service will be available at: http://localhost:1010"
echo "Dapr HTTP endpoint: http://localhost:3510"
echo "Dapr gRPC endpoint: localhost:50010"
echo ""

dapr run \
  --app-id review-service \
  --app-port 1010 \
  --dapr-http-port 3510 \
  --dapr-grpc-port 50010 \
  --resources-path .dapr/components \
  --config .dapr/config.yaml \
  --log-level warn \
  -- nodemon src/server.js
