#!/bin/bash

# Run baseline test
echo "Running baseline performance test..."
docker run -v "$(pwd):/k6" grafana/k6 run /k6/__tests__/performance/baseline.test.js

# Check if test passed
if [ $? -eq 0 ]; then
    echo "Baseline test passed successfully."

    # Run comprehensive test
    echo "Running comprehensive performance test..."
    docker run -v "$(pwd):/k6" grafana/k6 run /k6/__tests__/performance/comprehensive.test.js
else
    echo "Baseline test failed. Please check the test results."
    exit 1
fi