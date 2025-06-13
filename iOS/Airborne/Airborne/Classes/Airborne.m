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
static NSString *const RELEASE_CONFIG_ENDPOINT = @"https://airborne.juspay.in/release/v2";
static NSString *const DEFAULT_TENANT_ID = @"juspay";
static NSString *const DEFAULT_APP_VERSION = @"1.0.0";
static NSString *const DEFAULT_FILENAME = @"index.bundle.js";

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
        _fileName = fileName ?: DEFAULT_FILENAME;
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

- (instancetype)init:(id<AirborneConfigDelegate>)configDelegate {
    // Extract values from delegate with fallbacks for optional methods
    NSString *tenantId = [self extractTenantIdFromDelegate:configDelegate];
    NSString *organizationId = [configDelegate organizationId];
    NSString *appId = [configDelegate appId];
    NSString *fileName = [self extractFileNameFromDelegate:configDelegate];
    NSString *appVersion = [configDelegate appVersion];
    BOOL useBundledAssets = [self extractUseBundledAssetsFromDelegate:configDelegate];
    id<HPJPLoggerDelegate> logger = [self extractLoggerFromDelegate:configDelegate];
    NSBundle *baseBundle = [configDelegate baseBundle];
    
    // Call the existing initializer
    return [self init:tenantId
       organizationId:organizationId
                appId:appId
             fileName:fileName
           appVersion:appVersion
      useBundledAssets:useBundledAssets
               logger:logger
           baseBundle:baseBundle];
}

#pragma mark - Delegate Helper Methods

- (NSString *)extractTenantIdFromDelegate:(id<AirborneConfigDelegate>)delegate {
    if ([delegate respondsToSelector:@selector(tenantId)]) {
        return [delegate tenantId];
    }
    return DEFAULT_TENANT_ID;
}

- (NSString *)extractFileNameFromDelegate:(id<AirborneConfigDelegate>)delegate {
    if ([delegate respondsToSelector:@selector(fileName)]) {
        return [delegate fileName];
    }
    return DEFAULT_FILENAME;
}

- (BOOL)extractUseBundledAssetsFromDelegate:(id<AirborneConfigDelegate>)delegate {
    if ([delegate respondsToSelector:@selector(useBundledAssets)]) {
        return [delegate useBundledAssets];
    }
    return NO;
}

- (id<HPJPLoggerDelegate>)extractLoggerFromDelegate:(id<AirborneConfigDelegate>)delegate {
    if ([delegate respondsToSelector:@selector(logger)]) {
        return [delegate logger];
    }
    return nil;
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
