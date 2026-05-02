use axum::{extract::{Path, State, Query}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{QueryBuilder, Sqlite, SqlitePool};
use shared::{AppSetting, CrmContact, MasterBoq, Message, PrivateMessage, Project, ProjectBoq, ProjectDocument, Region, Resource, Staff, WorkLog};
use std::collections::HashMap;

#[derive(Serialize)]
pub struct ApiResponse<T> { pub success: bool, pub data: Option<T>, pub error: Option<String> }

// --- 🛡️ SECURE DYNAMIC SQL BUILDERS ---
// Strictly validates column names against a whitelist character set to prevent SQL Injection
fn is_valid_column(col: &str) -> bool { col.chars().all(|c| c.is_alphanumeric() || c == '_') }

async fn secure_insert(pool: &SqlitePool, table: &str, mut obj: serde_json::Map<String, Value>, ensure_id: bool) -> Result<String, String> {
    if ensure_id && !obj.contains_key("id") { obj.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string())); }
    let mut cols = Vec::new(); let mut vals = Vec::new();
    for k in obj.keys() {
        if !is_valid_column(k) { return Err(format!("Invalid column name: {}", k)); }
        cols.push(k.clone()); vals.push("?");
    }
    let query_str = format!("INSERT OR REPLACE INTO {} ({}) VALUES ({})", table, cols.join(", "), vals.join(", "));
    let mut q = sqlx::query(&query_str);
    for v in obj.values() {
        q = match v {
            Value::String(s) => q.bind(s),
            Value::Number(n) => if let Some(i) = n.as_i64() { q.bind(i) } else { q.bind(n.as_f64().unwrap()) },
            Value::Bool(b) => q.bind(if *b { 1 } else { 0 }),
            Value::Null => q.bind(None::<String>),
            _ => q.bind(v.to_string()),
        };
    }
    q.execute(pool).await.map_err(|e| e.to_string())?;
    Ok(obj.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string())
}

async fn secure_update(pool: &SqlitePool, table: &str, id: &str, obj: serde_json::Map<String, Value>) -> Result<(), String> {
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new(format!("UPDATE {} SET ", table));
    let mut first = true;
    for (k, v) in obj {
        if k == "id" { continue; }
        if !is_valid_column(&k) { return Err(format!("Invalid column name: {}", k)); }
        if !first { qb.push(", "); }
        qb.push(k).push(" = ");
        match v {
            Value::String(s) => { qb.push_bind(s); },
            Value::Number(n) => if let Some(i) = n.as_i64() { qb.push_bind(i); } else { qb.push_bind(n.as_f64().unwrap()); },
            Value::Bool(b) => { qb.push_bind(if b { 1 } else { 0 }); },
            Value::Null => { qb.push("NULL"); },
            _ => { qb.push_bind(v.to_string()); }
        }
        first = false;
    }
    qb.push(" WHERE id = ").push_bind(id);
    qb.build().execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn generic_delete(pool: &SqlitePool, table: &str, id: &str) -> Result<(), String> {
    let query_str = format!("DELETE FROM {} WHERE id = ?", table);
    sqlx::query(&query_str).bind(id).execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Macro to wrap results into standardized API JSON
macro_rules! handle { ($result:expr) => { match $result { Ok(data) => Ok(Json(ApiResponse { success: true, data: Some(data), error: None })), Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, data: None, error: Some(e.to_string()) }))) } } }

// ----------------------------------------------------
// 🚀 THE REST HANDLERS
// ----------------------------------------------------

// --- AUTH & SETTINGS ---
pub async fn login(State(pool): State<SqlitePool>, Json(payload): Json<Value>) -> Result<Json<ApiResponse<Staff>>, (StatusCode, Json<ApiResponse<()>>)> {
    let un = payload.get("username").and_then(|v| v.as_str()).unwrap_or("");
    let pw = payload.get("password").and_then(|v| v.as_str()).unwrap_or("");
    // TODO: SECURITY DEBT - Swap plain text for bcrypt verification here when ready
    let res = sqlx::query_as::<_, Staff>("SELECT * FROM org_staff WHERE LOWER(username) = LOWER(?) AND password = ? AND status = 'Active'").bind(un).bind(pw).fetch_optional(&pool).await.map_err(|e| e.to_string());
    match res {
        Ok(Some(u)) => handle!(Ok(u)),
        Ok(None) => Err((StatusCode::UNAUTHORIZED, Json(ApiResponse { success: false, data: None, error: Some("Invalid Credentials".to_string()) }))),
        Err(e) => handle!(Err(e)),
    }
}
pub async fn get_settings(State(pool): State<SqlitePool>, Path(key): Path<String>) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<()>>)> {
    let res = sqlx::query_as::<_, AppSetting>("SELECT * FROM app_settings WHERE key = ?").bind(key).fetch_optional(&pool).await.map_err(|e| e.to_string());
    match res { Ok(Some(row)) => handle!(Ok(serde_json::from_str(&row.value).unwrap_or(Value::Null))), Ok(None) => handle!(Ok(Value::Null)), Err(e) => handle!(Err(e)) }
}
pub async fn save_settings(State(pool): State<SqlitePool>, Path(key): Path<String>, Json(val): Json<Value>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let val_str = match val { Value::String(s) => s, _ => val.to_string() };
    handle!(sqlx::query("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").bind(key).bind(val_str).execute(&pool).await.map(|_| true).map_err(|e| e.to_string()))
}

