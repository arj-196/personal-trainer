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

## Features

- list available workspaces from the web app API
- load workspace profile and plan data
- show a native workout overview by day
- run a guided start-workout timer using shared timer logic
- persist completion progress locally on the device

Recipe screens are intentionally not part of mobile v1, but recipe state and validation helpers already live in the shared package for future use.
