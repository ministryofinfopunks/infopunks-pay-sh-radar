import { resolve } from "node:path";
import { runValueQualification } from "./runner";
runValueQualification(
  resolve(process.argv[2] ?? ".data/first-spender-value-r2/evaluation"),
)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
