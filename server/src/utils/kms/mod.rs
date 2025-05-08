use aws_sdk_kms::Client;
use aws_sdk_s3::primitives::Blob;
use base64::{engine::general_purpose, Engine};

pub async fn decrypt_kms(kms_client: &Client, value: String) -> String {
    let kms_client = kms_client.clone();
    let value = kms_client
        .decrypt()
        .ciphertext_blob(Blob::new(
            general_purpose::STANDARD
                .decode(value)
                .expect("Failed to decode base64"),
        ))
        .send()
        .await;
    String::from_utf8(
        value
            .expect("Failed to decode DB_Password")
            .plaintext()
            .expect("Failed to decode DB_Password from plain text")
            .as_ref()
            .to_vec(),
    )
    .expect("Could not convert to UTF-8")
}
