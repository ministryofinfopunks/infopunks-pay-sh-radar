/** Authored public probe model for frozen LOCAL implementations, not observed target-output correctness.
 * This assumes a free health/SLO endpoint exists. No external provider makes that promise here.
 * Development is already known; these are counterfactual probe declarations, not a new holdout.
 */
export function declaredDevelopmentProbe(implementation: string) {
  return {
    reachable: implementation !== "unavailable",
    schema_valid: true,
    within_latency_bound: implementation !== "slow-upper",
  };
}
