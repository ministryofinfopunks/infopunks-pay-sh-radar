# Radar R2.1 accessibility review matrix

**Candidate SHA:** populate after the final source freeze.
**Method:** desktop/tablet/mobile Playwright and Axe, keyboard checks, responsive viewport equivalents, and manual source/UI review. Axe `incomplete` results remain unresolved until manually adjudicated; zero Axe violations alone is not a pass.

| Area / interaction | Status | Evidence or limitation |
|---|---|---|
| Horizontal overflow at desktop, tablet and mobile | PENDING | Browser run must report no document or uncontained element overflow on all 11 routes. |
| `/developers` code examples | PENDING | Each code region must be bounded, focusable, labelled, and horizontally scrollable by keyboard when its line cannot wrap semantically. |
| `.sr-only` geometry | PENDING | Browser width report and computed clip geometry; content must remain in accessibility tree. |
| Color contrast | LIMITATION | Axe previously returned 8,982 inconclusive nodes across the route matrix. Each unresolved item needs manual foreground/background measurement or a documented exception; Axe's result is not a pass. |
| ARIA attribute validity | PENDING | Axe violations plus manual verification of role/state/value combinations and live region updates. |
| Accessible names | PENDING | Inspect links, buttons, inputs, icon-only controls and dialogs on all routes. |
| Keyboard navigation and focus order | PENDING | Tab/Shift+Tab through navigation, forms, dialogs, expandable controls and code regions; verify visible focus and logical order. |
| Screen-reader announcements | LIMITATION | Automated live-region presence can be checked, but a human screen-reader pass with supported AT is required before sign-off. |
| Reduced motion | PENDING | Emulate `prefers-reduced-motion: reduce`; confirm animation and smooth scrolling are suppressed or materially reduced. |
| 200% and 400% zoom/reflow | PENDING | 720px and 360px CSS viewport equivalents approximate 200%/400% of a 1440 CSS-pixel viewport. These are not browser zoom UI tests; verify no loss of content or operation. |
| Form validation and errors | PENDING | Exercise missing/invalid tenant key and malformed input; errors must be announced, associated with fields and recoverable. |
| Async Judgment states | PENDING | Exercise loading, insufficient evidence, success, server error, timeout, retry and cancellation; assert status/alert announcements and recovery action. |
| Auth-required private state on `/4663` | PENDING | Anonymous state must clearly explain private history/reputation requires approved identity while public market intelligence remains available. |

## Sign-off

Automated results, manual reviewer, browser/AT versions, exact source SHA and unresolved limitations must be filled after the final exact-SHA run. Until then, manual accessibility sign-off is **NOT COMPLETE**.
