import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import react_native_hyperota

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize HyperOTA before React Native
    initializeHyperOTA()
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "HyperotaExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  private func initializeHyperOTA() {
    let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    
    Hyperota.initializeHyperOTA(
      withAppId: "hyperota-example-app",
      indexFileName: "main.jsbundle",
      appVersion: appVersion,
      releaseConfigTemplateUrl: "https://example.com/hyperota/release-config",
      headers: [
        "X-App-Version": appVersion,
        "X-Platform": "iOS"
      ]
    )
    
    print("HyperOTA: Initialized successfully")
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