// --- PROJECTS ---
pub async fn get_projects(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Project>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, Project>("SELECT * FROM projects").fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn get_project(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<Project>>, (StatusCode, Json<ApiResponse<()>>)> { 
    match sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?").bind(id).fetch_optional(&pool).await.map_err(|e| e.to_string()) { Ok(Some(p)) => handle!(Ok(p)), Ok(None) => Err((StatusCode::NOT_FOUND, Json(ApiResponse { success: false, data: None, error: Some("Not found".into())}))), Err(e) => handle!(Err(e)) }
}
pub async fn add_project(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "projects", payload, true).await) }
pub async fn update_project(State(pool): State<SqlitePool>, Path(id): Path<String>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_update(&pool, "projects", &id, payload).await.map(|_| true)) }
pub async fn delete_project(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut tx = match pool.begin().await { Ok(tx) => tx, Err(e) => return handle!(Err(e.to_string())) };
    let _ = sqlx::query!("DELETE FROM projects WHERE id = ?", id).execute(&mut *tx).await;
    let _ = sqlx::query!("DELETE FROM project_boq WHERE projectId = ?", id).execute(&mut *tx).await;
    let _ = sqlx::query!("DELETE FROM project_documents WHERE projectId = ?", id).execute(&mut *tx).await;
    handle!(tx.commit().await.map(|_| true).map_err(|e| e.to_string()))
}
pub async fn purge_projects(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut tx = match pool.begin().await { Ok(tx) => tx, Err(e) => return handle!(Err(e.to_string())) };
    let _ = sqlx::query!("DELETE FROM projects").execute(&mut *tx).await; let _ = sqlx::query!("DELETE FROM project_boq").execute(&mut *tx).await; let _ = sqlx::query!("DELETE FROM project_documents").execute(&mut *tx).await;
    handle!(tx.commit().await.map(|_| true).map_err(|e| e.to_string()))
}

// --- STAFF & CRM ---
pub async fn get_staff(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Staff>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, Staff>("SELECT * FROM org_staff").fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_staff(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "org_staff", payload, true).await) }
pub async fn delete_staff(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "org_staff", &id).await.map(|_| true)) }

pub async fn get_crm(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<CrmContact>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, CrmContact>("SELECT * FROM crm_contacts").fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_crm(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "crm_contacts", payload, true).await) }
pub async fn delete_crm(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "crm_contacts", &id).await.map(|_| true)) }

// --- RESOURCES & REGIONS ---
pub async fn get_regions(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Region>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, Region>("SELECT * FROM regions ORDER BY name ASC").fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_region(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "regions", payload, true).await) }
pub async fn delete_region(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "regions", &id).await.map(|_| true)) }

pub async fn get_resources(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<()>>)> { 
    match sqlx::query_as::<_, Resource>("SELECT * FROM resources ORDER BY code ASC").fetch_all(&pool).await {
        Ok(rows) => {
            let formatted = rows.into_iter().map(|r| {
                let mut val = serde_json::to_value(&r).unwrap();
                val["rates"] = r.rates.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!({}));
                val["rateHistory"] = r.rate_history.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!([]));
                val
            }).collect();
            handle!(Ok(formatted))
        },
        Err(e) => handle!(Err(e.to_string()))
    }
}
pub async fn save_resource(State(pool): State<SqlitePool>, Json(mut payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { 
    if !payload.contains_key("rates") { payload.insert("rates".to_string(), Value::String("{}".to_string())); }
    handle!(secure_insert(&pool, "resources", payload, true).await) 
}
pub async fn update_resource(State(pool): State<SqlitePool>, Path(id): Path<String>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_update(&pool, "resources", &id, payload).await.map(|_| true)) }
pub async fn delete_resource(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "resources", &id).await.map(|_| true)) }

// --- BOQ LOGIC ---
pub async fn get_project_boqs(State(pool): State<SqlitePool>, Path(pid): Path<String>) -> Result<Json<ApiResponse<Vec<ProjectBoq>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, ProjectBoq>("SELECT * FROM project_boq WHERE projectId = ?").bind(pid).fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn add_project_boq(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "project_boq", payload, true).await) }
pub async fn update_project_boq(State(pool): State<SqlitePool>, Path(id): Path<String>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_update(&pool, "project_boq", &id, payload).await.map(|_| true)) }
pub async fn delete_project_boq(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "project_boq", &id).await.map(|_| true)) }

#[derive(Deserialize)] pub struct BulkBoqPayload { pub items: Vec<serde_json::Map<String, Value>> }
pub async fn bulk_put_project_boqs(State(pool): State<SqlitePool>, Json(payload): Json<BulkBoqPayload>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut tx = match pool.begin().await { Ok(tx) => tx, Err(e) => return handle!(Err(e.to_string())) };
    for item in payload.items {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let locked_rate = item.get("lockedRate").and_then(|v| v.as_f64());
        let _ = sqlx::query("UPDATE project_boq SET lockedRate = ? WHERE id = ?").bind(locked_rate).bind(id).execute(&mut *tx).await;
    }
    handle!(tx.commit().await.map(|_| true).map_err(|e| e.to_string()))
}

