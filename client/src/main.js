import Logger from './utils/logger.js';
import WalletService from './services/wallet.js';
import APIService from './services/api.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3000';
const POLKADOT_NETWORK = import.meta.env.VITE_POLKADOT_NETWORK || 'westend';

const logger = new Logger('log-container');
const walletService = new WalletService(logger);
const apiService = new APIService(SERVER_URL, logger);

let currentPaymentRequirements = null;

function showPageLoader(message = 'Loading...') {
  const loader = document.createElement('div');
  loader.id = 'page-loader';
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  loader.innerHTML = `
    <div style="background: #ffffff; padding: 40px 50px; border-radius: 12px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="width: 50px; height: 50px; border: 4px solid #e0e0e0; border-top-color: #2A5244; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
      <div style="color: #2A5244; font-weight: 600; font-size: 18px; margin-bottom: 8px;">${message}</div>
      <div style="color: #666; font-size: 14px;">Please wait...</div>
    </div>
  `;

  document.body.appendChild(loader);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s';
    setTimeout(() => loader.remove(), 300);
  }
}

function showNotification(message, type = 'error') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ffffff;
    padding: 25px 30px;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    z-index: 10001;
    max-width: 400px;
    border-left: 4px solid ${type === 'error' ? '#c62828' : '#2A5244'};
    animation: fadeIn 0.2s ease-out;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 24px;">${type === 'error' ? '⚠️' : 'ℹ️'}</div>
      <div>
        <div style="color: ${type === 'error' ? '#c62828' : '#2A5244'}; font-weight: 600; font-size: 16px; margin-bottom: 4px;">
          ${type === 'error' ? 'Error' : 'Notice'}
        </div>
        <div style="color: #1a1a1a; font-size: 14px; line-height: 1.5;">
          ${message}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.2s';
    setTimeout(() => notification.remove(), 200);
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
    logger.error('Wallet not connected. Please load wallet first.');
    showNotification('Please load wallet first!', 'error');
    return;
  }

  const amountInDOT = (requirements.amount / 10_000_000_000).toFixed(2);

  const popup = document.createElement('div');
  popup.id = 'payment-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #ffffff;
    padding: 35px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 650px;
    border: 2px solid #2A5244;
  `;

  popup.innerHTML = `
    <div>
      <h2 style="color: #2A5244; margin: 0 0 10px 0; font-size: 22px;">API Payment Request</h2>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #666; font-weight: 500;">Amount:</span>
          <span style="color: #1a1a1a; font-weight: 600;">${amountInDOT} PAS</span>
        </div>
        <div style="margin-bottom: 0;">
          <div style="color: #666; font-weight: 500; margin-bottom: 4px;">Recipient Address:</div>
          <div style="color: #1a1a1a; font-weight: 600; font-size: 13px; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace; word-break: break-all; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e0e0e0;">${requirements.recipient}</div>
        </div>
      </div>
      <div id="payment-status" style="background: #fafafa; padding: 15px; border-radius: 8px; margin-bottom: 15px; min-height: 100px; max-height: 200px; overflow-y: auto;"></div>
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; border-radius: 4px; font-size: 13px; color: #856404;">
        <strong>Demo Mode:</strong> This popup shows the payment flow for demonstration. In production, these steps happen automatically in the background without user interaction.
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  await autoProcessPayment(requirements, popup);
}

function updatePaymentStatus(status, isComplete = false, isError = false) {
  const statusContainer = document.getElementById('payment-status');
  if (!statusContainer) return;

  const statusItem = document.createElement('div');
  statusItem.className = 'status-item';
  statusItem.style.cssText = `
    color: ${isError ? '#c62828' : isComplete ? '#2e7d32' : '#1a1a1a'};
    font-weight: ${isComplete || isError ? '600' : '500'};
    margin: 8px 0;
    font-size: 14px;
    padding: 8px 12px;
    background: ${isError ? '#ffebee' : isComplete ? '#e8f5e9' : '#f5f5f5'};
    border-radius: 6px;
    border-left: 3px solid ${isError ? '#c62828' : isComplete ? '#2e7d32' : '#2A5244'};
  `;

  const icon = isError ? 'X' : isComplete ? 'OK' : '>';
  statusItem.innerHTML = `<span style="margin-right: 8px; font-weight: bold;">${icon}</span>${status}`;

  statusContainer.appendChild(statusItem);

  statusContainer.scrollTop = statusContainer.scrollHeight;
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
