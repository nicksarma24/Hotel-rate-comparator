export type SupplierScenario = 'normal' | 'delay' | 'timeout' | 'empty' | 'error' | 'flaky';

export interface SearchInput {
  city: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  /**
   * Optional, for testing/demo purposes only. Lets the caller force a mock
   * supplier into a specific behavior (delay, timeout, empty, error, flaky).
   * The frontend form never sets these; they're driven from curl/tests.
   */
  supplierAScenario?: SupplierScenario;
  supplierBScenario?: SupplierScenario;
}

export interface Hotel {
  hotelId: string;
  name: string;
  price: number;
  supplier: 'A' | 'B';
}

export interface SearchResult {
  hotel: Hotel | null;
  error?: string;
}
