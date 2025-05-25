# Old Architecture Compatibility

This module has been updated to support both the old and new React Native architectures.

## Changes Made

### JavaScript/TypeScript Layer
- Updated `src/index.tsx` to detect if TurboModules are enabled and load the appropriate module
- The module now works seamlessly with both architectures
- Exports OTA-related functions: `readReleaseConfig`, `getFileContent`, and `getBundlePath`

### Android
- Modified `HyperotaModule.kt` to work with the old architecture using `ReactContextBaseJavaModule`
- Created `HyperotaTurboModule.kt` that extends from the generated `NativeHyperotaSpec` for new architecture
- Updated `HyperotaPackage.kt` to return the appropriate module based on the architecture
- Added `IS_NEW_ARCHITECTURE_ENABLED` build config field in `build.gradle`
- Created `HyperOTAReact.kt` singleton to manage OTA functionality

### iOS
- Updated `Hyperota.h` to conditionally import the correct headers based on `RCT_NEW_ARCH_ENABLED`
- Modified `Hyperota.mm` to use the appropriate export macros for each architecture
- Added conditional compilation for TurboModule support
- Implemented OTA methods with placeholder implementations

## Usage

The module will automatically detect which architecture is being used and load the appropriate implementation.

### Old Architecture
No special configuration needed. The module works out of the box.

### New Architecture
Enable the new architecture in your app by setting the appropriate flags:

**Android**: Add to `gradle.properties`:
```
newArchEnabled=true
```

**iOS**: Enable the new architecture when running pod install:
```bash
RCT_NEW_ARCH_ENABLED=1 pod install
```

## API

The API remains the same regardless of the architecture:

```typescript
import { readReleaseConfig, getFileContent, getBundlePath } from 'react-native-hyperota';

// Read the release configuration
const config = await readReleaseConfig();

// Get content of a file from the OTA bundle
const content = await getFileContent('path/to/file.js');

// Get the bundle path
const bundlePath = await getBundlePath();
```

## Android Setup

For Android, you need to initialize the `HyperOTAReact` singleton in your Application class:

```kotlin
import com.hyperota.HyperOTAReact
import `in`.juspay.hyperota.LazyDownloadCallback

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        // Initialize HyperOTA with your configuration
        HyperOTAReact.init(
            context = this,
            appId = "your-app-id",
            indexFileName = "index.android.bundle",
            appVersion = "1.0.0",
            releaseConfigTemplateUrl = "https://your-server.com/release-config",
            headers = mapOf("Authorization" to "Bearer token"), // Optional
            lazyDownloadCallback = object : LazyDownloadCallback {
                override fun fileInstalled(filePath: String, success: Boolean) {
                    // Handle file installation
                }
                
                override fun lazySplitsInstalled(success: Boolean) {
                    // Handle lazy splits installation
                }
            }
        )
    }
}
```

## Error Handling

All methods return promises and will reject with error code `HYPER_OTA_NOT_INIT` if the HyperOTA SDK is not properly initialized.

```typescript
try {
  const config = await readReleaseConfig();
} catch (error) {
  if (error.code === 'HYPER_OTA_NOT_INIT') {
    console.error('HyperOTA not initialized');
  }
}
```

## Testing

To test with the old architecture:
1. Ensure new architecture flags are not set
2. Clean and rebuild the project

To test with the new architecture:
1. Enable new architecture flags as described above
2. Clean and rebuild the project

## Dependencies

### Android
The module requires the HyperOTA SDK. Add to your app's `android/app/build.gradle`:

```gradle
dependencies {
    implementation "in.juspay:hyperota:VERSION" // Replace VERSION with the specific version
}
```

### iOS
For iOS, you need to add the HyperOTA SDK to your Podfile and implement the actual SDK integration.

## Implementation Notes

The iOS implementation currently includes placeholder methods. In a production environment, you would need to:
1. Integrate with the actual HyperOTA SDK for iOS
2. Implement proper file reading from OTA bundles
3. Handle bundle path resolution
4. Add proper error handling and validation

The Android implementation is complete and uses the actual HyperOTA SDK.
