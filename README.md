# Kairos

*Kairos (καιρός): the right moment.* A personal time-management tool:

- **Mac widget**: a frosted-glass panel on your desktop listing this week's calendar events and tasks. Press **⌃⌥Space** anywhere, dictate with Wispr Flow (or type), hit Return, and the task lands in Google Calendar.
- **iPhone web app**: the same list and prompt box, installed to your Home Screen. Wispr Flow's keyboard works in it.
- **Claude** turns loose notes like *"finish the recursion lab tomorrow at 4 for an hour, rewrite the base case"* into a titled, timed calendar event.
- **Google Calendar** is the only database. New tasks go into a dedicated **Kairos Tasks** calendar, so they also show up in Google Calendar everywhere.

```
 Mac widget (SwiftUI) ─┐
                       ├─► Kairos server (Next.js on Firebase App Hosting) ─► Claude API (parse note)
 iPhone web app (PWA) ─┘                                     └► Google Calendar API
```

## Repo layout

| Path   | What |
| ------ | ---- |
| `web/` | Next.js app: the iPhone/web UI plus the API (`/api/tasks`) used by both clients |
| `mac/` | Swift package for the macOS glass widget (menu bar app, no Dock icon) |

## One-time setup

You need three things: an Anthropic API key, a Google OAuth client, and a Firebase project to host the server. Use one Google Cloud project for both the Firebase hosting and the OAuth client.

### 1. Claude API access
Add a little credit at [platform.claude.com](https://platform.claude.com/) (separate from a Claude Pro/Max subscription; parsing with Haiku costs about $0.0002 per task).

- **Local dev:** put an API key in `web/.env.local`, or leave it empty and run `ant auth login` once to use your own sign-in.
- **Production:** no key is stored. The server uses **Workload Identity Federation**: Cloud Run proves it is your App Hosting service account and gets a short-lived Claude token (set up after the first deploy, below).

### 2. Google OAuth client
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/) (e.g. "kairos"), then open the same project in [Google Cloud Console](https://console.cloud.google.com/).
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, add yourself as a test user.
4. **Then click "Publish app"** so it's *In production*. Unverified is fine for personal use (you'll click through a warning once). If you leave it in *Testing*, Google expires the refresh token every 7 days.
5. **Credentials → Create credentials → OAuth client ID → Web application.** Add authorized redirect URIs:
   - `http://localhost:3000/api/google/callback`
   - `https://<your-backend-url>/api/google/callback` (add after the first App Hosting rollout, see below)
6. Copy the client ID and secret.

### 3. Run the server
Locally first:

```bash
cd web
cp .env.example .env.local     # fill in KAIROS_TOKEN, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
npm install
npm run dev
```

`KAIROS_TOKEN` is a passcode you make up (e.g. `openssl rand -hex 24`). Then open <http://localhost:3000/api/google/connect>, enter the passcode, approve Google, and paste the refresh token it shows into `GOOGLE_REFRESH_TOKEN` in `.env.local`. Restart `npm run dev`.

#### Deploy to Firebase App Hosting (Google Cloud)

App Hosting builds the Next.js app and runs it on Cloud Run. It needs the **Blaze** (pay-as-you-go) plan, but with `minInstances: 0` a personal app like this usually stays inside the free tier. Set a budget alert in Cloud Billing to be safe.

```bash
npm install -g firebase-tools
firebase login
firebase use --add                       # pick your Firebase project

# Store the secrets in Cloud Secret Manager (it prompts for each value and to grant access)
firebase apphosting:secrets:set kairos-token
firebase apphosting:secrets:set google-client-id
firebase apphosting:secrets:set google-client-secret
firebase apphosting:secrets:set google-refresh-token   # the one from the local connect step

firebase deploy --only apphosting        # creates the "kairos" backend from web/ and rolls it out
```

`firebase.json` points App Hosting at `web/`, and `web/apphosting.yaml` lists the secrets and scaling. After the first rollout, the CLI prints your URL (`https://kairos--<project>.<region>.hosted.app`). Then:

1. Add `https://<that-url>/api/google/callback` as a redirect URI on the OAuth client.
2. Uncomment `PUBLIC_URL` in `web/apphosting.yaml`, set it to that URL, and deploy again.

#### Connect Claude with Workload Identity Federation

1. Find the backend's service account and its numeric ID:
   ```bash
   gcloud iam service-accounts describe firebase-app-hosting-compute@<project-id>.iam.gserviceaccount.com --format='value(uniqueId)'
   ```
2. At platform.claude.com → **Settings → Workload identity → Connect workload → Google Cloud** (needs the org admin role), create the issuer `https://accounts.google.com`, a service account, and a rule matching audience `https://api.anthropic.com`, `sub` = that numeric ID and `email` = that service account email.
3. Put the rule, organization and service account IDs into `web/apphosting.yaml` (the commented `ANTHROPIC_*` lines) and deploy again. If the first task fails with *Authentication failed*, the reason is on the Console's authentication history tab.

Prefer deploys on every push? In the Firebase console, go to **App Hosting → Create backend**, connect the GitHub repo, and set the root directory to `web`. Each push to `main` then rolls out on its own.

### 4. iPhone
Open your App Hosting URL in Safari → enter the passcode → Share → **Add to Home Screen**. To dictate, switch to the Wispr Flow keyboard in the prompt box.

### 5. Mac widget
Requires macOS 14+ and Xcode (or the Xcode command line tools).

```bash
cd mac
./scripts/build-app.sh --install   # builds Kairos.app into ~/Applications
open ~/Applications/Kairos.app
```

On first launch the widget shows Settings: enter the server URL (`http://localhost:3000` or your App Hosting URL) and the passcode. The clock icon in the menu bar has *Pin to Desktop*, *Open at Login*, and Quit. You can also open `mac/Package.swift` in Xcode and press Run.

**Using it with Wispr Flow:** press ⌃⌥Space, hold your Wispr Flow key and speak, press Return. Esc sends the widget back to the desktop.

## API

All endpoints need the passcode, as the login cookie (web) or `Authorization: Bearer <KAIROS_TOKEN>` (Mac).

| Method | Path | Body | |
| ------ | ---- | ---- | - |
| GET | `/api/tasks?from=ISO&to=ISO` | | Events from your visible calendars plus Kairos tasks |
| POST | `/api/tasks` | `{ text, timeZone }` | Parse with Claude and add to the Kairos Tasks calendar |
| PATCH | `/api/tasks/:id` | `{ done }` | Check off a task (stored on the event, title unchanged) |
| DELETE | `/api/tasks/:id` | | Delete a task |

## Development

```bash
cd web && npm test && npm run typecheck && npm run build
cd mac && swift build
```
