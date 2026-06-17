# Pre-Spend Agent Example

Before an agent pays, it checks Infopunks.

This example shows the smallest useful decision gate:

```ts
const decision = await client.checkPreSpend(...);
```

Then the agent decides whether to proceed, pause for human approval, or abort spend.

Run it with:

```sh
npx tsx examples/pre-spend-agent/index.ts
```
