#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(EventPhotoPicker, "EventPhotoPicker",
           CAP_PLUGIN_METHOD(openEventPhotoPicker, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(openRegularPhotoPicker, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getEventPhotosMetadata, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(showEventInfo, CAPPluginReturnPromise);
)
