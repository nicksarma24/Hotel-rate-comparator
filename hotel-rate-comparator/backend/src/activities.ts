import axios from 'axios';
import { Context } from '@temporalio/activity';
import { Hotel, SearchInput } from './types';

const SUPPLIER_BASE_URL = process.env.SUPPLIER_BASE_URL || 'http://localhost:4001';

/**
 * Returns the current activity's cancellation signal when running as a real
 * Temporal activity (via the worker), or `undefined` when called directly
 * (e.g. from unit tests) where there is no activity execution context.
 */
function getCancellationSignal(): AbortSignal | undefined {
  try {
    return Context.current().cancellationSignal;
  } catch {
    return undefined;
  }
}

async function fetchFromSupplier(path: string, input: SearchInput, scenario?: string): Promise<Hotel[]> {
  const { data } = await axios.get(`${SUPPLIER_BASE_URL}${path}`, {
    params: {
      city: input.city,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      scenario,
    },
    // Client-side HTTP timeout. This is intentionally shorter than the
    // workflow's per-supplier CancellationScope timeout (5s) so a genuinely
    // hanging supplier surfaces as an activity failure that Temporal can retry,
    // rather than hanging the underlying socket indefinitely.
    timeout: 8000,
    // When the workflow's CancellationScope.withTimeout fires (or the
    // workflow itself is cancelled), Temporal notifies the in-flight
    // activity via this signal. Wiring it into axios means a "cancelled"
    // slow supplier call is genuinely aborted on the worker, not just
    // abandoned by the workflow while it keeps running in the background.
    signal: getCancellationSignal(),
  });
  return data.hotels;
}

/**
 * Fetches hotel rates from Supplier A. Thin, side-effect-free wrapper around
 * an HTTP call so it can run as a Temporal activity (and be retried/mocked).
 */
export async function fetchSupplierA(input: SearchInput): Promise<Hotel[]> {
  return fetchFromSupplier('/supplierA/hotels', input, input.supplierAScenario);
}

/**
 * Fetches hotel rates from Supplier B.
 */
export async function fetchSupplierB(input: SearchInput): Promise<Hotel[]> {
  return fetchFromSupplier('/supplierB/hotels', input, input.supplierBScenario);
}
