# CodexvantaOS Repository Renaming Playbook

## Purpose

This playbook defines the mandatory steps for renaming any repository in the CodexvantaOS fleet.

Repository renaming is a controlled architectural change.

---

## Mandatory Actions

1. Rename the repository in GitHub.
2. Update `registry/repos.yaml`.
3. Update `governance/repo-naming-policy.yaml`.
4. Update all GitHub Actions `uses:` references.
5. Update all README links and architecture documents.
6. Update sandbox fixtures and simulated registries.
7. Update URN/URI mapping files:
   - `engineering.spec.yaml`
   - `index.uri.yaml`
   - `repo.card.yaml`
8. Update graph relationship files:
   - `graph.relations.yaml`
9. Rebuild vector indexing manifests if used:
   - `kb.manifest.yaml`
   - `vectors.manifest.json`
10. Validate mirror sync targets:
   - GitLab
   - Bitbucket
11. Re-run naming validation CI.
12. Re-run policy validation CI.
13. Require governance approval before merge.

---

## Post-Rename Validation

- registry validation passes
- workflow references resolve
- no stale repo names remain in docs
- sandbox simulation passes
- graph links remain valid
- URI/URN mapping remains consistent
- mirror sync remains healthy