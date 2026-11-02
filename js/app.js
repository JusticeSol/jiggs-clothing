// Shared site logic: storage, cart, wishlist, header/footer, product visuals.

const Store = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }
};

const formatPrice = n => n.toLocaleString('en-US').replace(/,/g, ' ') + ' ' + CONFIG.currencySymbol;
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = (sel, root = document) => root.querySelector(sel);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Cart ----------
const Cart = {
  key: 'jiggs_cart',
  items() { return Store.get(this.key, []).filter(i => findProduct(i.id)); },
  save(items) { Store.set(this.key, items); document.dispatchEvent(new CustomEvent('cart:change')); },
  add(id, size, color, qty = 1) {
    const items = this.items();
    const existing = items.find(i => i.id === id && i.size === size && i.color === color);
    if (existing) existing.qty += qty; else items.push({ id, size, color, qty });
    this.save(items);
  },
  setQty(index, qty) {
    const items = this.items();
    if (qty <= 0) items.splice(index, 1); else items[index].qty = qty;
    this.save(items);
  },
  remove(index) { this.setQty(index, 0); },
  clear() { this.save([]); },
  count() { return this.items().reduce((n, i) => n + i.qty, 0); },
  subtotal() { return this.items().reduce((sum, i) => sum + findProduct(i.id).price * i.qty, 0); }
};

// ---------- Wishlist ----------
const Wishlist = {
  key: 'jiggs_wishlist',
  list() { return Store.get(this.key, []); },
  has(id) { return this.list().includes(id); },
  toggle(id) {
    const list = this.list();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    Store.set(this.key, list);
    return i < 0;
  }
};

// ---------- Icons ----------
const ICONS = {
  menu: '<svg viewBox="0 0 24 24"><path d="M3 8h18M3 16h18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 7h14l-1 14H6z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="m9 5 7 7-7 7"/></svg>'
};

// ---------- Product visuals ----------
// Line drawings used until real photos are added to a product's `images`.
const SHAPES = {
  sweater: '<path d="M70 40 L130 40 L165 60 L185 160 L165 165 L150 95 L150 205 L50 205 L50 95 L35 165 L15 160 L35 60 Z"/><path d="M85 40 Q100 56 115 40"/><path d="M50 196 H150"/>',
  cardigan: '<path d="M72 34 L128 34 L165 58 L185 160 L165 165 L150 95 L150 200 L50 200 L50 95 L35 165 L15 160 L35 58 Z"/><path d="M84 34 L84 20 L116 20 L116 34"/><path d="M100 20 V200"/>',
  coat: '<path d="M72 30 L128 30 L162 52 L180 200 L160 204 L150 100 L152 228 L48 228 L50 100 L40 204 L20 200 L38 52 Z"/><path d="M80 30 L100 85 L120 30"/><path d="M100 85 V228"/><path d="M62 160 H84 M116 160 H138"/>',
  trousers: '<path d="M60 18 L140 18 L152 228 L112 228 L100 82 L88 228 L48 228 Z"/><path d="M60 32 H140"/><path d="M80 32 V60 M120 32 V60"/>',
  tee: '<path d="M72 40 L128 40 L170 62 L158 94 L140 86 L140 205 L60 205 L60 86 L42 94 L30 62 Z"/><path d="M84 40 Q100 54 116 40"/>',
  dress: '<path d="M82 22 L118 22 L124 72 L162 228 L38 228 L76 72 Z"/><path d="M82 22 L82 8 M118 22 L118 8"/><path d="M76 72 H124"/>',
  bag: '<path d="M48 92 L152 92 L162 212 L38 212 Z"/><path d="M76 92 Q76 40 100 40 Q124 40 124 92"/>'
};

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + amount)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
}

function productVisual(product, { colorIndex = 0, imageIndex = 0 } = {}) {
  const img = product.images && product.images[imageIndex];
  if (img) return `<div class="visual"><img src="${img}" alt="${escapeHtml(product.name)}" loading="lazy"></div>`;
  const hex = (product.colors[colorIndex] || product.colors[0]).hex;
  const isDark = parseInt(hex.slice(1, 3), 16) < 110;
  const stroke = isDark ? shade(hex, 60) : shade(hex, -45);
  const tilt = imageIndex % 2 ? ' transform="translate(200 0) scale(-1 1)"' : '';
  return `<div class="visual visual--drawn" role="img" aria-label="${escapeHtml(product.name)}">
    <svg viewBox="0 0 200 240"><g fill="${hex}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"${tilt}>${SHAPES[product.shape] || SHAPES.tee}</g></svg>
  </div>`;
}

