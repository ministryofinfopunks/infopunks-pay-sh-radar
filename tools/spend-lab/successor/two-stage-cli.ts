import { resolve } from 'node:path';
import { runTwoStageExperiment } from './two-stage';
runTwoStageExperiment(resolve(process.argv[2] ?? '.data/first-spender/two-stage'))
  .then((summary) => console.log(JSON.stringify(summary)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
