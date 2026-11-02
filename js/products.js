// Product catalogue. To use real photos, drop files into /images and add
// e.g. images: ['images/danni-1.jpg', 'images/danni-2.jpg'] to a product.
// Without images, a drawn placeholder in the product's colour is shown.
const CATEGORIES = [
  { id: 'knitwear', name: 'Knitwear' },
  { id: 'outerwear', name: 'Outerwear' },
  { id: 'tops', name: 'Tops & Shirts' },
  { id: 'trousers', name: 'Trousers' },
  { id: 'dresses', name: 'Dresses' },
  { id: 'accessories', name: 'Accessories' }
];

const PRODUCTS = [
  {
    id: 'danni-zip-cardigan', name: 'Danni Zip Cardigan', category: 'knitwear', shape: 'cardigan',
    price: 79000, material: 'Wool Cashmere', sizes: ['XS', 'S', 'M', 'L', 'XL'], isNew: true,
    colors: [{ name: 'Vanilla', hex: '#efe6d4' }, { name: 'Black', hex: '#1d1b19' }],
    description: 'A cropped zip cardigan with a high funnel neck and softly rounded sleeves. Knitted in a dense, brushed wool-cashmere blend that keeps its shape.'
  },
  {
    id: 'aria-cardigan', name: 'Aria Cardigan', category: 'knitwear', shape: 'cardigan',
    price: 68500, material: 'Cashmere', sizes: ['XS', 'S', 'M', 'L'], isNew: true,
    colors: [{ name: 'Oat', hex: '#d9cbb4' }, { name: 'Mocha', hex: '#6b5546' }],
    description: 'A relaxed V-neck cardigan in fine-gauge cashmere with tonal horn buttons.'
  },
  {
    id: 'sola-knit-sweater', name: 'Sola Knit Sweater', category: 'knitwear', shape: 'sweater',
    price: 59000, material: 'Merino Wool', sizes: ['S', 'M', 'L', 'XL'], isNew: true, label: 'Low stock',
    colors: [{ name: 'Ivory', hex: '#f1ece2' }, { name: 'Charcoal', hex: '#3d3b39' }],
    description: 'An oversized crew-neck sweater with dropped shoulders and ribbed trims.'
  },
  {
    id: 'kemi-wool-coat', name: 'Kemi Wool Coat', category: 'outerwear', shape: 'coat',
    price: 145000, material: 'Wool Blend', sizes: ['XS', 'S', 'M', 'L'], isNew: true,
    colors: [{ name: 'Camel', hex: '#b8956a' }, { name: 'Black', hex: '#1d1b19' }],
    description: 'A long, single-breasted coat with a notched lapel and deep welt pockets.'
  },
  {
    id: 'tobi-bomber', name: 'Tobi Bomber Jacket', category: 'outerwear', shape: 'cardigan',
    price: 98000, material: 'Cotton Twill', sizes: ['S', 'M', 'L', 'XL'],
    colors: [{ name: 'Black', hex: '#24211f' }, { name: 'Olive', hex: '#5b5a45' }],
    description: 'A boxy bomber in heavy cotton twill with a two-way zip and ribbed collar.'
  },
  {
    id: 'ade-oxford-shirt', name: 'Ade Oxford Shirt', category: 'tops', shape: 'tee',
    price: 38000, material: 'Organic Cotton', sizes: ['S', 'M', 'L', 'XL'], isNew: true,
    colors: [{ name: 'White', hex: '#f7f6f2' }, { name: 'Sky', hex: '#bfcfdc' }],
    description: 'An easy oxford shirt with a soft collar and a slightly longer back hem.'
  },
  {
    id: 'essential-tee', name: 'Essential Tee', category: 'tops', shape: 'tee',
    price: 18500, material: 'Heavy Cotton Jersey', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [{ name: 'White', hex: '#f7f6f2' }, { name: 'Black', hex: '#1d1b19' }, { name: 'Sand', hex: '#d8c8ae' }],
    description: 'A heavyweight T-shirt with a close crew neck. The one you will wear every week.'
  },
  {
    id: 'lekki-pleated-trouser', name: 'Lekki Pleated Trouser', category: 'trousers', shape: 'trousers',
    price: 52000, material: 'Wool Twill', sizes: ['XS', 'S', 'M', 'L', 'XL'], isNew: true,
    colors: [{ name: 'Cream', hex: '#ece3d1' }, { name: 'Taupe', hex: '#8f8274' }],
    description: 'A wide-leg trouser with front pleats, a high waist and a pressed crease.'
  },
  {
    id: 'ikoyi-straight-jean', name: 'Ikoyi Straight Jean', category: 'trousers', shape: 'trousers',
    price: 46000, material: 'Rigid Denim', sizes: ['26', '28', '30', '32', '34'], label: 'Back in stock',
    colors: [{ name: 'Washed Blue', hex: '#7d93a8' }, { name: 'Ecru', hex: '#e7e0cf' }],
    description: 'A straight-leg jean in rigid denim that softens beautifully with wear.'
  },
  {
    id: 'zuri-slip-dress', name: 'Zuri Slip Dress', category: 'dresses', shape: 'dress',
    price: 72000, material: 'Silk Satin', sizes: ['XS', 'S', 'M', 'L'], isNew: true,
    colors: [{ name: 'Champagne', hex: '#e2d2b5' }, { name: 'Black', hex: '#1d1b19' }],
    description: 'A bias-cut slip dress with fine adjustable straps that falls to the ankle.'
  },
  {
    id: 'nala-knit-dress', name: 'Nala Knit Dress', category: 'dresses', shape: 'dress',
    price: 84000, material: 'Wool Cashmere', sizes: ['XS', 'S', 'M', 'L'], label: 'Coming soon',
    colors: [{ name: 'Grey Melange', hex: '#b3afa9' }],
    description: 'A long, fitted rib-knit dress with a mock neck.'
  },
  {
    id: 'market-tote', name: 'Market Tote', category: 'accessories', shape: 'bag',
    price: 42000, material: 'Full-grain Leather', sizes: ['One size'],
    colors: [{ name: 'Cognac', hex: '#9a6440' }, { name: 'Black', hex: '#1d1b19' }],
    description: 'A roomy, unlined leather tote that fits a laptop and everything else.'
  }
];
