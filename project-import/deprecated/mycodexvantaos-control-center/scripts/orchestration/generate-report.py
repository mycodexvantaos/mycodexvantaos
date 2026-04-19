#!/usr/bin/env python3
"""
Execution Report Generator

This script generates comprehensive execution reports including:
- Execution summary
- Repository status
- Performance metrics
- Error details
- Recommendations
"""

import json
import argparse
import os
from datetime import datetime
from typing import Dict, List


class ReportGenerator:
    """Generates execution reports."""
    
    def __init__(self, orchestration_id: str):
        """Initialize report generator."""
        self.orchestration_id = orchestration_id
        self.report_data = {
            'orchestration_id': orchestration_id,
            'generated_at': datetime.utcnow().isoformat(),
            'summary': {},
            'repositories': {},
            'metrics': {},
            'errors': [],
            'recommendations': []
        }
    
    def load_execution_data(self, data_dir: str = ''):
        """Load execution data from artifacts."""
        state_file = os.path.join(data_dir, f'state-{self.orchestration_id}.json')
        
        if os.path.exists(state_file):
            with open(state_file, 'r') as f:
                self.report_data['state'] = json.load(f)
    
    def generate_summary(self):
        """Generate execution summary."""
        state = self.report_data.get('state', {})
        
        total = len(state.get('repositories', {}))
        completed = sum(
            1 for r in state.get('repositories', {}).values()
            if r.get('status') == 'completed'
        )
        failed = sum(
            1 for r in state.get('repositories', {}).values()
            if r.get('status') == 'failed'
        )
        
        self.report_data['summary'] = {
            'total_repositories': total,
            'completed_repositories': completed,
            'failed_repositories': failed,
            'success_rate': (completed / total * 100) if total > 0 else 0,
            'duration': self._calculate_duration(state)
        }
    
    def _calculate_duration(self, state: Dict) -> float:
        """Calculate execution duration in minutes."""
        if 'created_at' not in state:
            return 0.0
        
        start = datetime.fromisoformat(state['created_at'])
        end = datetime.fromisoformat(state.get('completed_at', datetime.utcnow().isoformat()))
        duration = (end - start).total_seconds() / 60
        
        return round(duration, 2)
    
    def generate_html_report(self, output_path: str):
        """Generate HTML report."""
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Orchestration Report - {self.orchestration_id}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 5px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }}
        .metric {{
            background: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }}
        .metric-value {{
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }}
        .metric-label {{
            color: #7f8c8d;
            margin-top: 5px;
        }}
        .success {{ color: #27ae60; }}
        .failed {{ color: #e74c3c; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
        }}
        th {{ background: #2c3e50; color: white; }}
        .status-success {{ background: #d4edda; }}
        .status-failed {{ background: #f8d7da; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Orchestration Execution Report</h1>
        <p>ID: {self.orchestration_id}</p>
        <p>Generated: {self.report_data['generated_at']}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">{self.report_data['summary'].get('total_repositories', 0)}</div>
            <div class="metric-label">Total Repositories</div>
        </div>
        <div class="metric">
            <div class="metric-value success">{self.report_data['summary'].get('completed_repositories', 0)}</div>
            <div class="metric-label">Completed</div>
        </div>
        <div class="metric">
            <div class="metric-value failed">{self.report_data['summary'].get('failed_repositories', 0)}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">{self.report_data['summary'].get('success_rate', 0)}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
    </div>
    
    <h2>Repository Status</h2>
    <table>
        <thead>
            <tr>
                <th>Repository</th>
                <th>Plane</th>
                <th>Status</th>
                <th>Updated At</th>
            </tr>
        </thead>
        <tbody>
"""
        state = self.report_data.get('state', {})
        for repo, repo_state in state.get('repositories', {}).items():
            status_class = 'status-success' if repo_state.get('status') == 'completed' else 'status-failed'
            html += f"""
            <tr class="{status_class}">
                <td>{repo}</td>
                <td>-</td>
                <td>{repo_state.get('status', 'unknown')}</td>
                <td>{repo_state.get('updated_at', '-')}</td>
            </tr>
"""
        
        html += """
        </tbody>
    </table>
    
    <footer>
        <p>Report generated by CodexvantaOS Orchestration System</p>
    </footer>
</body>
</html>
"""
        
        with open(output_path, 'w') as f:
            f.write(html)
        
        print(f"HTML report generated: {output_path}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Generate execution report')
    parser.add_argument('--orchestration-id', required=True, help='Orchestration identifier')
    parser.add_argument('--output', default='execution-report.html', help='Output file path')
    parser.add_argument('--data-dir', default='', help='Data directory')
    
    args = parser.parse_args()
    
    generator = ReportGenerator(args.orchestration_id)
    generator.load_execution_data(args.data_dir)
    generator.generate_summary()
    generator.generate_html_report(args.output)


if __name__ == '__main__':
    main()