//
//  AirborneConfig.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AirborneConfig.h"

@implementation AirborneConfig

+ (instancetype)configWithOrganizationId:(NSString *)organizationId
                                    appId:(NSString *)appId
                               appVersion:(NSString *)appVersion
                               baseBundle:(NSBundle *)baseBundle {
    return [self configWithTenantId:nil
                     organizationId:organizationId
                              appId:appId
                           fileName:nil
                         appVersion:appVersion
                    useBundledAssets:NO
                             logger:nil
                         baseBundle:baseBundle];
}

+ (instancetype)configWithTenantId:(NSString * _Nullable)tenantId
                     organizationId:(NSString *)organizationId
                              appId:(NSString *)appId
                           fileName:(NSString * _Nullable)fileName
                         appVersion:(NSString *)appVersion
                    useBundledAssets:(BOOL)useBundledAssets
                             logger:(id<HPJPLoggerDelegate> _Nullable)logger
                         baseBundle:(NSBundle *)baseBundle {
    AirborneConfig *config = [[AirborneConfig alloc] init];
    config.tenantId = tenantId;
    config.organizationId = organizationId;
    config.appId = appId;
    config.fileName = fileName;
    config.appVersion = appVersion;
    config.useBundledAssets = useBundledAssets;
    config.logger = logger;
    config.baseBundle = baseBundle;
    return config;
}

#pragma mark - AirborneConfigDelegate

- (NSString *)organizationId {
    return _organizationId;
}

- (NSString *)appId {
    return _appId;
}

- (NSString *)appVersion {
    return _appVersion;
}

- (NSBundle *)baseBundle {
    return _baseBundle;
}

- (NSString *)tenantId {
    return _tenantId;
}

- (NSString *)fileName {
    return _fileName;
}

- (BOOL)useBundledAssets {
    return _useBundledAssets;
}

- (id<HPJPLoggerDelegate> _Nullable)logger {
    return _logger;
}

@end
