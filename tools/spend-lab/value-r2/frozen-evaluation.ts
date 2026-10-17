import { fork } from "node:child_process";
import { resolve } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { hashCanonical } from "../../../src/services/receiptIntegrityService";
import type { Offer, Preference } from "./types";
export async function freezeDecisions(
  offers: Offer[],
  path: string,
): Promise<Preference[]> {
  const child = fork(resolve(__dirname, "policy-worker.ts"), [], {
    execArgv: ["--import", "tsx"],
    env: { NODE_ENV: "test", PATH: process.env.PATH },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("policy_start_timeout")),
        10000,
      );
      child.once("message", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error("policy_start_failed"));
      });
    });
    const reply = await new Promise<{
      offers_hash: string;
      decisions_hash: string;
      decisions: Preference[];
    }>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("policy_decision_timeout")),
        10000,
      );
      child.once("message", (raw: any) => {
        clearTimeout(timeout);
        if (raw.error) reject(new Error(raw.error));
        else resolve(raw);
      });
      child.send(offers);
    });
    if (
      reply.offers_hash !== hashCanonical(offers) ||
      reply.decisions_hash !== hashCanonical(reply.decisions)
    )
      throw new Error("policy_binding_invalid");
    writeFileSync(path, JSON.stringify(reply, null, 2) + "\n", { mode: 0o600 });
    return reply.decisions;
  } finally {
    child.kill();
  }
}
export function assertFrozenDecisions(path: string, decisions: Preference[]) {
  const frozen = JSON.parse(readFileSync(path, "utf8"));
  if (
    frozen.decisions_hash !== hashCanonical(decisions) ||
    hashCanonical(frozen.decisions) !== hashCanonical(decisions)
  )
    throw new Error("frozen_decisions_changed");
}
