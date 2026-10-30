# Decision context and score eligibility

PostgreSQL-backed checks establish that signed J2 contains a committed context hash, eligible evaluation reference, frozen observations and score projection; reloaded context verifies against the canonical receipt store. Existing eligibility tests assert unverified executions and unsupported Evaluations do not contribute qualifying score. Acceptance history is frozen at a sequence boundary; late/future evidence does not enter an earlier context and future issuer timestamps are quarantined.

The causal execution and evaluation in fixtures are synthetic/test-authorized. These results establish deterministic implementation behavior only; they are not production evidence, a real external settlement, or an improvement claim.
