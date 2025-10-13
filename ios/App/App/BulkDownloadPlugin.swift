import Foundation
import Capacitor
import UIKit

/**
 * Capacitor plugin for bulk photo download functionality.
 * Integrates with web app to launch native bulk download interface.
 * Matches Android BulkDownloadPlugin.java API exactly.
 */
@objc(BulkDownloadPlugin)
public class BulkDownloadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BulkDownloadPlugin"
    public let jsName = "BulkDownload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openBulkDownload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isBulkDownloadAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testPluginActive", returnType: CAPPluginReturnPromise)
    ]
    
    private static let TAG = "BulkDownloadPlugin"
    
    // MARK: - Plugin Lifecycle
    
    override public func load() {
        super.load()
        NSLog("🔥 BulkDownloadPlugin loaded successfully")
        NSLog("🔥 Available methods: openBulkDownload, isBulkDownloadAvailable, testPluginActive")
    }
    
    // MARK: - Plugin Methods
    
    /**
     * Open bulk download activity with sectioned photos
     * Called from web app when user wants to bulk download photos
     */
    @objc func openBulkDownload(_ call: CAPPluginCall) {
        NSLog("🔥🔥🔥 UPDATED CODE: BulkDownloadPlugin.openBulkDownload called 🔥🔥🔥")
        
        guard let eventId = call.getString("eventId"), !eventId.isEmpty else {
            call.reject("Event ID is required")
            return
        }
        
        let eventName = call.getString("eventName") ?? "Event Photos"
        
        guard let photosArray = call.getArray("photos", JSObject.self), !photosArray.isEmpty else {
            call.reject("Photos array is required and cannot be empty")
            return
        }
        
        NSLog("🔥 Opening bulk download for event \(eventName) (\(eventId)) with \(photosArray.count) photos")
        
        // Convert JSArray to [GalleryPhotoItem]
        let galleryPhotos = convertToGalleryPhotos(photosArray: photosArray)
        
        guard !galleryPhotos.isEmpty else {
            call.reject("No valid photos found")
            return
        }
        
        // Launch BulkDownloadViewController on main thread
        DispatchQueue.main.async {
            // Create view controller programmatically
            let bulkDownloadVC = BulkDownloadViewController()
            
            // Configure the view controller
            bulkDownloadVC.configure(
                eventId: eventId,
                eventName: eventName,
                photos: galleryPhotos
            )
            
            // Present modally with navigation controller
            let navController = UINavigationController(rootViewController: bulkDownloadVC)
            navController.modalPresentationStyle = .fullScreen
            
            if let presentingVC = self.bridge?.viewController {
                presentingVC.present(navController, animated: true, completion: nil)
                
                // Resolve call immediately - view controller will handle the rest
                let result = [
                    "success": true,
                    "message": "Bulk download activity launched",
                    "photoCount": galleryPhotos.count
                ] as [String : Any]
                call.resolve(result)
                
                NSLog("✅ BulkDownloadViewController launched successfully")
            } else {
                call.reject("Could not access presenting view controller")
            }
        }
    }
    
    /**
     * Check if bulk download is available (for web app to query)
     */
    @objc func isBulkDownloadAvailable(_ call: CAPPluginCall) {
        let result = [
            "available": true,
            "platform": "ios",
            "supportsIndividualDownloads": true,
            "supportsZipDownloads": false // Mobile uses individual downloads
        ] as [String : Any]
        call.resolve(result)
    }
    
    /**
     * Simple test method to verify plugin code is active
     */
    @objc func testPluginActive(_ call: CAPPluginCall) {
        NSLog("🔥 TEST: BulkDownloadPlugin.testPluginActive() called - CODE IS ACTIVE!")
        let result = [
            "active": true,
            "timestamp": Date().timeIntervalSince1970,
            "message": "BulkDownloadPlugin code is active and updated!"
        ] as [String : Any]
        call.resolve(result)
    }
    
    // MARK: - Private Helper Methods
    
    /**
     * Convert JSObject array to [GalleryPhotoItem]
     * Reuses the same conversion logic as Android BulkDownloadPlugin
     */
    private func convertToGalleryPhotos(photosArray: [JSObject]) -> [GalleryPhotoItem] {
        NSLog("🔥🔥🔥 UPDATED CODE: convertToGalleryPhotos called with \(photosArray.count) photos 🔥🔥🔥")
        var galleryPhotos: [GalleryPhotoItem] = []
        
        for (index, photoObj) in photosArray.enumerated() {
            // Extract photo data (following Android BulkDownloadPlugin pattern)
            let thumbnailUrl = photoObj["thumbnailUrl"] as? String ?? photoObj["url"] as? String
            let fullUrl = photoObj["fullUrl"] as? String ?? thumbnailUrl
            
            // Fallback logic if either URL is missing
            guard let finalThumbnailUrl = thumbnailUrl ?? fullUrl,
                  let finalFullUrl = fullUrl ?? thumbnailUrl,
                  !finalThumbnailUrl.isEmpty else {
                NSLog("❌ Skipping photo \(index) - no valid URL")
                continue
            }
            
            let title = photoObj["title"] as? String ?? "Photo"
            let uploader = photoObj["uploadedBy"] as? String ?? "Unknown"
            let uploadDate = photoObj["uploadedAt"] as? String ?? photoObj["uploadDate"] as? String ?? ""
            let photoId = photoObj["id"] as? String ?? ""
            let isOwn = photoObj["isOwn"] as? Bool ?? false
            
            NSLog("📸 Photo \(index): thumbnail='\(finalThumbnailUrl)', full='\(finalFullUrl)', id='\(photoId)'")
            
            let galleryPhoto = GalleryPhotoItem(
                thumbnailUrl: finalThumbnailUrl,
                fullUrl: finalFullUrl,
                title: title,
                uploader: uploader,
                uploadDate: uploadDate,
                photoId: photoId,
                isOwn: isOwn
            )
            galleryPhotos.append(galleryPhoto)
            
            NSLog("📋 Added photo \(index): \(title) by \(uploader) (own: \(isOwn))")
        }
        
        NSLog("📊 Converted \(galleryPhotos.count) photos from \(photosArray.count) total")
        return galleryPhotos
    }
    
    /**
     * Check WiFi preference integration
     * Returns true if downloads are allowed based on current network and user preferences
     */
    private func canDownloadNow(photoCount: Int) -> Bool {
        // Check WiFi-only preference from UserDefaults (matching Android SharedPreferences key)
        let wifiOnlyEnabled = UserDefaults.standard.bool(forKey: "wifiOnlyUpload")
        
        if !wifiOnlyEnabled {
            // WiFi-only not enabled, allow downloads on any connection
            NSLog("📶 WiFi-only disabled - allowing download on any connection")
            return true
        }
        
        // WiFi-only is enabled, check current network type
        // TODO: Implement proper network type detection for iOS
        // For now, allow downloads (can be enhanced later)
        NSLog("📶 WiFi-only enabled - network check not implemented yet, allowing download")
        return true
    }
}