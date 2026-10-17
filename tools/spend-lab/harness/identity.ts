import { generateKeyPairSync } from "node:crypto";
import { createJudgmentIssuer } from "../../../src/security/judgmentIssuer";
import { createExecutionAuthorizationIssuer } from "../../../src/security/executionAuthorization";
import type { LabDatabase } from "./storage";
export function labIdentity(db: LabDatabase, role: "judgment" | "execution") {
  const id = "lab-key-" + role;
  let row = db.db.prepare("SELECT body FROM metadata WHERE id=?").get(id);
  if (!row) {
    const pair = generateKeyPairSync("ed25519");
    const config = {
      issuer: "spend-lab/" + role,
      activeKeyId: id,
      privateKeyPem: pair.privateKey
        .export({ type: "pkcs8", format: "pem" })
        .toString(),
      keys: [
        {
          key_id: id,
          public_key_pem: pair.publicKey
            .export({ type: "spki", format: "pem" })
            .toString(),
          valid_from: "2026-01-01T00:00:00Z",
          valid_until: null,
          revoked: false,
        },
      ],
    };
    db.db
      .prepare("INSERT INTO metadata VALUES(?,?)")
      .run(id, JSON.stringify(config));
    row = db.db.prepare("SELECT body FROM metadata WHERE id=?").get(id);
  }
  return JSON.parse(row!.body as string) as Parameters<
    typeof createJudgmentIssuer
  >[0];
}
export function labIssuers(db: LabDatabase) {
  return {
    judgmentIssuer: createJudgmentIssuer({
      ...labIdentity(db, "judgment"),
      requireSigned: true,
    }),
    authorizationIssuer: createExecutionAuthorizationIssuer(
      labIdentity(db, "execution"),
    ),
  };
}
