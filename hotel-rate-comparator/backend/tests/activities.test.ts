import nock from 'nock';
import { fetchSupplierA, fetchSupplierB } from '../src/activities';

const BASE_URL = 'http://localhost:4001';
const INPUT = { city: 'Paris', checkIn: '2026-10-01', checkOut: '2026-10-05' };

describe('supplier activities', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('fetchSupplierA returns the parsed hotel list on success', async () => {
    nock(BASE_URL)
      .get('/supplierA/hotels')
      .query(true)
      .reply(200, { hotels: [{ hotelId: 'a1', name: 'Test Hotel', price: 120, supplier: 'A' }] });

    const hotels = await fetchSupplierA(INPUT);
    expect(hotels).toHaveLength(1);
    expect(hotels[0]).toMatchObject({ hotelId: 'a1', name: 'Test Hotel', price: 120, supplier: 'A' });
  });

  it('fetchSupplierB returns an empty array when the supplier has no inventory', async () => {
    nock(BASE_URL).get('/supplierB/hotels').query(true).reply(200, { hotels: [] });

    const hotels = await fetchSupplierB(INPUT);
    expect(hotels).toEqual([]);
  });

  it('fetchSupplierA throws when the supplier returns a 500', async () => {
    nock(BASE_URL).get('/supplierA/hotels').query(true).reply(500, { error: 'boom' });

    await expect(fetchSupplierA(INPUT)).rejects.toThrow();
  });

  it('fetchSupplierB throws on request timeout', async () => {
    nock(BASE_URL).get('/supplierB/hotels').query(true).delay(9000).reply(200, { hotels: [] });

    await expect(fetchSupplierB(INPUT)).rejects.toThrow();
  }, 15000);
});
