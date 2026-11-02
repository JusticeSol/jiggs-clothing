// JIGGS store API.
//  - GET  /api/catalog, /api/catalog/:id  -> x402 pay-per-call (tiny USDC fee per request)
//  - POST /api/orders/quote                -> free price check
//  - POST /api/orders                      -> x402 payment of the order total in USDC
// Shoppers on the website pay through the same /api/orders endpoint with their browser wallet.
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { CONFIG, CATEGORIES, PRODUCTS, findProduct, publicProduct, quoteOrder } from './catalog.js';

// ---------- Settings ----------
const env = process.env;
const PORT = Number(env.PORT || 4021);
const NETWORK = env.NETWORK || 'eip155:84532';
const PAY_TO = env.PAY_TO_ADDRESS;
const NGN_PER_USD = Number(env.NGN_PER_USD || 1500);
const CATALOG_PRICE_USD = Number(env.CATALOG_PRICE_USD ?? 0.001);
const SITE_URL = (env.SITE_URL || 'https://justicesol.github.io/jiggs-clothing').replace(/\/$/, '');
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const IS_TESTNET = NETWORK === 'eip155:84532';

if (!/^0x[0-9a-fA-F]{40}$/.test(PAY_TO || '') || /^0x0{40}$/.test(PAY_TO)) {
  console.error('PAY_TO_ADDRESS must be set to the wallet that should receive USDC (see .env.example).');
  process.exit(1);
}
if (!(NGN_PER_USD > 0)) {
  console.error('NGN_PER_USD must be a positive number.');
  process.exit(1);
}

async function createFacilitator() {
  if (env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET) {
    const { createFacilitatorConfig } = await import('@coinbase/x402');
    return new HTTPFacilitatorClient(createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET));
  }
  if (!IS_TESTNET) {
    console.warn('Mainnet without CDP keys: make sure FACILITATOR_URL supports', NETWORK);
  }
  return new HTTPFacilitatorClient({ url: env.FACILITATOR_URL || 'https://x402.org/facilitator' });
}

// ---------- Orders ----------
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const ordersFile = path.join(dataDir, 'orders.json');

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ordersFile, 'utf8')); } catch { return []; }
}
function saveOrder(order) {
  fs.mkdirSync(dataDir, { recursive: true });
  const orders = readOrders();
  orders.push(order);
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

// Orders wait here between "payment verified" and "payment settled on-chain".
// Only settled orders are written to disk.
const pendingOrders = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000;
const paymentKey = paymentPayload => paymentPayload?.payload?.signature;

function decodePaymentHeader(req) {
  const header = req.get('payment-signature') || req.get('x-payment');
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf8')); } catch { return null; }
}

// ---------- x402 ----------
const resourceServer = new x402ResourceServer(await createFacilitator())
  .register(NETWORK, new ExactEvmScheme())
  .onAfterSettle(async ({ paymentPayload, result }) => {
    const key = paymentKey(paymentPayload);
    const pending = key && pendingOrders.get(key);
    if (!pending) return;
    pendingOrders.delete(key);
    saveOrder({
      ...pending,
      status: 'paid',
      paidAt: new Date().toISOString(),
      payment: { network: result.network, transaction: result.transaction, payer: result.payer }
    });
    console.log(`Order ${pending.id} paid: ${pending.totalUSDC} USDC, tx ${result.transaction}`);
  })
  .onVerifiedPaymentCanceled(async ({ paymentPayload }) => {
    pendingOrders.delete(paymentKey(paymentPayload));
  });

const usd = amount => `$${amount.toFixed(amount < 0.01 ? 4 : 2)}`;
const paymentOption = price => ({ scheme: 'exact', network: NETWORK, payTo: PAY_TO, price, maxTimeoutSeconds: 300 });

const routes = {
  'POST /api/orders': {
    accepts: paymentOption(ctx => usd(quoteOrder(ctx.adapter.getBody(), { ngnPerUsd: NGN_PER_USD }).totalUSDC)),
    description: `${CONFIG.brand} order: pay the order total in USDC`,
    mimeType: 'application/json',
    unpaidResponseBody: ctx => ({
      contentType: 'application/json',
      body: { message: 'Payment required to place this order.', quote: quoteOrder(ctx.adapter.getBody(), { ngnPerUsd: NGN_PER_USD }) }
    })
  }
};
if (CATALOG_PRICE_USD > 0) {
  const catalogRoute = description => ({
    accepts: paymentOption(usd(CATALOG_PRICE_USD)),
    description,
    mimeType: 'application/json'
  });
  routes['GET /api/catalog'] = catalogRoute(`${CONFIG.brand} full product catalogue (pay per call)`);
  routes['GET /api/catalog/:id'] = catalogRoute(`${CONFIG.brand} product details (pay per call)`);
}
const x402 = paymentMiddleware(routes, resourceServer);

// ---------- App ----------
const app = express();
app.set('trust proxy', true);
app.use(cors({
  origin: ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS,
  allowedHeaders: ['Content-Type', 'Authorization', 'PAYMENT-SIGNATURE', 'X-PAYMENT', 'X-Order-Channel'],
  exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'X-PAYMENT-RESPONSE']
}));
app.use(express.json({ limit: '20kb' }));

