//
//  Airborne.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "Airborne.h"
#import "AirborneAnalytics.h"
#import <HyperOTA/HyperOTAServices.h>

// Constants
static NSString *const RELEASE_CONFIG_ENDPOINT = @"https://airborne.juspay.in";
static NSString *const DEFAULT_TENANT_ID = @"juspay";
static NSString *const DEFAULT_APP_VERSION = @"1.0.0";

@interface Airborne ()
@property (nonatomic, strong) NSString *tenantId;
@property (nonatomic, strong) NSString *organizationId;
@property (nonatomic, strong) NSString *appId;
@property (nonatomic, strong) NSString *fileName;
@property (nonatomic, strong) NSString *appVersion;
@property (nonatomic, assign) BOOL useBundledAssets;
@property (nonatomic, strong) NSBundle *baseBundle;
@property (nonatomic, strong) AirborneAnalytics *analytics;
@property (nonatomic, strong) AirborneLoggerDelegate *loggerDelegate;
@property (nonatomic, strong) HyperOTAServices *hyperOTAServices;
@end

@implementation Airborne

- (instancetype)init:(NSString *)tenantId
      organizationId:(NSString *)organizationId
               appId:(NSString *)appId
            fileName:(NSString *)fileName
          appVersion:(NSString *)appVersion
     useBundledAssets:(BOOL)useBundledAssets
               logger:(id<HPJPLoggerDelegate> _Nullable)logger
           baseBundle:(NSBundle *)baseBundle {
    self = [super init];
    if (self) {
        _tenantId = tenantId ?: DEFAULT_TENANT_ID;
        _organizationId = organizationId;
        _appId = appId;
        _fileName = fileName ?: @"main.jsbundle";
        _appVersion = appVersion ?: DEFAULT_APP_VERSION;
        _useBundledAssets = useBundledAssets;
        _baseBundle = baseBundle;
        
        // Initialize analytics
        _analytics = [[AirborneAnalytics alloc] initWithTenantId:_tenantId
                                                  organizationId:_organizationId
                                                           appId:_appId
                                                      appVersion:_appVersion];
        
        // Create wrapper logger delegate
        _loggerDelegate = [[AirborneLoggerDelegate alloc] initWithAnalytics:_analytics
                                                               clientLogger:logger];
        
        // Initialize HyperOTAServices with proper payload
        NSDictionary *payload = [self buildPayloadForForceUpdate:NO];
        _hyperOTAServices = [[HyperOTAServices alloc] initWithPayload:payload
                                                       loggerDelegate:_loggerDelegate
                                                           baseBundle:_baseBundle];
    }
    return self;
}

- (NSDictionary *)buildPayloadForForceUpdate:(BOOL)forceUpdate {
    return @{
        @"clientId": self.appId,
        @"namespace": self.tenantId,
        @"fileName": self.fileName,
        @"forceUpdate": @(forceUpdate),
        @"localAssets": @(self.useBundledAssets),
        @"releaseConfigURL": [self buildReleaseConfigURL]
    };
}

- (NSURL *)getBundleURL {
    return [self.hyperOTAServices bundleURL];
}

- (NSString *)buildReleaseConfigURL {
    return [NSString stringWithFormat:@"%@/%@/%@", RELEASE_CONFIG_ENDPOINT, self.organizationId, self.appId];
}

@end
