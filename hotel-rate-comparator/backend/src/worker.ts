import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';

export const TASK_QUEUE = 'hotel-search';

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`Worker started. Polling task queue "${TASK_QUEUE}"...`);
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
