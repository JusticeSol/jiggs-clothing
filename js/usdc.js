// USDC checkout for shoppers. Uses the same x402 endpoint AI agents use:
// the shopper signs a USDC transfer authorization in their wallet (no gas needed)
// and the API settles it on-chain before confirming the order.

const USDC_NETWORKS = {
  'eip155:84532': { chainId: 84532, name: 'Base Sepolia (test)', rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' },
  'eip155:8453': { chainId: 8453, name: 'Base', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org' }
};

const USDCCheckout = {
  isEnabled() { return Boolean(CONFIG.apiBaseUrl); },
  hasWallet() { return Boolean(window.ethereum); },

  // Deep links that reopen this page inside a mobile wallet's built-in browser.
  walletLinks() {
    return {
      metamask: 'https://metamask.app.link/dapp/' + location.href.replace(/^https?:\/\//, ''),
      coinbase: 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(location.href)
    };
  },

  async quote(body) {
    const res = await fetch(this.url('/api/orders/quote'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not price the order.');
    return data;
  },

  // Places and pays for an order. onStatus(text) reports progress for the UI.
  async pay(body, onStatus = () => {}) {
    if (!this.hasWallet()) throw new Error('No crypto wallet found in this browser.');

    onStatus('Preparing payment…');
    const first = await this.postOrder(body);
    if (first.status !== 402) {
      const data = await first.json().catch(() => ({}));
      throw new Error(data.error || `Unexpected response (${first.status}).`);
    }
    const paymentRequired = decodeBase64Json(first.headers.get('PAYMENT-REQUIRED'));
    const requirement = paymentRequired?.accepts?.find(a => a.scheme === 'exact' && USDC_NETWORKS[a.network]);
    if (!requirement) throw new Error('The store did not offer a supported USDC payment option.');
    const network = USDC_NETWORKS[requirement.network];

    onStatus('Connect your wallet…');
    const [from] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await this.switchChain(network);

    const amount = formatUsdc(requirement.amount);
    onStatus(`Approve ${amount} USDC in your wallet…`);
    const authorization = {
      from,
      to: requirement.payTo,
      value: requirement.amount,
      validAfter: '0',
      validBefore: String(Math.floor(Date.now() / 1000) + (requirement.maxTimeoutSeconds || 300)),
      nonce: randomHex32()
    };
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [from, JSON.stringify(transferTypedData(requirement, network.chainId, authorization))]
    });

    onStatus('Confirming payment on-chain…');
    const paymentPayload = {
      x402Version: 2,
      resource: paymentRequired.resource,
      accepted: requirement,
      payload: { authorization, signature }
    };
    const paid = await this.postOrder(body, encodeBase64Json(paymentPayload));
    const data = await paid.json().catch(() => ({}));
    if (!paid.ok) {
      const reason = decodeBase64Json(paid.headers.get('PAYMENT-REQUIRED'))?.error || data.error;
      throw new Error(friendlyPaymentError(reason));
    }
    const receipt = decodeBase64Json(paid.headers.get('PAYMENT-RESPONSE'));
    return {
      order: data,
      amount,
      transaction: receipt?.transaction,
      explorerUrl: receipt?.transaction ? `${network.explorer}/tx/${receipt.transaction}` : null
    };
  },

  postOrder(body, paymentHeader) {
    const headers = { 'Content-Type': 'application/json', 'X-Order-Channel': 'web' };
    if (paymentHeader) headers['PAYMENT-SIGNATURE'] = paymentHeader;
    return fetch(this.url('/api/orders'), { method: 'POST', headers, body: JSON.stringify(body) });
  },

  async switchChain(network) {
    const chainId = '0x' + network.chainId.toString(16);
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    } catch (err) {
      if (err.code !== 4902) throw err;
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId, chainName: network.name, rpcUrls: [network.rpc], blockExplorerUrls: [network.explorer], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }]
      });
    }
  },

  url(path) { return CONFIG.apiBaseUrl.replace(/\/$/, '') + path; }
};

function transferTypedData(requirement, chainId, authorization) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    primaryType: 'TransferWithAuthorization',
    domain: { name: requirement.extra.name, version: requirement.extra.version, chainId, verifyingContract: requirement.asset },
    message: authorization
  };
}

function randomHex32() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function formatUsdc(atomic) {
  return (Number(atomic) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function encodeBase64Json(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
}

function decodeBase64Json(value) {
  if (!value) return null;
  try {
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

function friendlyPaymentError(reason = '') {
  if (/insufficient/i.test(reason)) return 'Your wallet does not have enough USDC for this order.';
  if (/expired|valid_before|validBefore/i.test(reason)) return 'The payment approval expired. Please try again.';
  if (/signature/i.test(reason)) return 'The wallet signature could not be verified. Please try again.';
  return reason ? `Payment failed: ${reason}` : 'Payment failed. Please try again.';
}
