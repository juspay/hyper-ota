use actix_files::Files;
use actix_web::web;
use actix_web::Scope;

pub fn add_routes() -> Scope {
    Scope::new("").service(
        Files::new("/", "./dashboard_react/dist")
            .index_file("index.html")
            .default_handler(web::to(|| async {
                actix_files::NamedFile::open_async("./dashboard_react/dist/index.html").await
            })),
    )
}
