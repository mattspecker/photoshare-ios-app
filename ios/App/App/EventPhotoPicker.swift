import Foundation
import Photos
import Capacitor
import UIKit
import WebKit
import UserNotifications
import CryptoKit

@objc(EventPhotoPicker)
public class EventPhotoPicker: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EventPhotoPicker"
    public let jsName = "EventPhotoPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openEventPhotoPicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openRegularPhotoPicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showEventInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEventPhotosMetadata", returnType: CAPPluginReturnPromise)
    ]
    private var currentPickerViewController: EventPhotoPickerViewController?
    private var currentJwtToken: String?
    private var currentEventId: String?
    
    override public func load() {
        super.load()
        NSLog("🎯 EventPhotoPicker plugin loaded successfully!")
        NSLog("🎯 Plugin ID: %@", self.pluginId)
        NSLog("🎯 Plugin available methods: openEventPhotoPicker, getEventPhotosMetadata, showEventInfo")
        NSLog("🎯 EventPhotoPicker class: %@", NSStringFromClass(type(of: self)))
        
        print("🎯 EventPhotoPicker plugin loaded successfully!")
        print("🎯 Plugin ID: \(self.pluginId)")
        print("🎯 Plugin available methods: openEventPhotoPicker, getEventPhotosMetadata, showEventInfo")
        
        // Register plugin availability notification
        NotificationCenter.default.post(
            name: NSNotification.Name("EventPhotoPickerLoaded"),
            object: self
        )
    }
    
    private func fetchUploadedPhotos(eventId: String, jwtToken: String, completion: @escaping ([[String: Any]]) -> Void) {
        var allPhotos: [[String: Any]] = []
        
        func fetchPage(offset: Int) {
            // Use get-uploaded-photos endpoint which has pagination support
            guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos") else {
                print("❌ Invalid get-uploaded-photos URL")
                completion([])
                return
            }
            
            // Build URL with pagination query parameters
            var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
            urlComponents?.queryItems = [
                URLQueryItem(name: "event_id", value: eventId),
                URLQueryItem(name: "limit", value: "50"), // Use max limit for efficiency
                URLQueryItem(name: "offset", value: String(offset))
            ]
            
            guard let finalURL = urlComponents?.url else {
                print("❌ Failed to build URL with query parameters")
                completion([])
                return
            }
        
        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        
        print("📡 Fetching uploaded photos for event: \(eventId)")
        
            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("❌ Error fetching uploaded photos page \(offset/50 + 1): \(error.localizedDescription)")
                    completion([])
                    return
                }
                
                // Debug HTTP response
                if let httpResponse = response as? HTTPURLResponse {
                    print("📡 get-uploaded-photos Response Status: \(httpResponse.statusCode)")
                    if offset == 0 { // Only show headers for first request to reduce log noise
                        print("📡 get-uploaded-photos Response Headers: \(httpResponse.allHeaderFields)")
                    }
                }
                
                guard let data = data else {
                    print("❌ No data received from get-uploaded-photos page \(offset/50 + 1)")
                    completion([])
                    return
                }
                
                // Debug raw response data (truncated for pagination)
                if let responseString = String(data: data, encoding: .utf8) {
                    let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
                    print("📡 get-uploaded-photos Raw Response (page \(offset/50 + 1)): \(truncated)")
                } else {
                    print("❌ Could not decode response data as UTF-8")
                }
                
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        // Handle get-uploaded-photos API response format
                        if let photos = json["photos"] as? [[String: Any]] {
                            allPhotos.append(contentsOf: photos)
                            
                            // Check pagination info (has_more is directly in the response)
                            if let hasMore = json["has_more"] as? Bool {
                                
                                print("📄 Page \(offset/50 + 1): Fetched \(photos.count) photos, has_more: \(hasMore)")
                                
                                if hasMore {
                                    // Fetch next page
                                    fetchPage(offset: offset + 50)
                                } else {
                                    // All pages fetched, return results
                                    print("✅ Fetched total of \(allPhotos.count) uploaded photos with pagination")
                                    
                                    // Debug: Print first few photos for verification  
                                    for (index, photo) in allPhotos.prefix(3).enumerated() {
                                        print("📋 API Photo \(index): \(photo)")
                                    }
                                    
                                    completion(allPhotos)
                                }
                            } else {
                                // No pagination info, assume this is the only page
                                print("✅ Fetched \(allPhotos.count) uploaded photos (no pagination info)")
                                
                                // Debug: Print first few photos for verification  
                                for (index, photo) in allPhotos.prefix(3).enumerated() {
                                    print("📋 API Photo \(index): \(photo)")
                                }
                                
                                completion(allPhotos)
                            }
                        } else {
                            print("❌ No 'photos' array found in API response")
                            completion([])
                        }
                    } else {
                        print("❌ Invalid JSON format in API response")
                        completion([])
                    }
                } catch {
                    print("❌ JSON parsing error: \(error.localizedDescription)")
                    completion([])
                }
            }.resume()
        }
        
        // Start fetching from first page
        fetchPage(offset: 0)
    }
    
    
    @objc func openEventPhotoPicker(_ call: CAPPluginCall) {
        print("🚀 Opening event photo picker...")
        
        // Check JWT token availability (with fallback for immediate retrieval if needed)
        var jwtToken = AppDelegate.getStoredJwtToken()
        
        if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
            print("⚠️ No valid JWT token stored, triggering refresh...")
            print("🔄 JWT token status - exists: \(jwtToken != nil), valid: \(AppDelegate.isJwtTokenValid())")
            
            // Trigger JWT token refresh when EventPhotoPicker opens with invalid token
            AppDelegate.refreshJwtTokenIfNeeded()
            
            // Use whatever token we have for now (might be expired but better than nothing)
            if let storedToken = AppDelegate.getStoredJwtToken() {
                jwtToken = storedToken
                print("🔐 Using stored JWT token (refreshing in background): \(storedToken.prefix(20))...")
            } else {
                print("⚠️ No JWT token available, refresh triggered but proceeding")
            }
        } else {
            print("✅ Valid JWT token available for EventPhotoPicker: \(jwtToken!.prefix(20))...")
        }
        
        // Get parameters (accept both startDate/endDate and startTime/endTime)
        let startDateString = call.getString("startDate") ?? call.getString("startTime")
        let endDateString = call.getString("endDate") ?? call.getString("endTime")
        let eventIdString = call.getString("eventId")
        
        guard let startDateStr = startDateString,
              let endDateStr = endDateString,
              let eventId = eventIdString else {
            call.reject("Missing required parameters: startDate/startTime, endDate/endTime, eventId")
            return
        }
        
        // Store current eventId for JavaScript upload service
        self.currentEventId = eventId
        
        // Store JWT token in current instance for potential API calls
        self.currentJwtToken = jwtToken
        
        // Get timezone parameter (optional)
        let timezoneString = call.getString("timezone")
        
        // Parse dates
        let formatter = ISO8601DateFormatter()
        
        // Add debugging
        print("📅 EventPhotoPicker: Received startDate: '\(startDateStr)'")
        print("📅 EventPhotoPicker: Received endDate: '\(endDateStr)'")
        print("🌍 EventPhotoPicker: Received timezone: '\(timezoneString ?? "none")'")
        
        guard let startDateUTC = formatter.date(from: startDateStr),
              let endDateUTC = formatter.date(from: endDateStr) else {
            print("❌ EventPhotoPicker: Failed to parse dates")
            print("❌ Expected format: 2025-08-14T10:00:00Z")
            call.reject("Invalid date format. Use ISO8601 format. Expected: YYYY-MM-DDTHH:mm:ssZ")
            return
        }
        
        // Convert UTC dates to device timezone for photo comparison
        var startDate = startDateUTC
        var endDate = endDateUTC
        
        if let timezoneString = timezoneString,
           let eventTimezone = TimeZone(identifier: timezoneString) {
            
            print("🌍 EventPhotoPicker: Converting to timezone: \(timezoneString)")
            
            let deviceTimezone = TimeZone.current
            let eventOffset = eventTimezone.secondsFromGMT(for: startDateUTC)
            let deviceOffset = deviceTimezone.secondsFromGMT(for: startDateUTC)
            let offsetDifference = deviceOffset - eventOffset
            
            startDate = startDateUTC.addingTimeInterval(TimeInterval(offsetDifference))
            endDate = endDateUTC.addingTimeInterval(TimeInterval(offsetDifference))
            
            print("🕐 EventPhotoPicker: Adjusted start date for device timezone: \(startDate)")
            print("🕐 EventPhotoPicker: Adjusted end date for device timezone: \(endDate)")
        }
        
        print("✅ EventPhotoPicker: Successfully parsed and converted dates")
        print("✅ Start: \(startDate)")
        print("✅ End: \(endDate)")
        
        // Get optional parameters
        let uploadedPhotoIds = call.getArray("uploadedPhotoIds", String.self) ?? []
        let allowMultipleSelection = call.getBool("allowMultipleSelection") ?? true
        let title = call.getString("title") ?? "Select Event Photos"
        
        // Check photo library permissions
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            self.presentPhotoPicker(
                call: call,
                startDate: startDate,
                endDate: endDate,
                eventId: eventId,
                uploadedPhotoIds: uploadedPhotoIds,
                allowMultipleSelection: allowMultipleSelection,
                title: title
            )
            
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { [weak self] newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self?.presentPhotoPicker(
                            call: call,
                            startDate: startDate,
                            endDate: endDate,
                            eventId: eventId,
                            uploadedPhotoIds: uploadedPhotoIds,
                            allowMultipleSelection: allowMultipleSelection,
                            title: title
                        )
                    } else {
                        call.reject("Photo library permission denied")
                    }
                }
            }
            
        case .denied, .restricted:
            call.reject("Photo library permission required. Please enable in Settings > Privacy > Photos")
            
        @unknown default:
            call.reject("Unknown photo library permission status")
        }
    }
    
    @objc func openRegularPhotoPicker(_ call: CAPPluginCall) {
        print("🚀 Opening regular photo picker (all device photos)...")
        
        // Get optional parameters
        let allowMultipleSelection = call.getBool("allowMultipleSelection") ?? true
        let title = call.getString("title") ?? "Select Photos"
        let maxSelectionCount = call.getInt("maxSelectionCount") ?? 10
        
        // Check photo library permissions
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            self.presentRegularPhotoPicker(
                call: call,
                allowMultipleSelection: allowMultipleSelection,
                title: title,
                maxSelectionCount: maxSelectionCount
            )
            
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { [weak self] newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self?.presentRegularPhotoPicker(
                            call: call,
                            allowMultipleSelection: allowMultipleSelection,
                            title: title,
                            maxSelectionCount: maxSelectionCount
                        )
                    } else {
                        call.reject("Photo library permission denied")
                    }
                }
            }
            
        case .denied, .restricted:
            call.reject("Photo library permission required. Please enable in Settings > Privacy > Photos")
            
        @unknown default:
            call.reject("Unknown photo library permission status")
        }
    }
    
    private func presentRegularPhotoPicker(
        call: CAPPluginCall,
        allowMultipleSelection: Bool,
        title: String,
        maxSelectionCount: Int
    ) {
        DispatchQueue.main.async { [weak self] in
            guard let bridge = self?.bridge,
                  let viewController = bridge.viewController else {
                call.reject("Unable to present photo picker")
                return
            }
            
            let pickerVC = RegularPhotoPickerViewController(
                allowMultipleSelection: allowMultipleSelection,
                title: title,
                maxSelectionCount: maxSelectionCount
            )
            
            pickerVC.onComplete = { [weak self] selectedPhotos in
                self?.handleRegularPhotoSelection(call: call, selectedPhotos: selectedPhotos)
            }
            
            pickerVC.onCancel = {
                call.reject("User cancelled photo selection")
            }
            
            let navController = UINavigationController(rootViewController: pickerVC)
            navController.modalPresentationStyle = .fullScreen
            
            viewController.present(navController, animated: true)
        }
    }
    
    private func handleRegularPhotoSelection(call: CAPPluginCall, selectedPhotos: [RegularPhoto]) {
        print("📸 Processing \(selectedPhotos.count) selected photos from regular picker...")
        
        var processedPhotos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        
        for photo in selectedPhotos {
            dispatchGroup.enter()
            
            let imageManager = PHImageManager.default()
            let requestOptions = PHImageRequestOptions()
            requestOptions.isSynchronous = false
            requestOptions.deliveryMode = .highQualityFormat
            requestOptions.isNetworkAccessAllowed = true
            
            // Request image data
            imageManager.requestImageDataAndOrientation(for: photo.asset, options: requestOptions) { data, dataUTI, orientation, info in
                defer { dispatchGroup.leave() }
                
                guard let imageData = data else {
                    print("⚠️ Could not get image data for photo: \(photo.localIdentifier)")
                    return
                }
                
                let base64String = imageData.base64EncodedString()
                
                var photoInfo: [String: Any] = [
                    "localIdentifier": photo.localIdentifier,
                    "creationDate": photo.creationDate.timeIntervalSince1970,
                    "modificationDate": photo.modificationDate?.timeIntervalSince1970 ?? photo.creationDate.timeIntervalSince1970,
                    "width": photo.pixelWidth,
                    "height": photo.pixelHeight,
                    "base64": base64String,
                    "mimeType": dataUTI ?? "image/jpeg"
                ]
                
                if let location = photo.location {
                    photoInfo["location"] = [
                        "latitude": location.coordinate.latitude,
                        "longitude": location.coordinate.longitude
                    ]
                } else {
                    photoInfo["location"] = nil
                }
                
                processedPhotos.append(photoInfo)
            }
        }
        
        dispatchGroup.notify(queue: .main) {
            print("✅ Processed \(processedPhotos.count) photos from regular picker")
            call.resolve([
                "photos": processedPhotos,
                "count": processedPhotos.count,
                "pickerType": "regular"
            ])
        }
    }
    
    private func presentPhotoPicker(
        call: CAPPluginCall,
        startDate: Date,
        endDate: Date,
        eventId: String,
        uploadedPhotoIds: [String],
        allowMultipleSelection: Bool,
        title: String
    ) {
        print("🔍 DEBUG: presentPhotoPicker called with eventId: \(eventId)")
        
        // Check if we need to refresh the JWT token before proceeding
        if !AppDelegate.isJwtTokenValid() {
            print("🔄 JWT token invalid, refreshing synchronously...")
            
            AppDelegate.refreshJwtTokenIfNeeded { [weak self] freshToken in
                guard let self = self else { return }
                
                if let token = freshToken {
                    print("✅ Got fresh JWT token, proceeding with API call")
                    self.proceedWithPhotoPicker(
                        call: call, 
                        startDate: startDate, 
                        endDate: endDate, 
                        eventId: eventId, 
                        allowMultipleSelection: allowMultipleSelection, 
                        title: title, 
                        jwtToken: token
                    )
                } else {
                    print("❌ Failed to get fresh JWT token")
                    call.reject("Unable to refresh authentication token")
                }
            }
        } else {
            // Token is valid, use the stored one
            guard let jwtToken = AppDelegate.getStoredJwtToken() else {
                print("❌ No JWT token available")
                call.reject("No JWT token available") 
                return
            }
            
            print("✅ JWT token is valid, proceeding immediately")
            proceedWithPhotoPicker(
                call: call,
                startDate: startDate,
                endDate: endDate, 
                eventId: eventId,
                allowMultipleSelection: allowMultipleSelection,
                title: title,
                jwtToken: jwtToken
            )
        }
    }
    
    private func proceedWithPhotoPicker(
        call: CAPPluginCall,
        startDate: Date,
        endDate: Date, 
        eventId: String,
        allowMultipleSelection: Bool,
        title: String,
        jwtToken: String
    ) {
        // Fetch uploaded photos from API instead of using passed parameter
        print("🔄 Fetching uploaded photos from API before opening picker...")
        fetchUploadedPhotos(eventId: eventId, jwtToken: jwtToken) { [weak self] fetchedUploadedPhotos in
            DispatchQueue.main.async {
                guard let bridge = self?.bridge,
                      let viewController = bridge.viewController else {
                    call.reject("Unable to present photo picker")
                    return
                }
                
                let jwtData = AppDelegate.getStoredJwtData()
                
                let pickerVC = EventPhotoPickerViewController(
                    startDate: startDate,
                    endDate: endDate,
                    eventId: eventId,
                    uploadedPhotos: fetchedUploadedPhotos, // Use API result instead of parameter
                    allowMultipleSelection: allowMultipleSelection,
                title: title,
                jwtToken: jwtToken,
                jwtData: jwtData
            )
            
            pickerVC.onComplete = { [weak self] selectedPhotos in
                self?.handlePhotoSelection(call: call, selectedPhotos: selectedPhotos)
            }
            
            pickerVC.onCancel = {
                call.reject("User cancelled photo selection")
            }
            
            let navController = UINavigationController(rootViewController: pickerVC)
            navController.modalPresentationStyle = .fullScreen
            
            self?.currentPickerViewController = pickerVC
            viewController.present(navController, animated: true)
            }
        }
    }
    
    private func handlePhotoSelection(call: CAPPluginCall, selectedPhotos: [EventPhoto]) {
        print("📸 Processing \(selectedPhotos.count) selected photos...")
        
        var processedPhotos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        
        for photo in selectedPhotos {
            dispatchGroup.enter()
            
            let imageManager = PHImageManager.default()
            let requestOptions = PHImageRequestOptions()
            requestOptions.isSynchronous = false
            requestOptions.deliveryMode = .highQualityFormat
            requestOptions.isNetworkAccessAllowed = true
            
            // Request image data
            imageManager.requestImageDataAndOrientation(for: photo.asset, options: requestOptions) { data, dataUTI, orientation, info in
                defer { dispatchGroup.leave() }
                
                guard let imageData = data else {
                    print("⚠️ Could not get image data for photo: \(photo.localIdentifier)")
                    return
                }
                
                let base64String = imageData.base64EncodedString()
                
                var photoInfo: [String: Any] = [
                    "localIdentifier": photo.localIdentifier,
                    "creationDate": photo.creationDate.timeIntervalSince1970,
                    "modificationDate": photo.modificationDate?.timeIntervalSince1970 ?? photo.creationDate.timeIntervalSince1970,
                    "width": photo.pixelWidth,
                    "height": photo.pixelHeight,
                    "base64": base64String,
                    "mimeType": dataUTI ?? "image/jpeg",
                    "isUploaded": photo.isUploaded
                ]
                
                if let location = photo.location {
                    photoInfo["location"] = [
                        "latitude": location.coordinate.latitude,
                        "longitude": location.coordinate.longitude
                    ]
                } else {
                    photoInfo["location"] = nil
                }
                
                processedPhotos.append(photoInfo)
            }
        }
        
        dispatchGroup.notify(queue: .main) {
            print("✅ Processed \(processedPhotos.count) photos for upload")
            
            // First resolve the call to indicate successful photo selection
            call.resolve([
                "photos": processedPhotos,
                "count": processedPhotos.count
            ])
            
            // Then start the JavaScript upload service in background
            DispatchQueue.main.async {
                self.startJavaScriptUpload(photos: selectedPhotos)
            }
        }
    }
    
    // MARK: - JavaScript Upload Service Integration
    
    private func startJavaScriptUpload(photos: [EventPhoto]) {
        print("🚀 Starting JavaScript upload service for \(photos.count) photos")
        
        guard let bridge = self.bridge,
              let _ = bridge.webView else {
            print("❌ No webView available for JavaScript upload call")
            return
        }
        
        // Convert photos to JavaScript-compatible format
        var jsPhotos: [[String: Any]] = []
        let dispatchGroup = DispatchGroup()
        
        for photo in photos {
            dispatchGroup.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                var photoDict: [String: Any] = [
                    "localIdentifier": photo.localIdentifier,
                    "filename": "IMG_\(photo.localIdentifier.suffix(8)).jpg",
                    "creationDate": photo.creationDate.timeIntervalSince1970
                ]
                
                // Get the actual image file path
                if let asset = PHAsset.fetchAssets(withLocalIdentifiers: [photo.localIdentifier], options: nil).firstObject {
                    let imageManager = PHImageManager.default()
                    let options = PHImageRequestOptions()
                    options.isSynchronous = true
                    options.deliveryMode = .highQualityFormat
                    options.isNetworkAccessAllowed = true
                    
                    imageManager.requestImage(for: asset, targetSize: PHImageManagerMaximumSize, contentMode: .aspectFill, options: options) { image, _ in
                        if let image = image,
                           let imageData = image.jpegData(compressionQuality: 0.8) {
                            
                            // Save to temporary file
                            let tempDir = FileManager.default.temporaryDirectory
                            let tempFileName = "\(UUID().uuidString).jpg"
                            let tempURL = tempDir.appendingPathComponent(tempFileName)
                            
                            do {
                                try imageData.write(to: tempURL)
                                photoDict["path"] = tempURL.path
                                
                                // Generate thumbnail for overlay
                                if let thumbnail = self.generateThumbnail(from: image, size: CGSize(width: 32, height: 32)),
                                   let thumbnailData = thumbnail.jpegData(compressionQuality: 0.7) {
                                    let base64String = thumbnailData.base64EncodedString()
                                    photoDict["thumbnail"] = base64String
                                }
                                
                                print("📸 Prepared photo: \(photoDict["filename"] as? String ?? "unknown") -> \(tempURL.path)")
                            } catch {
                                print("❌ Failed to save temp file for \(photoDict["filename"] as? String ?? "unknown"): \(error)")
                            }
                        }
                        
                        jsPhotos.append(photoDict)
                        dispatchGroup.leave()
                    }
                } else {
                    jsPhotos.append(photoDict)
                    dispatchGroup.leave()
                }
            }
        }
        
        // Wait for all photos to be processed, then start native background upload
        dispatchGroup.notify(queue: .main) {
            self.startBackgroundUpload(photos: jsPhotos, eventId: self.currentEventId ?? "unknown")
        }
    }
    
    private func startBackgroundUpload(photos: [[String: Any]], eventId: String) {
        print("🚀 Starting native background upload for \(photos.count) photos to event \(eventId)")
        
        guard let jwtToken = AppDelegate.getStoredJwtToken() else {
            print("❌ No JWT token available for background upload")
            return
        }
        
        // Show upload status overlay with total count
        showUploadStatusOverlay()
        updateUploadOverlayProgress(completed: 0, total: photos.count)
        
        // Start background uploads for each photo
        for (index, photoData) in photos.enumerated() {
            uploadPhoto(photoData: photoData, eventId: eventId, jwtToken: jwtToken, photoIndex: index + 1, totalPhotos: photos.count)
        }
    }
    
    private func showUploadStatusOverlay() {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                bridge.eval(js: """
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.showOverlay();
                        console.log('✅ Upload status overlay shown');
                    }
                """)
            }
        }
    }
    
    private func hideUploadStatusOverlay() {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                bridge.eval(js: """
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.hideOverlay();
                        console.log('✅ Upload status overlay hidden');
                    }
                """)
            }
        }
    }
    
    private func updateUploadOverlayProgress(completed: Int, total: Int) {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                bridge.eval(js: """
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                            completed: \(completed),
                            total: \(total)
                        });
                        console.log('📊 Overlay updated: \(completed)/\(total)');
                    }
                """)
            }
        }
    }
    
    private func addThumbnailToOverlay(thumbnail: String) {
        DispatchQueue.main.async {
            if let bridge = self.bridge {
                bridge.eval(js: """
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.addPhoto({
                            thumbnail: '\(thumbnail)'
                        });
                        console.log('📸 Added thumbnail to overlay');
                    }
                """)
            }
        }
    }
    
    private func generateThumbnail(from image: UIImage, size: CGSize) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
    
    private func uploadPhoto(photoData: [String: Any], eventId: String, jwtToken: String, photoIndex: Int, totalPhotos: Int) {
        guard let filePath = photoData["path"] as? String else {
            print("❌ No file path found for photo \(photoIndex)")
            return
        }
        
        guard let imageData = try? Data(contentsOf: URL(fileURLWithPath: filePath)) else {
            print("❌ Failed to read image data from file for photo \(photoIndex): \(filePath)")
            return
        }
        
        // Generate proper UUID for upload tracking
        let uploadId = UUID().uuidString.lowercased()
        let filename = photoData["filename"] as? String ?? "photo_\(photoIndex).jpg"
        
        print("📤 Starting upload: \(uploadId) - \(filename)")
        
        // Update status to "uploading" 
        updateUploadStatus(uploadId: uploadId, jwtToken: jwtToken, status: "uploading", progress: 0)
        
        // Create multipart form data
        let boundary = "PhotoShareUpload-\(UUID().uuidString)"
        var formData = Data()
        
        // Add file field
        let uploadFilename = "photo_\(Date().timeIntervalSince1970)_\(photoIndex).jpg"
        let mimeType = photoData["mimeType"] as? String ?? "image/jpeg"
        
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(uploadFilename)\"\r\n".data(using: .utf8)!)
        formData.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        formData.append(imageData)
        formData.append("\r\n".data(using: .utf8)!)
        
        // Add event_id field
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"event_id\"\r\n\r\n".data(using: .utf8)!)
        formData.append(eventId.data(using: .utf8)!)
        formData.append("\r\n".data(using: .utf8)!)
        
        // Add file_name field
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"file_name\"\r\n\r\n".data(using: .utf8)!)
        formData.append(uploadFilename.data(using: .utf8)!)
        formData.append("\r\n".data(using: .utf8)!)
        
        // Add media_type field
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"media_type\"\r\n\r\n".data(using: .utf8)!)
        formData.append("photo".data(using: .utf8)!)
        formData.append("\r\n".data(using: .utf8)!)
        
        // Add originalTimestamp if available
        if let creationDate = photoData["creationDate"] as? TimeInterval {
            let formatter = ISO8601DateFormatter()
            let timestamp = formatter.string(from: Date(timeIntervalSince1970: creationDate))
            formData.append("--\(boundary)\r\n".data(using: .utf8)!)
            formData.append("Content-Disposition: form-data; name=\"originalTimestamp\"\r\n\r\n".data(using: .utf8)!)
            formData.append(timestamp.data(using: String.Encoding.utf8)!)
            formData.append("\r\n".data(using: .utf8)!)
        }
        
        // Close boundary
        formData.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Create upload request
        let uploadUrl = "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/multipart-upload"
        guard let url = URL(string: uploadUrl) else {
            print("❌ Invalid upload URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = formData
        
        // Set current thumbnail in overlay right before upload starts
        if let thumbnailBase64 = photoData["thumbnail"] as? String {
            addThumbnailToOverlay(thumbnail: thumbnailBase64)
        }
        
        print("📤 Starting background upload for photo \(photoIndex)/\(totalPhotos)")
        
        // Perform background upload
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ Upload failed for photo \(photoIndex): \(error.localizedDescription)")
                    
                    // Update status to failed
                    self.updateUploadStatus(uploadId: uploadId, jwtToken: jwtToken, status: "failed", progress: 0, errorMessage: error.localizedDescription)
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    print("❌ Invalid response for photo \(photoIndex)")
                    
                    // Update status to failed
                    self.updateUploadStatus(uploadId: uploadId, jwtToken: jwtToken, status: "failed", progress: 0, errorMessage: "Invalid response")
                    return
                }
                
                if httpResponse.statusCode == 200 {
                    print("✅ Photo \(photoIndex)/\(totalPhotos) uploaded successfully")
                    
                    // Update status to completed
                    self.updateUploadStatus(uploadId: uploadId, jwtToken: jwtToken, status: "completed", progress: 100)
                    
                    // Show notification for successful upload
                    self.showUploadNotification(title: "Upload Complete", body: "Photo \(photoIndex) of \(totalPhotos) uploaded successfully")
                    
                    // Check if all uploads are complete
                    self.checkIfAllUploadsComplete(totalPhotos: totalPhotos)
                } else {
                    let errorMessage = data.flatMap { String(data: $0, encoding: .utf8) } ?? "Unknown error"
                    print("❌ Upload failed for photo \(photoIndex): HTTP \(httpResponse.statusCode) - \(errorMessage)")
                    
                    // Update status to failed
                    self.updateUploadStatus(uploadId: uploadId, jwtToken: jwtToken, status: "failed", progress: 0, errorMessage: "HTTP \(httpResponse.statusCode): \(errorMessage)")
                }
            }
        }
        
        task.resume()
    }
    
    // MARK: - Upload Status API Integration
    private func updateUploadStatus(uploadId: String, jwtToken: String, status: String, progress: Int, errorMessage: String? = nil) {
        let statusUpdateUrl = "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/upload-status-update/\(uploadId)"
        guard let url = URL(string: statusUpdateUrl) else {
            print("❌ Invalid status update URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = [
            "status": status,
            "progress": progress
        ]
        
        if let errorMessage = errorMessage {
            body["error_message"] = errorMessage
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("❌ Failed to serialize status update body: \(error)")
            return
        }
        
        print("📊 Updating upload status: \(uploadId) -> \(status) (\(progress)%)")
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("⚠️ Status update failed: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    print("✅ Status updated successfully for \(uploadId)")
                } else {
                    let errorMessage = data.flatMap { String(data: $0, encoding: .utf8) } ?? "Unknown error"
                    print("⚠️ Status update failed: HTTP \(httpResponse.statusCode) - \(errorMessage)")
                }
            }
        }
        
        task.resume()
    }
    
    private var completedUploads = 0
    private var totalUploadCount = 0
    
    private func checkIfAllUploadsComplete(totalPhotos: Int) {
        completedUploads += 1
        totalUploadCount = totalPhotos
        
        print("📊 Upload progress: \(completedUploads)/\(totalPhotos) complete")
        
        // Update overlay progress
        updateUploadOverlayProgress(completed: completedUploads, total: totalPhotos)
        
        if completedUploads >= totalPhotos {
            print("✅ All uploads complete! Hiding overlay after 3 seconds")
            
            // Hide overlay after a brief delay to show completion
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                self.hideUploadStatusOverlay()
                
                // Reset counters for next upload session
                self.completedUploads = 0
                self.totalUploadCount = 0
            }
        }
    }
    
    private func showUploadNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound.default
        
        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ Failed to show notification: \(error)")
            }
        }
    }
    
    @objc func showEventInfo(_ call: CAPPluginCall) {
        print("🚀 showEventInfo called - Starting modal presentation")
        print("📋 Showing comprehensive event information modal...")
        
        // Get event parameters
        let eventName = call.getString("eventName") ?? "Unknown Event"
        let memberId = call.getString("memberId") ?? "Unknown Member"
        let startDateString = call.getString("startDate") ?? ""
        let endDateString = call.getString("endDate") ?? ""
        let eventId = call.getString("eventId") ?? "Unknown ID"
        let timezone = call.getString("timezone")
        let userTimezone = call.getString("userTimezone")
        
        print("📊 Event Data - Name: \(eventName), ID: \(eventId), Member: \(memberId)")
        print("📅 Date range - Start: '\(startDateString)', End: '\(endDateString)'")
        print("🌍 Timezone info - Event: '\(timezone ?? "none")', User: '\(userTimezone ?? "not provided")'")
        print("📱 Device timezone: \(TimeZone.current.identifier)")
        
        // Parse dates with comprehensive error handling
        guard let startDate = self.parseEventDate(startDateString),
              let endDate = self.parseEventDate(endDateString) else {
            print("⚠️ Could not parse dates, showing modal with 0 photo count")
            self.presentModalWithPhotoCount(0, call: call, eventName: eventName, memberId: memberId, eventId: eventId, startDateString: startDateString, endDateString: endDateString, timezone: timezone)
            return
        }
        
        print("✅ Successfully parsed dates - Start: \(startDate), End: \(endDate)")
        
        // Count photos in background with enhanced timezone information
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            print("📸 Starting photo count with timezone analysis...")
            print("🔍 TIMEZONE DEBUG INFO:")
            print("   📱 Device timezone: \(TimeZone.current.identifier)")
            print("   🌍 Event timezone: \(timezone ?? "not provided")")
            print("   📅 Start date input: \(startDateString)")
            print("   📅 End date input: \(endDateString)")
            print("   🕐 Parsed start date: \(startDate)")
            print("   🕐 Parsed end date: \(endDate)")
            
            let photoCount = self?.countPhotosInDateRange(startDate: startDate, endDate: endDate, timezone: timezone) ?? 0
            
            print("✅ Photo count completed: \(photoCount) photos found")
            
            DispatchQueue.main.async {
                self?.presentModalWithPhotoCount(
                    photoCount, 
                    call: call, 
                    eventName: eventName, 
                    memberId: memberId, 
                    eventId: eventId, 
                    startDateString: startDateString, 
                    endDateString: endDateString, 
                    timezone: timezone,
                    userTimezone: userTimezone
                )
            }
        }
    }
    
    private func parseEventDate(_ dateString: String) -> Date? {
        print("🕐 Parsing date: '\(dateString)'")
        
        // Try multiple date formats
        let formatters: [(DateFormatter, String)] = [
            // Standard ISO8601 formats
            (createDateFormatter("yyyy-MM-dd'T'HH:mm:ssZ"), "ISO8601 with timezone"),
            (createDateFormatter("yyyy-MM-dd'T'HH:mm:ss'Z'"), "ISO8601 UTC"),
            (createDateFormatter("yyyy-MM-dd'T'HH:mm:ss"), "ISO8601 basic"),
            (createDateFormatter("yyyy-MM-dd'T'HH:mm:ss.SSSZ"), "ISO8601 with milliseconds"),
            (createDateFormatter("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"), "ISO8601 UTC with milliseconds"),
            // Additional common formats
            (createDateFormatter("yyyy-MM-dd HH:mm:ss"), "Standard datetime"),
            (createDateFormatter("MM/dd/yyyy HH:mm:ss"), "US format"),
        ]
        
        for (formatter, description) in formatters {
            if let date = formatter.date(from: dateString) {
                print("✅ Parsed '\(dateString)' using \(description) -> \(date)")
                return date
            }
        }
        
        // Try ISO8601DateFormatter as last resort
        let iso8601Formatter = ISO8601DateFormatter()
        if let date = iso8601Formatter.date(from: dateString) {
            print("✅ Parsed '\(dateString)' using ISO8601DateFormatter -> \(date)")
            return date
        }
        
        print("❌ Could not parse date: '\(dateString)'")
        return nil
    }
    
    private func createDateFormatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.timeZone = TimeZone(secondsFromGMT: 0) // UTC
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }
    
    private func countPhotosInDateRange(startDate: Date, endDate: Date, timezone: String?) -> Int {
        print("📸 Counting photos from \(startDate) to \(endDate)")
        print("🌍 Event timezone: \(timezone ?? "UTC/not specified")")
        
        // Get device timezone info
        let deviceTimezone = TimeZone.current
        print("📱 Device timezone: \(deviceTimezone.identifier) (\(deviceTimezone.abbreviation() ?? "?"))")
        
        // Convert dates based on timezone logic
        let (searchStartDate, searchEndDate) = self.convertEventTimesToDeviceTime(
            eventStartDate: startDate,
            eventEndDate: endDate,
            eventTimezone: timezone
        )
        
        print("📅 Final search range: \(searchStartDate) to \(searchEndDate)")
        
        // Check photo library authorization
        let authStatus = PHPhotoLibrary.authorizationStatus()
        guard authStatus == .authorized || authStatus == .limited else {
            print("❌ Photo library access not authorized (status: \(authStatus.rawValue))")
            return 0
        }
        
        print("✅ Photo library access authorized: \(authStatus == .authorized ? "Full" : "Limited")")
        
        // Create fetch options for photos only
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate <= %@ AND mediaType == %d",
                                       searchStartDate as NSDate,
                                       searchEndDate as NSDate,
                                       PHAssetMediaType.image.rawValue)
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        
        // Fetch photos
        let assets = PHAsset.fetchAssets(with: options)
        print("📸 Found \(assets.count) photos in date range")
        
        // Log first few photos for debugging
        if assets.count > 0 {
            let maxLog = min(assets.count, 3)
            for i in 0..<maxLog {
                let asset = assets.object(at: i)
                print("📸 Photo \(i + 1): created \(asset.creationDate ?? Date())")
            }
            if assets.count > 3 {
                print("📸 ... and \(assets.count - 3) more photos")
            }
        }
        
        return assets.count
    }
    
    private func convertEventTimesToDeviceTime(eventStartDate: Date, eventEndDate: Date, eventTimezone: String?) -> (Date, Date) {
        print("🔄 Converting event times to device time for photo search...")
        
        let deviceTimezone = TimeZone.current
        
        // If no event timezone specified, assume UTC and convert to device time
        guard let eventTimezoneString = eventTimezone,
              let eventTZ = TimeZone(identifier: eventTimezoneString) else {
            print("⚠️ No valid event timezone, treating input as UTC")
            
            // Dates are in UTC, convert to device timezone
            let utcToDeviceOffset = TimeInterval(deviceTimezone.secondsFromGMT())
            let adjustedStart = eventStartDate.addingTimeInterval(utcToDeviceOffset)
            let adjustedEnd = eventEndDate.addingTimeInterval(utcToDeviceOffset)
            
            print("🕐 UTC \(eventStartDate) -> Device \(adjustedStart)")
            print("🕐 UTC \(eventEndDate) -> Device \(adjustedEnd)")
            
            return (adjustedStart, adjustedEnd)
        }
        
        print("🌍 Event timezone: \(eventTZ.identifier) (\(eventTZ.abbreviation() ?? "?"))")
        print("📱 Device timezone: \(deviceTimezone.identifier) (\(deviceTimezone.abbreviation() ?? "?"))")
        
        // Calculate offset differences
        let eventOffsetFromGMT = eventTZ.secondsFromGMT(for: eventStartDate)
        let deviceOffsetFromGMT = deviceTimezone.secondsFromGMT(for: eventStartDate)
        let offsetDifference = TimeInterval(deviceOffsetFromGMT - eventOffsetFromGMT)
        
        print("📊 Event offset from GMT: \(eventOffsetFromGMT / 3600) hours")
        print("📊 Device offset from GMT: \(deviceOffsetFromGMT / 3600) hours")
        print("📊 Offset difference: \(offsetDifference / 3600) hours")
        
        // Apply timezone conversion
        let adjustedStart = eventStartDate.addingTimeInterval(offsetDifference)
        let adjustedEnd = eventEndDate.addingTimeInterval(offsetDifference)
        
        print("🕐 Event time \(eventStartDate) -> Device time \(adjustedStart)")
        print("🕐 Event time \(eventEndDate) -> Device time \(adjustedEnd)")
        
        // Validation: Check if conversion makes sense
        let hoursDifference = abs(adjustedStart.timeIntervalSince(eventStartDate)) / 3600
        if hoursDifference > 24 {
            print("⚠️ Large timezone difference detected: \(hoursDifference) hours")
        }
        
        return (adjustedStart, adjustedEnd)
    }
    
    private func presentModalWithPhotoCount(_ photoCount: Int, call: CAPPluginCall, eventName: String, memberId: String, eventId: String, startDateString: String, endDateString: String, timezone: String?, userTimezone: String? = nil) {
        guard let bridge = self.bridge,
              let viewController = bridge.viewController else {
            call.reject("Unable to present event info modal")
            return
        }
        
        print("🎯 Presenting modal with \(photoCount) photos")
        
        // Create custom modal view controller
        let modalViewController = EventInfoModalViewController()
        modalViewController.eventName = eventName
        modalViewController.memberId = memberId
        modalViewController.eventId = eventId
        modalViewController.startDate = startDateString
        modalViewController.endDate = endDateString
        modalViewController.timezone = timezone ?? "UTC"
        modalViewController.photoCount = photoCount
        
        // Add timezone comparison info to modal
        modalViewController.userTimezone = userTimezone ?? TimeZone.current.identifier
        
        // Set completion handlers
        modalViewController.onComplete = { result in
            // Add timezone analysis to result
            var enhancedResult = result
            enhancedResult["deviceTimezone"] = TimeZone.current.identifier
            enhancedResult["userTimezone"] = userTimezone ?? TimeZone.current.identifier
            enhancedResult["timezoneAnalysisPerformed"] = true
            call.resolve(enhancedResult)
        }
        
        modalViewController.onDismiss = {
            call.reject("Event info modal dismissed by user")
        }
        
        // Present as centered modal (not sheet)
        modalViewController.modalPresentationStyle = .overFullScreen
        modalViewController.modalTransitionStyle = .crossDissolve
        
        viewController.present(modalViewController, animated: true) {
            print("✅ Event info modal presented successfully with \(photoCount) photos")
        }
    }
    
    @objc func getEventPhotosMetadata(_ call: CAPPluginCall) {
        guard let startDateString = call.getString("startDate"),
              let endDateString = call.getString("endDate") else {
            call.reject("Missing required parameters: startDate, endDate")
            return
        }
        
        // Get timezone parameter (optional, defaults to device timezone)
        let timezoneString = call.getString("timezone")
        
        print("🔍 METADATA TIMEZONE DEBUG:")
        print("   📱 Device timezone: \(TimeZone.current.identifier)")
        print("   🌍 Event timezone: \(timezoneString ?? "not provided")")
        print("   📅 Start date input: \(startDateString)")
        print("   📅 End date input: \(endDateString)")
        
        let formatter = ISO8601DateFormatter()
        guard let startDateUTC = formatter.date(from: startDateString),
              let endDateUTC = formatter.date(from: endDateString) else {
            call.reject("Invalid date format. Use ISO8601 format.")
            return
        }
        
        print("   🕐 Parsed UTC start: \(startDateUTC)")
        print("   🕐 Parsed UTC end: \(endDateUTC)")
        
        print("🕐 EventPhotoPicker: UTC start date: \(startDateUTC)")
        print("🕐 EventPhotoPicker: UTC end date: \(endDateUTC)")
        
        // Convert UTC dates to event timezone if provided
        var startDate = startDateUTC
        var endDate = endDateUTC
        
        if let timezoneString = timezoneString,
           let eventTimezone = TimeZone(identifier: timezoneString) {
            
            print("🌍 EventPhotoPicker: Converting to timezone: \(timezoneString)")
            
            // Photos on device are stored with local timestamps
            // We need to convert the event times to device local time for comparison
            let deviceTimezone = TimeZone.current
            
            // Calculate the offset difference
            let eventOffset = eventTimezone.secondsFromGMT(for: startDateUTC)
            let deviceOffset = deviceTimezone.secondsFromGMT(for: startDateUTC)
            let offsetDifference = deviceOffset - eventOffset
            
            // Adjust the dates by the offset difference
            startDate = startDateUTC.addingTimeInterval(TimeInterval(offsetDifference))
            endDate = endDateUTC.addingTimeInterval(TimeInterval(offsetDifference))
            
            print("🕐 EventPhotoPicker: Adjusted start date for device timezone: \(startDate)")
            print("🕐 EventPhotoPicker: Adjusted end date for device timezone: \(endDate)")
        } else {
            print("🕐 EventPhotoPicker: Using UTC dates directly (no timezone conversion)")
        }
        
        let uploadedPhotoIds = call.getArray("uploadedPhotoIds", String.self) ?? []
        
        DispatchQueue.global(qos: .userInitiated).async {
            // Convert legacy uploadedPhotoIds to empty metadata for compatibility
            let uploadedPhotosMetadata: [[String: Any]] = []
            let photos = self.fetchEventPhotos(
                startDate: startDate,
                endDate: endDate,
                uploadedPhotos: uploadedPhotosMetadata
            )
            
            let metadata = photos.map { photo in
                return [
                    "localIdentifier": photo.localIdentifier,
                    "creationDate": photo.creationDate.timeIntervalSince1970,
                    "width": photo.pixelWidth,
                    "height": photo.pixelHeight,
                    "isUploaded": photo.isUploaded
                ]
            }
            
            DispatchQueue.main.async {
                call.resolve([
                    "photos": metadata,
                    "totalCount": photos.count,
                    "uploadedCount": photos.filter { $0.isUploaded }.count,
                    "pendingCount": photos.filter { !$0.isUploaded }.count
                ])
            }
        }
    }
    
    private func fetchEventPhotos(startDate: Date, endDate: Date, uploadedPhotos: [[String: Any]]) -> [EventPhoto] {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate <= %@ AND mediaType == %d",
                                       startDate as NSDate,
                                       endDate as NSDate,
                                       PHAssetMediaType.image.rawValue)
        
        let assets = PHAsset.fetchAssets(with: options)
        var eventPhotos: [EventPhoto] = []
        
        assets.enumerateObjects { asset, index, stop in
            // Use multi-factor duplicate detection
            let isUploaded = EventPhotoPicker.isPhotoUploaded(asset: asset, uploadedPhotos: uploadedPhotos)
            
            let eventPhoto = EventPhoto(
                asset: asset,
                localIdentifier: asset.localIdentifier,
                creationDate: asset.creationDate ?? Date(),
                modificationDate: asset.modificationDate,
                pixelWidth: asset.pixelWidth,
                pixelHeight: asset.pixelHeight,
                location: asset.location,
                isUploaded: isUploaded
            )
            
            eventPhotos.append(eventPhoto)
        }
        
        print("📸 Found \(eventPhotos.count) photos for event period")
        print("📤 \(eventPhotos.filter { $0.isUploaded }.count) already uploaded")
        print("📋 \(eventPhotos.filter { !$0.isUploaded }.count) pending upload")
        
        return eventPhotos
    }
    
    // MARK: - File Hash Generation
    static func generatePhotoHashSync(for asset: PHAsset) -> String? {
        let semaphore = DispatchSemaphore(value: 0)
        var fileHash: String?
        
        let options = PHImageRequestOptions()
        options.isSynchronous = false
        options.isNetworkAccessAllowed = false  // Disable network access for faster processing
        options.deliveryMode = .fastFormat      // Use fast format for quicker processing
        
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
            defer { semaphore.signal() }
            
            guard let imageData = data else {
                print("❌ Failed to get image data for hash generation (sync)")
                return
            }
            
            // Generate SHA-256 hash
            let hash = SHA256.hash(data: imageData)
            fileHash = hash.compactMap { String(format: "%02x", $0) }.joined()
            print("📱 Generated device hash: \(fileHash ?? "nil") (size: \(imageData.count) bytes)")
        }
        
        // Wait for completion with longer timeout for sync method
        let timeout = DispatchTime.now() + .milliseconds(1000)
        if semaphore.wait(timeout: timeout) == .timedOut {
            print("⚠️ Sync hash generation timed out for asset")
            return nil
        }
        
        return fileHash
    }
    
    // MARK: - Multi-Factor Duplicate Detection
    static func isPhotoUploaded(asset: PHAsset, uploadedPhotos: [[String: Any]]) -> Bool {
        print("🔍 Checking asset: \(asset.localIdentifier) against \(uploadedPhotos.count) uploaded photos")
        
        // Get device photo metadata
        guard let deviceHash = generatePhotoHashSync(for: asset) else {
            print("❌ Could not generate hash for device photo \(asset.localIdentifier)")
            return false
        }
        
        print("📱 Device hash: \(deviceHash)")
        
        let deviceTimestamp = asset.creationDate ?? Date()
        let deviceWidth = asset.pixelWidth
        let deviceHeight = asset.pixelHeight
        
        // Get EXIF data for camera info
        let deviceCameraMake = getCameraMake(for: asset)
        let deviceCameraModel = getCameraModel(for: asset)
        
        // Check each uploaded photo
        for (index, uploadedPhoto) in uploadedPhotos.enumerated() {
            print("📋 Checking uploaded photo \(index): keys = \(Array(uploadedPhoto.keys))")
            
            // Primary: Exact hash matching (100% confidence)
            if let uploadedHash = uploadedPhoto["file_hash"] as? String {
                print("🔍 Comparing hashes: device=\(deviceHash) vs uploaded=\(uploadedHash)")
                if deviceHash == uploadedHash {
                    print("✅ EXACT MATCH: File hash match found for \(asset.localIdentifier)")
                    return true
                } else {
                    print("❌ Hash mismatch for photo \(index)")
                }
            } else {
                print("⚠️ No file_hash in uploaded photo \(index)")
            }
            
            // Secondary: Perceptual hash matching (95% confidence) 
            if let uploadedPerceptualHash = uploadedPhoto["perceptual_hash"] as? String {
                // TODO: Generate perceptual hash for device photo and compare
                print("📸 Found perceptual hash in API: \(uploadedPerceptualHash)")
                // For now, skip perceptual matching since we need to implement perceptual hash generation
            }
            
            // Fallback: Metadata matching for HEIF conversion edge cases
            print("🔍 Attempting metadata fallback for photo \(index)")
            
            // Debug what we have available
            let timestampString = uploadedPhoto["original_timestamp"] as? String
            let sizeBytes = uploadedPhoto["file_size_bytes"] as? Int
            print("📋 Available fields: timestamp=\(timestampString ?? "nil"), size=\(sizeBytes ?? 0)")
            
            if let uploadedTimestampString = timestampString,
               let uploadedSizeBytes = sizeBytes {
                
                // Try to parse timestamp with debug
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                let uploadedTimestamp = formatter.date(from: uploadedTimestampString)
                
                print("📅 Parsing timestamp '\(uploadedTimestampString)' -> \(uploadedTimestamp?.description ?? "FAILED")")
                
                guard let timestamp = uploadedTimestamp else {
                    print("❌ Failed to parse timestamp for photo \(index)")
                    continue
                }
                
                print("✅ Basic metadata available - proceeding with comparison")
                
                // Use device dimensions since uploaded dimensions may be null
                let uploadedWidth = uploadedPhoto["image_width"] as? Int ?? deviceWidth
                let uploadedHeight = uploadedPhoto["image_height"] as? Int ?? deviceHeight
                
                let timestampDiff = abs(deviceTimestamp.timeIntervalSince(timestamp))
                let dimensionsMatch = (deviceWidth == uploadedWidth && deviceHeight == uploadedHeight)
                
                // Get device file size
                let deviceSize = getFileSize(for: asset)
                let sizeDiff = deviceSize > 0 ? abs(deviceSize - uploadedSizeBytes) : Int.max
                
                // Check metadata matching conditions - increased threshold for HEIF conversion delays
                let timestampWithin60Seconds = timestampDiff <= 60.0 // Allow 60s for format conversion
                let sizeSimilar = sizeDiff <= 1_000_000 // Within 1MB for format conversion cases
                
                print("📊 Metadata comparison for photo \(index):")
                print("   Device timestamp: \(deviceTimestamp)")
                print("   Uploaded timestamp: \(timestamp)")
                print("   Timestamp diff: \(timestampDiff)s (within 60s: \(timestampWithin60Seconds))")
                print("   Device size: \(deviceSize) bytes, Uploaded size: \(uploadedSizeBytes) bytes")
                print("   Size diff: \(sizeDiff) bytes (similar: \(sizeSimilar))")  
                print("   Dimensions: \(deviceWidth)x\(deviceHeight) vs \(uploadedWidth)x\(uploadedHeight) (match: \(dimensionsMatch))")
                
                if timestampWithin60Seconds && sizeSimilar && dimensionsMatch {
                    print("✅ METADATA MATCH: Found match for \(asset.localIdentifier)")
                    return true
                }
            } else {
                print("❌ Missing metadata fields for photo \(index) - skipping metadata comparison")
            }
        }
        
        print("❌ NO MATCHES: Photo \(asset.localIdentifier) not found in uploaded photos")
        return false
    }
    
    private static func getCameraMake(for asset: PHAsset) -> String? {
        // This would require requesting image metadata, simplified for now
        return nil
    }
    
    private static func getCameraModel(for asset: PHAsset) -> String? {
        // This would require requesting image metadata, simplified for now
        return nil
    }
    
    private static func getFileSize(for asset: PHAsset) -> Int {
        let semaphore = DispatchSemaphore(value: 0)
        var fileSize = 0
        
        let options = PHImageRequestOptions()
        options.isSynchronous = false
        options.isNetworkAccessAllowed = false
        options.deliveryMode = .fastFormat
        
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
            defer { semaphore.signal() }
            
            if let imageData = data {
                fileSize = imageData.count
            }
        }
        
        let timeout = DispatchTime.now() + .milliseconds(100)
        if semaphore.wait(timeout: timeout) == .timedOut {
            print("⚠️ File size request timed out")
        }
        
        return fileSize
    }
}

