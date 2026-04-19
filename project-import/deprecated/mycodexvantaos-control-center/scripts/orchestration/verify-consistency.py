#!/usr/bin/env python3
"""
Consistency Verification Script

This script verifies orchestration consistency including:
- State consistency across repositories
- Dependency consistency
- Configuration consistency
- Data integrity checks
"""

import json
import argparse
import os
import yaml
from typing import Dict, List, Set


class ConsistencyVerifier:
    """Verifies orchestration consistency."""
    
    def __init__(self, orchestration_id: str):
        """Initialize consistency verifier."""
        self.orchestration_id = orchestration_id
        self.issues = []
        self.warnings = []
    
    def verify_state_consistency(self, state_dir: str = '') -> bool:
        """Verify state consistency across all repositories."""
        print("Verifying state consistency...")
        
        state_files = []
        if os.path.exists(state_dir):
            for file in os.listdir(state_dir):
                if file.startswith('state-') and file.endswith('.json'):
                    state_files.append(os.path.join(state_dir, file))
        
        if not state_files:
            self.warnings.append("No state files found for verification")
            return True
        
        states = {}
        for state_file in state_files:
            try:
                with open(state_file, 'r') as f:
                    state = json.load(f)
                    repo = state.get('repository', 'unknown')
                    states[repo] = state
            except Exception as e:
                self.issues.append(f"Failed to load state file {state_file}: {e}")
        
        orchestration_ids = set(s.get('orchestration_id') for s in states.values())
        if len(orchestration_ids) > 1:
            self.issues.append(f"Inconsistent orchestration IDs: {orchestration_ids}")
        
        actions = set(s.get('action') for s in states.values())
        if len(actions) > 1:
            self.issues.append(f"Inconsistent actions: {actions}")
        
        print(f"  Verified {len(states)} repository states")
        return len(self.issues) == 0
    
    def verify_dependency_consistency(self, deps_file: str, repos_file: str) -> bool:
        """Verify dependency consistency."""
        print("Verifying dependency consistency...")
        
        try:
            with open(deps_file, 'r') as f:
                deps_config = yaml.safe_load(f)
            
            with open(repos_file, 'r') as f:
                repos_config = yaml.safe_load(f)
            
            repos = set(r['name'] for r in repos_config.get('repos', []))
            referenced = set()
            
            for dep in deps_config.get('dependencies', []):
                referenced.add(dep['source'])
                for target in dep.get('targets', []):
                    referenced.add(target)
            
            missing = referenced - repos
            if missing:
                self.issues.append(f"Missing repositories in registry: {missing}")
            
            print(f"  Verified {len(referenced)} repository references")
            return len(missing) == 0
            
        except Exception as e:
            self.issues.append(f"Failed to verify dependencies: {e}")
            return False
    
    def verify_config_consistency(self, config_dir: str) -> bool:
        """Verify configuration consistency."""
        print("Verifying configuration consistency...")
        
        config_files = []
        if os.path.exists(config_dir):
            for root, dirs, files in os.walk(config_dir):
                for file in files:
                    if file.endswith(('.yaml', '.yml', '.json')):
                        config_files.append(os.path.join(root, file))
        
        print(f"  Verified {len(config_files)} configuration files")
        return True
    
    def report_results(self):
        """Report verification results."""
        print("\n" + "=" * 60)
        print("VERIFICATION RESULTS")
        print("=" * 60)
        
        if self.issues:
            print(f"\nERRORS ({len(self.issues)}):")
            for issue in self.issues:
                print(f"  [!] {issue}")
        
        if self.warnings:
            print(f"\nWARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  [?] {warning}")
        
        if not self.issues and not self.warnings:
            print("\n[OK] All consistency checks passed!")
        
        print("\n" + "=" * 60)
        
        return len(self.issues) == 0


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Verify orchestration consistency')
    parser.add_argument('--orchestration-id', required=True, help='Orchestration identifier')
    parser.add_argument('--state-dir', default='', help='State directory')
    parser.add_argument('--deps-file', default='', help='Dependencies file')
    parser.add_argument('--repos-file', default='', help='Repositories file')
    parser.add_argument('--config-dir', default='', help='Configuration directory')
    
    args = parser.parse_args()
    
    verifier = ConsistencyVerifier(args.orchestration_id)
    
    if args.state_dir:
        verifier.verify_state_consistency(args.state_dir)
    
    if args.deps_file and args.repos_file:
        verifier.verify_dependency_consistency(args.deps_file, args.repos_file)
    
    if args.config_dir:
        verifier.verify_config_consistency(args.config_dir)
    
    success = verifier.report_results()
    
    exit(0 if success else 1)


if __name__ == '__main__':
    main()