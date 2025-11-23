# x402 Polkadot Facilitator

Transaction verification and submission service for x402 payment protocol on Polkadot.

## Overview

The Facilitator is a standalone Rust service that handles:
- Transaction validation (amount, recipient, signature)
- Transaction submission to Polkadot network
- Payment settlement confirmation

## Architecture

```
┌─────────────────────────────────────┐
│         Facilitator Service         │
├─────────────────────────────────────┤
│  API Layer                          │
│  ├── /health  (GET)                 │
│  ├── /verify  (POST)                │
│  └── /settle  (POST)                │
├─────────────────────────────────────┤
│  Polkadot Integration (Subxt)      │
│  ├── Transaction Validator          │
│  └── Transaction Submitter          │
└─────────────────────────────────────┘
           ↓
    Polkadot Network
```

## Module Structure

```
src/
├── main.rs              # Entry point, server setup
├── config.rs            # Environment configuration
├── error.rs             # Error types and handling
├── api/
│   ├── mod.rs
│   ├── models.rs        # Request/response types
│   └── routes.rs        # HTTP handlers
└── polkadot/
    ├── mod.rs
    ├── client.rs        # Polkadot client (Subxt)
    ├── types.rs         # Transaction types
    └── validator.rs     # Validation logic
```

## Setup

### 1. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env`:
```env
POLKADOT_NETWORK=westend
POLKADOT_RPC_URL=wss://westend-rpc.polkadot.io
FACILITATOR_HOST=127.0.0.1
FACILITATOR_PORT=8080
RUST_LOG=info,x402_polkadot_facilitator=debug
```

### 2. Build

```bash
cargo build --release
```

### 3. Run

```bash
cargo run
```

Server will start on `http://127.0.0.1:8080`

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "network": "westend",
  "connected": true
}
```

### Verify Transaction

```bash
POST /verify
Content-Type: application/json

{
  "transaction": "{\"from\":\"...\",\"to\":\"...\",\"amount\":1000000000000,\"signature\":\"0x...\",\"nonce\":1}",
  "expected_amount": 1000000000000,
  "expected_recipient": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
}
```

Response:
```json
{
  "valid": true,
  "message": "Transaction verified successfully"
}
```

### Settle Transaction

```bash
POST /settle
Content-Type: application/json

{
  "transaction": "{\"from\":\"...\",\"to\":\"...\",\"amount\":1000000000000,\"signature\":\"0x...\",\"nonce\":1}"
}
```

Response:
```json
{
  "settled": true,
  "transaction_hash": "0x1234...",
  "message": "Transaction settled successfully"
}
```

## Transaction Format

Transactions are JSON-encoded strings:

```json
{
  "from": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "to": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
  "amount": 1000000000000,
  "signature": "0xabcdef...",
  "nonce": 1
}
```

**Amount**: In plancks (1 DOT = 10^10 plancks)

## Testing

```bash
# Run unit tests
cargo test

# Run with coverage
cargo test -- --nocapture

# Test health endpoint
curl http://localhost:8080/health
```

## Development Notes

- Clean module separation
- Comprehensive error handling
- Structured logging
- CORS enabled for all origins
- Type-safe with Rust's type system

## Next Steps

- [ ] Implement real Subxt integration (currently mocked)
- [ ] Add transaction signature verification
- [ ] Add retry logic for network failures
- [ ] Add transaction caching
- [ ] Add metrics endpoint
- [ ] Add Docker support

## Dependencies

- **axum**: Web framework
- **subxt**: Polkadot/Substrate client
- **tokio**: Async runtime
- **serde**: Serialization
- **tracing**: Structured logging
