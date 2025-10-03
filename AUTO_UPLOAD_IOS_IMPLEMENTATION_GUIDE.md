# 📱 PhotoShare Auto-Upload iOS Implementation Guide

This document provides the complete specification for implementing auto-upload functionality on iOS to match the Android implementation, ensuring both platforms use the same backend APIs and provide consistent user experience.

## 🎯 Overview

The auto-upload system automatically uploads photos taken during event timeframes without user intervention, similar to Google Photos or iCloud Photos. It only activates when users are viewing event pages and have enabled auto-upload.

## ✅ **Latest Updates - January 2025**

**IMPORTANT:** Based on the successful Android implementation and web team feedback, the following have been confirmed:

1. **✅ Android Implementation Complete** - AutoUploadPlugin successfully registered and tested
2. **✅ Web Team Adapter Strategy Approved** - Using thin adapter functions over existing Supabase infrastructure
3. **✅ Backend APIs Deployed** - Supabase Edge Functions now live with correct URLs and authentication
4. **✅ Registration Method Confirmed** - Plugin registration must happen in `onCreate()` equivalent, not deferred
5. **✅ Web Integration Pattern** - EventAutoUploadProvider pattern approved for React integration
6. **✅ API Endpoint Confirmed** - `https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/{eventId}`
7. **✅ Authentication Verified** - Supabase JWT tokens required, not localStorage tokens

## 🏗️ Architecture Overview

**Updated based on successful Android implementation and web team requirements:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web App       │    │  iOS Native      │    │   Backend       │
│                 │    │                  │    │                 │
│ • EventAutoUpload│◄──►│ • AutoUpload     │◄──►│ • Supabase      │
│   Provider      │    │   Plugin         │    │   Edge Funcs    │
│ • Adapter Funcs │    │ • Photo Monitor  │    │ • Adapter APIs  │
│ • React Context │    │ • Background     │    │ • Existing      │
│ • Auto Context  │    │   Worker         │    │   Upload Logic  │
│   Management    │    │ • Immediate Reg  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Key Changes from Original Spec:**
- ✅ **Simplified Backend**: 3 adapter functions instead of full API rewrite
- ✅ **Immediate Registration**: Plugin registration in app startup, not deferred
- ✅ **React Provider Pattern**: EventAutoUploadProvider for automatic context management
- ✅ **Enhanced Duplicate Detection**: Leveraging existing sophisticated web logic

## 📋 Core Components to Implement

### 1. AutoUploadPlugin (Capacitor Plugin)

```swift
// AutoUploadPlugin.swift
import Capacitor
import Photos
import BackgroundTasks

@objc(AutoUploadPlugin)
public class AutoUploadPlugin: CAPPlugin {
    private var autoUploadManager: AutoUploadManager?
    
    override public func load() {
        autoUploadManager = AutoUploadManager()
        CAPLog.print("🔥 AutoUploadPlugin loaded")
    }
    
    // IMPORTANT: Based on Android success - register immediately in AppDelegate
    // Do NOT use deferred registration - it prevents plugin availability
    
    @objc func getSettings(_ call: CAPPluginCall) {
        let settings = autoUploadManager?.getSettings() ?? [:]
        call.resolve(settings)
    }
    
    @objc func setAutoUploadEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing 'enabled' parameter")
            return
        }
        
        autoUploadManager?.setAutoUploadEnabled(enabled) { success in
            if success {
                call.resolve([
                    "success": true,
                    "enabled": enabled
                ])
            } else {
                call.reject("Failed to set auto-upload enabled")
            }
        }
    }
    
    @objc func setBackgroundUploadEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing 'enabled' parameter")
            return
        }
        
        autoUploadManager?.setBackgroundUploadEnabled(enabled)
        call.resolve([
            "success": true,
            "enabled": enabled
        ])
    }
    
    @objc func setWifiOnlyUploadEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing 'enabled' parameter")
            return
        }
        
        autoUploadManager?.setWifiOnlyUploadEnabled(enabled)
        call.resolve([
            "success": true,
            "enabled": enabled
        ])
    }
    
    @objc func setCurrentEventContext(_ call: CAPPluginCall) {
        guard let eventId = call.getString("eventId"),
              let eventName = call.getString("eventName"),
              let startTime = call.getString("startTime"),
              let endTime = call.getString("endTime") else {
            call.reject("Missing required event parameters")
            return
        }
        
        autoUploadManager?.setCurrentEventContext(
            eventId: eventId,
            eventName: eventName,
            startTime: startTime,
            endTime: endTime
        ) { success in
            if success {
                call.resolve([
                    "success": true,
                    "eventId": eventId
                ])
            } else {
                call.reject("Failed to set event context")
            }
        }
    }
    
    @objc func clearCurrentEventContext(_ call: CAPPluginCall) {
        autoUploadManager?.clearCurrentEventContext()
        call.resolve(["success": true])
    }
    
    @objc func checkForNewPhotos(_ call: CAPPluginCall) {
        autoUploadManager?.checkForNewPhotos { success in
            call.resolve([
                "success": success,
                "message": success ? "Check initiated" : "Auto-upload disabled"
            ])
        }
    }
    
    @objc func getStatus(_ call: CAPPluginCall) {
        let status = autoUploadManager?.getStatus() ?? [:]
        call.resolve(status)
    }
    
    @objc func getNetworkInfo(_ call: CAPPluginCall) {
        let networkInfo = NetworkHelper.getCurrentNetworkInfo()
        call.resolve(networkInfo)
    }
}
```

### 2. AutoUploadManager (Core Logic)

