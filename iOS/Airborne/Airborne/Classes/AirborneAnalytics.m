//
//  AirborneAnalytics.m
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

#import "AirborneAnalytics.h"
#import <UIKit/UIKit.h>
#import <sys/utsname.h>
#import <SystemConfiguration/SystemConfiguration.h>

// Constants
static NSString *const ANALYTICS_API_ENDPOINT = @"https://airborne.juspay.in/analytics/events";

@interface AirborneAnalytics ()
@property (nonatomic, strong) NSString *tenantId;
@property (nonatomic, strong) NSString *organizationId;
@property (nonatomic, strong) NSString *appId;
@property (nonatomic, strong) NSString *appVersion;
@property (nonatomic, strong) NSString *sessionId;
@property (nonatomic, strong) NSString *targetJsVersion;
@property (nonatomic, strong) NSURLSession *urlSession;
@end

@implementation AirborneAnalytics

- (instancetype)initWithTenantId:(NSString *)tenantId
                  organizationId:(NSString *)organizationId
                           appId:(NSString *)appId
                      appVersion:(NSString *)appVersion {
    self = [super init];
    if (self) {
        _tenantId = tenantId;
        _organizationId = organizationId;
        _appId = appId;
        _appVersion = appVersion;
        _sessionId = [[NSUUID UUID] UUIDString];
        _targetJsVersion = @"";
        
        // Configure URL session for analytics
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        config.timeoutIntervalForRequest = 30.0;
        config.timeoutIntervalForResource = 60.0;
        _urlSession = [NSURLSession sessionWithConfiguration:config];
    }
    return self;
}

- (void)trackEventWithKey:(NSString *)key value:(id)value {
    [self trackEventWithKey:key value:value isSuccess:YES];
}

- (void)trackEventWithKey:(NSString *)key value:(id)value isSuccess:(BOOL)isSuccess {
    // Extract target JS version from certain events
    if ([key isEqualToString:@"release_config_fetch"] && [value isKindOfClass:[NSDictionary class]]) {
        NSDictionary *valueDict = (NSDictionary *)value;
        isSuccess = valueDict[@"is_success"];
        NSString *newVersion = valueDict[@"new_rc_version"];
        if (newVersion) {
            self.targetJsVersion = newVersion;
        }
    }
    
    if ([key isEqualToString:@"config_updated"] && [value isKindOfClass:[NSDictionary class]]) {
        NSDictionary *valueDict = (NSDictionary *)value;
        NSString *newVersion = valueDict[@"new_config_version"];
        if (newVersion) {
            self.targetJsVersion = newVersion;
        }
    }
    
    // Determine success from package_update_result
    if ([key isEqualToString:@"package_update_result"] && [value isKindOfClass:[NSDictionary class]]) {
        NSDictionary *valueDict = (NSDictionary *)value;
        NSString *result = valueDict[@"result"];
        isSuccess = [result isEqualToString:@"SUCCESS"];
    }
    
    // Map and dispatch events
    NSString *eventType = [self mapKeyToOTAEventType:key isSuccess:isSuccess];
    if (eventType) {
        [self dispatchEventWithType:eventType];
    }
}

- (void)trackException:(NSString *)key description:(NSString *)description error:(NSError *)error {
    NSString *eventType = [self mapKeyToOTAEventType:key isSuccess:NO];
    if (eventType) {
        [self dispatchEventWithType:eventType];
    }
}

- (NSString *)mapKeyToOTAEventType:(NSString *)key isSuccess:(BOOL)isSuccess {
    // UPDATE_CHECK
    if ([key isEqualToString:@"release_config_fetch"] && isSuccess) {
        return @"UPDATE_CHECK";
    }
    
    // UPDATE_AVAILABLE
    if ([key isEqualToString:@"config_updated"]) {
        return @"UPDATE_AVAILABLE";
    }
    
    // UPDATE_NOT_AVAILABLE
    if ([key isEqualToString:@"package_update_info"]) {
        return @"UPDATE_NOT_AVAILABLE";
    }
    
    // DOWNLOAD_STARTED
    if ([key isEqualToString:@"package_update_download_started"]) {
        return @"DOWNLOAD_STARTED";
    }
    
    // DOWNLOAD_PROGRESS
    if ([key isEqualToString:@"file_download"] && isSuccess) {
        return @"DOWNLOAD_PROGRESS";
    }
    
    // DOWNLOAD_COMPLETED / DOWNLOAD_FAILED
    if ([key isEqualToString:@"package_update_result"]) {
        return isSuccess ? @"DOWNLOAD_COMPLETED" : @"DOWNLOAD_FAILED";
    }
    
    // APPLY_STARTED
    if ([key isEqualToString:@"app_update_result"]) {
        return @"APPLY_STARTED";
    }
    
    // APPLY_SUCCESS
    if ([key isEqualToString:@"updated_resources_file"]) {
        return @"APPLY_SUCCESS";
    }
//    if ([key isEqualToString:@"update_end"]) {
//        return @"APPLY_SUCCESS";
//    }
    
    // APPLY_FAILURE
    if ([key isEqualToString:@"package_install_failed"]) {
        return @"APPLY_FAILURE";
    }
    if ([key isEqualToString:@"release_config_write_failed"]) {
        return @"APPLY_FAILURE";
    }
    if ([key isEqualToString:@"release_config_decode"]) {
        return @"APPLY_FAILURE";
    }
    if ([key isEqualToString:@"release_config_read_failed"]) {
        return @"APPLY_FAILURE";
    }
    
    return nil;
}

