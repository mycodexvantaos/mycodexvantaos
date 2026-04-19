#!/usr/bin/env python3
"""
Metrics Publisher Script

This script publishes orchestration metrics to:
- Monitoring systems (Prometheus, CloudWatch, etc.)
- Logging systems (ELK, Splunk, etc.)
- Custom dashboards
"""

import json
import argparse
import os
from datetime import datetime
from typing import Dict, List


class MetricsPublisher:
    """Publishes orchestration metrics."""
    
    def __init__(self, orchestration_id: str):
        """Initialize metrics publisher."""
        self.orchestration_id = orchestration_id
        self.metrics = {
            'orchestration_id': orchestration_id,
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': {}
        }
    
    def calculate_metrics(self, state: Dict):
        """Calculate orchestration metrics."""
        repos = state.get('repositories', {})
        
        total = len(repos)
        completed = sum(1 for r in repos.values() if r.get('status') == 'completed')
        failed = sum(1 for r in repos.values() if r.get('status') == 'failed')
        
        self.metrics['metrics'] = {
            'total_repositories': total,
            'completed_repositories': completed,
            'failed_repositories': failed,
            'success_rate': (completed / total * 100) if total > 0 else 0,
            'failure_rate': (failed / total * 100) if total > 0 else 0,
        }
        
        if 'created_at' in state and 'completed_at' in state:
            start = datetime.fromisoformat(state['created_at'])
            end = datetime.fromisoformat(state['completed_at'])
            duration = (end - start).total_seconds()
            self.metrics['metrics']['duration_seconds'] = duration
    
    def publish_to_prometheus(self):
        """Publish metrics to Prometheus."""
        print("Publishing metrics to Prometheus...")
        
        metrics = self.metrics['metrics']
        prometheus_metrics = []
        
        prometheus_metrics.append(f'orchestration_total_repositories{{id="{self.orchestration_id}"}} {metrics["total_repositories"]}')
        prometheus_metrics.append(f'orchestration_completed_repositories{{id="{self.orchestration_id}"}} {metrics["completed_repositories"]}')
        prometheus_metrics.append(f'orchestration_failed_repositories{{id="{self.orchestration_id}"}} {metrics["failed_repositories"]}')
        prometheus_metrics.append(f'orchestration_success_rate{{id="{self.orchestration_id}"}} {metrics["success_rate"]}')
        prometheus_metrics.append(f'orchestration_failure_rate{{id="{self.orchestration_id}"}} {metrics["failure_rate"]}')
        
        print("\nPrometheus metrics:")
        for metric in prometheus_metrics:
            print(f"  {metric}")
    
    def publish_to_cloudwatch(self):
        """Publish metrics to AWS CloudWatch."""
        print("\nPublishing metrics to CloudWatch...")
        print("  [Simulated] Metrics would be sent to CloudWatch")
    
    def publish_to_elk(self):
        """Publish metrics to ELK stack."""
        print("\nPublishing metrics to ELK stack...")
        print("  [Simulated] Metrics would be sent to ELK")
    
    def publish_all(self):
        """Publish to all configured backends."""
        self.publish_to_prometheus()
        self.publish_to_cloudwatch()
        self.publish_to_elk()
        
        os.makedirs('metrics', exist_ok=True)
        metrics_file = f'metrics/{self.orchestration_id}.json'
        with open(metrics_file, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        
        print(f"\nMetrics saved to: {metrics_file}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Publish orchestration metrics')
    parser.add_argument('--orchestration-id', required=True, help='Orchestration identifier')
    parser.add_argument('--state-file', help='State file path')
    
    args = parser.parse_args()
    
    publisher = MetricsPublisher(args.orchestration_id)
    
    state = {}
    if args.state_file and os.path.exists(args.state_file):
        with open(args.state_file, 'r') as f:
            state = json.load(f)
    
    if state:
        publisher.calculate_metrics(state)
        publisher.publish_all()
    else:
        print("No state data provided, skipping metrics publication")


if __name__ == '__main__':
    main()