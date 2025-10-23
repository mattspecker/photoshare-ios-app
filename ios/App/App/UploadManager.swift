import Foundation
import Capacitor

/**
 * UploadManager - Minimal Plugin for Testing Registration
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
        print("📤 UploadManager plugin loaded successfully!")
    }
    
    @objc func uploadPhotos(_ call: CAPPluginCall) {
        print("🎯 UploadManager.uploadPhotos called")
        
        // Simple test response
        call.resolve([
            "success": true,
            "message": "UploadManager plugin is working!",
            "phase": "Basic Registration Test"
        ])
    }
}