function productCard(product) {
  const colorName = product.colors[0].name.toLowerCase();
  const visibleSizes = product.sizes.slice(0, 4);
  const extra = product.sizes.length - visibleSizes.length;
  const wished = Wishlist.has(product.id);
  return `<a class="card" href="product.html?id=${product.id}">
    <div class="card-media">
      ${product.label ? `<span class="badge">${escapeHtml(product.label)}</span>` : product.isNew ? '<span class="badge">New</span>' : ''}
      <button class="wish-btn${wished ? ' is-active' : ''}" data-wish="${product.id}" aria-label="Save to wishlist">${ICONS.bookmark}</button>
      ${productVisual(product)}
    </div>
    <div class="card-info">
      <div class="card-row"><span>${escapeHtml(product.name)}, ${escapeHtml(colorName)}</span><span class="price">${formatPrice(product.price)}</span></div>
      <div class="card-row">
        <span class="card-sizes">${visibleSizes.map(s => `<span>${s}</span>`).join('')}${extra > 0 ? `<span class="muted">+${extra}</span>` : ''}</span>
        <span class="swatches">${product.colors.map(c => `<span class="swatch" style="background:${c.hex}" title="${escapeHtml(c.name)}"></span>`).join('')}</span>
      </div>
      <div class="card-material">${escapeHtml(product.material)}</div>
    </div>
  </a>`;
}

