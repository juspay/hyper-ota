use crate::utils::db::models::ConfigEntry;
use crate::utils::db::schema::hyperotaserver::packages::dsl::*;
use crate::{
    middleware::auth::{self, validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::{
        db::{
            models::{PackageEntry, PackageEntryRead},
            schema::hyperotaserver::{
                packages::{app_id, dsl::packages, org_id, version},
            },
        },
        s3::push_file,
    },
};
use actix_multipart::form::{tempfile::TempFile, text::Text, MultipartForm};
use actix_web::{
    error::{self},
    get, post,
    web::{self, Json, Path, ReqData},
    Result, Scope,
};
use diesel::dsl::max;
use serde::{Deserialize, Serialize};
use serde_json::json;
use superposition_rust_sdk::apis::default_api::create_default_config;
use superposition_rust_sdk::apis::default_api::{create_workspace, CreateDefaultConfigError};
use superposition_rust_sdk::models::{
    CreateDefaultConfigRequestContent, CreateDefaultConfigResponseContent,
    CreateWorkspaceRequestContent, WorkspaceStatus,
};
use superposition_rust_sdk::{
    apis::default_api::create_experiment,
    models::{self, CreateExperimentRequestContent},
};

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

use crate::utils::db::schema::hyperotaserver::configs;
use crate::utils::db::schema::hyperotaserver::configs::dsl::configs as configs_table;

pub fn add_routes() -> Scope {
    Scope::new("")
        .service(list)
        .service(create_json)
        .service(create_package_json_v1)
        .service(create_json_v1_multipart)
}

#[derive(Debug, MultipartForm)]
struct PackageCreateRequest {
    #[multipart(rename = "splits")]
    files: Vec<TempFile>,
    #[multipart(rename = "index")]
    index: TempFile,
    #[multipart(rename = "version_splits")]
    version_splits: Text<bool>,
}

#[derive(Serialize)]
struct Response {
    version: i32,
}

// #[post("/create")]
// async fn create(
//     MultipartForm(form): MultipartForm<PackageCreateRequest>,
//     auth_response: ReqData<AuthResponse>,
//     state: web::Data<AppState>,
// ) -> Result<Json<Response>, actix_web::Error> {
//     let mut file_list: Vec<String> = vec![];
//     let files = form.files;
//     let index_name = form.index.file_name.clone().unwrap_or_default();

//     println!("index_name: {:?}", index_name);

//     // Make push to s3 a util function
//     // Push index first to a versioned path
//     // Push other files to versioned / non versioned path based on the url sent in the request
//     let auth_response = auth_response.into_inner();

//     println!("auth_response : {:?}", auth_response.organisation);
//     let organisation =
//         validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
//     let application =
//         validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

//     println!("organisation: {:?}", organisation);
//     println!("application: {:?}", application);

//     // Ideally I should create a new schema / table for each org/application
//     // Get incremental version for package
//     // Store package against application group path
//     // Create package needs write ACL on the application

//     let mut conn = state
//         .db_pool
//         .get()
//         .map_err(error::ErrorInternalServerError)?;

//     let latest_version = packages
//         .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
//         .select(max(version))
//         .first::<Option<i32>>(&mut conn);

//     println!("latest_version: {:?}", latest_version);

//     let ver = latest_version.unwrap_or(Some(0)).unwrap_or(0);
//     let ver = ver + 1;

//     let s3_client = &state.s3_client;
//     let version_splits = form.version_splits.into_inner();

//     push_file(
//         s3_client,
//         state.env.bucket_name.clone(),
//         form.index,
//         format!(
//             "assets/{}/{}/{}/{}",
//             organisation, application, ver, index_name
//         ),
//     )
//     .await
//     .map_err(error::ErrorInternalServerError)?;

//     for file in files {
//         if let Some(filename) = file.file_name.clone() {
//             let file_path = {
//                 if version_splits {
//                     format!(
//                         "assets/{}/{}/{}/{}",
//                         organisation, application, ver, filename
//                     )
//                 } else {
//                     format!("assets/{}/{}/{}", organisation, application, filename)
//                 }
//             };

//             match push_file(s3_client, state.env.bucket_name.clone(), file, file_path).await {
//                 Ok(_) => {
//                     // Add list of files to save in db
//                     file_list.push(filename);
//                 }
//                 Err(e) => {
//                     return Err(actix_web::error::ErrorInternalServerError(e));
//                 }
//             }
//         }
//     }

//     diesel::insert_into(packages)
//         .values(PackageEntry {
//             version: ver,
//             app_id: application,
//             org_id: organisation,
//             contents: file_list.into_iter().map(Some).collect(),
//             index: index_name,
//             version_splits,
//             use_urls: false,
//         })
//         .execute(&mut conn)
//         .map_err(error::ErrorInternalServerError)?;

//     Ok(Json(Response {}))
// }

#[derive(Debug, Deserialize, Serialize)]
struct PackageConfig {
    timeout: Option<i32>,
    properties: Vec<serde_json::Value>,
    version: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageManifestHash {
    #[serde(flatten)]
    entries: std::collections::HashMap<String, ManifestHashEntry>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ManifestHashEntry {
    fileName: String,
    hash: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageManifest {
    #[serde(flatten)]
    entries: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageResourceEntry {
    url: String,
    filePath: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageResourceGroup {
    #[serde(flatten)]
    entries: std::collections::HashMap<String, PackageResourceEntry>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageBootResources {
    mandatory: Option<PackageResourceGroup>,
    best_effort: Option<PackageResourceGroup>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageInfo {
    name: String,
    version: String,
    index: String,
    properties: PackageProperties,
    preboot: Option<PackageBootResources>,
    postboot: Option<PackageBootResources>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageProperties {
    manifestHash: Option<PackageManifestHash>,
    manifest: Option<PackageManifest>,
    #[serde(flatten)]
    additional: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageJsonRequest {
    config: PackageConfig,
    package: PackageInfo,
}

#[post("/create_json")]
async fn create_json(
    req: Json<PackageJsonRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    println!("organisation: {:?}", organisation);
    println!("application: {:?}", application);

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let ver = latest_version.unwrap_or(0) + 1;

    let index_url = &req.package.index;
    let index_name = index_url
        .split('/')
        .last()
        .unwrap_or("index.jsa")
        .to_string();

    let mut file_list: Vec<String> = Vec::new();
    if let Some(manifest) = &req.package.properties.manifest {
        for file_path in manifest.entries.values() {
            if let Some(filename) = file_path.split('/').last() {
                file_list.push(filename.to_string());
            }
        }
    }

    if let Some(preboot) = &req.package.preboot {
        if let Some(mandatory) = &preboot.mandatory {
            for entry in mandatory.entries.values() {
                file_list.push(entry.filePath.clone());
            }
        }
        if let Some(best_effort) = &preboot.best_effort {
            for entry in best_effort.entries.values() {
                file_list.push(entry.filePath.clone());
            }
        }
    }

    if let Some(postboot) = &req.package.postboot {
        if let Some(mandatory) = &postboot.mandatory {
            for entry in mandatory.entries.values() {
                file_list.push(entry.filePath.clone());
            }
        }
        if let Some(best_effort) = &postboot.best_effort {
            for entry in best_effort.entries.values() {
                file_list.push(entry.filePath.clone());
            }
        }
    }

    file_list.sort();
    file_list.dedup();

    println!("ver : {:?}", ver);
    println!("file_list : {:?}", file_list);
    println!("index_name : {:?}", index_name);
    println!("application : {:?}", application);
    println!("organisation : {:?}", organisation);

    // Create context for experiment
    let context = std::collections::HashMap::new();

    // Create a control variant with the package configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), json!(ver));
    control_overrides.insert("package.name".to_string(), json!(application.clone()));
    control_overrides.insert("config.package_timeout".to_string(), json!(30));
    control_overrides.insert("config.release_config_timeout".to_string(), json!(10));
    control_overrides.insert("config.version".to_string(), json!("1"));

    // Create experimental variant with same overrides (required by check_variants_override_coverage)
    let mut experimental_overrides = control_overrides.clone();

    // Create the control variant
    let control_variant = models::Variant {
        id: "control".to_string(),
        variant_type: models::VariantType::Control,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            control_overrides,
        ))),
    };

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!("Using Superposition Org ID from environment for create_json: {}", superposition_org_id_from_env);


    // Create the experimental variant (required by check_variant_types)
    let experimental_variant = models::Variant {
        id: "experimental".to_string(),
        variant_type: models::VariantType::Experimental,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            experimental_overrides,
        ))),
    };

    // Create experiment in Superposition
    let experiment_content = models::CreateExperimentRequestContent::new(
        format!("{}_v{}", application, ver),
        context,
        vec![control_variant, experimental_variant], // Both control and experimental variants
        format!("Package creation for {} v{}", application, ver),
        "Creating new package version".to_string(),
    );

    println!("experiment_content : {:?}", experiment_content);
    println!("superposition_org_id_from_env : {:?}", superposition_org_id_from_env);

    // Call create_experiment
    let experiment = create_experiment(
        &state.superposition_configuration,
        &superposition_org_id_from_env, // Use ID from env
        &application,
        experiment_content,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to create experiment: {}", e)))?;

    println!("experiment : {:?}", experiment);

    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application,
            org_id: organisation,
            contents: file_list.into_iter().map(Some).collect(),
            index: index_name,
            version_splits: true,
            use_urls: true,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response { version: ver }))
}

#[derive(Serialize)]
struct PackageList {
    packages: Vec<Package>,
}

#[derive(Serialize)]
struct Package {
    index: String,
    splits: Vec<String>,
    version: i32,
    id: String,
}

#[get("")]
async fn list(
    state: web::Data<AppState>,
    auth_response: ReqData<AuthResponse>,
) -> Result<Json<PackageList>> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, READ).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, READ).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let entries = packages
        .filter(org_id.eq(organisation).and(app_id.eq(application)))
        .load::<PackageEntryRead>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;
    let entries = entries
        .iter()
        .map(|a| Package {
            index: a.index.to_owned(),
            splits: a.contents.iter().filter_map(|s| s.clone()).collect(),
            version: a.version,
            id: a.id.to_string(),
        })
        .collect();

    Ok(Json(PackageList { packages: entries }))
}

