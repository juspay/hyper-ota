
#ifdef RCT_NEW_ARCH_ENABLED
#import "RNHyperOtaSpec.h"

@interface HyperOta : NSObject <NativeHyperOtaSpec>
#else
#import <React/RCTBridgeModule.h>

@interface HyperOta : NSObject <RCTBridgeModule>
#endif

@end
