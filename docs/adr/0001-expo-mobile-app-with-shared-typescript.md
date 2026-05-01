# Expo Mobile App with Shared TypeScript

We will build `app_mobile` as an Expo React Native app and keep `app_web` as the Next.js web app, with platform-neutral workout and recipe domain logic extracted into `packages/shared`. This avoids trying to reuse DOM/Tailwind UI in native code while still reducing duplication for plan normalization, timer behavior, recipe state, validation, and API contracts.

## Considered Options

- Keep one responsive/PWA web app: lowest code volume, but does not create a real native mobile surface.
- Wrap the web app with Capacitor: faster native shell, but mostly preserves web UI and limits native workout ergonomics.
- Build Expo React Native with shared TypeScript: more UI work, but gives a real mobile app while sharing the logic most likely to drift.
