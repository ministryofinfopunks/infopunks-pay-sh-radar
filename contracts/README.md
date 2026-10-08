# IPX contract package

The five contracts implement fixed supply and birth metadata, a funded Genesis call distributor, a completed-cohort Genesis certificate, immutable Pulse commitments, and a contribution vault with purchase/burn. They are implementation artifacts, not deployed contracts or an independent security audit.

Install the dependency from the repository root with `python3 scripts/setup-ipx-contracts.py`, then run `forge test --root contracts`. OpenZeppelin Contracts v5.4.0 is pinned to `c64a1edb67b6e3f4a15cca8909c9482ad33a02b0`. Solidity is pinned to 0.8.30, optimizer 200 runs, Cancun target. Generated output and downloaded dependencies are ignored.

All deployments require chain 4663. Obtain reviewed allocation values and addresses first. To allocate fixed supply to the distributor/vault, predict their deployment addresses using the deployment account and transaction sequence, or use a reviewed deterministic deployment procedure. Verify bytecode, immutable constructor parameters and allocation recipients after deployment; never treat matching getters alone as a security audit.

`PulseCommitment` emits `PulseWindowCommitted` and exposes `commitments`. The strengthened Radar adapter requires both event and stored-state agreement. Earlier commitment contracts lacking this interface will no longer be reported confirmed by this adapter. Preserve their historical records; deploy/configure a reviewed adapter-compatible contract before new anchoring.

`IPXContributionVault` uses a V3-style `exactInput` interface. It does not create pools or prove venue support. A deployed compatible router, canonical USDG/PLTR and IPX/PLTR routes, quote testing, LP funding, custody/lock policy, and independently reviewed execution parameters are required before use. Its accountant is an explicit trusted cost authority. The contract cannot verify source USDG transaction hashes itself; Radar's finalized receipt ledger supplies that evidence and the reviewed revenue hash.

No deployment command with a private key is provided or run. Run local tests before independently reviewing this financial code for mainnet use.

`IPXGenesisCertificate` is deployed after the funded distributor seals the complete cohort. It binds the cohort root to the original token birth block/time, Constitution hash and allocation hash. Its count fields reflect the sealer’s commitment; onchain storage alone cannot prove 4,663 human identities or offchain signature correctness. The reviewed cohort export remains part of launch evidence.
