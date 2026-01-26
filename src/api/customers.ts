import { API_BASE_URL } from './client';
import type { Customer, StampResponse } from '@/types/api';

export async function getCustomer(customerId: string): Promise<Customer> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Customer not found');
    }
    throw new Error('Failed to fetch customer');
  }

  return response.json();
}

export async function addStamp(customerId: string): Promise<StampResponse> {
  const response = await fetch(`${API_BASE_URL}/stamps/${customerId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Customer not found');
    }
    throw new Error('Failed to add stamp');
  }

  return response.json();
}
