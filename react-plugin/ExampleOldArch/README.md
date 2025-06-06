# HyperOTA React Native Example - Old Architecture

This example demonstrates how to use the HyperOTA React Native plugin with the old React Native architecture.

## Setup

1. Install dependencies:
```bash
npm install
```

2. For iOS (if needed):
```bash
cd ios && pod install
```

## Running the Example

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

## Configuration

The HyperOTA SDK is initialized in:
- Android: `android/app/src/main/java/com/exampleoldarch/MainApplication.kt`

Key configuration parameters:
- `appId`: Unique identifier for your app
- `indexFileName`: Name of the bundle file
- `appVersion`: Current app version
- `releaseConfigTemplateUrl`: URL to fetch release configurations

## Features Demonstrated

1. **Read Release Config**: Fetches the current release configuration
2. **Get Bundle Path**: Retrieves the path to the JavaScript bundle
3. **Error Handling**: Shows how to handle errors from the SDK

## Architecture

This example uses React Native's old architecture (pre-0.68 style) with:
- Traditional Native Modules (not TurboModules)
- Bridge-based communication
- No Fabric renderer

## Troubleshooting

If you encounter build issues:

1. Clean the build:
```bash
cd android && ./gradlew clean
```

2. Reset Metro cache:
```bash
npx react-native start --reset-cache
```

3. Ensure you have the correct Node version (>=18)
