// Loads the storefront's own catalogue (js/config.js + js/products.js) so the
// website and the API always share one source of truth.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadStorefront() {
  // config.js reads location.hostname to pick the API address; give it a stand-in.
  const context = vm.createContext({ location: { hostname: 'server', href: '' } });
  for (const file of ['js/config.js', 'js/products.js']) {
    vm.runInContext(fs.readFileSync(path.join(siteRoot, file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('({ CONFIG, CATEGORIES, PRODUCTS })', context);
}

export const { CONFIG, CATEGORIES, PRODUCTS } = loadStorefront();

export const findProduct = id => PRODUCTS.find(p => p.id === id);

export function ngnToUsd(ngn, ngnPerUsd) {
  // Round up to the cent so we never undercharge.
  return Math.ceil((ngn / ngnPerUsd) * 100) / 100;
}

export function publicProduct(p, { ngnPerUsd, siteUrl }) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    material: p.material,
    sizes: p.sizes,
    colors: p.colors.map(c => c.name),
    priceNGN: p.price,
    priceUSDC: ngnToUsd(p.price, ngnPerUsd),
    isNew: Boolean(p.isNew),
    availability: p.label === 'Coming soon' ? 'preorder_unavailable' : 'in_stock',
    label: p.label || null,
    url: siteUrl ? `${siteUrl}/product.html?id=${p.id}` : null
  };
}

const MAX_QTY = 10;

// Validates an order request and prices it. Throws { status, message } on bad input.
export function quoteOrder(body, { ngnPerUsd }) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!body || typeof body !== 'object') fail('Request body must be JSON.');

  const { items, shipping = 'standard', customer } = body;
  if (!Array.isArray(items) || items.length === 0) fail('items must be a non-empty array.');
  if (items.length > 20) fail('Too many line items (max 20).');
  if (!CONFIG.shipping[shipping]) fail(`shipping must be one of: ${Object.keys(CONFIG.shipping).join(', ')}.`);

  const lines = items.map((item, i) => {
    const product = findProduct(item?.id);
    if (!product) fail(`items[${i}].id "${item?.id}" is not a known product.`);
    if (product.label === 'Coming soon') fail(`${product.name} is not available to order yet.`);
    const size = item.size ?? (product.sizes.length === 1 ? product.sizes[0] : undefined);
    if (!product.sizes.includes(size)) fail(`items[${i}].size must be one of: ${product.sizes.join(', ')}.`);
    const colorName = item.color ?? product.colors[0].name;
    const color = product.colors.find(c => c.name.toLowerCase() === String(colorName).toLowerCase());
    if (!color) fail(`items[${i}].color must be one of: ${product.colors.map(c => c.name).join(', ')}.`);
    const qty = item.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) fail(`items[${i}].qty must be a whole number from 1 to ${MAX_QTY}.`);
    return { id: product.id, name: product.name, size, color: color.name, qty, unitPriceNGN: product.price, lineTotalNGN: product.price * qty };
  });

  if (customer !== undefined) validateCustomer(customer, fail);

  const subtotalNGN = lines.reduce((sum, l) => sum + l.lineTotalNGN, 0);
  const shippingNGN = shipping === 'standard' && subtotalNGN >= CONFIG.freeShippingThreshold ? 0 : CONFIG.shipping[shipping].price;
  const totalNGN = subtotalNGN + shippingNGN;

  return {
    lines,
    shipping,
    subtotalNGN,
    shippingNGN,
    totalNGN,
    totalUSDC: ngnToUsd(totalNGN, ngnPerUsd),
    exchangeRate: { ngnPerUsd }
  };
}

function validateCustomer(c, fail) {
  if (!c || typeof c !== 'object') fail('customer must be an object.');
  const required = ['name', 'email', 'phone', 'address', 'city', 'state'];
  for (const field of required) {
    if (typeof c[field] !== 'string' || !c[field].trim()) fail(`customer.${field} is required.`);
    if (c[field].length > 200) fail(`customer.${field} is too long.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) fail('customer.email is not a valid e-mail address.');
}
