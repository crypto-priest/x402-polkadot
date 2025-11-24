import Logger from './utils/logger.js';
import WalletService from './services/wallet.js';
import APIService from './services/api.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3000';
const POLKADOT_NETWORK = import.meta.env.VITE_POLKADOT_NETWORK || 'westend';

const logger = new Logger('log-container');
const walletService = new WalletService(logger);
const apiService = new APIService(SERVER_URL, logger);

let currentPaymentRequirements = null;

function showPageLoader(msg = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.id = 'page-loader';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10002;display:flex;align-items:center;justify-content:center;';

  overlay.innerHTML = `
    <div style="background:#fff;padding:40px;border-radius:12px;text-align:center;">
      <div style="width:50px;height:50px;border:4px solid #e0e0e0;border-top-color:#2A5244;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>
      <div style="color:#2A5244;font-weight:600;font-size:18px;margin-bottom:8px;">${msg}</div>
      <div style="color:#666;font-size:14px;">Please wait...</div>
    </div>
  `;

  if (!document.querySelector('#loader-spin')) {
    const style = document.createElement('style');
    style.id = 'loader-spin';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); }}';
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
}

function hidePageLoader() {
  const el = document.getElementById('page-loader');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }
}

function showNotification(msg, type = 'error') {
  const notif = document.createElement('div');
  const color = type === 'error' ? '#c62828' : '#2A5244';
  notif.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:25px 30px;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:10001;max-width:400px;border-left:4px solid ${color};`;

  notif.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:24px;">${type === 'error' ? '⚠️' : 'ℹ️'}</div>
      <div>
        <div style="color:${color};font-weight:600;font-size:16px;margin-bottom:4px;">${type === 'error' ? 'Error' : 'Notice'}</div>
        <div style="color:#1a1a1a;font-size:14px;">${msg}</div>
      </div>
    </div>
  `;

  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transition = 'opacity 0.2s';
    setTimeout(() => notif.remove(), 200);
  }, 3000);
}

function updateWalletUI(connected) {
  logger.info('Wallet UI updated');
}

function showResult(elementId, data, type = 'info') {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.classList.add('show');
  element.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

async function connectWallet() {
  const btn = document.getElementById('load-wallet-btn');
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = 'Loading...';
    logger.info('Loading wallet...');

    await walletService.connect();
    updateWalletUI(true);

    btn.textContent = 'Wallet Loaded';
    logger.success('Wallet loaded successfully');
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    logger.error(`Wallet load failed: ${error.message}`);
    showNotification(error.message, 'error');
  }
}

async function testHealth() {
  try {
    const response = await apiService.health();
    showResult('health-result', response.data, response.ok ? 'success' : 'error');
  } catch (error) {
    showResult('health-result', { error: error.message }, 'error');
  }
}

async function testFree() {
  try {
    const response = await apiService.free();
    showResult('free-result', response.data, response.ok ? 'success' : 'error');
  } catch (error) {
    showResult('free-result', { error: error.message }, 'error');
  }
}

async function testPaid() {
  try {
    const response = await apiService.paid();

    if (response.status === 402) {
      logger.warning('Payment required - Auto-processing payment');
      currentPaymentRequirements = response.data.paymentRequirements;
      showResult('paid-result', response.data, 'info');

      await showAutoPaymentWarning(currentPaymentRequirements);
    } else {
      showResult('paid-result', response.data, response.ok ? 'success' : 'error');
    }
  } catch (error) {
    showResult('paid-result', { error: error.message }, 'error');
  }
}