// MARK: - EventPhoto Data Model
struct EventPhoto {
    let asset: PHAsset
    let localIdentifier: String
    let creationDate: Date
    let modificationDate: Date?
    let pixelWidth: Int
    let pixelHeight: Int
    let location: CLLocation?
    let isUploaded: Bool
}

// MARK: - EventPhotoPickerViewController
class EventPhotoPickerViewController: UIViewController {
    private let startDate: Date
    private let endDate: Date
    private let eventId: String
    private let uploadedPhotos: [[String: Any]]
    private let allowMultipleSelection: Bool
    private let pickerTitle: String
    private let jwtToken: String?
    private let jwtData: [String: Any]?
    
    private var eventPhotos: [EventPhoto] = []
    private var newPhotos: [EventPhoto] = []
    private var uploadedEventPhotos: [EventPhoto] = []
    private var selectedPhotos: Set<String> = []
    
    private var collectionView: UICollectionView!
    private var selectAllButton: UIBarButtonItem!
    private var uploadButton: UIBarButtonItem!
    private var toolbarView: UIView!
    private var selectAllToolbarButton: UIButton!
    private var uploadToolbarButton: UIButton!
    
    // Loading overlay views
    private var loadingOverlay: UIView?
    private var loadingLabel: UILabel?
    private var activityIndicator: UIActivityIndicatorView?
    
