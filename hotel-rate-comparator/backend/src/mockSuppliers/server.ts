import express from 'express';
import { Hotel, SupplierScenario } from '../types';

const app = express();

const HOTEL_NAMES = ['Grand Palace', 'Sunset Inn', 'Ocean View Resort', 'City Central Hotel', 'Harbor Lights'];

function slugify(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-');
}

function generateHotels(city: string, supplier: 'A' | 'B', count = 3): Hotel[] {
  return Array.from({ length: count }, (_, i) => {
    const nameIndex = (i + (supplier === 'A' ? 0 : 2)) % HOTEL_NAMES.length;
    const basePrice = 80 + Math.random() * 220 + (supplier === 'B' ? -10 : 0);
    return {
      hotelId: `${supplier}-${slugify(city)}-${i + 1}`,
      name: `${HOTEL_NAMES[nameIndex]} ${city}`,
      price: Math.round(basePrice * 100) / 100,
      supplier,
    };
  });
}

// Tracks attempt counts per (supplier, city) so the "flaky" scenario can fail
// N times before succeeding, simulating transient supplier errors.
const attemptCounts = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleRequest(
  supplier: 'A' | 'B',
  city: string,
  scenario: SupplierScenario = 'normal'
): Promise<{ status: number; body: unknown }> {
  switch (scenario) {
    case 'delay':
      // A slow-but-eventually-successful response.
      await sleep(3000);
      return { status: 200, body: { hotels: generateHotels(city, supplier) } };

    case 'timeout':
      // Simulates a supplier that effectively hangs. The activity's HTTP
      // client timeout (8s) and the workflow's per-supplier cancellation
      // timeout (5s) will both fire well before this resolves.
      await sleep(60000);
      return { status: 200, body: { hotels: generateHotels(city, supplier) } };

    case 'empty':
      return { status: 200, body: { hotels: [] } };

    case 'error':
      return { status: 500, body: { error: `Supplier ${supplier} internal error` } };

    case 'flaky': {
      const key = `${supplier}:${city}`;
      const attempts = (attemptCounts.get(key) ?? 0) + 1;
      attemptCounts.set(key, attempts);
      if (attempts <= 2) {
        return { status: 500, body: { error: `Supplier ${supplier} transient error (attempt ${attempts})` } };
      }
      return { status: 200, body: { hotels: generateHotels(city, supplier) } };
    }

    case 'normal':
    default:
      await sleep(200 + Math.random() * 400);
      return { status: 200, body: { hotels: generateHotels(city, supplier) } };
  }
}

app.get('/supplierA/hotels', async (req, res) => {
  const { city = 'Unknown', scenario } = req.query as { city?: string; scenario?: SupplierScenario };
  const { status, body } = await handleRequest('A', city, scenario);
  res.status(status).json(body);
});

app.get('/supplierB/hotels', async (req, res) => {
  const { city = 'Unknown', scenario } = req.query as { city?: string; scenario?: SupplierScenario };
  const { status, body } = await handleRequest('B', city, scenario);
  res.status(status).json(body);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.MOCK_SUPPLIER_PORT || 4001;
app.listen(PORT, () =>
  console.log(`Mock supplier server listening on http://localhost:${PORT} (/supplierA/hotels, /supplierB/hotels)`)
);

export default app;
