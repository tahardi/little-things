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

## Development

Run every check before opening a PR:

```
make pre-pr
```

Work is tracked in the [LT Jira project](https://taylorantoniohardin.atlassian.net/jira/software/projects/LT/boards/4).
