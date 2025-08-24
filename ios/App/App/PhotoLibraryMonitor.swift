import Foundation
import Photos
import Capacitor

@objc(PhotoLibraryMonitor)
public class PhotoLibraryMonitor: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryMonitor"
    public let jsName = "PhotoLibraryMonitor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]
    private var isMonitoring = false
    private var lastPhotoDate: Date?
    private var monitoringTimer: Timer?
    
    override public func load() {
        super.load()
        print("📸 PhotoLibraryMonitor plugin loaded")
    }
    
    @objc func startMonitoring(_ call: CAPPluginCall) {
        print("🚀 Starting photo library monitoring...")
        
        // Check photo library permissions
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            self.beginMonitoring()
            call.resolve(["success": true, "message": "Monitoring started"])
            
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { [weak self] newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self?.beginMonitoring()
                        call.resolve(["success": true, "message": "Permission granted, monitoring started"])
                    } else {
                        call.reject("Photo library permission denied")
                    }
                }
            }
            
        case .denied, .restricted:
            call.reject("Photo library permission required for auto-upload")
            
        @unknown default:
            call.reject("Unknown photo library permission status")
        }
    }
    
    @objc func stopMonitoring(_ call: CAPPluginCall) {
        print("⏹️ Stopping photo library monitoring...")
        
        isMonitoring = false
        monitoringTimer?.invalidate()
        monitoringTimer = nil
        
        call.resolve(["success": true, "message": "Monitoring stopped"])
    }
    
    @objc func getRecentPhotos(_ call: CAPPluginCall) {
        // Use getString and convert to date/int for compatibility
        let sinceDateString = call.getString("sinceDate")
        let sinceDate: Date
        if let dateString = sinceDateString {
            let formatter = ISO8601DateFormatter()
            sinceDate = formatter.date(from: dateString) ?? Date(timeIntervalSinceNow: -3600)
        } else {
            sinceDate = Date(timeIntervalSinceNow: -3600) // Default: 1 hour ago
        }
        
        let limit = call.getInt("limit") ?? 50
        
        print("📱 Getting recent photos since: \(sinceDate)")
        
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.predicate = NSPredicate(format: "creationDate > %@", sinceDate as NSDate)
        options.fetchLimit = limit
        
        let assets = PHAsset.fetchAssets(with: .image, options: options)
        
        var photos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        
        assets.enumerateObjects { asset, index, stop in
            dispatchGroup.enter()
            
            let imageManager = PHImageManager.default()
            let requestOptions = PHImageRequestOptions()
            requestOptions.isSynchronous = false
            requestOptions.deliveryMode = .highQualityFormat
            requestOptions.isNetworkAccessAllowed = true
            
            // Request image data for base64 conversion
            imageManager.requestImageDataAndOrientation(for: asset, options: requestOptions) { data, dataUTI, orientation, info in
                defer { dispatchGroup.leave() }
                
                guard let imageData = data else {
                    print("⚠️ Could not get image data for asset")
                    return
                }
                
                let base64String = imageData.base64EncodedString()
                
                let photoInfo: [String: Any] = [
                    "id": asset.localIdentifier,
                    "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
                    "modificationDate": asset.modificationDate?.timeIntervalSince1970 ?? 0,
                    "width": asset.pixelWidth,
                    "height": asset.pixelHeight,
                    "base64": base64String,
                    "mimeType": dataUTI ?? "image/jpeg"
                ]
                
                photos.append(photoInfo)
            }
        }
        
        dispatchGroup.notify(queue: .main) {
            print("✅ Retrieved \(photos.count) recent photos")
            call.resolve(["photos": photos])
        }
    }
    
    @objc func getPhotosSinceLastCheck(_ call: CAPPluginCall) {
        guard let lastDate = lastPhotoDate else {
            // First time - get photos from last hour
            let sinceDate = Date(timeIntervalSinceNow: -3600)
            self.lastPhotoDate = Date()
            
            self.getPhotosInternal(since: sinceDate, call: call)
            return
        }
        
        self.getPhotosInternal(since: lastDate, call: call)
        self.lastPhotoDate = Date()
    }
    
    private func beginMonitoring() {
        guard !isMonitoring else { return }
        
        isMonitoring = true
        lastPhotoDate = Date()
        
        // Set up timer to check for new photos every 30 seconds
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.checkForNewPhotos()
        }
        
        print("✅ Photo library monitoring started (30 second intervals)")
        
        // Also register for photo library change notifications
        PHPhotoLibrary.shared().register(self)
    }
    
    private func checkForNewPhotos() {
        guard isMonitoring, let lastDate = lastPhotoDate else { return }
        
        print("🔍 Checking for new photos since: \(lastDate)")
        
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.predicate = NSPredicate(format: "creationDate > %@", lastDate as NSDate)
        options.fetchLimit = 10 // Limit to prevent overwhelming
        
        let assets = PHAsset.fetchAssets(with: .image, options: options)
        
        if assets.count > 0 {
            print("📸 Found \(assets.count) new photos!")
            
            // Update last check time
            lastPhotoDate = Date()
            
            // Notify JavaScript layer
            var newPhotos: [[String: Any]] = []
            
            assets.enumerateObjects { asset, index, stop in
                let photoInfo: [String: Any] = [
                    "id": asset.localIdentifier,
                    "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
                    "width": asset.pixelWidth,
                    "height": asset.pixelHeight
                ]
                newPhotos.append(photoInfo)
            }
            
            // Send notification to JavaScript
            self.notifyListeners("newPhotosDetected", data: ["photos": newPhotos])
            
            // Process photos for upload
            self.processNewPhotosForUpload(assets: assets)
        }
    }
    
    private func processNewPhotosForUpload(assets: PHFetchResult<PHAsset>) {
        let imageManager = PHImageManager.default()
        let requestOptions = PHImageRequestOptions()
        requestOptions.isSynchronous = false
        requestOptions.deliveryMode = .highQualityFormat
        requestOptions.isNetworkAccessAllowed = true
        
        assets.enumerateObjects { asset, index, stop in
            imageManager.requestImageDataAndOrientation(for: asset, options: requestOptions) { [weak self] data, dataUTI, orientation, info in
                guard let imageData = data else {
                    print("⚠️ Could not get image data for photo upload")
                    return
                }
                
                let base64String = imageData.base64EncodedString()
                
                let photoData: [String: Any] = [
                    "id": asset.localIdentifier,
                    "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
                    "base64": base64String,
                    "mimeType": dataUTI ?? "image/jpeg",
                    "width": asset.pixelWidth,
                    "height": asset.pixelHeight
                ]
                
                // Notify JavaScript with photo data for upload
                self?.notifyListeners("photoReadyForUpload", data: photoData)
            }
        }
    }
    
    private func getPhotosInternal(since date: Date, call: CAPPluginCall) {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.predicate = NSPredicate(format: "creationDate > %@", date as NSDate)
        options.fetchLimit = 20
        
        let assets = PHAsset.fetchAssets(with: .image, options: options)
        
        var photos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        
        assets.enumerateObjects { asset, index, stop in
            dispatchGroup.enter()
            
            let imageManager = PHImageManager.default()
            let requestOptions = PHImageRequestOptions()
            requestOptions.isSynchronous = false
            requestOptions.deliveryMode = .highQualityFormat
            requestOptions.isNetworkAccessAllowed = true
            
            imageManager.requestImageDataAndOrientation(for: asset, options: requestOptions) { data, dataUTI, orientation, info in
                defer { dispatchGroup.leave() }
                
                guard let imageData = data else { return }
                
                let base64String = imageData.base64EncodedString()
                
                let photoInfo: [String: Any] = [
                    "id": asset.localIdentifier,
                    "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
                    "base64": base64String,
                    "mimeType": dataUTI ?? "image/jpeg",
                    "width": asset.pixelWidth,
                    "height": asset.pixelHeight
                ]
                
                photos.append(photoInfo)
            }
        }
        
        dispatchGroup.notify(queue: .main) {
            call.resolve(["photos": photos])
        }
    }
    
    @objc func getMonitoringStatus(_ call: CAPPluginCall) {
        let authStatus = PHPhotoLibrary.authorizationStatus()
        
        let statusString: String
        switch authStatus {
        case .authorized: statusString = "authorized"
        case .limited: statusString = "limited"
        case .denied: statusString = "denied"
        case .restricted: statusString = "restricted"
        case .notDetermined: statusString = "notDetermined"
        @unknown default: statusString = "unknown"
        }
        
        call.resolve([
            "isMonitoring": isMonitoring,
            "authorizationStatus": statusString,
            "lastPhotoDate": lastPhotoDate?.timeIntervalSince1970 ?? 0
        ])
    }
}

// MARK: - PHPhotoLibraryChangeObserver
extension PhotoLibraryMonitor: PHPhotoLibraryChangeObserver {
    public func photoLibraryDidChange(_ changeInstance: PHChange) {
        print("📸 Photo library changed - new photos may be available")
        
        DispatchQueue.main.async { [weak self] in
            // Trigger immediate check for new photos
            self?.checkForNewPhotos()
        }
    }
}