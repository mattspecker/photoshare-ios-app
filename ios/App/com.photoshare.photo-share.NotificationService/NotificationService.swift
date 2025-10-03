import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?
    
    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }
        
        print("🔔 NotificationService: Processing notification: \(bestAttemptContent.title)")
        print("🐛 NotificationService payload: \(request.content.userInfo)")
        print("🐛 NotificationService attachments before: \(bestAttemptContent.attachments.count)")
        
        // Check for FCM image URL in various payload locations
        var imageURL: String?
        
        // Check fcm_options.image (new FCM format)
        if let fcmOptions = bestAttemptContent.userInfo["fcm_options"] as? [String: Any],
           let imageURLString = fcmOptions["image"] as? String {
            imageURL = imageURLString
            print("📸 Found image in fcm_options: \(imageURLString)")
        }
        // Check attachment-url (legacy format)
        else if let attachmentURL = bestAttemptContent.userInfo["attachment-url"] as? String {
            imageURL = attachmentURL
            print("📸 Found image in attachment-url: \(attachmentURL)")
        }
        // Check custom field in data payload
        else if let imageURLString = bestAttemptContent.userInfo["image_url"] as? String {
            imageURL = imageURLString
            print("📸 Found image in image_url: \(imageURLString)")
        }
        // Check Google FCM format
        else if let gcmMessage = bestAttemptContent.userInfo["gcm.message.notification.image"] as? String {
            imageURL = gcmMessage
            print("📸 Found image in gcm.message: \(gcmMessage)")
        }
        
        print("🖼️ NotificationService: Processing image URL: \(imageURL ?? "none")")
        
        guard let imageURLString = imageURL,
              let url = URL(string: imageURLString) else {
            print("⚠️ NotificationService: No valid image URL found, showing standard notification")
            contentHandler(bestAttemptContent)
            return
        }
        
        // Download and attach image
        downloadImageAndAttach(from: url, to: bestAttemptContent) { [weak self] in
            guard let self = self else { return }
            print("🏁 NotificationService: Completed processing, calling contentHandler")
            self.contentHandler?(bestAttemptContent)
        }
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content.
        print("⏰ NotificationService: Extension time will expire")
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
    
    // MARK: - Image Download and Attachment
    
    private func downloadImageAndAttach(from url: URL, to content: UNMutableNotificationContent, completion: @escaping () -> Void) {
        
        print("🔄 NotificationService: Starting download from \(url.absoluteString)")
        
        let task = URLSession.shared.downloadTask(with: url) { tempLocalUrl, response, error in
            
            if let error = error {
                print("❌ NotificationService: Error downloading image: \(error.localizedDescription)")
                completion()
                return
            }
            
            guard let tempLocalUrl = tempLocalUrl else {
                print("❌ NotificationService: No temporary file URL")
                completion()
                return
            }
            
            // Verify it's an image and get file extension
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ NotificationService: Invalid HTTP response")
                completion()
                return
            }
            
            print("📡 NotificationService: HTTP Status: \(httpResponse.statusCode)")
            
            guard httpResponse.statusCode == 200 else {
                print("❌ NotificationService: HTTP error: \(httpResponse.statusCode)")
                completion()
                return
            }
            
            let mimeType = httpResponse.mimeType ?? "image/jpeg"
            print("📄 NotificationService: MIME type: \(mimeType)")
            
            // Verify it's an image
            guard mimeType.hasPrefix("image/") else {
                print("❌ NotificationService: Invalid image MIME type: \(mimeType)")
                completion()
                return
            }
            
            // Determine file extension from MIME type or URL
            let fileExtension = self.getFileExtension(from: mimeType, url: url)
            
            // Create permanent file URL in temp directory
            let identifier = UUID().uuidString
            let permanentURL = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent(identifier)
                .appendingPathExtension(fileExtension)
            
            do {
                // Move file to permanent location
                try FileManager.default.moveItem(at: tempLocalUrl, to: permanentURL)
                
                print("📁 NotificationService: Moved to permanent location: \(permanentURL.path)")
                
                // Verify file exists and get size
                let fileSize = try FileManager.default.attributesOfItem(atPath: permanentURL.path)[.size] as? Int ?? 0
                print("📊 NotificationService: File size: \(fileSize) bytes")
                
                // Create notification attachment
                let attachment = try UNNotificationAttachment(identifier: identifier, 
                                                            url: permanentURL, 
                                                            options: [
                                                                UNNotificationAttachmentOptionsTypeHintKey: mimeType
                                                            ])
                
                // Add attachment to content
                content.attachments = [attachment]
                
                print("✅ NotificationService: Successfully attached image: \(permanentURL.lastPathComponent)")
                
            } catch {
                print("❌ NotificationService: Error creating attachment: \(error.localizedDescription)")
            }
            
            completion()
        }
        
        // Set timeout and start download
        task.resume()
        
        // Fallback timeout (iOS gives us ~30 seconds total)
        DispatchQueue.global().asyncAfter(deadline: .now() + 25) {
            if task.state == .running {
                task.cancel()
                print("⏰ NotificationService: Image download timed out after 25 seconds")
                completion()
            }
        }
    }
    
    private func getFileExtension(from mimeType: String, url: URL) -> String {
        // Try to get extension from MIME type first
        switch mimeType.lowercased() {
        case "image/jpeg", "image/jpg":
            return "jpg"
        case "image/png":
            return "png"
        case "image/gif":
            return "gif"
        case "image/webp":
            return "webp"
        case "image/bmp":
            return "bmp"
        case "image/tiff":
            return "tiff"
        default:
            // Fall back to URL extension if available
            let urlExtension = url.pathExtension.lowercased()
            if !urlExtension.isEmpty && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff"].contains(urlExtension) {
                return urlExtension
            }
            // Default to jpg
            return "jpg"
        }
    }
}