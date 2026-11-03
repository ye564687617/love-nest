# Content Workbench

The current local database was migrated without removing existing content.
When deploying these changes against another existing database, run:

```sh
docker compose up -d php
docker compose exec -T php php < php/migrate-interactions.php
docker compose exec -T php php < php/migrate-security.php
```

The migration is idempotent. It adds article cover/excerpt fields and makes
new users default to the ordinary user role. Existing roles are unchanged.
It also adds nullable per-user content permissions. Existing editors retain
all content modules until an administrator explicitly changes their selection.

Security update (2026-10-31): run BOTH migrations before serving the new code.
The security migration only adds an InnoDB login-rate-limit table; it never
changes passwords, existing content, or user permissions. Back up the database
and uploads before deployment. All fresh installs need the same migrations.
Login attempts are reserved atomically, including concurrent requests, across
cookie resets: 8 per account/IP, 60 per account, 150 per IP in 15 minutes.
After three unsuccessful account/IP attempts a captcha is required. Successful
login clears the account/IP bucket, not the shared account/IP-wide budgets.
Session cookies use HttpOnly, SameSite=Lax, cookie-only IDs and strict mode.
Secure is enabled on HTTPS, not on local HTTP.

Forwarded IP/protocol headers are ignored by default. For a reverse proxy,
set TRUSTED_PROXIES in the deployment environment to the exact proxy IP(s) or
CIDR(s), comma-separated, then run `docker compose up -d php`. Only configure
networks whose every member is trusted. The edge proxy must overwrite client
forwarded headers, block direct origin access, and set X-Forwarded-Proto.
Never use 0.0.0.0/0 or trust arbitrary Internet clients. Without this setup,
visitors may share the proxy IP and login budget, and city lookup can return
empty. Verify distinct visitor IPs and Secure cookies behind production HTTPS.
Change the known development admin password before public deployment.

Messages now reject array/overlong fields (200 Unicode characters for content),
provide cursor-based load-more, and refresh full message/gift totals on posting.
Run `python3 tests/smoke_security.py` for the additional isolated regression.

Release verification: all 143 existing API checks and the six existing Node
regression scripts passed. All 24 new security/message checks passed, including
fresh-cookie retries, spoofed IPs, expiry recovery and parallel rate-limit
reservations. Chrome GUI verified 20 initial messages, loading all remaining
messages, and hiding the exhausted load-more button with 24 temporary/real
messages combined. All 21 GUI fixtures were removed; the 3 original visible
messages remain. This is desktop Chrome verification, not physical-phone QA.

Roles:
- `admin`: content, site configuration, reports, and user permission management.
- `editor`: albums, photos, moments, articles, guestbook, checklist, dates, music.
- `user`: own account, guestbook entries, and private conversations.

Permission changes are checked against the database on each request. The
current administrator cannot change their own role. At least one admin must
remain. Editors do not receive report details or configuration access.
Administrators can select any subset of seven content modules for an editor.
An empty selection leaves personal access only. API, direct page access,
navigation and dashboard data follow the same permissions immediately.
Album and photo operations share one permission. Checklist editing preserves
existing moment associations when moment access has not been granted.

Images support JPEG, PNG, GIF and WebP, at most 5MB each. The Compose PHP
configuration now matches that limit. Concurrent uploads are limited to three.
Album deletions remove database records, not files used by published content.

Quill 2.0.3 is vendored locally under `html/static/vendor/quill`, including
its license. Article HTML is sanitized on save and public rendering. Drafts
are never returned by the public article page. Browser draft recovery stays
on the same browser and device; it is not server-side version history.

Frontend navigation now uses `/articles.php`; `/games.php` redirects there.
Old game assets are retained but no longer loaded by the article page.

