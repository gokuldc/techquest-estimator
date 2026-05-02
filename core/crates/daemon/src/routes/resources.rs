use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Deserialize;
use sqlx::SqlitePool;
use shared::{Region, Resource};
use crate::{routes::ApiResponse, routes::api_response};

#[derive(Deserialize)]
pub struct CreateRegion { pub name: String }

#[derive(Deserialize)]
pub struct SaveResource {
    pub id: Option<String>,
    pub code: String,
    pub description: String,
    pub unit: String,
    pub rates: Option<String>,
    #[serde(rename = "rateHistory")] pub rate_history: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateResourceField { pub field: String, pub value: String } // Used for quick rate updates

pub async fn get_regions(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Region>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(sqlx::query_as::<_, Region>("SELECT * FROM regions ORDER BY name ASC").fetch_all(&pool).await.map_err(|e| e.to_string()))
}

pub async fn save_region(State(pool): State<SqlitePool>, Json(payload): Json<CreateRegion>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = uuid::Uuid::new_v4().to_string();
    api_response(sqlx::query("INSERT INTO regions (id, name) VALUES (?, ?)").bind(&id).bind(payload.name).execute(&pool).await.map(|_| id).map_err(|e| e.to_string()))
}

pub async fn delete_region(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(sqlx::query("DELETE FROM regions WHERE id = ?").bind(id).execute(&pool).await.map(|_| true).map_err(|e| e.to_string()))
}

pub async fn get_resources(State(pool): State<SqlitePool>) -> Result<Json<ApiResponse<Vec<Resource>>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(sqlx::query_as::<_, Resource>("SELECT * FROM resources ORDER BY code ASC").fetch_all(&pool).await.map_err(|e| e.to_string()))
}

pub async fn save_resource(State(pool): State<SqlitePool>, Json(payload): Json<SaveResource>) -> Result<Json<ApiResponse<String>>, (StatusCode, Json<ApiResponse<()>>)> {
    let id = payload.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let q = "INSERT OR REPLACE INTO resources (id, code, description, unit, rates, rateHistory) VALUES (?, ?, ?, ?, ?, ?)";
    api_response(sqlx::query(q).bind(&id).bind(payload.code).bind(payload.description).bind(payload.unit).bind(payload.rates.unwrap_or_else(|| "{}".into())).bind(payload.rate_history.unwrap_or_else(|| "[]".into()))
        .execute(&pool).await.map(|_| id).map_err(|e| e.to_string()))
}

pub async fn update_resource(State(pool): State<SqlitePool>, Path(id): Path<String>, Json(payload): Json<UpdateResourceField>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    // Validates column names strictly for dynamic field updates
    if payload.field != "rates" && payload.field != "rateHistory" { return Err((StatusCode::BAD_REQUEST, Json(ApiResponse { success: false, data: None, error: Some("Invalid field".into()) }))); }
    let q = format!("UPDATE resources SET {} = ? WHERE id = ?", payload.field);
    api_response(sqlx::query(&q).bind(payload.value).bind(id).execute(&pool).await.map(|_| true).map_err(|e| e.to_string()))
}

pub async fn delete_resource(State(pool): State<SqlitePool>, Path(id): Path<String>) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ApiResponse<()>>)> {
    api_response(sqlx::query("DELETE FROM resources WHERE id = ?").bind(id).execute(&pool).await.map(|_| true).map_err(|e| e.to_string()))
}