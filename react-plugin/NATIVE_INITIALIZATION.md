# HyperOTA Native Initialization Guide

This guide explains how to initialize HyperOTA in native code and use it from React Native. The implementation is compatible with both the old and new React Native architectures.

## Overview

HyperOTA is initialized once in native code (iOS/Android) when the app starts. After initialization, the React Native module can access the HyperOTA instance to read config files and perform other operations.

## Android Setup

### 1. Initialize HyperOTA in MainApplication

In your `MainApplication.kt` (or `.java`), initialize HyperOTA in the `onCreate` method:

```kotlin
import com.hyperota.HyperotaModuleImpl
import `in`.juspay.hyperota.LazyDownloadCallback
import `in`.juspay.hyperota.TrackerCallback

class MainApplication : Application(), ReactApplication {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize HyperOTA
        HyperotaModuleImpl.initializeHyperOTA(
            context = this,
            appId = "your-app-id",
            indexFileName = "index.android.bundle",
            appVersion = BuildConfig.VERSION_NAME,
            releaseConfigTemplateUrl = "https://your-server.com/release-config",
            headers = mapOf(
                "Authorization" to "Bearer your-token",
                "X-Custom-Header" to "value"
            ),
            lazyDownloadCallback = object : LazyDownloadCallback {
                override fun fileInstalled(filePath: String, success: Boolean) {
                    Log.d("HyperOTA", "File $filePath installed: $success")
                }
                
                override fun lazySplitsInstalled(success: Boolean) {
                    Log.d("HyperOTA", "Lazy splits installed: $success")
                }
            },
            trackerCallback = object : TrackerCallback() {
                override fun track(
                    category: String,
                    subCategory: String,
                    level: String,
                    label: String,
                    key: String,
                    value: Any
                ) {
                    // Your tracking implementation
                }
            }
        )
        
        // Rest of your initialization code...
        SoLoader.init(this, OpenSourceMergedSoMapping)
        // ...
    }
}
```

### 2. Add HyperOTA Dependency

In your app's `android/app/build.gradle`:

```gradle
dependencies {
    implementation 'in.juspay:hyperota:YOUR_VERSION'
    // ... other dependencies
}
```

## iOS Setup

### 1. Initialize HyperOTA in AppDelegate

In your `AppDelegate.swift` (or `.m`), initialize HyperOTA:

```swift
import UIKit
import react_native_hyperota

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Initialize HyperOTA
        Hyperota.initializeHyperOTA(
            withAppId: "your-app-id",
            indexFileName: "main.jsbundle",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
            releaseConfigTemplateUrl: "https://your-server.com/release-config",
            headers: [
                "Authorization": "Bearer your-token",
                "X-Custom-Header": "value"
            ]
        )
        
        // Rest of your initialization code...
        return true
    }
}
```

For Objective-C:

```objc
#import "AppDelegate.h"
#import <react_native_hyperota/react_native_hyperota-Swift.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    
    // Initialize HyperOTA
    [Hyperota initializeHyperOTAWithAppId:@"your-app-id"
                            indexFileName:@"main.jsbundle"
                               appVersion:[[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"]
                  releaseConfigTemplateUrl:@"https://your-server.com/release-config"
                                  headers:@{
                                      @"Authorization": @"Bearer your-token",
                                      @"X-Custom-Header": @"value"
                                  }];
    
    // Rest of your initialization code...
    return YES;
}

@end
```

### 2. Add HyperOTA SDK

Add the HyperOTA iOS SDK to your project. You can use CocoaPods, Carthage, or Swift Package Manager.

For CocoaPods, add to your `Podfile`:

```ruby
pod 'HyperOTA', '~> YOUR_VERSION'
```

## React Native Usage

After native initialization, you can use HyperOTA in your React Native code:

```typescript
import { readReleaseConfig, getFileContent, getBundlePath } from 'react-native-hyperota';

// Read release configuration
const config = await readReleaseConfig();
console.log('Release config:', JSON.parse(config));

// Get file content from OTA bundle
const content = await getFileContent('path/to/file.json');
console.log('File content:', content);

// Get bundle path
const bundlePath = await getBundlePath();
console.log('Bundle path:', bundlePath);
```

## Architecture Compatibility

This implementation is compatible with both:

1. **Old Architecture**: Uses the traditional React Native bridge
2. **New Architecture (TurboModules)**: Uses the new TurboModule system with JSI

The module automatically detects which architecture is being used and loads the appropriate implementation.

## Error Handling

All methods return promises that can be rejected with error codes:

- `HYPER_OTA_ERROR`: General HyperOTA errors
- `HYPER_OTA_NOT_INIT`: HyperOTA is not initialized (shouldn't happen if initialized in native code)

```typescript
try {
    const config = await readReleaseConfig();
    // Use config
} catch (error) {
    console.error('Failed to read config:', error.message);
}
```

## Important Notes

1. **Initialize Once**: HyperOTA should be initialized only once when the app starts. The implementation includes checks to prevent re-initialization.

2. **Native Instance**: The HyperOTA instance is created and managed in native code. React Native only accesses this instance, it doesn't create its own.

3. **Thread Safety**: The implementation is thread-safe on both platforms.

4. **Callbacks**: The lazy download and tracker callbacks are handled in native code. You can expose these to React Native if needed by adding event emitters.

## Troubleshooting

1. **Module not found**: Make sure you've rebuilt the app after adding the native code
2. **HyperOTA not initialized**: Ensure the initialization code runs before any React Native code tries to use the module
3. **Build errors**: Check that you've added the HyperOTA SDK dependencies correctly

## Future Enhancements

To fully integrate with the actual HyperOTA SDK:

1. Replace the placeholder implementations in `HyperOTAiOS.m` with actual SDK calls
2. Import the actual HyperOTA iOS SDK headers
3. Handle the actual callbacks and events from the SDK
4. Add more methods as needed for your use case
