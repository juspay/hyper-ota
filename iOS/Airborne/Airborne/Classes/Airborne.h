//
//  Airborne.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "AirborneConfigDelegate.h"
#import "AirborneConfig.h"

NS_ASSUME_NONNULL_BEGIN

/**
 * Airborne is a library that allows for the management of Over-The-Air (OTA) updates for your application.
 * It provides functionality to track events, handle downloads, and manage application updates.
 */
@interface Airborne : NSObject

/**
 * Initializes Airborne with a configuration delegate
 * @param configDelegate The delegate that provides configuration information
 */
- (instancetype)init:(id<AirborneConfigDelegate>)configDelegate;

/**
 * Gets the bundle URL for the application with default force update behavior
 * @return The URL to the application bundle
 */
- (NSURL *)getBundleURL;

@end

NS_ASSUME_NONNULL_END
