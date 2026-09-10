export interface Hotel {
  hotelId: string;
  name: string;
  price: number;
  supplier: 'A' | 'B';
}

export interface SearchResponse {
  hotel: Hotel | null;
  error?: string;
  workflowId?: string;
}

export interface SearchInput {
  city: string;
  checkIn: string;
  checkOut: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function searchHotels(input: SearchInput): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/api/search-hotels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = (await res.json()) as SearchResponse;

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong while searching for hotels.');
  }

  return data;
}

export async function cancelSearch(workflowId: string): Promise<void> {
  await fetch(`${API_BASE}/api/search-hotels/${workflowId}/cancel`, { method: 'POST' });
}
