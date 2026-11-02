use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
    routing::get,
};
use rust_embed::RustEmbed;

mod zoezi;

#[derive(RustEmbed)]
#[folder = "frontend/build"]
struct Assets;

fn serve(path: &str) -> Response {
    match Assets::get(path) {
        Some(file) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(file.data))
                .unwrap()
        }
        None => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

async fn handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() {
        return serve("index.html");
    }

    if Assets::get(path).is_some() {
        return serve(path);
    }

    // SPA fallback: unknown paths (client-side routes) get the app shell.
    serve("index.html")
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    println!("Shutting down...");
}

#[tokio::main]
async fn main() {
    let origin = if std::env::var("ZOEZI_ENABLED").as_deref() == Ok("true") {
        let origin = std::env::var("ZOEZI_PUBLIC_ORIGIN")
            .expect("ZOEZI_PUBLIC_ORIGIN is required when Zoezi is enabled");
        let url = reqwest::Url::parse(&origin).expect("Invalid ZOEZI_PUBLIC_ORIGIN");
        assert!(
            url.scheme() == "https" && url.origin().ascii_serialization() == origin,
            "ZOEZI_PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash"
        );
        Some(origin)
    } else {
        None
    };
    let app = Router::new()
        .nest("/api/zoezi", zoezi::router(origin))
        .fallback(get(handler));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let addr = format!("{host}:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Americano listening on http://{addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();
}
