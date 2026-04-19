#!/usr/bin/env python3
"""
Dependency Validation Script

This script validates repository dependencies for:
- Circular dependencies
- Missing repositories
- Invalid dependency types
- Conflicting dependencies
"""

import yaml
import argparse
import sys
from typing import List, Dict, Set
from collections import defaultdict


class DependencyValidator:
    """Validates repository dependencies."""
    
    def __init__(self, deps_file: str, repos_file: str):
        """Initialize validator with configuration files."""
        with open(deps_file, 'r') as f:
            self.deps_config = yaml.safe_load(f)
        
        with open(repos_file, 'r') as f:
            self.repos_config = yaml.safe_load(f)
        
        self.dependencies = self.deps_config.get('dependencies', [])
        self.repositories = set(
            repo['name'] for repo in self.repos_config.get('repos', [])
        )
        
        self.errors = []
        self.warnings = []
    
    def validate_all(self) -> bool:
        """
        Run all validation checks.
        
        Returns:
            True if all validations pass, False otherwise
        """
        print("Running dependency validation...")
        
        self._validate_circular_dependencies()
        self._validate_missing_repositories()
        self._validate_dependency_types()
        self._validate_criticality()
        self._validate_conflicts()
        
        # Report results
        self._report_results()
        
        return len(self.errors) == 0
    
    def _validate_circular_dependencies(self):
        """Check for circular dependencies."""
        print("  Checking for circular dependencies...")
        
        # Build graph
        graph = defaultdict(set)
        for dep in self.dependencies:
            source = dep['source']
            for target in dep['targets']:
                graph[target].add(source)
        
        # Detect cycles using DFS
        visited = set()
        recursion_stack = set()
        
        def has_cycle(repo: str) -> bool:
            """Check if repository has circular dependency."""
            visited.add(repo)
            recursion_stack.add(repo)
            
            for neighbor in graph[repo]:
                if neighbor not in visited:
                    if has_cycle(neighbor):
                        return True
                elif neighbor in recursion_stack:
                    return True
            
            recursion_stack.remove(repo)
            return False
        
        cycles = []
        for repo in self.repositories:
            if repo not in visited:
                if has_cycle(repo):
                    cycles.append(repo)
        
        if cycles:
            self.errors.append(
                f"Circular dependencies detected: {', '.join(cycles)}"
            )
        else:
            print("    ✓ No circular dependencies found")
    
    def _validate_missing_repositories(self):
        """Check for missing repositories in dependency definitions."""
        print("  Checking for missing repositories...")
        
        referenced_repos = set()
        for dep in self.dependencies:
            referenced_repos.add(dep['source'])
            for target in dep['targets']:
                referenced_repos.add(target)
        
        missing = referenced_repos - self.repositories
        
        if missing:
            self.errors.append(
                f"Referenced repositories not in registry: {', '.join(missing)}"
            )
        else:
            print("    ✓ All referenced repositories exist in registry")
    
    def _validate_dependency_types(self):
        """Validate dependency types."""
        print("  Validating dependency types...")
        
        valid_types = {'must_precede', 'should_precede', 'runtime', 'infrastructure'}
        
        for dep in self.dependencies:
            dep_type = dep.get('type')
            if dep_type not in valid_types:
                self.errors.append(
                    f"Invalid dependency type '{dep_type}' for {dep['source']}. "
                    f"Must be one of: {', '.join(valid_types)}"
                )
        
        print("    ✓ All dependency types are valid")
    
    def _validate_criticality(self):
        """Validate criticality levels."""
        print("  Validating criticality levels...")
        
        valid_criticality = {'critical', 'high', 'medium', 'low'}
        
        for dep in self.dependencies:
            criticality = dep.get('criticality')
            if criticality not in valid_criticality:
                self.warnings.append(
                    f"Unknown criticality '{criticality}' for {dep['source']}. "
                    f"Should be one of: {', '.join(valid_criticality)}"
                )
        
        print("    ✓ All criticality levels are valid")
    
    def _validate_conflicts(self):
        """Check for conflicting dependencies."""
        print("  Checking for conflicting dependencies...")
        
        # Build dependency map
        dep_map = defaultdict(lambda: defaultdict(set))
        
        for dep in self.dependencies:
            source = dep['source']
            dep_type = dep['type']
            for target in dep['targets']:
                dep_map[source][target].add(dep_type)
        
        # Check for conflicts
        conflicts = []
        for source, targets in dep_map.items():
            for target, types in targets.items():
                if len(types) > 1:
                    conflicts.append(
                        f"{source} -> {target} has conflicting types: {', '.join(types)}"
                    )
        
        if conflicts:
            self.errors.append(f"Conflicting dependencies: {', '.join(conflicts)}")
        else:
            print("    ✓ No conflicting dependencies found")
    
    def _report_results(self):
        """Report validation results."""
        print("\n" + "=" * 60)
        print("VALIDATION RESULTS")
        print("=" * 60)
        
        if self.errors:
            print(f"\n❌ ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  • {error}")
        
        if self.warnings:
            print(f"\n⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  • {warning}")
        
        if not self.errors and not self.warnings:
            print("\n✅ All validations passed successfully!")
        
        print("\n" + "=" * 60)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Validate repository dependencies'
    )
    parser.add_argument(
        '--deps-file',
        required=True,
        help='Path to dependencies.yaml'
    )
    parser.add_argument(
        '--repos-file',
        required=True,
        help='Path to repos.yaml'
    )
    
    args = parser.parse_args()
    
    # Create validator
    validator = DependencyValidator(args.deps_file, args.repos_file)
    
    # Run validation
    success = validator.validate_all()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()