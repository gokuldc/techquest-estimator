use crate::{routes::ApiResponse, routes::api_response};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use shared::{Staff, WorkLog};
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct SaveStaff {
    pub id: Option<String>,
    pub name: String,
    pub designation: Option<String>,
    pub department: Option<String>,
    pub status: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub role: Option<String>,
    #[serde(rename = "accessLevel")]
    pub access_level: Option<i32>,
}

#[derive(Deserialize)]
pub struct SaveWorkLog {
    pub date: String,
    #[serde(rename = "staffId")]
    pub staff_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "slNo")]
    pub sl_no: Option<i64>,
    pub details: String,
    pub remarks: Option<String>,
    pub status: Option<String>,
}

pub async fn get_staff(
    State(pool): State<SqlitePool>,
) -> Result<Json<ApiResponse<Vec<Staff>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query_as::<_, Staff>("SELECT * FROM org_staff")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())
    )
}

pub async fn save_staff(
    State(pool): State<SqlitePool>,
    Json(payload): Json<SaveStaff>,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = payload
        .id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let q = "INSERT OR REPLACE INTO org_staff (id, name, designation, department, status, email, phone, username, password, role, accessLevel, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    api_response(
        sqlx::query(q)
            .bind(&id)
            .bind(payload.name)
            .bind(payload.designation)
            .bind(payload.department)
            .bind(payload.status)
            .bind(payload.email)
            .bind(payload.phone)
            .bind(payload.username)
            .bind(payload.password)
            .bind(payload.role)
            .bind(payload.access_level.unwrap_or(1))
            .bind(created_at)
            .execute(&pool)
            .await
            .map(|_| id)
            .map_err(|e| e.to_string())
    )
}

pub async fn delete_staff(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query("DELETE FROM org_staff WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map(|_| true)
            .map_err(|e| e.to_string())
    )
}

pub async fn get_worklogs(
    State(pool): State<SqlitePool>,
) -> Result<Json<ApiResponse<Vec<WorkLog>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query_as::<_, WorkLog>("SELECT * FROM staff_work_logs ORDER BY date DESC, slNo DESC")
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())
    )
}

pub async fn save_worklog(
    State(pool): State<SqlitePool>,
    Json(payload): Json<SaveWorkLog>,
) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let sl = payload.sl_no.unwrap_or(1);

    let q = "INSERT INTO staff_work_logs (id, date, staffId, projectId, slNo, details, remarks, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    api_response(
        sqlx::query(q)
            .bind(&id)
            .bind(payload.date)
            .bind(payload.staff_id)
            .bind(payload.project_id)
            .bind(sl)
            .bind(payload.details)
            .bind(payload.remarks)
            .bind(payload.status)
            .bind(created_at)
            .execute(&pool)
            .await
            .map(|_| id)
            .map_err(|e| e.to_string())
    )
}

pub async fn update_worklog(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(payload): Json<SaveWorkLog>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    let q = "UPDATE staff_work_logs SET date=?, staffId=?, projectId=?, slNo=?, details=?, remarks=?, status=? WHERE id=?";
    api_response(
        sqlx::query(q)
            .bind(payload.date)
            .bind(payload.staff_id)
            .bind(payload.project_id)
            .bind(payload.sl_no)
            .bind(payload.details)
            .bind(payload.remarks)
            .bind(payload.status)
            .bind(id)
            .execute(&pool)
            .await
            .map(|_| true)
            .map_err(|e| e.to_string())
    )
}

pub async fn delete_worklog(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(
        sqlx::query("DELETE FROM staff_work_logs WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map(|_| true)
            .map_err(|e| e.to_string())
    )
}
