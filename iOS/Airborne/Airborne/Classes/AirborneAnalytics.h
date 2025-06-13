//
//  AirborneAnalytics.h
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <HyperCore/HPJPLoggerDelegate.h>

NS_ASSUME_NONNULL_BEGIN

// OTA Event Types (matching your Rust enum)
typedef NS_ENUM(NSInteger, OTAEventType) {
    OTAEventTypeUpdateCheck,
    OTAEventTypeUpdateAvailable,
    OTAEventTypeUpdateNotAvailable,
    OTAEventTypeDownloadStarted,
    OTAEventTypeDownloadProgress,
    OTAEventTypeDownloadCompleted,
    OTAEventTypeDownloadFailed,
    OTAEventTypeApplyStarted,
    OTAEventTypeApplySuccess,
    OTAEventTypeApplyFailure,
    OTAEventTypeRollbackInitiated,
    OTAEventTypeRollbackCompleted,
    OTAEventTypeRollbackFailed
};

/**
 * AirborneAnalytics handles tracking and dispatching of OTA events to analytics API
 */
@interface AirborneAnalytics : NSObject

/**
 * Initializes analytics with the given configuration
 * @param tenantId The tenant ID
 * @param organizationId The organization ID
 * @param appId The application ID
 * @param appVersion The version of the application
 */
- (instancetype)initWithTenantId:(NSString *)tenantId
                  organizationId:(NSString *)organizationId
                           appId:(NSString *)appId
                      appVersion:(NSString *)appVersion;

/**
 * Tracks an event with the given key and value
 * @param key The event key/name
 * @param value The event value/data
 */
- (void)trackEventWithKey:(NSString *)key value:(id)value;

/**
 * Tracks an event with success/failure indication
 * @param key The event key/name
 * @param value The event value/data
 * @param isSuccess Whether the event represents a success or failure
 */
- (void)trackEventWithKey:(NSString *)key value:(id)value isSuccess:(BOOL)isSuccess;

/**
 * Tracks an exception event
 * @param key The event key/name
 * @param description The error description
 * @param error The NSError object
 */
- (void)trackException:(NSString *)key description:(NSString *)description error:(NSError * _Nullable)error;

@end

/**
 * AirborneLoggerDelegate wraps client logger and forwards events to analytics
 */
@interface AirborneLoggerDelegate : NSObject <HPJPLoggerDelegate>

@property (nonatomic, strong) AirborneAnalytics *analytics;
@property (nonatomic, weak) id<HPJPLoggerDelegate> clientLogger;

- (instancetype)initWithAnalytics:(AirborneAnalytics *)analytics
                     clientLogger:(id<HPJPLoggerDelegate> _Nullable)clientLogger;

@end

NS_ASSUME_NONNULL_END
