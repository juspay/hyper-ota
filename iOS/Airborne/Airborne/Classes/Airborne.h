//
//  Airborne.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPLoggerDelegate.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Airborne is a library that allows for the management of Over-The-Air (OTA) updates for your application.
 * It provides functionality to track events, handle downloads, and manage application updates.
 */
@interface Airborne : NSObject

/**
 * Initializes Airborne with the given configuration
 * @param tenantId The tenant ID
 * @param organizationId The organization ID used to build the release config URL
 * @param appId The application ID
 * @param fileName The name of the bundle file (defaults to "main.jsbundle")
 * @param appVersion The version of the application
 * @param useBundledAssets Whether to use bundled assets or download from server
 * @param logger Optional logger delegate for tracking events from the client
 * @param baseBundle The base bundle to use for fallback resources
 */
- (instancetype)init:(NSString *)tenantId
                  organizationId:(NSString *)organizationId
                           appId:(NSString *)appId
                        fileName:(NSString * _Nullable)fileName
                      appVersion:(NSString *)appVersion
                 useBundledAssets:(BOOL)useBundledAssets
                           logger:(id<HPJPLoggerDelegate> _Nullable)logger
                       baseBundle:(NSBundle *)baseBundle;

/**
 * Gets the bundle URL for the application with default force update behavior
 * @return The URL to the application bundle
 */
- (NSURL *)getBundleURL;

@end

NS_ASSUME_NONNULL_END
