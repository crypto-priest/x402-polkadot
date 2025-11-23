# x402 Polkadot Server

Backend API server implementing x402 payment protocol for Polkadot.

## Overview

The Server is the main API that clients interact with. It:
- Implements x402 payment protocol (HTTP 402)
- Handles payment verification via facilitator
- Returns protected content after successful payment
- Provides free and paid endpoints

## Architecture

```
┌─────────────────────────────────────┐
│         Server (Backend)            │
├─────────────────────────────────────┤
│  API Layer                          │
│  ├── /api/health  (GET)             │
│  ├── /api/free    (GET)             │
│  └── /api/paid    (GET) - x402      │
├─────────────────────────────────────┤
│  x402 Protocol Handler              │
│  ├── Extract X-PAYMENT header       │
│  └── Return 402 if no payment       │
├─────────────────────────────────────┤
│  Facilitator Client                 │
│  ├── Verify payment                 │
│  └── Settle payment                 │
└─────────────────────────────────────┘
           ↓
    Facilitator Service
```

## Module Structure

```
src/
├── main.rs              # Entry point, server setup
├── config.rs            # Environment configuration
├── error.rs             # Error types and handling
├── api/
│   ├── mod.rs
│   ├── models.rs        # Response types
│   └── routes.rs        # HTTP handlers
├── x402/
│   ├── mod.rs
│   ├── types.rs         # Payment types
│   └── protocol.rs      # x402 protocol logic
└── facilitator/
    ├── mod.rs
    ├── client.rs        # Facilitator HTTP client
    └── types.rs         # Request/response types
```

## Setup

### 1. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
SERVER_HOST=127.0.0.1
SERVER_PORT=3000
FACILITATOR_URL=http://127.0.0.1:8080
RECEIVER_WALLET_ADDRESS=5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
DEFAULT_PRICE=1000000000000
POLKADOT_NETWORK=westend
RUST_LOG=info,x402_polkadot_server=debug
```

### 2. Build

```bash
cargo build --release
```

### 3. Run

```bash
cargo run
```

Server will start on `http://127.0.0.1:3000`

## API Endpoints

### Health Check

```bash
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "network": "westend",
  "facilitator_url": "http://127.0.0.1:8080"
}
```

### Free Endpoint

```bash
GET /api/free
```

Response:
```json
{
  "message": "This is a free endpoint",
  "data": "No payment required to access this data"
}
```

### Paid Endpoint (x402)

**Without Payment:**

```bash
GET /api/paid
```

Response (402 Payment Required):
```json
{
  "error": "PaymentRequired",
  "message": "Payment is required to access this resource",
  "paymentRequirements": {
    "amount": 1000000000000,
    "recipient": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "network": "westend",
    "currency": "DOT"
  }
}
```

**With Payment:**

```bash
GET /api/paid
X-PAYMENT: {"from":"...","to":"...","amount":1000000000000,"signature":"0x...","nonce":1}
```

Response (200 OK):
```json
{
  "message": "Payment successful",
  "data": "This is protected content that requires payment",
  "transaction_hash": "0x1234..."
}
```

## Payment Flow

1. Client requests `/api/paid` without payment
2. Server returns **402 Payment Required** with payment requirements
3. Client creates and signs transaction
4. Client retries request with **X-PAYMENT** header
5. Server calls facilitator to **verify** payment
6. Server calls facilitator to **settle** payment
7. Server returns **200 OK** with protected content

## Testing

```bash
# Run unit tests
cargo test

# Test health endpoint
curl http://localhost:3000/api/health

# Test free endpoint
curl http://localhost:3000/api/free

# Test paid endpoint (should return 402)
curl http://localhost:3000/api/paid

# Test paid endpoint with payment (mock)
curl http://localhost:3000/api/paid \
  -H "X-PAYMENT: {\"from\":\"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY\",\"to\":\"5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty\",\"amount\":1000000000000,\"signature\":\"0xabcdef\",\"nonce\":1}"
```

## Development Notes

- Clean module separation
- x402 protocol implementation
- Facilitator client with retry logic
- Comprehensive error handling
- Structured logging
- CORS enabled for all origins

## Dependencies

- **axum**: Web framework
- **reqwest**: HTTP client for facilitator
- **tokio**: Async runtime
- **serde**: Serialization
- **tracing**: Structured logging

## Next Steps

- [ ] Add request caching
- [ ] Add rate limiting per wallet
- [ ] Add payment history tracking
- [ ] Add metrics endpoint
- [ ] Add Docker support