Regression:
```sh
TEST_ADMIN_PASSWORD=... python3 tests/smoke_content.py
TEST_ADMIN_PASSWORD=... python3 tests/smoke_interactions.py
TEST_ADMIN_PASSWORD=... python3 tests/smoke_config.py
python3 tests/smoke_account.py
node tests/page_lifecycle.cjs
node tests/admin_dialogs.cjs
node tests/admin_permissions.cjs
node tests/admin_mobile.cjs
TEST_ADMIN_PASSWORD=... python3 tests/smoke_moderation.py
```

Tests create isolated temporary records and remove them in `finally` blocks.

Moderation searches all message pages on the server, combines visibility
filters, and clamps pagination after deletion. Nested confirmations and image
pickers preserve the parent form. Save buttons reject duplicate submissions
and recover after errors. Editing forms are not dismissed by backdrop clicks.

Not implemented: per-action/read-only permission policies, server-side article
autosave/version history, and an exhaustive code audit. Current mobile GUI
checks cover album layout, article editor, moment composer and library return;
they are not a complete browser/device compatibility certification.

Mobile administration (2026-10-30): the shared layout uses a drawer below
900px with an inert background, focus trapping, Escape/backdrop dismissal,
and desktop reset. Tables become labeled vertical records without replacing
their content or handlers. Editors use full-screen dialogs and sticky bottom
actions; album controls, forms and filters use touch-friendly sizing. Login
spacing and captcha sizing are also responsive. Desktop table contents keep
their existing flow through display:contents wrappers. Mobile unit regression
covers navigation and asynchronous table relabeling. This pass visually checked
the dashboard, article list and article editor at 440px in Chrome device mode;
real-device keyboard and Safari checks remain outstanding.

Follow-up: dialogs now track VisualViewport resize and scroll so the visible
height and offset respond to software keyboards. The viewport meta enables
safe-area layout and content resizing where supported. The mobile regression
simulates keyboard height and offset changes. Photo selection and permission
labels have at least 44px-high targets. Moment image action bars no longer
overlay thumbnails; they use two columns, dropping to one below 361px.
Follow-up native Chrome checks now cover 375px homepage main-photo switching,
story timeline, authenticated message placeholder, moment composer city lookup,
and nested photo-library cancellation returning to the intact composer. At
320px, the moment composer and story timeline were visually checked too.
These are desktop browser viewport simulations, not physical iPhone tests.
Real Safari/device keyboard verification remains outstanding.

Location and story follow-up (2026-10-31): homepage spinner containers are no
longer rewrapped by the image observer. Cached main photos are marked loaded
when switching. Articles use chronological month headings, day/time markers,
reading metadata and the first safe inline image when no cover is selected.
Existing published content, search, pagination and article URLs are retained.

Messages now preserve an optional editable city and show the correct logged-in
placeholder. The city client runs asynchronously, deduplicates requests, uses
an AbortController timeout compatible with older browsers, and retries empty
results. The moment composer offers the same explicit city-lookup button.
Manual input is never overwritten by a late lookup response.

City lookup is approximate IP lookup, not GPS. The server sends its direct
public client IP to ipwho.is over HTTPS; no browser coordinates are requested.
This third-party processing needs disclosure in the deployed site's privacy
notice. The request has a two-second HTTP timeout, limited response size and
per-session caching (one hour for a city, two minutes for failure). PHP releases
the session lock during the remote request. The browser aborts after 3.5 seconds.
Private/reserved peers, including this local Docker environment, return an
honest empty result without an external call. Forged X-Forwarded-For headers
cannot choose the lookup IP. Production reverse-proxy deployments must configure
trusted real-IP handling at nginx; do not blindly trust forwarded headers.
Existing blank historical locations are not guessed or backfilled.

Additional regression: `node tests/location_images.cjs` and
`TEST_ADMIN_PASSWORD=... python3 tests/smoke_location_story.py`. Twelve new
HTTP checks and all 131 existing API checks passed; image/city client, mobile,
dialog, permission, page-lifecycle and player-loading Node checks passed.
