# Human accessibility and physical-device qualification — HOLD

Subject: e0315314264fff395f8e84b37bb6f1984d6b39e7. This package preserves G1's approved cyan identity. G5/G6 require authorized human testing, not an agent/axe verdict. [manual-results.json](manual-results.json) provides records for device, browser/version, OS, procedure, expected/observed behavior, screenshots/recordings, defect severity, reviewer identity and approval.

## Environment and fixtures

Use the reviewed local UI-INT2 compiled candidate on http://127.0.0.1:5183 with protected synthetic PostgreSQL-backed API8812, or a later explicitly authorized isolated environment. Application source bytes match the frozen candidate. Consult ui-int2/evidence/fixture-identifiers.json for actual Judgment/pending Execution/Evaluation IDs; replace the `{id}` placeholders in the cases. Owner and nonowner keys must be supplied by the local fixture operator, never production keys. Keep payment/execution/automation disabled. Do not place credentials into links or screen recordings. No wallet signing, live-value payments or real account data.

For physical devices, localhost on the device is not the Mac. An operator must provide an authorized private-network test origin/TLS certificate and correct API/CORS configuration without exposing this local issuer/DB publicly or bypassing browser warnings. Until that environment exists, device cases remain NOT_RUN/HOLD.

Connected surface inventory on 2026-10-13: macOS14.4.1; native Google Chrome155.0.8059.40. CUA exposed only in-app/MCP browser surfaces and native apps, no iOS/Android/Windows device sessions. No usable Safari/AT testing session was established. A native Chrome Spend Terminal page was opened and its labelled/password controls observed through the accessibility tree; Chrome reported inherited localhost zoom50%. Attempts to start keyboard/native-zoom qualification were interrupted twice by the computer-use 'user changed app' guard. No zoom setting was changed, no input submitted, and no case is marked passed from that pilot. This observation is agent-assisted, not human sign-off. VoiceOver/NVDA audio, physical touch, real virtual keyboards and orientation have not been tested in this run.

## Required environments

| Environment | Required method | Current disposition |
| --- | --- | --- |
| macOS Safari | Native Safari, physical keyboard, browser zoom200/400%; VoiceOver enabled for separate pass | HOLD; tester/session required |
| macOS Chrome | Native Chrome155; full Tab/Shift-Tab/Enter/Space/Escape traversal; browser zoom200/400% | HOLD; pilot loaded only |
| macOS VoiceOver + Safari | Human listens to rotor, landmarks/forms/headings and live announcements | HOLD; no audio sign-off |
| Windows Chrome + NVDA | Real Windows + NVDA, speech logs and native zoom | HOLD; no Windows session |
| iPhone/iPad Safari | Physical iOS device; touch, virtual keyboard, text size, orientation, reduced motion | HOLD; no connected device/origin |
| Android Chrome | Physical Android; touch, virtual keyboard, system text size, orientation, reduced motion; TalkBack where available | HOLD; no connected device/origin |

Record exact versions and model for the device actually tested. Emulation, CSS scaling and headless WebKit do not fill these rows. Automated supplemental evidence: 56 new viewport checks across eight routes/seven widths with zero errors/overflow/axe violations; UI-INT2 had973 viewport checks,200% CSS text and keyboard/reduced-motion evidence. Axe inconclusive nodes remain unresolved until human review.

## Procedures and expected outcomes

Run all representative routes with a pointer-free desktop pass, then AT and zoom passes. On mobile run touch/keyboard/text-size/orientation/reduced-motion passes. Capture the relevant viewport/action/result, redact credentials, and log failed expectations as P0 security/evidence authority, P1 blocked primary workflow/AT access, P2 recoverable usability/reflow or P3 minor presentation defect. Unobserved severity stays null, not 'none'.

| Case | Route / procedure | Expected behavior |
| --- | --- | --- |
| M01 Spend check | Homepage route field → Run Spend Check; /spend-terminal; fill fixture identity/key/intent/budget, submit by Enter | Subject deep link preserved; labels and masked key; one pending state announced; disabled duplicate submission; insufficient evidence explicitly free, no canonical receipt, no execution/payment implied |
| M02 Solana intelligence | /solana; traverse search, filters, section links, evidence disclosures and code-scroll regions | Logical heading/landmark sequence; no keyboard trap; visible focus; loaded data differs from unavailable; horizontal code scroll operable without document overflow |
| M03 Robinhood read-only | /rh-chain-signal-desk and /4663; inspect market evidence and navigation | Service versus financial-market context remains explicit; anonymous browsing makes no private-history requests; no trading/signing authority implied |
| M04 Receipt inspection | /proof/judgment/{id}, /proof/execution/{id}, /proof/evaluation/{id}; owner key, inspect, disclosure; switch to wrong-tenant key | Authorized stages truthful; signed Judgment distinct from authorized execution; pending Execution stays pending; wrong tenant clears old evidence and returns generic unavailable; key absent from URL/history/storage |
| M05 Focus restoration | Shared mobile menu and specialized destinations; command palette where available; open by keyboard, dismiss Escape, reopen/select | Trigger/expanded state announced; usable focus order; dismissal returns focus to trigger; no trap/background interaction; navigation moves to useful content |
| M06 Native zoom/reflow | All four workflow families at browser200% then400%; record browser chrome zoom indicator, restore original zoom | Text/controls readable and reachable; no clipped primary action; long IDs wrap; intended code/table scrolling remains operable; status conveyed beyond color |
| M07 AT announcements | VoiceOver/NVDA, landmarks/headings/forms/links; submit missing key/invalid input; pending/error/retry/deny/receipt result | Names/roles/states match purpose; reading order logical; errors associated with fields, live changes announced once; disclosure state and receipt source readable |
| M08 Mobile input | Physical touch; /spend-terminal and proof inspector; focus key/intent/ID, virtual keyboard, Enter/submit, dismiss | Keyboard does not obscure active field/action; correct masking; input survives intended scroll/orientation; touch targets usable without accidental actions |
| M09 Text/orientation | /solana, Spend, Robinhood and receipt detail; system large text/text scaling, portrait→landscape→portrait | No lost data or clipped evidence/long identifiers; menu/filter state remains usable; primary workflow reachable |
| M10 Reduced motion/outage | Enable OS reduced motion; inspect navigation/disclosure/pending; operator stops only disposable backend or injects503 then retries | No distracting motion, feedback remains understandable; error redacted, safe retry; no invented success/receipt; focus stays useful and form values survive |

## Completion record

Fill every result row with observed behavior, evidence path/hash, actual device/browser/OS, human name/authority, date, severity and approval. Do not put private keys into the result file. Missing devices are HOLD; failed primary/security expectations are BLOCKED until corrected/requalified. Explicit human acceptance must name this application SHA and full tested scope. Preserve open inconclusive contrast/AT cases rather than converting them to PASS. Any correction affecting approved material requires scoped visual requalification and approval.
