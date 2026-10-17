import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runBenchmark } from './benchmark';
const output = resolve(process.argv[2] ?? '.data/spend-lab/successor');
if (existsSync(output)) throw new Error('fresh_output_directory_required');
runBenchmark(output)
  .then((metrics) =>
    console.log(
      JSON.stringify({
        output,
        status: metrics.status,
        unique_tasks: metrics.unique_tasks,
        paired_net_difference_units: metrics.paired_net_difference_units,
        economic_usefulness: metrics.economic_usefulness,
      }),
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