async function showAutoPaymentWarning(requirements) {
  if (!walletService.isConnected()) {
    logger.error('Wallet not connected');
    showNotification('Please load wallet first!', 'error');
    return;
  }

  const amount = (requirements.amount / 10_000_000_000).toFixed(2);
  const popup = document.createElement('div');
  popup.id = 'payment-popup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:35px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.2);z-index:10000;max-width:650px;border:2px solid #2A5244;';

  popup.innerHTML = `
    <div>
      <h2 style="color:#2A5244;margin:0 0 10px 0;font-size:22px;">Payment Required</h2>
      <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span style="color:#666;font-weight:500;">Amount:</span>
          <span style="color:#1a1a1a;font-weight:600;">${amount} PAS</span>
        </div>
        <div>
          <div style="color:#666;font-weight:500;margin-bottom:4px;">To:</div>
          <div style="color:#1a1a1a;font-weight:600;font-size:13px;font-family:monospace;word-break:break-all;background:#fff;padding:8px;border-radius:4px;border:1px solid #e0e0e0;">${requirements.recipient}</div>
        </div>
      </div>
      <div id="payment-status" style="background:#fafafa;padding:15px;border-radius:8px;margin-bottom:15px;min-height:100px;max-height:200px;overflow-y:auto;"></div>
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;border-radius:4px;font-size:13px;color:#856404;">
        <strong>Demo:</strong> In production this happens automatically in the background.
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  await autoProcessPayment(requirements, popup);
}

function updatePaymentStatus(status, done = false, err = false) {
  const container = document.getElementById('payment-status');
  if (!container) return;

  const item = document.createElement('div');
  const color = err ? '#c62828' : done ? '#2e7d32' : '#1a1a1a';
  const bg = err ? '#ffebee' : done ? '#e8f5e9' : '#f5f5f5';
  const icon = err ? 'X' : done ? '✓' : '›';

  item.style.cssText = `color:${color};font-weight:${done||err?'600':'500'};margin:8px 0;font-size:14px;padding:8px 12px;background:${bg};border-radius:6px;border-left:3px solid ${color};`;
  item.innerHTML = `<span style="margin-right:8px;font-weight:bold;">${icon}</span>${status}`;

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

async function autoProcessPayment(requirements, popup) {
  try {
    updatePaymentStatus('1. Signing transaction with wallet...');
    logger.info('Auto-signing transaction');

    const signedTxHex = await walletService.signTransaction({
      to: requirements.recipient,
      amount: requirements.amount,
    });

    updatePaymentStatus('2. Transaction signed successfully');
    updatePaymentStatus('3. Sending signed transaction in X-PAYMENT header');
    logger.info('Submitting payment to server');

    const response = await apiService.paid(signedTxHex);

    if (response.ok) {
      updatePaymentStatus('4. API request submitted to server');
      updatePaymentStatus('5. Server verifying transaction...');
      updatePaymentStatus('6. Submitting to Paseo blockchain...');
      updatePaymentStatus('7. Waiting for block finalization...');

      await new Promise(resolve => setTimeout(resolve, 500));
      updatePaymentStatus('8. Transaction included in block');

      await new Promise(resolve => setTimeout(resolve, 500));
      updatePaymentStatus('9. Transaction finalized on-chain', true);

      logger.success('Payment successful - Access granted');
      logger.info(`Transaction Hash: ${response.data.transaction_hash}`);
      logger.info(`Block Hash: ${response.data.block_hash}`);
      showResult('paid-result', response.data, 'success');

      localStorage.setItem('walletWasLoaded', 'true');

      setTimeout(async () => {
        popup.style.borderColor = '#4caf50';
        popup.querySelector('h2').textContent = 'Payment Successful!';
        popup.querySelector('h2').style.color = '#4caf50';
      }, 500);

      setTimeout(async () => {
        popup.remove();
        await walletService.fetchBalance();
        const receiverAddress = document.getElementById('receiver-address')?.textContent;
        if (receiverAddress) {
          await walletService.fetchReceiverBalance(receiverAddress);
        }
        logger.success('Balances updated');
      }, 3000);
    } else {
      updatePaymentStatus('Payment failed', false, true);
      logger.error('Payment failed');
      showResult('paid-result', response.data, 'error');

      setTimeout(() => popup.remove(), 3000);
    }
  } catch (error) {
    updatePaymentStatus(`Error: ${error.message}`, false, true);
    logger.error(`Payment error: ${error.message}`);
    showResult('paid-result', { error: error.message }, 'error');

    setTimeout(() => popup.remove(), 3000);
  }
}

function showPaymentRequirements(requirements) {
  const container = document.getElementById('payment-requirements');
  const details = document.getElementById('payment-details');

  const amountInDOT = (requirements.amount / 10_000_000_000).toFixed(4);

  details.innerHTML = `
    <p><strong>Amount:</strong> ${amountInDOT} ${requirements.currency} (${requirements.amount} plancks)</p>
    <p><strong>Recipient:</strong> ${walletService.formatAddress(requirements.recipient)}</p>
    <p><strong>Network:</strong> ${requirements.network}</p>
  `;

  container.classList.remove('hidden');
}

async function payAndRetry() {
  const btn = document.getElementById('pay-btn');
  const originalText = btn.textContent;

  if (!currentPaymentRequirements) {
    logger.error('No payment requirements found');
    return;
  }

  if (!walletService.isConnected()) {
    logger.error('Wallet not connected. Please load wallet first.');
    showNotification('Please load wallet first!', 'error');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Signing...';
    logger.info('Signing transaction');

    const signedTxHex = await walletService.signTransaction({
      to: currentPaymentRequirements.recipient,
      amount: currentPaymentRequirements.amount,
    });

    btn.textContent = 'Submitting...';
    logger.info('Submitting payment to server');

    const response = await apiService.paid(signedTxHex);

    if (response.ok) {
      logger.success('Payment successful - Access granted');
      logger.info(`Transaction Hash: ${response.data.transaction_hash}`);
      showResult('paid-result', response.data, 'success');
      document.getElementById('payment-requirements').classList.add('hidden');
      currentPaymentRequirements = null;
      btn.textContent = 'Payment Complete';
    } else {
      logger.error('Payment failed');
      showResult('paid-result', response.data, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (error) {
    logger.error(`Payment error: ${error.message}`);
    showResult('paid-result', { error: error.message }, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function clearLogs() {
  logger.clear();
  logger.info('Application initialized');
}

document.getElementById('load-wallet-btn').addEventListener('click', connectWallet);
document.getElementById('refresh-balance-btn').addEventListener('click', async () => {
  if (walletService.isConnected()) {
    await walletService.fetchBalance();
    const receiverAddress = document.getElementById('receiver-address')?.textContent;
    if (receiverAddress) {
      await walletService.fetchReceiverBalance(receiverAddress);
    }
  } else {
    logger.error('Wallet not connected. Load wallet first.');
  }
});
document.getElementById('test-health-btn').addEventListener('click', testHealth);
document.getElementById('test-free-btn').addEventListener('click', testFree);
document.getElementById('test-paid-btn').addEventListener('click', testPaid);
document.getElementById('pay-btn').addEventListener('click', payAndRetry);
document.getElementById('clear-logs-btn').addEventListener('click', clearLogs);

logger.info('Application initialized');
logger.info(`Server URL: ${SERVER_URL}`);
logger.info(`Network: ${POLKADOT_NETWORK}`);

if (localStorage.getItem('walletWasLoaded') === 'true') {
  logger.info('Auto-loading wallet from previous session');
  showPageLoader('Loading Wallet');
  setTimeout(async () => {
    try {
      await connectWallet();
    } finally {
      hidePageLoader();
    }
  }, 1000);
}
