# RH Pulse physical-device wallet launch gate

Production calls must remain disabled until this matrix is physically executed and recorded. Automated unit, browser-emulation and Postgres tests do not satisfy the gate.

Use test wallets created only for this pilot. They must contain no meaningful funds. Never record seed phrases, private keys, raw signatures, full signed messages, WalletConnect session secrets or full wallet addresses.

## Evidence record

Matrix version: `rh-pulse-physical-wallet-v1`.

Complete one row per test. “Exact message” means the tester confirmed the visible wallet text byte-for-byte against the server challenge and recorded a bounded screenshot/recording reference. Do not paste the nonce, full message, raw signature, full wallet address or any session secret into this document.

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

## Physical-device and failure-path matrix

Use UTC. Record browser and wallet versions separately in the version cell. Use `N/A — expected no receipt` only for a failure path whose defined result creates no receipt.

| Test ID | Date / UTC time | Tester | Device | OS version | Browser / wallet version | Entry surface | Wallet path | Selected call | Exact message displayed | No transaction | No approval | No chain switch | Returned to correct state | Receipt created | Duplicate rejected | Share actions tested | Screenshot / recording reference | Result | Tester notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DESK-01 | — | — | Desktop | — | Chrome / MetaMask | Pulse staging URL | injected | — | pending | pending | pending | pending | pending | pending | pending | X, native/fallback, copy, landscape, portrait | — | outstanding | — |
| DESK-02 | — | — | Desktop | — | Chrome / Rabby | Pulse staging URL | injected | — | pending | pending | pending | pending | pending | pending | pending | X, native/fallback, copy, landscape, portrait | — | outstanding | Verify Rabby is selected when multiple providers exist. |
| DESK-03 | — | — | Mac | — | Safari / supported wallet | Pulse staging URL | supported injected or handoff | — | pending | pending | pending | pending | pending | pending | pending | X, native/fallback, copy, landscape, portrait | — | outstanding | Record unsupported only after the practical supported path is checked. |
| MOB-01 | — | — | iPhone | — | MetaMask mobile browser | wallet browser | injected | — | pending | pending | pending | pending | pending | pending | pending | X, native, copy, landscape, portrait | — | outstanding | — |
| MOB-02 | — | — | Android phone | — | MetaMask mobile browser | wallet browser | injected | — | pending | pending | pending | pending | pending | pending | pending | X, native, copy, landscape, portrait | — | outstanding | — |
| MOB-03 | — | — | Mobile device | — | Rabby mobile browser | wallet browser | injected where supported | — | pending | pending | pending | pending | pending | pending | pending | X, native/fallback, copy, downloads | — | outstanding | — |
| MOB-04 | — | — | Mobile device | — | Additional compatible wallet | browser → wallet | WalletConnect | — | pending | pending | pending | pending | pending | pending | pending | X, native, copy, downloads | — | outstanding | Must not be MetaMask or Rabby. |
| X-IOS-01 | — | — | iPhone | — | X iOS / wallet | X in-app browser | WalletConnect or wallet-browser handoff | — | pending | pending | pending | pending | pending | pending | pending | Post to X, native, copy, supported download | — | outstanding | Open link inside X; verify selected call survives handoff and return. |
| X-AND-01 | — | — | Android phone | — | X Android / wallet | X in-app browser | WalletConnect or wallet-browser handoff | — | pending | pending | pending | pending | pending | pending | pending | Post to X, native, copy, supported download | — | outstanding | Open link inside X; verify selected call survives handoff and return. |
| FAIL-01 | — | — | — | — | — | any supported entry | reject account connection | — | N/A | yes | yes | yes | pending | N/A — expected no receipt | N/A | recovery actions | — | outstanding | Wallet options remain recoverable. |
| FAIL-02 | — | — | — | — | — | any supported entry | reject signing | — | pending | yes | yes | yes | pending | N/A — expected no receipt | N/A | recovery actions | — | outstanding | Exact challenge remains reviewable or can be regenerated safely. |
| FAIL-03 | — | — | Mobile device | — | wallet app | browser → wallet | close wallet app | — | pending | yes | yes | yes | pending | N/A — expected no receipt | N/A | recovery actions | — | outstanding | No partial call or number. |
| FAIL-04 | — | — | Mobile device | — | wallet app | browser → wallet | WalletConnect timeout | — | pending | yes | yes | yes | pending | N/A — expected no receipt | N/A | recovery actions | — | outstanding | Reconnect path is honest. |
| FAIL-05 | — | — | — | — | — | any supported entry | expired challenge | — | pending | yes | yes | yes | pending | pending after regeneration only | old challenge rejected | recovery actions | — | outstanding | New challenge succeeds; old challenge stays unusable. |
| FAIL-06 | — | — | — | — | — | any supported entry | duplicate submission | — | pending | yes | yes | yes | pending | exactly one | pending | receipt actions | — | outstanding | One public number and one receipt only. |
| FAIL-07 | — | — | — | — | — | any supported entry | network interruption | — | pending | yes | yes | yes | pending | pending / database-authoritative | pending | recovery actions | — | outstanding | Inspect durable state before retry. |
| FAIL-08 | — | — | Mobile device | — | browser + wallet | browser suspension | WalletConnect or injected | — | pending | yes | yes | yes | pending | pending | pending | recovery actions | — | outstanding | Selection and authoritative receipt state restore correctly. |
| FAIL-09 | — | — | — | — | — | any supported entry | WalletConnect unavailable | — | N/A | yes | yes | yes | pending | N/A — expected no receipt | N/A | injected/fallback actions | — | outstanding | No broken QR/deep link; injected path remains available. |
| FAIL-10 | — | — | — | — | — | public receipt page | clipboard unavailable | — | N/A | N/A | N/A | N/A | pending | existing receipt unchanged | N/A | X, native or visible-link fallback | — | outstanding | Honest status message. |
| FAIL-11 | — | — | Mobile device | — | — | public receipt page | native file share unavailable | — | N/A | N/A | N/A | N/A | pending | existing receipt unchanged | N/A | text/URL share, copy, explicit download | — | outstanding | Artifact failure never affects provenance. |

For every X row, explicitly open the Pulse link inside X, select a call, begin handoff, confirm selection persistence, sign the exact challenge, return to the correct receipt state, verify exactly one receipt, then exercise Post to X, native share, copy link, and a supported card download.

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
Release commit SHA:
Test completion date:
Tested staging hostname:
WalletConnect project environment:
Test matrix version: rh-pulse-physical-wallet-v1
Testers:
Evidence record location:
Blocking defects:
Retest results:
Approved by:
Approval timestamp:
Decision:
```

Only an approved `Decision: pass` permits the production environment change:

```env
RH_PULSE_PHYSICAL_WALLET_GATE_PASSED=true
```

Current repository status: **outstanding / false**. Phase 3B did not physically perform or claim these tests.
