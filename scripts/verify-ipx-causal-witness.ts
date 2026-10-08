import { readFileSync } from 'node:fs';
import { verifyCausalWitnessOffline } from '../src/services/causalWitnessOfflineVerifier';
const path = process.argv[2];
if (!path) { process.stderr.write('usage: tsx scripts/verify-ipx-causal-witness.ts <witness.json>\n'); process.exit(2); }
const result = await verifyCausalWitnessOffline(JSON.parse(readFileSync(path, 'utf8')));
process.stdout.write(JSON.stringify(result) + '\n');
if (!result.valid) process.exitCode = 1;
