use crate::{routes::ApiResponse, routes::api_response};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use shared::{Project, ProjectDocument};
use sqlx::{QueryBuilder, Sqlite, SqlitePool};

#[derive(Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub code: Option<String>,
    #[serde(rename = "clientName")]
    pub client_name: Option<String>,
    pub status: Option<String>,
    pub region: Option<String>,
    #[serde(rename = "type")]
    pub project_type: Option<String>,
    pub location: Option<String>,
}

// 🔥 FULLY EXPANDED UPDATE STRUCT
#[derive(Deserialize)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub code: Option<String>,
    #[serde(rename = "clientName")] pub client_name: Option<String>,
    pub status: Option<String>,
    pub region: Option<String>,
    #[serde(rename = "projectLead")] pub project_lead: Option<String>,
    #[serde(rename = "siteSupervisor")] pub site_supervisor: Option<String>,
    pub pmc: Option<String>,
    pub architect: Option<String>,
    #[serde(rename = "structuralEngineer")] pub structural_engineer: Option<String>,
    #[serde(rename = "isPriceLocked")] pub is_price_locked: Option<i64>,
    #[serde(rename = "dailyLogs")] pub daily_logs: Option<String>,
    #[serde(rename = "actualResources")] pub actual_resources: Option<String>,
    #[serde(rename = "ganttTasks")] pub gantt_tasks: Option<String>,
    pub subcontractors: Option<String>,
    #[serde(rename = "phaseAssignments")] pub phase_assignments: Option<String>,
    #[serde(rename = "raBills")] pub ra_bills: Option<String>,
    #[serde(rename = "purchaseOrders")] pub purchase_orders: Option<String>,
    #[serde(rename = "materialRequests")] pub material_requests: Option<String>,
    pub grns: Option<String>,
    #[serde(rename = "type")] pub project_type: Option<String>,
    pub location: Option<String>,
    #[serde(rename = "isScaffolded")] pub is_scaffolded: Option<i64>,
    #[serde(rename = "scaffoldPath")] pub scaffold_path: Option<String>,
    #[serde(rename = "isManuallyLinked")] pub is_manually_linked: Option<i64>,
    #[serde(rename = "dailySchedules")] pub daily_schedules: Option<String>,
    #[serde(rename = "resourceTrackingMode")] pub resource_tracking_mode: Option<String>,
    #[serde(rename = "assignedStaff")] pub assigned_staff: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateDocument {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub category: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileType")]
    pub file_type: String,
}

pub async fn get_projects(
    State(pool): State<SqlitePool>,
) -> Result<Json<ApiResponse<Vec<Project>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query_as::<_, Project>("SELECT * FROM projects")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string()),
    )
}

pub async fn get_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Project>>, (StatusCode, Json<ApiResponse<()>>)> {
    match sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| e.to_string())
    {
        Ok(Some(p)) => Ok(Json(ApiResponse {
            success: true,
            data: Some(p),
            error: None,
        })),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Not found".into()),
            }),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some(e),
            }),
        )),
    }
}

pub async fn add_project(
    State(pool): State<SqlitePool>,
    Json(payload): Json<CreateProject>,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let q = "INSERT INTO projects (id, name, code, clientName, status, region, type, location, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    api_response(
        sqlx::query(q)
            .bind(&id)
            .bind(payload.name)
            .bind(payload.code)
            .bind(payload.client_name)
            .bind(payload.status.unwrap_or_else(|| "Active".to_string()))
            .bind(payload.region)
            .bind(payload.project_type)
            .bind(payload.location)
            .bind(created_at)
            .execute(&pool)
            .await
            .map(|_| id)
            .map_err(|e| e.to_string()),
    )
}

