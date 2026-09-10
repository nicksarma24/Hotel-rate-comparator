import { useState, FormEvent, CSSProperties } from 'react';
import { searchHotels, Hotel } from './api';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function App() {
  const [city, setCity] = useState('Paris');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (checkOut <= checkIn) {
      setStatus('error');
      setErrorMsg('Check-out date must be after check-in date.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');
    setHotel(null);

    try {
      const result = await searchHotels({ city, checkIn, checkOut });
      setHotel(result.hotel);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error occurred.');
      setStatus('error');
    }
  }

  return (
    <main style={styles.page}>
      <h1>Hotel Rate Comparator</h1>
      <p style={styles.subtitle}>Searches two suppliers in parallel and returns the cheapest rate.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          City
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            style={styles.input}
            placeholder="e.g. Paris"
          />
        </label>
        <label style={styles.label}>
          Check-in date
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Check-out date
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
            style={styles.input}
          />
        </label>
        <button type="submit" disabled={status === 'loading'} style={styles.button}>
          {status === 'loading' ? 'Searching…' : 'Search hotels'}
        </button>
      </form>

      {status === 'loading' && (
        <p style={styles.loading} role="status">
          Comparing rates across suppliers…
        </p>
      )}

      {status === 'error' && (
        <p style={styles.error} role="alert">
          ⚠ {errorMsg}
        </p>
      )}

      {status === 'success' && hotel && (
        <section style={styles.card}>
          <h2 style={{ margin: '0 0 8px' }}>{hotel.name}</h2>
          <p style={{ margin: '4px 0' }}>
            Price: <strong>${hotel.price.toFixed(2)}</strong>
          </p>
          <p style={{ margin: '4px 0', color: '#666' }}>Supplier: {hotel.supplier}</p>
        </section>
      )}

      {status === 'success' && !hotel && <p style={styles.loading}>No hotels found for this search.</p>}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 480, margin: '48px auto', fontFamily: 'system-ui, sans-serif', padding: '0 16px' },
  subtitle: { color: '#666', marginTop: -8, marginBottom: 24 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, fontWeight: 600 },
  input: { padding: 10, fontSize: 14, borderRadius: 6, border: '1px solid #ccc' },
  button: {
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    background: '#111827',
    color: '#fff',
    cursor: 'pointer',
  },
  loading: { marginTop: 20, color: '#444' },
  error: { marginTop: 20, color: '#b91c1c', fontWeight: 600 },
  card: { marginTop: 24, padding: 20, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fafafa' },
};
