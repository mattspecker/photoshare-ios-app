import Foundation
import Photos
import Capacitor
import UIKit

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
        DispatchQueue.main.async { [weak self] in
            guard let bridge = self?.bridge,
                  let viewController = bridge.viewController else {
                call.reject("Unable to present photo picker")
                return
            }
            
            // Get JWT token for API calls
            let jwtToken = AppDelegate.getStoredJwtToken()
            let jwtData = AppDelegate.getStoredJwtData()
            
            let pickerVC = EventPhotoPickerViewController(
                startDate: startDate,
                endDate: endDate,
                eventId: eventId,
                uploadedPhotoIds: Set(uploadedPhotoIds),
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
            call.resolve([
                "photos": processedPhotos,
                "count": processedPhotos.count
            ])
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
            let photos = self.fetchEventPhotos(
                startDate: startDate,
                endDate: endDate,
                uploadedPhotoIds: Set(uploadedPhotoIds)
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
    
    private func fetchEventPhotos(startDate: Date, endDate: Date, uploadedPhotoIds: Set<String>) -> [EventPhoto] {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate <= %@ AND mediaType == %d",
                                       startDate as NSDate,
                                       endDate as NSDate,
                                       PHAssetMediaType.image.rawValue)
        
        let assets = PHAsset.fetchAssets(with: options)
        var eventPhotos: [EventPhoto] = []
        
        assets.enumerateObjects { asset, index, stop in
            let isUploaded = uploadedPhotoIds.contains(asset.localIdentifier)
            
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
    private let uploadedPhotoIds: Set<String>
    private let allowMultipleSelection: Bool
    private let pickerTitle: String
    private let jwtToken: String?
    private let jwtData: [String: Any]?
    
    private var eventPhotos: [EventPhoto] = []
    private var selectedPhotos: Set<String> = []
    
    private var collectionView: UICollectionView!
    private var selectAllButton: UIBarButtonItem!
    private var uploadButton: UIBarButtonItem!
    private var toolbarView: UIView!
    private var selectAllToolbarButton: UIButton!
    private var uploadToolbarButton: UIButton!
    
    var onComplete: (([EventPhoto]) -> Void)?
    var onCancel: (() -> Void)?
    
    init(startDate: Date, endDate: Date, eventId: String, uploadedPhotoIds: Set<String>, allowMultipleSelection: Bool, title: String, jwtToken: String? = nil, jwtData: [String: Any]? = nil) {
        self.startDate = startDate
        self.endDate = endDate
        self.eventId = eventId
        self.uploadedPhotoIds = uploadedPhotoIds
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
    
    private func loadEventPhotos() {
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
            
            assets.enumerateObjects { asset, index, stop in
                let isUploaded = self.uploadedPhotoIds.contains(asset.localIdentifier)
                
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
            
            DispatchQueue.main.async {
                self.eventPhotos = photos
                self.collectionView.reloadData()
                self.updateUI()
            }
        }
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
        startPhotoUpload(photos: selectedEventPhotos)
    }
    
    // MARK: - Photo Upload Implementation
    
    private func startPhotoUpload(photos: [EventPhoto]) {
        print("🚀 Starting upload of \(photos.count) photos to event: \(eventId)")
        
        // Show upload progress dialog
        showUploadProgressDialog(totalPhotos: photos.count)
        
        // Start upload in background queue
        DispatchQueue.global(qos: .userInitiated).async {
            self.uploadPhotosSequentially(photos: photos)
        }
    }
    
    private var uploadProgressAlert: UIAlertController?
    private var cancelUpload = false
    
    private func showUploadProgressDialog(totalPhotos: Int) {
        DispatchQueue.main.async {
            // Dismiss any existing progress dialog
            if let existingAlert = self.uploadProgressAlert {
                existingAlert.dismiss(animated: false, completion: nil)
            }
            
            // Create progress alert
            let alert = UIAlertController(
                title: "Uploading Photos",
                message: "Preparing upload...",
                preferredStyle: .alert
            )
            
            // Add cancel button
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                print("📤 Upload cancelled by user")
                self.cancelUpload = true
            })
            
            self.uploadProgressAlert = alert
            self.present(alert, animated: true)
        }
    }
    
    private func updateUploadProgress(current: Int, total: Int, photoName: String) {
        DispatchQueue.main.async {
            guard let alert = self.uploadProgressAlert else { return }
            
            let progress = "\(current)/\(total)"
            alert.title = "Uploading Photos (\(progress))"
            alert.message = "Uploading: \(photoName)"
        }
    }
    
    private func uploadPhotosSequentially(photos: [EventPhoto]) {
        var successCount = 0
        var failCount = 0
        var failedPhotos: [String] = []
        
        for (index, photo) in photos.enumerated() {
            // Check for cancellation
            if cancelUpload {
                print("📤 Upload cancelled by user")
                break
            }
            
            let currentIndex = index + 1
            let photoName = "Photo_\(currentIndex)"
            
            // Update progress
            updateUploadProgress(current: currentIndex, total: photos.count, photoName: photoName)
            
            // Upload this photo
            let uploadSuccess = uploadSinglePhoto(photo: photo, photoName: photoName)
            
            if uploadSuccess {
                successCount += 1
                print("✅ Photo \(currentIndex)/\(photos.count) uploaded successfully")
            } else {
                failCount += 1
                failedPhotos.append(photoName)
                print("❌ Photo \(currentIndex)/\(photos.count) upload failed")
            }
        }
        
        // Show results
        DispatchQueue.main.async {
            self.showUploadResults(successCount: successCount, failCount: failCount, failedPhotos: failedPhotos)
        }
    }
    
    private func uploadSinglePhoto(photo: EventPhoto, photoName: String) -> Bool {
        print("📤 Uploading photo: \(photoName)")
        
        // Step 1: Convert photo to base64
        guard let base64Data = convertPhotoToBase64(photo: photo) else {
            print("❌ Failed to convert photo to base64")
            return false
        }
        
        // Step 2: Get JWT token
        guard let jwtToken = getJwtTokenForUpload() else {
            print("❌ No JWT token available for upload")
            return false
        }
        
        // Step 3: Build upload request
        guard let requestBody = buildUploadRequestBody(photo: photo, base64Data: base64Data, photoName: photoName) else {
            print("❌ Failed to build request body")
            return false
        }
        
        // Step 4: Send upload request
        return sendUploadRequest(jwtToken: jwtToken, requestBody: requestBody)
    }
    
    private func convertPhotoToBase64(photo: EventPhoto) -> String? {
        let semaphore = DispatchSemaphore(value: 0)
        var base64Result: String?
        
        let options = PHImageRequestOptions()
        options.isSynchronous = false
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
        
        // Request full resolution image
        PHImageManager.default().requestImageDataAndOrientation(for: photo.asset, options: options) { (imageData, dataUTI, orientation, info) in
            defer { semaphore.signal() }
            
            guard let data = imageData else {
                print("❌ Failed to get image data")
                return
            }
            
            // Convert to base64
            base64Result = data.base64EncodedString()
            print("✅ Converted photo to base64 (size: \(base64Result?.count ?? 0) chars)")
        }
        
        // Wait for async request to complete (with timeout)
        let timeout = DispatchTime.now() + .seconds(30)
        let result = semaphore.wait(timeout: timeout)
        
        if result == .timedOut {
            print("❌ Photo conversion timed out")
            return nil
        }
        
        return base64Result
    }
    
    private func getJwtTokenForUpload() -> String? {
        print("🔄 Getting JWT token for upload - checking freshness like Android...")
        
        // Priority 1: Fresh JWT token with timestamp check (Android pattern)
        if let tokenData = AppDelegate.getStoredJwtData(),
           let storedToken = tokenData["token"] as? String,
           let retrievedAt = tokenData["retrievedAt"] as? TimeInterval {
            
            let tokenAge = Date().timeIntervalSince1970 - retrievedAt
            print("🔍 Stored token age: \(Int(tokenAge)) seconds")
            
            // Fresh token must be less than 5 minutes old (300 seconds) like Android
            if tokenAge < 300 {
                print("✅ Using fresh JWT token from storage (age: \(Int(tokenAge))s, length: \(storedToken.count))")
                return storedToken
            } else {
                print("⚠️ Stored JWT token is expired (age: \(Int(tokenAge))s > 300s)")
                print("🔄 Triggering background JWT refresh for future uploads...")
                AppDelegate.refreshJwtTokenIfNeeded()
            }
        } else {
            print("⚠️ No stored JWT token data found, triggering refresh...")
            AppDelegate.refreshJwtTokenIfNeeded()
        }
        
        // Priority 2: Instance JWT token (from EventPhotoPicker initialization)
        if let instanceToken = jwtToken {
            print("✅ Using instance JWT token as fallback (length: \(instanceToken.count))")
            return instanceToken
        }
        
        // Priority 3: Any stored token as last resort (even if expired)
        if let fallbackToken = AppDelegate.getStoredJwtToken() {
            print("⚠️ Using potentially expired JWT token as last resort (length: \(fallbackToken.count))")
            return fallbackToken
        }
        
        print("❌ No JWT token available at all")
        return nil
    }
    
    private func getDeviceIdentifier() -> String? {
        // Create a unique device identifier based on device info
        let deviceInfo = UIDevice.current
        let deviceName = deviceInfo.name
        let systemVersion = deviceInfo.systemVersion
        let model = deviceInfo.model
        
        // Create a simple device ID (in production, you might want to use Keychain for persistence)
        let deviceId = "\(model)-\(deviceName.prefix(8))-\(systemVersion)".replacingOccurrences(of: " ", with: "")
        return deviceId
    }
    
    private func buildUploadRequestBody(photo: EventPhoto, base64Data: String, photoName: String) -> Data? {
        do {
            // Extract clean event ID
            var cleanEventId = eventId
            if eventId.contains("/event/") {
                if let range = eventId.range(of: "/event/") {
                    cleanEventId = String(eventId[range.upperBound...])
                    print("🔧 Extracted clean event ID: '\(cleanEventId)'")
                }
            }
            
            // Build JSON request body
            var requestDict: [String: Any] = [
                "eventId": cleanEventId,
                "fileName": photoName,
                "fileData": base64Data,
                "mediaType": "photo"
            ]
            
            // Add timestamp as ISO string if available
            let isoFormatter = ISO8601DateFormatter()
            isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            requestDict["originalTimestamp"] = isoFormatter.string(from: photo.creationDate)
            
            // Add device ID
            if let deviceId = getDeviceIdentifier() {
                requestDict["deviceId"] = deviceId
            }
            
            // Add metadata object with location and other info
            var metadata: [String: Any] = [
                "source": "native-plugin",
                "platform": "ios",
                "pixelWidth": photo.pixelWidth,
                "pixelHeight": photo.pixelHeight
            ]
            
            // Add location to metadata if available
            if let location = photo.location {
                metadata["location"] = [
                    "latitude": location.coordinate.latitude,
                    "longitude": location.coordinate.longitude
                ]
            }
            
            requestDict["metadata"] = metadata
            
            // Convert to JSON data
            let jsonData = try JSONSerialization.data(withJSONObject: requestDict, options: [])
            print("📦 Built upload request (size: \(jsonData.count) bytes)")
            
            return jsonData
            
        } catch {
            print("❌ Failed to build request body: \(error)")
            return nil
        }
    }
    
    private func sendUploadRequest(jwtToken: String, requestBody: Data) -> Bool {
        guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/mobile-upload") else {
            print("❌ Invalid upload URL")
            return false
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var uploadSuccess = false
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY", forHTTPHeaderField: "apikey")
        request.setValue("ios", forHTTPHeaderField: "X-Client-Platform")
        request.setValue("native-plugin", forHTTPHeaderField: "X-Upload-Source")
        request.setValue("1.0.0", forHTTPHeaderField: "X-Client-Version")
        request.timeoutInterval = 90 // 90 seconds timeout for large uploads
        request.httpBody = requestBody
        
        print("📡 Sending upload request to: \(url.absoluteString)")
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }
            
            if let error = error {
                print("❌ Upload request failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ Invalid response type")
                return
            }
            
            print("📨 Upload response code: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode == 200 {
                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    print("✅ Upload successful: \(responseString)")
                    
                    // Try to parse the response to get more details
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = json["success"] as? Bool,
                       success {
                        
                        if let duplicate = json["duplicate"] as? Bool, duplicate {
                            print("🔄 Duplicate photo detected, skipped upload")
                        } else if let mediaId = json["mediaId"] as? String,
                                  let fileUrl = json["fileUrl"] as? String {
                            print("🎉 New upload successful - Media ID: \(mediaId)")
                            print("📎 File URL: \(fileUrl)")
                        }
                    }
                }
                uploadSuccess = true
            } else {
                // Handle error response
                var errorMessage = "Unknown error"
                if let data = data, let errorString = String(data: data, encoding: .utf8) {
                    errorMessage = errorString
                }
                
                print("❌ Upload failed with code \(httpResponse.statusCode): \(errorMessage)")
                
                // Handle specific error codes according to API spec
                switch httpResponse.statusCode {
                case 400:
                    print("❌ Bad Request: Missing required fields")
                case 401:
                    print("❌ Unauthorized: JWT token is invalid or expired")
                case 403:
                    print("❌ Forbidden: Not authorized for this event")
                case 413:
                    print("❌ File too large: Maximum 10MB for photos")
                case 429:
                    print("❌ Rate limit exceeded: Too many uploads")
                case 507:
                    print("❌ Storage quota exceeded: Event storage full")
                case 500:
                    print("❌ Server error: Please try again")
                default:
                    print("❌ Unexpected error code: \(httpResponse.statusCode)")
                }
            }
        }
        
        task.resume()
        
        // Wait for request to complete (with timeout)
        let timeout = DispatchTime.now() + .seconds(90)
        let result = semaphore.wait(timeout: timeout)
        
        if result == .timedOut {
            print("❌ Upload request timed out")
            task.cancel()
            return false
        }
        
        return uploadSuccess
    }
    
    private func showUploadResults(successCount: Int, failCount: Int, failedPhotos: [String]) {
        // Dismiss progress dialog
        uploadProgressAlert?.dismiss(animated: true)
        uploadProgressAlert = nil
        
        // Build result message
        var message = "Upload Complete!\n\n"
        
        if successCount > 0 {
            message += "✅ \(successCount) photo"
            if successCount > 1 { message += "s" }
            message += " uploaded successfully\n"
        }
        
        if failCount > 0 {
            message += "❌ \(failCount) photo"
            if failCount > 1 { message += "s" }
            message += " failed to upload\n"
            
            if !failedPhotos.isEmpty {
                message += "\nFailed photos:\n"
                for photoName in failedPhotos {
                    message += "• \(photoName)\n"
                }
            }
        }
        
        // Show results dialog
        let alert = UIAlertController(
            title: "Upload Results",
            message: message,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            if successCount > 0 {
                // Clear selection and close if any uploads succeeded
                self.selectedPhotos.removeAll()
                self.collectionView.reloadData()
                
                // Call completion callback with successful uploads (for compatibility)
                let successfulPhotos = self.eventPhotos.filter { photo in
                    // This is a simplified approach - in a real implementation,
                    // we'd track which specific photos succeeded
                    return successCount > 0
                }
                self.onComplete?(successfulPhotos)
                self.dismiss(animated: true)
            }
        })
        
        present(alert, animated: true)
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UICollectionViewDataSource & Delegate
extension EventPhotoPickerViewController: UICollectionViewDataSource, UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return eventPhotos.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "EventPhotoCell", for: indexPath) as! EventPhotoCell
        let photo = eventPhotos[indexPath.item]
        
        cell.configure(
            with: photo,
            isSelected: selectedPhotos.contains(photo.localIdentifier),
            isUploaded: photo.isUploaded
        )
        
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let photo = eventPhotos[indexPath.item]
        
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