#!/usr/bin/env python3
"""
Simple test failure analytics using data science techniques to identify patterns,
root causes, and suggest prioritized fixes for Playwright test failures.
No external dependencies required.
"""

import os
import re
import json
from collections import defaultdict, Counter
from datetime import datetime
import hashlib
import statistics
from typing import List, Dict, Tuple, Optional

# Configuration
TEST_RESULTS_DIR = "/home/tbaltzakis/cloudless.gr/test-results"
ANALYSIS_OUTPUT_DIR = "/home/tbaltzakis/cloudless.gr/test_analytics"

# Ensure output directory exists
os.makedirs(ANALYSIS_OUTPUT_DIR, exist_ok=True)

class TestFailureAnalyzer:
    def __init__(self):
        self.failures = []
        self.patterns = {}
        
    def extract_failure_data(self):
        """Extract failure data from error-context.md files"""
        error_files = []
        for root, dirs, files in os.walk(TEST_RESULTS_DIR):
            for file in files:
                if file == "error-context.md":
                    error_files.append(os.path.join(root, file))
        
        print(f"Found {len(error_files)} error-context.md files")
        
        for file_path in error_files:
            try:
                failure_data = self._parse_error_file(file_path)
                if failure_data:
                    self.failures.append(failure_data)
            except Exception as e:
                print(f"Error parsing {file_path}: {e}")
        
        print(f"Successfully parsed {len(self.failures)} failures")
        return self.failures
    
    def _parse_error_file(self, file_path: str) -> Optional[Dict]:
        """Parse a single error-context.md file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract test name
        name_match = re.search(r"# Test info\s*\n\s*- Name: (.+)", content)
        test_name = name_match.group(1).strip() if name_match else "Unknown"
        
        # Extract location with flexible pattern
        location_match = re.search(r"# Test info[\s\S]*?- Location:\s*(.+):(\d+):(\d+)", content)
        if location_match:
            test_file = location_match.group(1)
            test_line = int(location_match.group(2))
            test_column = int(location_match.group(3))
        else:
            test_file = "Unknown"
            test_line = 0
            test_column = 0
        
        # Extract error details
        error_match = re.search(r"# Error details\s*\n\s*```\s*\n(.+?)\s*```", content, re.DOTALL)
        error_details = error_match.group(1).strip() if error_match else "No error details"
        
        # Extract test source snippet if available
        source_match = re.search(r"# Test source\s*\n\s*```ts\s*\n(.+?)\s*```", content, re.DOTALL)
        test_source = source_match.group(1).strip() if source_match else ""
        
        # Create a fingerprint for clustering similar failures
        fingerprint = self._create_fingerprint(test_name, test_file, error_details)
        
        return {
            "file_path": file_path,
            "test_name": test_name,
            "test_file": test_file,
            "test_line": test_line,
            "test_column": test_column,
            "error_details": error_details,
            "test_source": test_source,
            "fingerprint": fingerprint,
            "timestamp": self._extract_timestamp(file_path),
            "failure_type": self._categorize_failure(error_details)
        }
    
    def _create_fingerprint(self, test_name: str, test_file: str, error_details: str) -> str:
        """Create a fingerprint for clustering similar failures"""
        # Normalize the error details for better clustering
        normalized_error = re.sub(r'\d+', 'N', error_details)  # Replace numbers with N
        normalized_error = re.sub(r'[a-f0-9]{8,}', 'HASH', normalized_error)  # Replace long hex strings
        
        # Create a combined signature
        signature = f"{test_file}:{test_name}:{normalized_error[:100]}"
        return hashlib.md5(signature.encode()).hexdigest()[:8]
    
    def _extract_timestamp(self, file_path: str) -> Optional[datetime]:
        """Extract timestamp from file path or file stats"""
        try:
            # Try to get timestamp from file modification time
            return datetime.fromtimestamp(os.path.getmtime(file_path))
        except:
            return None
    
    def _categorize_failure(self, error_details: str) -> str:
        """Categorize failure type based on error details"""
        error_lower = error_details.lower()
        
        if "expected: 400" in error_lower and "received: 401" in error_lower:
            return "AUTHENTICATION_ERROR"
        elif "timeout" in error_lower:
            return "TIMEOUT_ERROR"
        elif "enont" in error_lower or "no such file" in error_lower:
            return "FILE_NOT_FOUND"
        elif "expected.*got 0" in error_lower:
            return "ZERO_VALUE_ERROR"
        elif "tobevisible" in error_lower or "not visible" in error_lower:
            return "VISIBILITY_ERROR"
        elif "should exist" in error_lower:
            return "MISSING_FILE_ERROR"
        elif "tocontain" in error_lower or "indexof" in error_lower:
            return "CONTENT_MISSING_ERROR"
        elif "expected.*got" in error_lower:
            return "VALUE_MISMATCH_ERROR"
        else:
            return "OTHER_ERROR"
    
    def analyze_patterns(self):
        """Analyze patterns in failures using statistical techniques"""
        if not self.failures:
            print("No failures to analyze")
            return
        
        # Pattern 1: Failure frequency by test file
        file_counter = Counter([f["test_file"] for f in self.failures])
        
        # Pattern 2: Failure frequency by type
        type_counter = Counter([f["failure_type"] for f in self.failures])
        
        # Pattern 3: Failure frequency by fingerprint (clustering similar failures)
        fingerprint_counter = Counter([f["fingerprint"] for f in self.failures])
        
        # Pattern 4: Temporal analysis (if timestamps available)
        timed_failures = [f for f in self.failures if f["timestamp"] is not None]
        if len(timed_failures) >= 2:
            # Sort by timestamp
            timed_failures.sort(key=lambda x: x["timestamp"])
            # Calculate time between failures
            time_diffs = []
            for i in range(1, len(timed_failures)):
                diff = (timed_failures[i]["timestamp"] - timed_failures[i-1]["timestamp"]).total_seconds()
                time_diffs.append(diff)
            
            # Calculate average and median time between failures
            avg_time_between = sum(time_diffs) / len(time_diffs) if time_diffs else 0
            median_time_between = statistics.median(time_diffs) if time_diffs else 0
            failure_rate = len(timed_failures) / max((timed_failures[-1]["timestamp"] - timed_failures[0]["timestamp"]).total_seconds(), 1) if timed_failures else 0
        else:
            avg_time_between = 0
            median_time_between = 0
            failure_rate = 0
        
        # Pattern 5: Correlate failure types with test files
        failure_matrix = defaultdict(Counter)
        for f in self.failures:
            failure_matrix[f["test_file"]][f["failure_type"]] += 1
        
        self.patterns = {
            "failure_by_file": dict(file_counter.most_common()),
            "failure_by_type": dict(type_counter.most_common()),
            "failure_clusters": dict(fingerprint_counter.most_common()),
            "temporal_analysis": {
                "average_time_between_failures_seconds": avg_time_between,
                "median_time_between_failures_seconds": median_time_between,
                "failure_rate_per_second": failure_rate,
                "has_timestamps": len(timed_failures) > 0,
                "time_range_hours": (max([f["timestamp"] for f in timed_failures]) - min([f["timestamp"] for f in timed_failures])).total_seconds() / 3600 if len(timed_failures) >= 2 else 0
            },
            "failure_matrix": {k: dict(v) for k, v in failure_matrix.items()},
            "total_failures": len(self.failures)
        }
        
        return self.patterns
    
    def generate_insights(self):
        """Generate actionable insights from the analysis"""
        insights = []
        
        if not self.patterns:
            self.analyze_patterns()
        
        # Insight 1: Most problematic test files
        top_files = list(self.patterns["failure_by_file"].items())[:3]
        if top_files:
            insights.append({
                "type": "PRIORITY_FILES",
                "message": f"Top {len(top_files)} test files with most failures: {', '.join([f'{f} ({c})' for f, c in top_files])}",
                "recommendation": "Focus on stabilizing these test files first as they contribute most to test instability."
            })
        
        # Insight 2: Most common failure types
        top_types = list(self.patterns["failure_by_type"].items())[:3]
        if top_types:
            insights.append({
                "type": "PRIORITY_FAILURE_TYPES",
                "message": f"Top {len(top_types)} failure types: {', '.join([f'{t} ({c})' for t, c in top_types])}",
                "recommendation": "Address these failure types systematically as they represent systemic issues."
            })
        
        # Insight 3: Specific actionable recommendations based on failure types
        auth_errors = self.patterns["failure_by_type"].get("AUTHENTICATION_ERROR", 0)
        if auth_errors > 0:
            insights.append({
                "type": "SPECIFIC_FIX",
                "message": f"Found {auth_errors} authentication-related failures (expected 400, got 401)",
                "recommendation": "Check API authentication middleware - likely returning 401 instead of 400 for invalid requests. Fix the auth logic to return appropriate status codes."
            })
        
        timeout_errors = self.patterns["failure_by_type"].get("TIMEOUT_ERROR", 0)
        if timeout_errors > 0:
            insights.append({
                "type": "SPECIFIC_FIX",
                "message": f"Found {timeout_errors} timeout-related failures",
                "recommendation": "Increase timeouts for slow operations, optimize slow tests, or investigate performance bottlenecks."
            })
        
        file_errors = self.patterns["failure_by_type"].get("FILE_NOT_FOUND", 0) + \
                     self.patterns["failure_by_type"].get("MISSING_FILE_ERROR", 0)
        if file_errors > 0:
            insights.append({
                "type": "SPECIFIC_FIX",
                "message": f"Found {file_errors} file-related failures",
                "recommendation": "Check if referenced files (like GitHub workflows) exist in the repository. Ensure test setup creates required files or adjust test expectations."
            })
        
        # Insight 4: Clustering insight - suggest parameterized tests
        clusters = self.patterns["failure_clusters"]
        if clusters:
            largest_cluster_count = list(clusters.values())[0] if clusters else 0
            if largest_cluster_count > 1:
                insights.append({
                    "type": "CLUSTERING_INSIGHT",
                    "message": f"Found {len(clusters)} distinct failure clusters, largest cluster has {largest_cluster_count} similar failures",
                    "recommendation": "Look for patterns in the largest clusters - these may be good candidates for parameterized tests or shared fix approaches."
                })
        
        # Insight 5: Temporal insights
        temporal = self.patterns["temporal_analysis"]
        if temporal["has_timestamps"] and temporal["average_time_between_failures_seconds"] > 0:
            insights.append({
                "type": "TEMPORAL_INSIGHT",
                "message": f"Average time between failures: {temporal['average_time_between_failures_seconds']/3600:.1f} hours",
                "recommendation": "If failures are bursts, look for external triggers (deployments, cron jobs). If steady, look for chronic issues."
            })
        
        return insights
    
    def generate_report(self):
        """Generate a comprehensive analytics report"""
        self.extract_failure_data()
        self.analyze_patterns()
        insights = self.generate_insights()
        
        report = {
            "analysis_timestamp": datetime.now().isoformat(),
            "summary": {
                "total_failures_analyzed": len(self.failures),
                "unique_test_files": len(set([f["test_file"] for f in self.failures])),
                "unique_failure_types": len(set([f["failure_type"] for f in self.failures]))
            },
            "patterns": self.patterns,
            "insights": insights,
            "recommended_actions": self._generate_priority_actions(insights)
        }
        
        # Save report
        report_file = os.path.join(ANALYSIS_OUTPUT_DIR, f"test_failure_analytics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        # Also save a human-readable summary
        summary_file = os.path.join(ANALYSIS_OUTPUT_DIR, f"test_failure_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
        with open(summary_file, 'w') as f:
            f.write(self._generate_human_readable_report(report))
        
        print(f"Analytics report saved to: {report_file}")
        print(f"Human-readable summary saved to: {summary_file}")
        
        return report
    
    def _generate_priority_actions(self, insights: List[Dict]) -> List[Dict]:
        """Generate prioritized actions based on insights"""
        actions = []
        
        # Priority 1: Fix systemic issues (authentication, timeouts)
        for insight in insights:
            if insight["type"] in ["SPECIFIC_FIX"] and insight["message"].startswith("Found"):
                actions.append({
                    "priority": "HIGH",
                    "action": insight["recommendation"],
                    "rationale": insight["message"],
                    "estimated_impact": "HIGH"
                })
        
        # Priority 2: Focus on problematic files
        for insight in insights:
            if insight["type"] == "PRIORITY_FILES":
                actions.append({
                    "priority": "HIGH",
                    "action": f"Focus test stabilization efforts on: {insight['message'].split(': ')[1]}",
                    "rationale": insight["message"],
                    "estimated_impact": "HIGH"
                })
        
        # Priority 3: Address common failure types
        for insight in insights:
            if insight["type"] == "PRIORITY_FAILURE_TYPES":
                actions.append({
                    "priority": "MEDIUM",
                    "action": f"Address these failure types: {insight['message'].split(': ')[1]}",
                    "rationale": insight["message"],
                    "estimated_impact": "MEDIUM"
                })
        
        # Sort by priority (HIGH first)
        priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        actions.sort(key=lambda x: priority_order[x["priority"]])
        
        return actions
    
    def _generate_human_readable_report(self, report: Dict) -> str:
        """Generate a human-readable summary report"""
        lines = [
            "=" * 60,
            "PLAYWRIGHT TEST FAILURE ANALYTICS REPORT",
            "=" * 60,
            f"Generated: {report['analysis_timestamp']}",
            "",
            "SUMMARY",
            "-" * 20,
            f"Total failures analyzed: {report['summary']['total_failures_analyzed']}",
            f"Unique test files with failures: {report['summary']['unique_test_files']}",
            f"Unique failure types: {report['summary']['unique_failure_types']}",
            "",
            "TOP FAILURE PATTERNS BY TEST FILE",
            "-" * 40,
        ]
        
        for file, count in list(report['patterns']['failure_by_file'].items())[:10]:
            lines.append(f"{file}: {count} failures")
        
        lines.extend([
            "",
            "TOP FAILURE TYPES",
            "-" * 20,
        ])
        
        for failure_type, count in list(report['patterns']['failure_by_type'].items())[:10]:
            lines.append(f"{failure_type}: {count} failures")
        
        lines.extend([
            "",
            "ACTIONABLE INSIGHTS",
            "-" * 20,
        ])
        
        for insight in report['insights']:
            lines.append(f"• [{insight['type']}] {insight['message']}")
            lines.append(f"  Recommendation: {insight['recommendation']}")
            lines.append("")
        
        lines.extend([
            "",
            "PRIORITY ACTIONS",
            "-" * 18,
        ])
        
        for action in report['recommended_actions']:
            lines.append(f"[{action['priority']}] {action['action']}")
            lines.append(f"  Rationale: {action['rationale']}")
            lines.append(f"  Impact: {action['estimated_impact']}")
            lines.append("")
        
        return "\n".join(lines)

def main():
    """Main function to run the test failure analytics"""
    print("Starting Playwright Test Failure Analytics...")
    print("=" * 50)
    
    analyzer = TestFailureAnalyzer()
    report = analyzer.generate_report()
    
    print("\n" + "=" * 50)
    print("ANALYSIS COMPLETE")
    print("=" * 50)
    print(f"Analyzed {report['summary']['total_failures_analyzed']} test failures")
    print(f"Found {report['summary']['unique_test_files']} unique test files with failures")
    print(f"Identified {report['summary']['unique_failure_types']} unique failure types")
    print()
    print("Top 3 Recommendations:")
    for i, action in enumerate(report['recommended_actions'][:3], 1):
        print(f"{i}. [{action['priority']}] {action['action']}")
    print()
    print(f"Detailed reports saved to: {ANALYSIS_OUTPUT_DIR}")
    
    return report

if __name__ == "__main__":
    main()