# iOS Rich Notifications with Firebase Cloud Messaging (FCM) - Complete Setup Guide

This guide covers implementing rich notifications with image attachments using Firebase Cloud Messaging (FCM) on iOS, including the required Notification Service Extension.

## Overview

Rich notifications with images require:
1. **Notification Service Extension** - iOS extension to download and attach images
2. **Proper FCM payload structure** - Must include `mutable-content: 1` and image URL
3. **Server-side implementation** - Send notifications with correct payload format

## Current Project Status

✅ **Already Configured:**
- Firebase Messaging integration via Capacitor
- Push notification permissions and presentation options
- Basic FCM setup with GoogleService-Info.plist

❌ **Missing for Rich Notifications:**
- Notification Service Extension target
- Image downloading and attachment logic
- Proper FCM payload structure

## Step 1: Create Notification Service Extension

### 1.1 Add Extension Target in Xcode

1. Open `App.xcodeproj` in Xcode
2. **File** → **New** → **Target**
3. Select **iOS** → **Notification Service Extension**
4. Configure the extension:
   - **Product Name**: `NotificationService`
   - **Language**: Swift
   - **Bundle Identifier**: `com.photoshare.photo-share.NotificationService`
   - **Team**: (Your development team)

### 1.2 Extension File Structure
Xcode will create:
```
NotificationService/
├── NotificationService.swift
├── Info.plist
└── NotificationService.entitlements (if needed)
```

### 1.3 Update NotificationService.swift

Replace the generated code with:

```swift
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
        
        // Check for FCM image URL in various payload locations
        var imageURL: String?
        
        // Check fcm_options.image (new format)
        if let fcmOptions = bestAttemptContent.userInfo["fcm_options"] as? [String: Any],
           let imageURLString = fcmOptions["image"] as? String {
            imageURL = imageURLString
        }
        // Check attachment-url (legacy format)
        else if let attachmentURL = bestAttemptContent.userInfo["attachment-url"] as? String {
            imageURL = attachmentURL
        }
        // Check custom field in data payload
        else if let imageURLString = bestAttemptContent.userInfo["image_url"] as? String {
            imageURL = imageURLString
        }
        
        print("🖼️ NotificationService: Processing image URL: \(imageURL ?? "none")")
        
        guard let imageURLString = imageURL,
              let url = URL(string: imageURLString) else {
            print("⚠️ NotificationService: No valid image URL found")
            contentHandler(bestAttemptContent)
            return
        }
        
        // Download and attach image
        downloadImageAndAttach(from: url, to: bestAttemptContent) { [weak self] in
            guard let self = self else { return }
            self.contentHandler?(bestAttemptContent)
        }
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as an opportunity to deliver your "best attempt" at modified content.
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
    
    // MARK: - Image Download and Attachment
    
    private func downloadImageAndAttach(from url: URL, to content: UNMutableNotificationContent, completion: @escaping () -> Void) {
        
        print("🔄 NotificationService: Downloading image from \(url.absoluteString)")
        
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
            guard let httpResponse = response as? HTTPURLResponse,
                  let mimeType = httpResponse.mimeType,
                  mimeType.hasPrefix("image/") else {
                print("❌ NotificationService: Invalid image MIME type")
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
            task.cancel()
            print("⏰ NotificationService: Image download timed out")
            completion()
        }
    }
    
    private func getFileExtension(from mimeType: String, url: URL) -> String {
        // Try to get extension from MIME type
        switch mimeType {
        case "image/jpeg":
            return "jpg"
        case "image/png":
            return "png"
        case "image/gif":
            return "gif"
        case "image/webp":
            return "webp"
        default:
            // Fall back to URL extension if available
            let urlExtension = url.pathExtension.lowercased()
            return urlExtension.isEmpty ? "jpg" : urlExtension
        }
    }
}
```

### 1.4 Update Notification Service Info.plist

