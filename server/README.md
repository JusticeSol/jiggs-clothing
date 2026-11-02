# JIGGS API — x402 + USDC payments

A small Node.js server that lets **AI agents** and **shoppers** pay in USDC using the
[x402 protocol](https://x402.org) (HTTP 402 "Payment Required").

| Endpoint | Price | What it does |
|---|---|---|
| `GET /api` | free | Describes the API, prices and payment details (start here, agents) |
| `GET /api/catalog` | pay per call (default $0.001) | All products with sizes, colours, NGN + USDC prices |
| `GET /api/catalog/:id` | pay per call | One product |
| `POST /api/orders/quote` | free | Price an order |
| `POST /api/orders` | order total in USDC | Place and pay for an order |
| `GET /api/admin/orders` | `Authorization: Bearer <ADMIN_TOKEN>` | Paid orders, for the shop owner |

The product list comes straight from the website's `js/products.js` and `js/config.js`,
so prices and stock only need editing in one place.

## Run it locally

```bash
cd server
npm install
cp .env.example .env      # then set PAY_TO_ADDRESS (and ADMIN_TOKEN)
npm start                  # http://localhost:4021
```

Open `checkout.html` from this folder in a browser, and "USDC stablecoin" appears as a payment
option (it talks to the local server automatically).

## Test money first

The default network is **Base Sepolia** (test network, fake USDC):

1. Install MetaMask or Coinbase Wallet and create a test wallet.
2. Get free test USDC at https://faucet.circle.com (choose Base Sepolia).
3. Pay at checkout, or run the agent demo:
   `BUYER_PRIVATE_KEY=0x... npm run test:agent` (use a *test* wallet key only).

## Going live (real USDC)

1. Create a free account at https://portal.cdp.coinbase.com and make an API key.
2. In `.env`: `NETWORK=eip155:8453`, `CDP_API_KEY_ID=...`, `CDP_API_KEY_SECRET=...`,
   and `PAY_TO_ADDRESS` = the wallet that should receive real USDC (ideally a hardware wallet).
3. Host the server (Render, Railway, Fly.io, a VPS…) with HTTPS, and set
   `ALLOWED_ORIGINS` to the shop's domain.
4. On the website, set `apiBaseUrl` in `js/config.js` to the hosted server's address.

Coinbase's facilitator is free for the first 1,000 payments a month, then $0.001 each.

## How a payment works

1. Client calls an endpoint without paying → `402` with a `PAYMENT-REQUIRED` header
   (amount, USDC contract, network, receiving wallet).
2. Client signs a USDC transfer authorization (EIP-3009; the buyer pays no gas) and retries with a
   `PAYMENT-SIGNATURE` header.
3. The server checks the order, the facilitator settles the transfer on-chain, and only then is the
   response released (with a `PAYMENT-RESPONSE` receipt header). Failed requests are never charged.

## Notes for agent builders

- Standard x402 clients (`@x402/fetch`, `@x402/axios`) cap payments at $1 by default; raise
  `spendControls.maxAmountPerPayment` to buy clothes (see `scripts/agent-demo.js`).
- Orders need `customer: { name, email, phone, address, city, state }` for delivery.

## Current limits

- Paid orders are stored in `data/orders.json`. Next step: create them in Shopify via the Admin API.
- Prices are converted from NGN using the fixed `NGN_PER_USD` rate in `.env` — update it as the rate moves.
