#!/usr/bin/env python3
"""
MyCodexVantaOS Observability Metrics Publisher

This script publishes execution metrics to:
- observability-prometheus
- observability-cloudwatch
- observability-elk
"""

import json
import argparse
import os
from datetime import datetime
from typing import Dict, List

class MetricsPublisher:
    """Publishes platform execution metrics to observability providers."""
    
    def __init__(self, execution_id: str):
        """Initialize metrics publisher."""
        self.execution_id = execution_id
        self.metrics = {
            'execution_id': execution_id,
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': {}
        }
    
    def calculate_metrics(self, state: Dict):
        """Calculate execution metrics."""
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
        """Publish metrics to observability-prometheus provider."""
        print("[observability-prometheus] Publishing metrics...")
        
        metrics = self.metrics['metrics']
        prometheus_metrics = []
        
        prometheus_metrics.append(f'mycodexvantaos_execution_total{{id="{self.execution_id}"}} {metrics["total_repositories"]}')
        prometheus_metrics.append(f'mycodexvantaos_execution_completed{{id="{self.execution_id}"}} {metrics["completed_repositories"]}')
        prometheus_metrics.append(f'mycodexvantaos_execution_failed{{id="{self.execution_id}"}} {metrics["failed_repositories"]}')
        
        for metric in prometheus_metrics:
            print(f"  {metric}")
    
    def publish_to_cloudwatch(self):
        """Publish metrics to observability-cloudwatch provider."""
        print("[observability-cloudwatch] Simulated metric broadcast.")
    
    def publish_to_elk(self):
        """Publish metrics to observability-elk provider."""
        print("[observability-elk] Simulated logging output.")
    
    def publish_all(self):
        """Publish to all configured observability providers."""
        self.publish_to_prometheus()
        self.publish_to_cloudwatch()
        self.publish_to_elk()
        
        out_dir = os.environ.get('MYCODEXVANTAOS_OBSERVABILITY_METRICS_DIR', 'metrics')
        os.makedirs(out_dir, exist_ok=True)
        metrics_file = os.path.join(out_dir, f'{self.execution_id}.json')
        
        with open(metrics_file, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        
        print(f"\n[observability] Metrics saved to: {metrics_file}")

def main():
    """Main execution point."""
    parser = argparse.ArgumentParser(description='MyCodexVantaOS Metrics Publisher')
    parser.add_argument('--execution-id', required=True, help='Unique execution identifier')
    parser.add_argument('--state-file', help='State file path')
    
    args = parser.parse_args()
    publisher = MetricsPublisher(args.execution_id)
    
    state = {}
    if args.state_file and os.path.exists(args.state_file):
        with open(args.state_file, 'r') as f:
            state = json.load(f)
    
    if state:
        publisher.calculate_metrics(state)
        publisher.publish_all()
    else:
        print("[observability] No state data provided, skipping metrics publication")

if __name__ == '__main__':
    main()
