use actix_multipart::form::{tempfile::TempFile, text::Text, MultipartForm};
use actix_web::{
    error::{self},
    get, post,
    web::{self, Json, ReqData},
    Result, Scope,
};
use diesel::dsl::max;
use serde::Serialize;

use crate::{
    middleware::auth::{validate_user, AuthResponse, READ, WRITE},
    types::AppState,
    utils::{
        db::{
            models::{PackageEntry, PackageEntryRead},
            schema::hyperotaserver::packages::{app_id, dsl::packages, org_id, version},
        },
        s3::push_file,
    },
};

use diesel::prelude::*;
use diesel::ExpressionMethods;
use diesel::QueryDsl;

pub fn add_routes() -> Scope {
    Scope::new("").service(create).service(list)
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
struct Response {}

#[post("/create")]
async fn create(
    MultipartForm(form): MultipartForm<PackageCreateRequest>,
    auth_response: ReqData<AuthResponse>,
    state: web::Data<AppState>,
) -> Result<Json<Response>, actix_web::Error> {
    let mut file_list: Vec<String> = vec![];
    let files = form.files;
    let index_name = form.index.file_name.clone().unwrap_or_default();

    // Make push to s3 a util function
    // Push index first to a versioned path
    // Push other files to versioned / non versioned path based on the url sent in the request
    let auth_response = auth_response.into_inner();
    let organisation =
        validate_user(auth_response.organisation, WRITE).map_err(error::ErrorUnauthorized)?;
    let application =
        validate_user(auth_response.application, WRITE).map_err(error::ErrorUnauthorized)?;

    // Ideally I should create a new schema / table for each org/application
    // Get incremental version for package
    // Store package against application group path
    // Create package needs write ACL on the application

    let mut conn = state
        .db_pool
        .get()
        .map_err(error::ErrorInternalServerError)?;

    let latest_version = packages
        .filter(org_id.eq(&organisation).and(app_id.eq(&application)))
        .select(max(version))
        .first::<Option<i32>>(&mut conn);

    let ver = latest_version.unwrap_or(Some(0)).unwrap_or(0);
    let ver = ver + 1;

    let s3_client = &state.s3_client;
    let version_splits = form.version_splits.into_inner();

    push_file(
        s3_client,
        state.env.bucket_name.clone(),
        form.index,
        format!(
            "assets/{}/{}/{}/{}",
            organisation, application, ver, index_name
        ),
    )
    .await
    .map_err(error::ErrorInternalServerError)?;

    for file in files {
        if let Some(filename) = file.file_name.clone() {
            let file_path = {
                if version_splits {
                    format!(
                        "assets/{}/{}/{}/{}",
                        organisation, application, ver, filename
                    )
                } else {
                    format!("assets/{}/{}/{}", organisation, application, filename)
                }
            };

            match push_file(s3_client, state.env.bucket_name.clone(), file, file_path).await {
                Ok(_) => {
                    // Add list of files to save in db
                    file_list.push(filename);
                }
                Err(e) => {
                    return Err(actix_web::error::ErrorInternalServerError(e));
                }
            }
        }
    }

    diesel::insert_into(packages)
        .values(PackageEntry {
            version: ver,
            app_id: application,
            org_id: organisation,
            contents: file_list,
            index: index_name,
            version_splits,
        })
        .execute(&mut conn)
        .map_err(error::ErrorInternalServerError)?;

    Ok(Json(Response {}))
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
            splits: a.contents.clone(),
            version: a.version,
            id: a.id.to_string(),
        })
        .collect();

    Ok(Json(PackageList { packages: entries }))
}
