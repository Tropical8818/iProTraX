use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use p256::ecdsa::{Signature, VerifyingKey, signature::Verifier};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

#[derive(Serialize, Deserialize)]
pub struct LicensePayload {
    pub customerName: String,
    #[serde(rename = "type")]
    pub type_: String, 
    pub maxProductLines: i32,
    pub maxUsers: i32,
    pub expiresAt: String,
    pub machineId: Option<String>,
}

#[derive(Serialize)]
pub struct VerificationResult {
    pub isValid: bool,
    pub error: Option<String>,
    pub payload: Option<LicensePayload>,
}

#[wasm_bindgen]
pub fn verify_license_wasm(
    jwt: &str, 
    public_key_pem: &str, 
    system_fingerprint_opt: Option<String>,
    current_timestamp_ms: f64
) -> String {
    
    // 1. Decode JWT (Simple 2-part split)
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return json_err("Invalid JWT format");
    }

    let payload_part = parts[1];
    let sig_part = parts[2];

    // 2. Decode Payload
    let payload_bytes = match URL_SAFE_NO_PAD.decode(payload_part) {
        Ok(b) => b,
        Err(_) => return json_err("Invalid Base64 payload"),
    };

    let payload: LicensePayload = match serde_json::from_slice(&payload_bytes) {
        Ok(p) => p,
        Err(e) => return json_err(&format!("Invalid JSON payload: {}", e)),
    };

    // 3. Verify Signature
    let message = format!("{}.{}", parts[0], parts[1]);
    if !verify_jwt_signature(&message, sig_part, public_key_pem) {
         return json_err("Signature verification failed");
    }

    // 4. Verify Expiry (Using timestamp from JS)
    if let Ok(expiry_date) = chrono::DateTime::parse_from_rfc3339(&payload.expiresAt) {
         let expiry_ms = expiry_date.timestamp_millis() as f64;
         if current_timestamp_ms > expiry_ms {
             return json_err("License expired");
         }
    }

    // 5. Verify Machine Binding
    if let Some(ref license_mid) = payload.machineId {
        if let Some(ref sys_fp) = system_fingerprint_opt {
             let sys_machine_id = sys_fp.split('|').next().unwrap_or("");
             if license_mid != sys_machine_id {
                  return json_err(&format!("Machine ID mismatch. License bound to {}, system is {}", license_mid, sys_machine_id));
             }
        } else {
             return json_err("License requires machine binding, but no system ID provided");
        }
    }

    // Success
    let res = VerificationResult {
        isValid: true,
        error: None,
        payload: Some(payload),
    };
    serde_json::to_string(&res).unwrap_or_else(|_| "{}".to_string())
}

fn json_err(msg: &str) -> String {
    let res = VerificationResult {
        isValid: false,
        error: Some(msg.to_string()),
        payload: None,
    };
    serde_json::to_string(&res).unwrap_or_else(|_| "{}".to_string())
}

fn verify_jwt_signature(message: &str, signature_b64: &str, pub_key_pem: &str) -> bool {
    let signature_bytes = match URL_SAFE_NO_PAD.decode(signature_b64) {
        Ok(b) => b,
        Err(_) => return false,
    };

    use p256::pkcs8::DecodePublicKey;
    let verifying_key = match VerifyingKey::from_public_key_pem(pub_key_pem) {
        Ok(k) => k,
        Err(_) => return false,
    };

    let signature = match Signature::from_slice(&signature_bytes) {
         Ok(s) => s,
         Err(_) => return false,
    };

    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}
