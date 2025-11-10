import Foundation
import Capacitor

/**
 * UploadManager - Delegates to AutoUploadPlugin for proper upload functionality
 */
@objc(UploadManagerPlugin)
public class UploadManager: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "UploadManager"
    public let jsName = "UploadManager"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "uploadPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUploadStatus", returnType: CAPPluginReturnPromise)
    ]
    
    override public func load() {
        super.load()
        print("📤 UploadManager plugin loaded - delegates to AutoUploadPlugin")
    }
    
    @objc func uploadPhotos(_ call: CAPPluginCall) {
        print("🎯 UploadManager.uploadPhotos called - delegating to AutoUploadPlugin")
        
        // Get AutoUploadPlugin instance
        guard let autoUploadPlugin = bridge?.plugin(withName: "AutoUploadPlugin") as? AutoUploadPlugin else {
            print("❌ UploadManager: AutoUploadPlugin not available")
            call.reject("AutoUploadPlugin not available", "PLUGIN_NOT_FOUND", nil)
            return
        }
        
        print("✅ UploadManager: Delegating to AutoUploadPlugin.startAutoUploadFlow")
        
        // Delegate to AutoUploadPlugin's proper upload functionality
        autoUploadPlugin.startAutoUploadFlow(call)
    }
    
    @objc func getUploadStatus(_ call: CAPPluginCall) {
        print("🎯 UploadManager.getUploadStatus called - delegating to AutoUploadPlugin")
        
        // Get AutoUploadPlugin instance
        guard let autoUploadPlugin = bridge?.plugin(withName: "AutoUploadPlugin") as? AutoUploadPlugin else {
            print("❌ UploadManager: AutoUploadPlugin not available")
            call.reject("AutoUploadPlugin not available", "PLUGIN_NOT_FOUND", nil)
            return
        }
        
        print("✅ UploadManager: Delegating to AutoUploadPlugin.getUploadProgress")
        
        // Delegate to AutoUploadPlugin's progress tracking
        autoUploadPlugin.getUploadProgress(call)
    }
}