pub async fn get_master_boqs(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<()>>)> {
    match sqlx::query_as::<_, MasterBoq>("SELECT * FROM master_boq").fetch_all(&pool).await {
        Ok(rows) => {
            let formatted = rows.into_iter().map(|b| {
                let mut val = serde_json::to_value(&b).unwrap();
                val["components"] = b.components.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| serde_json::json!([]));
                val
            }).collect();
            handle!(Ok(formatted))
        }, Err(e) => handle!(Err(e.to_string()))
    }
}

#[derive(Deserialize)] pub struct MasterBoqSave { pub payload: serde_json::Map<String, Value>, pub id: Option<String>, pub isNew: bool }
pub async fn save_master_boq(State(pool): State<SqlitePool>, Json(data): Json<MasterBoqSave>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let p = data.payload;
    let item_code = p.get("itemCode").and_then(|v| v.as_str()).unwrap_or("");
    let desc = p.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let unit = p.get("unit").and_then(|v| v.as_str()).unwrap_or("");
    let overhead = p.get("overhead").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let profit = p.get("profit").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let components = p.get("components").map(|v| v.to_string()).unwrap_or_else(|| "[]".to_string());

    if let Some(id) = &data.id {
        if !data.isNew {
            handle!(sqlx::query("UPDATE master_boq SET itemCode=?, description=?, unit=?, overhead=?, profit=?, components=? WHERE id=?")
                .bind(item_code).bind(desc).bind(unit).bind(overhead).bind(profit).bind(components).bind(id).execute(&pool).await.map(|_| id.clone()).map_err(|e| e.to_string()))?
        }
    }
    
    let insert_id = if data.isNew { uuid::Uuid::new_v4().to_string() } else { data.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()) };
    handle!(sqlx::query("INSERT INTO master_boq (id, itemCode, description, unit, overhead, profit, components) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&insert_id).bind(item_code).bind(desc).bind(unit).bind(overhead).bind(profit).bind(components).execute(&pool).await.map(|_| insert_id).map_err(|e| e.to_string()))
}
pub async fn delete_master_boq(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "master_boq", &id).await.map(|_| true)) }

// --- MISC / CHAT / LOGS ---
pub async fn get_worklogs(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<WorkLog>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, WorkLog>("SELECT * FROM staff_work_logs ORDER BY date DESC, slNo DESC").fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_worklog(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "staff_work_logs", payload, true).await) }
pub async fn update_worklog(State(pool): State<SqlitePool>, Path(id): Path<String>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_update(&pool, "staff_work_logs", &id, payload).await.map(|_| true)) }
pub async fn delete_worklog(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "staff_work_logs", &id).await.map(|_| true)) }

pub async fn get_project_docs(State(pool): State<SqlitePool>, Path(pid): Path<String>) -> Result<Json<ApiResponse<Vec<ProjectDocument>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, ProjectDocument>("SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC").bind(pid).fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_project_doc(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "project_documents", payload, true).await) }
pub async fn delete_project_doc(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "project_documents", &id).await.map(|_| true)) }

pub async fn get_messages(State(pool): State<SqlitePool>, Query(params): Query<HashMap<String, String>>) -> Result<Json<ApiResponse<Vec<Message>>>, (StatusCode, Json<ApiResponse<()>>)> {
    let q = if let Some(pid) = params.get("projectId") { sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE projectId = ? ORDER BY createdAt ASC").bind(pid).fetch_all(&pool).await } else { sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE projectId IS NULL ORDER BY createdAt ASC").fetch_all(&pool).await };
    handle!(q.map_err(|e| e.to_string()))
}
pub async fn save_message(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "messages", payload, true).await) }
pub async fn delete_message(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "messages", &id).await.map(|_| true)) }

pub async fn get_private_messages(State(pool): State<SqlitePool>, Path((u1, u2)): Path<(String, String)>) -> Result<Json<ApiResponse<Vec<PrivateMessage>>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(sqlx::query_as::<_, PrivateMessage>("SELECT * FROM private_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC").bind(u1.clone()).bind(u2.clone()).bind(u2).bind(u1).fetch_all(&pool).await.map_err(|e| e.to_string())) }
pub async fn save_private_message(State(pool): State<SqlitePool>, Json(payload): Json<serde_json::Map<String, Value>>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(secure_insert(&pool, "private_messages", payload, true).await) }
pub async fn delete_private_message(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> { handle!(generic_delete(&pool, "private_messages", &id).await.map(|_| true)) }

pub async fn check_notifications() -> Json<ApiResponse<i32>> { Json(ApiResponse { success: true, data: Some(0), error: None }) }
pub async fn get_kanban_tasks() -> Json<ApiResponse<Vec<Value>>> { Json(ApiResponse { success: true, data: Some(vec![]), error: None }) }