```swift
// AutoUploadManager.swift
import Photos
import Network
import BackgroundTasks

class AutoUploadManager: NSObject {
    private let userDefaults = UserDefaults.standard
    private let photoLibraryObserver = PhotoLibraryObserver()
    private var backgroundTaskIdentifier: UIBackgroundTaskIdentifier = .invalid
    private var isMonitoring = false
    
    // Settings keys
    private let kAutoUploadEnabled = "auto_upload_enabled"
    private let kBackgroundUploadEnabled = "auto_upload_background_enabled"
    private let kWifiOnlyEnabled = "auto_upload_wifi_only"
    private let kCurrentEventId = "current_event_id"
    private let kCurrentEventName = "current_event_name"
    private let kCurrentEventStart = "current_event_start"
    private let kCurrentEventEnd = "current_event_end"
    private let kLastScanTime = "last_photo_scan_time"
    
    override init() {
        super.init()
        setupPhotoLibraryObserver()
        registerBackgroundTask()
    }
    
    // MARK: - Public Interface
    
    func getSettings() -> [String: Any] {
        return [
            "autoUploadEnabled": userDefaults.bool(forKey: kAutoUploadEnabled),
            "backgroundUploadEnabled": userDefaults.bool(forKey: kBackgroundUploadEnabled),
            "wifiOnlyEnabled": userDefaults.bool(forKey: kWifiOnlyEnabled)
        ]
    }
    
    func setAutoUploadEnabled(_ enabled: Bool, completion: @escaping (Bool) -> Void) {
        userDefaults.set(enabled, forKey: kAutoUploadEnabled)
        
        if enabled {
            requestPhotoPermissions { [weak self] granted in
                if granted {
                    self?.startPhotoMonitoring()
                    completion(true)
                } else {
                    completion(false)
                }
            }
        } else {
            stopPhotoMonitoring()
            completion(true)
        }
    }
    
    func setBackgroundUploadEnabled(_ enabled: Bool) {
        userDefaults.set(enabled, forKey: kBackgroundUploadEnabled)
        print("🌙 Background auto-upload \(enabled ? "enabled" : "disabled")")
    }
    
    func setWifiOnlyUploadEnabled(_ enabled: Bool) {
        userDefaults.set(enabled, forKey: kWifiOnlyEnabled)
        print("📶 WiFi-only auto-upload \(enabled ? "enabled" : "disabled")")
    }
    
    func setCurrentEventContext(eventId: String, eventName: String, startTime: String, endTime: String, completion: @escaping (Bool) -> Void) {
        userDefaults.set(eventId, forKey: kCurrentEventId)
        userDefaults.set(eventName, forKey: kCurrentEventName)
        userDefaults.set(startTime, forKey: kCurrentEventStart)
        userDefaults.set(endTime, forKey: kCurrentEventEnd)
        userDefaults.set(Date().timeIntervalSince1970, forKey: "current_event_timestamp")
        
        print("📋 Auto-upload event context set: \(eventId) (\(eventName))")
        
        // Start monitoring if auto-upload is enabled
        if userDefaults.bool(forKey: kAutoUploadEnabled) {
            startPhotoMonitoring()
        }
        
        completion(true)
    }
    
    func clearCurrentEventContext() {
        userDefaults.removeObject(forKey: kCurrentEventId)
        userDefaults.removeObject(forKey: kCurrentEventName)
        userDefaults.removeObject(forKey: kCurrentEventStart)
        userDefaults.removeObject(forKey: kCurrentEventEnd)
        userDefaults.removeObject(forKey: "current_event_timestamp")
        
        stopPhotoMonitoring()
        print("🗑️ Auto-upload event context cleared")
    }
    
    func checkForNewPhotos(completion: @escaping (Bool) -> Void) {
        guard userDefaults.bool(forKey: kAutoUploadEnabled) else {
            completion(false)
            return
        }
        
        performPhotoScan()
        completion(true)
    }
    
    func getStatus() -> [String: Any] {
        let networkInfo = NetworkHelper.getCurrentNetworkInfo()
        
        return [
            "autoUploadEnabled": userDefaults.bool(forKey: kAutoUploadEnabled),
            "backgroundUploadEnabled": userDefaults.bool(forKey: kBackgroundUploadEnabled),
            "wifiOnlyEnabled": userDefaults.bool(forKey: kWifiOnlyEnabled),
            "currentEventId": userDefaults.string(forKey: kCurrentEventId) ?? NSNull(),
            "currentEventName": userDefaults.string(forKey: kCurrentEventName) ?? NSNull(),
            "lastScanTime": userDefaults.double(forKey: kLastScanTime) * 1000, // Convert to milliseconds
            "networkConnectionType": networkInfo["networkType"] ?? "unknown"
        ]
    }
    
    // MARK: - Private Methods
    
    private func setupPhotoLibraryObserver() {
        photoLibraryObserver.delegate = self
    }
    
    private func registerBackgroundTask() {
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: "app.photoshare.auto-upload",
                using: nil
            ) { [weak self] task in
                self?.handleBackgroundUpload(task: task as! BGAppRefreshTask)
            }
        }
    }
    
    private func requestPhotoPermissions(completion: @escaping (Bool) -> Void) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        
        switch status {
        case .authorized, .limited:
            completion(true)
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                DispatchQueue.main.async {
                    completion(newStatus == .authorized || newStatus == .limited)
                }
            }
        default:
            completion(false)
        }
    }
    
    private func startPhotoMonitoring() {
        guard !isMonitoring else { return }
        
        print("👀 Starting auto-upload photo monitoring...")
        isMonitoring = true
        photoLibraryObserver.startObserving()
        
        // Check for photos added since last scan
        performPhotoScan()
    }
    
    private func stopPhotoMonitoring() {
        guard isMonitoring else { return }
        
        print("🛑 Stopping auto-upload photo monitoring")
        isMonitoring = false
        photoLibraryObserver.stopObserving()
    }
    
    private func performPhotoScan() {
        let lastScanTime = userDefaults.double(forKey: kLastScanTime)
        let currentTime = Date().timeIntervalSince1970
        
        // If never scanned, only check photos from last hour to avoid massive initial upload
        let scanFromTime = lastScanTime > 0 ? lastScanTime : currentTime - 3600
        
        print("🔍 Checking for new photos since: \(Date(timeIntervalSince1970: scanFromTime))")
        
        let photos = getPhotosSinceTimestamp(scanFromTime)
        if !photos.isEmpty {
            print("📸 Found \(photos.count) new photos for potential auto-upload")
            processNewPhotosForAutoUpload(photos)
        } else {
            print("📸 No new photos found since last scan")
        }
        
        userDefaults.set(currentTime, forKey: kLastScanTime)
    }
    
    private func getPhotosSinceTimestamp(_ timestamp: TimeInterval) -> [PHAsset] {
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "creationDate > %@", Date(timeIntervalSince1970: timestamp))
        fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        
        let assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
        var photos: [PHAsset] = []
        
        assets.enumerateObjects { asset, _, _ in
            photos.append(asset)
        }
        
        return photos
    }
    
    private func processNewPhotosForAutoUpload(_ photos: [PHAsset]) {
        guard let eventId = userDefaults.string(forKey: kCurrentEventId),
              !eventId.isEmpty else {
            print("📸 No current event context - skipping auto-upload")
            return
        }
        
        guard let startTimeString = userDefaults.string(forKey: kCurrentEventStart),
              let endTimeString = userDefaults.string(forKey: kCurrentEventEnd),
              let startTime = ISO8601DateFormatter().date(from: startTimeString),
              let endTime = ISO8601DateFormatter().date(from: endTimeString) else {
            print("📸 Invalid event time range - skipping auto-upload")
            return
        }
        
        // Filter photos by event date range
        let eventPhotos = photos.filter { photo in
            guard let creationDate = photo.creationDate else { return false }
            return creationDate >= startTime && creationDate <= endTime
        }
        
        guard !eventPhotos.isEmpty else {
            print("📸 No photos found within event timeframe")
            return
        }
        
        // Check network conditions
        if userDefaults.bool(forKey: kWifiOnlyEnabled) && !NetworkHelper.isConnectedToWiFi() {
            print("📶 WiFi-only upload enabled but not connected to WiFi - skipping auto-upload")
            return
        }
        
        print("🚀 Initiating auto-upload for \(eventPhotos.count) photos to event: \(eventId)")
        
        // Start upload process
        PhotoUploadManager.shared.uploadPhotos(eventPhotos, eventId: eventId, isAutoUpload: true)
    }
    
    @available(iOS 13.0, *)
    private func handleBackgroundUpload(task: BGAppRefreshTask) {
        guard userDefaults.bool(forKey: kBackgroundUploadEnabled) else {
            task.setTaskCompleted(success: true)
            return
        }
        
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        // Perform background photo check
        performPhotoScan()
        task.setTaskCompleted(success: true)
        
        // Schedule next background task
        scheduleBackgroundUpload()
    }
    
    @available(iOS 13.0, *)
    private func scheduleBackgroundUpload() {
        let request = BGAppRefreshTaskRequest(identifier: "app.photoshare.auto-upload")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        try? BGTaskScheduler.shared.submit(request)
    }
}

// MARK: - PhotoLibraryObserver Delegate

extension AutoUploadManager: PhotoLibraryObserverDelegate {
    func photoLibraryDidChange() {
        guard isMonitoring else { return }
        
        print("📸 Photo library changed - checking for new photos after delay")
        
        // Debounce rapid changes
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.performPhotoScan()
        }
    }
}
```

### 3. PhotoLibraryObserver

```swift
// PhotoLibraryObserver.swift
import Photos

protocol PhotoLibraryObserverDelegate: AnyObject {
    func photoLibraryDidChange()
}

class PhotoLibraryObserver: NSObject, PHPhotoLibraryChangeObserver {
    weak var delegate: PhotoLibraryObserverDelegate?
    private var isObserving = false
    
    func startObserving() {
        guard !isObserving else { return }
        
        PHPhotoLibrary.shared().register(self)
        isObserving = true
        print("📷 Started observing photo library changes")
    }
    
    func stopObserving() {
        guard isObserving else { return }
        
        PHPhotoLibrary.shared().unregisterChangeObserver(self)
        isObserving = false
        print("📷 Stopped observing photo library changes")
    }
    
    func photoLibraryDidChange(_ changeInstance: PHChange) {
        DispatchQueue.main.async { [weak self] in
            self?.delegate?.photoLibraryDidChange()
        }
    }
}
```

### 4. NetworkHelper

```swift
// NetworkHelper.swift
import Network
import SystemConfiguration

class NetworkHelper {
    static func getCurrentNetworkInfo() -> [String: Any] {
        let networkType = getCurrentNetworkType()
        
        return [
            "networkType": networkType,
            "isConnected": networkType != "none",
            "isWifi": networkType == "wifi",
            "isMobile": networkType == "mobile"
        ]
    }
    
    static func isConnectedToWiFi() -> Bool {
        return getCurrentNetworkType() == "wifi"
    }
    
    private static func getCurrentNetworkType() -> String {
        if #available(iOS 12.0, *) {
            let monitor = NWPathMonitor()
            let semaphore = DispatchSemaphore(value: 0)
            var result = "none"
            
            monitor.pathUpdateHandler = { path in
                if path.status == .satisfied {
                    if path.usesInterfaceType(.wifi) {
                        result = "wifi"
                    } else if path.usesInterfaceType(.cellular) {
                        result = "mobile"
                    } else if path.usesInterfaceType(.wiredEthernet) {
                        result = "ethernet"
                    } else {
                        result = "other"
                    }
                }
                semaphore.signal()
            }
            
            let queue = DispatchQueue(label: "NetworkMonitor")
            monitor.start(queue: queue)
            
            _ = semaphore.wait(timeout: .now() + 1.0)
            monitor.cancel()
            
            return result
        } else {
            // Fallback for iOS < 12
            return getNetworkTypeLegacy()
        }
    }
    
    private static func getNetworkTypeLegacy() -> String {
        var zeroAddress = sockaddr_in()
        zeroAddress.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        zeroAddress.sin_family = sa_family_t(AF_INET)
        
        guard let defaultRouteReachability = withUnsafePointer(to: &zeroAddress, {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                SCNetworkReachabilityCreateWithAddress(nil, $0)
            }
        }) else {
            return "none"
        }
        
        var flags: SCNetworkReachabilityFlags = []
        if !SCNetworkReachabilityGetFlags(defaultRouteReachability, &flags) {
            return "none"
        }
        
        if !flags.contains(.reachable) {
            return "none"
        }
        
        if flags.contains(.isWWAN) {
            return "mobile"
        }
        
        return "wifi"
    }
}
```

### 5. PhotoUploadManager

