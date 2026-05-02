use axum::{
    Router,
    http::Method,
    routing::{delete, get, post, put},
};
use shared::DaemonStatus;
use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::str::FromStr;
use std::{fs, net::SocketAddr, process};
use tower_http::cors::CorsLayer;

mod routes;

// 🚀 NEW: The Database Initialization Function
async fn init_db(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let schema = "
        CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
        
        CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, code TEXT, clientName TEXT, status TEXT, region TEXT, projectLead TEXT, siteSupervisor TEXT, pmc TEXT, architect TEXT, structuralEngineer TEXT, isPriceLocked INTEGER, dailyLogs TEXT, actualResources TEXT, ganttTasks TEXT, subcontractors TEXT, phaseAssignments TEXT, createdAt INTEGER, raBills TEXT, purchaseOrders TEXT, materialRequests TEXT, grns TEXT, type TEXT, location TEXT, isScaffolded INTEGER, scaffoldPath TEXT, isManuallyLinked INTEGER, dailySchedules TEXT, resourceTrackingMode TEXT, assignedStaff TEXT);
        
        CREATE TABLE IF NOT EXISTS project_boq (id TEXT PRIMARY KEY, projectId TEXT, masterBoqId TEXT, slNo INTEGER, isCustom INTEGER, itemCode TEXT, description TEXT, unit TEXT, rate REAL, formulaStr TEXT, qty REAL, measurements TEXT, phase TEXT, lockedRate REAL);
        
        CREATE TABLE IF NOT EXISTS master_boq (id TEXT PRIMARY KEY, itemCode TEXT, description TEXT, unit TEXT, overhead REAL, profit REAL, components TEXT);
        
        CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, code TEXT, description TEXT, unit TEXT, rates TEXT, rateHistory TEXT);
        
        CREATE TABLE IF NOT EXISTS regions (id TEXT PRIMARY KEY, name TEXT);
        
        CREATE TABLE IF NOT EXISTS crm_contacts (id TEXT PRIMARY KEY, name TEXT, company TEXT, type TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER);
        
        CREATE TABLE IF NOT EXISTS org_staff (id TEXT PRIMARY KEY, name TEXT, designation TEXT, department TEXT, status TEXT, email TEXT, phone TEXT, createdAt INTEGER, username TEXT, password TEXT, role TEXT, accessLevel INTEGER);
        
        CREATE TABLE IF NOT EXISTS staff_work_logs (id TEXT PRIMARY KEY, date TEXT, staffId TEXT, slNo INTEGER, projectId TEXT, details TEXT, remarks TEXT, status TEXT, createdAt INTEGER);
        
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, projectId TEXT, senderId TEXT, content TEXT, replyToId TEXT, createdAt INTEGER);
        
        CREATE TABLE IF NOT EXISTS private_messages (id TEXT PRIMARY KEY, senderId TEXT, receiverId TEXT, content TEXT, replyToId TEXT, createdAt INTEGER);
        
        CREATE TABLE IF NOT EXISTS project_documents (id TEXT PRIMARY KEY, projectId TEXT, name TEXT, category TEXT, filePath TEXT, fileType TEXT, addedAt INTEGER);
    ";

    sqlx::query(schema).execute(pool).await?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port = 3000;
    let db_url = "sqlite://../database.sqlite";

    println!("Booting OpenPrix Rust Daemon...");
    let connect_options = SqliteConnectOptions::from_str(db_url)?.create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA synchronous = NORMAL;")
        .execute(&pool)
        .await?;

    // 🚀 NEW: Run the initialization script
    init_db(&pool).await?;
    println!("Database verified and initialized.");

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/", get(|| async { "OpenPrix API is Online!" }))
        .route("/api/auth/login", post(routes::auth::login))
        .route(
            "/api/settings/{key}",
            get(routes::settings::get_settings).post(routes::settings::save_settings),
        )
        .route(
            "/api/projects",
            get(routes::projects::get_projects).post(routes::projects::add_project),
        )
        .route(
            "/api/projects/purge",
            post(routes::projects::purge_projects),
        )
        .route(
            "/api/projects/{id}",
            get(routes::projects::get_project)
                .put(routes::projects::update_project)
                .delete(routes::projects::delete_project),
        )
        .route(
            "/api/projects/{id}/documents",
            get(routes::projects::get_project_docs),
        )
        .route("/api/documents", post(routes::projects::save_project_doc))
        .route(
            "/api/documents/{id}",
            delete(routes::projects::delete_project_doc),
        )
        .route(
            "/api/projects/{id}/boqs",
            get(routes::boqs::get_project_boqs),
        )
        .route("/api/boqs", post(routes::boqs::add_project_boq))
        .route(
            "/api/boqs/{id}",
            put(routes::boqs::update_project_boq).delete(routes::boqs::delete_project_boq),
        )
        .route("/api/boqs/bulk", put(routes::boqs::bulk_put_project_boqs))
        .route(
            "/api/master-boqs",
            get(routes::boqs::get_master_boqs).post(routes::boqs::save_master_boq),
        )
        .route(
            "/api/master-boqs/{id}",
            delete(routes::boqs::delete_master_boq),
        )
        .route(
            "/api/messages",
            get(routes::messages::get_messages).post(routes::messages::save_message),
        )
        .route(
            "/api/messages/{id}",
            delete(routes::messages::delete_message),
        )
        .route(
            "/api/private-messages/{u1}/{u2}",
            get(routes::messages::get_private_messages),
        )
        .route(
            "/api/private-messages",
            post(routes::messages::save_private_message),
        )
        .route(
            "/api/private-messages/{id}",
            delete(routes::messages::delete_private_message),
        )
        .route(
            "/api/staff",
            get(routes::staff::get_staff).post(routes::staff::save_staff),
        )
        .route("/api/staff/{id}", delete(routes::staff::delete_staff))
        .route(
            "/api/crm",
            get(routes::crm::get_crm).post(routes::crm::save_crm),
        )
        .route("/api/crm/{id}", delete(routes::crm::delete_crm))
        .route(
            "/api/worklogs",
            get(routes::staff::get_worklogs).post(routes::staff::save_worklog),
        )
        .route(
            "/api/worklogs/{id}",
            put(routes::staff::update_worklog).delete(routes::staff::delete_worklog),
        )
        .route(
            "/api/resources",
            get(routes::resources::get_resources).post(routes::resources::save_resource),
        )
        .route(
            "/api/resources/{id}",
            put(routes::resources::update_resource).delete(routes::resources::delete_resource),
        )
        .route(
            "/api/regions",
            get(routes::resources::get_regions).post(routes::resources::save_region),
        )
        .route(
            "/api/regions/{id}",
            delete(routes::resources::delete_region),
        )
        .route("/api/os/download", get(routes::os::download_file))
        .route("/api/os/upload", post(routes::os::upload_file))
        .route(
            "/api/notifications/check",
            get(routes::messages::check_notifications),
        )
        .route("/api/kanban", get(routes::messages::get_kanban_tasks))
        .layer(cors)
        .with_state(pool);

    let status = DaemonStatus {
        status: "online".to_string(),
        port,
        url: Some(format!("http://127.0.0.1:{}", port)),
        pid: process::id(),
    };
    fs::write("../.daemon_status.json", serde_json::to_string(&status)?)?;

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Daemon running on {}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}
