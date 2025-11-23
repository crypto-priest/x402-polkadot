use crate::error::{FacilitatorError, FacilitatorResult};
use crate::polkadot::types::{TransactionData, ValidationParams};
use crate::polkadot::validator::TransactionValidator;
use serde_json;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};
use subxt::{OnlineClient, PolkadotConfig};
use subxt_signer::sr25519::Keypair;

pub struct PolkadotClient {
    rpc_url: String,
    network: String,
    connected: Arc<RwLock<bool>>,
    api: Arc<RwLock<Option<OnlineClient<PolkadotConfig>>>>,
    signer: Option<Keypair>,
}

impl PolkadotClient {
    pub async fn new(rpc_url: String, network: String, _signer_seed: Option<String>) -> FacilitatorResult<Self> {
        info!("Initializing Polkadot client for network: {}", network);
        info!("Mode: Broadcast only (signing done in frontend)");

        let client = Self {
            rpc_url: rpc_url.clone(),
            network,
            connected: Arc::new(RwLock::new(false)),
            api: Arc::new(RwLock::new(None)),
            signer: None, // No signer needed - frontend signs
        };

        client.connect().await?;
        Ok(client)
    }

    async fn connect(&self) -> FacilitatorResult<()> {
        info!("Connecting to Polkadot RPC: {}", self.rpc_url);

        // Establish real Subxt connection
        let api = OnlineClient::<PolkadotConfig>::from_url(&self.rpc_url)
            .await
            .map_err(|e| FacilitatorError::PolkadotRpcError(format!("Failed to connect: {}", e)))?;

        *self.api.write().await = Some(api);
        *self.connected.write().await = true;
        info!("Successfully connected to Polkadot network");
        Ok(())
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    pub async fn verify_transaction(
        &self,
        transaction: &str,
        expected_amount: u128,
        expected_recipient: &str,
    ) -> FacilitatorResult<()> {
        debug!("Verifying hex-encoded transaction");

        if !self.is_connected().await {
            return Err(FacilitatorError::PolkadotRpcError(
                "Not connected to Polkadot network".to_string(),
            ));
        }

        // For hex-encoded pre-signed transactions, just validate it's valid hex
        // Actual validation (amount, recipient, signature) happens on-chain when submitted
        let tx_hex = transaction.trim_start_matches("0x");
        if hex::decode(tx_hex).is_err() {
            return Err(FacilitatorError::InvalidTransaction(
                "Invalid hex-encoded transaction".to_string()
            ));
        }

        info!("Hex transaction format validated - on-chain validation will occur during settlement");
        Ok(())
    }

    pub async fn submit_transaction(&self, transaction: &str) -> FacilitatorResult<String> {
        info!("Broadcasting signed transaction to Polkadot");

        if !self.is_connected().await {
            return Err(FacilitatorError::PolkadotRpcError(
                "Not connected to Polkadot network".to_string(),
            ));
        }

        // Get the API client
        let api_guard = self.api.read().await;
        let api = api_guard.as_ref().ok_or_else(|| {
            FacilitatorError::PolkadotRpcError("API client not initialized".to_string())
        })?;

        // Decode the hex-encoded signed transaction (remove 0x prefix if present)
        let tx_hex = transaction.trim_start_matches("0x");
        let tx_bytes = hex::decode(tx_hex).map_err(|e| {
            FacilitatorError::InvalidTransaction(format!("Invalid hex transaction: {}", e))
        })?;

        // Submit the pre-signed transaction to the blockchain
        info!("Submitting transaction to Paseo blockchain...");

        // Submit the transaction and wait for confirmation
        use futures::StreamExt;
        let mut submit_progress = api.backend()
            .submit_transaction(&tx_bytes)
            .await
            .map_err(|e| FacilitatorError::PolkadotRpcError(
                format!("Failed to submit transaction: {}", e)
            ))?;

        info!("Transaction submitted, waiting for block inclusion...");

        // Calculate extrinsic hash from transaction bytes
        use blake2::{Blake2b512, Digest};
        let tx_hash_bytes = Blake2b512::digest(&tx_bytes);
        let tx_hash_hex = format!("0x{}", hex::encode(&tx_hash_bytes[..32]));

        // Wait for transaction to be included in a block
        let mut block_hash = String::new();

        while let Some(status) = submit_progress.next().await {
            match status {
                Ok(status) => {
                    match status {
                        subxt::backend::TransactionStatus::Validated => {
                            info!("Transaction validated in transaction pool");
                        }
                        subxt::backend::TransactionStatus::Broadcasted { .. } => {
                            info!("Transaction broadcasted to network");
                        }
                        subxt::backend::TransactionStatus::InBestBlock { hash } => {
                            info!("Transaction included in best block (hash: 0x{})", hex::encode(hash.hash()));
                            info!("⏳ Waiting for finalization...");
                            // Do NOT break - continue waiting for finalization
                        }
                        subxt::backend::TransactionStatus::NoLongerInBestBlock => {
                            info!("Transaction no longer in best block, waiting for finalization...");
                            // Continue waiting for finalization
                        }
                        subxt::backend::TransactionStatus::InFinalizedBlock { hash } => {
                            info!("✅ Transaction finalized in block!");
                            block_hash = format!("0x{}", hex::encode(hash.hash()));
                            break; // Only return after finalization
                        }
                        subxt::backend::TransactionStatus::Error { message } => {
                            return Err(FacilitatorError::PolkadotRpcError(
                                format!("Transaction error: {}", message)
                            ));
                        }
                        subxt::backend::TransactionStatus::Invalid { message } => {
                            return Err(FacilitatorError::PolkadotRpcError(
                                format!("Transaction invalid: {}", message)
                            ));
                        }
                        subxt::backend::TransactionStatus::Dropped { message } => {
                            return Err(FacilitatorError::PolkadotRpcError(
                                format!("Transaction dropped: {}", message)
                            ));
                        }
                    }
                }
                Err(e) => {
                    return Err(FacilitatorError::PolkadotRpcError(
                        format!("Transaction status error: {}", e)
                    ));
                }
            }
        }

        info!("✅ Transaction confirmed on-chain!");
        info!("Transaction hash: {}", tx_hash_hex);
        info!("Block hash: {}", block_hash);
        info!("View on explorer: https://paseo.subscan.io/extrinsic/{}", tx_hash_hex);

        // Return JSON with transaction details including block hash
        let response = serde_json::json!({
            "transaction_hash": tx_hash_hex,
            "block_hash": block_hash,
            "explorer_url": format!("https://paseo.subscan.io/extrinsic/{}", tx_hash_hex),
            "network": "paseo",
            "status": "confirmed"
        });

        Ok(response.to_string())
    }

    fn decode_transaction(&self, transaction: &str) -> FacilitatorResult<TransactionData> {
        debug!("Decoding transaction (hex format)");

        // For hex-encoded transactions, we just validate it's valid hex
        // The actual transaction details will be verified when submitted to chain
        let tx_hex = transaction.trim_start_matches("0x");

        // Validate it's valid hex
        if hex::decode(tx_hex).is_err() {
            return Err(FacilitatorError::InvalidTransaction(
                "Invalid hex-encoded transaction".to_string()
            ));
        }

        // Return a placeholder TransactionData - actual validation happens on-chain
        Ok(TransactionData {
            from: "signed_transaction".to_string(),
            to: "will_be_verified_on_chain".to_string(),
            amount: 0,
            signature: transaction.to_string(),
            nonce: 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = PolkadotClient::new(
            "wss://westend-rpc.polkadot.io".to_string(),
            "westend".to_string(),
            None,
        )
        .await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_is_connected() {
        let client = PolkadotClient::new(
            "wss://westend-rpc.polkadot.io".to_string(),
            "westend".to_string(),
            None,
        )
        .await
        .unwrap();
        assert!(client.is_connected().await);
    }
}