```swift
// PhotoUploadManager.swift
import Photos
import UIKit

class PhotoUploadManager {
    static let shared = PhotoUploadManager()
    
    private let uploadQueue = OperationQueue()
    private var activeUploads: [String: PhotoUploadOperation] = [:]
    
    private init() {
        uploadQueue.maxConcurrentOperationCount = 3
        uploadQueue.qualityOfService = .utility
    }
    
    func uploadPhotos(_ photos: [PHAsset], eventId: String, isAutoUpload: Bool = false) {
        for photo in photos {
            let operation = PhotoUploadOperation(
                asset: photo,
                eventId: eventId,
                isAutoUpload: isAutoUpload
            )
            
            operation.progressHandler = { [weak self] progress in
                self?.notifyUploadProgress(photo.localIdentifier, progress: progress)
            }
            
            operation.completionHandler = { [weak self] success, error in
                self?.handleUploadCompletion(
                    photoId: photo.localIdentifier,
                    success: success,
                    error: error
                )
            }
            
            activeUploads[photo.localIdentifier] = operation
            uploadQueue.addOperation(operation)
        }
    }
    
    private func notifyUploadProgress(_ photoId: String, progress: Float) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .photoUploadProgress,
                object: nil,
                userInfo: [
                    "photoId": photoId,
                    "progress": progress
                ]
            )
        }
    }
    
    private func handleUploadCompletion(photoId: String, success: Bool, error: Error?) {
        activeUploads.removeValue(forKey: photoId)
        
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .photoUploadCompleted,
                object: nil,
                userInfo: [
                    "photoId": photoId,
                    "success": success,
                    "error": error as Any
                ]
            )
        }
        
        if success {
            print("✅ Auto-upload completed for photo: \(photoId)")
        } else {
            print("❌ Auto-upload failed for photo: \(photoId) - \(error?.localizedDescription ?? "Unknown error")")
        }
    }
}

extension Notification.Name {
    static let photoUploadProgress = Notification.Name("PhotoUploadProgress")
    static let photoUploadCompleted = Notification.Name("PhotoUploadCompleted")
}
```

### 6. PhotoUploadOperation

```swift
// PhotoUploadOperation.swift
import Photos
import UIKit

class PhotoUploadOperation: Operation {
    private let asset: PHAsset
    private let eventId: String
    private let isAutoUpload: Bool
    
    var progressHandler: ((Float) -> Void)?
    var completionHandler: ((Bool, Error?) -> Void)?
    
    private var _isExecuting = false
    private var _isFinished = false
    
    override var isExecuting: Bool {
        return _isExecuting
    }
    
    override var isFinished: Bool {
        return _isFinished
    }
    
    override var isAsynchronous: Bool {
        return true
    }
    
    init(asset: PHAsset, eventId: String, isAutoUpload: Bool) {
        self.asset = asset
        self.eventId = eventId
        self.isAutoUpload = isAutoUpload
        super.init()
    }
    
    override func start() {
        willChangeValue(forKey: "isExecuting")
        _isExecuting = true
        didChangeValue(forKey: "isExecuting")
        
        if isCancelled {
            finish()
            return
        }
        
        uploadPhoto()
    }
    
    private func uploadPhoto() {
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        
        options.progressHandler = { [weak self] progress, _, _, _ in
            DispatchQueue.main.async {
                self?.progressHandler?(Float(progress * 0.5)) // First 50% for image loading
            }
        }
        
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { [weak self] data, uti, orientation, info in
            guard let self = self, let imageData = data else {
                self?.completionHandler?(false, PhotoUploadError.imageDataFailed)
                self?.finish()
                return
            }
            
            if self.isCancelled {
                self.finish()
                return
            }
            
            // Create upload request
            self.performUpload(imageData: imageData, uti: uti)
        }
    }
    
    private func performUpload(imageData: Data, uti: String?) {
        // Get JWT token (implement your JWT retrieval logic)
        guard let jwtToken = getJWTToken() else {
            completionHandler?(false, PhotoUploadError.noJWTToken)
            finish()
            return
        }
        
        // Create multipart request
        let boundary = UUID().uuidString
        var request = URLRequest(url: URL(string: "https://photo-share.app/api/events/\(eventId)/upload-auto")!)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderValue: "Content-Type")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderValue: "Authorization")
        
        var body = Data()
        
        // Add metadata
        let metadata: [String: Any] = [
            "fileName": asset.localIdentifier + ".jpg",
            "photoHash": generatePhotoHash(from: imageData),
            "fileSize": imageData.count,
            "dateTaken": ISO8601DateFormatter().string(from: asset.creationDate ?? Date()),
            "deviceInfo": [
                "platform": "ios",
                "autoUpload": isAutoUpload
            ]
        ]
        
        if let metadataData = try? JSONSerialization.data(withJSONObject: [metadata]) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photos\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: application/json\r\n\r\n".data(using: .utf8)!)
            body.append(metadataData)
            body.append("\r\n".data(using: .utf8)!)
        }
        
        // Add image data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photos\"; filename=\"\(asset.localIdentifier).jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        // Perform upload
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                self.completionHandler?(false, error)
                self.finish()
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                self.completionHandler?(false, PhotoUploadError.uploadFailed)
                self.finish()
                return
            }
            
            self.progressHandler?(1.0)
            self.completionHandler?(true, nil)
            self.finish()
        }
        
        task.resume()
    }
    
    private func generatePhotoHash(from data: Data) -> String {
        // Simple hash based on data size and first/last bytes
        let size = data.count
        let firstBytes = data.prefix(32)
        let lastBytes = data.suffix(32)
        
        var hasher = Hasher()
        hasher.combine(size)
        hasher.combine(firstBytes)
        hasher.combine(lastBytes)
        
        return String(hasher.finalize())
    }
    
    private func getJWTToken() -> String? {
        // Implement JWT token retrieval from your authentication system
        // This should match your existing authentication flow
        return UserDefaults.standard.string(forKey: "jwt_token")
    }
    
    private func finish() {
        willChangeValue(forKey: "isExecuting")
        willChangeValue(forKey: "isFinished")
        _isExecuting = false
        _isFinished = true
        didChangeValue(forKey: "isExecuting")
        didChangeValue(forKey: "isFinished")
    }
}

enum PhotoUploadError: Error {
    case imageDataFailed
    case noJWTToken
    case uploadFailed
    
    var localizedDescription: String {
        switch self {
        case .imageDataFailed:
            return "Failed to load image data"
        case .noJWTToken:
            return "No JWT token available"
        case .uploadFailed:
            return "Upload request failed"
        }
    }
}
```

## 📝 Capacitor Plugin Registration

### Plugin Definition

```typescript
// definitions.ts
export interface AutoUploadPlugin {
  getSettings(): Promise<{
    autoUploadEnabled: boolean;
    backgroundUploadEnabled: boolean;
    wifiOnlyEnabled: boolean;
  }>;
  
  setAutoUploadEnabled(options: { enabled: boolean }): Promise<{
    success: boolean;
    enabled: boolean;
  }>;
  
  setBackgroundUploadEnabled(options: { enabled: boolean }): Promise<{
    success: boolean;
    enabled: boolean;
  }>;
  
  setWifiOnlyUploadEnabled(options: { enabled: boolean }): Promise<{
    success: boolean;
    enabled: boolean;
  }>;
  
  setCurrentEventContext(options: {
    eventId: string;
    eventName: string;
    startTime: string;
    endTime: string;
  }): Promise<{
    success: boolean;
    eventId: string;
  }>;
  
  clearCurrentEventContext(): Promise<{
    success: boolean;
  }>;
  
  checkForNewPhotos(): Promise<{
    success: boolean;
    message: string;
  }>;
  
  getStatus(): Promise<{
    autoUploadEnabled: boolean;
    backgroundUploadEnabled: boolean;
    wifiOnlyEnabled: boolean;
    currentEventId: string | null;
    currentEventName: string | null;
    lastScanTime: number;
    networkConnectionType: string;
  }>;
  
  getNetworkInfo(): Promise<{
    networkType: string;
    isConnected: boolean;
    isWifi: boolean;
    isMobile: boolean;
  }>;
}
```

### Plugin Registration

```objc
// AutoUploadPlugin.m
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AutoUploadPlugin, "AutoUpload",
           CAP_PLUGIN_METHOD(getSettings, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setAutoUploadEnabled, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setBackgroundUploadEnabled, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setWifiOnlyUploadEnabled, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setCurrentEventContext, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearCurrentEventContext, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(checkForNewPhotos, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getNetworkInfo, CAPPluginReturnPromise);
)
```

## 🔐 iOS Permissions & Configuration

### Info.plist Configuration

```xml
<!-- Info.plist -->
<dict>
    <!-- Photo Library Access -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>PhotoShare needs access to your photos to automatically upload photos taken during events.</string>
    
    <key>NSPhotoLibraryAddUsageDescription</key>
    <string>PhotoShare needs access to save processed photos to your library.</string>
    
    <!-- Background App Refresh -->
    <key>UIBackgroundModes</key>
    <array>
        <string>background-processing</string>
        <string>background-fetch</string>
    </array>
    
    <!-- Background Task Identifiers -->
    <key>BGTaskSchedulerPermittedIdentifiers</key>
    <array>
        <string>app.photoshare.auto-upload</string>
    </array>
</dict>
```

