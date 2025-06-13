//
//  AirborneConfigDelegate.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPLoggerDelegate.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Protocol for providing configuration information to Airborne
 * This delegate pattern reduces the number of initialization parameters
 */
@protocol AirborneConfigDelegate <NSObject>

@required
/**
 * The organization ID used to build the release config URL
 */
- (NSString *)organizationId;

/**
 * The application ID
 */
- (NSString *)appId;

/**
 * The version of the application
 */
- (NSString *)appVersion;

/**
 * The base bundle to use for fallback resources
 */
- (NSBundle *)baseBundle;

@optional
/**
 * The tenant ID (defaults to "juspay" if not implemented)
 */
- (NSString *)tenantId;

/**
 * The name of the bundle file (defaults to "index.bundle.js" if not implemented)
 */
- (NSString *)fileName;

/**
 * Whether to use bundled assets or download from server (defaults to NO if not implemented)
 */
- (BOOL)useBundledAssets;

/**
 * Optional logger delegate for tracking events from the client
 */
- (id<HPJPLoggerDelegate> _Nullable)logger;

@end

NS_ASSUME_NONNULL_END
