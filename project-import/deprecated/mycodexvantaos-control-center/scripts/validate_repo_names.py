#!/usr/bin/env python3
import re
import sys
import yaml
from pathlib import Path

def fail(msg: str):
    print(f"ERROR: {msg}")
    sys.exit(1)

def load_yaml(path: Path):
    if not path.exists():
        fail(f"missing file: {path}")
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

def main():
    policy_path = Path("governance/repo-naming-policy.yaml")
    repos_path = Path("registry/repos.yaml")

    policy = load_yaml(policy_path)
    data = load_yaml(repos_path)

    validation = policy.get("validation", {})
    regex_raw = validation.get("regex")
    if not regex_raw:
        fail("missing validation.regex in policy")

    regex = re.compile(regex_raw)
    forbidden_patterns = [re.compile(x) for x in policy.get("forbidden_patterns", [])]
    approved_planes = set(policy.get("approved_planes", []))
    approved_repo_types = set(policy.get("approved_repo_types", []))
    allowlist = set(policy.get("approved_current_repositories", []))

    repos = data.get("repos", [])
    if not isinstance(repos, list):
        fail("repos must be a list")

    seen = set()

    for repo in repos:
        name = repo.get("name")
        plane = repo.get("plane")
        repo_type = repo.get("repo_type")

        if not isinstance(name, str):
            fail(f"repo entry missing valid name: {repo}")

        if name in seen:
            fail(f"duplicate repo name: {name}")
        seen.add(name)

        if not regex.match(name):
            fail(f"invalid repo name format: {name}")

        for p in forbidden_patterns:
            if p.match(name):
                fail(f"repo name violates forbidden pattern '{p.pattern}': {name}")

        if allowlist and name not in allowlist:
            fail(f"repo name not in approved_current_repositories: {name}")

        if approved_planes and plane not in approved_planes:
            fail(f"repo '{name}' has invalid plane: {plane}")

        if approved_repo_types and repo_type not in approved_repo_types:
            fail(f"repo '{name}' has invalid repo_type: {repo_type}")

    print(f"OK: validated {len(repos)} repositories against policy")

if __name__ == "__main__":
    main()