    var onComplete: (([EventPhoto]) -> Void)?
    var onCancel: (() -> Void)?
    
    init(startDate: Date, endDate: Date, eventId: String, uploadedPhotos: [[String: Any]], allowMultipleSelection: Bool, title: String, jwtToken: String? = nil, jwtData: [String: Any]? = nil) {
        self.startDate = startDate
        self.endDate = endDate
        self.eventId = eventId
        self.uploadedPhotos = uploadedPhotos
        self.allowMultipleSelection = allowMultipleSelection
        self.pickerTitle = title
        self.jwtToken = jwtToken
        self.jwtData = jwtData
        super.init(nibName: nil, bundle: nil)
        
        // Log JWT availability for debugging
        if let token = jwtToken {
            print("✅ EventPhotoPickerViewController initialized with JWT token: \(token.prefix(20))...")
            if let data = jwtData, let expiresAt = data["expiresAt"] as? TimeInterval {
                let expirationDate = Date(timeIntervalSince1970: expiresAt)
                print("🔐 JWT expires at: \(expirationDate)")
            }
        } else {
            print("⚠️ EventPhotoPickerViewController initialized without JWT token")
        }
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadEventPhotos()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground
        title = pickerTitle // This shows the event name in the navigation bar
        
        // Navigation bar setup - just Cancel button
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
        
        // Create toolbar for multiple selection
        if allowMultipleSelection {
            setupToolbar()
        } else {
            navigationItem.rightBarButtonItem = UIBarButtonItem(
                title: "Done",
                style: .done,
                target: self,
                action: #selector(uploadTapped)
            )
        }
        
        // Collection view setup
        let layout = UICollectionViewFlowLayout()
        let itemsPerRow: CGFloat = 3
        let spacing: CGFloat = 2
        let itemSize = (view.bounds.width - spacing * (itemsPerRow + 1)) / itemsPerRow
        
        layout.itemSize = CGSize(width: itemSize, height: itemSize)
        layout.minimumInteritemSpacing = spacing
        layout.minimumLineSpacing = spacing
        layout.sectionInset = UIEdgeInsets(top: spacing, left: spacing, bottom: spacing, right: spacing)
        
        collectionView = UICollectionView(frame: view.bounds, collectionViewLayout: layout)
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.backgroundColor = UIColor.systemBackground
        collectionView.allowsMultipleSelection = allowMultipleSelection
        
        collectionView.register(EventPhotoCell.self, forCellWithReuseIdentifier: "EventPhotoCell")
        collectionView.register(PhotoSectionHeaderView.self, forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader, withReuseIdentifier: "SectionHeader")
        
        view.addSubview(collectionView)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        
        // Set up collection view constraints after toolbar is created (if any)
        setupCollectionViewConstraints()
    }
    