// #[get("/{package_id}")]
// async fn get_package(
//     path: Path<String>,
//     state: web::Data<AppState>,
//     auth_response: ReqData<AuthResponse>,
// ) -> Result<Json<Package>, actix_web::Error> {
//     let package_version = path
//         .into_inner()
//         .parse::<i32>()
//         .map_err(error::ErrorBadRequest)?;
//     let auth_response = auth_response.into_inner();
//     let organisation =
//         validate_user(auth_response.organisation, READ).map_err(error::ErrorUnauthorized)?;
//     let application =
//         validate_user(auth_response.application, READ).map_err(error::ErrorUnauthorized)?;

//     let mut conn = state
//         .db_pool
//         .get()
//         .map_err(error::ErrorInternalServerError)?;

//     let package = packages
//         .filter(
//             org_id
//                 .eq(&organisation)
//                 .and(app_id.eq(&application))
//                 .and(package_version.eq(package_version)),
//         )
//         .first::<PackageEntryRead>(&mut conn)
//         .map_err(|_| error::ErrorNotFound("Package not found"))?;

//     Ok(Json(Package {
//         index: package.index,
//         splits: package.contents,
//         version: package.version,
//         id: package.id.to_string(),
//     }))
// }

#[derive(Debug, MultipartForm)]
struct PackageJsonV1MultipartRequest {
    #[multipart(rename = "json")]
    json: Text<String>,
    #[multipart(rename = "index")]
    index: Option<TempFile>,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageJsonV1Request {
    package: PackageV1,
    resources: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
struct PackageV1 {
    name: String,
    version: String,
    #[serde(flatten)]
    properties: serde_json::Value,
    index: String,
    splits: Vec<String>,
}

#[post("/create_package_json_v1")]
async fn create_package_json_v1(
    req: Json<PackageJsonV1Request>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let ver = latest_version.unwrap_or(0) + 1;

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!("Using Superposition Org ID from environment for create_package_json_v1: {}", superposition_org_id_from_env);

    // Create control variant with package configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), json!(ver));
    control_overrides.insert("package.name".to_string(), json!(req.package.name));

    // Create experimental variant
    let experimental_overrides = control_overrides.clone();

    // Create variants
    let control_variant = models::Variant {
        id: "control".to_string(),
        variant_type: models::VariantType::Control,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            control_overrides,
        ))),
    };

    let experimental_variant = models::Variant {
        id: "experimental".to_string(),
        variant_type: models::VariantType::Experimental,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            experimental_overrides,
        ))),
    };

    // Create experiment in Superposition
    let experiment_content = models::CreateExperimentRequestContent::new(
        format!("{}_v{}", application, ver),
        std::collections::HashMap::new(),
        vec![control_variant, experimental_variant],
        format!("Package creation for {} v{}", application, ver),
        "Creating new package version".to_string(),
    );

    create_experiment(
        &state.superposition_configuration,
        &superposition_org_id_from_env, // Use ID from env
        &application,
        experiment_content,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to create experiment: {}", e)))?;

    // Store package data with full URLs
    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application.clone(),
            org_id: organisation.clone(),
            contents: req.package.splits.clone().into_iter().map(Some).collect(),
            index: req.package.index.clone(),
            version_splits: true,
            use_urls: true,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response { version: ver }))
}

