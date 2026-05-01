use axum::{
    body::Body, extract::{Query, State}, http::{header, Method, StatusCode}, response::IntoResponse, routing::{get, post}, Json, Router
};
use shared::{AppSetting, CrmContact, DaemonStatus, MasterBoq, Message, PrivateMessage, Project, ProjectBoq, ProjectDocument, Region, Resource, Staff, WorkLog};
use sqlx::{sqlite::SqlitePoolOptions, QueryBuilder, Sqlite, SqlitePool};
use std::{fs, net::SocketAddr, process, path::Path};
use tower_http::cors::{Any, CorsLayer};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct RpcPayload {
    pub channel: String,
    pub args: Vec<Value>, 
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    pub path: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port = 3000;
    let db_url = "sqlite://../database.sqlite"; 

    println!("Booting OpenPrix Rust Daemon...");

    let pool = SqlitePoolOptions::new().max_connections(5).connect(db_url).await?;
    
    // 🔥 HIGH PERFORMANCE SQLITE PRAGMAS
    sqlx::query("PRAGMA journal_mode = WAL;").execute(&pool).await?;
    sqlx::query("PRAGMA synchronous = NORMAL;").execute(&pool).await?;

    let cors = CorsLayer::new()
        .allow_origin(Any) 
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "OpenPrix Daemon is Online and Routing!" })) 
        .route("/api/projects", get(get_projects))
        .route("/api/download", get(download_file))
        .route("/api/rpc", post(handle_rpc)) 
        .layer(cors)
        .with_state(pool); 

    let status = DaemonStatus {
        status: "online".to_string(),
        port,
        url: Some(format!("http://127.0.0.1:{}", port)),
        pid: process::id(),
    };
    
    fs::write("../.daemon_status.json", serde_json::to_string(&status)?)?;

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Daemon running on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// --- FILE DOWNLOADER ---
async fn download_file(Query(params): Query<DownloadQuery>) -> impl IntoResponse {
    let file_path = Path::new(&params.path);
    
    match tokio::fs::read(file_path).await {
        Ok(contents) => {
            let filename = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
            let content_disposition = format!("attachment; filename=\"{}\"", filename);
            
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/octet-stream"), (header::CONTENT_DISPOSITION, &content_disposition)],
                Body::from(contents)
            ).into_response()
        },
        Err(_) => (StatusCode::NOT_FOUND, "File not found").into_response()
    }
}

async fn get_projects(State(pool): State<SqlitePool>) -> Result<Json<Vec<Project>>, String> {
    let projects = sqlx::query_as::<_, Project>("SELECT * FROM projects").fetch_all(&pool).await.map_err(|e| e.to_string())?;
    Ok(Json(projects))
}

