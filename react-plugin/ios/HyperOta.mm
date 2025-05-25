#import "Hyperota.h"
#import "HyperOTAiOS.h"
#import <React/RCTLog.h>

@implementation Hyperota

RCT_EXPORT_MODULE(HyperOta)

+ (void)initializeHyperOTAWithAppId:(NSString *)appId
                       indexFileName:(NSString *)indexFileName
                          appVersion:(NSString *)appVersion
             releaseConfigTemplateUrl:(NSString *)releaseConfigTemplateUrl
                             headers:(nullable NSDictionary<NSString *, NSString *> *)headers {
    [[HyperOTAiOS sharedInstance] initializeWithAppId:appId
                                         indexFileName:indexFileName
                                            appVersion:appVersion
                               releaseConfigTemplateUrl:releaseConfigTemplateUrl
                                               headers:headers
                                  lazyDownloadCallback:^(NSString *filePath, BOOL success) {
                                      RCTLogInfo(@"HyperOTA: File %@ - %@", filePath, success ? @"installed" : @"failed");
                                  }
                                   lazySplitsCallback:^(BOOL success) {
                                      RCTLogInfo(@"HyperOTA: Lazy splits - %@", success ? @"installed" : @"failed");
                                  }];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (void)readReleaseConfig:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *config = [[HyperOTAiOS sharedInstance] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}

- (void)getFileContent:(NSString *)filePath
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *content = [[HyperOTAiOS sharedInstance] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}

- (void)getBundlePath:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *bundlePath = [[HyperOTAiOS sharedInstance] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}
#else
RCT_EXPORT_METHOD(readReleaseConfig:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *config = [[HyperOTAiOS sharedInstance] getReleaseConfig];
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getFileContent:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *content = [[HyperOTAiOS sharedInstance] getFileContent:filePath];
        resolve(content);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}

RCT_EXPORT_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *bundlePath = [[HyperOTAiOS sharedInstance] getBundlePath];
        resolve(bundlePath);
    } @catch (NSException *exception) {
        reject(@"HYPER_OTA_ERROR", exception.reason, nil);
    }
}
#endif

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeHyperotaSpecJSI>(params);
}
#endif

@end