    private func setupToolbar() {
        // Create toolbar view
        toolbarView = UIView()
        toolbarView.backgroundColor = UIColor.systemBackground
        toolbarView.layer.borderWidth = 0.5
        toolbarView.layer.borderColor = UIColor.separator.cgColor
        view.addSubview(toolbarView)
        
        // Create Select All button
        selectAllToolbarButton = UIButton(type: .system)
        selectAllToolbarButton.setTitle("Select All", for: .normal)
        selectAllToolbarButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        selectAllToolbarButton.addTarget(self, action: #selector(selectAllTapped), for: .touchUpInside)
        toolbarView.addSubview(selectAllToolbarButton)
        
        // Create Upload button
        uploadToolbarButton = UIButton(type: .system)
        uploadToolbarButton.setTitle("Upload (0)", for: .normal)
        uploadToolbarButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        uploadToolbarButton.setTitleColor(.white, for: .normal)
        uploadToolbarButton.backgroundColor = UIColor.systemBlue
        uploadToolbarButton.layer.cornerRadius = 8
        uploadToolbarButton.isEnabled = false
        uploadToolbarButton.backgroundColor = UIColor.systemGray4
        uploadToolbarButton.addTarget(self, action: #selector(uploadTapped), for: .touchUpInside)
        toolbarView.addSubview(uploadToolbarButton)
        
        // Setup constraints
        toolbarView.translatesAutoresizingMaskIntoConstraints = false
        selectAllToolbarButton.translatesAutoresizingMaskIntoConstraints = false
        uploadToolbarButton.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            // Toolbar constraints
            toolbarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            toolbarView.heightAnchor.constraint(equalToConstant: 60),
            
            // Select All button constraints
            selectAllToolbarButton.leadingAnchor.constraint(equalTo: toolbarView.leadingAnchor, constant: 16),
            selectAllToolbarButton.centerYAnchor.constraint(equalTo: toolbarView.centerYAnchor),
            
            // Upload button constraints
            uploadToolbarButton.trailingAnchor.constraint(equalTo: toolbarView.trailingAnchor, constant: -16),
            uploadToolbarButton.centerYAnchor.constraint(equalTo: toolbarView.centerYAnchor),
            uploadToolbarButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 100),
            uploadToolbarButton.heightAnchor.constraint(equalToConstant: 36)
        ])
    }
    
    private func setupCollectionViewConstraints() {
        // Set up collection view constraints properly
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: toolbarView?.topAnchor ?? view.bottomAnchor)
        ])
    }
    
    private func showLoadingOverlay() {
        // Create overlay background
        let overlay = UIView(frame: view.bounds)
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        overlay.alpha = 0.0
        
        // Create content container
        let contentView = UIView()
        contentView.backgroundColor = UIColor.systemBackground
        contentView.layer.cornerRadius = 12
        contentView.layer.shadowColor = UIColor.black.cgColor
        contentView.layer.shadowOffset = CGSize(width: 0, height: 2)
        contentView.layer.shadowOpacity = 0.3
        contentView.layer.shadowRadius = 8
        contentView.translatesAutoresizingMaskIntoConstraints = false
        
        // Create activity indicator
        let activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.color = UIColor.systemBlue
        activityIndicator.startAnimating()
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        
        // Create loading label
        let loadingLabel = UILabel()
        loadingLabel.text = "Checking for uploaded photos..."
        loadingLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        loadingLabel.textColor = UIColor.label
        loadingLabel.textAlignment = .center
        loadingLabel.numberOfLines = 0 // Allow multiple lines
        loadingLabel.lineBreakMode = .byWordWrapping // Wrap by words
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // Add views
        contentView.addSubview(activityIndicator)
        contentView.addSubview(loadingLabel)
        overlay.addSubview(contentView)
        view.addSubview(overlay)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            // Center content view
            contentView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            contentView.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            contentView.widthAnchor.constraint(equalToConstant: 280), // Increased width
            contentView.heightAnchor.constraint(greaterThanOrEqualToConstant: 120), // Minimum height
            
            // Activity indicator
            activityIndicator.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            
            // Loading label
            loadingLabel.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            loadingLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            loadingLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            loadingLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            loadingLabel.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -20) // Ensure bottom padding
        ])
        
        // Store references
        self.loadingOverlay = overlay
        self.loadingLabel = loadingLabel
        self.activityIndicator = activityIndicator
        
        // Animate in
        UIView.animate(withDuration: 0.3) {
            overlay.alpha = 1.0
        }
    }
    
    private func hideLoadingOverlay() {
        guard let overlay = loadingOverlay else { return }
        
        UIView.animate(withDuration: 0.3, animations: {
            overlay.alpha = 0.0
        }) { _ in
            overlay.removeFromSuperview()
            self.loadingOverlay = nil
            self.loadingLabel = nil
            self.activityIndicator?.stopAnimating()
            self.activityIndicator = nil
        }
    }
    
    private func updateLoadingProgress(current: Int, total: Int) {
        DispatchQueue.main.async { [weak self] in
            self?.loadingLabel?.text = "Checking for duplicates...\n(\(current)/\(total))"
        }
    }
    
    private func loadEventPhotos() {
        // Show loading overlay
        showLoadingOverlay()
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate <= %@ AND mediaType == %d",
                                           self.startDate as NSDate,
                                           self.endDate as NSDate,
                                           PHAssetMediaType.image.rawValue)
            
            let assets = PHAsset.fetchAssets(with: options)
            var photos: [EventPhoto] = []
            let totalCount = assets.count
            
            print("🔍 Starting duplicate detection for \(totalCount) photos...")
            
            assets.enumerateObjects { asset, index, stop in
                // Update progress periodically (every 10 photos or on the last one)
                if index % 10 == 0 || index == totalCount - 1 {
                    self.updateLoadingProgress(current: index + 1, total: totalCount)
                }
                
                // Use multi-factor duplicate detection
                let isUploaded = EventPhotoPicker.isPhotoUploaded(asset: asset, uploadedPhotos: self.uploadedPhotos)
                
                let eventPhoto = EventPhoto(
                    asset: asset,
                    localIdentifier: asset.localIdentifier,
                    creationDate: asset.creationDate ?? Date(),
                    modificationDate: asset.modificationDate,
                    pixelWidth: asset.pixelWidth,
                    pixelHeight: asset.pixelHeight,
                    location: asset.location,
                    isUploaded: isUploaded
                )
                
                photos.append(eventPhoto)
            }
            
            print("✅ Duplicate detection completed for \(totalCount) photos")
            
            DispatchQueue.main.async {
                self.eventPhotos = photos
                self.separatePhotosIntoSections()
                self.collectionView.reloadData()
                self.updateUI()
                
                // Hide loading overlay
                self.hideLoadingOverlay()
            }
        }
    }
    
    private func separatePhotosIntoSections() {
        newPhotos.removeAll()
        uploadedEventPhotos.removeAll()
        
        for photo in eventPhotos {
            if photo.isUploaded {
                uploadedEventPhotos.append(photo)
            } else {
                newPhotos.append(photo)
            }
        }
        
        print("📊 Separated photos: \(newPhotos.count) new, \(uploadedEventPhotos.count) uploaded")
    }
    
    private func updateUI() {
        let selectedCount = selectedPhotos.count
        let pendingPhotos = eventPhotos.filter { !$0.isUploaded }
        
        if allowMultipleSelection {
            // Update toolbar buttons instead of navigation bar buttons
            uploadToolbarButton?.setTitle("Upload (\(selectedCount))", for: .normal)
            uploadToolbarButton?.isEnabled = selectedCount > 0
            uploadToolbarButton?.backgroundColor = selectedCount > 0 ? UIColor.systemBlue : UIColor.systemGray4
            
            if selectedCount == pendingPhotos.count && pendingPhotos.count > 0 {
                selectAllToolbarButton?.setTitle("Deselect All", for: .normal)
            } else {
                selectAllToolbarButton?.setTitle("Select All", for: .normal)
            }
        }
    }
    
    @objc private func cancelTapped() {
        onCancel?()
        dismiss(animated: true)
    }
    
    @objc private func selectAllTapped() {
        let pendingPhotos = eventPhotos.filter { !$0.isUploaded }
        
        if selectedPhotos.count == pendingPhotos.count && pendingPhotos.count > 0 {
            // Deselect all
            selectedPhotos.removeAll()
        } else {
            // Select all pending photos
            selectedPhotos = Set(pendingPhotos.map { $0.localIdentifier })
        }
        
        collectionView.reloadData()
        updateUI()
    }
    
    @objc private func uploadTapped() {
        let selectedEventPhotos = eventPhotos.filter { selectedPhotos.contains($0.localIdentifier) }
        
        guard !selectedEventPhotos.isEmpty else {
            showAlert(title: "No Photos Selected", message: "Please select at least one photo to upload.")
            return
        }
        
        print("🚀 User selected \(selectedEventPhotos.count) photos for upload")
        print("📤 Passing photos to main plugin for JavaScript upload service")
        
        // Use the callback to pass photos back to the main plugin for upload
        onComplete?(selectedEventPhotos)
        
        // Dismiss this view controller
        dismiss(animated: true)
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UICollectionViewDataSource & Delegate
extension EventPhotoPickerViewController: UICollectionViewDataSource, UICollectionViewDelegate, UICollectionViewDelegateFlowLayout {
    func numberOfSections(in collectionView: UICollectionView) -> Int {
        var sections = 0
        if !newPhotos.isEmpty { sections += 1 }
        if !uploadedEventPhotos.isEmpty { sections += 1 }
        return max(sections, 1) // Always show at least 1 section
    }
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        let sectionIndex = getSectionIndex(section)
        switch sectionIndex {
        case 0: return newPhotos.count
        case 1: return uploadedEventPhotos.count
        default: return 0
        }
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "EventPhotoCell", for: indexPath) as! EventPhotoCell
        let sectionIndex = getSectionIndex(indexPath.section)
        
        let photo: EventPhoto
        switch sectionIndex {
        case 0: photo = newPhotos[indexPath.item]
        case 1: photo = uploadedEventPhotos[indexPath.item]
        default: return cell
        }
        
        cell.configure(
            with: photo,
            isSelected: selectedPhotos.contains(photo.localIdentifier),
            isUploaded: photo.isUploaded
        )
        
        return cell
    }
    
    private func getSectionIndex(_ section: Int) -> Int {
        if !newPhotos.isEmpty && section == 0 {
            return 0 // New photos section
        } else if !uploadedEventPhotos.isEmpty {
            return 1 // Uploaded photos section
        }
        return 0
    }
    
    func collectionView(_ collectionView: UICollectionView, viewForSupplementaryElementOfKind kind: String, at indexPath: IndexPath) -> UICollectionReusableView {
        if kind == UICollectionView.elementKindSectionHeader {
            let header = collectionView.dequeueReusableSupplementaryView(ofKind: kind, withReuseIdentifier: "SectionHeader", for: indexPath) as! PhotoSectionHeaderView
            
            let sectionIndex = getSectionIndex(indexPath.section)
            if sectionIndex == 0 && !newPhotos.isEmpty {
                header.configure(title: "New Photos (\(newPhotos.count))")
            } else if sectionIndex == 1 && !uploadedEventPhotos.isEmpty {
                header.configure(title: "Already Uploaded (\(uploadedEventPhotos.count))")
            }
            
            return header
        }
        
        return UICollectionReusableView()
    }
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, referenceSizeForHeaderInSection section: Int) -> CGSize {
        let sectionIndex = getSectionIndex(section)
        if (sectionIndex == 0 && !newPhotos.isEmpty) || (sectionIndex == 1 && !uploadedEventPhotos.isEmpty) {
            return CGSize(width: view.frame.width, height: 44)
        }
        return .zero
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let sectionIndex = getSectionIndex(indexPath.section)
        
        let photo: EventPhoto
        switch sectionIndex {
        case 0: photo = newPhotos[indexPath.item]
        case 1: photo = uploadedEventPhotos[indexPath.item]
        default: return
        }
        
        // Don't allow selection of uploaded photos
        if photo.isUploaded {
            return
        }
        
        if allowMultipleSelection {
            if selectedPhotos.contains(photo.localIdentifier) {
                selectedPhotos.remove(photo.localIdentifier)
            } else {
                selectedPhotos.insert(photo.localIdentifier)
            }
            
            collectionView.reloadItems(at: [indexPath])
            updateUI()
        } else {
            selectedPhotos = [photo.localIdentifier]
            uploadTapped()
        }
    }
}

