#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(UploadManager, "UploadManager",
           CAP_PLUGIN_METHOD(uploadPhotos, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getUploadStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getUploadedPhotoHashes, CAPPluginReturnPromise);
)
