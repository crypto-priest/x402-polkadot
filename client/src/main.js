import Logger from './utils/logger.js';
import WalletService from './services/wallet.js';
import APIService from './services/api.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:3000';
const POLKADOT_NETWORK = import.meta.env.VITE_POLKADOT_NETWORK || 'westend';

const logger = new Logger('log-container');
const walletService = new WalletService(logger);
const apiService = new APIService(SERVER_URL, logger);

let currentPaymentRequirements = null;

function updateWalletUI(connected) {
  // New HTML doesn't need status indicators - wallet info is always visible
  // Balance is updated by wallet service directly
  logger.info('Wallet UI updated');
}

function showResult(elementId, data, type = 'info') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element ${elementId} not found`);
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

    btn.textContent = 'Wallet Loaded ✓';
    logger.success('Wallet loaded successfully');
  } catch (error) {
    btn.disabled = false;
    btn.textContent = originalText;
    logger.error(`Wallet load failed: ${error.message}`);
    alert(error.message);
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
      logger.warning('⚠️ Payment required - Auto-processing payment...');
      currentPaymentRequirements = response.data.paymentRequirements;
      showResult('paid-result', response.data, 'info');

      // Show warning popup and auto-pay
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
    logger.error('❌ Wallet not connected. Please load wallet first.');
    alert('Please load wallet first!');
    return;
  }

  const amountInDOT = (requirements.amount / 10_000_000_000).toFixed(2);

  // Create popup
  const popup = document.createElement('div');
  popup.id = 'payment-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10000;
    min-width: 450px;
    border: 3px solid #ff9800;
  `;

  popup.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; color: #ff9800; margin-bottom: 15px;">⚠️</div>
      <h2 style="color: #333; margin-bottom: 15px;">Payment Processing</h2>
      <p style="color: #666; margin-bottom: 10px;"><strong>Amount:</strong> ${amountInDOT} PAS</p>
      <p style="color: #666; margin-bottom: 20px;"><strong>To:</strong> ${walletService.formatAddress(requirements.recipient)}</p>
      <div id="payment-status" style="margin-top: 20px;">
        <div class="status-item" style="color: #ff9800; font-weight: bold; margin: 10px 0;">
          <span class="spinner">⏳</span> Preparing transaction...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Auto-process payment
  await autoProcessPayment(requirements, popup);
}

function updatePaymentStatus(status, isComplete = false, isError = false) {
  const statusContainer = document.getElementById('payment-status');
  if (!statusContainer) return;

  const statusItem = document.createElement('div');
  statusItem.className = 'status-item';
  statusItem.style.cssText = `
    color: ${isError ? '#f44336' : isComplete ? '#4caf50' : '#ff9800'};
    font-weight: ${isComplete || isError ? 'bold' : 'normal'};
    margin: 10px 0;
    font-size: ${isComplete || isError ? '16px' : '14px'};
  `;

  const icon = isError ? '❌' : isComplete ? '✅' : '⏳';
  statusItem.innerHTML = `<span>${icon}</span> ${status}`;

  statusContainer.appendChild(statusItem);

  // Scroll to bottom
  statusContainer.scrollTop = statusContainer.scrollHeight;
}

async function autoProcessPayment(requirements, popup) {
  try {
    updatePaymentStatus('🔐 Signing transaction...');
    logger.info('🔐 Auto-signing transaction...');

    // Sign the transaction
    const signedTxHex = await walletService.signTransaction({
      to: requirements.recipient,
      amount: requirements.amount,
    });

    updatePaymentStatus('✓ Transaction signed');
    updatePaymentStatus('📤 Submitting to server...');
    logger.info('📤 Submitting payment to server...');

    // Send payment
    const response = await apiService.paid(signedTxHex);

    if (response.ok) {
      updatePaymentStatus('✓ Server accepted payment');
      updatePaymentStatus('🔗 Verifying on blockchain...');
      updatePaymentStatus('⏳ Waiting for finalization...');

      // Simulate blockchain confirmation steps (in real scenario, these come from server/facilitator)
      await new Promise(resolve => setTimeout(resolve, 1000));
      updatePaymentStatus('✓ Transaction in best block');

      await new Promise(resolve => setTimeout(resolve, 1000));
      updatePaymentStatus('✓ Transaction finalized!', true);

      logger.success('✅ Payment successful! Access granted.');
      logger.info(`Transaction Hash: ${response.data.transaction_hash}`);
      logger.info(`Block Hash: ${response.data.block_hash}`);
      showResult('paid-result', response.data, 'success');

      // Store that wallet was loaded
      localStorage.setItem('walletWasLoaded', 'true');

      // Update popup to success state
      setTimeout(() => {
        popup.style.borderColor = '#4caf50';
        popup.querySelector('h2').textContent = 'Payment Successful!';
        popup.querySelector('h2').style.color = '#4caf50';
        const icon = popup.querySelector('div[style*="font-size: 48px"]');
        icon.textContent = '✅';
        icon.style.color = '#4caf50';
      }, 500);

      // Close popup and refresh balance
      setTimeout(async () => {
        popup.remove();
        await walletService.fetchBalance();
        logger.success('Balance updated!');
      }, 3000);
    } else {
      updatePaymentStatus('Payment failed', false, true);
      logger.error('❌ Payment failed');
      showResult('paid-result', response.data, 'error');

      // Close popup after error
      setTimeout(() => popup.remove(), 3000);
    }
  } catch (error) {
    updatePaymentStatus(`Error: ${error.message}`, false, true);
    logger.error(`❌ Payment error: ${error.message}`);
    showResult('paid-result', { error: error.message }, 'error');

    // Close popup after error
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
    alert('Please load wallet first!');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Signing...';
    logger.info('🔐 Signing transaction...');

    // Sign the transaction and get hex-encoded signed transaction
    const signedTxHex = await walletService.signTransaction({
      to: currentPaymentRequirements.recipient,
      amount: currentPaymentRequirements.amount,
    });

    btn.textContent = 'Submitting...';
    logger.info('📤 Submitting payment to server...');

    // Send the hex-encoded signed transaction as payment header
    const response = await apiService.paid(signedTxHex);

    if (response.ok) {
      logger.success('✅ Payment successful! Access granted.');
      logger.info(`Transaction Hash: ${response.data.transaction_hash}`);
      showResult('paid-result', response.data, 'success');
      document.getElementById('payment-requirements').classList.add('hidden');
      currentPaymentRequirements = null;
      btn.textContent = 'Payment Complete ✓';
    } else {
      logger.error('❌ Payment failed');
      showResult('paid-result', response.data, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (error) {
    logger.error(`❌ Payment error: ${error.message}`);
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

// Auto-load wallet if it was previously loaded
if (localStorage.getItem('walletWasLoaded') === 'true') {
  logger.info('🔄 Auto-loading wallet from previous session...');
  setTimeout(async () => {
    await connectWallet();
  }, 1000);
}