### App Delegate Configuration

**CRITICAL UPDATE:** Based on Android success, plugin registration MUST happen immediately:

```swift
// AppDelegate.swift
import UIKit
import BackgroundTasks
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // CRITICAL: Register AutoUploadPlugin IMMEDIATELY - do NOT defer
        // This was the key fix that made Android work
        CAPBridge.registerPlugin(AutoUploadPlugin.self)
        print("✅ AutoUploadPlugin registered in AppDelegate")
        
        // Register background tasks
        if #available(iOS 13.0, *) {
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: "app.photoshare.auto-upload",
                using: nil
            ) { task in
                self.handleBackgroundUpload(task: task as! BGAppRefreshTask)
            }
        }
        
        return true
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        if #available(iOS 13.0, *) {
            scheduleBackgroundUpload()
        }
    }
    
    @available(iOS 13.0, *)
    private func scheduleBackgroundUpload() {
        let request = BGAppRefreshTaskRequest(identifier: "app.photoshare.auto-upload")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule background upload: \(error)")
        }
    }
    
    @available(iOS 13.0, *)
    private func handleBackgroundUpload(task: BGAppRefreshTask) {
        // Delegate to AutoUploadManager
        // This should be handled by the plugin
        task.setTaskCompleted(success: true)
        scheduleBackgroundUpload()
    }
}
```

## 🔄 Backend API Compatibility - Complete Auto-Upload Flow

**UPDATED:** Based on successful Android implementation, iOS should use the same **working API endpoints**:

## Complete Auto-Upload API Flow

### 1. Get User Events (Entry Point)
```swift
// WORKING ENDPOINT - Tested in Android
URL: https://photo-share.app/api/getUserEventsWithAnalytics
Method: GET
Headers: 
  - Authorization: Bearer {supabase-access-token}
  - Content-Type: application/json

Response Format:
{
  "success": true,
  "events": [
    {
      "id": "26696588-5edb-4b1e-8256-77fcdf7c089d",
      "name": "Birthday Party",
      "start_time": "2024-09-27T21:00:00Z",
      "end_time": "2024-09-28T05:00:00Z",
      "user_role": ["participant"],
      "live": true
    }
  ],
  "totalEvents": 2,
  "eligibleEvents": 1
}
```

**iOS Implementation:**
```swift
func getUserEvents(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    // Get Supabase session token (NOT JWT)
    webView?.evaluateJavaScript("""
        (async () => {
            const { supabase } = window;
            if (!supabase) return null;
            const { data: { session }, error } = await supabase.auth.refreshSession();
            return session ? session.access_token : null;
        })()
    """) { [weak self] result, error in
        guard let accessToken = result as? String else {
            completion(.failure(AuthError.noAccessToken))
            return
        }
        
        var request = URLRequest(url: URL(string: "https://photo-share.app/api/getUserEventsWithAnalytics")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Handle response
        }.resume()
    }
}
```

### 2. Check Uploaded Photos for Each Event
```swift
// WORKING ENDPOINT - Tested in Android
URL: https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/{eventId}
Method: GET
Headers: 
  - Authorization: Bearer {supabase-access-token}
  - Content-Type: application/json

Response Format:
{
  "uploadedHashes": ["sha256hash_1234567_2024-01-15T10:30:00Z", ...],
  "count": 42,
  "lastUpdated": "2024-01-15T12:00:00Z"
}
```

**iOS Implementation:**
```swift
func checkUploadedPhotos(eventId: String, completion: @escaping (Result<Set<String>, Error>) -> Void) {
    getSupabaseToken { token in
        guard let token = token else {
            completion(.failure(AuthError.noAccessToken))
            return
        }
        
        let url = "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/\(eventId)"
        var request = URLRequest(url: URL(string: url)!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Parse uploadedHashes array and return as Set<String>
        }.resume()
    }
}
```

### 3. Sequential Event Processing (Critical Pattern)

**CRITICAL:** Process events one at a time to avoid race conditions and provide proper user feedback.

```swift
func processMultipleEventsSequentially(events: [[String: Any]]) {
    processEventAtIndex(0, events: events)
}

private func processEventAtIndex(_ index: Int, events: [[String: Any]]) {
    guard index < events.count else {
        hideScanningOverlay()
        print("✅ Completed auto-upload check for all events")
        return
    }
    
    let event = events[index]
    let eventId = event["id"] as? String ?? "unknown"
    let eventName = event["name"] as? String ?? "Unknown Event"
    
    // CRITICAL: Show progress overlay with animated dots
    showScanningOverlay(
        message: "Scanning photos for event \(index + 1) of \(events.count)",
        subMessage: eventName
    )
    
    scanPhotosForEvent(event) { [weak self] photosToUpload in
        guard let self = self else { return }
        
        if photosToUpload.count > 0 {
            print("📸 Found \(photosToUpload.count) photos to upload for event: \(eventId)")
            self.uploadPhotos(photosToUpload, for: event) { success in
                // Process next event after upload completes
                self.processEventAtIndex(index + 1, events: events)
            }
        } else {
            // No photos to upload, move to next event immediately
            print("📸 No photos to upload for event: \(eventId)")
            self.processEventAtIndex(index + 1, events: events)
        }
    }
}
```

### 4. Photo Upload Endpoint
```swift
// WORKING ENDPOINT - Tested in Android
URL: https://photo-share.app/api/mobile-upload
Method: POST
Content-Type: multipart/form-data
Authorization: Bearer {jwt-token}  // NOTE: Use JWT for uploads, Supabase for queries

Form Data:
- photos: [JSON metadata array]
- file attachments: actual photo files

Response Format:
{
  "success": true,
  "uploaded": 3,
  "failed": 0,
  "results": [...]
}
```

**iOS Implementation:**
```swift
func uploadPhotos(_ photos: [PHAsset], eventId: String, completion: @escaping (Bool) -> Void) {
    getJWTToken { [weak self] jwtToken in
        guard let jwtToken = jwtToken else {
            completion(false)
            return
        }
        
        let url = "https://photo-share.app/api/mobile-upload"
        var request = URLRequest(url: URL(string: url)!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        
        // Create multipart form data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        // Build request body with photos
        self?.buildMultipartBody(photos: photos, eventId: eventId, boundary: boundary) { body in
            request.httpBody = body
            
            URLSession.shared.dataTask(with: request) { data, response, error in
                // Handle upload response
                completion(error == nil)
            }.resume()
        }
    }
}
```

## 🎯 Auto-Upload Flow Architecture

```swift
// Complete auto-upload flow implementation
func performAutoUploadCheck() {
    showScanningOverlay(message: "Checking for user events", subMessage: nil)
    
    getUserEvents { [weak self] result in
        guard let self = self else { return }
        
        switch result {
        case .success(let eventsData):
            guard let events = eventsData["events"] as? [[String: Any]], !events.isEmpty else {
                self.hideScanningOverlay()
                print("📸 No events found for auto-upload")
                return
            }
            
            print("🔍 Found \(events.count) events to check for auto-upload")
            self.processMultipleEventsSequentially(events: events)
            
        case .failure(let error):
            self.hideScanningOverlay()
            print("❌ Failed to get user events: \(error)")
        }
    }
}
```

**Authentication Requirements:**
- **Supabase Tokens**: For API queries (`getUserEvents`, `checkUploadedPhotos`)
- **JWT Tokens**: For upload operations (`uploadPhotos`)
- Get from `window.supabase.auth.session().access_token` for Supabase
- Get from `window.getJwtTokenForNativePlugin()` for JWT
- User must be participant in the event
- Implement 5-minute JWT validation buffer to avoid unnecessary refreshes

### 2. Duplicate Check Endpoint (Adapter)
```
GET /api/events/{eventId}/uploaded-photos

// Response format (compatible with existing iOS duplicate detection):
{
  uploadedHashes: ["hash1_size1_date1", "hash2_size2_date2", ...],
  count: 42,
  lastUpdated: "2024-12-24T10:00:00Z"
}

// This adapter internally calls existing Supabase edge function:
// supabase/functions/get-uploaded-photos/index.ts
```

### 3. Progress Tracking Endpoint (Adapter)
```
POST /api/events/{eventId}/upload-progress

// Request body:
{
  photoId: string,
  fileName: string,
  status: 'uploading' | 'completed' | 'failed',
  progress: number, // 0-100
  error?: string
}

// This adapter internally calls existing Supabase edge function:
// supabase/functions/upload-status-get/index.ts
```

## 🎯 **Key Advantages of Adapter Approach:**

✅ **Minimal Backend Work** - 3 thin adapters vs full API rewrite  
✅ **Preserve Existing Logic** - Leverages sophisticated duplicate detection  
✅ **Fast Implementation** - Web team can build adapters quickly  
✅ **Same Interface** - iOS gets identical API to Android  
✅ **Future-Proof** - Easy to enhance adapters without mobile changes

## 🚀 **Android Implementation Success - Reference for iOS**

**The Android AutoUploadPlugin has been successfully implemented and tested. iOS team can reference this working implementation:**

### ✅ Confirmed Working Features:

