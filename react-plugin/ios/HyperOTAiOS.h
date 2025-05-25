#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^HyperOTALazyDownloadCallback)(NSString *filePath, BOOL success);
typedef void (^HyperOTALazySplitsCallback)(BOOL success);

@interface HyperOTAiOS : NSObject

+ (instancetype)sharedInstance;

- (void)initializeWithAppId:(NSString *)appId
              indexFileName:(NSString *)indexFileName
                 appVersion:(NSString *)appVersion
    releaseConfigTemplateUrl:(NSString *)releaseConfigTemplateUrl
                    headers:(nullable NSDictionary<NSString *, NSString *> *)headers
       lazyDownloadCallback:(nullable HyperOTALazyDownloadCallback)lazyDownloadCallback
        lazySplitsCallback:(nullable HyperOTALazySplitsCallback)lazySplitsCallback;

- (NSString *)getBundlePath;
- (NSString *)getFileContent:(NSString *)filePath;
- (NSString *)getReleaseConfig;

@end

NS_ASSUME_NONNULL_END
