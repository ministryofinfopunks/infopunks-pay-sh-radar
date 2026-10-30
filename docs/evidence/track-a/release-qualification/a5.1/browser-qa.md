# A5.1 browser QA

The application was built and served locally from the candidate build at `http://127.0.0.1:4173`. Chromium headless-shell drove the actual HTTP application through Chrome DevTools Protocol; screenshots are genuine captures from that running build, not mockups. The local server used the repository's development fallback fixture catalog and in-memory storage, so these captures are browser QA evidence only, not live catalog, PostgreSQL, or deployment proof.

Routes visited at desktop 1440×1000 and mobile 390×844: `/`, `/solana`, `/spend-terminal`, `/routes`, `/providers`, `/receipts`, `/loops`, `/4663`, `/4663/reflexive`, and `/developers` (20 captures total).

Results:

- No horizontal overflow was measured (`scrollWidth` matched viewport width) on the 20 captures.
- No browser console errors/exceptions or failed network requests were recorded.
- CDP accessibility-tree scan found no unnamed button, link, textbox, checkbox, radio, combobox, or menuitem nodes on these routes.
- The only HTTP errors were the expected 409 for the Reflexive AI/NVDA audit on desktop and mobile, caused by the empty local canonical registry. The updated page visibly reports this unavailable state.
- Performance API snapshots and network/console events are recorded in `browser-qa.json` and `browser-network-console.json`.
- Screenshots are in `screenshots/` and use `{desktop|mobile}-{route}.png` filenames.

Performance numbers are local fixture-mode observations and are not a staging SLO. A live staging retest with PostgreSQL, the live Pay.sh catalog, and an operator-refreshed Robinhood asset snapshot is still required.

Focused screenshots `desktop-reflexive-audit-state.png` and `mobile-reflexive-audit-state.png` scroll the actual page to the visible canonical-refresh 409 state.
