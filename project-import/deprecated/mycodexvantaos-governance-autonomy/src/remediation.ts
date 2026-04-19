import type { RemediationAction, RemediationResult, ComplianceViolation } from "./types";

let counter = 0;

export class RemediationService {
  private actions = new Map<string, RemediationAction>();

  registerAction(input: Omit<RemediationAction, "id">): RemediationAction {
    const id = `rem-${++counter}`;
    const action: RemediationAction = { id, ...input };
    this.actions.set(id, action);
    return action;
  }

  unregisterAction(actionId: string): boolean {
    return this.actions.delete(actionId);
  }

  getAction(actionId: string): RemediationAction | null {
    return this.actions.get(actionId) ?? null;
  }

  listActions(): RemediationAction[] {
    return Array.from(this.actions.values());
  }

  listByRisk(risk: RemediationAction["risk"]): RemediationAction[] {
    return this.listActions().filter((a) => a.risk === risk);
  }

  remediate(violations: ComplianceViolation[], dryRun = false): RemediationResult {
    const id = `result-${++counter}`;
    if (dryRun) {
      return {
        id,
        status: "dry-run",
        actionsExecuted: 0,
        errors: [],
      };
    }

    let actionsExecuted = 0;
    const errors: string[] = [];

    for (const violation of violations) {
      const matchingAction = this.listActions().find(
        (a) => a.name === violation.rule || a.description.includes(violation.rule),
      );
      if (matchingAction) {
        if (matchingAction.automatic) {
          actionsExecuted++;
        } else {
          errors.push(`Action "${matchingAction.name}" requires manual intervention`);
        }
      } else {
        errors.push(`No remediation action for rule "${violation.rule}"`);
      }
    }

    const status: RemediationResult["status"] =
      errors.length === 0 ? "success" :
      actionsExecuted > 0 ? "partial" : "failure";

    return { id, status, actionsExecuted, errors };
  }
}