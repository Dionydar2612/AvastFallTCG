# AvastFall TCG

> **A browser-based trading card game platform for deck building, card collection, and playtesting.**

AvastFall TCG is a web application that brings the game simulator, card catalogue, deck builder, player collection, in-game shop, and administration tools into one project. Card and account data are managed through Supabase, while card artwork is served from the project’s image assets.

> **Project status:** This repository contains an actively developed playtest platform. Features and game rules may change. Online play is intended for testing and is not currently designed as a cheat-resistant competitive environment.

## Contents

- [Features](#features)
- [Application routes](#application-routes)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Managing cards](#managing-cards)
- [Update Notes and player feedback](#update-notes-and-player-feedback)
- [Deployment](#deployment)
- [Security and data persistence](#security-and-data-persistence)
- [Documentation](#documentation)

## Features

### Player experience

- **Account access:** sign up and sign in through Supabase Auth.
- **Home lobby:** access game modes, profile information, daily rewards, decks, and announcements.
- **Playtest simulator:** test decks against a bot and use the available multiplayer room flow.
- **Card catalogue:** browse cards using gallery, list, table, and set-oriented views; filter by ownership and set.
- **Deck builder:** create and manage decks, with ownership and deck validation enforced by the application.
- **Collection:** review owned and unowned cards by series.
- **Shop:** purchase available booster packs and Starter Deck products with in-game coins.
- **Update Notes:** read announcements posted by administrators.
- **Feedback:** send suggestions, report issues, and share ideas for improving the game.

### Administration

The `/admin` area provides tools for authorized administrators to manage card metadata and game content, import card data from Excel or CSV, manage users and coins, configure shop products, review backups, and publish Update Notes. Access is based on the user’s administrator role.

### Card content

Card metadata—including names, types, elements, stats, and effects—is stored in Supabase. Card artwork is served from `public/images/` and is not stored in the card metadata tables.

## Application routes

| Route | Description | Access |
| --- | --- | --- |
| `/` | Main lobby and playtest simulator | Sign-in required |
| `/cards/` | Card catalogue and deck builder | Sign-in required |
| `/admin` | Administration dashboard | Administrator account required |
| `/api/docs` | API documentation | Depends on server configuration |
| `/api/health` | Health-check endpoint for deployment monitoring | Health check |
| `/api/updates` | Update Note API | Application authentication rules apply |

The application is served by a single Node.js/Express server. The game, catalogue, deck builder, and API use the same deployment and card data source.

## Technology stack

- **Runtime:** Node.js 22 or later
- **Server:** Express
- **Authentication and database:** Supabase Auth, Supabase Postgres, and Row Level Security (RLS)
- **Frontend:** HTML, CSS, and JavaScript
- **Card data:** JSON seed data and Supabase metadata
- **Import support:** Excel and CSV
- **Deployment options:** Node.js hosting, Docker, and the included Render/Fly configuration files

## Requirements

- Node.js **22+** and npm
- A Supabase project for persistent accounts and game data
- Git (recommended)

## Local development

1. Clone or download this repository.
2. Open a terminal in the project root—the directory containing `package.json`.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure the environment variables described below.
5. Set up Supabase by following [Supabase setup](#supabase-setup).
6. Start the server:

   ```bash
   npm start
   ```

7. Open [http://localhost:3000](http://localhost:3000).

For development with automatic Node.js restart:

```bash
npm run dev
```

A fake in-memory Supabase-compatible test mode is also provided:

```bash
npm run dev:fake
```

This mode is for local UI and flow testing only. Its data is temporary and disappears when the process stops; it is not a substitute for testing against a real Supabase project.

## Supabase setup

### 1. Create a project

Create a project in the [Supabase Dashboard](https://supabase.com/dashboard). Make sure you select the project intended for this deployment.

### 2. Create the database schema

1. Open **SQL Editor** in the Supabase Dashboard.
2. Create a new query.
3. Open `supabase/schema.sql` from this repository.
4. Copy the entire file into the SQL Editor.
5. Click **Run** and review the result for errors.
6. Open **Table Editor** and confirm that the expected tables, including `public.update_notes`, exist.

The schema uses `CREATE TABLE IF NOT EXISTS` for its table definitions and is intended to be safe to run again for creating missing tables. Review any SQL errors rather than repeatedly executing a failed query.

### 3. Configure authentication

In Supabase, review **Authentication → Providers → Email** and choose the email-confirmation behavior appropriate for your project. If confirmation is enabled, new users may need to verify their email before signing in.

### 4. Set server credentials

In the Supabase project settings, find the Project URL and API keys. Add the required values to your local environment or hosting provider’s secret/environment-variable settings. Never commit private keys to Git.

### 5. Grant administrator access

Set `ADMIN_EMAILS` to a comma-separated list of email addresses that should receive administrator access, then register/sign in with an eligible account. Confirm access through `/admin`. Treat administrator access as privileged and grant it only to trusted accounts.

On first startup, the application imports its bundled card/set/element data from `data/*.json` into Supabase when required by the application’s initialization logic.

## Environment variables

Set these in your shell or deployment provider. Do not place real secrets in source control.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port. Defaults to `3000` when not supplied by the host. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_ANON_KEY` | Supabase public/anonymous key used by the server’s authentication integration. |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-side key for privileged database operations. **Never expose this in browser code or commit it.** |
| `ADMIN_EMAILS` | Comma-separated email addresses eligible for administrator access. |
| `DATA_DIR` | Optional persistent directory for application-managed data/assets where supported by the storage implementation. |
| `IMG_DIR` | Optional image directory override where supported by the storage implementation. |
| `ADMIN_KEY` | Optional key for the protected feedback-review route described in the legacy/manual documentation. Keep private. |
| `ADMIN_SECRET` | Optional session-signing secret for legacy/admin functionality where applicable. Keep private. |
| `RESEND_API_KEY` | Optional Resend API key for email notifications. If omitted, email notifications are not sent. |
| `NOTIFY_EMAIL` | Optional recipient for feedback notification emails. |
| `AUDIT_KEEP_DAYS` | Optional. Days to keep rows in `audit_logs` (default `30`). |
| `MAIL_FROM` | Optional sender address for feedback notification emails. |

**Important:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It must be configured only as a server-side secret. Never use it in frontend JavaScript, public HTML, or a `VITE_*`/other client-exposed variable.

## Project structure

```text
.
├── admin/                  # Admin interface and routing
├── data/                   # Bundled seed data: cards, decks, elements, updates
├── lib/                    # Authentication, Supabase, store, imports, shop and APIs
├── public/                 # Card catalogue, deck builder, docs and card images
│   └── images/             # Card artwork served by the application
├── supabase/
│   └── schema.sql          # Database schema and security setup
├── web/                    # Game lobby, simulator, UI, bot and card effects
│   └── js/
│       ├── engine/         # Game engine logic
│       ├── effects/        # Card effect scripts grouped by set
│       ├── data/           # Card API and snapshot data
│       └── ui/             # Game interface modules
├── Dockerfile              # Docker build configuration
├── MANUAL.md               # Extended project and operations manual
├── package.json            # Dependencies and npm scripts
├── render.yaml             # Render deployment configuration
├── server.js               # Express application entry point
└── fly.toml                # Fly.io configuration
```

## Managing cards

Administrators can manage card metadata from `/admin`.

1. Open the card-management or import section.
2. Download the available spreadsheet template when importing a batch.
3. Prepare one card per row and include the required fields indicated by the template.
4. Select the `.xlsx` or `.csv` file and add artwork files named to match their card IDs when needed (for example, `SD01-001.jpg`).
5. Run validation and review any reported issues before saving.
6. Confirm that the cards and images display correctly in the catalogue and simulator.

The exact fields accepted by the importer are defined by the current application and template. Use the exported data/template as the source of truth rather than assuming that every optional field is supported.

### Card effects

The simulator’s game engine is located in `web/js/engine/`. Card-specific effect scripts are grouped in `web/js/effects/`, while card data and snapshot support are in `web/js/data/`. When card text changes, verify whether the actual in-game behavior must also change. Update the relevant effect script when behavior changes, and keep snapshot/card metadata synchronized with the intended card text.

## Online status and activity logs

- **Online now:** every open game/catalogue/admin tab sends a heartbeat (`POST /api/presence`) about every 40 seconds while visible. A user counts as online if seen within ~100 seconds. Admins see this on the dashboard and in the Users tab (`profiles.last_seen_at`, `profiles.last_page`).
- **Activity log:** logins, failed logins, sign-ups, purchases and every admin change are stored in `audit_logs` (Admin → บันทึกกิจกรรม). Passwords and tokens are never stored.
- **JSON logs on stdout:** every request and audit event is also printed as one JSON line, ready to be shipped to an external log tool.
- Re-run `supabase/schema.sql` once after updating (adds the new columns and table; safe to re-run).

## Update Notes and player feedback

Administrators can publish announcements from the Update Note area in `/admin`.

- **Title:** a short, descriptive announcement headline.
- **Date:** the publication date.
- **Details:** enter one announcement item per line.

Suggested topics include new card sets, balance changes, new features, bug fixes, known issues, maintenance, and invitations for players to submit feedback. Keep announcements factual and clearly distinguish completed work from features that are still being tested.

Update Notes are stored in the Supabase `public.update_notes` table. If the admin page reports that the table is missing, run the complete `supabase/schema.sql` file in the correct Supabase project’s SQL Editor and verify the table in Table Editor.

## Deployment

### General deployment

Deploy the project as a Node.js service using:

- **Build/install command:** `npm install`
- **Start command:** `npm start`
- **Health check:** `/api/health` (where supported by the hosting provider)

Configure the Supabase credentials and other environment variables in the hosting provider’s dashboard. Do not store production secrets in the repository.

### Docker

A `Dockerfile` is included. Build and run it from the project root after configuring the required environment variables and persistent storage appropriate to your deployment:

```bash
docker build -t avastfall-tcg .
docker run --name avastfall-tcg --env-file .env -p 3000:3000 avastfall-tcg
```

Create `.env` locally and keep it out of version control. For production, use your platform’s secret management rather than embedding credentials in the image. Configure persistent storage for any files that must survive container replacement.

### Render

The repository includes `render.yaml` as a deployment starting point. Review its service plan, disk settings, and environment-variable configuration before deploying. Persistent disk availability and pricing depend on the selected Render plan; do not assume a free service provides durable local storage.

### Fly.io

The repository includes `fly.toml` as a configuration starting point. Review the app name, region, secrets, volumes, and resource sizing before deployment. Configure secrets with the platform’s secret mechanism and verify persistence for uploaded artwork or other local files.

## Security and data persistence

- All privileged database access must remain on the server.
- Keep Supabase service-role keys, session secrets, and feedback-access keys private.
- Review RLS and server-side authorization before changing database policies or API routes.
- Use strong authentication and grant administrator roles sparingly.
- Back up important data before schema changes, bulk imports, or production updates.
- Supabase stores account and game metadata; artwork is served from the project’s image directory unless configured otherwise.
- Local files written inside an ephemeral hosting filesystem may be lost after redeployment, restart, or instance replacement. Use a persistent volume or commit static artwork to the repository as appropriate.
- Multiplayer rooms are currently memory-based and may be cleared on restart. The current playtest implementation is not intended to provide competitive anti-cheat guarantees.
- The fake development mode is temporary and must not be used as a production data store.

## Documentation

- [`MANUAL.md`](MANUAL.md) — extended instructions and operational notes
- [`supabase/schema.sql`](supabase/schema.sql) — Supabase database schema
- [`/api/docs`](http://localhost:3000/api/docs) — API documentation when running locally

## Contributing and feedback

Bug reports, balance observations, usability suggestions, and ideas for new cards or sets are welcome. When reporting an issue, include the steps to reproduce it, expected behavior, actual behavior, and relevant browser/server error messages. Do not include passwords, API keys, or other secrets in reports.

## License

No license is specified in this repository at this time. Unless a license is added, do not assume that the code, card designs, illustrations, or other project assets are available for reuse or redistribution.

---

**AvastFall TCG** — *Build Your Strategy, Shape Your Legend.*