- (void)dispatchEventWithType:(NSString *)eventType {
    NSDictionary *event = @{
        @"tenantId": self.tenantId,
        @"orgId": self.organizationId,
        @"appId": self.appId,
        @"deviceId": [self getDeviceId],
        @"sessionId": self.sessionId,
        @"eventType": eventType,
        @"releaseId": self.targetJsVersion.length > 0 ? self.targetJsVersion : self.appVersion,
        @"currentJsVersion": self.appVersion,
        @"targetJsVersion": self.targetJsVersion,
        @"rolloutPercentage": @100,
        @"osVersion": [self getOSVersion],
        @"appVersion": self.appVersion,
        @"deviceType": @"iOS",
        @"networkType": [self getNetworkType],
        @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
    };
    
    // Dispatch event asynchronously to analytics API
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
        [self postEventToAPI:event];
    });
}

- (void)postEventToAPI:(NSDictionary *)event {
    NSURL *url = [NSURL URLWithString:ANALYTICS_API_ENDPOINT];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"POST"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:event options:0 error:&jsonError];
    
    if (jsonError) {
        NSLog(@"[Airborne Analytics] Failed to serialize event: %@", jsonError.localizedDescription);
        return;
    }
    
    [request setHTTPBody:jsonData];
    
    NSURLSessionDataTask *task = [self.urlSession dataTaskWithRequest:request
                                                     completionHandler:^(NSData * _Nullable data,
                                                                        NSURLResponse * _Nullable response,
                                                                        NSError * _Nullable error) {
        if (error) {
            NSLog(@"[Airborne Analytics] Failed to post event: %@", error.localizedDescription);
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode >= 200 && httpResponse.statusCode < 300) {
            NSLog(@"[Airborne Analytics] Event posted successfully: %@", event[@"eventType"]);
        } else {
            NSLog(@"[Airborne Analytics] Failed to post event. Status code: %ld", (long)httpResponse.statusCode);
        }
    }];
    
    [task resume];
}

#pragma mark - Device Information

- (NSString *)getDeviceId {
    return [[[UIDevice currentDevice] identifierForVendor] UUIDString] ?: @"unknown";
}

- (NSString *)getOSVersion {
    return [[UIDevice currentDevice] systemVersion];
}

- (NSString *)getNetworkType {
    // Create a reachability reference to a generic host
    SCNetworkReachabilityRef reachability =
        SCNetworkReachabilityCreateWithName(NULL, "www.apple.com");
    SCNetworkReachabilityFlags flags = 0;
    NSString *networkType = @"UNKNOWN";
    
    if (reachability &&
        SCNetworkReachabilityGetFlags(reachability, &flags)) {
        
        // Not reachable at all
        if (!(flags & kSCNetworkReachabilityFlagsReachable)) {
            networkType = @"NO CONNECTION";
        
        // Reachable but requires connection (e.g. VPN, captive portal)
        } else if (flags & kSCNetworkReachabilityFlagsConnectionRequired) {
            networkType = @"NO CONNECTION";
        
        // Reachable via Cellular (WWAN)
#if TARGET_OS_IPHONE
        } else if (flags & kSCNetworkReachabilityFlagsIsWWAN) {
            networkType = @"MOBILE";
#endif
            
            // Otherwise assume Wi-Fi
        } else {
            networkType = @"WIFI";
        }
    }
    
    if (reachability) CFRelease(reachability);
    return networkType;
}

- (BOOL)isWiFiConnected {
    // Simple check using reachability concepts
    // You might want to implement a more sophisticated network check
    // For now, returning a basic implementation
    return NO; // Placeholder - implement proper WiFi detection if needed
}

- (NSString *)getDeviceModel {
    struct utsname systemInfo;
    uname(&systemInfo);
    return [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
}

@end

#pragma mark - AirborneLoggerDelegate

@implementation AirborneLoggerDelegate

- (instancetype)initWithAnalytics:(AirborneAnalytics *)analytics
                     clientLogger:(id<HPJPLoggerDelegate>)clientLogger {
    self = [super init];
    if (self) {
        _analytics = analytics;
        _clientLogger = clientLogger;
    }
    return self;
}

- (void)trackEventWithLevel:(NSString *)level
                      label:(NSString *)label
                      value:(id)value
                   category:(NSString *)category
                subcategory:(NSString *)subcategory {
    
    // Forward to analytics
    [self.analytics trackEventWithKey:label value:value];
    
    // Forward to client logger if present
    if (self.clientLogger) {
        [self.clientLogger trackEventWithLevel:level label:label value:value category:category subcategory:subcategory];
    }
}

- (void)trackEventWithLevel:(NSString *)level
                      label:(NSString *)label
                        key:(NSString *)key
                      value:(id)value
                   category:(NSString *)category
                subcategory:(NSString *)subcategory {
    
    // Determine success based on value content
    BOOL isSuccess = YES;
    if ([value isKindOfClass:[NSDictionary class]]) {
        NSDictionary *valueDict = (NSDictionary *)value;
        NSString *result = valueDict[@"result"];
        if (result && ![result isEqualToString:@"SUCCESS"]) {
            isSuccess = NO;
        }
        if (valueDict[@"error"]) {
            isSuccess = NO;
        }
    }
    
    // Forward to analytics
    [self.analytics trackEventWithKey:key value:value isSuccess:isSuccess];
    
    // Forward to client logger if present
    if (self.clientLogger) {
        [self.clientLogger trackEventWithLevel:level label:label key:key value:value category:category subcategory:subcategory];
    }
}

@end
