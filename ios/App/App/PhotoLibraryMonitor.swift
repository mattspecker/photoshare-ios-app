import Foundation
import Photos
import Capacitor
import Network

@objc(PhotoLibraryMonitor)
public class PhotoLibraryMonitor: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryMonitor"
    public let jsName = "PhotoLibraryMonitor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopMonitoring", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enableAutoUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disableAutoUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAutoUploadEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "processNewPhotosForUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateAutoUploadSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAutoUploadSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkNetworkStatus", returnType: CAPPluginReturnPromise)
    ]
    private var isMonitoring = false
    private var lastPhotoDate: Date?
    private var monitoringTimer: Timer?
    
    // Auto-upload properties
    private var autoUploadEnabled = false
    private var currentEventId: String?
    private var uploadInProgress = false
    private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
    private var pendingUploads: [String] = [] // Track photo IDs being uploaded
    
    // User preference properties
    private var userAutoUploadEnabled = false
    private var wifiOnlyUpload = false
    
    override public func load() {
        super.load()
        print("📸 PhotoLibraryMonitor plugin loaded")
        
        // Load user preferences on startup
        loadAutoUploadSettings()
        
        // Emit bridge ready event after a short delay to ensure web view is ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.emitBridgeReadyEvent()
        }
    }
    
    // MARK: - Auto-Upload Methods
    
    @objc func enableAutoUpload(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("Event ID is required for auto-upload")
            return
        }
        
        autoUploadEnabled = true
        currentEventId = eventId
        
        // Start monitoring if not already running
        if !isMonitoring {
            beginMonitoring()
        }
        
        print("🚀 Auto-upload enabled for event: \(eventId)")
        
        // Load user preferences
        loadAutoUploadSettings()
        
        call.resolve([
            "success": true,
            "eventId": eventId,
            "message": "Auto-upload enabled"
        ])
    }
    
    @objc func disableAutoUpload(_ call: CAPPluginCall) {
        autoUploadEnabled = false
        currentEventId = nil
        pendingUploads.removeAll()
        
        // Stop background task if running
        endBackgroundTask()
        
        print("⏹️ Auto-upload disabled")
        
        call.resolve([
            "success": true,
            "message": "Auto-upload disabled"
        ])
    }
    
    @objc func setAutoUploadEvent(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId") else {
            call.reject("Event ID is required")
            return
        }
        
        currentEventId = eventId
        print("📝 Auto-upload event set to: \(eventId)")
        
        call.resolve([
            "success": true,
            "eventId": eventId
        ])
    }
    
    @objc func processNewPhotosForUpload(_ call: CAPPluginCall) {
        guard autoUploadEnabled, let eventId = currentEventId else {
            call.reject("Auto-upload not enabled or no event set")
            return
        }
        
        // Process any new photos since last check
        checkForNewPhotosAndUpload()
        
        call.resolve([
            "success": true,
            "message": "Processing new photos for upload"
        ])
    }
    
    @objc func updateAutoUploadSettings(_ call: CAPPluginCall) {
        print("🔧 ==================== UPDATE AUTO-UPLOAD SETTINGS ====================")
        print("📥 Raw call options: \(call.options)")
        
        let userEnabled = call.getBool("userAutoUploadEnabled") ?? false
        let wifiOnly = call.getBool("wifiOnlyUpload") ?? false
        
        print("📥 Extracted parameters:")
        print("   userAutoUploadEnabled: \(userEnabled) (from key: userAutoUploadEnabled)")
        print("   wifiOnlyUpload: \(wifiOnly) (from key: wifiOnlyUpload)")
        print("📥 Previous values:")
        print("   userAutoUploadEnabled: \(userAutoUploadEnabled)")
        print("   wifiOnlyUpload: \(wifiOnlyUpload)")
        
        // Check if settings actually changed
        let didChange = userAutoUploadEnabled != userEnabled || wifiOnlyUpload != wifiOnly
        
        userAutoUploadEnabled = userEnabled
        wifiOnlyUpload = wifiOnly
        
        // Save to UserDefaults
        let defaults = UserDefaults.standard
        defaults.set(userEnabled, forKey: "userAutoUploadEnabled")
        defaults.set(wifiOnly, forKey: "wifiOnlyUpload")
        
        // Force synchronize to ensure persistence
        defaults.synchronize()
        
        print("💾 Auto-upload settings updated: userEnabled=\(userEnabled), wifiOnly=\(wifiOnly)")
        print("💾 UserDefaults saved and synchronized")
        
        // Verify the save worked by reading back
        let savedEnabled = defaults.bool(forKey: "userAutoUploadEnabled")
        let savedWifiOnly = defaults.bool(forKey: "wifiOnlyUpload")
        print("✅ Verification - UserDefaults readback:")
        print("   userAutoUploadEnabled: \(savedEnabled)")
        print("   wifiOnlyUpload: \(savedWifiOnly)")
        
        // Emit event if settings changed
        if didChange {
            print("📡 Settings changed - emitting event")
            emitAutoUploadSettingsChangedEvent()
        }
        
        print("🔧 ================================================================")
        
        call.resolve([
            "success": true,
            "userAutoUploadEnabled": userEnabled,
            "wifiOnlyUpload": wifiOnly,
            "saved": true,
            "verified": savedEnabled == userEnabled && savedWifiOnly == wifiOnly
        ])
    }
    
    @objc func getAutoUploadSettings(_ call: CAPPluginCall) {
        print("📱 getAutoUploadSettings called - returning current settings")
        print("   userAutoUploadEnabled: \(userAutoUploadEnabled)")
        print("   wifiOnlyUpload: \(wifiOnlyUpload)")
        print("   systemAutoUploadEnabled: \(autoUploadEnabled)")
        print("   currentEventId: \(currentEventId ?? "none")")
        
        // Ensure settings are loaded from UserDefaults
        if !userAutoUploadEnabled && !wifiOnlyUpload {
            print("⚠️ Settings appear to be default values, reloading from UserDefaults...")
            loadAutoUploadSettings()
        }
        
        let settings = [
            "userAutoUploadEnabled": userAutoUploadEnabled,
            "wifiOnlyUpload": wifiOnlyUpload,
            "systemAutoUploadEnabled": autoUploadEnabled,
            "currentEventId": currentEventId ?? "",
            "bridgeReady": true,
            "source": "PhotoLibraryMonitor"
        ] as [String : Any]
        
        print("✅ Returning settings: \(settings)")
        call.resolve(settings)
    }
    
    @objc func checkNetworkStatus(_ call: CAPPluginCall) {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue(label: "NetworkMonitor")
        
        monitor.pathUpdateHandler = { [weak self] path in
            let isConnected = path.status == .satisfied
            let isWifi = path.usesInterfaceType(.wifi)
            let isCellular = path.usesInterfaceType(.cellular)
            
            DispatchQueue.main.async {
                call.resolve([
                    "isConnected": isConnected,
                    "isWifi": isWifi,
                    "isCellular": isCellular,
                    "canUpload": self?.canUploadWithCurrentNetwork(isWifi: isWifi) ?? false
                ])
            }
            
            monitor.cancel()
        }
        
        monitor.start(queue: queue)
    }
    
    // MARK: - Existing Methods
    
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
            
            // If auto-upload is enabled, process for upload
            if autoUploadEnabled && currentEventId != nil {
                processNewPhotosForAutoUpload(assets: assets)
            } else {
                // Legacy behavior for manual upload
                self.processNewPhotosForUpload(assets: assets)
            }
        }
    }
    
    private func checkForNewPhotosAndUpload() {
        checkForNewPhotos()
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
            "lastPhotoDate": lastPhotoDate?.timeIntervalSince1970 ?? 0,
            "autoUploadEnabled": autoUploadEnabled,
            "userAutoUploadEnabled": userAutoUploadEnabled,
            "wifiOnlyUpload": wifiOnlyUpload,
            "currentEventId": currentEventId ?? "",
            "uploadInProgress": uploadInProgress,
            "pendingUploads": pendingUploads.count
        ])
    }
    
    // MARK: - Auto-Upload Processing
    
    private func processNewPhotosForAutoUpload(assets: PHFetchResult<PHAsset>) {
        guard autoUploadEnabled, 
              userAutoUploadEnabled,
              let eventId = currentEventId else { 
            print("⏩ Auto-upload conditions not met: systemEnabled=\(autoUploadEnabled), userEnabled=\(userAutoUploadEnabled), eventId=\(currentEventId ?? "none")")
            return 
        }
        
        print("🚀 Processing \(assets.count) photos for auto-upload to event: \(eventId)")
        
        // Check network conditions if WiFi-only is enabled
        if wifiOnlyUpload {
            checkNetworkAndUpload(assets: assets, eventId: eventId)
        } else {
            proceedWithUpload(assets: assets, eventId: eventId)
        }
    }
    
    private func checkNetworkAndUpload(assets: PHFetchResult<PHAsset>, eventId: String) {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue(label: "NetworkCheck")
        
        monitor.pathUpdateHandler = { [weak self] path in
            let isWifi = path.usesInterfaceType(.wifi)
            
            DispatchQueue.main.async {
                if isWifi {
                    print("✅ WiFi detected, proceeding with auto-upload")
                    self?.proceedWithUpload(assets: assets, eventId: eventId)
                } else {
                    print("⏩ WiFi-only mode enabled but not on WiFi, skipping upload")
                    // Notify JavaScript that upload was skipped due to WiFi requirement
                    self?.notifyListeners("autoUploadSkipped", data: [
                        "reason": "wifiOnly",
                        "photoCount": assets.count,
                        "eventId": eventId
                    ])
                }
            }
            
            monitor.cancel()
        }
        
        monitor.start(queue: queue)
    }
    
    private func proceedWithUpload(assets: PHFetchResult<PHAsset>, eventId: String) {
        // Start background task to ensure completion even if app is backgrounded
        beginBackgroundTask()
        
        uploadInProgress = true
        
        let imageManager = PHImageManager.default()
        let requestOptions = PHImageRequestOptions()
        requestOptions.isSynchronous = false
        requestOptions.deliveryMode = .highQualityFormat
        requestOptions.isNetworkAccessAllowed = true
        
        var processedCount = 0
        let totalCount = assets.count
        
        assets.enumerateObjects { [weak self] asset, index, stop in
            guard let self = self else { return }
            
            // Skip if already uploading this photo
            if self.pendingUploads.contains(asset.localIdentifier) {
                processedCount += 1
                if processedCount == totalCount {
                    self.finishUploadBatch()
                }
                return
            }
            
            // Add to pending uploads
            self.pendingUploads.append(asset.localIdentifier)
            
            // Process each photo for upload
            self.processPhotoForAutoUpload(asset: asset, eventId: eventId) { success in
                processedCount += 1
                
                // Remove from pending uploads
                if let index = self.pendingUploads.firstIndex(of: asset.localIdentifier) {
                    self.pendingUploads.remove(at: index)
                }
                
                if processedCount == totalCount {
                    self.finishUploadBatch()
                }
            }
        }
        
        // Handle empty case
        if totalCount == 0 {
            finishUploadBatch()
        }
    }
    
    private func processPhotoForAutoUpload(asset: PHAsset, eventId: String, completion: @escaping (Bool) -> Void) {
        // Check if photo is recent (within last 24 hours) to avoid uploading old photos
        let dayAgo = Date(timeIntervalSinceNow: -86400)
        guard let creationDate = asset.creationDate, creationDate > dayAgo else {
            print("⏩ Skipping old photo from: \(asset.creationDate?.description ?? "unknown")")
            completion(false)
            return
        }
        
        // Use existing EventPhotoPicker duplicate detection logic
        EventPhotoPicker.checkPhotoAlreadyUploaded(asset: asset, eventId: eventId) { [weak self] isDuplicate in
            if isDuplicate {
                print("⏩ Skipping duplicate photo: \(asset.localIdentifier)")
                completion(false)
                return
            }
            
            // Photo is not a duplicate, proceed with upload
            self?.uploadPhotoToEvent(asset: asset, eventId: eventId, completion: completion)
        }
    }
    
    private func uploadPhotoToEvent(asset: PHAsset, eventId: String, completion: @escaping (Bool) -> Void) {
        print("📤 Uploading photo \(asset.localIdentifier) to event \(eventId)")
        
        let imageManager = PHImageManager.default()
        let requestOptions = PHImageRequestOptions()
        requestOptions.isSynchronous = false
        requestOptions.deliveryMode = .highQualityFormat
        requestOptions.isNetworkAccessAllowed = true
        
        imageManager.requestImageDataAndOrientation(for: asset, options: requestOptions) { [weak self] data, dataUTI, orientation, info in
            guard let imageData = data else {
                print("⚠️ Could not get image data for auto-upload")
                completion(false)
                return
            }
            
            // Create upload data structure
            let photoData: [String: Any] = [
                "asset": asset,
                "imageData": imageData,
                "mimeType": dataUTI ?? "image/jpeg",
                "eventId": eventId,
                "uploadId": UUID().uuidString
            ]
            
            // Use EventPhotoPicker upload functionality
            EventPhotoPicker.uploadPhotoInBackground(photoData: photoData) { success, error in
                if success {
                    print("✅ Auto-uploaded photo: \(asset.localIdentifier)")
                    
                    // Notify JavaScript of successful auto-upload
                    self?.notifyListeners("photoAutoUploaded", data: [
                        "photoId": asset.localIdentifier,
                        "eventId": eventId,
                        "success": true
                    ])
                } else {
                    print("❌ Auto-upload failed: \(error ?? "unknown error")")
                    
                    // Notify JavaScript of failed auto-upload
                    self?.notifyListeners("photoAutoUploaded", data: [
                        "photoId": asset.localIdentifier,
                        "eventId": eventId,
                        "success": false,
                        "error": error ?? "Upload failed"
                    ])
                }
                
                completion(success)
            }
        }
    }
    
    private func finishUploadBatch() {
        uploadInProgress = false
        endBackgroundTask()
        
        print("✅ Auto-upload batch completed. Pending uploads: \(pendingUploads.count)")
        
        // Notify JavaScript that batch is complete
        notifyListeners("autoUploadBatchCompleted", data: [
            "pendingUploads": pendingUploads.count,
            "timestamp": Date().timeIntervalSince1970
        ])
    }
    
    // MARK: - Background Tasks
    
    private func beginBackgroundTask() {
        guard backgroundTaskID == .invalid else { return }
        
        backgroundTaskID = UIApplication.shared.beginBackgroundTask(withName: "PhotoAutoUpload") { [weak self] in
            self?.endBackgroundTask()
        }
        
        print("🔄 Started background task for auto-upload")
    }
    
    private func endBackgroundTask() {
        guard backgroundTaskID != .invalid else { return }
        
        UIApplication.shared.endBackgroundTask(backgroundTaskID)
        backgroundTaskID = .invalid
        
        print("⏹️ Ended background task for auto-upload")
    }
    
    // MARK: - Settings Management
    
    private func loadAutoUploadSettings() {
        // Load user preferences from UserDefaults
        let defaults = UserDefaults.standard
        
        let previousEnabled = userAutoUploadEnabled
        let previousWifiOnly = wifiOnlyUpload
        
        userAutoUploadEnabled = defaults.bool(forKey: "userAutoUploadEnabled")
        wifiOnlyUpload = defaults.bool(forKey: "wifiOnlyUpload")
        
        print("📱 Auto-upload settings loaded from UserDefaults:")
        print("   userAutoUploadEnabled: \(userAutoUploadEnabled)")
        print("   wifiOnlyUpload: \(wifiOnlyUpload)")
        
        // Check if settings changed during reload
        if previousEnabled != userAutoUploadEnabled || previousWifiOnly != wifiOnlyUpload {
            print("⚠️ Settings changed during reload - emitting change event")
            emitAutoUploadSettingsChangedEvent()
        }
    }
    
    private func canUploadWithCurrentNetwork(isWifi: Bool) -> Bool {
        if wifiOnlyUpload {
            return isWifi
        }
        return true // Can upload on any connection if WiFi-only is disabled
    }
    
    // MARK: - Event Emission
    
    private func emitBridgeReadyEvent() {
        print("🌉 Emitting native:bridgeReady event to web side")
        
        // Emit a custom event to notify web that the bridge is ready
        self.notifyListeners("native:bridgeReady", data: [
            "plugin": "PhotoLibraryMonitor",
            "ready": true,
            "timestamp": Date().timeIntervalSince1970,
            "settings": [
                "userAutoUploadEnabled": userAutoUploadEnabled,
                "wifiOnlyUpload": wifiOnlyUpload,
                "systemAutoUploadEnabled": autoUploadEnabled,
                "currentEventId": currentEventId ?? ""
            ]
        ])
        
        print("✅ Bridge ready event emitted with current settings")
    }
    
    private func emitAutoUploadSettingsChangedEvent() {
        print("📡 Emitting native:autoUploadSettingsChanged event to web side")
        
        // Emit event with new settings
        self.notifyListeners("native:autoUploadSettingsChanged", data: [
            "userAutoUploadEnabled": userAutoUploadEnabled,
            "wifiOnlyUpload": wifiOnlyUpload,
            "systemAutoUploadEnabled": autoUploadEnabled,
            "currentEventId": currentEventId ?? "",
            "timestamp": Date().timeIntervalSince1970
        ])
        
        print("✅ Settings changed event emitted")
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