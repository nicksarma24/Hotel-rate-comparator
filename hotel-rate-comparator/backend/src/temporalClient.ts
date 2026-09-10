import { Connection, WorkflowClient } from '@temporalio/client';

let clientPromise: Promise<WorkflowClient> | null = null;

/**
 * Lazily creates (and caches) a single WorkflowClient for the life of the
 * API process, so we don't open a new Temporal connection per request.
 */
export function getTemporalClient(): Promise<WorkflowClient> {
  if (!clientPromise) {
    clientPromise = Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    }).then(
      (connection) =>
        new WorkflowClient({
          connection,
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        })
    );
  }
  return clientPromise;
}