// MARK: - EventPhotoCell
class EventPhotoCell: UICollectionViewCell {
    private let imageView = UIImageView()
    private let selectionOverlay = UIView()
    private let checkmarkImageView = UIImageView()
    private let uploadedOverlay = UIView()
    private let uploadedLabel = UILabel()
    
    private var imageRequestID: PHImageRequestID?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        
        if let requestID = imageRequestID {
            PHImageManager.default().cancelImageRequest(requestID)
        }
        
        imageView.image = nil
        selectionOverlay.isHidden = true
        uploadedOverlay.isHidden = true
    }
    
    private func setupUI() {
        // Image view
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        contentView.addSubview(imageView)
        
        // Selection overlay
        selectionOverlay.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
        selectionOverlay.isHidden = true
        contentView.addSubview(selectionOverlay)
        
        // Checkmark
        checkmarkImageView.image = UIImage(systemName: "checkmark.circle.fill")
        checkmarkImageView.tintColor = UIColor.systemBlue
        checkmarkImageView.backgroundColor = UIColor.white
        checkmarkImageView.layer.cornerRadius = 12
        selectionOverlay.addSubview(checkmarkImageView)
        
        // Uploaded overlay
        uploadedOverlay.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        uploadedOverlay.isHidden = true
        contentView.addSubview(uploadedOverlay)
        
        // Uploaded label
        uploadedLabel.text = "✓ Uploaded"
        uploadedLabel.textColor = UIColor.white
        uploadedLabel.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        uploadedLabel.textAlignment = .center
        uploadedOverlay.addSubview(uploadedLabel)
        
        // Layout
        imageView.translatesAutoresizingMaskIntoConstraints = false
        selectionOverlay.translatesAutoresizingMaskIntoConstraints = false
        checkmarkImageView.translatesAutoresizingMaskIntoConstraints = false
        uploadedOverlay.translatesAutoresizingMaskIntoConstraints = false
        uploadedLabel.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            selectionOverlay.topAnchor.constraint(equalTo: contentView.topAnchor),
            selectionOverlay.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            selectionOverlay.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            selectionOverlay.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            checkmarkImageView.topAnchor.constraint(equalTo: selectionOverlay.topAnchor, constant: 4),
            checkmarkImageView.trailingAnchor.constraint(equalTo: selectionOverlay.trailingAnchor, constant: -4),
            checkmarkImageView.widthAnchor.constraint(equalToConstant: 24),
            checkmarkImageView.heightAnchor.constraint(equalToConstant: 24),
            
            uploadedOverlay.topAnchor.constraint(equalTo: contentView.topAnchor),
            uploadedOverlay.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            uploadedOverlay.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            uploadedOverlay.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            uploadedLabel.centerXAnchor.constraint(equalTo: uploadedOverlay.centerXAnchor),
            uploadedLabel.centerYAnchor.constraint(equalTo: uploadedOverlay.centerYAnchor)
        ])
    }
    
    func configure(with photo: EventPhoto, isSelected: Bool, isUploaded: Bool) {
        // Load thumbnail image
        let imageManager = PHImageManager.default()
        let requestOptions = PHImageRequestOptions()
        requestOptions.deliveryMode = .opportunistic
        requestOptions.isNetworkAccessAllowed = false
        
        imageRequestID = imageManager.requestImage(
            for: photo.asset,
            targetSize: CGSize(width: 200, height: 200),
            contentMode: .aspectFill,
            options: requestOptions
        ) { [weak self] image, _ in
            DispatchQueue.main.async {
                self?.imageView.image = image
            }
        }
        
        // Update selection state
        selectionOverlay.isHidden = !isSelected
        
        // Update uploaded state
        uploadedOverlay.isHidden = !isUploaded
        
        // Dim uploaded photos
        imageView.alpha = isUploaded ? 0.5 : 1.0
        
        // Show overlay badge for uploaded photos
        if isUploaded {
            uploadedOverlay.isHidden = false
            uploadedLabel.text = "✓ Uploaded"
            uploadedLabel.textColor = UIColor.white
            uploadedLabel.font = UIFont.boldSystemFont(ofSize: 12)
            
            // Keep full opacity to see the badge clearly
            imageView.alpha = 1.0
        }
    }
}