1. **Plugin Registration**: AutoUploadPlugin successfully registers in MainActivity onCreate()
2. **Web Bridge Integration**: All methods communicate properly with web interface
3. **API Connectivity**: Successfully connects to deployed Supabase endpoint
4. **JWT Authentication**: Properly handles Supabase JWT token authentication
5. **Settings Management**: Auto-upload settings sync between native and web

### 📋 Working Android Methods (iOS Equivalent Needed):

```javascript
// All tested and working in Android APK:
await Capacitor.Plugins.AutoUpload.checkWebBridgeAvailability()  // ✅
await Capacitor.Plugins.AutoUpload.callWebBridgeIsAvailable()    // ✅
await Capacitor.Plugins.AutoUpload.syncWithWebBridge()          // ✅
await Capacitor.Plugins.AutoUpload.getUploadedPhotos({eventId}) // ✅
await Capacitor.Plugins.AutoUpload.getStatus()                  // ✅
await Capacitor.Plugins.AutoUpload.getNetworkInfo()             // ✅
```

### 🔧 Critical Implementation Details from Android Success:

1. **Immediate Registration**: Register plugin in AppDelegate immediately, not deferred
2. **Main UI Thread**: All WebView JavaScript execution must happen on main thread
3. **Proper JSON Handling**: Avoid nested JSON.stringify() calls
4. **Supabase JWT**: Use `window.supabase.auth.session().access_token`, not localStorage
5. **Error Handling**: Return structured responses instead of throwing exceptions

### 📱 iOS Implementation Reference:

```swift
// AppDelegate.swift - CRITICAL: Register immediately
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // CRITICAL: Register AutoUploadPlugin IMMEDIATELY - do NOT defer
    // This was the key fix that made Android work
    CAPBridge.registerPlugin(AutoUploadPlugin.self)
    print("✅ AutoUploadPlugin registered in AppDelegate")
    return true
}
```

## 🧪 Testing Strategy - Based on Android Implementation Results

### Phase 1: Foundation Testing ✅ **VERIFIED IN ANDROID**
- [x] **Plugin Registration**: Tested in MainActivity.onCreate() - Plugin successfully registered and visible in `Capacitor.Plugins.AutoUpload`
- [x] **Plugin Availability**: Confirmed with `window.Capacitor.Plugins.AutoUpload !== undefined`
- [x] **Method Exposure**: All plugin methods accessible from JavaScript bridge
- [x] **WebView Integration**: JavaScript evaluation works correctly on main UI thread

**Android Test Results**: 
- Plugin registration: ✅ Immediate registration in onCreate() works
- Method availability: ✅ All 8 plugin methods exposed correctly
- Bridge communication: ✅ Bi-directional communication functional

### Phase 2: Authentication & API Testing ✅ **VERIFIED IN ANDROID**
- [x] **Supabase Token Retrieval**: Successfully gets access tokens from `window.supabase.auth.session()`
- [x] **API Connectivity**: Confirmed connection to `https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/{eventId}`
- [x] **JWT Token Management**: Implemented token validation with 5-minute buffer to prevent unnecessary refreshes
- [x] **Race Condition Prevention**: Singleton pattern prevents concurrent JWT requests

**Android Test Results**:
- API endpoint: ✅ Successfully connects to Supabase edge function
- Authentication: ✅ Supabase tokens work, JWT tokens work for uploads
- Token validation: ✅ Prevents unnecessary token refreshes
- Concurrency: ✅ No race conditions with multiple events

### Phase 3: Multi-Event Processing ✅ **VERIFIED IN ANDROID**
- [x] **Event Detection**: Successfully calls `/api/getUserEventsWithAnalytics` 
- [x] **Sequential Processing**: Events processed one at a time to avoid conflicts
- [x] **Progress Overlays**: Scanning overlay shows during photo checking with animated dots
- [x] **Proper Closures**: Fixed JavaScript closure bug that caused all events to use same eventId

**Android Test Results**:
- Multi-event support: ✅ Handles 3+ concurrent events correctly
- Progress feedback: ✅ Scanning overlay with "Event X of Y" messaging
- JavaScript closures: ✅ IIFE pattern prevents variable capture issues
- Memory management: ✅ No memory leaks during event processing

### Phase 4: Photo Detection & Timezone Testing ✅ **VERIFIED IN ANDROID**
- [x] **UTC Date Parsing**: Fixed critical 7-hour timezone offset bug
- [x] **MediaStore Integration**: Successfully scans Android MediaStore for photos
- [x] **Date Range Filtering**: Only photos within event timeframe are detected
- [x] **Duplicate Detection**: Photos already uploaded are properly filtered out

**Android Test Results**:
- Timezone handling: ✅ UTC parsing fixed 7-hour offset (was missing 7 photos, now finds all)
- Photo scanning: ✅ Correctly identifies photos taken during event dates
- Duplicate prevention: ✅ Hash-based system prevents re-uploads
- Performance: ✅ Efficient scanning of large photo libraries (1000+ photos)

### Phase 5: Upload & Progress Testing ✅ **VERIFIED IN ANDROID**
- [x] **Photo Upload**: Successfully uploads photos to `/api/mobile-upload`
- [x] **Progress Tracking**: Real-time upload progress with overlay feedback
- [x] **Error Handling**: Robust error handling with structured responses
- [x] **Notification Banners**: Success notifications without formatting issues (removed brackets)

**Android Test Results**:
- Upload success: ✅ Photos successfully uploaded to events
- Progress feedback: ✅ Upload overlay with progress indicators
- Error recovery: ✅ Graceful handling of network failures
- User feedback: ✅ Clear success/failure notifications

### Phase 6: App Lifecycle Testing ✅ **VERIFIED IN ANDROID**
- [x] **App Resume Trigger**: Auto-upload triggers when app becomes active (onResume)
- [x] **Background Compatibility**: Works with app in background/foreground
- [x] **Memory Management**: Proper cleanup when app is suspended
- [x] **Network Awareness**: Respects WiFi-only settings

**Android Test Results**:
- App resume: ✅ Auto-upload triggers correctly on app activation
- Background processing: ✅ Compatible with Android background restrictions
- Network handling: ✅ Proper WiFi/cellular detection
- Resource management: ✅ No battery drain or memory issues

### Phase 7: Real-World User Testing ✅ **VERIFIED IN ANDROID**
- [x] **Live Event Testing**: Tested with actual events and real photos
- [x] **Performance Under Load**: Tested with 1000+ photos in library
- [x] **Network Conditions**: Tested on WiFi and cellular connections
- [x] **Multiple Users**: Tested event switching and multi-user scenarios

**Android Test Results**:
- Real usage: ✅ Successfully detected and uploaded 7 photos from live event
- Performance: ✅ Fast scanning even with large photo libraries
- Network reliability: ✅ Robust handling of connection changes
- User experience: ✅ Smooth, non-intrusive auto-upload flow

## 🔍 Specific Test Cases That Must Pass in iOS

Based on our Android debugging experience, these specific test cases are critical:

### 1. Timezone Test (Critical!)
```swift
// Test that prevented 7-hour offset bug
let eventStart = "2025-09-27T21:00:00"  // UTC
let photoTaken = Date() // September 27, 2025 at 9:39 PM PT (4:39 AM UTC Sept 28)
// Photo should NOT be included if parsed as local time
// Photo SHOULD be included if parsed as UTC
```

### 2. Multi-Event Closure Test
```swift
// Test that prevented eventId variable capture bug
let events = [
    ["id": "event1", "name": "Party 1"],
    ["id": "event2", "name": "Party 2"], 
    ["id": "event3", "name": "Party 3"]
]
// Each event must process with correct eventId, not all using "event3"
```

### 3. JWT Token Race Condition Test
```swift
// Test concurrent token requests
DispatchQueue.concurrentPerform(iterations: 5) { i in
    JWTManager.shared.getValidToken { token in
        // All 5 requests should get same token, not trigger 5 separate fetches
    }
}
```

### 4. Progress Overlay Animation Test
```swift
// Test animated dots without hardcoded ellipses
let baseMessage = "Scanning photos for event 1 of 3"  // No dots
// Should animate: "....", "..", "...", ".", "..", "..."
// NOT: ".....", "....", "....."
```

### 5. App Resume Trigger Test
```swift
// Test auto-upload on app becoming active
// 1. Background app
// 2. Take photo during event
// 3. Bring app to foreground
// 4. Auto-upload should trigger and find new photo
```

## 📊 Performance Considerations

### Memory Management
- Use `PHImageRequestOptions` with appropriate delivery modes
- Process photos one at a time to avoid memory spikes
- Cancel operations when app is backgrounded
- Implement proper operation queue management

### Battery Optimization
- Use `QualityOfService.utility` for upload operations
- Respect system battery level
- Implement exponential backoff for failed uploads
- Minimize photo library scanning frequency

### Network Efficiency
- Implement upload resumption for large photos
- Use compression for photos when appropriate
- Batch multiple photos in single requests when possible
- Respect user's cellular data preferences

## 🔍 Debugging & Monitoring

### Debug Logging
```swift
// Add comprehensive logging throughout
print("🔥 AutoUpload: [EVENT] Description")
print("📸 PhotoScan: [DETAILS] Status")
print("🚀 Upload: [PROGRESS] Information")
print("❌ Error: [ERROR] Details")
```

