# OAuth Configuration for Native App

## Overview

Since your website (https://photo-share.app) already has Capacitor OAuth implementations, you need to ensure the native app can handle OAuth redirects properly.

## Google OAuth Configuration

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your existing project or create new one
3. Go to "APIs & Services" > "Credentials"
4. Find your existing OAuth 2.0 Client ID or create a new one
5. Add iOS application:
   - Application type: iOS
   - Bundle ID: `app.photoshare`
   - Download the `GoogleService-Info.plist`

### 2. Update Capacitor Configuration
In `capacitor.config.json`, replace `YOUR_GOOGLE_CLIENT_ID` with your actual client ID from the plist file.

### 3. Add GoogleService-Info.plist to iOS Project
1. Open Xcode
2. Drag `GoogleService-Info.plist` to `ios/App/App/` folder
3. Ensure it's added to the target

### 4. Update Info.plist URL Schemes
Replace placeholders in Info.plist:
```xml
<key>CFBundleURLSchemes</key>
<array>
    <string>com.googleusercontent.apps.YOUR_ACTUAL_CLIENT_ID</string>
</array>
```

## Apple Sign-In Configuration

### 1. Apple Developer Console
1. Go to [Apple Developer](https://developer.apple.com)
2. Navigate to your App ID
3. Enable "Sign In with Apple" capability
4. Configure domains and redirect URLs if needed

### 2. Xcode Configuration
1. In project capabilities, add "Sign In with Apple"
2. This automatically adds the entitlement

## URL Scheme Handling

### Website Integration
Your website should be configured to handle these scenarios:

#### For Google OAuth:
```javascript
// On your website, detect if running in Capacitor
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Use native Google Auth plugin
  import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
  
  const result = await GoogleAuth.signIn();
} else {
  // Use web-based OAuth flow
  // Your existing web implementation
}
```

#### For Apple OAuth:
```javascript
import { SignInWithApple } from '@capacitor-community/apple-sign-in';

if (Capacitor.getPlatform() === 'ios') {
  const result = await SignInWithApple.authorize({
    requestedScopes: ['email', 'fullName']
  });
}
```

## Deep Link Handling

### Custom URL Schemes
The app will handle these URLs:
- `photoshare://oauth/callback` - General OAuth callback
- `com.googleusercontent.apps.YOUR_CLIENT_ID://` - Google OAuth

### Website Redirect Configuration
If your website needs to redirect back to the app after OAuth:

```javascript
// Detect if running in native app
if (Capacitor.isNativePlatform()) {
  // Handle OAuth success/failure within the webview
  // No redirect needed - the native plugin handles it
} else {
  // Web-based redirect handling
  window.location.href = '/dashboard';
}
```

## Testing OAuth Flows

### 1. Google Sign-In Test
1. Build and run the app
2. Navigate to sign-in page on your website
3. Tap Google Sign-In button
4. Native Google OAuth dialog should appear
5. After authorization, should return to your website

### 2. Apple Sign-In Test
1. Test on physical iOS device (iOS 13+)
2. Apple Sign-In should show native dialog
3. Face ID/Touch ID authentication if enabled

## Common Issues and Solutions

### Google OAuth Not Working
- Verify `GoogleService-Info.plist` is in project
- Check Bundle ID matches exactly
- Ensure URL scheme is correct in Info.plist

### Apple Sign-In Unavailable
- Test on iOS 13+ device/simulator
- Verify capability is enabled in Xcode
- Check Apple Developer account settings

### Website OAuth Hooks Not Working
- Ensure your website initializes Capacitor plugins properly
- Check browser console for plugin errors
- Verify plugins are installed in native project

## Security Considerations

1. **URL Scheme Security**: Custom URL schemes can be intercepted. Consider implementing additional validation.

2. **Deep Link Validation**: Validate any parameters received from deep links.

3. **Token Storage**: Your website should use Capacitor's secure storage plugins for tokens.

## Integration with Existing Website

Since your website already has OAuth implemented with Capacitor hooks:

1. **No Code Changes Needed**: Your website should work as-is when loaded in the native webview
2. **Plugin Detection**: The website can detect it's running natively and use appropriate OAuth methods
3. **Seamless Experience**: Users will get native OAuth dialogs instead of web-based ones

The key is ensuring all the native plugins are properly installed and configured, which we've done in the setup steps.