// MARK: - PhotoSectionHeaderView
class PhotoSectionHeaderView: UICollectionReusableView {
    private let titleLabel = UILabel()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        backgroundColor = UIColor.systemGroupedBackground
        
        titleLabel.font = UIFont.boldSystemFont(ofSize: 18)
        titleLabel.textColor = UIColor.label
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        
        addSubview(titleLabel)
        
        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -16)
        ])
    }
    
    func configure(title: String) {
        titleLabel.text = title
    }
}

// MARK: - Event Info Modal View Controller
class EventInfoModalViewController: UIViewController {
    var eventName: String = ""
    var memberId: String = ""
    var eventId: String = ""
    var startDate: String = ""
    var endDate: String = ""
    var timezone: String = "UTC"
    var userTimezone: String = "UTC"
    var photoCount: Int = 0
    
    var onComplete: (([String: Any]) -> Void)?
    var onDismiss: (() -> Void)?
    
    private var scrollView: UIScrollView!
    private var contentView: UIView!
    private var headerView: UIView!
    private var infoStackView: UIStackView!
    private var permissionView: UIView!
    private var buttonStackView: UIStackView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        print("🎯 EventInfoModalViewController.viewDidLoad() - Modal is loading!")
        setupModalView()
        loadEventInfo()
        print("✅ EventInfoModalViewController setup complete")
    }
    
    private func setupModalView() {
        // Dark background overlay
        view.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        
        // Create centered container view
        let containerView = UIView()
        containerView.backgroundColor = UIColor.systemBackground
        containerView.layer.cornerRadius = 20
        containerView.layer.masksToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        // Create header
        headerView = UIView()
        headerView.backgroundColor = UIColor.systemBlue
        headerView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(headerView)
        
        let titleLabel = UILabel()
        titleLabel.text = "📅 Event Information"
        titleLabel.font = UIFont.boldSystemFont(ofSize: 20)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)
        
        // Create scroll view for content
        scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(scrollView)
        
        contentView = UIView()
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        // Create main content stack
        infoStackView = UIStackView()
        infoStackView.axis = .vertical
        infoStackView.spacing = 15
        infoStackView.alignment = .fill
        infoStackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(infoStackView)
        
        // Create button stack
        buttonStackView = UIStackView()
        buttonStackView.axis = .horizontal
        buttonStackView.spacing = 12
        buttonStackView.distribution = .fillEqually
        buttonStackView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(buttonStackView)
        
        // Set up constraints for centered modal
        NSLayoutConstraint.activate([
            // Container - centered on screen
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 350),
            containerView.heightAnchor.constraint(lessThanOrEqualToConstant: 600),
            
            // Header
            headerView.topAnchor.constraint(equalTo: containerView.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 60),
            
            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            
            // Scroll view
            scrollView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: buttonStackView.topAnchor, constant: -15),
            
            // Content view
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            // Info stack
            infoStackView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 15),
            infoStackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 15),
            infoStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -15),
            infoStackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -15),
            
            // Button stack
            buttonStackView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 15),
            buttonStackView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -15),
            buttonStackView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -15),
            buttonStackView.heightAnchor.constraint(equalToConstant: 44)
        ])
    }
    
    private func loadEventInfo() {
        // Clear existing content
        infoStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        // Event details section
        addInfoSection(title: "📋 Event Details", items: [
            ("Event Name", eventName),
            ("Event ID", eventId),
            ("Member ID", memberId)
        ])
        
        // Time period section
        let formatter = ISO8601DateFormatter()
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .full
        displayFormatter.timeStyle = .medium
        
        let startDisplayDate: String
        let endDisplayDate: String
        
        if let startDateObj = formatter.date(from: startDate) {
            startDisplayDate = displayFormatter.string(from: startDateObj)
        } else {
            startDisplayDate = startDate.isEmpty ? "Not provided" : startDate
        }
        
        if let endDateObj = formatter.date(from: endDate) {
            endDisplayDate = displayFormatter.string(from: endDateObj)
        } else {
            endDisplayDate = endDate.isEmpty ? "Not provided" : endDate
        }
        
        // Enhanced timezone section with comparison
        let timezoneItems = self.createTimezoneComparisonItems()
        addInfoSection(title: "🌍 Timezone & Time Period", items: timezoneItems + [
            ("Start Time", startDisplayDate),
            ("End Time", endDisplayDate)
        ])
        
        // Photo count section
        addInfoSection(title: "📸 Photos Found", items: [
            ("Photos in Event Period", "\(photoCount) photos"),
            ("Status", photoCount > 0 ? "Ready for selection" : "No photos found")
        ])
        
        // Photo permissions section
        addPermissionSection()
        
        // Add action buttons
        setupActionButtons()
    }
    
    private func addInfoSection(title: String, items: [(String, String)]) {
        let sectionView = createSectionView(title: title)
        
        for (label, value) in items {
            let itemView = createInfoItem(label: label, value: value)
            sectionView.addArrangedSubview(itemView)
        }
        
        infoStackView.addArrangedSubview(sectionView)
    }
    
    private func createSectionView(title: String) -> UIStackView {
        let sectionStack = UIStackView()
        sectionStack.axis = .vertical
        sectionStack.spacing = 10
        sectionStack.backgroundColor = UIColor.secondarySystemBackground
        sectionStack.layer.cornerRadius = 12
        sectionStack.layoutMargins = UIEdgeInsets(top: 15, left: 15, bottom: 15, right: 15)
        sectionStack.isLayoutMarginsRelativeArrangement = true
        
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = UIFont.boldSystemFont(ofSize: 18)
        titleLabel.textColor = UIColor.label
        
        sectionStack.addArrangedSubview(titleLabel)
        return sectionStack
    }
    
    private func createInfoItem(label: String, value: String) -> UIView {
        let container = UIView()
        
        let labelView = UILabel()
        labelView.text = label
        labelView.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        labelView.textColor = UIColor.secondaryLabel
        labelView.translatesAutoresizingMaskIntoConstraints = false
        
        let valueView = UILabel()
        valueView.text = value
        valueView.font = UIFont.systemFont(ofSize: 16)
        valueView.textColor = UIColor.label
        valueView.numberOfLines = 0
        valueView.translatesAutoresizingMaskIntoConstraints = false
        
        container.addSubview(labelView)
        container.addSubview(valueView)
        
        NSLayoutConstraint.activate([
            labelView.topAnchor.constraint(equalTo: container.topAnchor),
            labelView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            labelView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            
            valueView.topAnchor.constraint(equalTo: labelView.bottomAnchor, constant: 4),
            valueView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            valueView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            valueView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        
        return container
    }
    
    private func addPermissionSection() {
        let photoPermissionStatus = PHPhotoLibrary.authorizationStatus()
        let (statusText, statusColor, statusIcon) = getPermissionInfo(for: photoPermissionStatus)
        
        let sectionView = createSectionView(title: "📱 Photo Library Access")
        
        let permissionContainer = UIView()
        permissionContainer.backgroundColor = statusColor.withAlphaComponent(0.1)
        permissionContainer.layer.cornerRadius = 8
        permissionContainer.layer.borderWidth = 2
        permissionContainer.layer.borderColor = statusColor.cgColor
        
        let permissionStack = UIStackView()
        permissionStack.axis = .vertical
        permissionStack.spacing = 8
        permissionStack.alignment = .center
        permissionStack.layoutMargins = UIEdgeInsets(top: 15, left: 15, bottom: 15, right: 15)
        permissionStack.isLayoutMarginsRelativeArrangement = true
        permissionStack.translatesAutoresizingMaskIntoConstraints = false
        
        let iconLabel = UILabel()
        iconLabel.text = statusIcon
        iconLabel.font = UIFont.systemFont(ofSize: 32)
        
        let statusLabel = UILabel()
        statusLabel.text = statusText
        statusLabel.font = UIFont.boldSystemFont(ofSize: 16)
        statusLabel.textColor = statusColor
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        
        permissionStack.addArrangedSubview(iconLabel)
        permissionStack.addArrangedSubview(statusLabel)
        
        permissionContainer.addSubview(permissionStack)
        
        NSLayoutConstraint.activate([
            permissionStack.topAnchor.constraint(equalTo: permissionContainer.topAnchor),
            permissionStack.leadingAnchor.constraint(equalTo: permissionContainer.leadingAnchor),
            permissionStack.trailingAnchor.constraint(equalTo: permissionContainer.trailingAnchor),
            permissionStack.bottomAnchor.constraint(equalTo: permissionContainer.bottomAnchor)
        ])
        
        sectionView.addArrangedSubview(permissionContainer)
        infoStackView.addArrangedSubview(sectionView)
    }
    
    private func getPermissionInfo(for status: PHAuthorizationStatus) -> (String, UIColor, String) {
        switch status {
        case .authorized:
            return ("Full Access Granted\nAll photos available for selection", .systemGreen, "✅")
        case .limited:
            return ("Limited Access Granted\nSome photos available for selection", .systemOrange, "⚠️")
        case .denied:
            return ("Access Denied\nNo photos available for selection", .systemRed, "❌")
        case .restricted:
            return ("Access Restricted\nNo photos available for selection", .systemRed, "🔒")
        case .notDetermined:
            return ("Permission Not Requested\nTap 'Request Permission' to enable access", .systemBlue, "❓")
        @unknown default:
            return ("Unknown Permission Status", .systemGray, "❓")
        }
    }
    
    private func setupActionButtons() {
        // Clear existing buttons
        buttonStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        let photoPermissionStatus = PHPhotoLibrary.authorizationStatus()
        
        // Cancel button
        let cancelButton = createButton(title: "Cancel", style: .secondary) { [weak self] in
            self?.dismiss(animated: true) {
                self?.onDismiss?()
            }
        }
        buttonStackView.addArrangedSubview(cancelButton)
        
        // Permission button (if needed)
        if photoPermissionStatus == .notDetermined {
            let permissionButton = createButton(title: "Request Permission", style: .primary) { [weak self] in
                self?.requestPhotoPermission()
            }
            buttonStackView.addArrangedSubview(permissionButton)
        } else {
            // Continue button
            let continueButton = createButton(title: "Continue", style: .primary) { [weak self] in
                self?.completeWithResult()
            }
            buttonStackView.addArrangedSubview(continueButton)
        }
    }
    
    private func createButton(title: String, style: ButtonStyle, action: @escaping () -> Void) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.boldSystemFont(ofSize: 18)
        button.layer.cornerRadius = 25
        
        switch style {
        case .primary:
            button.backgroundColor = UIColor.systemBlue
            button.setTitleColor(.white, for: .normal)
        case .secondary:
            button.backgroundColor = UIColor.secondarySystemBackground
            button.setTitleColor(UIColor.label, for: .normal)
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.separator.cgColor
        }
        
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }
    
    private enum ButtonStyle {
        case primary, secondary
    }
    
    private func requestPhotoPermission() {
        PHPhotoLibrary.requestAuthorization { [weak self] newStatus in
            DispatchQueue.main.async {
                self?.loadEventInfo() // Refresh the UI
                if newStatus != .notDetermined {
                    self?.completeWithResult()
                }
            }
        }
    }
    
    private func createTimezoneComparisonItems() -> [(String, String)] {
        let deviceTimezone = TimeZone.current
        var items: [(String, String)] = []
        
        // Event timezone info
        if let eventTZ = TimeZone(identifier: timezone) {
            let eventOffset = eventTZ.secondsFromGMT() / 3600
            let eventOffsetString = String(format: "UTC%+d", eventOffset)
            items.append(("Event Timezone", "\(timezone) (\(eventOffsetString))"))
        } else {
            items.append(("Event Timezone", "\(timezone) (Invalid/Unknown)"))
        }
        
        // User/Device timezone info
        let deviceOffset = deviceTimezone.secondsFromGMT() / 3600
        let deviceOffsetString = String(format: "UTC%+d", deviceOffset)
        items.append(("Device Timezone", "\(deviceTimezone.identifier) (\(deviceOffsetString))"))
        
        // Timezone difference analysis
        if let eventTZ = TimeZone(identifier: timezone) {
            let offsetDifference = (deviceTimezone.secondsFromGMT() - eventTZ.secondsFromGMT()) / 3600
            let differenceString: String
            
            if offsetDifference == 0 {
                differenceString = "Same timezone"
            } else if offsetDifference > 0 {
                differenceString = "\(offsetDifference) hours ahead of event"
            } else {
                differenceString = "\(abs(offsetDifference)) hours behind event"
            }
            
            items.append(("Timezone Difference", differenceString))
        }
        
        return items
    }
    
    private func completeWithResult() {
        let photoPermissionStatus = PHPhotoLibrary.authorizationStatus()
        let (permissionDescription, _, _) = getPermissionInfo(for: photoPermissionStatus)
        
        let result: [String: Any] = [
            "eventName": eventName,
            "memberId": memberId,
            "eventId": eventId,
            "startDate": startDate,
            "endDate": endDate,
            "timezone": timezone,
            "userTimezone": userTimezone,
            "deviceTimezone": TimeZone.current.identifier,
            "photoCount": photoCount,
            "photoPermissionStatus": photoPermissionStatus.rawValue,
            "photoPermissionDescription": permissionDescription,
            "userAction": "continue"
        ]
        
        dismiss(animated: true) { [weak self] in
            self?.onComplete?(result)
        }
    }
}

