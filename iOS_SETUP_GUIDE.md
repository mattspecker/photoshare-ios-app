# iOS Configuration Guide

## Required Manual Steps in Xcode

### 1. Configure Info.plist Permissions

Open `ios/App/App/Info.plist` and add these entries:

```xml
<!-- Camera and Photo Library Permissions -->
<key>NSCameraUsageDescription</key>
<string>PhotoShare needs camera access to take and upload photos.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>PhotoShare needs photo library access to select and share photos.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>PhotoShare needs permission to save photos to your photo library.</string>

<!-- Google OAuth URL Scheme -->
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.googleusercontent.apps.YOUR_GOOGLE_CLIENT_ID</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_REVERSED_CLIENT_ID</string>
        </array>
    </dict>
    <!-- Custom URL scheme for deep links -->
    <dict>
        <key>CFBundleURLName</key>
        <string>app.photoshare</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>photoshare</string>
        </array>
    </dict>
</array>

<!-- Network Security (for loading external website) -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>photo-share.app</key>
        <dict>
            <key>NSExceptionRequiresForwardSecrecy</key>
            <false/>
            <key>NSExceptionMinimumTLSVersion</key>
            <string>TLSv1.0</string>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>
```

### 2. Configure Apple Sign-In Entitlements

In Xcode:
1. Select your app target
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add "Sign In with Apple"

Or manually add to `ios/App/App/App.entitlements`:
```xml
<key>com.apple.developer.applesignin</key>
<array>
    <string>Default</string>
</array>
```

### 3. Set Bundle ID and Team
- Bundle ID: `app.photoshare` (already configured)
- Select your Apple Developer Team
- Ensure "Automatically manage signing" is enabled

### 4. Deployment Target
- Set iOS Deployment Target to 13.0 or later

## Important Notes for OAuth Configuration

### Google OAuth Setup
1. In [Google Cloud Console](https://console.cloud.google.com):
   - Add `app.photoshare` as iOS bundle ID
   - Download updated `GoogleService-Info.plist`
   - Replace the file in `ios/App/App/`

2. Update Info.plist with your actual:
   - `YOUR_GOOGLE_CLIENT_ID` (from GoogleService-Info.plist)
   - `YOUR_REVERSED_CLIENT_ID` (reverse DNS of client ID)

### Apple OAuth Setup
- No additional configuration needed beyond entitlements
- Works automatically with your Apple Developer account

## URL Schemes for Deep Links

Your website should handle these custom URL schemes for OAuth callbacks:
- `photoshare://oauth/google/callback`
- `photoshare://oauth/apple/callback`

## Testing Network Connectivity

Since the app loads `https://photo-share.app`, ensure:
1. Valid SSL certificate on your website
2. Website properly loads in mobile Safari
3. All Capacitor plugins are properly initialized on your website

## FCM Token & Push Notifications Setup

### Firebase Configuration Requirements

1. **Firebase Messaging Import**: Ensure `import FirebaseMessaging` is added to AppDelegate.swift
2. **APNS Token Handling**: AppDelegate includes remote notification delegate methods
3. **FCM Token Plugin**: Handles authentication retry logic and Supabase integration

### FCM Token Registration Flow

The iOS FCMTokenPlugin is streamlined for web integration:

- **Token Generation**: iOS generates FCM token when permissions granted
- **Dual Storage**: Stores in both UserDefaults (iOS) and localStorage (web access)
- **Web Authentication**: Web handles authentication retry via `onAuthStateChange` listener
- **Automatic Retry**: Web detects tokens in localStorage and registers when user authenticates

### JavaScript API Usage

```javascript
// Get FCM token
const result = await FCMTokenPlugin.getFCMToken();
console.log('FCM Token:', result.token);

// Register with authentication retry (automatic on app launch)
const registration = await FCMTokenPlugin.registerFCMTokenWithAuth();

// Initialize FCM (alias for registerFCMTokenWithAuth)
await FCMTokenPlugin.initializeFCM();

// Get stored token
const stored = await FCMTokenPlugin.getStoredToken();
```

## Critical Post-Sync Configuration

⚠️ **IMPORTANT**: After running `npx cap sync ios`, you **MUST** manually restore custom plugins in Xcode because Capacitor sync removes them from `ios/App/App/capacitor.config.json`.

### Manual Steps Required After Each Sync:

1. **Open `ios/App/App/capacitor.config.json` in Xcode**

2. **Add custom plugins to `packageClassList` array:**

```json
"packageClassList": [
  "SignInWithApple",
  "DatePickerPlugin", 
  "PhotoViewerPlugin",
  "FirebaseAppPlugin",
  "FirebaseAuthenticationPlugin",
  "FirebaseMessagingPlugin",
  "AppPlugin",
  "CAPCameraPlugin",
  "DevicePlugin",
  "DialogPlugin",
  "FileTransferPlugin",
  "FilesystemPlugin",
  "HapticsPlugin",
  "KeyboardPlugin",
  "PreferencesPlugin",
  "PushNotificationsPlugin",
  "StatusBarPlugin",
  "EventPhotoPicker",
  "UploadManager",
  "PhotoLibraryMonitor",
  "QRScanner",
  "AppPermissions",
  "FCMTokenPlugin",
  "PhotoEditorPlugin",
  "AutoUploadPlugin",
  "UploadStatusOverlay",
  "CustomCameraPlugin",
  "NativeGalleryPlugin",
  "BulkDownloadPlugin"
]
```

3. **Save the file in Xcode before building**

### Custom Plugins Documentation:

- **AppPermissions**: Cross-platform permission management (replaces AppPermissionPlugin)
- **FCMTokenPlugin**: Firebase Cloud Messaging token registration with authentication retry logic
- **BulkDownloadPlugin**: Multi-photo download with progress tracking and native gallery storage
- **EventPhotoPicker**: Event-aware photo selection with date filtering
- **NativeGalleryPlugin**: Enhanced gallery with download/share capabilities
- **AutoUploadPlugin**: Background photo upload monitoring
- See individual plugin `.md` files for detailed implementation guides

## Quick Commands

```bash
# Sync any config changes
npm run ios:sync

# Open in Xcode  
npm run ios:open

# Run on device/simulator
npm run ios:run
```

**Remember**: Always restore `packageClassList` after sync before building!

## Testing Commands

### FCM Token Testing
```javascript
// Test FCM plugin availability
console.log('FCM Plugin:', window.Capacitor?.Plugins?.FCMTokenPlugin);

// Get current FCM token
await FCMTokenPlugin.getFCMToken();

// Test authentication retry registration
await FCMTokenPlugin.initializeFCM();

// Check stored token
await FCMTokenPlugin.getStoredToken();
```

### Permission Testing
```javascript
// Test AppPermissions plugin
const AppPermissions = window.Capacitor?.Plugins?.AppPermissions;

// Check all permissions
await AppPermissions.checkNotificationPermission();
await AppPermissions.checkCameraPermission();
await AppPermissions.checkPhotoPermission();

// Test onboarding state
await AppPermissions.isFirstLaunch();
await AppPermissions.hasCompletedOnboarding();
```

