// Site-wide settings. Change these in one place.
const CONFIG = {
  brand: 'JIGGS',
  tagline: 'JIGGS LABEL',
  announcement: 'Nationwide delivery — free on orders over 150 000 ₦',
  currencySymbol: '₦',
  currencyCode: 'NGN',
  freeShippingThreshold: 150000,
  shipping: {
    standard: { label: 'Standard delivery (3–5 days)', price: 5000 },
    express: { label: 'Express delivery (1–2 days, Lagos & Abuja)', price: 10000 }
  },
  // Paste your Paystack PUBLIC key (pk_test_... or pk_live_...) to enable real card payments.
  // Leave empty to run checkout in demo mode.
  paystackPublicKey: '',
  contact: {
    email: 'hello@jiggs.example',
    phone: '+234 000 000 0000',
    instagram: 'https://instagram.com/'
  }
};
