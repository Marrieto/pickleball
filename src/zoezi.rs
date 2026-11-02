use std::{
    collections::{HashMap, HashSet},
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::{
        ConnectInfo, DefaultBodyLimit, Path, Query, Request, State, rejection::JsonRejection,
    },
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use rand::RngCore;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::sync::Semaphore;
use zeroize::Zeroize;

const ZOEZI_ORIGIN: &str = "https://korpenkalmarpickleballklubb.zoezi.se";
const COOKIE: &str = "__Host-pickleball_session";
const SESSION_TTL: Duration = Duration::from_secs(12 * 60 * 60);
const MAX_SESSIONS: usize = 512;
const MAX_RESPONSE: usize = 2 * 1024 * 1024;
const MAX_ID: u64 = 9_007_199_254_740_991;

#[derive(Debug)]
struct ApiError(StatusCode, &'static str);
type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "message": self.1 }))).into_response()
    }
}

fn unauthorized() -> ApiError {
    ApiError(StatusCode::UNAUTHORIZED, "Log in to Zoezi again.")
}

fn upstream_error() -> ApiError {
    ApiError(
        StatusCode::BAD_GATEWAY,
        "Could not read Zoezi's response. Try again later.",
    )
}

struct Session {
    client: Client,
    expires: Instant,
    workouts: Mutex<HashMap<u64, Workout>>,
}

struct Attempts {
    since: Instant,
    count: u32,
}

struct AppState {
    origin: Option<String>,
    upstream: Url,
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    attempts: Mutex<HashMap<IpAddr, Attempts>>,
    login_slots: Semaphore,
}

impl AppState {
    fn new(origin: Option<String>) -> Arc<Self> {
        Arc::new(Self {
            origin,
            upstream: Url::parse(ZOEZI_ORIGIN).unwrap(),
            sessions: Mutex::new(HashMap::new()),
            attempts: Mutex::new(HashMap::new()),
            login_slots: Semaphore::new(16),
        })
    }

    fn cleanup(&self) {
        let now = Instant::now();
        self.sessions.lock().unwrap().retain(|_, s| s.expires > now);
        self.attempts
            .lock()
            .unwrap()
            .retain(|_, a| now.duration_since(a.since) < Duration::from_secs(60));
    }

    fn session(&self, headers: &HeaderMap) -> ApiResult<(String, Arc<Session>)> {
        let id = session_id(headers).ok_or_else(unauthorized)?;
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(id).filter(|s| s.expires > Instant::now()) {
            return Ok((id.to_owned(), session.clone()));
        }
        sessions.remove(id);
        Err(unauthorized())
    }

    fn limit_login(&self, ip: IpAddr) -> ApiResult<()> {
        self.cleanup();
        let mut attempts = self.attempts.lock().unwrap();
        if attempts.len() >= 10_000 && !attempts.contains_key(&ip) {
            return Err(ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many login attempts. Wait a minute.",
            ));
        }
        let attempt = attempts.entry(ip).or_insert(Attempts {
            since: Instant::now(),
            count: 0,
        });
        if attempt.count >= 5 {
            return Err(ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "Too many login attempts. Wait a minute.",
            ));
        }
        attempt.count += 1;
        Ok(())
    }

    async fn read(
        &self,
        id: &str,
        session: &Session,
        request: reqwest::RequestBuilder,
    ) -> ApiResult<Value> {
        let result = read_json(request).await;
        if matches!(&result, Err(ApiError(StatusCode::UNAUTHORIZED, _))) {
            self.sessions.lock().unwrap().remove(id);
        }
        if session.expires <= Instant::now() || !self.sessions.lock().unwrap().contains_key(id) {
            return Err(unauthorized());
        }
        result
    }
}

pub fn router(origin: Option<String>) -> Router {
    let state = AppState::new(origin);
    let weak = Arc::downgrade(&state);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let Some(state) = weak.upgrade() else { break };
            state.cleanup();
        }
    });
    routes(state)
}

fn routes(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/status", get(status))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/workouts", get(workouts))
        .route("/workouts/{id}/participants", get(participants))
        .fallback(|| async { ApiError(StatusCode::NOT_FOUND, "Unknown Zoezi endpoint.") })
        .layer(DefaultBodyLimit::max(4096))
        .layer(middleware::from_fn_with_state(state.clone(), guard))
        .with_state(state)
}

async fn guard(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    let allowed = request.method() == Method::GET
        || request.method() == Method::HEAD
        || state.origin.as_deref().is_some_and(|origin| {
            request
                .headers()
                .get(header::ORIGIN)
                .and_then(|v| v.to_str().ok())
                == Some(origin)
        });
    let mut response = if !allowed {
        ApiError(
            StatusCode::FORBIDDEN,
            "Open Pickleball on its configured address and try again.",
        )
        .into_response()
    } else if state.origin.is_none() && request.uri().path() != "/status" {
        ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Direct Zoezi import is not enabled on this server.",
        )
        .into_response()
    } else {
        next.run(request).await
    };
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    if response.status() == StatusCode::UNAUTHORIZED {
        response
            .headers_mut()
            .insert(header::SET_COOKIE, clear_cookie());
    }
    response
}

