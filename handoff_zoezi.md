---
date: 2026-10-07
topic: zoezi-player-import
repo: /home/martin/dev/pickleball
branch: main
head: fb31cc3
status: in-progress
---

# Import Zoezi registrations into the pickleball app

## Goal
Build a browser helper that uses the user's existing Zoezi member login to fetch
today's pickleball session, or let the user select a session, then import participant
names into the pickleball app at `/home/martin/dev/pickleball`.

## Current status
Research only. No implementation, app edits, or tests have been performed.
The user explicitly chose the browser-helper approach; bookmarklet versus userscript
and the transfer/import mechanism are still undecided. Initial exploration only located
the app files below; their contents have not been read. Work was interrupted to request
this handoff for this task alone, at this exact path in the dotfiles root.

## Findings
- Zoezi has an officially supported integration platform, Zoezi Open, with public API
  documentation, API keys, permission-controlled add-ons, and booking webhooks.
- Documentation describes API-key authentication as `Authorization: Zoezi <key>`.
  The user's browser observations show that Zoezi's own site also supports anonymous
  public reads and authenticated member requests. Do not assume an API key is needed
  for the chosen browser helper.
- Club origin: `https://korpenkalmarpickleballklubb.zoezi.se`.
- USER-VERIFIED: `GET /api/public/workout/get?id=266` returns HTTP 200 without login.
- USER-VERIFIED: `GET /api/memberapi/workout/bookings/get?id=266` returns HTTP 401
  when logged out and HTTP 200 when logged in with a REGULAR MEMBER account.
  Administrator access was not needed for that observed request.
- The returned body is an array of objects with `id`, `name`, `booking`, `inQueue`,
  and `membership`. Both example participants had `booking: true`, `inQueue: false`,
  and `membership: true`. Personal names are intentionally omitted from this note.
- Example shape with synthetic data:
  `[{"id":18,"name":"Example Player","booking":true,"inQueue":false,"membership":true}]`.
- The meaning of `membership` and whether `id` is a stable member ID are UNVERIFIED.
- Documentation shows `/api/public/workout/get/all?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`.
  Its live response shape, date boundary semantics, and club-specific behavior are UNVERIFIED.
- No authenticated request was executed by the assistant. Cookie/session details, CSP,
  clipboard permissions, cross-origin behavior, and session-list schema remain untested.

## Decisions
| Decision | Why |
|----------|-----|
| Browser helper using the member's existing login | Explicit user choice; member access works for the observed participant endpoint. |
| Default to today's game, with a way to select another session | Explicit user requirement. |
| Import participant names into the existing pickleball app | Explicit user requirement; reuse the current roster flow where possible. |
| Save this file in the dotfiles root | User-specified destination overrides the skill's default handoffs directory. |

## Next
1. Read applicable repository instructions, then inspect `/home/martin/dev/pickleball/frontend/src/lib/components/PlayerRoster.svelte`
   and `/home/martin/dev/pickleball/frontend/src/routes/+page.svelte` to find roster storage
   and any existing bulk-name import. Confirm current git state before edits.
2. Verify the club's public session-list response and date filtering. Default the date to
   Europe/Stockholm/local club time; handle no sessions and multiple sessions with a picker.
3. Choose the smallest usable helper (bookmarklet or userscript) running on the Zoezi origin.
   Fetch participant data with the user's existing authenticated browser session; never
   export credentials, cookies, or session tokens into the pickleball app.
4. Inspect the current import UX before choosing transfer: clipboard/newline names is a
   simple candidate; a validated browser-message flow is another. Neither is yet decided.
   Avoid placing participant names in URL query parameters.
5. Confirm booking/queue semantics. Likely default: include confirmed bookings and exclude
   waiting-list entries, but validate before implementing; do not silently filter on membership.
6. Implement selection, participant preview, and import with clear logged-out/error/empty
   states. Preserve existing players unless the user explicitly selects replacement, and
   handle repeated imports without accidentally conflating distinct people with identical names.
7. Read package scripts and run relevant checks/tests/build. Verify the actual helper in a
   logged-in Zoezi browser and the resulting roster in the app; mark any unperformed manual
   checks honestly. Do not commit, push, deploy, or book/cancel sessions as part of this task.

## Context
| Path | Role |
|------|------|
| `/home/martin/dev/pickleball/frontend/src/lib/components/PlayerRoster.svelte` | Located; not yet read; likely roster UI. |
| `/home/martin/dev/pickleball/frontend/src/routes/+page.svelte` | Located; not yet read; main app page. |
| `/home/martin/dev/pickleball/frontend/package.json` | Located; inspect for current verification commands. |
| `/home/martin/dev/pickleball/README.md` | Located; inspect for current project/deployment guidance. |
| `/home/martin/dotfiles/handoff_zoezi.md` | User-requested task handoff. |