// ---------- Header / drawers / footer ----------
function renderChrome() {
  const navLinks = [
    ['shop.html?filter=new', 'New Arrivals'],
    ['shop.html', 'Shop All'],
    ...CATEGORIES.slice(0, 3).map(c => [`shop.html?cat=${c.id}`, c.name])
  ];

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="announcement">${escapeHtml(CONFIG.announcement)}</div>
    <header class="site-header">
      <div class="header-left">
        <button class="icon-btn menu-toggle" data-open="menu" aria-label="Open menu">${ICONS.menu}</button>
        <nav class="header-nav">${navLinks.slice(0, 3).map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
      </div>
      <a href="index.html" class="logo" aria-label="${CONFIG.brand} home">${CONFIG.brand}</a>
      <div class="header-right">
        <button class="icon-btn" data-open="search" aria-label="Search">${ICONS.search}</button>
        <a class="icon-btn" href="shop.html?filter=wishlist" aria-label="Wishlist">${ICONS.bookmark}</a>
        <button class="icon-btn" data-open="cart" aria-label="Shopping bag">${ICONS.bag}<span class="bag-count" data-bag-count></span></button>
      </div>
    </header>
    <div class="overlay" data-close></div>
    <aside class="drawer drawer--left" id="menu" aria-label="Menu">
      <div class="drawer-head"><span class="logo" style="font-size:1.25rem">${CONFIG.brand}</span><button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button></div>
      <div class="drawer-body">
        <ul class="menu-list">
          <li><a class="menu-feature" href="shop.html?filter=new">New Arrivals</a></li>
          <li><a href="shop.html">Shop All</a></li>
          ${CATEGORIES.map(c => `<li><a href="shop.html?cat=${c.id}">${c.name}</a></li>`).join('')}
          <li><a href="shop.html?filter=wishlist">Wishlist</a></li>
        </ul>
      </div>
    </aside>
    <aside class="drawer drawer--right" id="cart" aria-label="Shopping bag">
      <div class="drawer-head"><span>Bag (<span data-bag-count-plain>0</span>)</span><button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button></div>
      <div class="drawer-body" data-cart-lines></div>
      <div class="drawer-foot" data-cart-foot></div>
    </aside>
    <div class="search-panel" id="search">
      <form action="shop.html">
        ${ICONS.search.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor"')}
        <input type="search" name="q" placeholder="Search products" aria-label="Search products">
        <button type="button" class="icon-btn" data-close aria-label="Close">${ICONS.close}</button>
      </form>
    </div>
    <div class="toast" role="status" aria-live="polite"></div>
  `);

  const year = new Date().getFullYear();
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site-footer">
      <div class="container footer-cols">
        <div class="newsletter">
          <h3>Join our mailing list</h3>
          <p>Receive first access to new pieces, exclusive content and weekly inspiration</p>
          <form data-newsletter>
            <input type="email" required placeholder="Enter e-mail" aria-label="E-mail address">
            <button class="icon-btn" aria-label="Subscribe">${ICONS.arrow}</button>
          </form>
          <div class="newsletter-msg" data-newsletter-msg></div>
        </div>
        <div>
          <div class="footer-prefs">
            <div><span>Select Country:</span> Nigeria / NGN</div>
          </div>
          <details class="accordion"><summary>The Brand</summary>
            <div class="accordion-body"><a href="#">About ${CONFIG.brand}</a><a href="#">Sustainability</a><a href="${CONFIG.contact.instagram}" target="_blank" rel="noopener">Instagram</a></div>
          </details>
          <details class="accordion"><summary>Customer Care</summary>
            <div class="accordion-body"><a href="#">Shipping & Delivery</a><a href="#">Returns & Exchanges</a><a href="#">Size Guide</a><a href="mailto:${CONFIG.contact.email}">${CONFIG.contact.email}</a><a href="tel:${CONFIG.contact.phone.replace(/\s/g, '')}">${CONFIG.contact.phone}</a></div>
          </details>
        </div>
      </div>
      <div class="big-logo" aria-hidden="true">${[...CONFIG.brand].map(l => `<span>${l}</span>`).join('')}</div>
      <div class="copyright">©${year} ${escapeHtml(CONFIG.tagline)}</div>
    </footer>
  `);
}

// ---------- Cart drawer ----------
function cartLineHtml(item, index, { editable = true } = {}) {
  const p = findProduct(item.id);
  const colorIndex = Math.max(0, p.colors.findIndex(c => c.name === item.color));
  return `<div class="cart-line">
    <a href="product.html?id=${p.id}" class="thumb">${productVisual(p, { colorIndex })}</a>
    <div>
      <div class="cart-line-top"><span>${escapeHtml(p.name)}</span><span class="price">${formatPrice(p.price * item.qty)}</span></div>
      <div class="cart-line-meta">${escapeHtml(item.color)} · ${escapeHtml(item.size)}${editable ? '' : ` · Qty ${item.qty}`}</div>
      ${editable ? `<div class="cart-line-actions">
        <div class="qty"><button data-qty="${index}" data-delta="-1" aria-label="Decrease">−</button><span>${item.qty}</span><button data-qty="${index}" data-delta="1" aria-label="Increase">+</button></div>
        <button class="text-btn" data-remove="${index}">Remove</button>
      </div>` : ''}
    </div>
  </div>`;
}

function renderCart() {
  const items = Cart.items();
  const count = Cart.count();
  document.querySelectorAll('[data-bag-count]').forEach(el => { el.textContent = count || ''; });
  document.querySelectorAll('[data-bag-count-plain]').forEach(el => { el.textContent = count; });

  const lines = qs('[data-cart-lines]');
  const foot = qs('[data-cart-foot]');
  if (!lines) return;
  if (!items.length) {
    lines.innerHTML = '<p class="empty-state">Your bag is empty.</p><a class="link-underline" href="shop.html?filter=new">Shop new arrivals</a>';
    foot.innerHTML = '';
    return;
  }
  lines.innerHTML = items.map((item, i) => cartLineHtml(item, i)).join('');
  const subtotal = Cart.subtotal();
  const remaining = CONFIG.freeShippingThreshold - subtotal;
  foot.innerHTML = `
    <p class="shipping-note">${remaining > 0 ? `You are ${formatPrice(remaining)} away from free delivery.` : 'You qualify for free delivery.'}</p>
    <div class="totals-row total"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    <a href="checkout.html" class="btn" style="margin-top:1rem">Checkout</a>`;
}

// ---------- UI wiring ----------
function openPanel(id) {
  closePanels();
  qs('#' + id)?.classList.add('is-open');
  qs('.overlay').classList.add('is-open');
  if (id === 'search') setTimeout(() => qs('#search input').focus(), 200);
}
function closePanels() {
  document.querySelectorAll('.drawer, .search-panel, .overlay').forEach(el => el.classList.remove('is-open'));
}

let toastTimer;
function showToast(message) {
  const toast = qs('.toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function initChrome() {
  renderChrome();
  renderCart();

  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-open]');
    if (opener) { e.preventDefault(); openPanel(opener.dataset.open); return; }
    if (e.target.closest('[data-close]')) { closePanels(); return; }

    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const i = +qtyBtn.dataset.qty;
      Cart.setQty(i, Cart.items()[i].qty + +qtyBtn.dataset.delta);
      return;
    }
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) { Cart.remove(+removeBtn.dataset.remove); return; }

    const wishBtn = e.target.closest('[data-wish]');
    if (wishBtn) {
      e.preventDefault();
      const added = Wishlist.toggle(wishBtn.dataset.wish);
      document.querySelectorAll(`[data-wish="${wishBtn.dataset.wish}"]`).forEach(b => b.classList.toggle('is-active', added));
      showToast(added ? 'Saved to wishlist' : 'Removed from wishlist');
      document.dispatchEvent(new CustomEvent('wishlist:change'));
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });
  document.addEventListener('cart:change', renderCart);

  qs('[data-newsletter]').addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const list = Store.get('jiggs_newsletter', []);
    if (!list.includes(input.value)) list.push(input.value);
    Store.set('jiggs_newsletter', list);
    input.value = '';
    qs('[data-newsletter-msg]').textContent = 'Thank you — you are on the list.';
  });

  // Transparent header over the hero turns solid once you scroll past it.
  if (document.body.classList.contains('has-hero')) {
    const header = qs('.site-header');
    const update = () => header.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.6);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }
}

document.addEventListener('DOMContentLoaded', initChrome);
