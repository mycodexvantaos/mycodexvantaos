#!/usr/bin/env python3
"""
State Management Script

This script manages orchestration state using Redis for:
- Storing execution state for each repository
- Tracking orchestration progress
- Managing rollback state
- Synchronizing state across workflows
"""

import json
import argparse
import os
import redis
from datetime import datetime
from typing import Dict, List, Optional


class StateManager:
    """Manages orchestration state using Redis."""
    
    def __init__(self):
        """Initialize state manager with Redis connection."""
        self.redis = redis.Redis(
            host=os.environ.get('ORCH_STATE_HOST', 'localhost'),
            port=int(os.environ.get('ORCH_STATE_PORT', 6379)),
            password=os.environ.get('ORCH_STATE_PASSWORD'),
            decode_responses=True
        )
        
        self.key_prefix = "orchestration"
    
    def _key(self, *parts: str) -> str:
        """Generate Redis key."""
        return f"{self.key_prefix}:{':'.join(parts)}"
    
    def initialize_orchestration(self, orchestration_id: str, config: Dict) -> bool:
        """
        Initialize orchestration state.
        
        Args:
            orchestration_id: Unique orchestration identifier
            config: Orchestration configuration
            
        Returns:
            True if successful
        """
        state = {
            'orchestration_id': orchestration_id,
            'created_at': datetime.utcnow().isoformat(),
            'status': 'initialized',
            'config': config,
            'repositories': {},
            'metadata': {
                'total_repositories': len(config.get('repositories', [])),
                'completed_repositories': 0,
                'failed_repositories': 0
            }
        }
        
        key = self._key(orchestration_id)
        self.redis.setex(key, 86400, json.dumps(state))  # 24 hour TTL
        
        print(f"Initialized orchestration state: {orchestration_id}")
        return True
    
    def update_repository_state(
        self,
        orchestration_id: str,
        repository: str,
        status: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        Update state for a specific repository.
        
        Args:
            orchestration_id: Orchestration identifier
            repository: Repository name
            status: Repository status
            metadata: Optional metadata
            
        Returns:
            True if successful
        """
        key = self._key(orchestration_id)
        
        # Get current state
        state_data = self.redis.get(key)
        if not state_data:
            print(f"Error: Orchestration {orchestration_id} not found")
            return False
        
        state = json.loads(state_data)
        
        # Update repository state
        state['repositories'][repository] = {
            'status': status,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if metadata:
            state['repositories'][repository]['metadata'] = metadata
        
        # Update metadata
        if status == 'completed':
            state['metadata']['completed_repositories'] += 1
        elif status == 'failed':
            state['metadata']['failed_repositories'] += 1
        
        # Update overall status
        total = state['metadata']['total_repositories']
        completed = state['metadata']['completed_repositories']
        failed = state['metadata']['failed_repositories']
        
        if completed + failed >= total:
            if failed > 0:
                state['status'] = 'completed_with_failures'
            else:
                state['status'] = 'completed'
        elif completed > 0:
            state['status'] = 'in_progress'
        
        # Save state
        self.redis.setex(key, 86400, json.dumps(state))
        
        print(f"Updated state for {repository}: {status}")
        return True
    
    def get_orchestration_state(self, orchestration_id: str) -> Optional[Dict]:
        """
        Get orchestration state.
        
        Args:
            orchestration_id: Orchestration identifier
            
        Returns:
            Orchestration state or None if not found
        """
        key = self._key(orchestration_id)
        state_data = self.redis.get(key)
        
        if state_data:
            return json.loads(state_data)
        
        return None
    
    def get_repository_state(
        self,
        orchestration_id: str,
        repository: str
    ) -> Optional[Dict]:
        """
        Get state for a specific repository.
        
        Args:
            orchestration_id: Orchestration identifier
            repository: Repository name
            
        Returns:
            Repository state or None if not found
        """
        state = self.get_orchestration_state(orchestration_id)
        
        if state and repository in state['repositories']:
            return state['repositories'][repository]
        
        return None
    
    def sync_orchestration(self, orchestration_id: str) -> bool:
        """
        Synchronize orchestration state across all workflows.
        
        Args:
            orchestration_id: Orchestration identifier
            
        Returns:
            True if successful
        """
        state = self.get_orchestration_state(orchestration_id)
        
        if not state:
            print(f"Error: Orchestration {orchestration_id} not found")
            return False
        
        # Update synchronization timestamp
        state['synced_at'] = datetime.utcnow().isoformat()
        
        # Save state
        key = self._key(orchestration_id)
        self.redis.setex(key, 86400, json.dumps(state))
        
        print(f"Synchronized orchestration state: {orchestration_id}")
        return True
    
    def cleanup_orchestration(self, orchestration_id: str) -> bool:
        """
        Clean up orchestration state.
        
        Args:
            orchestration_id: Orchestration identifier
            
        Returns:
            True if successful
        """
        key = self._key(orchestration_id)
        deleted = self.redis.delete(key)
        
        if deleted:
            print(f"Cleaned up orchestration state: {orchestration_id}")
            return True
        
        print(f"Warning: Orchestration {orchestration_id} not found for cleanup")
        return False
    
    def list_orchestrations(self, limit: int = 100) -> List[Dict]:
        """
        List all active orchestrations.
        
        Args:
            limit: Maximum number of orchestrations to return
            
        Returns:
            List of orchestration summaries
        """
        pattern = self._key("*")
        keys = self.redis.keys(pattern)[:limit]
        
        orchestrations = []
        for key in keys:
            state_data = self.redis.get(key)
            if state_data:
                state = json.loads(state_data)
                orchestrations.append({
                    'orchestration_id': state['orchestration_id'],
                    'status': state['status'],
                    'created_at': state['created_at'],
                    'total_repositories': state['metadata']['total_repositories'],
                    'completed_repositories': state['metadata']['completed_repositories'],
                    'failed_repositories': state['metadata']['failed_repositories']
                })
        
        return orchestrations


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Manage orchestration state'
    )
    subparsers = parser.add_subparsers(dest='action', help='Action to perform')
    
    # Initialize orchestration
    init_parser = subparsers.add_parser('init', help='Initialize orchestration')
    init_parser.add_argument('--orchestration-id', required=True)
    init_parser.add_argument('--config', required=True, help='JSON config file')
    
    # Update repository state
    update_parser = subparsers.add_parser('update', help='Update repository state')
    update_parser.add_argument('--orchestration-id', required=True)
    update_parser.add_argument('--repository', required=True)
    update_parser.add_argument('--status', required=True)
    update_parser.add_argument('--metadata', help='JSON metadata')
    
    # Get orchestration state
    get_parser = subparsers.add_parser('get', help='Get orchestration state')
    get_parser.add_argument('--orchestration-id', required=True)
    
    # Synchronize orchestration
    sync_parser = subparsers.add_parser('sync', help='Synchronize orchestration')
    sync_parser.add_argument('--orchestration-id', required=True)
    
    # List orchestrations
    list_parser = subparsers.add_parser('list', help='List orchestrations')
    list_parser.add_argument('--limit', type=int, default=100)
    
    # Cleanup orchestration
    cleanup_parser = subparsers.add_parser('cleanup', help='Cleanup orchestration')
    cleanup_parser.add_argument('--orchestration-id', required=True)
    
    args = parser.parse_args()
    
    # Create state manager
    manager = StateManager()
    
    # Execute action
    if args.action == 'init':
        with open(args.config, 'r') as f:
            config = json.load(f)
        manager.initialize_orchestration(args.orchestration_id, config)
    
    elif args.action == 'update':
        metadata = json.loads(args.metadata) if args.metadata else None
        manager.update_repository_state(
            args.orchestration_id,
            args.repository,
            args.status,
            metadata
        )
    
    elif args.action == 'get':
        state = manager.get_orchestration_state(args.orchestration_id)
        if state:
            print(json.dumps(state, indent=2))
        else:
            print(f"Orchestration {args.orchestration_id} not found")
    
    elif args.action == 'sync':
        manager.sync_orchestration(args.orchestration_id)
    
    elif args.action == 'list':
        orchestrations = manager.list_orchestrations(args.limit)
        print(json.dumps(orchestrations, indent=2))
    
    elif args.action == 'cleanup':
        manager.cleanup_orchestration(args.orchestration_id)
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()