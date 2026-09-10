import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { getTemporalClient } from './temporalClient';
import { TASK_QUEUE } from './worker';
import type { searchHotelsWorkflow } from './workflows';
import { SearchInput } from './types';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/search-hotels', async (req, res) => {
  const { city, checkIn, checkOut, supplierAScenario, supplierBScenario } = (req.body ?? {}) as Partial<SearchInput>;

  if (!city || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'city, checkIn and checkOut are all required' });
  }

  const workflowId = `search-hotels-${randomUUID()}`;

  try {
    const client = await getTemporalClient();

    // Started by workflow *type name* (string) rather than importing the
    // function value directly, so this file never pulls in workflow-sandbox
    // code (@temporalio/workflow) at the API-process level. `typeof
    // searchHotelsWorkflow` is imported as a type only, giving us compile-time
    // safety for the args/return type without any runtime import.
    const handle = await client.start<typeof searchHotelsWorkflow>('searchHotelsWorkflow', {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [{ city, checkIn, checkOut, supplierAScenario, supplierBScenario }],
    });

    const result = await handle.result();

    if (!result.hotel) {
      const status = result.error === 'No hotels found' ? 404 : 502;
      return res.status(status).json({ error: result.error ?? 'No hotels found', workflowId });
    }

    return res.json({ hotel: result.hotel, workflowId });
  } catch (err) {
    console.error('search-hotels failed', err);
    return res.status(500).json({
      error: 'Internal error while searching for hotels. Please try again.',
      workflowId,
    });
  }
});

// Lets a client cancel an in-flight search (e.g. user navigates away or hits
// a "cancel" button). The workflow's CancellationScope handling ensures it
// stops gracefully rather than leaving orphaned activity calls.
app.post('/api/search-hotels/:workflowId/cancel', async (req, res) => {
  try {
    const client = await getTemporalClient();
    const handle = client.getHandle(req.params.workflowId);
    await handle.cancel();
    return res.json({ status: 'cancel-requested' });
  } catch (err) {
    console.error('cancel failed', err);
    return res.status(500).json({ error: 'Failed to cancel search' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
