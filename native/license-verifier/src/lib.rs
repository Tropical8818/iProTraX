use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use p256::ecdsa::{VerifyingKey, Signature, signature::Verifier};
use p256::pkcs8::DecodePublicKey;

// Embedded Public Key (SPKI format)
// We strip the header/footer and newlines to have the raw base64 data, 
// or we can parse the PEM. Parsing PEM in pure Rust without standard library file IO 
// (though we can use strings) is fine.
// But for "enterprise security", let's store it as raw bytes or at least clean base64 
// to avoid easy string search "BEGIN PUBLIC KEY".
// 
// The key provided:
// MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9BNislruXoueGcZGYR0jRof5Nzs
// iuiO2hubmiA6JosZUDf1UN4kli5BGBms/pfYoKFA3pT3b5N1sn0+8fE4OQ==

const PUB_KEY_B64: &str = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9BNislruXoueGcZGYR0jRof5Nzs\
                           iuiO2hubmiA6JosZUDf1UN4kli5BGBms/pfYoKFA3pT3b5N1sn0+8fE4OQ==";

#[derive(Serialize, Deserialize, Debug)]
struct LicensePayload {
    #[serde(rename = "customerName")]
    customer_name: String,
    #[serde(rename = "type")]
    license_type: String,
    #[serde(default)]
    #[serde(rename = "maxProductLines")]
    max_product_lines: u32,
    #[serde(default)]
    #[serde(rename = "maxUsers")]
    max_users: Option<u32>,
    #[serde(rename = "expiresAt")]
    expires_at: String, // ISO format
}

#[derive(Serialize)]
struct VerificationResult {
    valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    claims: Option<LicensePayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[wasm_bindgen]
pub fn verify_license(token: &str) -> JsValue {
    let result = verify_internal(token);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

fn verify_internal(token: &str) -> VerificationResult {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return VerificationResult { valid: false, claims: None, error: Some("Invalid token format".to_string()) };
    }

    let header_b64 = parts[0];
    let payload_b64 = parts[1];
    let signature_b64 = parts[2];

    // 1. Reconstruct message
    let message = format!("{}.{}", header_b64, payload_b64);

    // 2. Decode Signature
    // JWT uses Base64URL, standard Base64 might fail on URL safe chars
    // So we use base64::engine::general_purpose::URL_SAFE_NO_PAD
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    let signature_bytes = match URL_SAFE_NO_PAD.decode(signature_b64) {
        Ok(b) => b,
        Err(_) => return VerificationResult { valid: false, claims: None, error: Some("Invalid signature encoding".to_string()) },
    };
    // Try native raw first (standard JWT), then DER
    let signature = if signature_bytes.len() == 64 {
         Signature::from_slice(&signature_bytes).ok()
    } else {
         Signature::from_der(&signature_bytes).ok()
    };
    
    let signature = match signature {
        Some(s) => s,
        None => return VerificationResult { valid: false, claims: None, error: Some("Invalid signature length/format".to_string()) },
    };

    // 3. Decode Public Key
    // The constant is SPKI (DER) base64 encoded.
    let pub_key_bytes = match base64::engine::general_purpose::STANDARD.decode(PUB_KEY_B64) {
        Ok(b) => b,
        Err(_) => return VerificationResult { valid: false, claims: None, error: Some("Invalid public key error".to_string()) },
    };
    
    let verifying_key = match VerifyingKey::from_public_key_der(&pub_key_bytes) {
        Ok(k) => k,
        Err(_) => return VerificationResult { valid: false, claims: None, error: Some("Key parsing error".to_string()) },
    };

    // 4. Verify
    if verifying_key.verify(message.as_bytes(), &signature).is_err() {
        return VerificationResult { valid: false, claims: None, error: Some("Signature verification failed".to_string()) };
    }

    // 5. Decode Payload
    let payload_bytes = match URL_SAFE_NO_PAD.decode(payload_b64) {
        Ok(b) => b,
        Err(_) => return VerificationResult { valid: false, claims: None, error: Some("Invalid payload encoding".to_string()) },
    };

    let payload: LicensePayload = match serde_json::from_slice(&payload_bytes) {
        Ok(p) => p,
        Err(_) => return VerificationResult { valid: false, claims: None, error: Some("Invalid payload JSON".to_string()) },
    };

    // 6. Check Expiration
    let expires_at_str = &payload.expires_at;
    let expires_at = match chrono::DateTime::parse_from_rfc3339(expires_at_str) {
        Ok(d) => d,
        Err(_) => {
            // Try lenient parsing if needed, but ISO is expected
             return VerificationResult { valid: false, claims: None, error: Some("Invalid expiration date format".to_string()) }
        }
    };
    
    let now = chrono::Utc::now();
    if expires_at < now {
        return VerificationResult { 
            valid: false, 
            claims: Some(payload), 
            error: Some("License expired".to_string()) 
        };
    }

    VerificationResult {
        valid: true,
        claims: Some(payload),
        error: None,
    }
}
