// Acts like an AI shopping agent: pays per call to browse, then buys one item.
// Usage: BUYER_PRIVATE_KEY=0x... API_URL=http://localhost:4021 npm run test:agent
// The buyer wallet needs test USDC on Base Sepolia: https://faucet.circle.com
import 'dotenv/config';
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const API = (process.env.API_URL || 'http://localhost:4021').replace(/\/$/, '');
const key = process.env.BUYER_PRIVATE_KEY;
if (!key) {
  console.error('Set BUYER_PRIVATE_KEY to a TEST wallet key that holds Base Sepolia USDC.');
  process.exit(1);
}

const account = privateKeyToAccount(key);
// x402 clients cap each payment at $1 by default; a clothing order needs a higher cap.
const client = x402Client.fromConfig({
  schemes: [{ network: 'eip155:*', client: new ExactEvmScheme(account) }],
  spendControls: { maxAmountPerPayment: process.env.MAX_SPEND_USD ? `$${process.env.MAX_SPEND_USD}` : '$500' }
});
const payFetch = wrapFetchWithPayment(fetch, client);

function receipt(res) {
  const header = res.headers.get('PAYMENT-RESPONSE');
  return header ? decodePaymentResponseHeader(header) : null;
}

console.log(`Agent wallet ${account.address}\n`);

// 1. Browse (pay per call)
const catalogRes = await payFetch(`${API}/api/catalog`);
if (!catalogRes.ok) throw new Error(`Catalogue failed: ${catalogRes.status} ${await catalogRes.text()}`);
const catalog = await catalogRes.json();
console.log(`Catalogue: ${catalog.products.length} products. Paid tx: ${receipt(catalogRes)?.transaction || 'free'}`);

// 2. Pick the cheapest available item and get a free quote
const pick = catalog.products.filter(p => p.availability === 'in_stock').sort((a, b) => a.priceNGN - b.priceNGN)[0];
const order = {
  items: [{ id: pick.id, size: pick.sizes[Math.floor(pick.sizes.length / 2)], color: pick.colors[0], qty: 1 }],
  shipping: 'standard',
  customer: { name: 'Test Agent', email: 'agent@example.com', phone: '+2348000000000', address: '1 Test Street', city: 'Lagos', state: 'Lagos' }
};
const quote = await (await fetch(`${API}/api/orders/quote`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
})).json();
console.log(`Quote for ${pick.name}: ${quote.totalNGN} NGN = ${quote.totalUSDC} USDC`);

// 3. Buy (x402 pays the order total)
const buyRes = await payFetch(`${API}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
});
const result = await buyRes.json().catch(() => ({}));
if (!buyRes.ok) throw new Error(`Order failed: ${buyRes.status} ${JSON.stringify(result)}`);
console.log(`Order ${result.orderId} ${result.status}. Tx: ${receipt(buyRes)?.transaction}`);