fn session_id(headers: &HeaderMap) -> Option<&str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|v| v.trim().split_once('='))
        .find_map(|(name, value)| {
            (name == COOKIE && value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit()))
                .then_some(value)
        })
}

fn clear_cookie() -> HeaderValue {
    HeaderValue::from_static(
        "__Host-pickleball_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0",
    )
}

fn client_ip(headers: &HeaderMap, peer: SocketAddr) -> IpAddr {
    // Only the local reverse proxy may supply the client address.
    if peer.ip().is_loopback()
        && let Some(ip) = headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.rsplit(',').next())
            .and_then(|v| v.trim().parse().ok())
    {
        return ip;
    }
    peer.ip()
}

async fn status(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Json<Value> {
    Json(
        json!({ "enabled": state.origin.is_some(), "authenticated": state.session(&headers).is_ok() }),
    )
}

#[derive(Deserialize, Serialize)]
struct Credentials {
    login: String,
    password: String,
}

impl Drop for Credentials {
    fn drop(&mut self) {
        self.login.zeroize();
        self.password.zeroize();
    }
}

async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<Credentials>, JsonRejection>,
) -> ApiResult<Response> {
    state.limit_login(client_ip(&headers, peer))?;
    let _slot = state.login_slots.try_acquire().map_err(|_| {
        ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "Login is busy. Try again shortly.",
        )
    })?;
    let Json(credentials) = body.map_err(|_| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Enter your Zoezi email and password.",
        )
    })?;
    if credentials.login.trim().is_empty()
        || credentials.login.len() > 300
        || credentials.password.is_empty()
        || credentials.password.len() > 1000
    {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Enter your Zoezi email and password.",
        ));
    }
    let client = Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| upstream_error())?;
    let result = read_json(
        client
            .post(state.upstream.join("/api/v8.0/memberapi/login").unwrap())
            .json(&credentials),
    )
    .await;
    drop(credentials);
    match result {
        Err(ApiError(
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::BAD_REQUEST,
            _,
        )) => {
            return Err(ApiError(
                StatusCode::UNAUTHORIZED,
                "Zoezi login failed. Check your email and password.",
            ));
        }
        other => {
            other?;
        }
    }
    // A successful HTTP response alone is insufficient: verify that cookies authenticate.
    let user =
        read_json(client.get(state.upstream.join("/api/memberapi/get/current").unwrap())).await?;
    if !valid_id(user.get("id").and_then(Value::as_u64).unwrap_or(0)) {
        return Err(unauthorized());
    }
    let mut bytes = [0_u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    let id: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let mut sessions = state.sessions.lock().unwrap();
    sessions.retain(|_, s| s.expires > Instant::now());
    if let Some(previous) = session_id(&headers) {
        sessions.remove(previous);
    }
    if sessions.len() >= MAX_SESSIONS {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Too many connected users. Try again later.",
        ));
    }
    sessions.insert(
        id.clone(),
        Arc::new(Session {
            client,
            expires: Instant::now() + SESSION_TTL,
            workouts: Mutex::new(HashMap::new()),
        }),
    );
    let cookie = HeaderValue::from_str(&format!(
        "{COOKIE}={id}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age={}",
        SESSION_TTL.as_secs()
    ))
    .unwrap();
    Ok((
        [(header::SET_COOKIE, cookie)],
        Json(json!({ "authenticated": true })),
    )
        .into_response())
}

async fn logout(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let session = session_id(&headers).and_then(|id| state.sessions.lock().unwrap().remove(id));
    if let Some(session) = session {
        let _ = session
            .client
            .post(state.upstream.join("/api/memberapi/logout").unwrap())
            .send()
            .await;
    }
    (
        [(header::SET_COOKIE, clear_cookie())],
        StatusCode::NO_CONTENT,
    )
        .into_response()
}

async fn read_json(request: reqwest::RequestBuilder) -> ApiResult<Value> {
    let mut response = request.send().await.map_err(|_| upstream_error())?;
    match response.status() {
        StatusCode::UNAUTHORIZED => return Err(unauthorized()),
        StatusCode::FORBIDDEN => {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Your Zoezi account cannot view these participants.",
            ));
        }
        StatusCode::BAD_REQUEST => {
            return Err(ApiError(
                StatusCode::BAD_REQUEST,
                "Zoezi could not accept the request.",
            ));
        }
        StatusCode::TOO_MANY_REQUESTS => {
            return Err(ApiError(
                StatusCode::TOO_MANY_REQUESTS,
                "Zoezi is busy. Wait a moment and try again.",
            ));
        }
        status if !status.is_success() => return Err(upstream_error()),
        _ => {}
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| upstream_error())? {
        if body.len() + chunk.len() > MAX_RESPONSE {
            return Err(upstream_error());
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body).map_err(|_| upstream_error())
}

