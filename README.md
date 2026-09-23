# Pickleball

100% vibe coded. Run Americano or Mexicano nights with court matchups, scores, and a leaderboard.

Everything stays in your local browser. No accounts, database, or syncing between devices.

Host free on GitHub Pages: select **Settings → Pages → Source → GitHub Actions**. Pushes to `main` deploy automatically.

Or self-host with Docker (under 1 MB image; last measured build: 0.89 MB):

```sh
docker build -t pickleball .
docker run --rm -p 8080:8080 pickleball
```

Open http://localhost:8080.
