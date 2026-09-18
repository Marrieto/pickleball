# ---- Frontend: build the static SvelteKit site ----
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend: compile a fully static (musl) Rust binary with the site embedded ----
FROM rust:1-alpine AS backend
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
COPY --from=frontend /app/frontend/build ./frontend/build
RUN cargo build --release

# ---- Final: just the binary ----
FROM scratch
COPY --from=backend /app/target/release/americano /americano
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/americano"]