// Validate order bodies before x402 prices them, so bad requests get a clear 400.
function validateOrder(requireCustomer) {
  return (req, res, next) => {
    try {
      const quote = quoteOrder(req.body, { ngnPerUsd: NGN_PER_USD });
      if (requireCustomer && !req.body.customer) throw Object.assign(new Error('customer is required to place an order.'), { status: 400 });
      res.locals.quote = quote;
      next();
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}

app.get(['/', '/api'], (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    name: `${CONFIG.brand} store API`,
    description: 'Browse the catalogue and buy clothing. Payments use the x402 protocol (HTTP 402) in USDC.',
    website: SITE_URL,
    payment: { protocol: 'x402', version: 2, scheme: 'exact', asset: 'USDC', network: NETWORK, testnet: IS_TESTNET, payTo: PAY_TO },
    currency: { prices: 'NGN', settlement: 'USDC', ngnPerUsd: NGN_PER_USD },
    endpoints: [
      { method: 'GET', path: '/api/catalog', price: CATALOG_PRICE_USD > 0 ? usd(CATALOG_PRICE_USD) : 'free', description: 'All products with sizes, colours and prices' },
      { method: 'GET', path: '/api/catalog/:id', price: CATALOG_PRICE_USD > 0 ? usd(CATALOG_PRICE_USD) : 'free', description: 'One product' },
      { method: 'POST', path: '/api/orders/quote', price: 'free', description: 'Price an order. Body: { items: [{ id, size, color, qty }], shipping: "standard" | "express" }' },
      { method: 'POST', path: '/api/orders', price: 'order total in USDC', description: 'Place and pay for an order. Same body as quote, plus customer: { name, email, phone, address, city, state }' }
    ],
    example: `${base}/api/orders/quote`
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, network: NETWORK }));

app.get('/api/catalog', x402, (req, res) => {
  res.json({
    brand: CONFIG.brand,
    categories: CATEGORIES,
    shipping: CONFIG.shipping,
    freeShippingThresholdNGN: CONFIG.freeShippingThreshold,
    products: PRODUCTS.map(p => publicProduct(p, { ngnPerUsd: NGN_PER_USD, siteUrl: SITE_URL }))
  });
});

app.get('/api/catalog/:id', x402, (req, res) => {
  const product = findProduct(req.params.id);
  // A 4xx here cancels the x402 payment, so unknown ids are never charged.
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(publicProduct(product, { ngnPerUsd: NGN_PER_USD, siteUrl: SITE_URL }));
});

app.post('/api/orders/quote', validateOrder(false), (req, res) => res.json(res.locals.quote));

app.post('/api/orders', validateOrder(true), x402, (req, res) => {
  const paymentPayload = decodePaymentHeader(req);
  const key = paymentKey(paymentPayload);
  if (!key) return res.status(400).json({ error: 'Unsupported payment payload.' });

  const { quote } = res.locals;
  const order = {
    id: 'JG-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    createdAt: new Date().toISOString(),
    channel: req.get('x-order-channel') === 'web' ? 'web' : 'agent',
    customer: req.body.customer,
    notes: typeof req.body.notes === 'string' ? req.body.notes.slice(0, 500) : undefined,
    ...quote
  };
  pendingOrders.set(key, order);
  setTimeout(() => pendingOrders.delete(key), PENDING_TTL_MS).unref();

  // This body is only delivered once the payment has settled on-chain.
  res.status(201).json({ orderId: order.id, status: 'paid', totalNGN: order.totalNGN, totalUSDC: order.totalUSDC, lines: order.lines });
});

app.get('/api/admin/orders', (req, res) => {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = env.ADMIN_TOKEN || '';
  const ok = expected.length >= 16 && token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  res.json(readOrders());
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`${CONFIG.brand} API on http://localhost:${PORT}`);
  console.log(`Network ${NETWORK}${IS_TESTNET ? ' (testnet)' : ''}, paying to ${PAY_TO}`);
  console.log(`Catalogue: ${CATALOG_PRICE_USD > 0 ? usd(CATALOG_PRICE_USD) + ' per call' : 'free'}; ${PRODUCTS.length} products loaded`);
});