pub async fn update_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProject>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE projects SET ");
    let mut has_fields = false;

    // 🔥 FULLY EXPANDED QUERY BUILDER
    if let Some(v) = payload.name { qb.push("name = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.code { if has_fields { qb.push(", "); } qb.push("code = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.client_name { if has_fields { qb.push(", "); } qb.push("clientName = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.status { if has_fields { qb.push(", "); } qb.push("status = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.region { if has_fields { qb.push(", "); } qb.push("region = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.project_lead { if has_fields { qb.push(", "); } qb.push("projectLead = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.site_supervisor { if has_fields { qb.push(", "); } qb.push("siteSupervisor = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.pmc { if has_fields { qb.push(", "); } qb.push("pmc = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.architect { if has_fields { qb.push(", "); } qb.push("architect = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.structural_engineer { if has_fields { qb.push(", "); } qb.push("structuralEngineer = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.is_price_locked { if has_fields { qb.push(", "); } qb.push("isPriceLocked = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.daily_logs { if has_fields { qb.push(", "); } qb.push("dailyLogs = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.actual_resources { if has_fields { qb.push(", "); } qb.push("actualResources = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.gantt_tasks { if has_fields { qb.push(", "); } qb.push("ganttTasks = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.subcontractors { if has_fields { qb.push(", "); } qb.push("subcontractors = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.phase_assignments { if has_fields { qb.push(", "); } qb.push("phaseAssignments = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.ra_bills { if has_fields { qb.push(", "); } qb.push("raBills = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.purchase_orders { if has_fields { qb.push(", "); } qb.push("purchaseOrders = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.material_requests { if has_fields { qb.push(", "); } qb.push("materialRequests = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.grns { if has_fields { qb.push(", "); } qb.push("grns = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.project_type { if has_fields { qb.push(", "); } qb.push("type = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.location { if has_fields { qb.push(", "); } qb.push("location = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.is_scaffolded { if has_fields { qb.push(", "); } qb.push("isScaffolded = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.scaffold_path { if has_fields { qb.push(", "); } qb.push("scaffoldPath = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.is_manually_linked { if has_fields { qb.push(", "); } qb.push("isManuallyLinked = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.daily_schedules { if has_fields { qb.push(", "); } qb.push("dailySchedules = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.resource_tracking_mode { if has_fields { qb.push(", "); } qb.push("resourceTrackingMode = ").push_bind(v); has_fields = true; }
    if let Some(v) = payload.assigned_staff { if has_fields { qb.push(", "); } qb.push("assignedStaff = ").push_bind(v); has_fields = true; }

    if !has_fields {
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(true),
            error: None,
        }));
    }
    qb.push(" WHERE id = ").push_bind(id);
    api_response(
        qb.build()
            .execute(&pool)
            .await
            .map(|_| true)
            .map_err(|e| e.to_string()),
    )
}

pub async fn delete_project(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => return api_response(Err(e.to_string())),
    };
    let _ = sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await;
    let _ = sqlx::query("DELETE FROM project_boq WHERE projectId = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await;
    let _ = sqlx::query("DELETE FROM project_documents WHERE projectId = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await;
    api_response(tx.commit().await.map(|_| true).map_err(|e| e.to_string()))
}

pub async fn purge_projects(
    State(pool): State<SqlitePool>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => return api_response(Err(e.to_string())),
    };
    let _ = sqlx::query("DELETE FROM projects").execute(&mut *tx).await;
    let _ = sqlx::query("DELETE FROM project_boq")
        .execute(&mut *tx)
        .await;
    let _ = sqlx::query("DELETE FROM project_documents")
        .execute(&mut *tx)
        .await;
    api_response(tx.commit().await.map(|_| true).map_err(|e| e.to_string()))
}

pub async fn get_project_docs(
    State(pool): State<SqlitePool>,
    Path(pid): Path<String>,
) -> Result<Json<ApiResponse<Vec<ProjectDocument>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query_as::<_, ProjectDocument>(
            "SELECT * FROM project_documents WHERE projectId = ? ORDER BY addedAt DESC",
        )
        .bind(pid)
        .fetch_all(&pool)
        .await
        .map_err(|e| e.to_string()),
    )
}

pub async fn save_project_doc(
    State(pool): State<SqlitePool>,
    Json(payload): Json<CreateDocument>,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = uuid::Uuid::new_v4().to_string();
    let added_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let q = "INSERT INTO project_documents (id, projectId, name, category, filePath, fileType, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?)";
    api_response(
        sqlx::query(q)
            .bind(&id)
            .bind(payload.project_id)
            .bind(payload.name)
            .bind(payload.category)
            .bind(payload.file_path)
            .bind(payload.file_type)
            .bind(added_at)
            .execute(&pool)
            .await
            .map(|_| id)
            .map_err(|e| e.to_string()),
    )
}

pub async fn delete_project_doc(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query("DELETE FROM project_documents WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map(|_| true)
            .map_err(|e| e.to_string()),
    )
}