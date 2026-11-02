use super::*;
use axum::{
    Extension,
    body::{Body, to_bytes},
    http::Request,
};
use std::sync::atomic::{AtomicU16, Ordering};
use tower::ServiceExt;

const APP_ORIGIN: &str = "https://pickleball.example";

struct Mock {
    task: tokio::task::JoinHandle<()>,
    bookings_status: Arc<AtomicU16>,
    url: Url,
}

impl Drop for Mock {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn mock() -> Mock {
    let bookings_status = Arc::new(AtomicU16::new(200));
    let mock = Router::new()
        .route("/api/v8.0/memberapi/login", post(|Json(body): Json<Value>| async move {
            let user = body["login"].as_str().unwrap_or("");
            if body["password"] != format!("{user}-secret") || !["alice", "bob"].contains(&user) {
                return (StatusCode::UNAUTHORIZED, Json(json!({"message": "Do not forward upstream details"}))).into_response();
            }
            ([(header::SET_COOKIE, format!("session={user}; Path=/; HttpOnly"))], Json(json!({"id": 1}))).into_response()
        }))
        .route("/api/memberapi/get/current", get(|headers: HeaderMap| async move {
            match headers.get(header::COOKIE).and_then(|h| h.to_str().ok()) {
                Some("session=alice" | "session=bob") => Json(json!({"id": 1, "private_profile": "must not leave the server"})).into_response(),
                _ => StatusCode::UNAUTHORIZED.into_response(),
            }
        }))
        .route("/api/public/workout/get/all", get(|| async {
            Json(json!({"workouts": [
                {"id":266,"workoutType":{"name":"Pickleball"},"status":"Ok","startTime":"2026-11-02 18:00:00","extra_title":"Drop in","courses":[]},
                {"id":267,"workoutType":{"name":"Tennis"},"status":"Ok"},
                {"id":268,"workoutType":{"name":"Pickleball"},"status":"Cancelled"}
            ]}))
        }))
        .route("/api/memberapi/workout/bookings/get", get({
            let code = bookings_status.clone();
            move |headers: HeaderMap| {
                let code = code.clone();
                async move {
                    let status = StatusCode::from_u16(code.load(Ordering::Relaxed)).unwrap();
                    if status != StatusCode::OK { return (status, "private upstream error").into_response(); }
                    let (id, name) = if headers.get(header::COOKIE).unwrap() == "session=alice" { (18, "Alice") } else { (19, "Bob") };
                    Json(json!([
                        {"id":id,"name":name,"booking":true,"inQueue":false,"private_field":"must not leave the server"},
                        {"id":20,"name":"Waiting","booking":true,"inQueue":true},
                        {"id":21,"name":"Invited","booking":false,"inQueue":false}
                    ])).into_response()
                }
            }
        }))
        .route("/api/memberapi/logout", post(|| async { StatusCode::NO_CONTENT }))
        .route("/broken", get(|| async { "not json" }))
        .route("/large", get(|| async { "x".repeat(MAX_RESPONSE + 1) }))
        .route("/slow", get(|| async { tokio::time::sleep(Duration::from_secs(2)).await; Json(json!({})) }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = Url::parse(&format!("http://{}", listener.local_addr().unwrap())).unwrap();
    let task = tokio::spawn(async move { axum::serve(listener, mock).await.unwrap() });
    Mock {
        task,
        bookings_status,
        url,
    }
}

fn app(upstream: &Mock) -> (Router, Arc<AppState>) {
    let mut state = AppState::new(Some(APP_ORIGIN.to_owned()));
    Arc::get_mut(&mut state).unwrap().upstream = upstream.url.clone();
    let router = routes(state.clone()).layer(Extension(ConnectInfo(
        "127.0.0.1:1234".parse::<SocketAddr>().unwrap(),
    )));
    (router, state)
}

async fn call(
    app: &Router,
    method: Method,
    path: &str,
    cookie: Option<&str>,
    body: Option<Value>,
) -> Response {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header(header::ORIGIN, APP_ORIGIN)
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(cookie) = cookie {
        request = request.header(header::COOKIE, cookie);
    }
    app.clone()
        .oneshot(
            request
                .body(Body::from(body.map(|b| b.to_string()).unwrap_or_default()))
                .unwrap(),
        )
        .await
        .unwrap()
}

async fn body(response: Response) -> Value {
    serde_json::from_slice(
        &to_bytes(response.into_body(), 4 * MAX_RESPONSE)
            .await
            .unwrap(),
    )
    .unwrap()
}

async fn login_as(app: &Router, user: &str, old_cookie: Option<&str>) -> String {
    let response = call(
        app,
        Method::POST,
        "/login",
        old_cookie,
        Some(json!({"login":user,"password":format!("{user}-secret")})),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
    let set_cookie = response.headers()[header::SET_COOKIE].to_str().unwrap();
    assert!(set_cookie.contains("Secure; HttpOnly; SameSite=Strict; Max-Age=43200"));
    let cookie = set_cookie.split(';').next().unwrap().to_owned();
    assert_eq!(body(response).await, json!({"authenticated":true}));
    cookie
}

async fn load(app: &Router, cookie: &str) {
    let response = call(
        app,
        Method::GET,
        "/workouts?date=2026-11-02",
        Some(cookie),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        body(response).await["workouts"].as_array().unwrap().len(),
        1
    );
}

#[tokio::test]
async fn isolates_accounts_filters_participants_and_rotates_sessions() {
    let upstream = mock().await;
    let (app, state) = app(&upstream);
    let (alice, bob) = tokio::join!(login_as(&app, "alice", None), login_as(&app, "bob", None));
    assert_ne!(alice, bob);
    tokio::join!(load(&app, &alice), load(&app, &bob));
    for (cookie, id, name) in [(&alice, 18, "Alice"), (&bob, 19, "Bob")] {
        let response = call(
            &app,
            Method::GET,
            "/workouts/266/participants",
            Some(cookie),
            None,
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let data = body(response).await;
        assert_eq!(data["participants"], json!([{"id":id,"name":name}]));
        assert_eq!(data["origin"], ZOEZI_ORIGIN);
        assert_eq!(data["workout"]["title"], "Pickleball — Drop in");
        assert!(!data.to_string().contains("private"));
    }
    let replacement = login_as(&app, "bob", Some(&alice)).await;
    assert_eq!(state.sessions.lock().unwrap().len(), 2);
    assert_eq!(
        call(
            &app,
            Method::GET,
            "/workouts?date=2026-11-02",
            Some(&alice),
            None
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    assert_ne!(replacement, alice);
    let response = call(
        &app,
        Method::POST,
        "/logout",
        Some(&replacement),
        Some(json!({})),
    )
    .await;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(
        response.headers()[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert_eq!(state.sessions.lock().unwrap().len(), 1);
    assert_eq!(
        body(call(&app, Method::GET, "/status", Some(&bob), None).await).await["authenticated"],
        true
    );
}

#[tokio::test]
async fn rejects_cross_origin_login_and_logout_and_does_not_echo_passwords() {
    let upstream = mock().await;
    let (app, state) = app(&upstream);
    for origin in [None, Some("https://evil.example"), Some("null")] {
        for path in ["/login", "/logout"] {
            let mut request = Request::builder()
                .method(Method::POST)
                .uri(path)
                .header(header::CONTENT_TYPE, "application/json");
            if let Some(origin) = origin {
                request = request.header(header::ORIGIN, origin);
            }
            let response = app
                .clone()
                .oneshot(
                    request
                        .body(Body::from(
                            r#"{"login":"alice","password":"sensitive-value"}"#,
                        ))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
        }
    }
    let response = call(
        &app,
        Method::POST,
        "/login",
        None,
        Some(json!({"login":"alice","password":"wrong-secret"})),
    )
    .await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let text = body(response).await.to_string();
    assert!(!text.contains("wrong-secret") && !text.contains("Do not forward"));
    assert!(state.sessions.lock().unwrap().is_empty());
    for _ in 0..4 {
        call(
            &app,
            Method::POST,
            "/login",
            None,
            Some(json!({"login":"alice","password":"wrong"})),
        )
        .await;
    }
    assert_eq!(
        call(
            &app,
            Method::POST,
            "/login",
            None,
            Some(json!({"login":"alice","password":"alice-secret"}))
        )
        .await
        .status(),
        StatusCode::TOO_MANY_REQUESTS
    );
}

#[tokio::test]
async fn expires_sessions_and_requires_login_after_restart() {
    let upstream = mock().await;
    let (app, state) = app(&upstream);
    let cookie = login_as(&app, "alice", None).await;
    for session in state.sessions.lock().unwrap().values_mut() {
        Arc::get_mut(session).unwrap().expires = Instant::now() - Duration::from_secs(1);
    }
    state.cleanup();
    assert!(state.sessions.lock().unwrap().is_empty());
    let response = call(
        &app,
        Method::GET,
        "/workouts?date=2026-11-02",
        Some(&cookie),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert!(
        response.headers()[header::SET_COOKIE]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    let new_app = routes(AppState::new(Some(APP_ORIGIN.to_owned())));
    assert_eq!(
        body(call(&new_app, Method::GET, "/status", Some(&cookie), None).await).await["authenticated"],
        false
    );
}

#[tokio::test]
async fn permission_errors_preserve_session_but_upstream_expiry_revokes_it() {
    let upstream = mock().await;
    let (app, state) = app(&upstream);
    let cookie = login_as(&app, "alice", None).await;
    load(&app, &cookie).await;
    for status in [403, 429, 500] {
        upstream.bookings_status.store(status, Ordering::Relaxed);
        let response = call(
            &app,
            Method::GET,
            "/workouts/266/participants",
            Some(&cookie),
            None,
        )
        .await;
        assert_eq!(
            response.status().as_u16(),
            if status == 500 { 502 } else { status }
        );
        assert!(
            !body(response)
                .await
                .to_string()
                .contains("private upstream")
        );
        assert_eq!(state.sessions.lock().unwrap().len(), 1);
    }
    upstream.bookings_status.store(401, Ordering::Relaxed);
    assert_eq!(
        call(
            &app,
            Method::GET,
            "/workouts/266/participants",
            Some(&cookie),
            None
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    assert!(state.sessions.lock().unwrap().is_empty());
}

#[tokio::test]
async fn rejects_invalid_dates_unselected_workouts_and_disabled_integration() {
    let upstream = mock().await;
    let (app, _) = app(&upstream);
    let cookie = login_as(&app, "alice", None).await;
    for path in [
        "/workouts?date=2026-02-30",
        "/workouts?date=2026-1-1",
        "/workouts/999/participants",
    ] {
        assert_eq!(
            call(&app, Method::GET, path, Some(&cookie), None)
                .await
                .status(),
            StatusCode::BAD_REQUEST
        );
    }
    let disabled = routes(AppState::new(None));
    assert_eq!(
        body(call(&disabled, Method::GET, "/status", None, None).await).await,
        json!({"enabled":false,"authenticated":false})
    );
    assert_eq!(
        call(
            &disabled,
            Method::GET,
            "/workouts?date=2026-11-02",
            None,
            None
        )
        .await
        .status(),
        StatusCode::SERVICE_UNAVAILABLE
    );
    assert_eq!(
        call(&app, Method::GET, "/unknown", None, None)
            .await
            .status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn handles_malformed_oversized_and_slow_upstream_responses() {
    let upstream = mock().await;
    let client = Client::builder()
        .timeout(Duration::from_millis(100))
        .build()
        .unwrap();
    for path in ["/broken", "/large", "/slow"] {
        let result = read_json(client.get(upstream.url.join(path).unwrap())).await;
        assert!(matches!(result, Err(ApiError(StatusCode::BAD_GATEWAY, _))));
    }
}

#[test]
fn only_trusts_forwarded_addresses_from_local_proxy() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "x-forwarded-for",
        HeaderValue::from_static("203.0.113.1, 203.0.113.2"),
    );
    assert_eq!(
        client_ip(&headers, "127.0.0.1:5000".parse().unwrap()),
        "203.0.113.2".parse::<IpAddr>().unwrap()
    );
    assert_eq!(
        client_ip(&headers, "198.51.100.1:5000".parse().unwrap()),
        "198.51.100.1".parse::<IpAddr>().unwrap()
    );
}

#[test]
fn rejects_malformed_and_duplicate_member_identities() {
    let person = json!({"id":18,"name":" Alice ","booking":true,"inQueue":false});
    assert_eq!(
        parse_participants(&json!([person.clone()])).unwrap(),
        vec![json!({"id":18,"name":"Alice"})]
    );
    for data in [
        json!({}),
        json!([person.clone(), person]),
        json!([{"id":0,"name":"A","booking":true,"inQueue":false}]),
        json!([{"id":1,"name":" ","booking":true,"inQueue":false}]),
    ] {
        assert!(parse_participants(&data).is_err());
    }
}
