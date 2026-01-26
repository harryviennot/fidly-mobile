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
