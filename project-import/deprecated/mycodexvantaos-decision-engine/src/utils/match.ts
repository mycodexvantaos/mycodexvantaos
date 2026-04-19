/**
 * CodexvantaOS — decision-engine / Shared Condition Matcher
 * Minimal scaffold-friendly condition matching utility
 */

/**
 * Match a simple "field operator value" condition against context.
 * Supported operators: !=, >=, <=, =, >, <
 * Multi-char operators are tried first to avoid ambiguity.
 * Returns false for malformed conditions or non-numeric comparisons.
 */
export function matchCondition(
  condition: string,
  context: Record<string, unknown>
): boolean {
  const ops = ["!=", ">=", "<=", "=", ">", "<"] as const;
  for (const op of ops) {
    const idx = condition.indexOf(op);
    if (idx <= 0) continue;

    const nextChar = condition[idx + op.length];
    if (op.length === 1 && (op === ">" || op === "<" || op === "=")) {
      if (nextChar === "=" || (idx > 0 && condition[idx - 1] === "!" && op === "=")) {
        continue;
      }
    }

    const field = condition.slice(0, idx).trim();
    const expected = condition.slice(idx + op.length).trim();
    if (!field) continue;

    const actual = context[field];
    const actualStr = String(actual ?? "");

    switch (op) {
      case "=":
        return actualStr === expected;
      case "!=":
        return actualStr !== expected;
      case ">":
        return Number.isFinite(Number(actual)) && Number(actual) > Number(expected);
      case "<":
        return Number.isFinite(Number(actual)) && Number(actual) < Number(expected);
      case ">=":
        return Number.isFinite(Number(actual)) && Number(actual) >= Number(expected);
      case "<=":
        return Number.isFinite(Number(actual)) && Number(actual) <= Number(expected);
    }
  }
  return condition in context;
}