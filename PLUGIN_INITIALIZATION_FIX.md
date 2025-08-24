# Fix UNIMPLEMENTED Error - Plugin Initialization

## Root Cause
The `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` plugin requires manual initialization and the `GoogleService-Info.plist` file must be properly added to the iOS project.

## Critical Steps to Fix UNIMPLEMENTED Error

### 1. Ensure GoogleService-Info.plist is Properly Added
**In Xcode:**
1. Open your iOS project workspace
2. **Drag and drop** `GoogleService-Info.plist` into the `App` folder in Xcode
3. **IMPORTANT**: Check these boxes:
   - ✅ "Add to target" → App
   - ✅ "Copy items if needed"
4. Verify the file appears in the project navigator under App

### 2. Manual Plugin Initialization Required
**The plugin documentation states that for iOS, you need to call `GoogleAuth.initialize()` from your website code BEFORE using the plugin.**

Your website code should look like this:

```javascript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

// Initialize the plugin when app starts (CRITICAL)
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize();
}

// Then use the plugin
async function signInWithGoogle() {
  try {
    if (Capacitor.isNativePlatform()) {
      // Make sure it's initialized first
      await GoogleAuth.initialize();
    }
    
    const result = await GoogleAuth.signIn();
    return result;
  } catch (error) {
    console.error('Google sign-in error:', error);
  }
}
```

### 3. Apple Sign-In Requirements
For Apple Sign-In to work:

**In Xcode:**
1. Select your App target
2. Go to "Signing & Capabilities" tab
3. Click "+ Capability"
4. Add "Sign In with Apple"

**Testing:**
- ✅ Must test on **physical iOS device** (iOS 13+)
- ❌ Will NOT work on simulator

### 4. Verify Plugin Registration
Run this command to confirm plugins are installed:
```bash
npx cap ls
```

Should show:
- `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4`
- `@capacitor-community/apple-sign-in@7.0.1`

## Website Integration
Your website at `https://photo-share.app` needs to properly initialize these plugins. The key is:

1. **Detect native platform**
2. **Initialize plugins before use**
3. **Handle errors gracefully**

Example initialization in your website:
```javascript
// On app startup
document.addEventListener('DOMContentLoaded', async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Initialize Google Auth
      await GoogleAuth.initialize();
      console.log('✅ Google Auth initialized');
    } catch (error) {
      console.error('❌ Google Auth initialization failed:', error);
    }
  }
});
```

## Testing Steps
1. **Build and run on physical iOS device**
2. **Check Xcode console** for initialization messages
3. **Verify GoogleService-Info.plist** is in the project
4. **Test OAuth flows** from your website

If you're still getting UNIMPLEMENTED errors after these steps, it means your website isn't properly calling the initialization methods.