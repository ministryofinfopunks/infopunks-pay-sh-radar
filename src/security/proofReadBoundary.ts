/** No tenant identity or approved publication manifest exists for canonical records.
 * Keep raw evidence/operator accounting private until that authority is reviewed. */
export function requiresOperatorProofRead(route: string) {
  return route.startsWith('/v1/receipt-spine/') || route.startsWith('/v1/decision-views/') ||
    route === '/v1/economics/revenue' || route === '/v1/attribution';
}
