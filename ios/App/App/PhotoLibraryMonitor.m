#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PhotoLibraryMonitor, "PhotoLibraryMonitor",
           CAP_PLUGIN_METHOD(startMonitoring, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopMonitoring, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getStatus, CAPPluginReturnPromise);
)