// MARK: - RegularPhoto Data Model
struct RegularPhoto {
    let asset: PHAsset
    let localIdentifier: String
    let creationDate: Date
    let modificationDate: Date?
    let pixelWidth: Int
    let pixelHeight: Int
    let location: CLLocation?
}

// MARK: - RegularPhotoPickerViewController
class RegularPhotoPickerViewController: UIViewController {
    private let allowMultipleSelection: Bool
    private let pickerTitle: String
    private let maxSelectionCount: Int
    
    private var allPhotos: [RegularPhoto] = []
    private var selectedPhotos: Set<String> = []
    
    private var collectionView: UICollectionView!
    private var selectAllButton: UIBarButtonItem!
    private var uploadButton: UIBarButtonItem!
    
    var onComplete: (([RegularPhoto]) -> Void)?
    var onCancel: (() -> Void)?
    
    init(allowMultipleSelection: Bool, title: String, maxSelectionCount: Int) {
        self.allowMultipleSelection = allowMultipleSelection
        self.pickerTitle = title
        self.maxSelectionCount = maxSelectionCount
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadAllPhotos()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.systemBackground
        title = pickerTitle
        
        // Navigation bar setup
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
        
        if allowMultipleSelection {
            selectAllButton = UIBarButtonItem(
                title: "Select All",
                style: .plain,
                target: self,
                action: #selector(selectAllTapped)
            )
            
            uploadButton = UIBarButtonItem(
                title: "Upload (0)",
                style: .done,
                target: self,
                action: #selector(uploadTapped)
            )
            uploadButton.isEnabled = false
            
            navigationItem.rightBarButtonItems = [uploadButton, selectAllButton]
        } else {
            navigationItem.rightBarButtonItem = UIBarButtonItem(
                title: "Done",
                style: .done,
                target: self,
                action: #selector(uploadTapped)
            )
        }
        
        // Collection view setup
        let layout = UICollectionViewFlowLayout()
        let itemsPerRow: CGFloat = 3
        let spacing: CGFloat = 2
        let itemSize = (view.bounds.width - spacing * (itemsPerRow + 1)) / itemsPerRow
        
        layout.itemSize = CGSize(width: itemSize, height: itemSize)
        layout.minimumInteritemSpacing = spacing
        layout.minimumLineSpacing = spacing
        layout.sectionInset = UIEdgeInsets(top: spacing, left: spacing, bottom: spacing, right: spacing)
        
        collectionView = UICollectionView(frame: view.bounds, collectionViewLayout: layout)
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.backgroundColor = UIColor.systemBackground
        collectionView.allowsMultipleSelection = allowMultipleSelection
        
        collectionView.register(RegularPhotoCell.self, forCellWithReuseIdentifier: "RegularPhotoCell")
        
        view.addSubview(collectionView)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func loadAllPhotos() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            
            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
            
            let assets = PHAsset.fetchAssets(with: options)
            var photos: [RegularPhoto] = []
            
            assets.enumerateObjects { asset, index, stop in
                let regularPhoto = RegularPhoto(
                    asset: asset,
                    localIdentifier: asset.localIdentifier,
                    creationDate: asset.creationDate ?? Date(),
                    modificationDate: asset.modificationDate,
                    pixelWidth: asset.pixelWidth,
                    pixelHeight: asset.pixelHeight,
                    location: asset.location
                )
                
                photos.append(regularPhoto)
            }
            
            DispatchQueue.main.async {
                self.allPhotos = photos
                self.collectionView.reloadData()
                self.updateUI()
                print("📸 Loaded \(photos.count) photos from device")
            }
        }
    }
    
    private func updateUI() {
        let selectedCount = selectedPhotos.count
        
        if allowMultipleSelection {
            uploadButton.title = "Upload (\(selectedCount))"
            uploadButton.isEnabled = selectedCount > 0
            
            if selectedCount == allPhotos.count && allPhotos.count > 0 {
                selectAllButton.title = "Deselect All"
            } else {
                selectAllButton.title = "Select All"
            }
        }
        
        // Update title with selection limit
        if allowMultipleSelection && selectedCount >= maxSelectionCount {
            title = "\(pickerTitle) (Max \(maxSelectionCount))"
        } else {
            title = pickerTitle
        }
    }
    
    @objc private func cancelTapped() {
        onCancel?()
        dismiss(animated: true)
    }
    
    @objc private func selectAllTapped() {
        if selectedPhotos.count == allPhotos.count && allPhotos.count > 0 {
            // Deselect all
            selectedPhotos.removeAll()
        } else {
            // Select up to max limit
            let photosToSelect = Array(allPhotos.prefix(maxSelectionCount))
            selectedPhotos = Set(photosToSelect.map { $0.localIdentifier })
        }
        
        collectionView.reloadData()
        updateUI()
    }
    
    @objc private func uploadTapped() {
        let selectedRegularPhotos = allPhotos.filter { selectedPhotos.contains($0.localIdentifier) }
        onComplete?(selectedRegularPhotos)
        dismiss(animated: true)
    }
}

