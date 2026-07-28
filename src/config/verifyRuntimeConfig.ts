import { verifyRuntimeConfiguration } from './env';

const result = verifyRuntimeConfiguration();
console.log(JSON.stringify(result));
process.exitCode = result.status === 'invalid' ? 1 : 0;
