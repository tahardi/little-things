# Little Things

Little Things is an iPhone app for remembering the people in my life. Speak a note about someone, and a small Go backend
transcribes it with Whisper and uses Claude to update that person's entry. The app reminds me of birthdays and other
dates, puts them on my calendar, and suggests gift ideas.

This is a proof of concept for personal use.

## Layout

- `app/`: Expo app (React Native, TypeScript), run in Expo Go
- `backend/`: stateless Go service that turns voice clips into structured updates and generates gift ideas

## Prerequisites

- Go 1.27.1 or newer (`go version` must print `go1.27.1` or later)
- Node 24 LTS (`app/.nvmrc` pins it; run `nvm use` in `app/`)
- Expo Go on your iPhone, signed in to your Expo account. Also run `npx expo login` on the computer.

## Running the app

```
cd app
npx expo start
```

Scan the QR code with the iPhone camera to open the app in Expo Go. The App Store version of Expo Go only supports the
latest SDK, so after a new SDK release run `npx expo install expo@latest && npx expo install --fix`.

CI does not check Expo package versions because new Expo patch releases would fail it at random. After upgrading
Expo or adding a package, run `npm run deps:check` in `app` and fix any mismatches with `npx expo install --fix`.

## End-to-end tests

See `app/e2e/README.md` for how to run the Maestro flows on the iOS Simulator.

## Backend setup

1. Install the prerequisites from Dig Days (`ffmpeg`, CUDA toolkit, Tailscale on the PC and iPhone with MagicDNS and
   HTTPS certificates). See the dig-days README if they are missing.
2. Build Whisper and download the model:
   ```
   make -C backend whisper-build whisper_cuda=1
   make -C backend whisper-model whisper_model_name=large-v3-turbo
   ```
3. Create the env file, then fill in the values. Generate `LITTLETHINGS_KEY` with `openssl rand -hex 32`.
   ```
   mkdir -p ~/.config/littlethings && cp backend/deploy/env.example ~/.config/littlethings/env && chmod 600 ~/.config/littlethings/env
   ```
4. Install and start the service. Linger is already enabled for Dig Days (`sudo loginctl enable-linger "$USER"` if
   not).
   ```
   make -C backend install
   journalctl --user -u littlethings -f
   ```
5. Serve it over Tailscale on its own HTTPS port so Dig Days keeps 443:
   ```
   tailscale serve --bg --https=8443 http://127.0.0.1:8081
   tailscale serve status
   ```
6. Verify:
   ```
   curl -H "Authorization: Bearer $LITTLETHINGS_KEY" https://<pc>.<tailnet>.ts.net:8443/health
   ```
7. In the app's Settings, set the backend URL to `https://<pc>.<tailnet>.ts.net:8443`.

### Google Calendar

1. In the Google Cloud console, create a project (for example `little-things`).
2. Enable the Google Calendar API for that project (APIs & Services > Library > Google Calendar API > Enable).
3. Create a service account (IAM & Admin > Service Accounts > Create). It needs no project roles.
4. On the service account, create a JSON key (Keys > Add key > JSON). Save it as
   `~/.config/littlethings/google-service-account.json` and run `chmod 600` on it. Never commit it.
5. In Google Calendar on the web, create a calendar named "Little Things" (Settings > Add calendar > Create new
   calendar).
6. In that calendar's settings, under "Share with specific people", add the service account's email
   (`<name>@<project>.iam.gserviceaccount.com`) with "Make changes to events".
7. Copy the calendar ID from "Integrate calendar" (it looks like `...@group.calendar.google.com`).
8. In `~/.config/littlethings/env`, set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path and
   `LITTLETHINGS_CALENDAR_ID` to the calendar ID. Both must be set together or the service will not start.
9. For the live test only, repeat steps 5-7 for a second calendar named "Little Things Test" and set
   `LITTLETHINGS_TEST_CALENDAR_ID`. The live test deletes every Little Things event in that calendar, so never point it
   at the real one.
10. `systemctl --user restart littlethings`.

## Live tests

`make -C backend test-live` runs the tests that call the real Claude API. It loads `~/.config/littlethings/env` when
the file exists. Without `ANTHROPIC_API_KEY` every live test skips.

## Development

Run every check before opening a PR:

```
make pre-pr
```

Work is tracked in the [LT Jira project](https://taylorantoniohardin.atlassian.net/jira/software/projects/LT/boards/4).
