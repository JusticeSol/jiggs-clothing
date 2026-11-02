# JIGGS — clothing store (starter)

Plain HTML/CSS/JS. No build step: open `index.html` in a browser.

## Pages
- `index.html` — hero, editorial block, new-arrivals carousel, categories
- `shop.html` — all products; `?filter=new`, `?filter=wishlist`, `?cat=knitwear`, `?q=search`
- `product.html?id=...` — colour/size selection, add to bag, wishlist
- `checkout.html` — delivery details, delivery method, payment

## Where to change things
- `js/config.js` — brand name, announcement text, delivery prices, free-delivery threshold, contact details, Paystack key
- `js/products.js` — the catalogue (name, price in ₦, sizes, colours, category, description)
- `css/styles.css` — colours and fonts are the variables at the top (`:root`)

## Adding real photos
Put images in `images/` and list them on a product:
`images: ['images/danni-front.jpg', 'images/danni-back.jpg']`.
Until then, a drawn placeholder in the product's colour is shown.
For the homepage hero, replace the placeholder in `index.html` with `<img src="images/hero.jpg" alt="">`.

## Payments
Checkout runs in demo mode until `paystackPublicKey` is set in `js/config.js`.
Before going live, add a small server that verifies each Paystack reference with the secret key
before an order is fulfilled — the browser alone can't be trusted to confirm payment.

## USDC payments and AI agents (x402)
The `server/` folder is a small API that accepts USDC on Base via the x402 protocol:
AI agents pay per call to browse the catalogue and pay the order total to buy; shoppers get a
"USDC stablecoin" option at checkout. See [server/README.md](server/README.md).
The USDC option only appears once `apiBaseUrl` in `js/config.js` points at a running server
(automatic when you open the site locally).

## Current limits (prototype)
Bag, wishlist, newsletter sign-ups and orders are stored in the visitor's browser only.
A backend (e.g. Shopify, or a custom API + database) is the next step for real order management.
