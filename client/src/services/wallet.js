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
      this.logger.info('Initializing wallet from mnemonic...');

      // Wait for crypto libraries to be ready
      await cryptoWaitReady();

      // Get mnemonic from environment
      const mnemonic = import.meta.env.VITE_SIGNER_MNEMONIC;
      if (!mnemonic) {
        throw new Error('VITE_SIGNER_MNEMONIC not found in environment variables');
      }

      // Create keyring and add account from mnemonic
      const keyring = new Keyring({ type: 'sr25519' });
      this.keypair = keyring.addFromMnemonic(mnemonic);

      // Connect to Polkadot network
      const rpcUrl = this.getRpcUrl();
      this.logger.info(`Connecting to ${this.network} network: ${rpcUrl}`);

      const provider = new WsProvider(rpcUrl);
      this.api = await ApiPromise.create({ provider });

      this.logger.success(`Wallet initialized: ${this.formatAddress(this.keypair.address)}`);
      this.logger.info(`Network: ${this.network}`);

      // Fetch initial balance
      await this.fetchBalance();

      return {
        address: this.keypair.address,
        meta: { name: 'Mnemonic Account' }
      };
    } catch (error) {
      this.logger.error(`Wallet initialization failed: ${error.message}`);
      throw error;
    }
  }

  async fetchBalance() {
    if (!this.keypair || !this.api) {
      this.logger.error('Wallet not initialized');
      return;
    }

    try {
      this.logger.info('Fetching DOT balance...');

      // Get account balance
      const { data: balance } = await this.api.query.system.account(this.keypair.address);

      // Convert from plancks to DOT (1 DOT = 10^10 plancks for Polkadot/Paseo)
      const dotBalance = (balance.free.toBigInt() / BigInt(10**10)).toString();
      const dotBalanceFormatted = `${dotBalance} PAS`;

      // Update UI
      const dotBalanceEl = document.getElementById('dot-balance');
      if (dotBalanceEl) {
        dotBalanceEl.textContent = dotBalanceFormatted;
      }

      const walletAddressEl = document.getElementById('wallet-address');
      if (walletAddressEl) {
        walletAddressEl.textContent = this.formatAddress(this.keypair.address);
      }

      this.logger.success(`Balance: ${dotBalanceFormatted}`);
    } catch (error) {
      this.logger.error(`Failed to fetch balance: ${error.message}`);
      const dotBalanceEl = document.getElementById('dot-balance');
      if (dotBalanceEl) {
        dotBalanceEl.textContent = 'Error';
      }
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

  async signTransaction(transaction) {
    if (!this.keypair || !this.api) {
      throw new Error('Wallet not initialized');
    }

    try {
      this.logger.info('Creating and signing transaction...');

      // Get account nonce
      const nonce = await this.api.rpc.system.accountNextIndex(this.keypair.address);

      // Create transfer extrinsic
      const transfer = this.api.tx.balances.transferKeepAlive(
        transaction.to,
        transaction.amount
      );

      // Sign the transaction
      const signedTx = await transfer.signAsync(this.keypair, { nonce });

      // Get the hex-encoded signed transaction
      const signedHex = signedTx.toHex();

      this.logger.success('Transaction signed successfully');
      this.logger.info(`Signed transaction: ${signedHex.slice(0, 20)}...${signedHex.slice(-20)}`);

      return signedHex;
    } catch (error) {
      this.logger.error(`Transaction signing failed: ${error.message}`);
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
