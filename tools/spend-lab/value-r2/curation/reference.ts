/** Reference contracts only. Imports no Radar, provider probes, preferences or labels. */
export function holdoutReference(family: string, input: unknown): unknown {
  const x = input as any;
  switch (family) {
    case "weighted-invoice":
      return (
        x.items.reduce(
          (n: number, item: number[]) => n + item[0] * item[1],
          0,
        ) - x.discount
      );
    case "dedupe-case-sensitive":
      return Array.from(new Set(x));
    case "inclusive-date-range":
      return (
        (Date.parse(x.end + "T00:00:00Z") -
          Date.parse(x.start + "T00:00:00Z")) /
          86400000 +
        1
      );
    case "decimal-rounding":
      return Number((BigInt(x.minor_units) * BigInt(x.rate_bps)) / 10000n);
    case "inventory-availability":
      return x.stock - x.reserved >= x.requested;
    case "pagination-completeness":
      return x.pages.flat();
    case "utf8-bytes":
      return Buffer.byteLength(x, "utf8");
    case "currency-threshold":
      return x.amount_minor <= x.max_minor;
    default:
      throw new Error("unknown_holdout_contract");
  }
}