#[post("/create_json_v1_multipart")]
async fn create_json_v1_multipart(
    MultipartForm(form): MultipartForm<PackageJsonV1MultipartRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Parse the JSON request
    let mut req: PackageJsonV1Request = serde_json::from_str(&form.json.into_inner())
        .map_err(|e| error::ErrorBadRequest(format!("Invalid JSON: {}", e)))?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    let ver = latest_version.unwrap_or(0) + 1;

    // Handle file upload if provided and not empty
    if let Some(index_file) = form.index {
        let index_name = index_file.file_name.clone().unwrap_or_default();
        if index_name.is_empty() {
            return Err(error::ErrorBadRequest("Index file name cannot be empty"));
        }

        let s3_client = &state.s3_client;

        // Upload file to S3
        let s3_path = format!(
            "assets/{}/{}/{}/{}",
            organisation, application, ver, index_name
        );

        println!("Checking if bucket exists: {}", state.env.bucket_name);

        match push_file(
            s3_client,
            state.env.bucket_name.clone(),
            index_file,
            s3_path.clone(),
        )
        .await
        {
            Ok(_) => {
                println!("S3 upload response details:");
                println!("Bucket: {}", state.env.bucket_name);
                println!("Full S3 path: {}", s3_path);
                println!("S3 client config: {:?}", s3_client.config());

                // Update the index URL
                req.package.index = format!(
                    "{}/{}/{}",
                    state.env.public_url, state.env.bucket_name, s3_path
                );
            }
            Err(e) => {
                println!("S3 upload error details:");
                println!("Bucket: {}", state.env.bucket_name);
                println!("Path: {}", s3_path);
                println!("Error: {:?}", e);
                return Err(error::ErrorInternalServerError(
                    "Failed to upload index file",
                ));
            }
        }
    }

    // Use superposition_org_id from environment
    let superposition_org_id_from_env = state.env.superposition_org_id.clone();
    println!("Using Superposition Org ID from environment for create_json_v1_multipart: {}", superposition_org_id_from_env);


    // Extract package properties (dynamically)
    let manifest = req
        .package
        .properties
        .get("manifest")
        .ok_or_else(|| error::ErrorBadRequest("Missing manifest in package properties"))?;

    let manifest_hash = req
        .package
        .properties
        .get("manifest_hash")
        .ok_or_else(|| error::ErrorBadRequest("Missing manifest_hash in package properties"))?;

    // Create control variant with package configuration
    let mut control_overrides = std::collections::HashMap::new();
    control_overrides.insert("package.version".to_string(), json!(ver));
    control_overrides.insert("package.name".to_string(), json!(req.package.name));

    // Create experimental variant
    let experimental_overrides = control_overrides.clone();

    // Create variants
    let control_variant = models::Variant {
        id: "control".to_string(),
        variant_type: models::VariantType::Control,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            control_overrides,
        ))),
    };

    let experimental_variant = models::Variant {
        id: "experimental".to_string(),
        variant_type: models::VariantType::Experimental,
        context_id: None,
        override_id: None,
        overrides: Some(serde_json::Value::Object(serde_json::Map::from_iter(
            experimental_overrides,
        ))),
    };

    // Create experiment in Superposition
    let experiment_content = models::CreateExperimentRequestContent::new(
        format!("{}_v{}", application, ver),
        std::collections::HashMap::new(),
        vec![control_variant, experimental_variant],
        format!("Package creation for {} v{}", application, ver),
        "Creating new package version".to_string(),
    );

    create_experiment(
        &state.superposition_configuration,
        &superposition_org_id_from_env, // Use ID from env
        &application,
        experiment_content,
    )
    .await
    .map_err(|e| error::ErrorInternalServerError(format!("Failed to create experiment: {}", e)))?;

    // Store package data with full URLs
    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application.clone(),
            org_id: organisation.clone(),
            contents: req.package.splits.clone().into_iter().map(Some).collect(),
            index: req.package.index.clone(),
            version_splits: true,
            use_urls: true,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response { version: ver }))
}
