import Foundation
import Photos
import Capacitor
import UIKit
import CryptoKit
import Network
import SystemConfiguration

@objc(AutoUploadPlugin)
public class AutoUploadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AutoUploadPlugin"
    public let jsName = "AutoUpload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getUserEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkUploadedPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanForPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showScanningOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideScanningOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUploadProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startAutoUploadFlow", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    private var uploadProgress: [String: Any] = [:]
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        NSLog("🚀 AutoUploadPlugin loaded successfully!")
        NSLog("🚀 Available methods: getUserEvents, checkUploadedPhotos, scanForPhotos, showScanningOverlay, uploadPhotos, getUploadProgress")
        
        // Initialize upload progress tracking
        initializeUploadProgress()
        
        // Listen for app resume events
        setupAppResumeListener()
    }
    
    /// Setup listener for app resume events
    private func setupAppResumeListener() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NSLog("🔔 AutoUpload: App resume listener setup complete")
    }
    
    /// Called when app becomes active (resume from background)
    @objc private func appDidBecomeActive() {
        NSLog("🔄 AutoUpload: App resumed - triggering auto Supabase token check")
        Task {
            await triggerAutoSupabaseTokenCheck()
        }
    }
    
    /// Automatically trigger Supabase token retrieval and sequential event scanning
    private func triggerAutoSupabaseTokenCheck() async {
        NSLog("🔐 AutoUpload: Getting Supabase session token...")
        
        NSLog("🔍 AutoUpload: Checking webView availability...")
        if bridge?.webView != nil {
            NSLog("✅ WebView is available")
        } else {
            NSLog("❌ WebView is NOT available")
            return
        }
        
        // Give the page a moment to initialize before checking auth bridge
        NSLog("⏳ Giving page time to initialize...")
        try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 second initial delay
        
        // Check global auto-upload settings FIRST before proceeding
        NSLog("⚙️ Checking global auto-upload settings before proceeding...")
        let globalSettings = await getGlobalAutoUploadSettings()
        
        // Check if auto-upload is globally disabled
        if !globalSettings.isEnabled {
            NSLog("❌ Auto-upload is globally disabled - stopping resume flow")
            return
        }
        
        // Check WiFi-only requirement
        if globalSettings.wifiOnly {
            let isOnWiFi = await checkWiFiConnection()
            if !isOnWiFi {
                NSLog("❌ WiFi-only mode enabled but device is on cellular - stopping resume flow")
                return
            }
            NSLog("✅ WiFi-only mode enabled and device is on WiFi")
        }
        
        NSLog("✅ Global auto-upload settings validated - proceeding with token check")
        
        // Use efficient polling to wait for auth bridge readiness
        NSLog("⏳ Waiting for auth bridge to be ready...")
        let authReady = await waitForAuthBridge(maxWaitSeconds: 15)
        
        if !authReady {
            NSLog("❌ Auth bridge timeout - unable to get token")
            return
        }
        
        // Auth bridge is ready, get the token
        NSLog("🔍 AutoUpload: Calling getSupabaseSessionData()...")
        let (token, userId) = await getSupabaseSessionData()
        
        if let tokenValue = token, let userIdValue = userId {
            NSLog("✅ Supabase token obtained")
            NSLog("👤 User ID: \(userIdValue)")
            NSLog("🔐 Token preview: \(String(tokenValue.prefix(20)))...")
            
            // Start the sequential event scanning flow
            await startSequentialEventScanning(supabaseToken: tokenValue, userId: userIdValue)
        } else {
            NSLog("❌ Failed to get Supabase token - auth bridge ready but no valid session")
        }
    }
    
    /// Start sequential event scanning flow: getUserEvents → show overlay → scan each event → close overlay
    private func startSequentialEventScanning(supabaseToken: String, userId: String) async {
        NSLog("🎯 AUTO-RESUME: Starting sequential event scanning flow...")
        
        // Check if we're already in an upload process
        if uploadProgress["uploadInProgress"] as? Bool == true {
            NSLog("⚠️ Upload already in progress, skipping scanning flow")
            return
        }
        
        // Set scanning mode to prevent other overlays
        uploadProgress["scanningMode"] = true
        saveUploadProgress()
        
        // Step 1: Get all user events
        NSLog("🎯 AUTO-RESUME: Calling getUserEvents...")
        let events = await fetchUserEventsFromAPI(supabaseToken: supabaseToken, userId: userId)
        NSLog("📊 AUTO-RESUME: Found \(events.count) events for auto-upload")
        
        // Log event details for debugging
        for (index, event) in events.enumerated() {
            if let eventName = event["name"] as? String,
               let eventId = event["event_id"] as? String,
               let status = event["status"] as? String {
                NSLog("📅 Event \(index + 1): '\(eventName)' (\(eventId)) - Status: \(status)")
            }
        }
        
        // If no events, exit early
        if events.isEmpty {
            NSLog("📊 No events found for auto-upload scanning")
            return
        }
        
        // Step 2: Show scanning overlay (persistent throughout all events)
        NSLog("🔄 Starting scanning overlay for all events...")
        
        // Add a small delay to ensure the webview is ready
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
        
        await showScanningOverlayForAllEvents()
        
        // Step 3: Process each event sequentially
        for (index, event) in events.enumerated() {
            guard let eventName = event["name"] as? String,
                  let eventId = event["event_id"] as? String else {
                NSLog("⚠️ Skipping event \(index + 1) - missing name or ID")
                continue
            }
            
            NSLog("🔍 Processing event \(index + 1)/\(events.count): '\(eventName)' (\(eventId))")
            
            // Update overlay message for current event
            await updateScanningOverlayMessage(eventName: eventName, current: index + 1, total: events.count)
            
            // Scan this specific event
            let newPhotosCount = await scanSingleEventForUploads(
                event: event, 
                supabaseToken: supabaseToken, 
                userId: userId
            )
            
            // Log the result for this event
            NSLog("📤 Uploading \(newPhotosCount) images for \(eventName)")
        }
        
        // Step 4: Hide scanning overlay when all events are processed
        NSLog("✅ All events scanned - hiding scanning overlay")
        await hideScanningOverlayAfterAllEvents()
        
        // Clear scanning mode
        uploadProgress["scanningMode"] = false
        saveUploadProgress()
        
        NSLog("🎯 Sequential event scanning flow completed - ready for upload phase")
    }
    
    /// Show scanning overlay for processing all events
    private func showScanningOverlayForAllEvents() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        console.log('🔍 AutoUpload: Starting sequential event scanning overlay...');
                        
                        // Try UploadStatusOverlay first for smaller overlay
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            console.log('✅ AutoUpload: Using UploadStatusOverlay for smaller overlay');
                            
                            // Hide any existing overlay first
                            try {
                                window.Capacitor.Plugins.UploadStatusOverlay.hideOverlay();
                            } catch (e) {}
                            
                            // Show the overlay with custom title
                            window.Capacitor.Plugins.UploadStatusOverlay.showOverlay({ 
                                title: 'Scanning for photos...' 
                            });
                            
                            // Try different parameters to override the title
                            console.log('🔍 Testing UploadStatusOverlay parameters...');
                            
                            // Try multiple approaches to change the title
                            try {
                                // Method 1: Try with title parameter
                                window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                    completed: 0,
                                    total: 0,
                                    title: 'Scanning for photos...',
                                    message: 'Scanning for photos...',
                                    status: 'scanning'
                                });
                                console.log('✅ Method 1: title parameter attempted');
                            } catch (e) {
                                console.log('❌ Method 1 failed:', e);
                            }
                            
                            // Method 2: Try with different function if available
                            setTimeout(() => {
                                try {
                                    if (window.Capacitor.Plugins.UploadStatusOverlay.setTitle) {
                                        window.Capacitor.Plugins.UploadStatusOverlay.setTitle('Scanning for photos...');
                                        console.log('✅ Method 2: setTitle attempted');
                                    }
                                } catch (e) {
                                    console.log('❌ Method 2 failed:', e);
                                }
                            }, 100);
                            
                            console.log('✅ AutoUpload: Small scanning overlay started');
                            return { success: true, method: 'UploadStatusOverlay' };
                        }
                        
                        // Fallback: Skip large modal overlay
                        console.log('📱 AutoUpload: Creating fallback HTML overlay...');
                        
                        try {
                            // First, let's test if we can manipulate the DOM
                            console.log('🔍 Testing DOM access...');
                            console.log('document.body exists:', !!document.body);
                            console.log('document.createElement works:', !!document.createElement('div'));
                            
                            // Create a very simple overlay first
                            let overlay = document.getElementById('autoUploadScanOverlay');
                            if (overlay) {
                                console.log('📱 Removing existing overlay');
                                overlay.remove();
                            }
                            
                            console.log('📱 Creating new overlay element...');
                            overlay = document.createElement('div');
                            overlay.id = 'autoUploadScanOverlay';
                            
                            // Use simpler inline styles
                            overlay.style.position = 'fixed';
                            overlay.style.top = '0';
                            overlay.style.left = '0';
                            overlay.style.width = '100%';
                            overlay.style.height = '100%';
                            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                            overlay.style.display = 'flex';
                            overlay.style.justifyContent = 'center';
                            overlay.style.alignItems = 'center';
                            overlay.style.zIndex = '99999';
                            overlay.style.fontFamily = 'Arial, sans-serif';
                            
                            console.log('📱 Creating content div...');
                            const content = document.createElement('div');
                            content.style.backgroundColor = 'white';
                            content.style.padding = '40px';
                            content.style.borderRadius = '15px';
                            content.style.textAlign = 'center';
                            content.style.maxWidth = '300px';
                            content.style.fontSize = '18px';
                            content.style.color = '#333';
                            
                            console.log('📱 Creating message element...');
                            const message = document.createElement('div');
                            message.id = 'autoUploadScanMessage';
                            message.textContent = 'Scanning for photos...';
                            message.style.marginBottom = '20px';
                            message.style.fontSize = '18px';
                            message.style.fontWeight = '500';
                            
                            console.log('📱 Assembling overlay...');
                            content.appendChild(message);
                            overlay.appendChild(content);
                            
                            console.log('📱 Appending to document.body...');
                            document.body.appendChild(overlay);
                            
                            console.log('📱 Starting animation...');
                            // Start animated dots for message
                            let dotCount = 0;
                            const baseMessage = 'Scanning for photos';
                            
                            window.autoUploadScanAnimation = setInterval(() => {
                                const dots = '.'.repeat((dotCount % 4) || 1);
                                const animatedMessage = baseMessage + dots;
                                const messageEl = document.getElementById('autoUploadScanMessage');
                                if (messageEl) {
                                    messageEl.textContent = animatedMessage;
                                }
                                dotCount++;
                            }, 500);
                            
                            console.log('✅ AutoUpload: Fallback HTML overlay created and animated successfully');
                            return { success: true, method: 'fallback' };
                        } catch (error) {
                            console.error('❌ Failed to create fallback overlay:', error);
                            
                            // Last resort: just alert
                            alert('Scanning for photos...');
                            return { success: true, method: 'alert' };
                        }
                    })();
                """) { result, error in
                    if let error = error {
                        NSLog("❌ Failed to show scanning overlay: \(error)")
                    } else {
                        NSLog("✅ Scanning overlay shown for sequential event processing")
                    }
                    continuation.resume()
                }
            }
        }
    }
    
    /// Update scanning overlay message for current event
    private func updateScanningOverlayMessage(eventName: String, current: Int, total: Int) async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        console.log('🔄 AutoUpload: Updating scanning overlay for event: \(eventName)');
                        
                        // Stop the previous animation
                        if (window.autoUploadScanAnimation) {
                            clearInterval(window.autoUploadScanAnimation);
                        }
                        
                        // Try UploadStatusOverlay first for smaller overlay
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            console.log('✅ AutoUpload: Updating small overlay for \(eventName)');
                            
                            // Update with scanning message
                            window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                completed: 0,
                                total: 0,
                                title: 'Scanning \(eventName)...',
                                message: 'Scanning \(eventName)...',
                                status: 'scanning'
                            });
                            
                            console.log('✅ AutoUpload: Small overlay updated for \(eventName)');
                            return { success: true, method: 'UploadStatusOverlay' };
                        }
                        
                        // Fallback: Use HTML overlay for event updates
                        const messageElement = document.getElementById('autoUploadScanMessage');
                        if (messageElement) {
                            console.log('📱 AutoUpload: Updating fallback HTML overlay for \(eventName)');
                            
                            // Update with static message (no animation)
                            messageElement.textContent = 'Scanning \(eventName)...';
                            
                            console.log('✅ AutoUpload: Fallback overlay updated for \(eventName)');
                            return { success: true, method: 'fallback' };
                        } else {
                            console.log('❌ AutoUpload: No overlay available for update');
                            return { success: false };
                        }
                    })();
                """) { result, error in
                    if let error = error {
                        NSLog("❌ Failed to update scanning overlay: \(error)")
                    }
                    continuation.resume()
                }
            }
        }
    }
    
    /// Update overlay to upload mode
    private func updateOverlayToUploadMode(eventName: String, total: Int) async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        console.log('📤 Switching to upload mode for \(eventName)...');
                        
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            // Update overlay to show upload progress
                            window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                completed: 0,
                                total: \(total),
                                title: 'Uploading Photos',
                                message: 'Uploading for \(eventName)'
                            });
                            
                            console.log('✅ Switched to upload mode (0/\(total))');
                            return { success: true };
                        }
                        return { success: false };
                    })();
                """) { _, _ in
                    continuation.resume()
                }
            }
        }
    }
    
    /// Upload photos for an event with progress tracking
    private func uploadPhotosForEvent(photos: [[String: Any]], eventId: String, eventName: String, jwtToken: String) async -> Int {
        var uploadedCount = 0
        let total = photos.count
        
        for (index, photo) in photos.enumerated() {
            guard let localIdentifier = photo["localIdentifier"] as? String else {
                NSLog("⚠️ Skipping photo without localIdentifier")
                continue
            }
            
            NSLog("📤 Uploading photo \(index + 1)/\(total) for \(eventName)")
            
            // Get photo thumbnail and update overlay with it
            if let thumbnailData = await getPhotoThumbnail(localIdentifier: localIdentifier) {
                await updateUploadProgressWithThumbnail(current: index + 1, total: total, eventName: eventName, thumbnailData: thumbnailData)
            } else {
                await updateUploadProgress(current: index + 1, total: total, eventName: eventName)
            }
            
            // Get photo data and upload
            let success = await uploadSinglePhotoWithRetry(
                localIdentifier: localIdentifier,
                eventId: eventId,
                jwtToken: jwtToken,
                retryCount: 1
            )
            
            if success {
                uploadedCount += 1
                NSLog("✅ Photo \(index + 1)/\(total) uploaded successfully")
            } else {
                NSLog("❌ Photo \(index + 1)/\(total) upload failed after retry")
            }
        }
        
        return uploadedCount
    }
    
    /// Get photo thumbnail
    private func getPhotoThumbnail(localIdentifier: String) async -> Data? {
        return await withCheckedContinuation { continuation in
            let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
            guard let asset = fetchResult.firstObject else {
                continuation.resume(returning: nil)
                return
            }
            
            let options = PHImageRequestOptions()
            options.isSynchronous = false
            options.deliveryMode = .fastFormat
            
            let targetSize = CGSize(width: 100, height: 100) // Small thumbnail
            
            PHImageManager.default().requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: options) { image, _ in
                if let image = image,
                   let data = image.jpegData(compressionQuality: 0.5) {
                    continuation.resume(returning: data)
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }
    
    /// Update upload progress with thumbnail
    private func updateUploadProgressWithThumbnail(current: Int, total: Int, eventName: String, thumbnailData: Data) async {
        let base64Thumbnail = thumbnailData.base64EncodedString()
        
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            // Update progress
                            window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                completed: \(current),
                                total: \(total),
                                title: 'Uploading Photos',
                                message: 'Uploading for \(eventName)'
                            });
                            
                            // Add photo thumbnail
                            window.Capacitor.Plugins.UploadStatusOverlay.addPhoto({
                                thumbnail: '\(base64Thumbnail)'
                            });
                        }
                        return true;
                    })();
                """) { _, _ in
                    continuation.resume()
                }
            }
        }
    }
    
    /// Update upload progress in overlay
    private func updateUploadProgress(current: Int, total: Int, eventName: String) async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                completed: \(current),
                                total: \(total),
                                title: 'Uploading Photos',
                                message: 'Uploading for \(eventName)'
                            });
                        }
                        return true;
                    })();
                """) { _, _ in
                    continuation.resume()
                }
            }
        }
    }
    
    /// Upload a single photo with retry logic and Cloudflare block handling
    private func uploadSinglePhotoWithRetry(localIdentifier: String, eventId: String, jwtToken: String, retryCount: Int) async -> Bool {
        // Try to upload
        let success = await performPhotoUpload(localIdentifier: localIdentifier, eventId: eventId, jwtToken: jwtToken)
        
        if !success && retryCount > 0 {
            NSLog("🔄 Retrying upload for photo \(localIdentifier)...")
            
            // Add exponential backoff delay (similar to web retry logic)
            let maxRetries = 3
            let attempt = maxRetries - retryCount + 1
            let baseDelay = 1.0 // 1 second base delay
            let exponentialDelay = baseDelay * pow(2.0, Double(attempt - 1))
            let jitteredDelay = exponentialDelay * (0.5 + Double.random(in: 0...0.5)) // Add jitter
            
            NSLog("⏳ Waiting \(String(format: "%.1f", jitteredDelay))s before retry (attempt \(attempt)/\(maxRetries))")
            try? await Task.sleep(nanoseconds: UInt64(jitteredDelay * 1_000_000_000))
            
            return await uploadSinglePhotoWithRetry(localIdentifier: localIdentifier, eventId: eventId, jwtToken: jwtToken, retryCount: retryCount - 1)
        }
        
        return success
    }
    
    /// Perform actual photo upload to API
    private func performPhotoUpload(localIdentifier: String, eventId: String, jwtToken: String) async -> Bool {
        // Get additional photo metadata
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        guard let asset = fetchResult.firstObject else {
            NSLog("❌ Failed to fetch PHAsset for upload: \(localIdentifier)")
            return false
        }
        
        // Create a photo dictionary with all required metadata
        let photo: [String: Any] = [
            "localIdentifier": localIdentifier,
            "filename": "IMG_\(localIdentifier.suffix(8)).jpg",
            "id": localIdentifier,
            "creationDate": asset.creationDate?.timeIntervalSince1970 ?? Date().timeIntervalSince1970,
            "pixelWidth": asset.pixelWidth,
            "pixelHeight": asset.pixelHeight
        ]
        
        // Use the existing uploadSinglePhoto implementation
        let result = await uploadSinglePhoto(
            photo: photo,
            eventId: eventId,
            jwtToken: jwtToken,
            index: 1,
            total: 1
        )
        
        // Check if upload was successful
        let status = result["status"] as? String
        return status == "success"
    }
    
    /// Hide scanning overlay after all events are processed
    private func hideScanningOverlayAfterAllEvents() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        console.log('🔍 AutoUpload: Hiding scanning overlay after all events processed');
                        
                        // Stop the animated dots animation
                        if (window.autoUploadScanAnimation) {
                            clearInterval(window.autoUploadScanAnimation);
                            window.autoUploadScanAnimation = null;
                            console.log('✅ AutoUpload: Scan dot animation stopped');
                        }
                        
                        // Try to hide UploadStatusOverlay first
                        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                            window.Capacitor.Plugins.UploadStatusOverlay.hideOverlay();
                            console.log('✅ AutoUpload: Small UploadStatusOverlay hidden');
                            return { success: true, method: 'UploadStatusOverlay' };
                        }
                        
                        // Fallback: Hide HTML overlay
                        const overlay = document.getElementById('autoUploadScanOverlay');
                        if (overlay) {
                            overlay.style.display = 'none';
                            console.log('✅ AutoUpload: Fallback HTML overlay hidden');
                            return { success: true, method: 'fallback' };
                        } else {
                            console.log('❌ AutoUpload: No overlay found to hide');
                            return { success: false };
                        }
                    })();
                """) { result, error in
                    if let error = error {
                        NSLog("❌ Failed to hide scanning overlay: \(error)")
                    } else {
                        NSLog("✅ Scanning overlay hidden after sequential processing")
                    }
                    continuation.resume()
                }
            }
        }
    }
    
    /// Scan a single event for photos ready for upload
    private func scanSingleEventForUploads(event: [String: Any], supabaseToken: String, userId: String) async -> Int {
        guard let eventName = event["name"] as? String,
              let eventId = event["event_id"] as? String,
              let startTimeString = event["start_time"] as? String,
              let endTimeString = event["end_time"] as? String else {
            NSLog("❌ Missing required event data for scanning")
            return 0
        }
        
        NSLog("🔍 Scanning event: '\(eventName)' (\(eventId))")
        NSLog("📅 Event dates: \(startTimeString) to \(endTimeString)")
        
        // Parse event dates
        let dateFormatter = ISO8601DateFormatter()
        guard let startDate = dateFormatter.date(from: startTimeString),
              let endDate = dateFormatter.date(from: endTimeString) else {
            NSLog("❌ Failed to parse event dates for \(eventName)")
            return 0
        }
        
        // Get JWT token for API calls
        var jwtToken: String? = AppDelegate.getStoredJwtToken()
        
        if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
            NSLog("🔄 Refreshing JWT token for \(eventName)...")
            AppDelegate.refreshJwtTokenIfNeeded()
            jwtToken = AppDelegate.getStoredJwtToken()
        }
        
        guard let token = jwtToken else {
            NSLog("❌ No JWT token available for scanning \(eventName)")
            return 0
        }
        
        NSLog("🔐 Using JWT token for \(eventName): \(token.prefix(20))...")
        
        // Step 1: Check uploaded photos for this event
        NSLog("📋 Checking uploaded photos for \(eventName)...")
        let uploadedPhotos = await fetchUploadedPhotosFromAPI(eventId: eventId, jwtToken: token)
        
        // Create hash map for duplicate detection
        var photoHashMap: [String: Bool] = [:]
        for uploadedPhoto in uploadedPhotos {
            if let fileHash = uploadedPhoto["file_hash"] as? String {
                photoHashMap[fileHash] = true
            }
        }
        
        NSLog("🔍 Found \(uploadedPhotos.count) uploaded photos for \(eventName)")
        NSLog("🗺️ Created hash map with \(photoHashMap.count) hashes for duplicate detection")
        
        // Step 2: Scan device photos for this event's date range
        NSLog("📸 Scanning device photos for \(eventName) from \(startDate) to \(endDate)")
        let scannedPhotos = await scanDevicePhotos(
            startDate: startDate,
            endDate: endDate,
            eventId: eventId,
            photoHashMap: photoHashMap
        )
        
        // Count new photos (not already uploaded)
        let newPhotos = scannedPhotos.filter { !($0["isUploaded"] as? Bool ?? false) }
        let newPhotosCount = newPhotos.count
        
        NSLog("📸 Event '\(eventName)' scan complete:")
        NSLog("  📱 \(scannedPhotos.count) total photos in date range")
        NSLog("  📤 \(scannedPhotos.count - newPhotosCount) already uploaded")
        NSLog("  🆕 \(newPhotosCount) new photos ready for upload")
        
        // Step 3: If new photos found, upload them
        if newPhotosCount > 0 {
            NSLog("📤 Starting upload of \(newPhotosCount) photos for \(eventName)")
            
            // Switch overlay to upload mode
            await updateOverlayToUploadMode(eventName: eventName, total: newPhotosCount)
            
            // Upload photos with progress tracking
            let uploadedCount = await uploadPhotosForEvent(
                photos: newPhotos,
                eventId: eventId,
                eventName: eventName,
                jwtToken: token
            )
            
            NSLog("✅ Uploaded \(uploadedCount)/\(newPhotosCount) photos for \(eventName)")
        }
        
        return newPhotosCount
    }
    
    /// Wait for auth bridge to be ready with efficient polling
    private func waitForAuthBridge(maxWaitSeconds: Int = 15) async -> Bool {
        let startTime = Date()
        let maxWait = TimeInterval(maxWaitSeconds)
        
        while Date().timeIntervalSince(startTime) < maxWait {
            let isReady = await checkIfAuthBridgeReady()
            
            if isReady {
                NSLog("✅ Auth bridge ready after \(String(format: "%.1f", Date().timeIntervalSince(startTime)))s")
                return true
            }
            
            // Wait 200ms before next check
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        
        NSLog("⚠️ Auth bridge timeout after \(maxWaitSeconds)s")
        return false
    }
    
    /// Check if auth bridge is ready
    private func checkIfAuthBridgeReady() async -> Bool {
        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                self.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        return window.isPhotoShareAuthReady ? window.isPhotoShareAuthReady() : false;
                    })();
                """) { result, error in
                    continuation.resume(returning: (result as? Bool) ?? false)
                }
            }
        }
    }
    
    /// Check different ways Supabase might be available
    private func checkSupabaseAvailability() async {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                self.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        console.log('🔍 Checking Supabase availability...');
                        console.log('  - window.supabase:', !!window.supabase);
                        console.log('  - window._supabase:', !!window._supabase);
                        console.log('  - window.Supabase:', !!window.Supabase);
                        console.log('  - localStorage sb-* keys:', 
                            Object.keys(localStorage).filter(k => k.startsWith('sb-')));
                        
                        // Check if we can get token from localStorage directly
                        const keys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
                        if (keys.length > 0) {
                            console.log('  - Found auth-token keys:', keys);
                            keys.forEach(key => {
                                try {
                                    const value = localStorage.getItem(key);
                                    const parsed = JSON.parse(value);
                                    if (parsed.access_token) {
                                        console.log('  - Found access_token in', key);
                                    }
                                } catch (e) {}
                            });
                        }
                        
                        return true;
                    })();
                """) { _, _ in
                    continuation.resume()
                }
            }
        }
    }
    
    // MARK: - Private Helper Methods
    
    /// Initialize upload progress with default values
    private func initializeUploadProgress() {
        uploadProgress = [
            "autoUploadEnabled": false,
            "backgroundUploadEnabled": false,
            "wifiOnlyUploadEnabled": false,
            "networkType": "unknown",
            "isWiFiConnected": false,
            "uploadInProgress": false,
            "pendingUploads": 0,
            "completedUploads": 0,
            "failedUploads": 0,
            "currentEventId": "",
            "lastScanTime": "",
            "scanInProgress": false
        ]
        
        // Load saved preferences from UserDefaults
        loadUploadProgress()
    }
    
    /// Cleanup when plugin is unloaded
    deinit {
        NotificationCenter.default.removeObserver(self)
        NSLog("🧹 AutoUpload: Cleanup complete")
    }
    
    /// Load upload progress from UserDefaults (equivalent to Android SharedPreferences)
    private func loadUploadProgress() {
        let defaults = UserDefaults.standard
        
        // Load saved settings
        if let savedProgress = defaults.object(forKey: "auto_upload_progress") as? [String: Any] {
            for (key, value) in savedProgress {
                uploadProgress[key] = value
            }
        }
        
        NSLog("📊 Loaded upload progress: \(uploadProgress)")
    }
    
    /// Save upload progress to UserDefaults (convert NSNull to nil for UserDefaults compatibility)
    private func saveUploadProgress() {
        let defaults = UserDefaults.standard
        
        // Convert NSNull values to nil for UserDefaults compatibility
        var cleanProgress: [String: Any] = [:]
        for (key, value) in uploadProgress {
            if value is NSNull {
                cleanProgress[key] = nil
            } else {
                cleanProgress[key] = value
            }
        }
        
        defaults.set(cleanProgress, forKey: "auto_upload_progress")
        defaults.synchronize()
    }
    
    /// Parse event date as UTC (Critical Android lesson #1)
    private func parseEventDateAsUTC(_ dateString: String) -> Date? {
        let formatter = DateFormatter()
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        
        // Try multiple date formats
        let formats = [
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss.SSS"
        ]
        
        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: dateString) {
                return date
            }
        }
        
        NSLog("⚠️ Failed to parse date: \(dateString)")
        return nil
    }
    
    // MARK: - Plugin Methods (Stubs - will implement one by one)
    
    @objc func getUserEvents(_ call: CAPPluginCall) {
        NSLog("🔍 getUserEvents called")
        NSLog("📦 Call parameters: \(call.options)")
        
        Task {
            do {
                // Get JWT token from JavaScript parameters (like EventPhotoPicker)
                var jwtToken: String? = call.getString("jwtToken")
                
                if let token = jwtToken {
                    NSLog("✅ JWT token received from JavaScript: \(token.prefix(20))...")
                } else {
                    NSLog("⚠️ No JWT token received from JavaScript, trying AppDelegate fallback")
                    // Fallback to AppDelegate if not provided (like EventPhotoPicker does)
                    jwtToken = AppDelegate.getStoredJwtToken()
                    
                    if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
                        NSLog("⚠️ No valid JWT token in AppDelegate either")
                        // Try to refresh
                        AppDelegate.refreshJwtTokenIfNeeded()
                        jwtToken = AppDelegate.getStoredJwtToken()
                    }
                    
                    if let token = jwtToken {
                        NSLog("🔐 Using fallback JWT token from AppDelegate: \(token.prefix(20))...")
                    } else {
                        NSLog("❌ No JWT token available from any source")
                        call.reject("No JWT token available", "AUTH_ERROR", nil)
                        return
                    }
                }
                
                // CRITICAL: getUserEventsWithAnalytics API requires Supabase access token AND user ID
                NSLog("🔐 Getting Supabase session data for getUserEventsWithAnalytics API...")
                let (supabaseToken, userId) = await getSupabaseSessionData()
                
                guard let token = supabaseToken else {
                    NSLog("❌ Failed to get Supabase access token for getUserEvents API")
                    call.reject("Supabase authentication required", "MISSING_SUPABASE_AUTH", nil)
                    return
                }
                
                guard let userIdValue = userId else {
                    NSLog("❌ Failed to get user ID from Supabase session for getUserEvents API")
                    call.reject("User ID required for getUserEvents", "MISSING_USER_ID", nil)
                    return
                }
                
                NSLog("🔐 Using Supabase session - token: \(token.prefix(20))..., userId: \(userIdValue)")
                
                // Fetch user's events from api-auto-upload-user-events API
                let events = await fetchUserEventsFromAPI(supabaseToken: token, userId: userIdValue)
                
                NSLog("📊 Found \(events.count) events from API (already filtered by edge function)")
                
                call.resolve([
                    "success": true,
                    "events": events,
                    "totalEvents": events.count,
                    "eligibleEvents": events.count
                ])
                
            } catch {
                NSLog("❌ getUserEvents error: \(error.localizedDescription)")
                call.reject("Failed to get user events", "API_ERROR", error)
            }
        }
    }
    
    @objc func checkUploadedPhotos(_ call: CAPPluginCall) {
        NSLog("📋 checkUploadedPhotos called")
        NSLog("📦 Call parameters: \(call.options)")
        
        Task {
            do {
                // Get event ID parameter (required)
                guard let eventId = call.getString("eventId") else {
                    NSLog("❌ Missing eventId parameter")
                    call.reject("Missing eventId parameter", "MISSING_PARAMS", nil)
                    return
                }
                
                // Get JWT token for this API (following EventPhotoPicker pattern)
                var jwtToken: String? = call.getString("jwtToken")
                
                if jwtToken == nil {
                    NSLog("⚠️ No JWT token received from JavaScript, trying AppDelegate fallback")
                    jwtToken = AppDelegate.getStoredJwtToken()
                    
                    if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
                        NSLog("🔄 Refreshing JWT token...")
                        AppDelegate.refreshJwtTokenIfNeeded()
                        jwtToken = AppDelegate.getStoredJwtToken()
                    }
                }
                
                guard let token = jwtToken else {
                    NSLog("❌ No JWT token available from any source")
                    call.reject("No JWT token available", "AUTH_ERROR", nil)
                    return
                }
                
                NSLog("✅ Using JWT token for get-uploaded-photos API: \(token.prefix(20))...")
                
                // Fetch uploaded photos using EventPhotoPicker pattern
                let uploadedPhotos = await fetchUploadedPhotosFromAPI(eventId: eventId, jwtToken: token)
                
                NSLog("📊 Found \(uploadedPhotos.count) uploaded photos for event \(eventId)")
                
                // Create hash map for duplicate detection (like Android implementation)
                var photoHashMap: [String: Bool] = [:]
                
                for uploadedPhoto in uploadedPhotos {
                    if let fileHash = uploadedPhoto["file_hash"] as? String {
                        photoHashMap[fileHash] = true
                    }
                }
                
                NSLog("🔍 Created hash map with \(photoHashMap.count) photo hashes for duplicate detection")
                
                call.resolve([
                    "success": true,
                    "uploadedPhotos": uploadedPhotos,
                    "photoHashMap": photoHashMap,
                    "eventId": eventId,
                    "totalPhotos": uploadedPhotos.count
                ])
                
            } catch {
                NSLog("❌ checkUploadedPhotos error: \(error.localizedDescription)")
                call.reject("Failed to check uploaded photos", "API_ERROR", error)
            }
        }
    }
    
    @objc func scanForPhotos(_ call: CAPPluginCall) {
        NSLog("📸 scanForPhotos called")
        NSLog("📦 Call parameters: \(call.options)")
        
        Task {
            do {
                guard let eventId = call.getString("eventId") else {
                    call.reject("Missing eventId parameter", "INVALID_PARAMS", nil)
                    return
                }
                
                // Get JWT token (following EventPhotoPicker pattern)
                var jwtToken: String? = call.getString("jwtToken")
                
                // Fallback to AppDelegate if no JWT token provided (following EventPhotoPicker pattern)
                if jwtToken == nil {
                    jwtToken = AppDelegate.getStoredJwtToken()
                    
                    if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
                        NSLog("🔄 Refreshing JWT token...")
                        AppDelegate.refreshJwtTokenIfNeeded()
                        jwtToken = AppDelegate.getStoredJwtToken()
                    }
                    
                    if let token = jwtToken {
                        NSLog("🔐 Using JWT token from AppDelegate: \(token.prefix(20))...")
                    } else {
                        NSLog("⚠️ No JWT token available from AppDelegate")
                    }
                }
                
                guard let token = jwtToken else {
                    call.reject("JWT token is required", "MISSING_AUTH", nil)
                    return
                }
                
                // Get required parameters
                guard let startDateString = call.getString("startDate"),
                      let endDateString = call.getString("endDate") else {
                    NSLog("❌ Missing startDate or endDate parameters")
                    call.reject("Missing startDate or endDate parameters", "INVALID_PARAMS", nil)
                    return
                }
                
                // Parse dates from ISO strings
                let dateFormatter = ISO8601DateFormatter()
                guard let startDate = dateFormatter.date(from: startDateString),
                      let endDate = dateFormatter.date(from: endDateString) else {
                    NSLog("❌ Invalid date format. Expected ISO8601 format")
                    call.reject("Invalid date format", "INVALID_PARAMS", nil)
                    return
                }
                
                NSLog("📅 Scanning photos from \(startDate) to \(endDate) for event \(eventId)")
                
                // Get uploaded photos hash map for duplicate detection
                guard let photoHashMap = call.getObject("photoHashMap") as? [String: Bool] else {
                    NSLog("❌ Missing photoHashMap parameter")
                    call.reject("Missing photoHashMap parameter", "INVALID_PARAMS", nil)
                    return
                }
                
                NSLog("🔍 Using hash map with \(photoHashMap.count) uploaded photo hashes for duplicate detection")
                
                // Scan device photos using EventPhotoPicker pattern
                let scannedPhotos = await scanDevicePhotos(
                    startDate: startDate,
                    endDate: endDate,
                    eventId: eventId,
                    photoHashMap: photoHashMap
                )
                
                let newPhotos = scannedPhotos.filter { !($0["isUploaded"] as? Bool ?? false) }
                
                NSLog("📸 Found \(scannedPhotos.count) total photos in date range")
                NSLog("📤 \(scannedPhotos.count - newPhotos.count) already uploaded")
                NSLog("🆕 \(newPhotos.count) new photos ready for upload")
                
                call.resolve([
                    "success": true,
                    "photos": scannedPhotos,
                    "newPhotos": newPhotos,
                    "totalCount": scannedPhotos.count,
                    "newCount": newPhotos.count,
                    "uploadedCount": scannedPhotos.count - newPhotos.count,
                    "eventId": eventId
                ])
                
            } catch {
                NSLog("❌ scanForPhotos error: \(error)")
                call.reject("Failed to scan photos", "SCAN_ERROR", error)
            }
        }
    }
    
    @objc func showScanningOverlay(_ call: CAPPluginCall) {
        NSLog("🔄 showScanningOverlay called")
        NSLog("📦 Call parameters: \(call.options)")
        
        // Use the existing UploadStatusOverlay plugin for consistency with EventPhotoPicker
        let message = call.getString("message") ?? "Scanning for uploads"
        let subMessage = call.getString("subMessage")
        
        NSLog("🎭 Delegating to UploadStatusOverlay plugin with scanning message")
        
        // Use JavaScript to call UploadStatusOverlay with animated scanning message
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("""
                (function() {
                    console.log('🔍 AutoUpload: Starting scanning overlay with animated dots...');
                    
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        console.log('✅ AutoUpload: UploadStatusOverlay found, showing scanning overlay');
                        
                        // Show the overlay first
                        window.Capacitor.Plugins.UploadStatusOverlay.showOverlay();
                        
                        // Start animated dots for "Scanning for uploads..."
                        let dotCount = 0;
                        const baseMessage = 'Scanning for uploads';
                        
                        window.autoUploadDotAnimation = setInterval(() => {
                            const dots = '.'.repeat((dotCount % 4) || 1); // 1-3 dots, never 0
                            const animatedMessage = baseMessage + dots;
                            
                            // Update the overlay header text
                            if (window.Capacitor.Plugins.UploadStatusOverlay.updateProgress) {
                                window.Capacitor.Plugins.UploadStatusOverlay.updateProgress({
                                    completed: 0,
                                    total: 0,
                                    message: animatedMessage
                                });
                            }
                            
                            dotCount++;
                        }, 500); // Change dots every 500ms
                        
                        console.log('✅ AutoUpload: Scanning overlay with animated dots started');
                        return { success: true, usingUploadStatusOverlay: true, animationStarted: true };
                    } else {
                        console.log('❌ AutoUpload: UploadStatusOverlay not available');
                        console.log('Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
                        return { success: false, error: 'UploadStatusOverlay not found' };
                    }
                })();
            """) { result, error in
                if let error = error {
                    NSLog("❌ JavaScript error: \(error)")
                    call.reject("Failed to show overlay", "JS_ERROR", error)
                    return
                }
                
                // Parse JavaScript result
                if let resultDict = result as? [String: Any],
                   let success = resultDict["success"] as? Bool, success {
                    NSLog("✅ UploadStatusOverlay shown successfully via JavaScript")
                    call.resolve([
                        "success": true,
                        "overlayShown": true,
                        "message": message,
                        "subMessage": subMessage ?? "",
                        "usingUploadStatusOverlay": true
                    ])
                } else {
                    NSLog("❌ UploadStatusOverlay not available, falling back to simple alert")
                    
                    // Fallback to simple alert
                    let alert = UIAlertController(title: "Scanning Photos", message: message, preferredStyle: .alert)
                    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                        NSLog("❌ User cancelled scanning")
                    })
                    
                    if let presentingVC = self?.bridge?.viewController {
                        presentingVC.present(alert, animated: true) {
                            call.resolve([
                                "success": true,
                                "overlayShown": true,
                                "message": message,
                                "usingUploadStatusOverlay": false,
                                "fallbackUsed": true
                            ])
                        }
                    } else {
                        call.reject("Failed to show overlay", "UI_ERROR", nil)
                    }
                }
            }
        }
    }
    
    @objc func hideScanningOverlay(_ call: CAPPluginCall) {
        NSLog("🔄 hideScanningOverlay called")
        
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("""
                (function() {
                    console.log('🔍 AutoUpload: Stopping scanning overlay and animation...');
                    
                    // Stop the animated dots animation
                    if (window.autoUploadDotAnimation) {
                        clearInterval(window.autoUploadDotAnimation);
                        window.autoUploadDotAnimation = null;
                        console.log('✅ AutoUpload: Dot animation stopped');
                    }
                    
                    // Hide the overlay
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.hideOverlay();
                        console.log('✅ AutoUpload: Scanning overlay hidden');
                        return { success: true, overlayStopped: true };
                    } else {
                        console.log('❌ AutoUpload: UploadStatusOverlay not available');
                        return { success: false, error: 'UploadStatusOverlay not found' };
                    }
                })();
            """) { result, error in
                if let error = error {
                    NSLog("❌ JavaScript error: \(error)")
                    call.reject("Failed to hide overlay", "JS_ERROR", error)
                    return
                }
                
                NSLog("✅ Scanning overlay hidden successfully")
                call.resolve([
                    "success": true,
                    "overlayHidden": true,
                    "animationStopped": true
                ])
            }
        }
    }
    
    // Method to dismiss the scanning overlay using UploadStatusOverlay
    private func dismissScanningOverlay() {
        NSLog("🎭 Dismissing scanning overlay via UploadStatusOverlay")
        
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("""
                (function() {
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UploadStatusOverlay) {
                        window.Capacitor.Plugins.UploadStatusOverlay.hideOverlay();
                        console.log('✅ UploadStatusOverlay hidden from AutoUpload');
                        return { success: true };
                    } else {
                        console.log('❌ UploadStatusOverlay not available for dismissal');
                        return { success: false };
                    }
                })();
            """) { result, error in
                if let error = error {
                    NSLog("❌ Failed to hide UploadStatusOverlay: \(error)")
                } else {
                    NSLog("✅ UploadStatusOverlay hidden successfully")
                }
            }
        }
    }
    
    @objc func uploadPhotos(_ call: CAPPluginCall) {
        NSLog("📤 uploadPhotos called")
        NSLog("📦 Call parameters: \(call.options)")
        
        Task {
            do {
                guard let eventId = call.getString("eventId") else {
                    call.reject("Missing eventId parameter", "INVALID_PARAMS", nil)
                    return
                }
                
                guard let photos = call.getArray("photos") as? [[String: Any]] else {
                    call.reject("Missing photos array parameter", "INVALID_PARAMS", nil)
                    return
                }
                
                // Get JWT token (following EventPhotoPicker pattern)
                var jwtToken: String? = call.getString("jwtToken")
                
                // Fallback to AppDelegate if no JWT token provided
                if jwtToken == nil {
                    jwtToken = AppDelegate.getStoredJwtToken()
                    
                    if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
                        NSLog("🔄 Refreshing JWT token...")
                        AppDelegate.refreshJwtTokenIfNeeded()
                        jwtToken = AppDelegate.getStoredJwtToken()
                    }
                    
                    if let token = jwtToken {
                        NSLog("🔐 Using JWT token from AppDelegate: \(token.prefix(20))...")
                    } else {
                        NSLog("⚠️ No JWT token available from AppDelegate")
                    }
                }
                
                guard let token = jwtToken else {
                    call.reject("JWT token is required", "MISSING_AUTH", nil)
                    return
                }
                
                // Get optional parameters
                let batchSize = call.getInt("batchSize") ?? 1  // Default to 1 photo at a time
                let retryFailedUploads = call.getBool("retryFailedUploads") ?? false
                let skipDuplicates = call.getBool("skipDuplicates") ?? true
                
                NSLog("📤 Starting upload for \(photos.count) photos to event: \(eventId)")
                NSLog("🔧 Options: batchSize=\(batchSize), retryFailed=\(retryFailedUploads), skipDuplicates=\(skipDuplicates)")
                
                // Start upload process
                let uploadResults = await startPhotoUploads(
                    eventId: eventId,
                    photos: photos,
                    jwtToken: token,
                    batchSize: batchSize,
                    skipDuplicates: skipDuplicates
                )
                
                // Calculate statistics
                let successCount = uploadResults.filter { $0["status"] as? String == "success" }.count
                let failedCount = uploadResults.filter { $0["status"] as? String == "failed" }.count
                let skippedCount = uploadResults.filter { $0["status"] as? String == "skipped" }.count
                
                NSLog("✅ Upload complete: \(successCount) success, \(failedCount) failed, \(skippedCount) skipped")
                
                call.resolve([
                    "success": true,
                    "eventId": eventId,
                    "totalPhotos": photos.count,
                    "uploaded": successCount,
                    "failed": failedCount,
                    "skipped": skippedCount,
                    "results": uploadResults,
                    "message": "Photo upload process completed"
                ])
                
            } catch {
                NSLog("❌ uploadPhotos error: \(error)")
                call.reject("Failed to upload photos", "UPLOAD_ERROR", error)
            }
        }
    }
    
    @objc func getUploadProgress(_ call: CAPPluginCall) {
        NSLog("📊 getUploadProgress called")
        
        // Update network status before returning
        updateNetworkStatus()
        
        // Return current upload progress (this method works now)
        call.resolve(uploadProgress)
    }
    
    // MARK: - Helper Methods
    
    /// Update network status in upload progress
    private func updateNetworkStatus() {
        // Simple network check for now - can be enhanced later
        uploadProgress["networkType"] = "wifi" // Placeholder
        uploadProgress["isWiFiConnected"] = true // Placeholder
    }
    
    // MARK: - JWT and Authentication Methods
    
    /// Get JWT token from web context (for upload authentication)
    private func getJwtTokenFromWeb() async -> String? {
        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                // Call JavaScript function to get JWT token
                self.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        try {
                            if (window.getPhotoShareJwtToken && typeof window.getPhotoShareJwtToken === 'function') {
                                return window.getPhotoShareJwtToken();
                            } else if (window.getJwtTokenForNativePlugin && typeof window.getJwtTokenForNativePlugin === 'function') {
                                return window.getJwtTokenForNativePlugin();
                            } else {
                                return null;
                            }
                        } catch (error) {
                            console.error('Error getting JWT token:', error);
                            return null;
                        }
                    })();
                """) { result, error in
                    if let error = error {
                        NSLog("❌ Failed to get JWT token: \\(error.localizedDescription)")
                        continuation.resume(returning: nil)
                    } else if let token = result as? String, !token.isEmpty {
                        NSLog("✅ JWT token obtained successfully")
                        continuation.resume(returning: token)
                    } else {
                        NSLog("❌ No JWT token available from web context")
                        continuation.resume(returning: nil)
                    }
                }
            }
        }
    }
    
    /// Get fresh Supabase session data - Using auth bridge as recommended by web team
    private func getSupabaseSessionData() async -> (String?, String?) {
        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                // Use the auth bridge functions built by the web team
                self.bridge?.webView?.evaluateJavaScript("""
                    (function() {
                        try {
                            console.log('🔐 iOS: Checking auth bridge readiness...');
                            
                            // Check if auth bridge is ready
                            if (typeof window.isPhotoShareAuthReady === 'function') {
                                var isReady = window.isPhotoShareAuthReady();
                                console.log('🔍 Auth bridge ready:', isReady);
                                
                                if (!isReady) {
                                    console.log('⏳ Auth bridge not ready yet');
                                    return { token: null, userId: null, error: 'not_ready' };
                                }
                            } else {
                                console.log('⚠️ isPhotoShareAuthReady function not found');
                            }
                            
                            // Get auth state directly from PhotoShareAuthState
                            if (window.PhotoShareAuthState) {
                                var authState = window.PhotoShareAuthState;
                                console.log('📊 Auth state available:', !!authState);
                                console.log('🔍 Authenticated:', authState.authenticated);
                                console.log('🔍 Has access token:', !!authState.accessToken);
                                
                                if (authState.accessToken) {
                                    console.log('✅ Token found in auth state');
                                    console.log('👤 User ID:', authState.user?.id || 'not found');
                                    return { 
                                        token: authState.accessToken, 
                                        userId: authState.user?.id || null 
                                    };
                                }
                            } else {
                                console.log('⚠️ window.PhotoShareAuthState not found');
                            }
                            
                            // Fallback: Try the async function if available
                            if (typeof window.getPhotoShareJwtToken === 'function') {
                                console.log('🔍 Found getPhotoShareJwtToken function, but need async handling');
                                // Note: This would need Promise handling which doesn't work well in iOS WebView
                            }
                            
                            console.log('❌ No valid auth state found');
                            return { token: null, userId: null, error: 'no_auth' };
                            
                        } catch (error) {
                            console.error('❌ Error getting token:', error);
                            return { token: null, userId: null, error: error.message };
                        }
                    })();
                """) { result, error in
                    if let error = error {
                        NSLog("❌ JavaScript execution error: \(error.localizedDescription)")
                        continuation.resume(returning: (nil, nil))
                        return
                    }
                    
                    guard let resultDict = result as? [String: Any] else {
                        NSLog("❌ Invalid result format: \(String(describing: result))")
                        continuation.resume(returning: (nil, nil))
                        return
                    }
                    
                    // Check for error in the result
                    if let errorMsg = resultDict["error"] as? String {
                        NSLog("⚠️ Auth bridge error: \(errorMsg)")
                        if errorMsg == "not_ready" {
                            NSLog("💡 Auth bridge not ready yet - may need to wait longer")
                        }
                        continuation.resume(returning: (nil, nil))
                        return
                    }
                    
                    // Extract token and userId, handling NSNull
                    var token: String? = nil
                    var userId: String? = nil
                    
                    if let tokenValue = resultDict["token"], !(tokenValue is NSNull) {
                        token = tokenValue as? String
                    }
                    
                    if let userIdValue = resultDict["userId"], !(userIdValue is NSNull) {
                        userId = userIdValue as? String
                    }
                    
                    if let token = token, !token.isEmpty {
                        NSLog("✅ iOS: Auth bridge session obtained - token: \(token.prefix(20))..., userId: \(userId ?? "none")")
                        continuation.resume(returning: (token, userId))
                    } else {
                        NSLog("❌ iOS: No valid token in auth bridge result")
                        continuation.resume(returning: (nil, nil))
                    }
                }
            }
        }
    }
    
    /// Get Supabase session token (for API calls) - Legacy method for compatibility
    private func getSupabaseSessionToken() async -> String? {
        let (token, _) = await getSupabaseSessionData()
        return token
    }
    
    /// Async fallback for Supabase session data retrieval
    private func getSupabaseSessionAsync(continuation: CheckedContinuation<(String?, String?), Never>) {
        self.bridge?.webView?.evaluateJavaScript("""
            window.supabase.auth.getSession().then(({data: {session}, error}) => {
                if (error) {
                    console.error('🔐 getSession error:', error);
                    window._supabaseSessionResult = { token: null, userId: null };
                } else if (session?.access_token) {
                    console.log('🔐 Async session token obtained:', session.access_token.substring(0, 20) + '...');
                    console.log('🔐 Async user ID obtained:', session.user?.id || 'none');
                    window._supabaseSessionResult = {
                        token: session.access_token,
                        userId: session.user?.id || null
                    };
                } else {
                    console.log('🔐 No session in async call');
                    window._supabaseSessionResult = { token: null, userId: null };
                }
            }).catch(err => {
                console.error('🔐 Async getSession failed:', err);
                window._supabaseSessionResult = { token: null, userId: null };
            });
        """) { _, _ in
            // Poll for result
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.bridge?.webView?.evaluateJavaScript("window._supabaseSessionResult") { result, error in
                    if let resultDict = result as? [String: Any],
                       let token = resultDict["token"] as? String, !token.isEmpty, token != "null" {
                        let userId = resultDict["userId"] as? String
                        NSLog("✅ Async Supabase session obtained: token \\(token.prefix(20))..., userId: \\(userId ?? \"none\")")
                        continuation.resume(returning: (token, userId))
                    } else {
                        NSLog("❌ Async Supabase session failed")
                        continuation.resume(returning: (nil, nil))
                    }
                    // Clean up
                    self.bridge?.webView?.evaluateJavaScript("delete window._supabaseSessionResult") { _, _ in }
                }
            }
        }
    }
    
    // MARK: - Supabase API Methods
    
    /// Fetch user's events from REAL API
    private func fetchUserEventsFromSupabase(supabaseToken: String) async -> [[String: Any]] {
        NSLog("🔍 Fetching user events from REAL API...")
        NSLog("🔐 Using Supabase token: \(supabaseToken.prefix(20))...")
        
        // Build API request to getUserEventsWithAnalytics
        guard let url = URL(string: "https://photo-share.app/api/getUserEventsWithAnalytics") else {
            NSLog("❌ Invalid API URL")
            return []
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(supabaseToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        NSLog("📡 Making API request to: \(url.absoluteString)")
        NSLog("📡 Authorization: Bearer \(supabaseToken.prefix(20))...")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            // Log HTTP response details
            if let httpResponse = response as? HTTPURLResponse {
                NSLog("📡 API Response Status: \(httpResponse.statusCode)")
                NSLog("📡 API Response Headers: \(httpResponse.allHeaderFields)")
            }
            
            // Log raw response data
            if let responseString = String(data: data, encoding: .utf8) {
                let truncated = responseString.count > 1000 ? String(responseString.prefix(1000)) + "..." : responseString
                NSLog("📡 API Raw Response: \(truncated)")
            }
            
            // Parse JSON response
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                NSLog("❌ Failed to parse JSON response")
                return []
            }
            
            NSLog("📊 API Response JSON keys: \(Array(json.keys))")
            
            // Extract events array
            guard let events = json["events"] as? [[String: Any]] else {
                NSLog("❌ No 'events' array found in response")
                NSLog("📊 Full JSON structure: \(json)")
                return []
            }
            
            NSLog("✅ Successfully fetched \(events.count) events from API")
            
            // Log each event details for debugging
            for (index, event) in events.enumerated() {
                NSLog("📋 Event \(index + 1):")
                NSLog("  - ID: \(event["id"] as? String ?? "unknown")")
                NSLog("  - Name: \(event["name"] as? String ?? "unknown")")
                NSLog("  - Start: \(event["start_time"] as? String ?? "unknown")")
                NSLog("  - End: \(event["end_time"] as? String ?? "unknown")")
                NSLog("  - Live: \(event["live"] as? Bool ?? false)")
                NSLog("  - User Role: \(event["user_role"] as? [String] ?? [])")
            }
            
            return events
            
        } catch {
            NSLog("❌ API request failed: \(error.localizedDescription)")
            return []
        }
    }
    
    /// Filter events for auto-upload eligibility
    private func filterEventsForAutoUpload(_ events: [[String: Any]]) -> [[String: Any]] {
        let eligibleEvents = events.filter { event in
            guard let isLive = event["is_live"] as? Bool,
                  let autoUploadEnabled = event["auto_upload_enabled"] as? Bool else {
                return false
            }
            
            // Event must be live and have auto-upload enabled
            let isEligible = isLive && autoUploadEnabled
            
            if let eventName = event["name"] as? String {
                NSLog("📋 Event '\\(eventName)': live=\\(isLive), autoUpload=\\(autoUploadEnabled), eligible=\\(isEligible)")
            }
            
            return isEligible
        }
        
        NSLog("✅ Filtered \\(eligibleEvents.count) eligible events from \\(events.count) total events")
        return eligibleEvents
    }
    
    /// Fetch uploaded photos for an event using EventPhotoPicker pattern
    private func fetchUploadedPhotosFromAPI(eventId: String, jwtToken: String) async -> [[String: Any]] {
        NSLog("🔍 Fetching uploaded photos for event: \(eventId)")
        NSLog("🔐 Using JWT token: \(jwtToken.prefix(20))...")
        
        let allPhotos: [[String: Any]] = await withCheckedContinuation { continuation in
            fetchUploadedPhotosPage(eventId: eventId, jwtToken: jwtToken, offset: 0, allPhotos: []) { photos in
                continuation.resume(returning: photos)
            }
        }
        
        return allPhotos
    }
    
    /// Fetch uploaded photos with pagination (following EventPhotoPicker exact pattern)
    private func fetchUploadedPhotosPage(eventId: String, jwtToken: String, offset: Int, allPhotos: [[String: Any]], completion: @escaping ([[String: Any]]) -> Void) {
        // Use get-uploaded-photos endpoint which has pagination support
        guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos") else {
            NSLog("❌ Invalid get-uploaded-photos URL")
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
            NSLog("❌ Failed to build URL with query parameters")
            completion([])
            return
        }
        
        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        
        NSLog("📡 Fetching uploaded photos for event: \(eventId) (offset: \(offset))")
        NSLog("📡 Request URL: \(finalURL.absoluteString)")
        
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                NSLog("❌ Network error fetching uploaded photos: \(error.localizedDescription)")
                completion(allPhotos)
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                NSLog("❌ Invalid HTTP response")
                completion(allPhotos)
                return
            }
            
            NSLog("📡 get-uploaded-photos Response Status: \(httpResponse.statusCode)")
            
            guard httpResponse.statusCode == 200 else {
                NSLog("❌ get-uploaded-photos HTTP error: \(httpResponse.statusCode)")
                if let data = data, let responseString = String(data: data, encoding: .utf8) {
                    NSLog("📡 Error Response: \(responseString)")
                }
                completion(allPhotos)
                return
            }
            
            guard let data = data else {
                NSLog("❌ No data received")
                completion(allPhotos)
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let photos = json["photos"] as? [[String: Any]] {
                        NSLog("✅ Fetched \(photos.count) photos from offset \(offset)")
                        
                        var updatedAllPhotos = allPhotos
                        updatedAllPhotos.append(contentsOf: photos)
                        
                        // Check if there are more photos to fetch
                        if photos.count == 50 { // If we got the full limit, there might be more
                            NSLog("📄 Fetching next page...")
                            self.fetchUploadedPhotosPage(
                                eventId: eventId,
                                jwtToken: jwtToken,
                                offset: offset + 50,
                                allPhotos: updatedAllPhotos,
                                completion: completion
                            )
                        } else {
                            NSLog("✅ Finished fetching all uploaded photos. Total: \(updatedAllPhotos.count)")
                            completion(updatedAllPhotos)
                        }
                    } else {
                        NSLog("❌ No 'photos' array in response")
                        completion(allPhotos)
                    }
                } else {
                    NSLog("❌ Failed to parse JSON response")
                    completion(allPhotos)
                }
            } catch {
                NSLog("❌ JSON parsing error: \(error.localizedDescription)")
                completion(allPhotos)
            }
        }
        
        task.resume()
    }
    
    /// Scan device photos using EventPhotoPicker pattern with duplicate detection
    private func scanDevicePhotos(startDate: Date, endDate: Date, eventId: String, photoHashMap: [String: Bool]) async -> [[String: Any]] {
        NSLog("📸 Starting device photo scan using EventPhotoPicker pattern...")
        NSLog("📅 Date range: \(startDate) to \(endDate)")
        NSLog("🔍 Hash map size: \(photoHashMap.count) uploaded photos")
        
        // Debug: Log all uploaded photo hashes
        for (hash, _) in photoHashMap {
            NSLog("📤 Uploaded photo hash: \(hash)")
        }
        
        return await withCheckedContinuation { continuation in
            // Request photo library access
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                guard status == .authorized else {
                    NSLog("❌ Photo library access denied")
                    continuation.resume(returning: [])
                    return
                }
                
                // Perform photo scanning on background queue
                DispatchQueue.global(qos: .userInitiated).async {
                    let options = PHFetchOptions()
                    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
                    options.predicate = NSPredicate(format: "creationDate >= %@ AND creationDate <= %@ AND mediaType == %d",
                                                   startDate as NSDate,
                                                   endDate as NSDate,
                                                   PHAssetMediaType.image.rawValue)
                    
                    let assets = PHAsset.fetchAssets(with: options)
                    var scannedPhotos: [[String: Any]] = []
                    let totalCount = assets.count
                    
                    NSLog("📸 Found \(totalCount) photos in date range for scanning")
                    
                    if totalCount == 0 {
                        NSLog("📸 No photos found in date range")
                        continuation.resume(returning: [])
                        return
                    }
                    
                    // Process each photo asset
                    assets.enumerateObjects { asset, index, stop in
                        // Generate hash for duplicate detection (using EventPhotoPicker method)
                        let deviceHash = self.generatePhotoHashSync(for: asset)
                        
                        // Enhanced debugging for duplicate detection
                        NSLog("📱 Device Photo \(index + 1): \(asset.localIdentifier)")
                        NSLog("🔍 Device hash: \(deviceHash ?? "FAILED")")
                        NSLog("📅 Creation date: \(asset.creationDate ?? Date())")
                        
                        // Check if already uploaded using hash map
                        let isUploaded = deviceHash != nil && photoHashMap[deviceHash!] == true
                        
                        if let hash = deviceHash {
                            let inHashMap = photoHashMap[hash] == true
                            NSLog("🔍 Hash '\(hash)' in upload map: \(inHashMap)")
                            NSLog("📤 Photo marked as uploaded: \(isUploaded)")
                        } else {
                            NSLog("❌ Failed to generate hash for photo \(index + 1)")
                        }
                        
                        let photoDict: [String: Any] = [
                            "localIdentifier": asset.localIdentifier,
                            "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
                            "modificationDate": asset.modificationDate?.timeIntervalSince1970,
                            "pixelWidth": asset.pixelWidth,
                            "pixelHeight": asset.pixelHeight,
                            "mediaType": asset.mediaType.rawValue,
                            "fileHash": deviceHash ?? "",
                            "isUploaded": isUploaded,
                            "eventId": eventId,
                            "filename": "IMG_\(asset.localIdentifier.suffix(8)).jpg"
                        ]
                        
                        scannedPhotos.append(photoDict)
                        
                        // Log progress periodically
                        if index % 10 == 0 || index == totalCount - 1 {
                            NSLog("📸 Processed \(index + 1)/\(totalCount) photos")
                        }
                    }
                    
                    let newPhotos = scannedPhotos.filter { !($0["isUploaded"] as? Bool ?? false) }
                    NSLog("📸 Scan complete: \(scannedPhotos.count) total, \(newPhotos.count) new, \(scannedPhotos.count - newPhotos.count) already uploaded")
                    
                    continuation.resume(returning: scannedPhotos)
                }
            }
        }
    }
    
    /// Generate photo hash using EventPhotoPicker pattern
    private func generatePhotoHashSync(for asset: PHAsset) -> String? {
        let semaphore = DispatchSemaphore(value: 0)
        var fileHash: String?
        
        let options = PHImageRequestOptions()
        options.isSynchronous = false
        options.isNetworkAccessAllowed = false
        options.deliveryMode = .fastFormat
        
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
            defer { semaphore.signal() }
            
            guard let imageData = data else {
                NSLog("❌ Failed to get image data for hash generation")
                return
            }
            
            // Generate SHA-256 hash like EventPhotoPicker
            let hash = SHA256.hash(data: imageData)
            fileHash = hash.compactMap { String(format: "%02x", $0) }.joined()
        }
        
        // Wait for completion
        let timeout = DispatchTime.now() + .milliseconds(1000)
        if semaphore.wait(timeout: timeout) == .timedOut {
            NSLog("⚠️ Hash generation timed out for asset")
            return nil
        }
        
        return fileHash
    }
    
    /// Fetch user's events from getUserEventsWithAnalytics API (CORRECT ENDPOINT) 
    private func fetchUserEventsFromAPI(supabaseToken: String, userId: String) async -> [[String: Any]] {
        NSLog("🔍 Fetching user events from api-auto-upload-user-events API...")
        NSLog("🔐 Using Supabase token: \(supabaseToken.prefix(20))...")
        NSLog("👤 For user ID: \(userId)")
        
        // ✅ CORRECT - Use the actual Supabase edge function
        let urlString = "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/api-auto-upload-user-events?user_id=\(userId)"
        guard let url = URL(string: urlString) else {
            NSLog("❌ Invalid api-auto-upload-user-events URL: \(urlString)")
            return []
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(supabaseToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        NSLog("📡 Making API request to api-auto-upload-user-events...")
        NSLog("📡 Request URL: \(url.absoluteString)")
        NSLog("📡 Authorization: Bearer \(supabaseToken.prefix(20))...")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            // Debug HTTP response
            if let httpResponse = response as? HTTPURLResponse {
                NSLog("📡 getUserEventsWithAnalytics Response Status: \(httpResponse.statusCode)")
                NSLog("📡 getUserEventsWithAnalytics Response Headers: \(httpResponse.allHeaderFields)")
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                NSLog("❌ Invalid HTTP response from getUserEventsWithAnalytics")
                return []
            }
            
            guard httpResponse.statusCode == 200 else {
                NSLog("❌ getUserEventsWithAnalytics HTTP error: \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
                    NSLog("📡 getUserEventsWithAnalytics Error Response: \(truncated)")
                }
                return []
            }
            
            // Debug raw response
            if let responseString = String(data: data, encoding: .utf8) {
                let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
                NSLog("📡 getUserEventsWithAnalytics Raw Response: \(truncated)")
            }
            
            // Parse JSON response according to API documentation
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let events = json["events"] as? [[String: Any]] {
                    NSLog("✅ Successfully fetched \(events.count) events from getUserEventsWithAnalytics API")
                    
                    // Log sample event for debugging
                    if let firstEvent = events.first {
                        NSLog("📋 Sample event: \(firstEvent)")
                    }
                    
                    // Log additional API response fields
                    if let totalEvents = json["total_events"] as? Int {
                        NSLog("📊 Total events in API response: \(totalEvents)")
                    }
                    if let userId = json["user_id"] as? String {
                        NSLog("👤 User ID from API: \(userId)")
                    }
                    
                    return events
                } else {
                    NSLog("❌ No 'events' array found in getUserEventsWithAnalytics response")
                    NSLog("📡 Available JSON keys: \(json.keys)")
                    return []
                }
            } else {
                NSLog("❌ Failed to parse JSON response from getUserEventsWithAnalytics")
                return []
            }
        } catch {
            NSLog("❌ Network error calling getUserEventsWithAnalytics: \(error.localizedDescription)")
            return []
        }
    }
    
    /// Fetch uploaded photos from Supabase for duplicate detection
    private func fetchUploadedPhotosFromSupabase(eventId: String, photoIds: [String], jwtToken: String) async -> [[String: Any]] {
        NSLog("🔍 Fetching uploaded photos from Supabase API for event: \(eventId)")
        
        if !photoIds.isEmpty {
            NSLog("📋 Checking specific photo IDs: \(photoIds)")
        }
        
        // Build API URL with query parameters
        guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos") else {
            NSLog("❌ Invalid get-uploaded-photos URL")
            return []
        }
        
        var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
        urlComponents?.queryItems = [
            URLQueryItem(name: "event_id", value: eventId),
            URLQueryItem(name: "limit", value: "50"),        // Max efficiency
            URLQueryItem(name: "offset", value: "0")         // Start with first page
        ]
        
        guard let finalURL = urlComponents?.url else {
            NSLog("❌ Failed to build URL with query parameters")
            return []
        }
        
        // Setup HTTP request
        var request = URLRequest(url: finalURL)
        request.httpMethod = "GET"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        
        NSLog("📡 Fetching uploaded photos for event: \(eventId)")
        NSLog("📡 Request URL: \(finalURL.absoluteString)")
        NSLog("📡 Authorization: Bearer \(jwtToken.prefix(20))...")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            // Debug HTTP response
            if let httpResponse = response as? HTTPURLResponse {
                NSLog("📡 get-uploaded-photos Response Status: \(httpResponse.statusCode)")
                NSLog("📡 get-uploaded-photos Response Headers: \(httpResponse.allHeaderFields)")
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                NSLog("❌ Invalid HTTP response from get-uploaded-photos")
                return []
            }
            
            guard httpResponse.statusCode == 200 else {
                NSLog("❌ get-uploaded-photos HTTP error: \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
                    NSLog("📡 Error Response: \(truncated)")
                }
                return []
            }
            
            // Debug raw response
            if let responseString = String(data: data, encoding: .utf8) {
                let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
                NSLog("📡 get-uploaded-photos Raw Response: \(truncated)")
            }
            
            // Parse JSON
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let photos = json["photos"] as? [[String: Any]] {
                    NSLog("✅ Fetched \(photos.count) uploaded photos from API")
                    
                    // Handle pagination if needed
                    if let hasMore = json["has_more"] as? Bool, hasMore {
                        NSLog("📄 More pages available - implement pagination if needed")
                        // TODO: Implement pagination for large photo sets
                    }
                    
                    // Filter by specific photo IDs if provided
                    let filteredPhotos = photoIds.isEmpty ? photos : photos.filter { photo in
                        // Note: API response uses different field names than mock data
                        if let devicePhotoId = photo["device_photo_id"] as? String {
                            return photoIds.contains(devicePhotoId)
                        }
                        return false
                    }
                    
                    NSLog("📊 Returning \(filteredPhotos.count) uploaded photos after filtering")
                    return filteredPhotos
                } else {
                    NSLog("❌ No 'photos' array found in API response")
                    return []
                }
            } else {
                NSLog("❌ Failed to parse JSON response from get-uploaded-photos")
                return []
            }
        } catch {
            NSLog("❌ Network error fetching uploaded photos: \(error.localizedDescription)")
            return []
        }
    }
    
    /// Create photo hash map for efficient duplicate detection
    private func createPhotoHashMap(_ uploadedPhotos: [[String: Any]]) -> [String: Any] {
        var hashMap: [String: Any] = [:]
        
        for photo in uploadedPhotos {
            // Use API response field names (see get-uploaded-photos-api-integration.md)
            if let fileHash = photo["file_hash"] as? String,
               let uploadId = photo["id"] {
                
                // Map by file hash for content-based duplicate detection
                hashMap[fileHash] = [
                    "upload_id": uploadId,
                    "file_name": photo["file_name"] ?? "",
                    "upload_timestamp": photo["upload_timestamp"] ?? "",
                    "original_timestamp": photo["original_timestamp"] ?? "",
                    "perceptual_hash": photo["perceptual_hash"] ?? "",
                    "file_size_bytes": photo["file_size_bytes"] ?? 0,
                    "image_width": photo["image_width"] ?? 0,
                    "image_height": photo["image_height"] ?? 0
                ]
                
                // Also map by perceptual hash for visual similarity detection
                if let perceptualHash = photo["perceptual_hash"] as? String, !perceptualHash.isEmpty {
                    hashMap[perceptualHash] = [
                        "upload_id": uploadId,
                        "file_hash": fileHash,
                        "file_name": photo["file_name"] ?? "",
                        "upload_timestamp": photo["upload_timestamp"] ?? ""
                    ]
                }
            }
        }
        
        NSLog("🗺️ Created hash map with \(hashMap.keys.count) entries for duplicate detection")
        NSLog("🗺️ Hash map includes both file_hash and perceptual_hash mappings")
        return hashMap
    }
    
    /// Scan photo library for photos within event timeframe
    private func scanPhotoLibrary(eventId: String, startDate: String?, endDate: String?, limit: Int, jwtToken: String) async -> [[String: Any]] {
        // TODO: Implement actual photo library scanning with Photos framework
        // For now, return mock data to test the flow
        NSLog("📸 Scanning photo library for event: \\(eventId)")
        
        if let start = startDate, let end = endDate {
            NSLog("🕐 Filtering photos between \\(start) and \\(end)")
        } else {
            NSLog("🕐 No date filter - scanning all recent photos")
        }
        
        // Simulate scanning delay
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        // Mock photo library data for testing
        let mockPhotos: [[String: Any]] = [
            [
                "id": "photo_scan_001",
                "localIdentifier": "photo_device_scan_001",
                "filename": "IMG_2001.jpg",
                "creationDate": "2025-01-15T15:00:00Z",
                "modificationDate": "2025-01-15T15:00:05Z",
                "pixelWidth": 4032,
                "pixelHeight": 3024,
                "fileSize": 2850000,
                "mediaType": "image",
                "mediaSubtype": "photo",
                "location": [
                    "latitude": 37.7749,
                    "longitude": -122.4194
                ],
                "isFavorite": false,
                "isHidden": false
            ],
            [
                "id": "photo_scan_002",
                "localIdentifier": "photo_device_scan_002", 
                "filename": "IMG_2002.jpg",
                "creationDate": "2025-01-15T15:05:00Z",
                "modificationDate": "2025-01-15T15:05:03Z",
                "pixelWidth": 4032,
                "pixelHeight": 3024,
                "fileSize": 3100000,
                "mediaType": "image",
                "mediaSubtype": "photo",
                "location": [
                    "latitude": 37.7849,
                    "longitude": -122.4094
                ],
                "isFavorite": true,
                "isHidden": false
            ],
            [
                "id": "photo_scan_003",
                "localIdentifier": "photo_device_scan_003",
                "filename": "IMG_2003.jpg", 
                "creationDate": "2025-01-15T15:10:00Z",
                "modificationDate": "2025-01-15T15:10:02Z",
                "pixelWidth": 3024,
                "pixelHeight": 4032,
                "fileSize": 2650000,
                "mediaType": "image",
                "mediaSubtype": "photo",
                "location": [
                    "latitude": 37.7949,
                    "longitude": -122.3994
                ],
                "isFavorite": false,
                "isHidden": false
            ]
        ]
        
        // Apply limit
        let limitedPhotos = Array(mockPhotos.prefix(limit))
        
        NSLog("📱 Found \\(limitedPhotos.count) photos in library scan (limit: \\(limit))")
        
        // Log each photo for debugging
        for (index, photo) in limitedPhotos.enumerated() {
            if let filename = photo["filename"] as? String,
               let creationDate = photo["creationDate"] as? String {
                NSLog("📷 Photo \\(index + 1): \\(filename) - \\(creationDate)")
            }
        }
        
        return limitedPhotos
    }
    
    /// Start photo uploads to server using multipart form uploads (following EventPhotoPicker pattern)
    private func startPhotoUploads(eventId: String, photos: [[String: Any]], jwtToken: String, batchSize: Int, skipDuplicates: Bool) async -> [[String: Any]] {
        NSLog("📤 Starting photo uploads for event: \(eventId)")
        NSLog("📱 Processing \(photos.count) photos with batch size: \(batchSize)")
        NSLog("🔐 Using JWT token: \(jwtToken.prefix(20))...")
        
        var uploadResults: [[String: Any]] = []
        
        // Update upload progress (but don't show overlay during scanning)
        uploadProgress["uploadInProgress"] = true
        uploadProgress["pendingUploads"] = photos.count
        uploadProgress["completedUploads"] = 0
        uploadProgress["failedUploads"] = 0
        uploadProgress["currentEventId"] = eventId
        uploadProgress["scanningMode"] = false  // Not in scanning mode, this is actual upload
        saveUploadProgress()
        
        // Process photos one by one for now (batchSize = 1 for stability)
        for (index, photo) in photos.enumerated() {
            NSLog("📸 Processing photo \(index + 1)/\(photos.count)")
            
            guard let localIdentifier = photo["localIdentifier"] as? String else {
                NSLog("❌ Missing localIdentifier for photo \(index + 1)")
                uploadResults.append([
                    "photoId": photo["id"] ?? "unknown_\(index)",
                    "filename": photo["filename"] ?? "unknown.jpg",
                    "status": "failed",
                    "error": "MISSING_LOCAL_ID",
                    "message": "Photo localIdentifier not found"
                ])
                continue
            }
            
            // Skip duplicates if enabled
            if skipDuplicates && (photo["isUploaded"] as? Bool == true) {
                NSLog("⏭️ Skipping duplicate photo: \(localIdentifier)")
                uploadResults.append([
                    "photoId": photo["id"] ?? localIdentifier,
                    "filename": photo["filename"] ?? "unknown.jpg",
                    "status": "skipped",
                    "reason": "duplicate",
                    "message": "Photo already uploaded to this event"
                ])
                continue
            }
            
            // Upload single photo
            let uploadResult = await uploadSinglePhoto(
                photo: photo,
                eventId: eventId,
                jwtToken: jwtToken,
                index: index + 1,
                total: photos.count
            )
            
            uploadResults.append(uploadResult)
            
            // Update progress
            let successCount = uploadResults.filter { $0["status"] as? String == "success" }.count
            let failedCount = uploadResults.filter { $0["status"] as? String == "failed" }.count
            
            uploadProgress["completedUploads"] = successCount
            uploadProgress["failedUploads"] = failedCount
            uploadProgress["pendingUploads"] = photos.count - uploadResults.count
            saveUploadProgress()
            
            // Small delay between uploads to prevent overwhelming the server
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds between photos
        }
        
        // Update final progress
        uploadProgress["uploadInProgress"] = false
        uploadProgress["pendingUploads"] = 0
        uploadProgress["currentEventId"] = ""
        saveUploadProgress()
        
        let successCount = uploadResults.filter { $0["status"] as? String == "success" }.count
        let failedCount = uploadResults.filter { $0["status"] as? String == "failed" }.count
        let skippedCount = uploadResults.filter { $0["status"] as? String == "skipped" }.count
        
        NSLog("📤 Upload process completed: \(successCount) success, \(failedCount) failed, \(skippedCount) skipped")
        
        return uploadResults
    }
    
    /// Upload a single photo using multipart form data (following EventPhotoPicker pattern)
    private func uploadSinglePhoto(photo: [String: Any], eventId: String, jwtToken: String, index: Int, total: Int) async -> [String: Any] {
        guard let localIdentifier = photo["localIdentifier"] as? String else {
            return [
                "photoId": photo["id"] ?? "unknown",
                "filename": photo["filename"] ?? "unknown.jpg",
                "status": "failed",
                "error": "MISSING_LOCAL_ID",
                "message": "Photo localIdentifier not found"
            ]
        }
        
        // Generate clean filename without slashes (like EventPhotoPicker)
        let timestamp = Date().timeIntervalSince1970
        let cleanIdentifier = localIdentifier.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "-", with: "_")
        let filename = photo["filename"] as? String ?? "photo_\(timestamp)_\(cleanIdentifier.suffix(8)).jpg"
        NSLog("📤 Uploading photo \(index)/\(total): \(filename)")
        
        // Get PHAsset for the photo
        let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        guard let asset = fetchResult.firstObject else {
            NSLog("❌ Failed to fetch PHAsset for localIdentifier: \(localIdentifier)")
            return [
                "photoId": localIdentifier,
                "filename": filename,
                "status": "failed",
                "error": "ASSET_NOT_FOUND",
                "message": "Unable to access photo asset"
            ]
        }
        
        // Get image data from PHAsset
        return await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.isSynchronous = false
            options.isNetworkAccessAllowed = true
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .none
            
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, dataUTI, orientation, info in
                guard let imageData = data else {
                    NSLog("❌ Failed to get image data for asset: \(localIdentifier)")
                    continuation.resume(returning: [
                        "photoId": localIdentifier,
                        "filename": filename,
                        "status": "failed",
                        "error": "NO_IMAGE_DATA",
                        "message": "Unable to retrieve image data"
                    ])
                    return
                }
                
                NSLog("✅ Got image data (\(imageData.count) bytes) for \(filename)")
                
                // Use direct HTTP upload (JS bridge disabled until debugged)
                Task {
                    NSLog("📤 Using direct HTTP upload (proven working method)")
                    let result = await self.uploadImageDataToServer(
                        imageData: imageData,
                        filename: filename,
                        eventId: eventId,
                        jwtToken: jwtToken,
                        photo: photo
                    )
                    continuation.resume(returning: result)
                }
            }
        }
    }
    
    /// Upload image data using JavaScript bridge with invokeWithRetry() for better reliability
    private func uploadImageDataViaJSBridge(imageData: Data, filename: String, eventId: String, jwtToken: String, photo: [String: Any]) async -> [String: Any] {
        let photoId = photo["localIdentifier"] as? String ?? "unknown"
        
        // Convert image data to base64 for JavaScript transmission
        let base64Data = imageData.base64EncodedString()
        let fileSize = imageData.count
        
        // Get photo metadata for upload
        let creationDate = photo["creationDate"] as? TimeInterval ?? Date().timeIntervalSince1970
        let pixelWidth = photo["pixelWidth"] as? Int ?? 0
        let pixelHeight = photo["pixelHeight"] as? Int ?? 0
        
        NSLog("📤 Uploading via JS bridge: \(filename) (\(fileSize) bytes)")
        NSLog("🔐 Using JWT token: \(jwtToken.prefix(20))...")
        
        // Create JavaScript code that uses invokeWithRetry() 
        let jsCode = """
        (async () => {
            try {
                console.log('🔧 JS Bridge: Starting upload for \(filename)');
                console.log('🔧 JS Bridge: Checking invokeWithRetry availability...');
                console.log('🔧 JS Bridge: window.invokeWithRetry exists:', !!window.invokeWithRetry);
                console.log('🔧 JS Bridge: window.supabase exists:', !!window.supabase);
                console.log('🔧 JS Bridge: window.supabase.functions exists:', !!window.supabase?.functions);
                
                // Check if invokeWithRetry is available (web team implementation)
                const invokeFunc = window.invokeWithRetry || window.supabase?.functions?.invoke?.bind(window.supabase.functions);
                
                if (!invokeFunc) {
                    console.error('❌ JS Bridge: No invoke function available');
                    return { 
                        success: false, 
                        error: 'NO_INVOKE_FUNCTION',
                        message: 'Neither invokeWithRetry nor supabase.functions.invoke available' 
                    };
                }
                
                console.log('✅ JS Bridge: Using invoke function:', invokeFunc === window.invokeWithRetry ? 'invokeWithRetry' : 'supabase.functions.invoke');
                
                // Prepare upload data (same format as direct HTTP)
                const uploadData = {
                    event_id: '\(eventId)',
                    filename: '\(filename)',
                    file_data: '\(base64Data)',
                    media_type: 'image/jpeg',
                    creation_date: \(creationDate),
                    pixel_width: \(pixelWidth),
                    pixel_height: \(pixelHeight),
                    local_identifier: '\(photoId)'
                };
                
                console.log('📤 JS Bridge Upload: \(filename)', {
                    event_id: '\(eventId)',
                    filename: '\(filename)',
                    size_bytes: \(fileSize),
                    using_retry: !!window.invokeWithRetry
                });
                
                // Call the mobile-upload function with retry logic
                const result = await invokeFunc('mobile-upload', {
                    body: uploadData,
                    headers: {
                        'Authorization': 'Bearer \(jwtToken)',
                        'Content-Type': 'application/json'
                    }
                });
                
                if (result.error) {
                    console.error('❌ JS Bridge Upload Error:', result.error);
                    return { 
                        success: false, 
                        error: result.error.message || 'Upload failed',
                        statusCode: result.error.status
                    };
                }
                
                console.log('✅ JS Bridge Upload Success:', '\(filename)');
                return { 
                    success: true, 
                    data: result.data,
                    upload_id: result.data?.upload_id
                };
                
            } catch (error) {
                console.error('❌ JS Bridge Upload Exception:', error);
                return { 
                    success: false, 
                    error: error.message || 'JavaScript execution failed',
                    message: 'Upload failed with JS exception'
                };
            }
        })();
        """
        
        // Execute JavaScript and await result
        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                self?.bridge?.webView?.evaluateJavaScript(jsCode) { result, error in
                    if let error = error {
                        NSLog("❌ JS Bridge execution error for \(filename): \(error.localizedDescription)")
                        continuation.resume(returning: [
                            "photoId": photoId,
                            "filename": filename,
                            "status": "failed",
                            "error": "JS_BRIDGE_ERROR",
                            "message": "JavaScript bridge execution failed: \(error.localizedDescription)"
                        ])
                        return
                    }
                    
                    guard let resultDict = result as? [String: Any] else {
                        NSLog("❌ Invalid JS bridge result for \(filename): \(String(describing: result))")
                        continuation.resume(returning: [
                            "photoId": photoId,
                            "filename": filename,
                            "status": "failed",
                            "error": "INVALID_JS_RESULT",
                            "message": "JavaScript bridge returned invalid result"
                        ])
                        return
                    }
                    
                    let success = resultDict["success"] as? Bool ?? false
                    
                    if success {
                        NSLog("✅ JS Bridge upload successful for \(filename)")
                        let uploadId = (resultDict["data"] as? [String: Any])?["upload_id"] as? String
                        continuation.resume(returning: [
                            "photoId": photoId,
                            "filename": filename,
                            "status": "success",
                            "upload_id": uploadId ?? "",
                            "message": "Upload completed successfully via JS bridge"
                        ])
                    } else {
                        let errorMessage = resultDict["error"] as? String ?? "Unknown error"
                        let statusCode = resultDict["statusCode"] as? Int
                        NSLog("❌ JS Bridge upload failed for \(filename): \(errorMessage)")
                        
                        continuation.resume(returning: [
                            "photoId": photoId,
                            "filename": filename,
                            "status": "failed",
                            "error": "UPLOAD_FAILED",
                            "message": errorMessage,
                            "statusCode": statusCode ?? 0
                        ])
                    }
                }
            }
        }
    }
    
    /// Upload image data to server using multipart form (fallback method - direct HTTP)
    private func uploadImageDataToServer(imageData: Data, filename: String, eventId: String, jwtToken: String, photo: [String: Any]) async -> [String: Any] {
        // Use the same upload endpoint as EventPhotoPicker
        guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/multipart-upload") else {
            NSLog("❌ Invalid multipart-upload URL")
            return [
                "photoId": photo["localIdentifier"] ?? "unknown",
                "filename": filename,
                "status": "failed",
                "error": "INVALID_URL",
                "message": "Upload endpoint URL is invalid"
            ]
        }
        
        // Generate boundary for multipart form data
        let boundary = "Boundary-\(UUID().uuidString)"
        
        // Create multipart form data
        var formData = Data()
        
        // Add file data
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        formData.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        formData.append(imageData)
        formData.append("\r\n".data(using: .utf8)!)
        
        // Add event_id
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"event_id\"\r\n\r\n".data(using: .utf8)!)
        formData.append("\(eventId)\r\n".data(using: .utf8)!)
        
        // Add file_name (required by multipart-upload endpoint)
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"file_name\"\r\n\r\n".data(using: .utf8)!)
        formData.append("\(filename)\r\n".data(using: .utf8)!)
        
        // Add media_type (required by multipart-upload endpoint)
        formData.append("--\(boundary)\r\n".data(using: .utf8)!)
        formData.append("Content-Disposition: form-data; name=\"media_type\"\r\n\r\n".data(using: .utf8)!)
        formData.append("photo\r\n".data(using: .utf8)!)
        
        // Add original timestamp if available
        if let creationDate = photo["creationDate"] as? TimeInterval {
            let isoDate = ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: creationDate))
            formData.append("--\(boundary)\r\n".data(using: .utf8)!)
            formData.append("Content-Disposition: form-data; name=\"originalTimestamp\"\r\n\r\n".data(using: .utf8)!)
            formData.append("\(isoDate)\r\n".data(using: .utf8)!)
        }
        
        // Add device photo hash if available
        if let fileHash = photo["fileHash"] as? String, !fileHash.isEmpty {
            formData.append("--\(boundary)\r\n".data(using: .utf8)!)
            formData.append("Content-Disposition: form-data; name=\"device_photo_hash\"\r\n\r\n".data(using: .utf8)!)
            formData.append("\(fileHash)\r\n".data(using: .utf8)!)
        }
        
        // Add image dimensions
        if let width = photo["pixelWidth"] as? Int, let height = photo["pixelHeight"] as? Int {
            formData.append("--\(boundary)\r\n".data(using: .utf8)!)
            formData.append("Content-Disposition: form-data; name=\"image_width\"\r\n\r\n".data(using: .utf8)!)
            formData.append("\(width)\r\n".data(using: .utf8)!)
            
            formData.append("--\(boundary)\r\n".data(using: .utf8)!)
            formData.append("Content-Disposition: form-data; name=\"image_height\"\r\n\r\n".data(using: .utf8)!)
            formData.append("\(height)\r\n".data(using: .utf8)!)
        }
        
        // Close boundary
        formData.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Create HTTP request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("\(formData.count)", forHTTPHeaderField: "Content-Length")
        request.httpBody = formData
        request.timeoutInterval = 60.0 // 60 second timeout for uploads
        
        NSLog("📡 Uploading \(filename) (\(imageData.count) bytes) to: \(url.absoluteString)")
        NSLog("📡 Authorization: Bearer \(jwtToken.prefix(20))...")
        NSLog("📡 JWT Token Length: \(jwtToken.count) characters")
        NSLog("📡 JWT Token Type: \(jwtToken.hasPrefix("eyJ") ? "JWT (starts with eyJ)" : "NOT JWT - \(jwtToken.prefix(10))")")
        NSLog("📡 Content-Length: \(formData.count) bytes")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                NSLog("❌ Invalid HTTP response for \(filename)")
                return [
                    "photoId": photo["localIdentifier"] ?? "unknown",
                    "filename": filename,
                    "status": "failed",
                    "error": "INVALID_RESPONSE",
                    "message": "Invalid HTTP response from server"
                ]
            }
            
            // Handle Cloudflare 403 blocks (following Android/web pattern)
            if httpResponse.statusCode == 403 {
                let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type") ?? ""
                
                if contentType.contains("text/html") {
                    NSLog("⚠️ Cloudflare 403 block detected for \(filename) (HTML response)")
                    NSLog("📡 Content-Type: \(contentType)")
                    
                    // This is a Cloudflare block page, not a legitimate 403 from our API
                    // The response will be HTML (appears binary) containing Access Denied message
                    return [
                        "photoId": photo["localIdentifier"] ?? "unknown",
                        "filename": filename,
                        "status": "failed",
                        "error": "CLOUDFLARE_BLOCK",
                        "message": "Cloudflare blocked the request - HTML response received",
                        "retry_eligible": true,
                        "statusCode": 403
                    ]
                } else if contentType.contains("application/json") {
                    NSLog("⚠️ Legitimate 403 error for \(filename) (JSON response)")
                    // This is a legitimate 403 from our API - parse the JSON error
                }
            }
            
            NSLog("📡 Upload response for \(filename): HTTP \(httpResponse.statusCode)")
            
            // Log response data for debugging
            if let responseString = String(data: data, encoding: .utf8) {
                let truncated = responseString.count > 300 ? String(responseString.prefix(300)) + "..." : responseString
                NSLog("📡 Upload response body: \(truncated)")
            }
            
            // Handle 409 Conflict (duplicate) as success - photo already exists
            if httpResponse.statusCode == 409 {
                NSLog("ℹ️ Photo already uploaded (409 duplicate): \(filename)")
                
                // Parse the duplicate response to get media_id and file_url
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        let mediaId = json["media_id"] as? String
                        let fileUrl = json["file_url"] as? String
                        
                        return [
                            "photoId": photo["localIdentifier"] ?? "unknown",
                            "filename": filename,
                            "status": "success",  // Treat duplicate as success
                            "duplicate": true,
                            "media_id": mediaId ?? "",
                            "file_url": fileUrl ?? "",
                            "message": "Photo already uploaded (duplicate)"
                        ]
                    }
                } catch {
                    NSLog("⚠️ Failed to parse 409 response for \(filename)")
                }
                
                // Even if parsing fails, treat 409 as success (duplicate)
                return [
                    "photoId": photo["localIdentifier"] ?? "unknown",
                    "filename": filename,
                    "status": "success",
                    "duplicate": true,
                    "message": "Photo already uploaded"
                ]
            }
            
            if httpResponse.statusCode == 200 || httpResponse.statusCode == 201 {
                // Parse success response
                do {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        NSLog("✅ Photo \(filename) uploaded successfully")
                        
                        return [
                            "photoId": photo["localIdentifier"] ?? "unknown",
                            "filename": filename,
                            "status": "success",
                            "uploadedAt": ISO8601DateFormatter().string(from: Date()),
                            "response": json,
                            "fileSize": imageData.count,
                            "message": "Photo uploaded successfully"
                        ]
                    } else {
                        NSLog("⚠️ Upload successful but invalid JSON response for \(filename)")
                        return [
                            "photoId": photo["localIdentifier"] ?? "unknown",
                            "filename": filename,
                            "status": "success",
                            "uploadedAt": ISO8601DateFormatter().string(from: Date()),
                            "fileSize": imageData.count,
                            "message": "Photo uploaded successfully (no JSON response)"
                        ]
                    }
                } catch {
                    NSLog("⚠️ Upload successful but JSON parsing failed for \(filename): \(error)")
                    return [
                        "photoId": photo["localIdentifier"] ?? "unknown",
                        "filename": filename,
                        "status": "success",
                        "uploadedAt": ISO8601DateFormatter().string(from: Date()),
                        "fileSize": imageData.count,
                        "message": "Photo uploaded successfully (JSON parse error)"
                    ]
                }
            } else {
                NSLog("❌ Upload failed for \(filename): HTTP \(httpResponse.statusCode)")
                
                var errorMessage = "Upload failed with HTTP \(httpResponse.statusCode)"
                if let responseString = String(data: data, encoding: .utf8) {
                    errorMessage = responseString
                }
                
                return [
                    "photoId": photo["localIdentifier"] ?? "unknown",
                    "filename": filename,
                    "status": "failed",
                    "error": "HTTP_\(httpResponse.statusCode)",
                    "message": errorMessage
                ]
            }
            
        } catch {
            NSLog("❌ Network error uploading \(filename): \(error.localizedDescription)")
            return [
                "photoId": photo["localIdentifier"] ?? "unknown",
                "filename": filename,
                "status": "failed",
                "error": "NETWORK_ERROR",
                "message": error.localizedDescription
            ]
        }
    }
    
    // MARK: - Auto Upload Flow Entry Point
    
    /// Start the auto-upload flow with proper JWT token validation (like EventPhotoPicker)
    @objc func startAutoUploadFlow(_ call: CAPPluginCall) {
        NSLog("🚀 AutoUpload: startAutoUploadFlow called")
        
        Task {
            do {
                // Step 1: Wait for auth bridge to be ready (like triggerAutoSupabaseTokenCheck)
                NSLog("⏳ Waiting for auth bridge to be ready...")
                let authReady = await waitForAuthBridge(maxWaitSeconds: 15)
                
                if !authReady {
                    NSLog("❌ Auth bridge timeout - unable to proceed")
                    call.reject("Auth bridge timeout", "AUTH_BRIDGE_TIMEOUT", nil)
                    return
                }
                
                NSLog("✅ Auth bridge is ready, proceeding with settings check...")
                
                // Step 2: Check global auto-upload settings
                NSLog("⚙️ Checking global auto-upload settings...")
                let globalSettings = await getGlobalAutoUploadSettings()
                
                // Check if auto-upload is globally disabled
                if !globalSettings.isEnabled {
                    NSLog("❌ Auto-upload is globally disabled")
                    call.resolve([
                        "success": true,
                        "message": "Auto-upload is globally disabled",
                        "eventsProcessed": 0,
                        "photosUploaded": 0
                    ])
                    return
                }
                
                // Check WiFi-only requirement
                if globalSettings.wifiOnly {
                    let isOnWiFi = await checkWiFiConnection()
                    if !isOnWiFi {
                        NSLog("❌ WiFi-only mode enabled but device is on cellular")
                        call.resolve([
                            "success": true,
                            "message": "WiFi-only mode enabled but device is on cellular",
                            "eventsProcessed": 0,
                            "photosUploaded": 0
                        ])
                        return
                    }
                    NSLog("✅ WiFi-only mode enabled and device is on WiFi")
                }
                
                NSLog("✅ Global auto-upload settings validated")
                
                // Step 3: Get JWT token using AppDelegate pattern (like EventPhotoPicker does)
                var jwtToken: String? = call.getString("jwtToken")
                
                if let token = jwtToken {
                    NSLog("✅ JWT token received from JavaScript: \(token.prefix(20))...")
                } else {
                    NSLog("⚠️ No JWT token received from JavaScript, using AppDelegate pattern")
                    
                    // Use the same pattern as EventPhotoPicker - check if token is valid first
                    if !AppDelegate.isJwtTokenValid() {
                        NSLog("🔄 JWT token invalid, refreshing...")
                        
                        // Refresh token synchronously like EventPhotoPicker does
                        let semaphore = DispatchSemaphore(value: 0)
                        var refreshedToken: String?
                        
                        AppDelegate.refreshJwtTokenIfNeeded { token in
                            refreshedToken = token
                            semaphore.signal()
                        }
                        
                        semaphore.wait()
                        
                        if let token = refreshedToken {
                            NSLog("✅ Got fresh JWT token after refresh: \(token.prefix(20))...")
                            NSLog("🔍 Fresh JWT Token Length: \(token.count) characters")
                            NSLog("🔍 Fresh JWT Token Type: \(token.hasPrefix("eyJ") ? "JWT (starts with eyJ)" : "NOT JWT - \(token.prefix(10))")")
                            jwtToken = token
                        } else {
                            NSLog("❌ Failed to refresh JWT token")
                            call.reject("Failed to refresh JWT token", "JWT_REFRESH_FAILED", nil)
                            return
                        }
                    } else {
                        // Token is valid, use the stored one (like EventPhotoPicker does)
                        jwtToken = AppDelegate.getStoredJwtToken()
                        
                        if let token = jwtToken {
                            NSLog("✅ Using valid stored JWT token: \(token.prefix(20))...")
                            NSLog("🔍 Stored JWT Token Length: \(token.count) characters")
                            NSLog("🔍 Stored JWT Token Type: \(token.hasPrefix("eyJ") ? "JWT (starts with eyJ)" : "NOT JWT - \(token.prefix(10))")")
                        } else {
                            NSLog("❌ No JWT token available from AppDelegate")
                            call.reject("No JWT token available", "NO_JWT_TOKEN", nil)
                            return
                        }
                    }
                }
                
                guard let token = jwtToken else {
                    NSLog("❌ No JWT token available for auto-upload")
                    call.reject("No JWT token available", "NO_JWT_TOKEN", nil)
                    return
                }
                
                NSLog("🔐 Starting auto-upload flow with JWT token: \(token.prefix(20))...")
                
                // Get Supabase session data (like triggerAutoSupabaseTokenCheck does)
                NSLog("🔍 Getting Supabase session data for user events...")
                let (supabaseToken, userId) = await getSupabaseSessionData()
                
                guard let tokenValue = supabaseToken, let userIdValue = userId else {
                    NSLog("❌ Failed to get Supabase session data")
                    call.reject("Failed to get Supabase session", "NO_SUPABASE_SESSION", nil)
                    return
                }
                
                NSLog("✅ Supabase session obtained")
                NSLog("👤 User ID: \(userIdValue)")
                NSLog("🔐 Supabase token preview: \(String(tokenValue.prefix(20)))...")
                
                // Step 1: Get user events using Supabase token
                NSLog("📋 Getting user events...")
                let userEvents = await fetchUserEventsFromAPI(supabaseToken: tokenValue, userId: userIdValue)
                
                if userEvents.isEmpty {
                    NSLog("ℹ️ No events found for user")
                    call.resolve([
                        "success": true,
                        "message": "No events found",
                        "eventsProcessed": 0,
                        "photosUploaded": 0
                    ])
                    return
                }
                
                NSLog("📊 Found \(userEvents.count) events to process")
                
                // Step 2: Process each event sequentially with overlay updates
                var totalPhotosUploaded = 0
                
                for (index, event) in userEvents.enumerated() {
                    guard let eventId = event["id"] as? String,
                          let eventName = event["name"] as? String else {
                        NSLog("⚠️ Skipping event with missing id or name: \(event)")
                        continue
                    }
                    
                    NSLog("🔍 Processing event \(index + 1)/\(userEvents.count): \(eventName) (ID: \(eventId))")
                    
                    // Check if auto-upload is enabled for this specific event
                    let eventAutoUploadEnabled = event["auto_upload_enabled"] as? Bool ?? false
                    if !eventAutoUploadEnabled {
                        NSLog("⏭️ Skipping event \(eventName) - auto-upload disabled for this event")
                        continue
                    }
                    
                    NSLog("✅ Event \(eventName) has auto-upload enabled")
                    
                    // Scan this event for new photos
                    let photosUploaded = await scanSingleEventForUploads(
                        event: event,
                        supabaseToken: tokenValue,
                        userId: userIdValue,
                        jwtToken: token
                    )
                    
                    totalPhotosUploaded += photosUploaded
                    NSLog("📊 Event \(eventName): uploaded \(photosUploaded) photos")
                }
                
                // Hide overlay after all events are processed
                await hideScanningOverlayAfterAllEvents()
                
                NSLog("✅ Auto-upload flow completed: \(userEvents.count) events processed, \(totalPhotosUploaded) photos uploaded")
                
                call.resolve([
                    "success": true,
                    "message": "Auto-upload completed successfully",
                    "eventsProcessed": userEvents.count,
                    "photosUploaded": totalPhotosUploaded
                ])
                
            } catch {
                NSLog("❌ Auto-upload flow failed: \(error)")
                call.reject("Auto-upload flow failed", "AUTO_UPLOAD_ERROR", error)
            }
        }
    }
    
    /// Scan a single event for uploads using proper JWT token
    private func scanSingleEventForUploads(event: [String: Any], supabaseToken: String, userId: String, jwtToken: String) async -> Int {
        guard let eventId = event["id"] as? String,
              let eventName = event["name"] as? String else {
            NSLog("⚠️ Skipping event with missing id or name")
            return 0
        }
        
        // Show scanning overlay for this event
        await updateScanningOverlayMessage(eventName: eventName, current: 1, total: 1)
        
        NSLog("🔍 Scanning \(eventName) for photos to upload...")
        NSLog("🔐 Using JWT token for \(eventName): \(jwtToken.prefix(20))...")
        
        // Step 1: Check uploaded photos for this event using JWT token
        NSLog("📋 Checking uploaded photos for \(eventName)...")
        let uploadedPhotos = await fetchUploadedPhotosFromAPI(eventId: eventId, jwtToken: jwtToken)
        
        // Create hash map for duplicate detection
        var photoHashMap: [String: Bool] = [:]
        for uploadedPhoto in uploadedPhotos {
            if let fileHash = uploadedPhoto["file_hash"] as? String {
                photoHashMap[fileHash] = true
            }
        }
        
        NSLog("📊 Found \(uploadedPhotos.count) uploaded photos for \(eventName)")
        
        // Step 2: Get event date range for photo scanning
        guard let startTimeStr = event["start_time"] as? String,
              let endTimeStr = event["end_time"] as? String else {
            NSLog("⚠️ Event missing start_time or end_time")
            return 0
        }
        
        // Parse ISO8601 dates
        let formatter = ISO8601DateFormatter()
        guard let startDate = formatter.date(from: startTimeStr),
              let endDate = formatter.date(from: endTimeStr) else {
            NSLog("⚠️ Failed to parse event dates")
            return 0
        }
        
        NSLog("📅 Event date range: \(startDate) to \(endDate)")
        
        // Step 3: Scan local photos for this event using existing method
        let eventPhotos = await scanDevicePhotos(startDate: startDate, endDate: endDate, eventId: eventId, photoHashMap: photoHashMap)
        NSLog("📱 Found \(eventPhotos.count) local photos for \(eventName)")
        
        // The scanDevicePhotos method already filters out duplicates, so these are all new photos
        let newPhotos = eventPhotos
        
        let newPhotosCount = newPhotos.count
        NSLog("📈 Found \(newPhotosCount) new photos to upload for \(eventName)")
        
        // Step 4: Upload photos if any found
        if newPhotosCount > 0 {
            NSLog("📤 Starting upload of \(newPhotosCount) photos for \(eventName)")
            await updateOverlayToUploadMode(eventName: eventName, total: newPhotosCount)
            
            let uploadedCount = await uploadPhotosForEvent(
                photos: newPhotos,
                eventId: eventId,
                eventName: eventName,
                jwtToken: jwtToken
            )
            
            NSLog("✅ Uploaded \(uploadedCount)/\(newPhotosCount) photos for \(eventName)")
            return uploadedCount
        } else {
            NSLog("ℹ️ No new photos to upload for \(eventName)")
            return 0
        }
    }
    
    // MARK: - Auto-Upload Settings Validation
    
    /// Structure to hold global auto-upload settings
    private struct GlobalAutoUploadSettings {
        let isEnabled: Bool
        let wifiOnly: Bool
    }
    
    /// Get global auto-upload settings from localStorage
    private func getGlobalAutoUploadSettings() async -> GlobalAutoUploadSettings {
        return await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                // Get user ID first to construct the localStorage key
                NSLog("🔍 Executing JavaScript to get auto-upload settings from localStorage...")
                
                let script = """
                    (function() {
                        try {
                            console.log('🔍 JS: Getting auto-upload settings from localStorage...');
                            
                            // Try to get user ID from multiple sources
                            let userId = null;
                            
                            // Method 1: Try to get from Supabase (but don't destructure in case it fails)
                            if (window.supabase && window.supabase.auth) {
                                try {
                                    const userResult = window.supabase.auth.getUser();
                                    if (userResult && userResult.data && userResult.data.user) {
                                        userId = userResult.data.user.id;
                                        console.log('🔍 JS: Got user ID from Supabase:', userId);
                                    }
                                } catch (e) {
                                    console.log('🔍 JS: Could not get user from Supabase:', e.message);
                                }
                            }
                            
                            // Method 2: If no user ID yet, find any auto_upload_settings key in localStorage
                            if (!userId) {
                                const keys = Object.keys(localStorage);
                                const settingsKey = keys.find(key => key.startsWith('auto_upload_settings_'));
                                if (settingsKey) {
                                    userId = settingsKey.replace('auto_upload_settings_', '');
                                    console.log('🔍 JS: Found user ID from localStorage key:', userId);
                                }
                            }
                            
                            if (userId) {
                                const settingsKey = `auto_upload_settings_${userId}`;
                                console.log('🔍 JS: Looking for localStorage key:', settingsKey);
                                
                                const settingsJson = localStorage.getItem(settingsKey);
                                console.log('🔍 JS: localStorage value:', settingsJson);
                                    
                                    if (settingsJson) {
                                        const settings = JSON.parse(settingsJson);
                                        console.log('🔍 JS: Parsed settings:', settings);
                                        
                                        return {
                                            success: true,
                                            isEnabled: settings.enabled === true || settings.autoUploadEnabled === true,
                                            wifiOnly: settings.wifiOnly === true || settings.wifiOnlyUpload === true,
                                            userId: userId,
                                            settingsKey: settingsKey,
                                            rawSettings: settings
                                        };
                                    } else {
                                        console.log('🔍 JS: No settings found in localStorage');
                                        return {
                                            success: true,
                                            isEnabled: false,
                                            wifiOnly: false,
                                            userId: userId,
                                            settingsKey: settingsKey,
                                            reason: 'No localStorage entry found'
                                        };
                                    }
                            } else {
                                console.log('🔍 JS: No user ID found from any source');
                                return {
                                    success: false,
                                    error: 'No user ID available'
                                };
                            }
                        } catch (error) {
                            console.log('🔍 JS: Error getting settings:', error);
                            return {
                                success: false,
                                error: error.toString()
                            };
                        }
                    })();
                """
                
                self.bridge?.webView?.evaluateJavaScript(script) { result, error in
                    if let error = error {
                        NSLog("❌ Error getting auto-upload settings: \(error)")
                        continuation.resume(returning: GlobalAutoUploadSettings(isEnabled: false, wifiOnly: false))
                        return
                    }
                    
                    guard let resultDict = result as? [String: Any] else {
                        NSLog("❌ Invalid result format for auto-upload settings")
                        continuation.resume(returning: GlobalAutoUploadSettings(isEnabled: false, wifiOnly: false))
                        return
                    }
                    
                    if let success = resultDict["success"] as? Bool, success {
                        let isEnabled = resultDict["isEnabled"] as? Bool ?? false
                        let wifiOnly = resultDict["wifiOnly"] as? Bool ?? false
                        let userId = resultDict["userId"] as? String ?? "Unknown"
                        let settingsKey = resultDict["settingsKey"] as? String ?? "Unknown"
                        let reason = resultDict["reason"] as? String
                        
                        NSLog("🔧 ==================== GLOBAL AUTO-UPLOAD SETTINGS ====================")
                        NSLog("👤 User ID: \(userId)")
                        NSLog("🔑 localStorage Key: \(settingsKey)")
                        NSLog("⚙️ Auto-upload globally enabled: \(isEnabled)")
                        NSLog("📡 WiFi-only mode enabled: \(wifiOnly)")
                        if let reason = reason {
                            NSLog("ℹ️ Reason: \(reason)")
                        }
                        if let rawSettings = resultDict["rawSettings"] {
                            NSLog("📱 Raw settings from localStorage: \(rawSettings)")
                        }
                        NSLog("🔧 ================================================================")
                        
                        continuation.resume(returning: GlobalAutoUploadSettings(isEnabled: isEnabled, wifiOnly: wifiOnly))
                    } else {
                        let errorMsg = resultDict["error"] as? String ?? "Unknown error"
                        NSLog("❌ ==================== AUTO-UPLOAD SETTINGS ERROR ====================")
                        NSLog("❌ Failed to get auto-upload settings: \(errorMsg)")
                        NSLog("📱 Full result dict: \(resultDict)")
                        NSLog("❌ ================================================================")
                        continuation.resume(returning: GlobalAutoUploadSettings(isEnabled: false, wifiOnly: false))
                    }
                }
            }
        }
    }
    
    /// Check if device is connected to WiFi (using PhotoLibraryMonitor's proven method)
    private func checkWiFiConnection() async -> Bool {
        return await withCheckedContinuation { continuation in
            // Use the same method as PhotoLibraryMonitor.checkNetworkStatus
            let monitor = NWPathMonitor()
            let queue = DispatchQueue(label: "NetworkMonitor")
            
            monitor.pathUpdateHandler = { path in
                let isConnected = path.status == .satisfied
                let isWiFi = path.usesInterfaceType(.wifi)
                let isCellular = path.usesInterfaceType(.cellular)
                
                NSLog("📡 AutoUpload WiFi Check:")
                NSLog("  - Connected: \(isConnected)")
                NSLog("  - WiFi: \(isWiFi)")
                NSLog("  - Cellular: \(isCellular)")
                
                monitor.cancel()
                continuation.resume(returning: isWiFi)
            }
            
            monitor.start(queue: queue)
        }
    }
}