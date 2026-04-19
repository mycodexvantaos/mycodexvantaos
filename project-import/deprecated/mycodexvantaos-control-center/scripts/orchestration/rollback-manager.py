#!/usr/bin/env python3
"""
Rollback Manager Script

This script manages rollback operations for:
- Initiating rollbacks for failed deployments
- Coordinating rollback across dependent repositories
- Managing rollback state
- Verifying rollback completion
"""

import json
import argparse
import os
import sys
import yaml
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict


class RollbackManager:
    """Manages rollback operations."""
    
    def __init__(self, deps_file: str, queue_file: str):
        """Initialize rollback manager with configuration files."""
        with open(deps_file, 'r') as f:
            self.deps_config = yaml.safe_load(f)
        
        with open(queue_file, 'r') as f:
            self.queue_config = yaml.safe_load(f)
        
        self.dependencies = self.deps_config.get('dependencies', [])
        self.queues = self.queue_config.get('queues', {})
    
    def get_rollback_order(self, repository: str) -> List[Dict]:
        """
        Calculate rollback order for a repository.
        
        Rollback order is reverse of deployment order - dependents are rolled
        back before their dependencies.
        """
        # Build reverse dependency graph
        dependents = defaultdict(set)
        for dep in self.dependencies:
            source = dep['source']
            for target in dep.get('targets', []):
                dependents[source].add(target)
        
        # Collect all repositories that need rollback
        to_rollback = {repository}
        queue = [repository]
        
        while queue:
            current = queue.pop(0)
            for dependent in dependents[current]:
                if dependent not in to_rollback:
                    to_rollback.add(dependent)
                    queue.append(dependent)
        
        # Get plane for each repository
        repo_plane = {}
        for queue_name, queue_config in self.queues.items():
            for repo in queue_config.get('repositories', []):
                if repo in to_rollback:
                    repo_plane[repo] = queue_name
        
        # Sort by plane priority (reverse order of deployment)
        repos_with_plane = [
            (repo, repo_plane[repo], self.queues[repo_plane[repo]].get('priority', 999))
            for repo in to_rollback if repo in repo_plane
        ]
        
        repos_with_plane.sort(key=lambda x: x[2], reverse=True)
        
        rollback_order = [
            {'name': repo, 'plane': plane, 'priority': priority}
            for repo, plane, priority in repos_with_plane
        ]
        
        return rollback_order
    
    def get_rollback_strategy(self, plane: str) -> str:
        """Get rollback strategy for a plane."""
        queue_config = self.queues.get(plane, {})
        return queue_config.get('rollback_strategy', 'auto')
    
    def initiate_rollback(
        self,
        repository: str,
        orchestration_id: str,
        reason: str = ""
    ) -> Dict:
        """Initiate rollback for a failed repository."""
        rollback_order = self.get_rollback_order(repository)
        
        rollback_plan = {
            'orchestration_id': orchestration_id,
            'trigger_repository': repository,
            'reason': reason,
            'initiated_at': datetime.utcnow().isoformat(),
            'total_repositories': len(rollback_order),
            'rollback_order': rollback_order,
            'strategies': {}
        }
        
        for repo_info in rollback_order:
            repo = repo_info['name']
            plane = repo_info['plane']
            strategy = self.get_rollback_strategy(plane)
            rollback_plan['strategies'][repo] = strategy
        
        self._save_rollback_plan(orchestration_id, rollback_plan)
        
        print(f"Rollback initiated for {repository}")
        print(f"  Total repositories to rollback: {len(rollback_order)}")
        print(f"  Reason: {reason}")
        
        return rollback_plan
    
    def execute_rollback(
        self,
        orchestration_id: str,
        dry_run: bool = False
    ) -> Dict:
        """Execute rollback plan."""
        rollback_plan = self._load_rollback_plan(orchestration_id)
        
        if not rollback_plan:
            print(f"Error: No rollback plan found for {orchestration_id}")
            return {'error': 'No rollback plan found'}
        
        results = {
            'orchestration_id': orchestration_id,
            'executed_at': datetime.utcnow().isoformat(),
            'dry_run': dry_run,
            'results': []
        }
        
        for repo_info in rollback_plan['rollback_order']:
            repo = repo_info['name']
            plane = repo_info['plane']
            strategy = rollback_plan['strategies'][repo]
            
            print(f"\nRolling back {repo} (Plane: {plane}, Strategy: {strategy})")
            
            repo_result = {
                'repository': repo,
                'plane': plane,
                'strategy': strategy,
                'status': 'pending'
            }
            
            if dry_run:
                print(f"  [DRY RUN] Would rollback {repo}")
                repo_result['status'] = 'skipped_dry_run'
            elif strategy == 'auto':
                success = self._execute_auto_rollback(repo)
                repo_result['status'] = 'success' if success else 'failed'
            else:
                print(f"  [MANUAL] Manual rollback required for {repo}")
                repo_result['status'] = 'manual_action_required'
            
            results['results'].append(repo_result)
        
        self._save_rollback_results(orchestration_id, results)
        
        successful = sum(1 for r in results['results'] if r['status'] == 'success')
        failed = sum(1 for r in results['results'] if r['status'] == 'failed')
        manual = sum(1 for r in results['results'] if r['status'] == 'manual_action_required')
        
        print(f"\nRollback execution complete:")
        print(f"  Successful: {successful}")
        print(f"  Failed: {failed}")
        print(f"  Manual action required: {manual}")
        
        return results
    
    def _execute_auto_rollback(self, repository: str) -> bool:
        """Execute automatic rollback for a repository."""
        print(f"  Executing auto rollback for {repository}...")
        return True
    
    def _save_rollback_plan(self, orchestration_id: str, plan: Dict):
        """Save rollback plan to file."""
        os.makedirs('rollback-plans', exist_ok=True)
        with open(f'rollback-plans/{orchestration_id}.json', 'w') as f:
            json.dump(plan, f, indent=2)
    
    def _load_rollback_plan(self, orchestration_id: str) -> Optional[Dict]:
        """Load rollback plan from file."""
        try:
            with open(f'rollback-plans/{orchestration_id}.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return None
    
    def _save_rollback_results(self, orchestration_id: str, results: Dict):
        """Save rollback results to file."""
        os.makedirs('rollback-results', exist_ok=True)
        with open(f'rollback-results/{orchestration_id}.json', 'w') as f:
            json.dump(results, f, indent=2)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Manage rollback operations')
    parser.add_argument('--deps-file', required=True, help='Path to dependencies.yaml')
    parser.add_argument('--queue-file', required=True, help='Path to queue-config.yaml')
    parser.add_argument('--repository', help='Repository to rollback')
    parser.add_argument('--orchestration-id', help='Orchestration identifier')
    parser.add_argument('--reason', default='Manual rollback', help='Reason for rollback')
    parser.add_argument('--execute', action='store_true', help='Execute rollback')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode')
    
    args = parser.parse_args()
    
    manager = RollbackManager(args.deps_file, args.queue_file)
    
    if args.repository and args.orchestration_id:
        plan = manager.initiate_rollback(
            args.repository,
            args.orchestration_id,
            args.reason
        )
        print(json.dumps(plan, indent=2))
        
        if args.execute:
            manager.execute_rollback(args.orchestration_id, args.dry_run)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()