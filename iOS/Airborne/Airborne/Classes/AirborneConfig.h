//
//  AirborneConfig.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AirborneConfigDelegate.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Default implementation of AirborneConfigDelegate
 * This provides a convenient way to create configuration objects
 */
@interface AirborneConfig : NSObject <AirborneConfigDelegate>

/**
 * Creates a configuration with required parameters
 * @param organizationId The organization ID
 * @param appId The application ID
 * @param appVersion The application version
 * @param baseBundle The base bundle
 */
+ (instancetype)configWithOrganizationId:(NSString *)organizationId
                                    appId:(NSString *)appId
                               appVersion:(NSString *)appVersion
                               baseBundle:(NSBundle *)baseBundle;

/**
 * Creates a configuration with all parameters
 * @param tenantId The tenant ID (optional, defaults to "juspay")
 * @param organizationId The organization ID
 * @param appId The application ID
 * @param fileName The bundle file name (optional, defaults to "main.jsbundle")
 * @param appVersion The application version
 * @param useBundledAssets Whether to use bundled assets
 * @param logger Optional logger delegate
 * @param baseBundle The base bundle
 */
+ (instancetype)configWithTenantId:(NSString * _Nullable)tenantId
                     organizationId:(NSString *)organizationId
                              appId:(NSString *)appId
                           fileName:(NSString * _Nullable)fileName
                         appVersion:(NSString *)appVersion
                    useBundledAssets:(BOOL)useBundledAssets
                             logger:(id<HPJPLoggerDelegate> _Nullable)logger
                         baseBundle:(NSBundle *)baseBundle;

// Properties for configuration values
@property (nonatomic, strong, nullable) NSString *tenantId;
@property (nonatomic, strong) NSString *organizationId;
@property (nonatomic, strong) NSString *appId;
@property (nonatomic, strong, nullable) NSString *fileName;
@property (nonatomic, strong) NSString *appVersion;
@property (nonatomic, assign) BOOL useBundledAssets;
@property (nonatomic, weak, nullable) id<HPJPLoggerDelegate> logger;
@property (nonatomic, strong) NSBundle *baseBundle;

@end

NS_ASSUME_NONNULL_END
