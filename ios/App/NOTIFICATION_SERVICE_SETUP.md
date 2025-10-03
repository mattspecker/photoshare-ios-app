# Notification Service Extension Setup Instructions

## Manual Xcode Configuration Required

The Notification Service Extension files have been created, but you need to manually add the target in Xcode.

## Files Created

✅ **Already Created:**
- `NotificationService/NotificationService.swift` - Main extension implementation
- `NotificationService/Info.plist` - Extension configuration
- Updated `AppDelegate.swift` - Added UNUserNotificationCenterDelegate

## Xcode Setup Steps

### Step 1: Add Notification Service Extension Target

1. **Open Xcode**: Open `App.xcodeproj` in Xcode
2. **Add Target**: 
   - File → New → Target
   - Select **iOS** → **Notification Service Extension**
   - Click **Next**

3. **Configure Target**:
   - **Product Name**: `NotificationService`
   - **Language**: Swift
   - **Bundle Identifier**: `com.photoshare.photo-share.NotificationService`
   - **Project**: App
   - **Embed in Application**: App
   - Click **Finish**

4. **Activate Scheme**: When prompted, click **Activate** to activate the NotificationService scheme

### Step 2: Replace Generated Files

Xcode will create template files. Replace them with our implementation:

1. **Delete Generated Files**:
   - Delete the auto-generated `NotificationService.swift`
   - Delete the auto-generated `Info.plist`

2. **Add Our Files**:
   - Drag `NotificationService/NotificationService.swift` into the NotificationService group
   - Drag `NotificationService/Info.plist` into the NotificationService group
   - Make sure **Target Membership** is set to `NotificationService` (not App)

### Step 3: Configure Target Settings

1. **Select NotificationService Target** in project navigator
2. **Build Settings**:
   - **iOS Deployment Target**: 14.0 (match main app)
   - **Swift Language Version**: Swift 5
   - **Bundle Identifier**: `com.photoshare.photo-share.NotificationService`

3. **Signing & Capabilities**:
   - **Team**: (Your development team)
   - **Bundle Identifier**: `com.photoshare.photo-share.NotificationService`
   - **Signing Certificate**: iPhone Developer / Apple Development

### Step 4: Verify File Structure

Your project should now have:

```
App/
├── App/
│   ├── AppDelegate.swift (✅ Updated)
│   └── ... (other app files)
├── NotificationService/
│   ├── NotificationService.swift (✅ Our implementation)
│   └── Info.plist (✅ Our configuration)
└── App.xcodeproj
```

### Step 5: Build and Test

1. **Select App Scheme** in Xcode
2. **Build Project** (Cmd+B)
3. **Check for Errors**: Both App and NotificationService should compile successfully

## Verification

### Build Success Indicators:
- ✅ No compilation errors
- ✅ Both App and NotificationService targets build
- ✅ NotificationService.appex is created in build products

### Runtime Testing:
1. **Install App** on device/simulator
2. **Send Test Notification** with image (see testing section below)
3. **Check Console Logs** for NotificationService debug output

## Testing Rich Notifications

### Test Payload (REST API)

Use this payload to test rich notifications:

```json
{
  "message": {
    "token": "YOUR_DEVICE_TOKEN",
    "notification": {
      "title": "PhotoShare Test",
      "body": "Testing rich notification with image"
    },
    "apns": {
      "payload": {
        "aps": {
          "mutable-content": 1,
          "alert": {
            "title": "PhotoShare Test",
            "body": "Testing rich notification with image"
          },
          "badge": 1,
          "sound": "default"
        }
      },
      "fcm_options": {
        "image": "https://picsum.photos/300/200"
      }
    },
    "data": {
      "event_id": "test123",
      "action": "test_rich_notification"
    }
  }
}
```

### Expected Console Output

When rich notification works correctly, you should see:

```
🔔 NotificationService: Processing notification: PhotoShare Test
📸 Found image in fcm_options: https://picsum.photos/300/200
🔄 NotificationService: Starting download from https://picsum.photos/300/200
📡 NotificationService: HTTP Status: 200
📄 NotificationService: MIME type: image/jpeg
📁 NotificationService: Moved to permanent location: /tmp/ABC123.jpg
✅ NotificationService: Successfully attached image: ABC123.jpg
🏁 NotificationService: Completed processing, calling contentHandler
```

### Debug Console Commands

To view extension logs on device:

```bash
# View all logs
xcrun devicectl device log stream --device YOUR_DEVICE_ID

# Filter for NotificationService
xcrun devicectl device log stream --device YOUR_DEVICE_ID | grep "NotificationService"

# Filter for rich notification related logs
xcrun devicectl device log stream --device YOUR_DEVICE_ID | grep -E "(NotificationService|🔔|📸|🖼️)"
```

## Troubleshooting

### Common Issues:

**1. Extension not being called:**
- ✅ Verify `mutable-content: 1` in FCM payload
- ✅ App must be in background/terminated (not foreground)
- ✅ Notification must be configured to show alert

**2. Image not downloading:**
- ✅ Check internet connectivity
- ✅ Verify image URL is HTTPS (not HTTP)
- ✅ Test image URL in browser
- ✅ Check console for download errors

**3. Build errors:**
- ✅ Make sure NotificationService target has correct Bundle ID
- ✅ Verify file target membership
- ✅ Check iOS deployment target matches

**4. Signing issues:**
- ✅ Extension needs same team/signing as main app
- ✅ Bundle ID must be: `{MAIN_APP_BUNDLE_ID}.NotificationService`

### Success Indicators:

- ✅ Extension shows in project navigator
- ✅ Both targets build without errors
- ✅ Console shows "NotificationService: Processing notification"
- ✅ Rich notifications display images when app is backgrounded

## Next Steps

After successful setup:

1. **Update Server**: Modify FCM payload to include `mutable-content: 1` and image URLs
2. **Test with Real Images**: Use PhotoShare event thumbnails as notification images
3. **Add Analytics**: Track rich notification open rates
4. **Optimize Images**: Generate notification-specific thumbnails (300x200)

## Implementation Status

- ✅ NotificationService.swift created with comprehensive image downloading
- ✅ Info.plist configured with required keys
- ✅ AppDelegate.swift updated with UNUserNotificationCenterDelegate
- ⏳ **MANUAL STEP**: Add NotificationService target in Xcode
- ⏳ **MANUAL STEP**: Update server FCM payload format