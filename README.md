# Pickleball

100% vibe coded. Run Americano or Mexicano nights with court matchups, scores, and a leaderboard.

Tournaments stay in your local browser, without a database or syncing between devices.
Self-hosted installations can optionally connect each user's own Zoezi account to import participants.

Host free on GitHub Pages: select **Settings → Pages → Source → GitHub Actions**. Pushes to `main` deploy automatically.

Or self-host with Docker (under 1 MB image; last measured build: 0.89 MB):

```sh
docker build -t pickleball .
docker run --rm -p 8080:8080 pickleball
```

Open http://localhost:8080.

### Import players from Zoezi

On Pinix, open **Import players from Zoezi**, log in with your own club Zoezi email
or username and password, choose a date and session, and preview the participants.
Review the list and press **Add players**, then **Start tournament** when ready.

Each browser has a separate connection. Passwords are never saved or logged. Zoezi
cookies stay in the server's memory; the browser receives only an opaque Pickleball
session cookie. Connections expire after twelve hours, on logout, or when the server
restarts. Accounts must be allowed to see participant names. This uses Zoezi's web
login flow, rather than the API-key integration, and may need updating if Zoezi changes it.

The original manual import remains available under **Import manually with the Zoezi
helper**, and is the import method used on GitHub Pages:

On the start screen, open **Import players from Zoezi** (it isn't shown during a game).
Drag **Zoezi → Dink City** to your browser's bookmarks bar (manual installation
instructions are also shown). Open the club's Zoezi site, log in with your member
account, and click the bookmark. Choose today's session or another date, preview
confirmed participants, and copy the import data back into Dink City.

Review before importing. Waiting-list entries are excluded. For names matching players
already in the starting lineup, choose whether to link the existing player, add a
separate player, or skip. The chosen players are added when you press **Start tournament**.

The helper only reads Zoezi's session and participant endpoints. Login cookies stay
on Zoezi; the copied data contains session details and participant names/member IDs.
This currently supports `korpenkalmarpickleballklubb.zoezi.se` and requires the club
to allow members to view participant names. Use the website in a browser that can
run bookmarklets. If automatic copying fails, copy the selected export text manually.

### Self-hosting the Zoezi connection

The Nix flake builds for `aarch64-linux` and `x86_64-linux` and exports
`nixosModules.default`. Pinix imports that module and supplies its public HTTPS origin:

```nix
services.pickleball = {
  enable = true;
  port = 29393;
  zoezi.enable = true;
  zoezi.publicOrigin = "https://pickleball.marrieto.duckdns.org";
};
```

The service listens on localhost, behind an HTTPS reverse proxy. Direct import is
disabled by default in standalone binaries and Docker. To enable it, set
`ZOEZI_ENABLED=true` and `ZOEZI_PUBLIC_ORIGIN` to the exact public HTTPS origin
without a trailing slash. `HOST` and `PORT` control the listener. HTTPS is required
for the secure session cookie. For frontend development, build the frontend and
run the Rust server behind a local HTTPS proxy with a matching origin.

No account secrets, database, or writable state directory are required. API responses
are marked `no-store` and excluded from the offline cache. Login permits five attempts
per minute per client IP; forwarded addresses are accepted only from a local proxy.
Do not enable request-body or cookie logging in the reverse proxy or add credentials
to URLs or environment variables. Importing never changes an existing tournament.

Before using a new installation, verify on a phone that login, date selection,
participant preview and import work with a real member account. Repeat with a second
browser and a different Zoezi account, then verify logout and server restart require
login again. Real credentials must be entered only in the HTTPS app, never in shell
commands, test fixtures or logs. Moving from GitHub Pages to Pinix uses different
browser storage; existing tournaments are not migrated automatically.

### Setup links (prep on your phone, open on a TV)

On the start screen, **Copy setup link** makes a URL that recreates the setup on any
device: name, courts, scoring, format and the player list (including players staged
from a Zoezi import). Paste it into a URL shortener if you like. Opening the link only
fills in the start screen; press **Start tournament** to confirm. Links are ignored on
a device that already has a tournament running.

You can also write one by hand:
`/?name=Friday&courts=3&scoring=firstTo&score=11&entry=individual&format=mexicano&style=standard&players=Martin,Casper,Sven`

| Parameter | Values |
|-----------|--------|
| `name` | tournament name |
| `courts` | 1-12 |
| `scoring` / `score` | `firstTo` (2-15) or `bestOf` (4-40) |
| `entry` | `individual` or `teams` |
| `format` | `mexicano` or `americano` |
| `style` | `standard` or `alternate` |
| `players` | comma-separated names |

Invalid values are ignored.