// --- THE GRAND RPC BRIDGE ---
async fn handle_rpc(State(pool): State<SqlitePool>, Json(payload): Json<RpcPayload>) -> Json<Value> {
    let channel = payload.channel.as_str();
    if channel != "db:check-notifications" { println!("RPC Call Received: {}", channel); }

    let result: Result<Value, String> = match channel {
        
        // ==========================================
        // 1. AUTH & SETTINGS
        // ==========================================
        "db:verify-login" => {
            let un = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let pw = payload.args.get(1).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, Staff>("SELECT * FROM org_staff WHERE LOWER(username) = LOWER(?) AND password = ? AND status = 'Active'")
                .bind(un).bind(pw).fetch_optional(&pool).await {
                Ok(Some(u)) => Ok(serde_json::json!({ "success": true, "user": u })),
                Ok(None) => Ok(serde_json::json!({ "success": false, "error": "Invalid Credentials" })),
                Err(e) => Err(e.to_string()),
            }
        },
        "db:get-settings" => {
            let key = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, AppSetting>("SELECT * FROM app_settings WHERE key = ?").bind(key).fetch_optional(&pool).await {
                Ok(Some(row)) => Ok(serde_json::from_str::<Value>(&row.value).unwrap_or(Value::Null)),
                Ok(None) => Ok(Value::Null),
                Err(e) => Err(e.to_string()),
            }
        },
        "db:save-settings" => {
            let key = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let val_str = payload.args.get(1).unwrap_or(&Value::Null).to_string(); 
            match sqlx::query("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").bind(key).bind(val_str).execute(&pool).await {
                Ok(_) => Ok(serde_json::json!({ "success": true })),
                Err(e) => Err(e.to_string()),
            }
        },

        // ==========================================
        // 2. DYNAMIC INSERTS & UPSERTS
        // ==========================================
        "db:add-project" | "db:add-project-boq" | "db:save-org-staff" | "db:save-crm-contact" | "db:save-work-log" | "db:save-project-document" | "db:save-message" | "db:save-private-message" => {
            let data = payload.args.get(0).and_then(|v| v.as_object());
            let table_name = match channel {
                "db:add-project" => "projects",
                "db:add-project-boq" => "project_boq",
                "db:save-org-staff" => "org_staff",
                "db:save-crm-contact" => "crm_contacts",
                "db:save-work-log" => "staff_work_logs",
                "db:save-project-document" => "project_documents",
                "db:save-message" => "messages",
                "db:save-private-message" => "private_messages",
                _ => unreachable!(),
            };

            let is_insert_only = channel.starts_with("db:add");
            let sql_cmd = if is_insert_only { "INSERT INTO" } else { "INSERT OR REPLACE INTO" };

            if let Some(obj) = data {
                let mut cols = Vec::new();
                let mut vals = Vec::new();
                
                if channel == "db:add-project-boq" && !obj.contains_key("id") {
                    cols.push("id");
                    vals.push("?");
                }

                for (k, _) in obj { cols.push(k.as_str()); vals.push("?"); }
                
                let query_str = format!("{} {} ({}) VALUES ({})", sql_cmd, table_name, cols.join(", "), vals.join(", "));
                let mut final_query = sqlx::query(&query_str);
                
                if channel == "db:add-project-boq" && !obj.contains_key("id") {
                    final_query = final_query.bind(uuid::Uuid::new_v4().to_string());
                }

                for (_, v) in obj {
                    final_query = match v {
                        Value::String(s) => final_query.bind(s.clone()),
                        Value::Number(n) => if let Some(i) = n.as_i64() { final_query.bind(i) } else { final_query.bind(n.as_f64().unwrap()) },
                        Value::Bool(b) => final_query.bind(if *b { 1 } else { 0 }),
                        Value::Null => final_query.bind(None::<String>), 
                        _ => final_query.bind(v.to_string()), 
                    };
                }

                match final_query.execute(&pool).await {
                    Ok(_) => Ok(serde_json::json!({ "success": true })),
                    Err(e) => Err(e.to_string()),
                }
            } else { Err("Invalid payload".to_string()) }
        },

        // ==========================================
        // 3. DYNAMIC UPDATES
        // ==========================================
        "db:update-project" | "db:update-project-boq" | "db:update-work-log" => {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let data = payload.args.get(1).and_then(|v| v.as_object());
            let table_name = match channel {
                "db:update-project" => "projects",
                "db:update-project-boq" => "project_boq",
                "db:update-work-log" => "staff_work_logs",
                _ => unreachable!(),
            };
            
            if let Some(obj) = data {
                let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new(format!("UPDATE {} SET ", table_name));
                let mut first = true;
                for (k, v) in obj {
                    if k == "id" { continue; } 
                    if !first { qb.push(", "); }
                    qb.push(k).push(" = ");
                    
                    match v {
                        Value::String(s) => { qb.push_bind(s.clone()); },
                        Value::Number(n) => if let Some(i) = n.as_i64() { qb.push_bind(i); } else if let Some(f) = n.as_f64() { qb.push_bind(f); },
                        Value::Bool(b) => { qb.push_bind(if *b { 1 } else { 0 }); },
                        Value::Null => { qb.push("NULL"); },
                        _ => { qb.push_bind(v.to_string()); } 
                    }
                    first = false;
                }
                qb.push(" WHERE id = ").push_bind(id);
                
                match qb.build().execute(&pool).await {
                    Ok(_) => Ok(serde_json::json!({ "success": true })),
                    Err(e) => Err(e.to_string()),
                }
            } else { Err("Invalid payload".to_string()) }
        },

        "db:update-resource" => {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let field = payload.args.get(1).and_then(|v| v.as_str()).unwrap_or("");
            let val = payload.args.get(2).unwrap_or(&Value::Null);

            let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE resources SET ");
            qb.push(field).push(" = ");
            match val {
                Value::String(s) => { qb.push_bind(s.clone()); },
                Value::Number(n) => if let Some(i) = n.as_i64() { qb.push_bind(i); } else if let Some(f) = n.as_f64() { qb.push_bind(f); },
                Value::Bool(b) => { qb.push_bind(if *b { 1 } else { 0 }); },
                Value::Null => { qb.push("NULL"); },
                _ => { qb.push_bind(val.to_string()); }, 
            };
            qb.push(" WHERE id = ").push_bind(id);
            
            match qb.build().execute(&pool).await {
                Ok(_) => Ok(serde_json::json!({ "success": true })),
                Err(e) => Err(e.to_string()),
            }
        },

        // ==========================================
        // 4. COMPLEX CUSTOM OPERATIONS
        // ==========================================
        "db:save-master-boq" => async {
            let payload_obj = payload.args.get(0).and_then(|v| v.as_object()).ok_or("Invalid payload")?;
            let id_val = payload.args.get(1).and_then(|v| v.as_str());
            let is_new = payload.args.get(2).and_then(|v| v.as_bool()).unwrap_or(false);

            let item_code = payload_obj.get("itemCode").and_then(|v| v.as_str()).unwrap_or("");
            let desc = payload_obj.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let unit = payload_obj.get("unit").and_then(|v| v.as_str()).unwrap_or("");
            let overhead = payload_obj.get("overhead").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let profit = payload_obj.get("profit").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let components = payload_obj.get("components").map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string());

            if let Some(id) = id_val {
                if !is_new {
                    let q = "UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?";
                    sqlx::query(q).bind(item_code).bind(desc).bind(unit).bind(overhead).bind(profit).bind(components).bind(id).execute(&pool).await.map_err(|e| e.to_string())?;
                    return Ok::<Value, String>(serde_json::json!(id));
                }
            }
            
            let insert_id = if is_new { uuid::Uuid::new_v4().to_string() } else { id_val.unwrap_or(&uuid::Uuid::new_v4().to_string()).to_string() };
            let q = "INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)";
            sqlx::query(q).bind(&insert_id).bind(item_code).bind(desc).bind(unit).bind(overhead).bind(profit).bind(components).execute(&pool).await.map_err(|e| e.to_string())?;
            Ok::<Value, String>(serde_json::json!(insert_id))
        }.await,

        "db:bulk-put-project-boqs" => async {
            let items = payload.args.get(0).and_then(|v| v.as_array()).ok_or("Invalid payload")?;
            let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
            for item in items {
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let locked_rate = item.get("lockedRate").and_then(|v| v.as_f64());
                sqlx::query("UPDATE project_boq SET lockedRate = ? WHERE id = ?").bind(locked_rate).bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            }
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok::<Value, String>(serde_json::json!({ "success": true }))
        }.await,

        "db:create-region" => {
            let name = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let id = uuid::Uuid::new_v4().to_string();
            match sqlx::query("INSERT INTO regions (id, name) VALUES (?, ?)").bind(&id).bind(name).execute(&pool).await {
                Ok(_) => Ok(serde_json::json!({ "success": true, "id": id })),
                Err(e) => Err(e.to_string()),
            }
        },

        "db:create-resource" => {
            let data = payload.args.get(0).and_then(|v| v.as_object());
            if let Some(d) = data {
                let id = d.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                let code = d.get("code").and_then(|v| v.as_str()).unwrap_or("");
                let desc = d.get("description").and_then(|v| v.as_str()).unwrap_or("");
                let unit = d.get("unit").and_then(|v| v.as_str()).unwrap_or("");
                match sqlx::query("INSERT INTO resources (id, code, description, unit, rates) VALUES (?, ?, ?, ?, ?)").bind(id).bind(code).bind(desc).bind(unit).bind("{}").execute(&pool).await {
                    Ok(_) => Ok(serde_json::json!({ "success": true })),
                    Err(e) => Err(e.to_string()),
                }
            } else { Err("Invalid payload".into()) }
        },

        "os:upload-file-web" => {
            let filename = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("file");
            let b64 = payload.args.get(1).and_then(|v| v.as_str()).unwrap_or("");
            let b64_clean = if let Some(idx) = b64.find(',') { &b64[idx+1..] } else { b64 };
            
            let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_else(|_| ".".to_string());
            let upload_dir = Path::new(&home).join(".openprix").join("uploads");
            fs::create_dir_all(&upload_dir).unwrap_or_default();
            
            use std::time::{SystemTime, UNIX_EPOCH};
            let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
            let safe_name = format!("{}_{}", ts, filename.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != '_', ""));
            let filepath = upload_dir.join(&safe_name);
            
            use base64::{Engine as _, engine::general_purpose};
            match general_purpose::STANDARD.decode(b64_clean) {
                Ok(bytes) => {
                    fs::write(&filepath, bytes).unwrap_or_default();
                    Ok(serde_json::json!({ "success": true, "path": filepath.to_string_lossy().to_string() }))
                },
                Err(_) => Err("Base64 decode failed".into())
            }
        },

        // ==========================================
        // 5. DELETES
        // ==========================================
        "db:delete-project" => async {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM projects WHERE id = ?").bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM project_boq WHERE projectId = ?").bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM project_documents WHERE projectId = ?").bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok::<Value, String>(serde_json::json!({ "success": true }))
        }.await,
        
        "db:delete-region" => {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query("DELETE FROM regions WHERE id = ?").bind(id).execute(&pool).await {
                Ok(_) => Ok(serde_json::json!({ "success": true })), Err(e) => Err(e.to_string()),
            }
        },
        
        "db:delete-org-staff" | "db:delete-crm-contact" | "db:delete-work-log" | "db:delete-project-document" | "db:delete-message" | "db:delete-private-message" | "db:delete-resource" | "db:delete-project-boq" | "db:delete-master-boq" => {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let table_name = match channel {
                "db:delete-org-staff" => "org_staff",
                "db:delete-crm-contact" => "crm_contacts",
                "db:delete-work-log" => "staff_work_logs",
                "db:delete-project-document" => "project_documents",
                "db:delete-message" => "messages",
                "db:delete-private-message" => "private_messages",
                "db:delete-resource" => "resources",
                "db:delete-project-boq" => "project_boq",
                "db:delete-master-boq" => "master_boq",
                _ => unreachable!(),
            };
            let query_str = format!("DELETE FROM {} WHERE id = ?", table_name);
            match sqlx::query(&query_str).bind(id).execute(&pool).await { Ok(_) => Ok(serde_json::json!({ "success": true })), Err(e) => Err(e.to_string()), }
        },
        
        "db:purge-projects" => async {
            let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM projects").execute(&mut *tx).await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM project_boq").execute(&mut *tx).await.map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM project_documents").execute(&mut *tx).await.map_err(|e| e.to_string())?;
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok::<Value, String>(serde_json::json!({ "success": true }))
        }.await,

        // ==========================================
        // 6. READS
        // ==========================================
        "db:get-project" => {
            let id = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?").bind(id).fetch_optional(&pool).await {
                Ok(Some(row)) => Ok(serde_json::json!(row)),
                Ok(None) => Ok(Value::Null),
                Err(e) => Err(e.to_string()),
            }
        },
        "db:get-project-documents" => {
            let pid = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, ProjectDocument>("SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC").bind(pid).fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), }
        },
        "db:get-messages" => {
            let pid = payload.args.get(0).and_then(|v| v.as_str());
            let db_query = if let Some(p) = pid { sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE projectId = ? ORDER BY createdAt ASC").bind(p).fetch_all(&pool).await } else { sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE projectId IS NULL ORDER BY createdAt ASC").fetch_all(&pool).await };
            match db_query { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), }
        },
        "db:get-private-messages" => {
            let u1 = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            let u2 = payload.args.get(1).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, PrivateMessage>("SELECT * FROM private_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC").bind(u1).bind(u2).bind(u2).bind(u1).fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), }
        },
        "db:get-project-boqs" => {
            let pid = payload.args.get(0).and_then(|v| v.as_str()).unwrap_or("");
            match sqlx::query_as::<_, ProjectBoq>("SELECT * FROM project_boq WHERE projectId = ?").bind(pid).fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), }
        },
        "db:get-projects" => { match sqlx::query_as::<_, Project>("SELECT * FROM projects").fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), } },
        "db:get-org-staff" => { match sqlx::query_as::<_, Staff>("SELECT * FROM org_staff").fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), } },
        "db:get-regions" => { match sqlx::query_as::<_, Region>("SELECT * FROM regions ORDER BY name ASC").fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), } },
        "db:get-crm-contacts" => { match sqlx::query_as::<_, CrmContact>("SELECT * FROM crm_contacts").fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), } },
        "db:get-work-logs" => { match sqlx::query_as::<_, WorkLog>("SELECT * FROM staff_work_logs ORDER BY date DESC, slNo DESC").fetch_all(&pool).await { Ok(data) => Ok(serde_json::json!(data)), Err(e) => Err(e.to_string()), } },
        "db:get-resources" => {
            match sqlx::query_as::<_, Resource>("SELECT * FROM resources ORDER BY code ASC").fetch_all(&pool).await {
                Ok(rows) => {
                    let mut formatted = Vec::new();
                    for r in rows {
                        let mut val = serde_json::to_value(&r).unwrap();
                        val["rates"] = r.rates.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!({}));
                        val["rateHistory"] = r.rate_history.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!([]));
                        formatted.push(val);
                    }
                    Ok(serde_json::Value::Array(formatted))
                },
                Err(e) => Err(e.to_string()),
            }
        },
        "db:get-master-boqs" => {
            match sqlx::query_as::<_, MasterBoq>("SELECT * FROM master_boq").fetch_all(&pool).await {
                Ok(rows) => {
                    let mut formatted = Vec::new();
                    for b in rows {
                        let mut val = serde_json::to_value(&b).unwrap();
                        val["components"] = b.components.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!([]));
                        formatted.push(val);
                    }
                    Ok(serde_json::Value::Array(formatted))
                },
                Err(e) => Err(e.to_string()),
            }
        },

        "db:check-notifications" => Ok(serde_json::json!(0)),
        "db:get-kanban-tasks" => Ok(serde_json::json!([])),

        _ => {
            println!("⚠️ Unhandled RPC Channel: {}", channel);
            Ok(serde_json::json!([])) 
        }
    }; 

    match result {
        Ok(data) => Json(serde_json::json!({ "success": true, "data": data })),
        Err(err) => Json(serde_json::json!({ "success": false, "error": err })),
    }
}