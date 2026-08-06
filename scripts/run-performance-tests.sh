#!/bin/bash

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "k6 is not installed. Please install it first."
    exit 1
fi

# Run baseline test
echo "Running baseline performance test..."
k6 run __tests__/performance/baseline.test.js

# Check if test passed
if [ $? -eq 0 ]; then
    echo "Baseline test passed successfully."

    # Run more comprehensive test
    echo "Running comprehensive performance test..."
    k6 run __tests__/performance/comprehensive.test.js
else
    echo "Baseline test failed. Please check the test results."
    exit 1
fi