### Analytics Events
- Auto-upload enabled/disabled
- Photos detected and uploaded
- Upload success/failure rates
- Background processing efficiency
- Network condition impacts

## 🚀 Implementation Timeline

**Week 1-2:** Core plugin structure and basic settings
**Week 3-4:** Photo monitoring and event context
**Week 5-6:** Upload functionality and progress tracking  
**Week 7-8:** Background processing and optimization
**Week 9-10:** Testing, debugging, and polish

## 🔥 CRITICAL ANDROID LEARNINGS FOR iOS IMPLEMENTATION

### 1. Authentication Bug (JWT vs Supabase)
**Android Issue Found**: Initially used JWT tokens for all API calls, resulted in 401/403 errors.
**Solution**: Use Supabase session tokens for API queries, JWT only for uploads.

**iOS Implementation**:
```swift
// CORRECT: Use Supabase tokens for API queries
func getUserEvents(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    webView?.evaluateJavaScript("""
        (async () => {
            const { supabase } = window;
            if (!supabase) return null;
            const { data: { session }, error } = await supabase.auth.refreshSession();
            return session ? session.access_token : null;
        })()
    """) { [weak self] result, error in
        guard let accessToken = result as? String else {
            completion(.failure(AuthError.noAccessToken))
            return
        }
        // Use accessToken for API calls
        self?.makeAPIRequest(token: accessToken, completion: completion)
    }
}
```

### 2. Timezone Parsing Bug (7-Hour Offset)
**Android Issue Found**: Parsing UTC event times as local time caused photos to be missed.
**Solution**: Always set timezone to UTC when parsing event dates.

**iOS Implementation**:
```swift
// CRITICAL: Always parse event dates as UTC
private func parseEventDate(_ dateString: String) -> Date? {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
    formatter.timeZone = TimeZone(identifier: "UTC")  // CRITICAL!
    return formatter.date(from: dateString)
}

// Photo timestamps from iOS Photos are already correct - no conversion needed
func filterPhotosForEvent(photos: [PHAsset], startDate: Date, endDate: Date) -> [PHAsset] {
    return photos.filter { asset in
        guard let creationDate = asset.creationDate else { return false }
        return creationDate >= startDate && creationDate <= endDate
    }
}
```

### 3. JavaScript Closure Bug in Multi-Event Processing
**Android Issue Found**: Loop variable captured incorrectly, all events used same eventId.
**Solution**: Use IIFE (Immediately Invoked Function Expression) pattern.

**iOS Implementation**:
```swift
// Process events with proper closure handling
func processMultipleEvents(_ events: [[String: Any]]) {
    for (index, event) in events.enumerated() {
        // Process each event with proper context isolation
        processEvent(event, at: index, total: events.count) { [weak self] success in
            // Handle completion for this specific event
            print("Event \(event["id"] ?? "unknown") processed: \(success)")
        }
    }
}
```

### 4. JWT Token Management with Race Conditions
**Android Issue Found**: Multiple simultaneous JWT requests interfered with each other.
**Solution**: Implement singleton pattern with concurrency control.

**iOS Implementation**:
```swift
class JWTManager {
    static let shared = JWTManager()
    
    private var currentToken: String?
    private var tokenExpiration: Date?
    private var isAcquiringToken = false
    private let tokenQueue = DispatchQueue(label: "jwt-queue", attributes: .concurrent)
    
    func getValidToken(completion: @escaping (String?) -> Void) {
        tokenQueue.async(flags: .barrier) { [weak self] in
            guard let self = self else {
                DispatchQueue.main.async { completion(nil) }
                return
            }
            
            // Check if current token is valid (5-minute buffer)
            if let token = self.currentToken,
               let expiration = self.tokenExpiration,
               Date().addingTimeInterval(5 * 60) < expiration {
                DispatchQueue.main.async { completion(token) }
                return
            }
            
            // Prevent concurrent token acquisition
            if self.isAcquiringToken {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.getValidToken(completion: completion)
                }
                return
            }
            
            self.isAcquiringToken = true
            self.fetchNewToken { token in
                self.isAcquiringToken = false
                DispatchQueue.main.async { completion(token) }
            }
        }
    }
    
    private func fetchNewToken(completion: @escaping (String?) -> Void) {
        // Request JWT from web interface
        DispatchQueue.main.async {
            // WebView calls must be on main thread
            self.webView?.evaluateJavaScript("""
                window.getJwtTokenForNativePlugin ? 
                window.getJwtTokenForNativePlugin() : null
            """) { [weak self] result, error in
                if let token = result as? String {
                    self?.currentToken = token
                    self?.tokenExpiration = self?.parseJWTExpiration(token)
                    completion(token)
                } else {
                    completion(nil)
                }
            }
        }
    }
    
    private func parseJWTExpiration(_ jwt: String) -> Date? {
        let segments = jwt.components(separatedBy: ".")
        guard segments.count > 1 else { return nil }
        
        var base64 = segments[1]
        // Add padding if needed
        while base64.count % 4 != 0 {
            base64 += "="
        }
        
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else {
            return nil
        }
        
        return Date(timeIntervalSince1970: exp)
    }
}
```

### 5. Progress Overlay Implementation with Animated Dots
**Android Issue Found**: Initial overlay didn't match app's dark theme and used static spinner.
**Solution**: Use dark theme with animated dots cycling through 1, 2, 3 dots.

**CRITICAL UPDATE**: Fixed animated dots implementation to prevent hardcoded ellipses.

**iOS Implementation**:
```swift
class ScanningOverlay: UIView {
    private var animationTimer: Timer?
    private var dotCount = 0
    private let messageLabel = UILabel()
    private let subMessageLabel = UILabel()
    private var baseMessage: String  // CRITICAL: No hardcoded dots in base message
    
    init(message: String, subMessage: String?) {
        // CRITICAL: Remove any hardcoded ellipses from message
        self.baseMessage = message.replacingOccurrences(of: "...", with: "")
        super.init(frame: .zero)
        setupDarkThemeUI()
        if let sub = subMessage {
            subMessageLabel.text = sub
        }
        startDotAnimation()
    }
    
    private func setupDarkThemeUI() {
        backgroundColor = UIColor(white: 0, alpha: 0.8)  // Dark overlay to match upload overlay
        
        // Close button (✕)
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = .systemFont(ofSize: 20, weight: .medium)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(closeOverlay), for: .touchUpInside)
        
        // Message label with animated dots
        messageLabel.textColor = .white
        messageLabel.font = .systemFont(ofSize: 16, weight: .medium)
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        
        // Sub-message label (event name)
        subMessageLabel.textColor = UIColor(white: 0.8, alpha: 1.0)
        subMessageLabel.font = .systemFont(ofSize: 14, weight: .regular)
        subMessageLabel.textAlignment = .center
        subMessageLabel.numberOfLines = 0
        
        // Layout setup
        addSubview(closeButton)
        addSubview(messageLabel)
        addSubview(subMessageLabel)
        
        // Auto Layout constraints
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        subMessageLabel.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 20),
            closeButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            closeButton.widthAnchor.constraint(equalToConstant: 30),
            closeButton.heightAnchor.constraint(equalToConstant: 30),
            
            messageLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            messageLabel.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -10),
            messageLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            messageLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            
            subMessageLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            subMessageLabel.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 8),
            subMessageLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            subMessageLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20)
        ])
    }
    
    // CRITICAL: Animated dots implementation
    private func startDotAnimation() {
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.dotCount = (self.dotCount % 3) + 1  // Cycle through 1, 2, 3 dots
            let dots = String(repeating: ".", count: self.dotCount)
            // CRITICAL: Only add animated dots, no hardcoded ellipses
            self.messageLabel.text = self.baseMessage + dots
        }
    }
    
    func updateMessage(_ message: String, subMessage: String?) {
        // Update message while preserving animation
        self.baseMessage = message.replacingOccurrences(of: "...", with: "")
        if let sub = subMessage {
            subMessageLabel.text = sub
        }
    }
    
    @objc private func closeOverlay() {
        animationTimer?.invalidate()
        removeFromSuperview()
    }
    
    deinit {
        animationTimer?.invalidate()
    }
}

// Plugin methods for overlay management
@objc func showScanningOverlay(_ call: CAPPluginCall) {
    guard let message = call.getString("message") else {
        call.reject("Missing 'message' parameter")
        return
    }
    
    let subMessage = call.getString("subMessage")
    
    DispatchQueue.main.async { [weak self] in
        // Remove any existing overlay
        self?.hideScanningOverlay(nil)
        
        // Create new overlay
        let overlay = ScanningOverlay(message: message, subMessage: subMessage)
        overlay.frame = UIScreen.main.bounds
        
        if let window = UIApplication.shared.windows.first {
            window.addSubview(overlay)
            self?.currentScanningOverlay = overlay
        }
        
        call.resolve([
            "success": true,
            "message": message,
            "overlayShown": true
        ])
    }
}

@objc func hideScanningOverlay(_ call: CAPPluginCall?) {
    DispatchQueue.main.async { [weak self] in
        self?.currentScanningOverlay?.removeFromSuperview()
        self?.currentScanningOverlay = nil
        
        call?.resolve([
            "success": true,
            "overlayHidden": true
        ])
    }
}

private var currentScanningOverlay: ScanningOverlay?
```

