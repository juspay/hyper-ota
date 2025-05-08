use actix_files::Files;
use actix_web::Scope;

pub fn add_routes() -> Scope {
    Scope::new("").service(Files::new("", "dashboard/dist").index_file("index.html"))
}
