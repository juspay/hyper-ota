package com.exampleoldarch

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.hyperota.HyperotaModuleImpl

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Initialize HyperOTA before React Native
    initializeHyperOTA()
    
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
  }
  
  private fun initializeHyperOTA() {
    try {
      HyperotaModuleImpl.initializeHyperOTA(
        context = this,
        appId = "example-old-arch-app",
        indexFileName = "index.android.bundle",
        appVersion = BuildConfig.VERSION_NAME,
        releaseConfigTemplateUrl = "https://example.com/hyperota/release-config",
        headers = mapOf(
          "X-App-Version" to BuildConfig.VERSION_NAME,
          "X-Platform" to "Android"
        ),
        lazyDownloadCallback = null,
        trackerCallback = null
      )
      Log.i("HyperOTA", "HyperOTA initialized successfully")
    } catch (e: Exception) {
      Log.e("HyperOTA", "Failed to initialize HyperOTA", e)
    }
  }
}