**Key Improvements from Android Lessons**:
1. **No Hardcoded Ellipses** - Base message has no dots, only animation adds them
2. **Proper Cycling** - Dots cycle through 1, 2, 3 (not random patterns)
3. **Dark Theme Consistency** - Matches upload overlay styling
4. **Close Button** - User can dismiss overlay manually
5. **Message Updates** - Can update message while keeping animation
6. **Memory Management** - Proper timer cleanup in deinit

### 6. Multi-Event Auto-Upload Architecture
**Android Learning**: Process events sequentially to avoid conflicts, with proper scanning overlays.

**iOS Implementation**:
```swift
func performAutoUploadCheck() {
    showScanningOverlay(message: "Checking for user events", subMessage: nil)
    
    getUserEvents { [weak self] result in
        guard let self = self else { return }
        
        switch result {
        case .success(let eventsData):
            guard let events = eventsData["events"] as? [[String: Any]], !events.isEmpty else {
                self.hideScanningOverlay()
                print("📸 No events found for auto-upload")
                return
            }
            
            print("🔍 Found \(events.count) events to check for auto-upload")
            self.processEventsSequentially(events: events, currentIndex: 0)
            
        case .failure(let error):
            self.hideScanningOverlay()
            print("❌ Failed to get user events: \(error)")
        }
    }
}

private func processEventsSequentially(events: [[String: Any]], currentIndex: Int) {
    guard currentIndex < events.count else {
        hideScanningOverlay()
        print("✅ Completed auto-upload check for all events")
        return
    }
    
    let event = events[currentIndex]
    let eventId = event["id"] as? String ?? "unknown"
    let eventName = event["name"] as? String ?? "Unknown Event"
    
    updateScanningOverlay(
        message: "Scanning photos for event \(currentIndex + 1) of \(events.count)",
        subMessage: eventName
    )
    
    checkPhotosForEvent(event) { [weak self] photosToUpload in
        guard let self = self else { return }
        
        if photosToUpload.count > 0 {
            print("📸 Found \(photosToUpload.count) photos to upload for event: \(eventId)")
            self.uploadPhotos(photosToUpload, for: event) { success in
                // Process next event after upload completes
                self.processEventsSequentially(events: events, currentIndex: currentIndex + 1)
            }
        } else {
            // No photos to upload, move to next event immediately
            print("📸 No photos to upload for event: \(eventId)")
            self.processEventsSequentially(events: events, currentIndex: currentIndex + 1)
        }
    }
}
```

### 7. Notification Banners with Proper Formatting
**Android Issue Found**: Event names wrapped in square brackets in notifications showing `[EventName]` instead of `EventName`.
**Solution**: Format event names properly and remove any array brackets from display.

**iOS Implementation**:
```swift
func showUploadSuccessNotification(eventName: String, photoCount: Int) {
    // CRITICAL: Clean event name of any array formatting
    let cleanEventName = eventName
        .replacingOccurrences(of: "[", with: "")
        .replacingOccurrences(of: "]", with: "")
        .trimmingCharacters(in: .whitespaces)
    
    let content = UNMutableNotificationContent()
    content.title = "PhotoShare"
    content.body = "Successfully uploaded \(photoCount) photo\(photoCount == 1 ? "" : "s") to \(cleanEventName)"
    content.sound = .default
    
    // Add custom data for potential tap handling
    content.userInfo = [
        "type": "upload_success",
        "eventName": cleanEventName,
        "photoCount": photoCount
    ]
    
    let request = UNNotificationRequest(
        identifier: "upload-success-\(UUID().uuidString)",
        content: content,
        trigger: nil
    )
    
    UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
            print("❌ Failed to show notification: \(error)")
        } else {
            print("✅ Upload success notification shown: \(photoCount) photos to \(cleanEventName)")
        }
    }
}

func showUploadProgressNotification(eventName: String, current: Int, total: Int) {
    let cleanEventName = eventName
        .replacingOccurrences(of: "[", with: "")
        .replacingOccurrences(of: "]", with: "")
        .trimmingCharacters(in: .whitespaces)
    
    let content = UNMutableNotificationContent()
    content.title = "PhotoShare"
    content.body = "Uploading \(current) of \(total) photos to \(cleanEventName)"
    content.sound = nil  // Silent for progress updates
    
    // Update existing notification with same identifier
    let request = UNNotificationRequest(
        identifier: "upload-progress-\(cleanEventName)",
        content: content,
        trigger: nil
    )
    
    UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
            print("❌ Failed to update progress notification: \(error)")
        }
    }
}

func showAutoUploadStartNotification(eventCount: Int) {
    let content = UNMutableNotificationContent()
    content.title = "PhotoShare"
    content.body = "Checking \(eventCount) event\(eventCount == 1 ? "" : "s") for photos to upload"
    content.sound = nil
    
    let request = UNNotificationRequest(
        identifier: "auto-upload-start",
        content: content,
        trigger: nil
    )
    
    UNUserNotificationCenter.current().add(request) { error in
        if let error = error {
            print("❌ Failed to show auto-upload start notification: \(error)")
        }
    }
}

// Helper to remove upload progress notifications when complete
func clearUploadProgressNotifications() {
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
        let progressIdentifiers = requests
            .filter { $0.identifier.hasPrefix("upload-progress-") }
            .map { $0.identifier }
        
        if !progressIdentifiers.isEmpty {
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: progressIdentifiers)
            print("🧹 Cleared \(progressIdentifiers.count) progress notifications")
        }
    }
}
```

### 8. App Resume Trigger Implementation
**Android Learning**: Auto-upload triggers on app resume (onResume), not just app launch.

**iOS Implementation**:
```swift
// AppDelegate.swift or SceneDelegate.swift
func applicationDidBecomeActive(_ application: UIApplication) {
    // Trigger auto-upload check when app becomes active
    if let autoUploadPlugin = CAPBridge.getPlugin("AutoUpload") as? AutoUploadPlugin {
        autoUploadPlugin.triggerAutoUploadCheck()
    }
}

// In AutoUploadPlugin.swift
func triggerAutoUploadCheck() {
    guard autoUploadManager.isAutoUploadEnabled() else {
        print("📸 Auto-upload disabled, skipping check")
        return
    }
    
    print("🔄 App became active - triggering auto-upload check")
    performAutoUploadCheck()
}
```

### 9. Error Handling Best Practices
**Android Learning**: Return structured responses instead of throwing exceptions, use consistent logging.

**iOS Implementation**:
```swift
@objc func checkUploadedPhotos(_ call: CAPPluginCall) {
    guard let eventId = call.getString("eventId") else {
        call.resolve([
            "success": false,
            "error": "Missing eventId parameter",
            "uploadedHashes": []
        ])
        return
    }
    
    getSupabaseToken { [weak self] token in
        guard let token = token else {
            call.resolve([
                "success": false,
                "error": "Failed to get authentication token",
                "uploadedHashes": []
            ])
            return
        }
        
        self?.fetchUploadedPhotos(eventId: eventId, token: token) { result in
            switch result {
            case .success(let hashes):
                call.resolve([
                    "success": true,
                    "uploadedHashes": hashes,
                    "count": hashes.count
                ])
            case .failure(let error):
                call.resolve([
                    "success": false,
                    "error": error.localizedDescription,
                    "uploadedHashes": []
                ])
            }
        }
    }
}
```

### 10. Plugin Registration Timing
**Android Critical Success Factor**: Register plugin immediately in MainActivity.onCreate(), not deferred.

**iOS Implementation**:
```swift
// AppDelegate.swift - CRITICAL
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // CRITICAL: Register AutoUploadPlugin IMMEDIATELY
    // Do NOT defer registration - this was key to Android success
    CAPBridge.registerPlugin(AutoUploadPlugin.self)
    print("✅ AutoUploadPlugin registered immediately in AppDelegate")
    
    return true
}
```

## 🔗 COMPLETE API DOCUMENTATION

**VERIFIED:** All endpoints tested and working in Android implementation. Use these exact specifications for iOS.

### 1. Get User Events API

**Endpoint:** `https://photo-share.app/api/getUserEventsWithAnalytics`  
**Method:** GET  
**Authentication:** Supabase Access Token (NOT JWT)

**Request Headers:**
```http
Authorization: Bearer {supabase-access-token}
Content-Type: application/json
```

**Swift Implementation:**
```swift
func getUserEvents(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    // Get Supabase session token (NOT JWT)
    webView?.evaluateJavaScript("""
        (async () => {
            const { supabase } = window;
            if (!supabase) return null;
            const { data: { session }, error } = await supabase.auth.refreshSession();
            return session?.access_token || null;
        })();
    """) { result, error in
        guard let accessToken = result as? String else {
            completion(.failure(AuthError.noAccessToken))
            return
        }
        
        var request = URLRequest(url: URL(string: "https://photo-share.app/api/getUserEventsWithAnalytics")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Parse JSON response
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                completion(.success(json))
            } else {
                completion(.failure(error ?? APIError.invalidResponse))
            }
        }.resume()
    }
}
```

