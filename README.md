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

Start or open a tournament, then open **Players → Import from Zoezi**.
Drag **Zoezi → Dink City** to your browser's bookmarks bar (manual installation
instructions are also shown). Open the club's Zoezi site, log in with your member
account, and click the bookmark. Choose today's session or another date, preview
confirmed participants, and copy the import data back into Dink City.

Review before importing. Waiting-list entries are excluded. Existing players stay
in place, and repeated imports skip members already imported into this tournament.
For names matching manually entered players, choose whether to link the existing
player, add a separate player, or skip. Linked players retain scores and active
status; new players can receive starting points if play has begun.

The helper only reads Zoezi's session and participant endpoints. Login cookies stay
on Zoezi; the copied data contains session details and participant names/member IDs.
This currently supports `korpenkalmarpickleballklubb.zoezi.se` and requires the club
to allow members to view participant names. Use the website in a browser that can
run bookmarklets. If automatic copying fails, copy the selected export text manually.
