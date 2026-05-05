# Mobile App

The mobile app is an Expo React Native app for running generated workout plans on iOS and Android.

## Stack

- Expo SDK 55
- Expo Router
- React Native
- TypeScript
- AsyncStorage for on-device workout completion progress
- Shared domain logic from `@personal-trainer/shared`

## Install

Install JavaScript dependencies from the repository root:

```bash
npm install
```

## Run

Start the web app first so the mobile API is available:

```bash
npm run dev:web
```

Then start Expo:

```bash
EXPO_PUBLIC_TRAINER_API_BASE_URL=http://localhost:3000 npm run dev:mobile
```

If the web app sets `TRAINER_MOBILE_API_TOKEN`, also set:

```bash
EXPO_PUBLIC_TRAINER_API_TOKEN=your-token
```

Android emulators may need `EXPO_PUBLIC_TRAINER_API_BASE_URL=http://10.0.2.2:3000` instead of localhost.

## Deploy to iPhone with TestFlight

This app is configured for native iPhone builds with Expo EAS and TestFlight. Expo Go is not required.

### Prerequisites

- a paid Apple Developer account for TestFlight distribution
- access to App Store Connect
- `npx eas-cli@latest` available via `npx`
- the production mobile API hosted at `https://personal-trainer-orpin.vercel.app/`

### App identity

- iOS bundle identifier: `com.arjun.personaltrainer`
- iOS build number: `1`

### First-time setup

Run these commands from `app_mobile/`:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

During the first iOS build, allow EAS to manage Apple signing certificates and provisioning profiles.

### Build for internal testing

The `preview` EAS profile builds the app against the public Vercel mobile API instead of `localhost`:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

### Build and submit to TestFlight

The `production` EAS profile also uses `https://personal-trainer-orpin.vercel.app/` for `/api/mobile/*` requests:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

After submission finishes, open App Store Connect, wait for TestFlight processing to complete, then install the build on your iPhone from TestFlight.

### Important behavior

- Local Expo development still defaults to `http://localhost:3000` unless you override `EXPO_PUBLIC_TRAINER_API_BASE_URL`.
- TestFlight and preview EAS builds use the public Vercel backend from `eas.json`.
- If the deployed web app requires a mobile API token, add `EXPO_PUBLIC_TRAINER_API_TOKEN` to the relevant EAS build profile before building.

## Features

- list available workspaces from the web app API
- load workspace profile and plan data
- show a native workout overview by day
- run a guided start-workout timer using shared timer logic
- persist completion progress locally on the device

Recipe screens are intentionally not part of mobile v1, but recipe state and validation helpers already live in the shared package for future use.
