# Mobile

React Native app using Expo SDK 57, TypeScript.

## Layout

- `App.tsx` — entry point with NavigationContainer
- `src/navigation/` — bottom tab navigator (Home, Question Bank, History) + stack for interview flow
- `src/screens/` — Home, InterviewSetup, Lobby, Interview, VoiceInterview, Complete, Report, History, QuestionBank
- `src/components/` — AudioPlayer (TTS playback via expo-audio), AudioRecorder (mic recording via expo-audio), SkeletonLoader (shimmer loading placeholders)
- `src/services/api.ts` — API client with retry logic and response caching
- `src/services/cache.ts` — AsyncStorage-based TTL cache for API responses
- `src/types/` — TypeScript types (shared with web frontend)
- `src/constants/` — theme (colors, spacing, fontSize) and API config
- `src/hooks/` — useSessionId (AsyncStorage), useNetworkStatus (offline detection)

## Navigation Structure

- **Bottom Tabs**: Home | Question Bank | History (always visible except during interviews)
- **Stack** (on top of tabs): InterviewSetup → Lobby → Interview/VoiceInterview → Complete → Report

## Dev Server

```bash
npx expo start    # Metro bundler
# Press 'a' for Android emulator, 'w' for web
```

Backend must be running on port 8000. Android emulator uses `10.0.2.2:8000`, iOS uses `localhost:8000`.

## Building APK / IPA

Requires EAS CLI: `npm install -g eas-cli` then `eas login`.

```bash
# Android APK (for sideloading / internal testing)
npm run build:android-apk

# Android AAB (for Play Store)
npm run build:android-prod

# iOS (requires Apple Developer account)
npm run build:ios
npm run build:ios-prod
```

Build config in `eas.json`. Production API URL set via `extra.apiUrl` in `app.json`.

## Conventions

- Bottom tabs via `@react-navigation/bottom-tabs`, interview flow via `@react-navigation/native-stack`
- API base URL configured in `src/constants/config.ts` with platform-specific localhost
- AsyncStorage for persistent user session ID
- Theme tokens in `src/constants/theme.ts`
- No component library — plain React Native StyleSheet
- Voice uses `expo-audio` for TTS playback (useAudioPlayer) and mic recording (useAudioRecorder, M4A/AAC format)
- Skeleton loaders replace ActivityIndicator spinners on initial loads
- Pull-to-refresh on History screen via RefreshControl
- All data-loading screens have error states with retry buttons
- Global offline banner via `@react-native-community/netinfo` (OfflineBanner component)
- API GET requests auto-retry up to 2x with exponential backoff on server errors
- Roles and question bank meta cached in AsyncStorage (10-min TTL)
- FlatLists use `React.memo`, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize` for performance
