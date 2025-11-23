# x402 Polkadot Client

Frontend application for testing x402 payment protocol with Polkadot.

## Overview

The Client is a web-based interface that:
- Connects to Polkadot wallets (Polkadot.js extension)
- Tests API endpoints (health, free, paid)
- Handles x402 payment flow
- Signs transactions with connected wallet
- Displays real-time activity logs

## Features

- **Wallet Integration**: Connect Polkadot.js extension
- **Clean UI**: Separate CSS file with modern design
- **Payment Flow**: Complete x402 protocol implementation
- **Activity Logging**: Real-time logs for all actions
- **Responsive**: Works on desktop and mobile

## Project Structure

```
client/
├── index.html              # Main HTML file
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies
├── .env.example            # Environment template
└── src/
    ├── main.js             # Application entry point
    ├── styles/
    │   └── main.css        # Clean, separated CSS
    ├── services/
    │   ├── wallet.js       # Wallet connection & signing
    │   └── api.js          # API client
    └── utils/
        └── logger.js       # Activity logger
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SERVER_URL=http://127.0.0.1:3000
VITE_POLKADOT_NETWORK=westend
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend will start on `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.

## Prerequisites

- **Polkadot.js Extension**: Install from [Chrome Web Store](https://chrome.google.com/webstore/detail/polkadot%7Bjs%7D-extension/mopnmbcafieddcagagdcbnhejhlodfdd)
- **Polkadot Account**: Create an account in the extension
- **Testnet Tokens**: Get tokens from [Westend Faucet](https://faucet.polkadot.io/)

## Usage

### 1. Connect Wallet

1. Click "Connect Wallet"
2. Extension popup will appear
3. Authorize the connection
4. Your address will be displayed

### 2. Test Endpoints

#### Health Check
- Click "Test /api/health"
- Should return server status

#### Free Endpoint
- Click "Test /api/free"
- Returns data without payment

#### Paid Endpoint (x402)
- Click "Test /api/paid"
- Server returns 402 Payment Required
- Payment requirements displayed
- Click "Sign & Pay"
- Wallet will prompt for signature
- Transaction submitted to server
- Access granted on success

## Payment Flow

```
1. User clicks "Test /api/paid"
2. Server returns 402 with payment requirements
3. UI displays amount, recipient, network
4. User clicks "Sign & Pay"
5. Wallet extension prompts for signature
6. Transaction signed and submitted
7. Server verifies payment via facilitator
8. Server settles payment
9. Protected content returned
```

## Code Organization

### Clean Separation of Concerns

- **HTML**: Structure only (`index.html`)
- **CSS**: Styling in separate file (`styles/main.css`)
- **JavaScript**: Modular services
  - `wallet.js`: Wallet operations
  - `api.js`: API communication
  - `logger.js`: Logging utility
  - `main.js`: Application logic

### Services

#### WalletService
```javascript
await walletService.connect()
await walletService.signTransaction(tx)
walletService.getAddress()
```

#### APIService
```javascript
await apiService.health()
await apiService.free()
await apiService.paid(paymentHeader)
```

#### Logger
```javascript
logger.info('Message')
logger.success('Success')
logger.error('Error')
logger.warning('Warning')
```

## Styling

Clean, modern design with:
- Dark theme optimized for readability
- Polkadot brand colors (pink & purple)
- Responsive layout
- Smooth animations
- Custom scrollbars
- Status indicators

## Development Notes

- Built with Vite for fast development
- Vanilla JavaScript (no framework overhead)
- ES6 modules for clean imports
- Polkadot.js for wallet integration
- Fully typed with JSDoc comments

## Dependencies

- **@polkadot/extension-dapp**: Wallet connection
- **@polkadot/util**: Polkadot utilities
- **@polkadot/util-crypto**: Cryptography
- **vite**: Build tool

## Browser Compatibility

- Chrome/Brave (recommended)
- Firefox
- Edge
- Safari (with Polkadot.js extension)

## Troubleshooting

### Wallet not connecting
- Ensure Polkadot.js extension is installed
- Check if extension is enabled
- Try refreshing the page

### Payment failing
- Ensure wallet has sufficient balance
- Check network (Westend testnet)
- Verify server is running
- Check facilitator is running

## Next Steps

- [ ] Add transaction history
- [ ] Add network selector
- [ ] Add multi-account support
- [ ] Add QR code payment
- [ ] Add payment confirmation UI
