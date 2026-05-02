use axum::{body::Body, extract::Query, http::{header, StatusCode}, response::IntoResponse, Json};
use serde::Deserialize;
use std::{fs, path::Path};
use crate::routes::ApiResponse;

#[derive(Deserialize)]
pub struct DownloadQuery { pub path: String }

#[derive(Deserialize)]
pub struct UploadPayload { pub filename: String, pub base64: String }

pub async fn download_file(Query(params): Query<DownloadQuery>) -> impl IntoResponse {
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_else(|_| ".".to_string());
    let base_dir = Path::new(&home).join(".openprix").join("uploads");
    let requested_path = base_dir.join(&params.path);
    
    let canonical_requested = match requested_path.canonicalize() { Ok(path) => path, Err(_) => return (StatusCode::NOT_FOUND, "File not found").into_response(), };
    let canonical_base = match base_dir.canonicalize() { Ok(path) => path, Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Base directory error").into_response(), };

    if !canonical_requested.starts_with(canonical_base) { return (StatusCode::FORBIDDEN, "Access denied").into_response(); }

    match tokio::fs::read(&canonical_requested).await {
        Ok(contents) => {
            let filename = canonical_requested.file_name().and_then(|n| n.to_str()).unwrap_or("file");
            (StatusCode::OK, [(header::CONTENT_TYPE, "application/octet-stream"), (header::CONTENT_DISPOSITION, &format!("attachment; filename=\"{}\"", filename))], Body::from(contents)).into_response()
        },
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response()
    }
}

pub async fn upload_file(Json(payload): Json<UploadPayload>) -> Json<ApiResponse<String>> {
    let b64_clean = if let Some(idx) = payload.base64.find(',') { &payload.base64[idx+1..] } else { &payload.base64 };
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_else(|_| ".".to_string());
    let upload_dir = Path::new(&home).join(".openprix").join("uploads");
    fs::create_dir_all(&upload_dir).unwrap_or_default();
    
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    let safe_name = format!("{}_{}", ts, payload.filename.replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '-' && c != '_', ""));
    let filepath = upload_dir.join(&safe_name);
    
    use base64::{Engine as _, engine::general_purpose};
    match general_purpose::STANDARD.decode(b64_clean) {
        Ok(bytes) => { 
            fs::write(&filepath, bytes).unwrap_or_default(); 
            Json(ApiResponse { success: true, data: Some(filepath.to_string_lossy().to_string()), error: None }) 
        },
        Err(_) => Json(ApiResponse { success: false, data: None, error: Some("Base64 decode failed".into()) })
    }
}