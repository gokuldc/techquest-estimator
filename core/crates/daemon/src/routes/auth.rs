use crate::routes::ApiResponse;
use axum::{
    Json,
    extract::State,
    http::StatusCode,
};
use serde::Deserialize;
use shared::Staff;
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

pub async fn login(
    State(pool): State<SqlitePool>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<ApiResponse<Staff>>, (StatusCode, Json<ApiResponse<()>>)> {
    let res = sqlx::query_as::<_, Staff>("SELECT * FROM org_staff WHERE LOWER(username) = LOWER(?) AND password = ? AND status = 'Active'")
        .bind(payload.username).bind(payload.password).fetch_optional(&pool).await.map_err(|e| e.to_string());

    match res {
        // Return standard JSON immediately. No macro needed here!
        Ok(Some(u)) => Ok(Json(ApiResponse {
            success: true,
            data: Some(u),
            error: None,
        })),
        Ok(None) => Err((
            StatusCode::UNAUTHORIZED,
            Json(ApiResponse {
                success: false,
                data: None,
                error: Some("Invalid Credentials".to_string()),
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
