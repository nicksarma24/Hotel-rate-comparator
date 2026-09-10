import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { searchHotelsWorkflow } from '../src/workflows';
import type * as activities from '../src/activities';
import { Hotel, SearchInput } from '../src/types';

const DEFAULT_INPUT: SearchInput = { city: 'Paris', checkIn: '2026-10-01', checkOut: '2026-10-05' };

const hotelA: Hotel = { hotelId: 'a1', name: 'Hotel A', price: 120, supplier: 'A' };
const hotelB: Hotel = { hotelId: 'b1', name: 'Hotel B', price: 110, supplier: 'B' };

describe('searchHotelsWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    // Time-skipping environment: activities that `sleep` for e.g. 10s in
    // real time resolve almost instantly in test time, so timeout/slow
    // scenarios don't make the test suite slow.
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 30000);

  afterAll(async () => {
    await testEnv?.teardown();
  });

  async function runWorkflow(mockActivities: Partial<typeof activities>, input: SearchInput = DEFAULT_INPUT) {
    const taskQueue = `test-${Math.random().toString(36).slice(2)}`;
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../src/workflows'),
      activities: mockActivities,
    });

    return worker.runUntil(
      testEnv.client.workflow.execute(searchHotelsWorkflow, {
        workflowId: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        taskQueue,
        args: [input],
      })
    );
  }

  // --- Basic scenarios -----------------------------------------------------

  it('returns Supplier A result when A is cheaper', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => [{ ...hotelA, price: 50 }],
      fetchSupplierB: async () => [hotelB],
    });
    expect(result.hotel?.supplier).toBe('A');
    expect(result.hotel?.price).toBe(50);
  });

  it('returns Supplier B result when B is cheaper', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => [hotelA],
      fetchSupplierB: async () => [{ ...hotelB, price: 50 }],
    });
    expect(result.hotel?.supplier).toBe('B');
    expect(result.hotel?.price).toBe(50);
  });

  it('picks Supplier A deterministically when both return the same rate', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => [{ ...hotelA, price: 100 }],
      fetchSupplierB: async () => [{ ...hotelB, price: 100 }],
    });
    expect(result.hotel?.supplier).toBe('A');
    expect(result.hotel?.price).toBe(100);
  });

  it('returns B\'s result when A fails and B succeeds', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        throw new Error('supplier A is down');
      },
      fetchSupplierB: async () => [hotelB],
    });
    expect(result.hotel?.supplier).toBe('B');
    expect(result.error).toBeUndefined();
  });

  it('returns an error when both suppliers fail', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        throw new Error('supplier A is down');
      },
      fetchSupplierB: async () => {
        throw new Error('supplier B is down');
      },
    });
    expect(result.hotel).toBeNull();
    expect(result.error).toMatch(/Both suppliers failed/);
  });

  it('uses the available result when one supplier returns an empty list', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => [],
      fetchSupplierB: async () => [hotelB],
    });
    expect(result.hotel?.supplier).toBe('B');
  });

  it('returns "No hotels found" when both suppliers return empty', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => [],
      fetchSupplierB: async () => [],
    });
    expect(result.hotel).toBeNull();
    expect(result.error).toBe('No hotels found');
  });

  // --- Advanced scenarios ---------------------------------------------------

  it('cancels a slow (>5s) supplier and proceeds with the other result', async () => {
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20000)); // >> 5s timeout
        return [hotelA];
      },
      fetchSupplierB: async () => [hotelB],
    });
    expect(result.hotel?.supplier).toBe('B');
  }, 30000);

  it('succeeds if Supplier A fails twice before succeeding (within retry policy)', async () => {
    let attempts = 0;
    const result = await runWorkflow({
      fetchSupplierA: async () => {
        attempts += 1;
        if (attempts <= 2) {
          throw new Error('transient failure');
        }
        return [{ ...hotelA, price: 40 }];
      },
      fetchSupplierB: async () => [hotelB],
    });
    expect(attempts).toBe(3);
    expect(result.hotel?.supplier).toBe('A');
    expect(result.hotel?.price).toBe(40);
  }, 30000);

  it('stops gracefully when the workflow is cancelled mid-way', async () => {
    const taskQueue = `test-cancel-${Math.random().toString(36).slice(2)}`;
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('../src/workflows'),
      activities: {
        fetchSupplierA: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30000));
          return [hotelA];
        },
        fetchSupplierB: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30000));
          return [hotelB];
        },
      },
    });

    await worker.runUntil(async () => {
      const handle = await testEnv.client.workflow.start(searchHotelsWorkflow, {
        workflowId: `cancel-test-${Date.now()}`,
        taskQueue,
        args: [DEFAULT_INPUT],
      });

      // Give the workflow a moment to actually start its activities before
      // cancelling, so this genuinely exercises mid-flight cancellation.
      await new Promise((resolve) => setTimeout(resolve, 50));
      await handle.cancel();

      await expect(handle.result()).rejects.toThrow();
    });
  }, 30000);
});
