import UserNotifications
import Firebase

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        print("🚨 [FIREBASE FCM] ===== NOTIFICATION SERVICE EXTENSION STARTED =====")
        print("🚨 [FIREBASE FCM] Request ID: \(request.identifier)")
        print("🚨 [FIREBASE FCM] Using Firebase's built-in rich notification support")
        
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let bestAttemptContent = bestAttemptContent else {
            print("🚨 [FIREBASE FCM] Failed to get bestAttemptContent")
            contentHandler(request.content)
            return
        }
        
        print("🔔 [FIREBASE FCM] Processing notification: \(bestAttemptContent.title)")
        print("🔔 [FIREBASE FCM] User Info: \(bestAttemptContent.userInfo)")
        print("🔔 [FIREBASE FCM] Attachments before Firebase processing: \(bestAttemptContent.attachments.count)")
        
        // Check for FCM image URL to confirm payload format
        if let fcmOptions = bestAttemptContent.userInfo["fcm_options"] as? [String: Any],
           let imageURLString = fcmOptions["image"] as? String {
            print("✅ [FIREBASE FCM] Found image in fcm_options.image: \(imageURLString)")
        } else {
            print("⚠️ [FIREBASE FCM] No fcm_options.image found - checking other locations")
            
            // Log all possible image locations for debugging
            if let imageUrl = bestAttemptContent.userInfo["image_url"] as? String {
                print("📸 [FIREBASE FCM] Found image_url: \(imageUrl)")
            }
            if let attachmentUrl = bestAttemptContent.userInfo["attachment-url"] as? String {
                print("📸 [FIREBASE FCM] Found attachment-url: \(attachmentUrl)")
            }
        }
        
        // Use Firebase's built-in rich notification support
        print("🔄 [FIREBASE FCM] Calling Firebase populateNotificationContent...")
        Messaging.serviceExtension().populateNotificationContent(bestAttemptContent, withContentHandler: { content in
            print("✅ [FIREBASE FCM] Firebase processing completed")
            print("🔢 [FIREBASE FCM] Final attachments count: \(content.attachments.count)")
            
            // Log attachment details if any were created
            for (index, attachment) in content.attachments.enumerated() {
                print("🖼️ [FIREBASE FCM] Attachment \(index): \(attachment.identifier) - \(attachment.url.lastPathComponent)")
            }
            
            contentHandler(content)
        })
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}