Official resources inspected during this conversation:
- https://developer.zoezi.se/apidoc/
- https://developer.zoezi.se/
- https://zoezi.se/open
- https://zoezi.se/for-utvecklare

Official add-on deployment requires Zoezi review; API pricing and subscription access were
not confirmed. Those questions need not block investigating the selected browser helper.

## Git state
Captured before writing this handoff:
- Pickleball: `/home/martin/dev/pickleball`, branch `main`, HEAD `fb31cc3`.
  Working tree clean; diff stat empty; no stashes. Only log entry:
  `fb31cc3 Initial commit: pickleball tournament app and GitHub Pages deployment`.
- Dotfiles: `/home/martin/dotfiles`, branch `main`, HEAD `c7a1fd5`.
  Working tree clean; diff stat empty; no stashes. Latest commit: `add env set-local-oms-db`.
- Original cwd was `/home/martin/dotfiles/herdr/herdr-plugins/tab-menu`; it is unrelated
  to implementation. Current sandbox only permits writes there and in `/tmp`, so writing
  this handoff or changing the pickleball repository requires tool escalation or a new
  workspace rooted in the appropriate repository.

## Session log
- 2026-10-07 — Research and user-verified member access recorded; implementation not started.

## Follow-up investigation — 2026-10-07

Research performed in `/home/martin/.herdr/worktrees/pickleball/zoezi-api`.
No application changes, authenticated requests, or deployment performed.

### Newly verified
- Anonymous `GET /api/public/workout/get/all?fromDate=2026-10-07&toDate=2026-10-14`
  returned HTTP 200 and `{ workouts: [...], settings: { showBookingCount: true } }`.
  Each workout includes `id`, `workoutType.name`, `startTime`, `endTime`,
  `extra_title`, `courses`, `resources`, `status`, `numBooked`, and `numQueue`.
- The same request with both dates `2026-10-07` returned that day's one session.
  The week request included October 14: the end date is inclusive in these observations.
  Times are strings without an offset, e.g. `2026-10-07 16:30:00`.
  Use Stockholm for the default calendar date; avoid treating these strings as UTC.
- Today's result was a youth course, not adult open play. Include course names and
  extra titles in the picker; do not automatically import the first matching workout.
- Anonymous `/api/memberapi/workout/bookings/get?id=266` returned HTTP 401.
  Authenticated access still relies on the earlier user verification.
- Public and unauthenticated member responses send `Access-Control-Allow-Origin: *`
  without `Access-Control-Allow-Credentials`. These headers do not support browser
  credentialed cross-origin reads from Dink City. Public schedule reads can be cross-origin.
- The homepage sends `Content-Security-Policy: frame-ancestors 'self' korpenriks.zoezi.se;`.
  Embedding Zoezi in a Dink City iframe is therefore not a viable login/import path.
  No script restriction appeared in that response header, but bookmarklet execution
  and clipboard behavior have not been browser-tested.
- Official machine-readable schema at `https://developer.zoezi.se/api/api/get` describes
  `/memberapi/workout/bookings/get` as a session-required GET, subject to club settings,
  with response class `Member id and name`. It takes a workout `id` and optionally an
  invitation hash. No invitation-based access was attempted.
- The live public client `/homepage/js/app.29a2d3e8.js` calls the same bookings endpoint.
  Its `filteredBookings().coming` uses `booking && !inQueue`. This confirms the intended
  confirmed-participant filter; it does not filter on `membership`.
- The existing app has single-player entry only. `PlayerRoster.svelte` calls
  `tournamentStore.addPlayer(name, startingPoints)`. Imports during a running tournament
  need the same starting-points choice; finalized tournaments must not be changed.

### Recommended flow
1. Install a bookmarklet, then open the club's Zoezi page and log in normally.
2. Run the bookmarklet. Default its date to today in Stockholm, list matching
   sessions with times, course names, and extra titles, and allow another date.
3. Select a session and preview confirmed participants. Copy a versioned JSON
   payload with club origin, workout ID, and member IDs/names. Offer selectable text
   if clipboard access fails. Never include cookies, tokens, or names in a URL.
4. In Dink City's Players panel, paste into an Import from Zoezi form, validate the
   payload, preview additions, then explicitly import. Append to the current roster.
5. Persist source identity using club origin plus member ID to make repeat imports
   idempotent while retaining different members with identical names. Existing manually
   entered players with matching names need explicit user resolution, not automatic merging.

A userscript can later replace manual copying with a validated postMessage exchange,
but adds installation and browser compatibility work. The clipboard route is the
smallest practical first implementation. No helper or import UI has been built yet.
Remaining manual verification: execution on the logged-in Zoezi page, real participant
preview, clipboard behavior, and resulting roster after import/re-import.