// MARK: - RegularPhotoPickerViewController Extensions
extension RegularPhotoPickerViewController: UICollectionViewDataSource, UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return allPhotos.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "RegularPhotoCell", for: indexPath) as! RegularPhotoCell
        let photo = allPhotos[indexPath.item]
        
        cell.configure(
            with: photo,
            isSelected: selectedPhotos.contains(photo.localIdentifier)
        )
        
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let photo = allPhotos[indexPath.item]
        
        if allowMultipleSelection {
            if selectedPhotos.contains(photo.localIdentifier) {
                selectedPhotos.remove(photo.localIdentifier)
            } else {
                // Check selection limit
                if selectedPhotos.count < maxSelectionCount {
                    selectedPhotos.insert(photo.localIdentifier)
                } else {
                    print("⚠️ Maximum selection limit reached: \(maxSelectionCount)")
                    return
                }
            }
            
            collectionView.reloadItems(at: [indexPath])
            updateUI()
        } else {
            selectedPhotos = [photo.localIdentifier]
            uploadTapped()
        }
    }
}

// MARK: - RegularPhotoCell
class RegularPhotoCell: UICollectionViewCell {
    private let imageView = UIImageView()
    private let selectionOverlay = UIView()
    private let checkmarkImageView = UIImageView()
    
    private var imageRequestID: PHImageRequestID?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func prepareForReuse() {
        super.prepareForReuse()
        
        if let requestID = imageRequestID {
            PHImageManager.default().cancelImageRequest(requestID)
        }
        
        imageView.image = nil
        selectionOverlay.isHidden = true
    }
    
    private func setupUI() {
        // Image view
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        contentView.addSubview(imageView)
        
        // Selection overlay
        selectionOverlay.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
        selectionOverlay.isHidden = true
        contentView.addSubview(selectionOverlay)
        
        // Checkmark
        checkmarkImageView.image = UIImage(systemName: "checkmark.circle.fill")
        checkmarkImageView.tintColor = UIColor.systemBlue
        checkmarkImageView.backgroundColor = UIColor.white
        checkmarkImageView.layer.cornerRadius = 12
        selectionOverlay.addSubview(checkmarkImageView)
        
        // Layout
        imageView.translatesAutoresizingMaskIntoConstraints = false
        selectionOverlay.translatesAutoresizingMaskIntoConstraints = false
        checkmarkImageView.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            selectionOverlay.topAnchor.constraint(equalTo: contentView.topAnchor),
            selectionOverlay.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            selectionOverlay.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            selectionOverlay.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            checkmarkImageView.topAnchor.constraint(equalTo: selectionOverlay.topAnchor, constant: 4),
            checkmarkImageView.trailingAnchor.constraint(equalTo: selectionOverlay.trailingAnchor, constant: -4),
            checkmarkImageView.widthAnchor.constraint(equalToConstant: 24),
            checkmarkImageView.heightAnchor.constraint(equalToConstant: 24)
        ])
    }
    
    func configure(with photo: RegularPhoto, isSelected: Bool) {
        // Load thumbnail image
        let imageManager = PHImageManager.default()
        let requestOptions = PHImageRequestOptions()
        requestOptions.deliveryMode = .opportunistic
        requestOptions.isNetworkAccessAllowed = false
        
        imageRequestID = imageManager.requestImage(
            for: photo.asset,
            targetSize: CGSize(width: 200, height: 200),
            contentMode: .aspectFill,
            options: requestOptions
        ) { [weak self] image, _ in
            DispatchQueue.main.async {
                self?.imageView.image = image
            }
        }
        
        // Update selection state
        selectionOverlay.isHidden = !isSelected
    }
}

extension Date {
    func ISO8601String() -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}