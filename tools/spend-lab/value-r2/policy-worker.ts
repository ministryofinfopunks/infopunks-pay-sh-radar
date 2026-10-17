/** The decision process receives validated offers only. It never opens a dataset/label file. */
import { z } from "zod";
import { OfferSchema } from "./types";
import { decide } from "./strategies";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
process.on("message", (message: unknown) => {
  try {
    const offers = z.array(OfferSchema).parse(message);
    const decisions = offers.flatMap((o) => decide(o));
    process.send?.({
      offers_hash: hashCanonical(offers),
      decisions,
      decisions_hash: hashCanonical(decisions),
    });
  } catch (error) {
    process.send?.({
      error: error instanceof Error ? error.message : "policy_failed",
    });
  }
});
process.send?.({ ready: true });