Add required keys to `NotificationService/Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
<key>NSExtensionPointIdentifier</key>
<string>com.apple.usernotifications.service</string>
<key>NSExtensionPrincipalClass</key>
<string>$(PRODUCT_MODULE_NAME).NotificationService</string>
```

## Step 2: Firebase Configuration Updates

### 2.1 Update capacitor.config.json

Add rich notification configuration:

```json
{
  "plugins": {
    "FirebaseMessaging": {
      "presentationOptions": [
        "badge",
        "sound", 
        "alert"
      ],
      "androidNotificationChannelId": "fcm_fallback_notification_channel"
    },
    "PushNotifications": {
      "presentationOptions": [
        "badge",
        "sound",
        "alert"
      ]
    }
  }
}
```

### 2.2 Update AppDelegate.swift

Add notification service extension support:

```swift
import UserNotifications

// Add to application:didFinishLaunchingWithOptions
UNUserNotificationCenter.current().delegate = self

// Add UNUserNotificationCenterDelegate extension
extension AppDelegate: UNUserNotificationCenterDelegate {
    
    // Handle notifications when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, 
                              willPresent notification: UNNotification, 
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        
        print("🔔 Received notification in foreground: \(notification.request.content.title)")
        
        // Show notification even when app is in foreground
        completionHandler([.alert, .badge, .sound])
    }
    
    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter, 
                              didReceive response: UNNotificationResponse, 
                              withCompletionHandler completionHandler: @escaping () -> Void) {
        
        print("👆 User tapped notification: \(response.notification.request.content.title)")
        
        // Handle notification tap (navigate to specific screen, etc.)
        let userInfo = response.notification.request.content.userInfo
        
        // Forward to Capacitor/JavaScript if needed
        NotificationCenter.default.post(name: .capacitorDidReceiveNotificationResponse, object: userInfo)
        
        completionHandler()
    }
}

// Add notification name extension
extension Notification.Name {
    static let capacitorDidReceiveNotificationResponse = Notification.Name("capacitorDidReceiveNotificationResponse")
}
```

## Step 3: Server-Side FCM Payload

### 3.1 Required Payload Structure

For rich notifications to work, the FCM payload **MUST** include:

```json
{
  "message": {
    "token": "DEVICE_FCM_TOKEN",
    "notification": {
      "title": "PhotoShare",
      "body": "New photos added to your event!"
    },
    "apns": {
      "payload": {
        "aps": {
          "mutable-content": 1,
          "alert": {
            "title": "PhotoShare", 
            "body": "New photos added to your event!"
          },
          "badge": 1,
          "sound": "default"
        }
      },
      "fcm_options": {
        "image": "https://your-domain.com/path/to/image.jpg"
      }
    },
    "data": {
      "event_id": "12345",
      "action": "new_photos",
      "image_url": "https://your-domain.com/path/to/image.jpg"
    }
  }
}
```

### 3.2 Key Requirements

**Critical Fields:**
- `mutable-content: 1` - Enables service extension
- `fcm_options.image` - Image URL for iOS rich notifications
- Valid image URL with proper file extension
- Image must be accessible via HTTPS

**Image Constraints:**
- **Size limit**: 10MB maximum 
- **Timeout**: ~25-30 seconds download time
- **Format**: JPEG, PNG, GIF supported
- **URL**: Must be publicly accessible HTTPS URL

### 3.3 Example Server Implementation (Node.js)

```javascript
const admin = require('firebase-admin');

async function sendRichNotification(deviceToken, eventId, imageUrl) {
  const message = {
    token: deviceToken,
    notification: {
      title: 'PhotoShare',
      body: 'New photos added to your event!'
    },
    apns: {
      payload: {
        aps: {
          'mutable-content': 1,
          alert: {
            title: 'PhotoShare',
            body: 'New photos added to your event!'
          },
          badge: 1,
          sound: 'default'
        }
      },
      fcm_options: {
        image: imageUrl
      }
    },
    data: {
      event_id: eventId,
      action: 'new_photos',
      image_url: imageUrl
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Rich notification sent:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    throw error;
  }
}
```

