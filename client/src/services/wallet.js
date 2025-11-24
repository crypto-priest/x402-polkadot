import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

class WalletService {
  constructor(logger) {
    this.logger = logger;
    this.keypair = null;
    this.api = null;
    this.network = import.meta.env.VITE_POLKADOT_NETWORK || 'paseo';
  }

  async connect() {
    try {
      this.logger.info('Loading wallet...');

      await cryptoWaitReady();

      const mnemonic = import.meta.env.VITE_SIGNER_MNEMONIC;
      if (!mnemonic) {
        throw new Error('Mnemonic not found in .env');
      }

      const keyring = new Keyring({ type: 'sr25519' });
      this.keypair = keyring.addFromMnemonic(mnemonic);

      const rpcUrl = this.getRpcUrl();
      this.logger.info(`Connecting to ${this.network}`);

      const provider = new WsProvider(rpcUrl);
      this.api = await ApiPromise.create({ provider });

      this.logger.success(`Connected: ${this.formatAddress(this.keypair.address)}`);

      await this.fetchBalance();

      const receiverAddr = document.getElementById('receiver-address')?.textContent;
      if (receiverAddr) {
        await this.fetchReceiverBalance(receiverAddr);
      }

      return { address: this.keypair.address };
    } catch (error) {
      this.logger.error(`Failed: ${error.message}`);
      throw error;
    }
  }

  async fetchBalance() {
    if (!this.keypair || !this.api) return;

    try {
      this.logger.info('Fetching balance...');

      const { data: balance } = await this.api.query.system.account(this.keypair.address);
      const amount = (balance.free.toBigInt() / BigInt(10**10)).toString();
      const formatted = `${amount} PAS`;

      const balanceEl = document.getElementById('dot-balance');
      if (balanceEl) balanceEl.textContent = formatted;

      const addressEl = document.getElementById('wallet-address');
      if (addressEl) addressEl.textContent = this.keypair.address;

      this.logger.success(`Balance: ${formatted}`);
    } catch (error) {
      this.logger.error(`Balance fetch failed: ${error.message}`);
      const el = document.getElementById('dot-balance');
      if (el) el.textContent = 'Error';
    }
  }

  async getBalanceForAddress(address) {
    if (!this.api) throw new Error('API not ready');

    try {
      const { data: balance } = await this.api.query.system.account(address);
      const amount = (balance.free.toBigInt() / BigInt(10**10)).toString();
      return `${amount} PAS`;
    } catch (error) {
      this.logger.error(`Balance fetch failed: ${error.message}`);
      return 'Error';
    }
  }

  async fetchReceiverBalance(address) {
    if (!this.api) return;

    try {
      this.logger.info('Fetching receiver balance...');
      const balance = await this.getBalanceForAddress(address);

      const el = document.getElementById('receiver-balance');
      if (el) el.textContent = balance;

      this.logger.success(`Receiver: ${balance}`);
    } catch (error) {
      this.logger.error(`Receiver balance failed: ${error.message}`);
      const el = document.getElementById('receiver-balance');
      if (el) el.textContent = 'Error';
    }
  }

  getRpcUrl() {
    const rpcUrls = {
      paseo: 'wss://paseo.rpc.amforc.com',
      westend: 'wss://westend-rpc.polkadot.io',
      polkadot: 'wss://rpc.polkadot.io'
    };
    return rpcUrls[this.network] || rpcUrls.paseo;
  }

  async signTransaction(tx) {
    if (!this.keypair || !this.api) throw new Error('Wallet not ready');

    try {
      this.logger.info('Signing transaction...');

      const nonce = await this.api.rpc.system.accountNextIndex(this.keypair.address);
      const transfer = this.api.tx.balances.transferKeepAlive(tx.to, tx.amount);
      const signed = await transfer.signAsync(this.keypair, { nonce });
      const hex = signed.toHex();

      this.logger.success('Signed');
      this.logger.info(`Tx: ${hex.slice(0, 20)}...${hex.slice(-20)}`);

      return hex;
    } catch (error) {
      this.logger.error(`Signing failed: ${error.message}`);
      throw error;
    }
  }

  getAddress() {
    return this.keypair?.address || null;
  }

  isConnected() {
    return this.keypair !== null && this.api !== null;
  }

  formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  }
}

export default WalletService;
