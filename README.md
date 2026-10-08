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

### Import players from Zoezi

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
