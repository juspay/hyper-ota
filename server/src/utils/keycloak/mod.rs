use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use keycloak::{
    self, KeycloakAdminToken, KeycloakError, KeycloakServiceAccountAdminTokenRetriever,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::types::Environment;

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,                // User ID
    pub preferred_username: String, // Name
    pub email: Option<String>,
    pub realm_access: Option<Roles>,
}

#[derive(Serialize, Deserialize)]
pub struct Roles {
    pub roles: Vec<String>, // Roles assigned to the user
}

pub async fn get_token(
    env: Environment,
    client: Client,
) -> Result<KeycloakAdminToken, KeycloakError> {
    // Move ENVs to App State
    let url = env.keycloak_url.clone();
    let client_id = env.client_id.clone();
    let secret = env.secret.clone();
    let realm = env.realm.clone();

    // See if keycloak admin can be in app state as well
    let token_retriever = KeycloakServiceAccountAdminTokenRetriever::create_with_custom_realm(
        &client_id, &secret, &realm, client,
    );

    // Fetch client level admin token
    return token_retriever.acquire(&url).await;
}

pub fn decode_jwt_token(
    token: &str,
    public_key: &str,
) -> Result<TokenData<Claims>, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_rsa_pem(public_key.as_bytes())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_audience(&["hyper-ota-server"]);
    decode::<Claims>(token, &key, &validation)
}
