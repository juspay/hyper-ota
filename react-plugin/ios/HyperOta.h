#ifdef RCT_NEW_ARCH_ENABLED
#import <HyperotaSpec/HyperotaSpec.h>

@interface Hyperota : NSObject <NativeHyperotaSpec>
#else
#import <React/RCTBridgeModule.h>

@interface Hyperota : NSObject <RCTBridgeModule>
#endif

+ (void)initializeHyperOTAWithAppId:(NSString *)appId
                       indexFileName:(NSString *)indexFileName
                          appVersion:(NSString *)appVersion
             releaseConfigTemplateUrl:(NSString *)releaseConfigTemplateUrl
                             headers:(nullable NSDictionary<NSString *, NSString *> *)headers;

@end
