#!/usr/bin/env python3
"""
Dependency Resolution and Execution Order Calculator

This script resolves dependencies between repositories and calculates
the optimal execution order based on planes, tiers, and dependencies.
"""

import yaml
import json
import argparse
from typing import List, Dict, Set
from collections import defaultdict, deque


class DependencyResolver:
    """Resolves repository dependencies and calculates execution order."""
    
    def __init__(self, deps_file: str, queue_file: str):
        """Initialize resolver with configuration files."""
        with open(deps_file, 'r') as f:
            self.deps_config = yaml.safe_load(f)
        
        with open(queue_file, 'r') as f:
            self.queue_config = yaml.safe_load(f)
        
        self.dependencies = self.deps_config.get('dependencies', [])
        self.queues = self.queue_config.get('queues', {})
        
        # Build dependency graph
        self.graph = defaultdict(set)
        self.reverse_graph = defaultdict(set)
        self._build_graph()
    
    def _build_graph(self):
        """Build dependency graph from configuration."""
        for dep in self.dependencies:
            source = dep['source']
            for target in dep['targets']:
                self.graph[target].add(source)
                self.reverse_graph[source].add(target)
    
    def topological_sort(self, repositories: List[str]) -> List[str]:
        """
        Perform topological sort on repositories.
        
        Args:
            repositories: List of repository names to sort
            
        Returns:
            List of repositories in dependency order
        """
        # Calculate in-degrees
        in_degree = {repo: 0 for repo in repositories}
        
        for repo in repositories:
            for dep in self.graph[repo]:
                if dep in repositories:
                    in_degree[repo] += 1
        
        # Initialize queue with repositories having no dependencies
        queue = deque([repo for repo in repositories if in_degree[repo] == 0])
        result = []
        
        while queue:
            repo = queue.popleft()
            result.append(repo)
            
            # Reduce in-degree for dependents
            for dependent in self.reverse_graph[repo]:
                if dependent in repositories:
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        # Check for cycles
        if len(result) != len(repositories):
            cycle = set(repositories) - set(result)
            raise ValueError(f"Circular dependency detected involving: {cycle}")
        
        return result
    
    def get_plane_priority(self, plane: str) -> int:
        """Get priority level for a plane."""
        queue = self.queues.get(plane, {})
        return queue.get('priority', 999)
    
    def get_tier_order(self, repositories: List[str]) -> Dict[str, int]:
        """
        Calculate tier order based on dependencies.
        
        Args:
            repositories: List of repository names
            
        Returns:
            Dictionary mapping repository to tier number
        """
        tier_map = {}
        visited = set()
        
        def calculate_tier(repo: str) -> int:
            """Recursively calculate tier for a repository."""
            if repo in visited:
                return tier_map.get(repo, 0)
            
            visited.add(repo)
            deps = self.graph.get(repo, set())
            
            if not deps:
                tier_map[repo] = 0
                return 0
            
            max_dep_tier = max(calculate_tier(dep) for dep in deps if dep in repositories)
            tier_map[repo] = max_dep_tier + 1
            
            return tier_map[repo]
        
        for repo in repositories:
            if repo not in visited:
                calculate_tier(repo)
        
        return tier_map
    
    def resolve_execution_order(
        self,
        action: str = 'sync',
        target_planes: List[str] = None,
        repositories: List[str] = None
    ) -> Dict:
        """
        Calculate complete execution order.
        
        Args:
            action: Action to perform (sync, deploy, validate, rollback)
            target_planes: List of target planes (None = all)
            repositories: List of specific repositories (None = all)
            
        Returns:
            Dictionary with execution order and metadata
        """
        # Get all repositories from queue config
        all_repos = set()
        for queue_name, queue_config in self.queues.items():
            all_repos.update(queue_config.get('repositories', []))
        
        # Filter by repositories if specified
        if repositories:
            all_repos = all_repos.intersection(set(repositories))
        
        # Filter by planes if specified
        if target_planes:
            target_repos = set()
            for plane in target_planes:
                if plane in self.queues:
                    target_repos.update(self.queues[plane].get('repositories', []))
            all_repos = all_repos.intersection(target_repos)
        
        # Get repository metadata
        repo_metadata = {}
        for queue_name, queue_config in self.queues.items():
            for repo in queue_config.get('repositories', []):
                if repo in all_repos:
                    repo_metadata[repo] = {
                        'plane': queue_name,
                        'priority': queue_config.get('priority', 999),
                        'tier': 0  # Will be calculated
                    }
        
        # Calculate tiers
        repo_list = list(all_repos)
        tier_map = self.get_tier_order(repo_list)
        
        for repo, tier in tier_map.items():
            repo_metadata[repo]['tier'] = tier
        
        # Sort by tier, then by plane priority, then topological within tier
        execution_order = []
        
        # Group by tier
        tier_groups = defaultdict(list)
        for repo in repo_list:
            tier_groups[tier_map[repo]].append(repo)
        
        # Process tiers in order
        for tier in sorted(tier_groups.keys()):
            # Within each tier, sort by plane priority
            tier_repos = tier_groups[tier]
            tier_repos.sort(key=lambda r: repo_metadata[r]['priority'])
            
            # Topological sort within tier
            try:
                sorted_repos = self.topological_sort(tier_repos)
            except ValueError as e:
                # Fallback to plane priority if cycle detected
                print(f"Warning: {e}. Using plane priority fallback.")
                sorted_repos = tier_repos
            
            for repo in sorted_repos:
                execution_order.append({
                    'name': repo,
                    'plane': repo_metadata[repo]['plane'],
                    'tier': repo_metadata[repo]['tier'],
                    'priority': repo_metadata[repo]['priority'],
                    'action': action
                })
        
        return {
            'action': action,
            'orchestration_id': None,  # Will be set by caller
            'target_planes': target_planes or 'all',
            'total_repositories': len(execution_order),
            'tiers': len(tier_groups),
            'execution_order': execution_order,
            'metadata': {
                'max_tier': max(tier_map.values()) if tier_map else 0,
                'planes': list(set(r['plane'] for r in execution_order))
            }
        }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Resolve repository dependencies and calculate execution order'
    )
    parser.add_argument(
        '--deps-file',
        required=True,
        help='Path to dependencies.yaml'
    )
    parser.add_argument(
        '--queue-file',
        required=True,
        help='Path to queue-config.yaml'
    )
    parser.add_argument(
        '--action',
        default='sync',
        choices=['sync', 'deploy', 'validate', 'rollback'],
        help='Action to perform'
    )
    parser.add_argument(
        '--target-planes',
        default='',
        help='Comma-separated list of target planes'
    )
    parser.add_argument(
        '--repositories',
        default='',
        help='Comma-separated list of specific repositories'
    )
    parser.add_argument(
        '--output',
        default='execution_order.json',
        help='Output file path'
    )
    
    args = parser.parse_args()
    
    # Parse arguments
    target_planes = [p.strip() for p in args.target_planes.split(',')] if args.target_planes else None
    repositories = [r.strip() for r in args.repositories.split(',')] if args.repositories else None
    
    # Create resolver
    resolver = DependencyResolver(args.deps_file, args.queue_file)
    
    # Resolve execution order
    try:
        order = resolver.resolve_execution_order(
            action=args.action,
            target_planes=target_planes,
            repositories=repositories
        )
        
        # Write output
        with open(args.output, 'w') as f:
            json.dump(order, f, indent=2)
        
        print(f"Execution order calculated successfully")
        print(f"  Total repositories: {order['total_repositories']}")
        print(f"  Tiers: {order['tiers']}")
        print(f"  Planes: {', '.join(order['metadata']['planes'])}")
        print(f"  Output written to: {args.output}")
        
        # Print execution order
        print("\nExecution Order:")
        for i, repo in enumerate(order['execution_order'], 1):
            print(f"  {i}. {repo['name']} (Plane: {repo['plane']}, Tier: {repo['tier']}, Priority: {repo['priority']})")
        
    except Exception as e:
        print(f"Error resolving execution order: {e}")
        exit(1)


if __name__ == '__main__':
    main()