## Step 4: Testing Rich Notifications

### 4.1 Test with FCM Console

**⚠️ Important**: The Firebase Console doesn't support `mutable-content`, so you cannot test rich notifications through the web interface.

### 4.2 Test with REST API

Use this curl command to test:

```bash
curl -X POST https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "DEVICE_TOKEN",
      "notification": {
        "title": "PhotoShare Test",
        "body": "Testing rich notification"
      },
      "apns": {
        "payload": {
          "aps": {
            "mutable-content": 1,
            "alert": {
              "title": "PhotoShare Test",
              "body": "Testing rich notification"
            }
          }
        },
        "fcm_options": {
          "image": "https://picsum.photos/300/200"
        }
      }
    }
  }'
```

### 4.3 Debug Extension

Add debugging to NotificationService:

```swift
// Add to didReceive method
print("🐛 NotificationService payload: \(request.content.userInfo)")
print("🐛 NotificationService attachments before: \(bestAttemptContent.attachments.count)")
```

Check device logs:
```bash
# View extension logs
xcrun devicectl device log stream --device YOUR_DEVICE_ID | grep "NotificationService"
```

## Step 5: Integration with PhotoShare

### 5.1 Event-Based Notifications

For PhotoShare app, rich notifications would typically be sent when:

```javascript
// Example: When new photos are uploaded to an event
const eventImageUrl = getEventThumbnailUrl(eventId); // Get representative image
const attendeeTokens = await getEventAttendeeTokens(eventId);

for (const token of attendeeTokens) {
  await sendRichNotification(token, eventId, eventImageUrl);
}
```

### 5.2 Photo Thumbnail URLs

Ensure your backend provides accessible thumbnail URLs:

```javascript
// Generate optimized thumbnail for notifications
const thumbnailUrl = `https://your-cdn.com/thumbnails/${photoId}_300x200.jpg`;

// Send notification with photo thumbnail
await sendRichNotification(deviceToken, eventId, thumbnailUrl);
```

## Step 6: Troubleshooting

### 6.1 Common Issues

**Rich notification not showing image:**
- ✅ Check `mutable-content: 1` is present
- ✅ Verify image URL is accessible
- ✅ Ensure image has proper file extension
- ✅ Check image size < 10MB
- ✅ Verify HTTPS (not HTTP) image URL

**Extension not being called:**
- ✅ Notification must be configured to show alert
- ✅ Must include `mutable-content: 1`
- ✅ App must be in background or terminated state

**Images not downloading:**
- ✅ Check network connectivity
- ✅ Verify URL responds with image MIME type
- ✅ Check for CORS/authentication issues
- ✅ Ensure download completes within 25 seconds

### 6.2 Testing Checklist

- [ ] Notification Service Extension target created and configured
- [ ] FCM payload includes `mutable-content: 1`
- [ ] Image URL is HTTPS and publicly accessible
- [ ] App is in background when testing
- [ ] Device has internet connectivity
- [ ] Extension logs show image download attempt
- [ ] Test with simple image URL (e.g., picsum.photos)

### 6.3 Production Considerations

- **CDN Usage**: Use CDN for faster image delivery
- **Image Optimization**: Generate notification-specific thumbnails (300x200)
- **Fallback**: Always include meaningful text even if image fails
- **Caching**: Consider caching downloaded images temporarily
- **Analytics**: Track rich notification open rates vs standard notifications

## Implementation Priority

1. **Phase 1**: Create Notification Service Extension
2. **Phase 2**: Update server FCM payload format
3. **Phase 3**: Test with sample images
4. **Phase 4**: Integrate with PhotoShare event system
5. **Phase 5**: Optimize images and implement analytics

This setup will enable your iOS app to display rich push notifications with image attachments, significantly improving user engagement with PhotoShare event notifications.