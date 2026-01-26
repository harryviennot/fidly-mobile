// Update this URL when using ngrok or production
export const API_BASE_URL = 'http://192.168.1.122:8000';

// Helper to configure API URL at runtime
export function setApiBaseUrl(url: string) {
  // In a real app, you'd use a proper config or env variable
  console.log(`API URL would be set to: ${url}`);
}