fn valid_id(id: u64) -> bool {
    id > 0 && id <= MAX_ID
}
fn valid_text(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 300
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Workout {
    id: u64,
    title: String,
    start_time: String,
}

#[derive(Deserialize)]
struct DateQuery {
    date: String,
}

async fn workouts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<DateQuery>,
) -> ApiResult<Json<Value>> {
    let (id, session) = state.session(&headers)?;
    let date = chrono::NaiveDate::parse_from_str(&query.date, "%Y-%m-%d")
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Choose a valid date."))?;
    if date.format("%Y-%m-%d").to_string() != query.date {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Choose a valid date."));
    }
    let data = state
        .read(
            &id,
            &session,
            session
                .client
                .get(state.upstream.join("/api/public/workout/get/all").unwrap())
                .query(&[("fromDate", &query.date), ("toDate", &query.date)]),
        )
        .await?;
    let mut workouts = parse_workouts(&data)?;
    workouts.sort_by(|a, b| a.start_time.cmp(&b.start_time));
    *session.workouts.lock().unwrap() = workouts.iter().map(|w| (w.id, w.clone())).collect();
    Ok(Json(json!({ "workouts": workouts })))
}

fn parse_workouts(data: &Value) -> ApiResult<Vec<Workout>> {
    let rows = data
        .get("workouts")
        .and_then(Value::as_array)
        .ok_or_else(upstream_error)?;
    if rows.len() > 1000 {
        return Err(upstream_error());
    }
    let mut workouts = Vec::new();
    let mut seen = HashSet::new();
    for row in rows {
        let name = row
            .pointer("/workoutType/name")
            .and_then(Value::as_str)
            .unwrap_or("");
        if !name.to_lowercase().contains("pickleball")
            || row.get("status").and_then(Value::as_str) != Some("Ok")
        {
            continue;
        }
        let id = row
            .get("id")
            .and_then(Value::as_u64)
            .filter(|id| valid_id(*id))
            .ok_or_else(upstream_error)?;
        if !seen.insert(id) {
            return Err(upstream_error());
        }
        let start_time = row
            .get("startTime")
            .and_then(Value::as_str)
            .filter(|s| valid_text(s))
            .ok_or_else(upstream_error)?;
        let mut parts = vec![name];
        if let Some(extra) = row
            .get("extra_title")
            .and_then(Value::as_str)
            .filter(|s| !s.trim().is_empty())
        {
            parts.push(extra);
        }
        if let Some(courses) = row.get("courses").and_then(Value::as_array) {
            parts.extend(
                courses
                    .iter()
                    .filter_map(|c| c.get("name").and_then(Value::as_str))
                    .filter(|s| !s.trim().is_empty()),
            );
        }
        let title = parts.join(" — ");
        if !valid_text(&title) {
            return Err(upstream_error());
        }
        workouts.push(Workout {
            id,
            title,
            start_time: start_time.to_owned(),
        });
    }
    Ok(workouts)
}

async fn participants(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(workout_id): Path<u64>,
) -> ApiResult<Json<Value>> {
    let (id, session) = state.session(&headers)?;
    let workout = session
        .workouts
        .lock()
        .unwrap()
        .get(&workout_id)
        .cloned()
        .ok_or(ApiError(
            StatusCode::BAD_REQUEST,
            "Choose a session from the loaded date first.",
        ))?;
    let data = state
        .read(
            &id,
            &session,
            session
                .client
                .get(
                    state
                        .upstream
                        .join("/api/memberapi/workout/bookings/get")
                        .unwrap(),
                )
                .query(&[("id", workout_id)]),
        )
        .await?;
    Ok(Json(
        json!({ "version": 1, "origin": ZOEZI_ORIGIN, "workout": workout, "participants": parse_participants(&data)? }),
    ))
}

fn parse_participants(data: &Value) -> ApiResult<Vec<Value>> {
    let rows = data.as_array().ok_or_else(upstream_error)?;
    let mut seen = HashSet::new();
    let mut participants = Vec::new();
    for row in rows {
        if row.get("booking") != Some(&Value::Bool(true))
            || row.get("inQueue") != Some(&Value::Bool(false))
        {
            continue;
        }
        let id = row
            .get("id")
            .and_then(Value::as_u64)
            .filter(|id| valid_id(*id))
            .ok_or_else(upstream_error)?;
        let name = row
            .get("name")
            .and_then(Value::as_str)
            .filter(|s| valid_text(s))
            .ok_or_else(upstream_error)?;
        if !seen.insert(id) || participants.len() >= 1000 {
            return Err(upstream_error());
        }
        participants.push(json!({ "id": id, "name": name.trim() }));
    }
    Ok(participants)
}

#[cfg(test)]
mod tests;
