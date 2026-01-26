// Update this URL when using ngrok or production
const API_BASE_URL = 'http://192.168.1.122:8000';

export interface Customer {
  id: string;
  name: string;
  email: string;
  stamps: number;
  pass_url?: string;
}

export interface StampResponse {
  customer_id: string;
  name: string;
  stamps: number;
  message: string;
}

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

// Helper to configure API URL at runtime
export function setApiBaseUrl(url: string) {
  // In a real app, you'd use a proper config or env variable
  console.log(`API URL would be set to: ${url}`);
}
