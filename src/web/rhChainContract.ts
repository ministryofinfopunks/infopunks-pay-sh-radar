/** Public RH Chain contract inputs use the exact EVM address shape. */
export function isRhChainContractAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function rhChainTokenDossierRoute(value: string) {
  return isRhChainContractAddress(value) ? `/rh-chain-signal-desk/tokens/${encodeURIComponent(value.trim())}` : null;
}
