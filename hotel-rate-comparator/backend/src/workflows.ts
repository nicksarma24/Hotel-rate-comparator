import { proxyActivities, CancellationScope, isCancellation, log } from '@temporalio/workflow';
import type * as activities from './activities';
import { Hotel, SearchInput, SearchResult } from './types';

// Activities get their own retry policy: transient failures (e.g. a supplier
// that fails twice before succeeding) are retried automatically by Temporal
// before the activity is considered failed.
const { fetchSupplierA, fetchSupplierB } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '500 milliseconds',
    backoffCoefficient: 2,
    maximumInterval: '2 seconds',
    maximumAttempts: 4,
  },
});

// Each supplier gets at most this long (including its own retries) before we
// give up on it and proceed with whatever result we do have.
const PER_SUPPLIER_TIMEOUT_MS = 5000;

interface SupplierOutcome {
  hotels: Hotel[] | null;
  error?: string;
}

async function fetchWithTimeout(fn: () => Promise<Hotel[]>, label: 'A' | 'B'): Promise<SupplierOutcome> {
  try {
    // CancellationScope.withTimeout races `fn` against a timer. If the timer
    // wins, the scope is cancelled, which propagates cancellation down into
    // the still-in-flight activity (Temporal requests activity cancellation
    // from the worker), and `fn` rejects with a CancelledFailure.
    const hotels = await CancellationScope.withTimeout(PER_SUPPLIER_TIMEOUT_MS, fn);
    return { hotels };
  } catch (err) {
    if (isCancellation(err)) {
      log.warn(`Supplier ${label} did not respond within ${PER_SUPPLIER_TIMEOUT_MS}ms; proceeding without it`);
      return { hotels: null, error: `Supplier ${label} timed out` };
    }
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`Supplier ${label} failed`, { error: message });
    return { hotels: null, error: `Supplier ${label} failed: ${message}` };
  }
}

/**
 * Fetches rates from both suppliers in parallel, tolerates individual
 * supplier failures/timeouts, and returns the single cheapest hotel found.
 *
 * - If both suppliers fail (or both time out) -> returns an error.
 * - If one supplier fails/times out and the other succeeds -> uses the
 *   surviving result.
 * - If both succeed but one (or both) returns no hotels -> uses whatever
 *   hotels are available; if there are none at all -> "No hotels found".
 * - On a tie, Supplier A wins deterministically (it's placed first in the
 *   combined list and `<` strict comparison keeps the first element on ties).
 * - If the workflow itself is cancelled (e.g. the user cancels mid-search),
 *   cancellation propagates to any in-flight activities and the workflow
 *   exits without producing a result.
 */
export async function searchHotelsWorkflow(input: SearchInput): Promise<SearchResult> {
  try {
    const [resultA, resultB] = await Promise.all([
      fetchWithTimeout(() => fetchSupplierA(input), 'A'),
      fetchWithTimeout(() => fetchSupplierB(input), 'B'),
    ]);

    if (resultA.hotels === null && resultB.hotels === null) {
      return {
        hotel: null,
        error: `Both suppliers failed. (${resultA.error}; ${resultB.error})`,
      };
    }

    // Supplier A's hotels go first so a price tie resolves to Supplier A.
    const combined: Hotel[] = [...(resultA.hotels ?? []), ...(resultB.hotels ?? [])];

    if (combined.length === 0) {
      return { hotel: null, error: 'No hotels found' };
    }

    const best = combined.reduce((cheapest, candidate) => (candidate.price < cheapest.price ? candidate : cheapest));
    return { hotel: best };
  } catch (err) {
    if (isCancellation(err)) {
      log.warn('searchHotelsWorkflow was cancelled; stopping gracefully');
    }
    // Re-throw so Temporal marks the workflow execution as Cancelled/Failed
    // appropriately rather than silently swallowing it.
    throw err;
  }
}
