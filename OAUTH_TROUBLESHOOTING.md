# OAuth Troubleshooting Guide

## Google SSO Debugging

### 1. Common Google OAuth Errors and Solutions

**Error: "No such app (App with bundle identifier 'app.photoshare' was not found)"**
- **Solution**: Add iOS app to Google Cloud Console with bundle ID `app.photoshare`

**Error: "Invalid client ID"**  
- **Solution**: Verify GoogleService-Info.plist is in Xcode project
- Check client ID matches: `1064591086523-ru8pn28k9hkqv0uo6nr9njig1t378pjs`

**Error: "URL scheme not registered"**
- **Solution**: Verify Info.plist has correct URL scheme
- Should be: `com.googleusercontent.apps.1064591086523-ru8pn28k9hkqv0uo6nr9njig1t378pjs`

**Error: "Plugin not available"**
- **Solution**: Check if your website properly initializes GoogleAuth plugin

### 2. Google OAuth Setup Checklist

- [ ] GoogleService-Info.plist added to Xcode project (drag into App folder)
- [ ] Bundle ID in Google Console matches: `app.photoshare`
- [ ] URL scheme in Info.plist matches reversed client ID
- [ ] Testing on physical device (recommended)
- [ ] Capacitor GoogleAuth plugin properly configured on website

### 3. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to: APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID
4. Ensure there's an **iOS** application entry with:
   - Bundle ID: `app.photoshare`
   - App Store ID: (leave blank for development)

## Apple SSO Debugging  

### 1. Common Apple Sign-In Errors and Solutions

**Error: "Apple Sign-In not available"**
- **Solution**: Test on iOS 13+ physical device (simulator limitations)
- Enable "Sign In with Apple" capability in Xcode

**Error: "Not supported on simulator"**
- **Solution**: Apple Sign-In requires physical device for testing

**Error: "Capability not found"**
- **Solution**: Add "Sign In with Apple" in Xcode → Signing & Capabilities

### 2. Apple Sign-In Setup Checklist

- [ ] Testing on iOS 13+ physical device (required)
- [ ] "Sign In with Apple" capability enabled in Xcode
- [ ] Apple Developer account properly configured
- [ ] App ID has Sign In with Apple capability enabled

### 3. Xcode Configuration for Apple Sign-In

1. Select your app target
2. Go to "Signing & Capabilities" tab
3. Click "+ Capability"
4. Add "Sign In with Apple"
5. Should automatically add to entitlements

## Website Integration Debugging

### 1. Check Your Website Code

Your website should detect native platform and use appropriate plugins:

```javascript
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { SignInWithApple } from '@capacitor-community/apple-sign-in';

// For Google
if (Capacitor.isNativePlatform()) {
  // Initialize Google Auth for native
  await GoogleAuth.initialize();
  const result = await GoogleAuth.signIn();
} else {
  // Web-based Google OAuth
}

// For Apple
if (Capacitor.getPlatform() === 'ios') {
  const available = await SignInWithApple.isAvailable();
  if (available.value) {
    const result = await SignInWithApple.authorize({
      requestedScopes: ['email', 'fullName']
    });
  }
}
```

### 2. Common Website Integration Issues

**Plugin Not Found**
- Website not detecting Capacitor native environment
- Check if plugins are properly imported on website

**Initialization Errors**
- GoogleAuth.initialize() not called on native platform
- Check browser console for JavaScript errors

## Debugging Commands

### 1. Check Plugin Installation
```bash
npx cap ls
```

### 2. View Detailed Logs
In Xcode:
- Open Console tab
- Filter by "GoogleAuth" or "AppleAuth"
- Look for plugin initialization errors

### 3. Test Website in Browser First
1. Open https://photo-share.app in Safari
2. Try OAuth flows in web browser
3. Ensure they work before testing in app

## Step-by-Step Debug Process

### For Google OAuth:
1. **Verify GoogleService-Info.plist**: Must be in Xcode project
2. **Check URL Schemes**: Info.plist should have exact reversed client ID
3. **Test Initialization**: Check if GoogleAuth.initialize() is called
4. **Console Logs**: Look for "GoogleAuth" errors in Xcode
5. **Test on Device**: Simulator has limitations

### For Apple Sign-In:
1. **Physical Device**: Must test on iOS 13+ device
2. **Capability Enabled**: Check Xcode Signing & Capabilities
3. **Apple Developer**: Ensure App ID has Sign In with Apple enabled
4. **Plugin Available**: Check if SignInWithApple.isAvailable() returns true

## Quick Fixes to Try

1. **Clean and Rebuild**:
```bash
npx cap sync ios
```

2. **Check Plugin Status**:
```bash
npx cap doctor ios
```

3. **Restart Xcode**: Sometimes capabilities need Xcode restart

4. **Test Simple Case**: Try basic plugin calls first before complex flows

## Getting More Details

To help debug further, please provide:
1. **Exact error messages** from Xcode console
2. **Testing device** (simulator vs physical device, iOS version)
3. **When the error occurs** (initialization, button press, after auth dialog)
4. **Browser console errors** when testing website directly

This will help identify the specific issue with your OAuth flows.