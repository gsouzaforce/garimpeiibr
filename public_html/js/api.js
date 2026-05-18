const WEBHOOK = 'https://n8n.gmlab.cloud/webhook/products';

async function fetchProducts() {
  const res = await fetch(WEBHOOK);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.products || []);
}
