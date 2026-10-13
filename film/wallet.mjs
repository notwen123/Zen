// Builds an EIP-1193 + EIP-6963 test wallet (announces as MetaMask) that signs real txs with `key`.
export function walletScript({ key, address, chainId = '0xb626', storageKey = '__e2eConnected' }) {
  return `(() => {
  const KEY = '${key}', ADDR = '${address}', RPC = 'https://rpc.testnet.chain.robinhood.com', SK = '${storageKey}';
  let chain = '${chainId}';
  let connected = localStorage.getItem(SK) === '1';
  const listeners = {};
  const emit = (e, v) => (listeners[e] || []).forEach(cb => cb(v));
  const rpc = (method, params) => fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) }).then(r => r.json()).then(j => { if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; } return j.result; });
  const acctP = import('https://esm.sh/viem@2.57.0/accounts').then(m => m.privateKeyToAccount(KEY));
  const provider = {
    isMetaMask: true, _metamask: { isUnlocked: async () => true }, isConnected: () => true,
    async request({ method, params }) {
      switch (method) {
        case 'eth_accounts': return connected ? [ADDR] : [];
        case 'eth_requestAccounts': connected = true; localStorage.setItem(SK, '1'); return [ADDR];
        case 'eth_chainId': return chain;
        case 'net_version': return String(parseInt(chain, 16));
        case 'wallet_switchEthereumChain': chain = params[0].chainId; emit('chainChanged', chain); return null;
        case 'wallet_addEthereumChain': case 'wallet_watchAsset': return null;
        case 'wallet_requestPermissions': case 'wallet_getPermissions': connected = true; return [{ parentCapability: 'eth_accounts' }];
        case 'wallet_revokePermissions': connected = false; localStorage.removeItem(SK); return null;
        case 'eth_sendTransaction': {
          const acct = await acctP; const tx = params[0];
          window.__e2eTxRequested = (window.__e2eTxRequested || 0) + 1;
          const [nonce, gasPrice] = await Promise.all([rpc('eth_getTransactionCount', [ADDR, 'pending']), rpc('eth_gasPrice', [])]);
          const gas = tx.gas ?? await rpc('eth_estimateGas', [{ from: ADDR, to: tx.to, data: tx.data, value: tx.value ?? '0x0' }]);
          const signed = await acct.signTransaction({ chainId: 46630, type: 'legacy', to: tx.to, data: tx.data, value: BigInt(tx.value ?? 0), nonce: Number(nonce), gas: BigInt(gas) * 12n / 10n, gasPrice: BigInt(gasPrice) });
          return (window.__e2eLastTx = await rpc('eth_sendRawTransaction', [signed]));
        }
        default: return rpc(method, params ?? []);
      }
    },
    on(e, cb) { (listeners[e] ??= []).push(cb); }, removeListener() {},
  };
  window.ethereum = provider;
  const info = { uuid: 'e2e00000-0000-4000-8000-000000000001', name: 'MetaMask', icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>', rdns: 'io.metamask' };
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce); announce();
})();`;
}
