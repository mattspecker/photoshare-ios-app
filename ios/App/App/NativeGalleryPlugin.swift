import Foundation
import Photos
import Capacitor
import UIKit

@objc(NativeGalleryPlugin)
public class NativeGalleryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeGalleryPlugin"
    public let jsName = "NativeGallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openGallery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sharePhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportPhoto", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    private var currentPhotos: [[String: String]] = []
    private var currentStartIndex: Int = 0
    private var currentDisplayIndex: Int = 0  // Track which photo is currently displayed
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        NSLog("🖼️ NativeGalleryPlugin loaded successfully!")
        NSLog("🖼️ Available methods: isAvailable, openGallery, downloadPhoto, sharePhoto, reportPhoto")
    }
    
    // MARK: - Plugin Methods
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }
    
    @objc func openGallery(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: openGallery called")
        NSLog("🖼️ Call parameters: \(call.options)")
        
        guard let photos = call.getArray("photos", JSObject.self) else {
            NSLog("❌ Photos array is missing or invalid")
            call.reject("Photos array is required")
            return
        }
        
        let startIndex = call.getInt("startIndex") ?? 0
        NSLog("🖼️ Received startIndex: \(startIndex)")
        
        // Get eventId from call parameters for context
        let eventId = call.getString("eventId") ?? "unknown"
        
        // Convert JSObject array to expected format for PhotoViewer
        var imageList: [[String: String]] = []
        
        for photo in photos {
            guard let photoDict = photo as? [String: Any] else {
                continue
            }
            
            // Use thumbnailUrl for gallery display, fallback to url for backward compatibility
            let thumbnailUrl = photoDict["thumbnailUrl"] as? String ?? photoDict["url"] as? String ?? ""
            let fullUrl = photoDict["fullUrl"] as? String ?? photoDict["url"] as? String ?? ""
            
            let title = photoDict["title"] as? String ?? ""
            let id = photoDict["id"] as? String ?? ""
            let uploadedBy = photoDict["uploadedBy"] as? String ?? "User"
            let uploadedAt = photoDict["uploadedAt"] as? String ?? ""
            let isOwn = photoDict["isOwn"] as? Bool ?? false
            
            imageList.append([
                "thumbnailUrl": thumbnailUrl,  // For gallery display
                "fullUrl": fullUrl,           // For download/share
                "title": title,
                "id": id,
                "uploadedBy": uploadedBy,
                "uploadedAt": uploadedAt,
                "isOwn": String(isOwn),
                "eventId": eventId
            ])
        }
        
        // Get just the selected image if startIndex is valid
        var selectedImage: [String: String]?
        if startIndex >= 0 && startIndex < imageList.count {
            selectedImage = imageList[startIndex]
            NSLog("🎯 Selected image at index \(startIndex): \(selectedImage?["url"] ?? "no-url")")
        }
        
        if imageList.isEmpty {
            call.reject("No valid photos found in array")
            return
        }
        
        // Store current photos for other operations
        self.currentPhotos = imageList
        self.currentStartIndex = startIndex
        self.currentDisplayIndex = startIndex  // Initialize display index
        
        NSLog("🖼️ Opening gallery with \(imageList.count) photos, starting at index \(startIndex)")
        
        DispatchQueue.main.async {
            // Always use full gallery with correct startIndex now that we know it works
            self.presentPhotoViewer(imageList: imageList, startIndex: startIndex, call: call)
        }
    }
    
    @objc func downloadPhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: downloadPhoto called")
        
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        // Check photo library permission
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            downloadImageFromUrl(url: url, call: call)
        case .denied, .restricted:
            call.reject("Photo library access denied")
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self.downloadImageFromUrl(url: url, call: call)
                    } else {
                        call.reject("Photo library access denied")
                    }
                }
            }
        @unknown default:
            call.reject("Unknown photo library authorization status")
        }
    }
    
    @objc func sharePhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: sharePhoto called")
        
        // Try to get fullUrl first, fallback to url for backward compatibility
        let fullUrl = call.getString("fullUrl")
        let url = fullUrl ?? call.getString("url")
        
        guard let finalUrl = url else {
            call.reject("URL is required")
            return
        }
        
        NSLog("🖼️ Using URL for share: \(finalUrl)")
        
        DispatchQueue.main.async {
            self.presentShareSheet(url: finalUrl, call: call)
        }
    }
    
    @objc func reportPhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: reportPhoto called")
        
        guard let photoId = call.getString("photoId") else {
            call.reject("Photo ID is required")
            return
        }
        
        // Send callback to web app
        self.notifyListeners("photoReported", data: ["photoId": photoId])
        
        call.resolve(["success": true, "photoId": photoId])
    }
    
    // MARK: - Private Helper Methods
    
    private func presentSinglePhoto(photo: [String: String], call: CAPPluginCall) {
        NSLog("🎯 Opening single photo: \(photo["fullUrl"] ?? "no-url")")
        
        // Create single image array for PhotoViewer using fullUrl
        let userName = photo["uploadedBy"] ?? "Unknown"
        let singleImage = [
            "url": photo["fullUrl"] ?? "",
            "title": "1/1",
            "subtitle": "Photo by \(userName)"
        ]
        
        // Simple JavaScript call for single image
        let jsCode = """
        console.log('🎯 Opening single photo');
        window.Capacitor.Plugins.PhotoViewer.show({
            images: [\(convertToJSONString(singleImage))],
            mode: 'one',
            startIndex: 0
        });
        """
        
        NSLog("🎯 Executing single photo JavaScript")
        self.bridge?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
        call.resolve(["success": true])
    }
    
    private func presentPhotoViewer(imageList: [[String: String]], startIndex: Int, call: CAPPluginCall) {
        NSLog("🖼️ Opening PhotoViewer with \(imageList.count) photos")
        NSLog("🖼️ Start index: \(startIndex)")
        
        DispatchQueue.main.async {
            // Prepare data for PhotoViewer plugin
            var photoViewerImages: [[String: Any]] = []
            
            for (index, photo) in imageList.enumerated() {
                let currentPosition = index + 1  // 1-based counting for display
                let totalCount = imageList.count
                let userName = photo["uploadedBy"] ?? "Unknown"
                
                let imageData = [
                    "url": photo["fullUrl"] ?? "",  // Use fullUrl for both display and share
                    "title": "\(currentPosition)/\(totalCount)",
                    "subtitle": "Photo by \(userName)"
                ]
                photoViewerImages.append(imageData)
                NSLog("🖼️ Added full-res photo: \(photo["fullUrl"] ?? "no-url") - \(currentPosition)/\(totalCount)")
            }
            
            NSLog("🖼️ Calling PhotoViewer plugin directly with correct parameters")
            
            // Call PhotoViewer plugin directly like the original implementation
            if let photoViewerPlugin = self.bridge?.plugin(withName: "PhotoViewer") {
                NSLog("🖼️ Found PhotoViewer plugin, creating JavaScript call")
                
                NSLog("🖼️ About to call PhotoViewer with startIndex: \(startIndex) for \(photoViewerImages.count) images")
                
                // Use correct parameter name: startFrom instead of startIndex
                let jsCode = """
                console.log('🚀 Opening PhotoViewer gallery with startFrom: \(startIndex)');
                window.Capacitor.Plugins.PhotoViewer.show({
                    images: \(self.convertToJSONString(photoViewerImages)),
                    mode: 'slider',
                    startFrom: \(startIndex)
                });
                """
                
                NSLog("🖼️ Executing simplified JavaScript call")
                
                // Use the same approach that worked for single image
                self.bridge?.webView?.evaluateJavaScript(jsCode, completionHandler: nil)
                
                // Add overlay buttons after a short delay to let PhotoViewer load
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.addOverlayButtons()
                    self.startMonitoringPhotoViewerSwipes()
                }
                
                call.resolve(["success": true])
            } else {
                NSLog("❌ PhotoViewer plugin not found")
                call.reject("PhotoViewer plugin not available")
            }
        }
    }
    
    private func convertImagesToJsonString(_ imageList: [[String: String]]) -> String {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: imageList, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
            return jsonString
        } catch {
            NSLog("❌ NativeGallery: Error converting images to JSON: \(error)")
            return "[]"
        }
    }
    
    private func convertToJSONString(_ object: Any) -> String {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: object, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            return jsonString
        } catch {
            NSLog("❌ NativeGallery: Error converting object to JSON: \(error)")
            return "{}"
        }
    }
    
    private func addOverlayButtons() {
        NSLog("🔘 Adding overlay buttons to PhotoViewer")
        
        guard let topViewController = self.bridge?.viewController else {
            NSLog("❌ Could not get top view controller for overlay")
            return
        }
        
        // Find the top-most presented view controller (PhotoViewer)
        var presentedVC = topViewController
        while let presented = presentedVC.presentedViewController {
            presentedVC = presented
        }
        
        // Create username label for "Photo by username"
        let usernameLabel = UILabel()
        usernameLabel.text = self.getCurrentUserText()
        usernameLabel.font = UIFont(name: "Outfit-Medium", size: 16) ?? UIFont.systemFont(ofSize: 16, weight: .medium)
        usernameLabel.textColor = .white
        usernameLabel.backgroundColor = UIColor.clear
        usernameLabel.textAlignment = .left
        usernameLabel.translatesAutoresizingMaskIntoConstraints = false
        usernameLabel.tag = 9999  // Tag to find and update later
        
        // Create download button - icon only with 48x48 touch area
        let downloadButton = UIButton(type: .system)
        downloadButton.setTitle("📥", for: .normal)
        downloadButton.titleLabel?.font = UIFont(name: "Outfit-Medium", size: 24) ?? UIFont.systemFont(ofSize: 24, weight: .medium)
        downloadButton.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        downloadButton.setTitleColor(.white, for: .normal)
        downloadButton.layer.cornerRadius = 24
        downloadButton.translatesAutoresizingMaskIntoConstraints = false
        downloadButton.addTarget(self, action: #selector(downloadButtonTapped), for: .touchUpInside)
        
        // Create report button - icon only with 48x48 touch area (only show if not user's own photo)
        let reportButton = UIButton(type: .system)
        reportButton.setTitle("⚠️", for: .normal)
        reportButton.titleLabel?.font = UIFont(name: "Outfit-Medium", size: 24) ?? UIFont.systemFont(ofSize: 24, weight: .medium)
        reportButton.backgroundColor = UIColor.red.withAlphaComponent(0.7)
        reportButton.setTitleColor(.white, for: .normal)
        reportButton.layer.cornerRadius = 24
        reportButton.translatesAutoresizingMaskIntoConstraints = false
        reportButton.addTarget(self, action: #selector(reportButtonTapped), for: .touchUpInside)
        reportButton.tag = 8888  // Tag to find and update visibility later
        
        // Add elements to the presented view controller
        presentedVC.view.addSubview(usernameLabel)
        presentedVC.view.addSubview(downloadButton)
        presentedVC.view.addSubview(reportButton)
        
        // Position elements in a single row
        NSLayoutConstraint.activate([
            // Username label - bottom left
            usernameLabel.leadingAnchor.constraint(equalTo: presentedVC.view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            usernameLabel.bottomAnchor.constraint(equalTo: presentedVC.view.safeAreaLayoutGuide.bottomAnchor, constant: -40),
            usernameLabel.heightAnchor.constraint(equalToConstant: 48), // Match button height for alignment
            
            // Report button - bottom right (rightmost)
            reportButton.trailingAnchor.constraint(equalTo: presentedVC.view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            reportButton.bottomAnchor.constraint(equalTo: presentedVC.view.safeAreaLayoutGuide.bottomAnchor, constant: -40),
            reportButton.widthAnchor.constraint(equalToConstant: 48),
            reportButton.heightAnchor.constraint(equalToConstant: 48),
            
            // Download button - next to report button
            downloadButton.trailingAnchor.constraint(equalTo: reportButton.leadingAnchor, constant: -10),
            downloadButton.bottomAnchor.constraint(equalTo: presentedVC.view.safeAreaLayoutGuide.bottomAnchor, constant: -40),
            downloadButton.widthAnchor.constraint(equalToConstant: 48),
            downloadButton.heightAnchor.constraint(equalToConstant: 48),
            
            // Ensure username label doesn't overlap buttons
            usernameLabel.trailingAnchor.constraint(lessThanOrEqualTo: downloadButton.leadingAnchor, constant: -20)
        ])
        
        // Set initial report button visibility based on current photo ownership
        self.updateReportButtonVisibility(presentedVC: presentedVC)
        
        NSLog("✅ Overlay buttons and username label added successfully")
    }
    
    private func startMonitoringPhotoViewerSwipes() {
        // Monitor for swipe events by checking the current visible image periodically
        // This is a workaround since PhotoViewer doesn't provide swipe callbacks
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { timer in
            // Check if PhotoViewer is still presented
            guard let topViewController = self.bridge?.viewController else {
                timer.invalidate()
                return
            }
            
            var presentedVC = topViewController
            while let presented = presentedVC.presentedViewController {
                presentedVC = presented
            }
            
            // If PhotoViewer is dismissed, stop monitoring
            if presentedVC == topViewController {
                timer.invalidate()
                NSLog("🛑 PhotoViewer dismissed, stopping swipe monitoring")
                return
            }
            
            // Try to detect current photo index via JavaScript
            self.updateCurrentPhotoIndex()
            
            // Update username label when swipe is detected
            self.updateUsernameLabel(presentedVC: presentedVC)
        }
    }
    
    private func updateCurrentPhotoIndex() {
        // Use the same improved JavaScript logic to detect current index
        let jsCode = """
        (function() {
            try {
                // Strategy 1: Check PhotoViewer native implementation methods
                if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PhotoViewer) {
                    const viewer = window.Capacitor.Plugins.PhotoViewer;
                    if (viewer.getCurrentIndex && typeof viewer.getCurrentIndex === 'function') {
                        const index = viewer.getCurrentIndex();
                        if (typeof index === 'number' && index >= 0) {
                            return index;
                        }
                    }
                }
                
                // Strategy 2: Check for PhotoViewer DOM elements
                const containers = ['.photoviewer-container', '.swiper-container', '.photoviewer-modal'];
                for (const selector of containers) {
                    const container = document.querySelector(selector);
                    if (container) {
                        const activeSlide = container.querySelector('.swiper-slide-active, .active');
                        if (activeSlide) {
                            const slideIndex = activeSlide.getAttribute('data-index') || 
                                             activeSlide.getAttribute('data-slide-index');
                            if (slideIndex && !isNaN(parseInt(slideIndex))) {
                                return parseInt(slideIndex);
                            }
                        }
                    }
                }
                
                return \(self.currentDisplayIndex); // Fallback to current stored index
            } catch (e) {
                return \(self.currentDisplayIndex);
            }
        })();
        """
        
        self.bridge?.webView?.evaluateJavaScript(jsCode) { result, error in
            if let newIndex = result as? Int, 
               newIndex != self.currentDisplayIndex && 
               newIndex >= 0 && 
               newIndex < self.currentPhotos.count {
                self.currentDisplayIndex = newIndex
                NSLog("📱 Swipe detected: Updated current photo index to \(newIndex)")
            }
        }
    }
    
    private func updateUsernameLabel(presentedVC: UIViewController) {
        // Find the username label by tag
        if let usernameLabel = presentedVC.view.viewWithTag(9999) as? UILabel {
            let newText = self.getCurrentUserText()
            if usernameLabel.text != newText {
                usernameLabel.text = newText
                NSLog("📝 Updated username label to: \(newText)")
            }
        }
        
        // Update report button visibility based on photo ownership
        self.updateReportButtonVisibility(presentedVC: presentedVC)
    }
    
    private func updateReportButtonVisibility(presentedVC: UIViewController) {
        // Find the report button by tag
        if let reportButton = presentedVC.view.viewWithTag(8888) as? UIButton {
            let isOwnPhoto = self.isCurrentPhotoOwnedByUser()
            reportButton.isHidden = isOwnPhoto
            NSLog("📝 Report button visibility: \(isOwnPhoto ? "hidden" : "visible") (isOwn: \(isOwnPhoto))")
        }
    }
    
    private func isCurrentPhotoOwnedByUser() -> Bool {
        guard currentDisplayIndex >= 0 && currentDisplayIndex < currentPhotos.count else {
            return false
        }
        
        let currentPhoto = currentPhotos[currentDisplayIndex]
        let isOwn = currentPhoto["isOwn"] ?? "false"
        return isOwn.lowercased() == "true"
    }
    
    private func getCurrentPhotoIndex() -> Int {
        // Since PhotoViewer doesn't expose the current index,
        // we'll use JavaScript to query the current state
        // For now, we'll use the stored index which will be updated via JavaScript
        return self.currentDisplayIndex
    }
    
    private func getCurrentUserText() -> String {
        guard self.currentDisplayIndex >= 0 && self.currentDisplayIndex < self.currentPhotos.count else {
            return "Photo by Unknown"
        }
        
        let currentPhoto = self.currentPhotos[self.currentDisplayIndex]
        let userName = currentPhoto["uploadedBy"] ?? "Unknown"
        return "Photo by \(userName)"
    }
    
    @objc private func downloadButtonTapped() {
        NSLog("📥 Download button tapped")
        
        // Use improved JavaScript to get the current PhotoViewer index
        let jsCode = """
        (function() {
            try {
                console.log('🔍 Attempting to get PhotoViewer current index...');
                
                // Strategy 1: Check PhotoViewer native implementation methods
                if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PhotoViewer) {
                    const viewer = window.Capacitor.Plugins.PhotoViewer;
                    if (viewer.getCurrentIndex && typeof viewer.getCurrentIndex === 'function') {
                        const index = viewer.getCurrentIndex();
                        console.log('📍 PhotoViewer getCurrentIndex returned:', index);
                        if (typeof index === 'number' && index >= 0) {
                            return index;
                        }
                    }
                }
                
                // Strategy 2: Check for PhotoViewer DOM elements
                const containers = [
                    '.photoviewer-container',
                    '.swiper-container', 
                    '.photoviewer-modal',
                    '[data-photoviewer]'
                ];
                
                for (const selector of containers) {
                    const container = document.querySelector(selector);
                    if (container) {
                        console.log('📍 Found PhotoViewer container:', selector);
                        
                        // Check various index attributes
                        const indexSources = [
                            container.getAttribute('data-current-index'),
                            container.getAttribute('data-index'),
                            container.getAttribute('data-slide-index')
                        ];
                        
                        for (const indexStr of indexSources) {
                            if (indexStr && !isNaN(parseInt(indexStr))) {
                                const index = parseInt(indexStr);
                                console.log('📍 Found index from container attribute:', index);
                                return index;
                            }
                        }
                        
                        // Check for active slide
                        const activeSlide = container.querySelector('.swiper-slide-active, .active, [data-active="true"]');
                        if (activeSlide) {
                            const slideIndex = activeSlide.getAttribute('data-index') || 
                                             activeSlide.getAttribute('data-slide-index');
                            if (slideIndex && !isNaN(parseInt(slideIndex))) {
                                const index = parseInt(slideIndex);
                                console.log('📍 Found index from active slide:', index);
                                return index;
                            }
                        }
                    }
                }
                
                // Strategy 3: Look for image elements with src matching our photo URLs
                const images = document.querySelectorAll('img[src*="supabase"], img[src*="photoshare"]');
                if (images.length > 0) {
                    console.log('📍 Found', images.length, 'PhotoShare images, analyzing...');
                    // Try to match visible image with our photo list
                    for (let i = 0; i < images.length; i++) {
                        const img = images[i];
                        if (img.offsetWidth > 0 && img.offsetHeight > 0) {
                            // This image is visible, try to match it with our photos
                            const imgSrc = img.src;
                            console.log('📍 Visible image src:', imgSrc);
                            // Return the middle index as a reasonable guess if we have multiple images
                            return Math.floor(images.length / 2);
                        }
                    }
                }
                
                console.log('⚠️ All PhotoViewer index detection strategies failed, using fallback');
                return \(self.currentDisplayIndex);
                
            } catch (e) {
                console.error('❌ Error getting PhotoViewer index:', e);
                return \(self.currentDisplayIndex);
            }
        })();
        """
        
        self.bridge?.webView?.evaluateJavaScript(jsCode) { result, error in
            DispatchQueue.main.async {
                let detectedIndex = (result as? Int) ?? self.currentDisplayIndex
                
                // Additional safety check: ensure we have a reasonable index
                let finalIndex = max(0, min(detectedIndex, self.currentPhotos.count - 1))
                
                NSLog("📥 Detected index: \(detectedIndex), Using final index: \(finalIndex) (total photos: \(self.currentPhotos.count))")
                
                // Update our stored display index to the detected one
                self.currentDisplayIndex = finalIndex
                
                // Get current photo based on final index
                guard finalIndex >= 0 && finalIndex < self.currentPhotos.count else {
                    NSLog("❌ Invalid photo index: \(finalIndex)")
                    self.showToast(message: "❌ Error: Invalid photo index")
                    return
                }
                
                let photo = self.currentPhotos[finalIndex]
                let fullUrl = photo["fullUrl"] ?? ""
                let photoId = photo["id"] ?? "unknown"
                
                NSLog("📥 Downloading photo ID \(photoId) at index \(finalIndex): \(fullUrl)")
                
                // Create a temporary CAPPluginCall for the download method
                let call = CAPPluginCall(callbackId: "download-\(UUID().uuidString)", 
                                         options: ["url": fullUrl],
                                         success: { _, _ in
                                             DispatchQueue.main.async {
                                                 NSLog("✅ Download completed successfully for photo \(photoId)")
                                                 self.showToast(message: "✅ Photo saved to gallery!")
                                             }
                                         },
                                         error: { _ in
                                             DispatchQueue.main.async {
                                                 NSLog("❌ Download failed for photo \(photoId)")
                                                 self.showToast(message: "❌ Download failed")
                                             }
                                         })
                
                if let pluginCall = call {
                    self.downloadImageFromUrl(url: fullUrl, call: pluginCall)
                }
            }
        }
    }
    
    @objc private func reportButtonTapped() {
        NSLog("⚠️ Report button tapped")
        
        // Get current photo based on display index
        guard currentDisplayIndex >= 0 && currentDisplayIndex < currentPhotos.count else {
            NSLog("❌ Invalid photo index")
            self.showToast(message: "❌ Error: Invalid photo")
            return
        }
        
        let photo = currentPhotos[currentDisplayIndex]
        let photoId = photo["id"] ?? ""
        
        NSLog("⚠️ Reporting photo: \(photoId)")
        
        // Send callback to web app
        self.notifyListeners("photoReported", data: ["photoId": photoId])
        
        // Show confirmation toast
        self.showToast(message: "⚠️ Photo reported")
    }
    
    private func showToast(message: String) {
        guard let topViewController = self.bridge?.viewController else { return }
        
        // Find the presented view controller (PhotoViewer)
        var presentedVC = topViewController
        while let presented = presentedVC.presentedViewController {
            presentedVC = presented
        }
        
        // Create toast label
        let toastLabel = UILabel()
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        toastLabel.textColor = UIColor.white
        toastLabel.textAlignment = .center
        toastLabel.font = UIFont(name: "Outfit-Regular", size: 16) ?? UIFont.systemFont(ofSize: 16)
        toastLabel.text = message
        toastLabel.alpha = 1.0
        toastLabel.layer.cornerRadius = 20
        toastLabel.clipsToBounds = true
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        
        presentedVC.view.addSubview(toastLabel)
        
        // Position toast in center
        NSLayoutConstraint.activate([
            toastLabel.centerXAnchor.constraint(equalTo: presentedVC.view.centerXAnchor),
            toastLabel.centerYAnchor.constraint(equalTo: presentedVC.view.centerYAnchor, constant: 100),
            toastLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 300),
            toastLabel.heightAnchor.constraint(equalToConstant: 40)
        ])
        
        // Animate toast
        UIView.animate(withDuration: 2.0, delay: 1.0, options: .curveEaseOut, animations: {
            toastLabel.alpha = 0.0
        }, completion: { _ in
            toastLabel.removeFromSuperview()
        })
    }
    
    private func downloadImageFromUrl(url: String, call: CAPPluginCall) {
        guard let imageUrl = URL(string: url) else {
            call.reject("Invalid URL")
            return
        }
        
        NSLog("🖼️ Downloading image from: \(url)")
        
        // Download image data
        URLSession.shared.dataTask(with: imageUrl) { data, response, error in
            if let error = error {
                DispatchQueue.main.async {
                    call.reject("Download failed: \(error.localizedDescription)")
                }
                return
            }
            
            guard let imageData = data, let image = UIImage(data: imageData) else {
                DispatchQueue.main.async {
                    call.reject("Failed to create image from downloaded data")
                }
                return
            }
            
            // Save to photo library
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        NSLog("🖼️ Image saved to photo library successfully")
                        call.resolve(["success": true, "message": "Photo saved to gallery"])
                    } else {
                        let errorMessage = error?.localizedDescription ?? "Unknown error"
                        NSLog("🖼️ Failed to save image: \(errorMessage)")
                        call.reject("Failed to save photo: \(errorMessage)")
                    }
                }
            }
        }.resume()
    }
    
    private func presentShareSheet(url: String, call: CAPPluginCall) {
        guard let imageUrl = URL(string: url) else {
            call.reject("Invalid URL")
            return
        }
        
        NSLog("🖼️ Preparing to share image: \(url)")
        
        // Download image for sharing
        URLSession.shared.dataTask(with: imageUrl) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("Failed to load image for sharing: \(error.localizedDescription)")
                    return
                }
                
                guard let imageData = data, let image = UIImage(data: imageData) else {
                    call.reject("Failed to create image from data")
                    return
                }
                
                // Create activity view controller
                let activityItems: [Any] = [image, imageUrl]
                let activityViewController = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
                
                // Configure for iPad
                if let popover = activityViewController.popoverPresentationController {
                    popover.sourceView = self.bridge?.viewController?.view
                    popover.sourceRect = CGRect(x: self.bridge?.viewController?.view.bounds.midX ?? 0,
                                              y: self.bridge?.viewController?.view.bounds.midY ?? 0,
                                              width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }
                
                // Present the share sheet
                self.bridge?.viewController?.present(activityViewController, animated: true) {
                    call.resolve(["success": true])
                }
            }
        }.resume()
    }
}