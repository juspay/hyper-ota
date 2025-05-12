# React Native Hyper OTA Plugin

A plugin for implementing Over-The-Air (OTA) updates in your React Native applications.

## Table of Contents
- [Installation](#installation)
- [Setup](#setup)
- [API Reference](#api-reference)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Installation

```sh
npm install react-native-hyper-ota
# OR
yarn add react-native-hyper-ota
```

## Setup

### Android Configuration

Add to your `MainApplication.kt`:

```kotlin
HyperOTAReact.init(
    context: Context,
    appId: String,
    indexFileName: String,
    appVersion: String,
    releaseConfigTemplateUrl: String,
    headers: Map<String, String>? = null,
    lazyDownloadCallback: LazyDownloadCallback? = null,
    trackerCallback: TrackerCallback? = null
)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `Context` | Application context |
| `appId` | `String` | App identifier |
| `indexFileName` | `String` | Bundle filename (e.g., "index.android.bundle") |
| `appVersion` | `String` | App version (e.g., "0.1.3") |
| `releaseConfigTemplateUrl` | `String` | URL to updates configuration JSON |
| `headers` | `Map<String, String>?` | Optional HTTP headers |
| `lazyDownloadCallback` | `LazyDownloadCallback?` | Optional lazy download callback |
| `trackerCallback` | `TrackerCallback?` | Optional event tracking callback |

## API Reference

```javascript
import { readReleaseConfig, getBundlePath, readFileContent } from 'react-native-hyper-ota';
```

### Functions

```javascript
// Get current release configuration
const releaseConfig = await readReleaseConfig();

// Get path to active bundle
const bundlePath = await getBundlePath();

// Read content from a file in the OTA bundle
const fileContent = await readFileContent('config.json');
```

## Development

### Quick Start

```sh
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
bundle install
bundle exec pod install
npm run ios
```

### Making Changes

Edit your `App.tsx` file. The app will auto-refresh with changes.

Force reload:
- **Android**: Press <kbd>R</kbd> twice or <kbd>Ctrl</kbd>+<kbd>M</kbd>
- **iOS**: Press <kbd>R</kbd> in the iOS Simulator

## Troubleshooting

For issues, see the [React Native Troubleshooting guide](https://reactnative.dev/docs/troubleshooting).
