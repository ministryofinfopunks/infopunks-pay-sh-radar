import {
  createInfopunksClient,
  type CreateInfopunksClientOptions,
} from "../../../src/sdk/judgmentClient";
/** Explicit opt-in integration seam; never used by the offline runner.
 * SDK handles tenant binding, protected sessions, x402 and signed receipt verification.
 * Caller must supply its own narrowly scoped payment approval. No wallet keys here.
 * A verified paid judgment is returned as evidence, never as execution permission.
 */
export function radarSdkAssessment(options: CreateInfopunksClientOptions) {
  if (
    !options.baseUrl ||
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(options.baseUrl).hostname,
    )
  )
    throw new Error("spend_lab_remote_sdk_hold");
  const client = createInfopunksClient(options);
  return { requestJudgment: client.judge, resumeJudgment: client.resume };
}
