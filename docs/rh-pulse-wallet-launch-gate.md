# RH Pulse physical-device wallet launch gate

Production calls must remain disabled until this matrix is physically executed and recorded. Automated unit, browser-emulation and Postgres tests do not satisfy the gate.

Use test wallets created only for this pilot. They must contain no meaningful funds. Never record seed phrases, private keys, raw signatures, full signed messages, WalletConnect session secrets or full wallet addresses.

## Evidence record

For every row record:

- test date/time in UTC;
- tester;
- device model;
- OS version;
- browser or in-app browser version;
- wallet/version;
- injected or WalletConnect path;
- selected outcome;
- cancellation/recovery result;
- accepted public call ID and shortened wallet;
- pass/fail and bounded notes.

Do not set `RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=true` until all mandatory rows pass and an operator reviews the evidence record.

## Required assertions for every successful signature

- The selected call survives connection, wallet handoff and return.
- The wallet displays the exact readable server-provided EIP-191 message.
- Domain is `pulse.infopunks.fun`, URI is `https://pulse.infopunks.fun/`, chain ID is `4663`, and window/methodology/outcome/nonce/times match the challenge.
- There is no transaction request, token approval, permission beyond account access/signing, or chain-switch request.
- Server verification creates exactly one accepted call and exactly one immutable receipt.
- The public number and Genesis state are correct.
- The public call page, metadata image, Post to X, native share, copy link and landscape/portrait downloads work.
- Return state is correct and the UI remains recoverable after cancellation or expiry.

## Desktop matrix

| Mandatory | Environment | Connect/sign | Cancel/recover | Duplicate | Share actions | Result/evidence |
|---:|---|---|---|---|---|---|
| yes | Chrome + MetaMask extension | pending | pending | pending | pending | outstanding |
| yes | Chrome + Rabby extension | pending | pending | pending | pending | outstanding |
| where supported | Safari + compatible injected wallet | pending | pending | pending | pending | outstanding |

Verify Rabby is selected explicitly when multiple injected providers exist. MetaMask compatibility must not override the user’s provider choice.

## Mobile wallet-browser matrix

| Mandatory | Environment | Connect/sign | Cancel/recover | Expiry regeneration | Share actions | Result/evidence |
|---:|---|---|---|---|---|---|
| yes | MetaMask mobile browser on iOS or Android | pending | pending | pending | pending | outstanding |
| where supported | Rabby mobile browser | pending | pending | pending | pending | outstanding |
| yes | One additional WalletConnect-compatible mobile wallet | pending | pending | pending | pending | outstanding |

Confirm portrait download and Web Share behavior on the physical device. File sharing may fall back to text and canonical URL; that fallback is acceptable when the platform does not support shared files.

## Social in-app browser matrix

| Mandatory | Environment | Wallet handoff | Return preserves call | Sign/receipt | Share fallback | Result/evidence |
|---:|---|---|---|---|---|---|
| yes | X in-app browser on iOS | pending | pending | pending | pending | outstanding |
| yes | X in-app browser on Android | pending | pending | pending | pending | outstanding |

If injected access is absent, WalletConnect handoff must be honest. A missing project ID must show WalletConnect unavailable while keeping any injected path usable; it must not show a broken QR/deep link.

## WalletConnect lifecycle matrix

| Mandatory | Scenario | Required result | Result/evidence |
|---:|---|---|---|
| yes | iOS handoff and return | selected call preserved; exact message signed; one receipt | outstanding |
| yes | Android handoff and return | selected call preserved; exact message signed; one receipt | outstanding |
| yes | User rejects signature | recoverable message-ready state; no call/number/receipt | outstanding |
| yes | User closes wallet app | recoverable browser state; no partial call | outstanding |
| yes | Session timeout | honest timeout and reconnect path | outstanding |
| yes | Challenge expires during handoff | expired state; clean new challenge; old challenge unusable | outstanding |
| yes | Duplicate submission | one accepted call; stable duplicate/replay state; one number | outstanding |
| yes | Unsupported wallet | honest unavailable/recovery state | outstanding |
| yes | File sharing unsupported | native text/URL or explicit download/copy fallback | outstanding |

## Negative request-history inspection

For at least one injected and one WalletConnect success, inspect wallet request history or instrumented provider logs. The only expected wallet methods are account access and human-readable message signing. Explicitly confirm absence of:

```text
eth_sendTransaction
wallet_switchEthereumChain
wallet_addEthereumChain
eth_signTransaction
token approvals
```

## Launch attestation

After every mandatory row passes, the operator records:

```text
Gate review date:
Evidence record location:
Reviewed by:
Open defects:
Decision:
```

Only an approved `Decision: pass` permits the production environment change:

```env
RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=true
```

Current repository status: **outstanding / false**. Phase 3B did not physically perform or claim these tests.