**Response Format:**
```json
{
  "success": true,
  "events": [
    {
      "id": "26696588-5edb-4b1e-8256-77fcdf7c089d",
      "name": "Birthday Party",
      "start_time": "2024-09-27T21:00:00Z",
      "end_time": "2024-09-28T04:00:00Z", 
      "status": "live",
      "participant_role": "guest",
      "auto_upload_enabled": true
    }
  ],
  "total_events": 1,
  "user_id": "user_12345"
}
```

### 2. Check Uploaded Photos API

**Endpoint:** `https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/{eventId}`  
**Method:** GET  
**Authentication:** Supabase Access Token (NOT JWT)

**Swift Implementation:**
```swift
func checkUploadedPhotos(eventId: String, completion: @escaping (Result<Set<String>, Error>) -> Void) {
    getSupabaseToken { token in
        guard let token = token else {
            completion(.failure(AuthError.noToken))
            return
        }
        
        let url = "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-events-uploaded-photos/\(eventId)"
        var request = URLRequest(url: URL(string: url)!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let photos = json["photos"] as? [[String: Any]] {
                
                let hashes = Set(photos.compactMap { $0["hash"] as? String })
                completion(.success(hashes))
            } else {
                completion(.failure(error ?? APIError.invalidResponse))
            }
        }.resume()
    }
}
```

**Response Format:**
```json
{
  "success": true,
  "photos": [
    {
      "id": "photo_123",
      "hash": "sha256:abc123def456...",
      "filename": "IMG_20240927_140922.jpg",
      "uploaded_at": "2024-09-27T22:10:15Z"
    },
    {
      "id": "photo_456", 
      "hash": "sha256:ghi789jkl012...",
      "filename": "IMG_20240927_151033.jpg",
      "uploaded_at": "2024-09-27T22:12:30Z"
    }
  ],
  "total_photos": 2,
  "event_id": "26696588-5edb-4b1e-8256-77fcdf7c089d"
}
```

### 3. Photo Upload API

**Endpoint:** `https://photo-share.app/api/mobile-upload`  
**Method:** POST  
**Authentication:** JWT Token (NOT Supabase token)  
**Content-Type:** multipart/form-data

**Swift Implementation:**
```swift
func uploadPhoto(eventId: String, photoData: Data, filename: String, completion: @escaping (Bool) -> Void) {
    // Get JWT token (NOT Supabase token)
    webView?.evaluateJavaScript("window.getJwtTokenForNativePlugin()") { jwtResult, error in
        guard let jwtToken = jwtResult as? String else {
            completion(false)
            return
        }
        
        let url = "https://photo-share.app/api/mobile-upload"
        var request = URLRequest(url: URL(string: url)!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        
        // Create multipart form data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add eventId field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"eventId\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(eventId)\r\n".data(using: .utf8)!)
        
        // Add filename field  
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"filename\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(filename)\r\n".data(using: .utf8)!)
        
        // Add mediaType field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"mediaType\"\r\n\r\n".data(using: .utf8)!)
        body.append("image/jpeg\r\n".data(using: .utf8)!)
        
        // Add file field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(photoData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let httpResponse = response as? HTTPURLResponse {
                completion(httpResponse.statusCode == 200)
            } else {
                completion(false)
            }
        }.resume()
    }
}
```

**Response Format (Success):**
```json
{
  "success": true,
  "photo": {
    "id": "photo_xyz789",
    "filename": "IMG_20240927_140922.jpg",
    "eventId": "26696588-5edb-4b1e-8256-77fcdf7c089d",
    "uploadedAt": "2024-09-27T22:15:45Z",
    "fileSize": 3247891,
    "hash": "sha256:abc123def456..."
  },
  "message": "Photo uploaded successfully"
}
```

### 4. JWT Token Management

**JavaScript Function:** `window.getJwtTokenForNativePlugin()`  
**Returns:** JWT token string

**Swift Implementation with Validation:**
```swift
private var currentJWT: String?
private var jwtAcquisitionInProgress = false

func getValidJwtToken(completion: @escaping (String?) -> Void) {
    // Prevent concurrent JWT requests
    guard !jwtAcquisitionInProgress else {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.getValidJwtToken(completion: completion)
        }
        return
    }
    
    // Check if current JWT is still valid (5-minute buffer)
    if let existingJWT = currentJWT, isJwtTokenValid(existingJWT) {
        completion(existingJWT)
        return
    }
    
    jwtAcquisitionInProgress = true
    
    // Get fresh JWT token
    webView?.evaluateJavaScript("window.getJwtTokenForNativePlugin()") { result, error in
        defer { self.jwtAcquisitionInProgress = false }
        
        if let jwtToken = result as? String {
            self.currentJWT = jwtToken
            completion(jwtToken)
        } else {
            completion(nil)
        }
    }
}

private func isJwtTokenValid(_ jwtToken: String) -> Bool {
    // Decode JWT payload to check expiration
    let components = jwtToken.components(separatedBy: ".")
    guard components.count == 3,
          let payloadData = Data(base64URLEncoded: components[1]),
          let payload = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any],
          let exp = payload["exp"] as? TimeInterval else {
        return false
    }
    
    let expirationTime = exp * 1000 // Convert to milliseconds
    let currentTime = Date().timeIntervalSince1970 * 1000
    let timeUntilExpiry = expirationTime - currentTime
    
    // 5-minute buffer before expiration
    return timeUntilExpiry > (5 * 60 * 1000)
}
```

### 5. Sequential Event Processing Pattern

**CRITICAL:** Process events one at a time to avoid race conditions and JWT conflicts.

```swift
func processEventsSequentially(events: [[String: Any]], completion: @escaping () -> Void) {
    guard !events.isEmpty else {
        completion()
        return
    }
    
    var eventIndex = 0
    
    func processNextEvent() {
        guard eventIndex < events.count else {
            completion()
            return
        }
        
        let event = events[eventIndex]
        let eventId = event["id"] as? String ?? ""
        let eventName = event["name"] as? String ?? ""
        
        // Update scanning overlay with current progress
        showScanningOverlay(
            message: "Scanning photos for event \(eventIndex + 1) of \(events.count)",
            subMessage: eventName
        )
        
        // Process this single event
        processEventPhotos(event: event) { [weak self] in
            eventIndex += 1
            
            // Process next event after current one completes
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                processNextEvent()
            }
        }
    }
    
    processNextEvent()
}
```

### 6. Animated Dots Overlay Implementation

**Enhancement:** Replace static spinner with animated dots for better UX.

```swift
private var animationTimer: Timer?
private var dotCount = 1

func showScanningOverlay(message: String, subMessage: String?) {
    DispatchQueue.main.async { [weak self] in
        guard let self = self else { return }
        
        // Create overlay if needed
        if self.scanningOverlay == nil {
            self.setupScanningOverlay()
        }
        
        // Set base message without dots
        self.baseScanningMessage = message
        self.scanningSubLabel?.text = subMessage
        
        // Start dot animation
        self.startDotAnimation()
        
        self.scanningOverlay?.isHidden = false
    }
}

private func startDotAnimation() {
    stopDotAnimation() // Stop any existing animation
    
    animationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
        guard let self = self else { return }
        
        var dots = ""
        for _ in 0..<self.dotCount {
            dots += "."
        }
        
        self.scanningLabel?.text = "\(self.baseScanningMessage)\(dots)"
        
        // Cycle through 1, 2, 3 dots
        self.dotCount = (self.dotCount % 3) + 1
    }
}

private func stopDotAnimation() {
    animationTimer?.invalidate()
    animationTimer = nil
    dotCount = 1
}
```

### API Authentication Summary

| API Endpoint | Token Type | JavaScript Function |
|-------------|------------|-------------------|
| `getUserEventsWithAnalytics` | Supabase Access Token | `window.supabase.auth.refreshSession()` |
| `api-events-uploaded-photos/{eventId}` | Supabase Access Token | `window.supabase.auth.refreshSession()` |
| `mobile-upload` | JWT Token | `window.getJwtTokenForNativePlugin()` |

**CRITICAL NOTES:**
- ✅ Use Supabase tokens for ALL data queries
- ✅ Use JWT tokens ONLY for photo uploads  
- ✅ Implement 5-minute buffer for JWT validation
- ✅ Process events sequentially to avoid conflicts
- ✅ Use animated dots instead of static spinners

## 🚨 CRITICAL PITFALLS TO AVOID

1. **DON'T** defer plugin registration - register immediately in AppDelegate
2. **DON'T** use JWT tokens for API queries - use Supabase session tokens  
3. **DON'T** parse UTC dates as local time - always set UTC timezone
4. **DON'T** use regular closure patterns in loops - use IIFE or sequential processing
5. **DON'T** allow concurrent JWT token requests - implement singleton pattern
6. **DON'T** use spinner animations - use animated dots for better UX
7. **DON'T** process events in parallel - use sequential processing to avoid conflicts
8. **DON'T** wrap event names in brackets for notifications - format cleanly
9. **DON'T** only trigger on app launch - also trigger on app resume
10. **DON'T** throw exceptions in plugin methods - return structured error responses

This implementation guide provides iOS developers with everything needed to create auto-upload functionality that matches the Android version and uses the same backend APIs for consistency across platforms.