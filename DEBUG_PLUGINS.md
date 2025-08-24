# Debug UNIMPLEMENTED Plugin Errors

## Quick Test Script for Your Website

Add this JavaScript code to your website to test plugin availability:

```javascript
// Add this to your website console or temporarily in your code
console.log('🔍 CAPACITOR DEBUG: Starting plugin availability test...');

import { Capacitor } from '@capacitor/core';

console.log('📱 Platform:', Capacitor.getPlatform());
console.log('🏠 Native platform:', Capacitor.isNativePlatform());

// Test if plugins are registered
try {
  console.log('🔌 Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
  
  // Test Google Auth plugin availability
  const GoogleAuth = window.Capacitor?.Plugins?.GoogleAuth;
  console.log('🔍 GoogleAuth plugin:', GoogleAuth ? '✅ Available' : '❌ Not found');
  
  // Test Apple Sign In plugin availability  
  const SignInWithApple = window.Capacitor?.Plugins?.SignInWithApple;
  console.log('🍎 AppleSignIn plugin:', SignInWithApple ? '✅ Available' : '❌ Not found');
  
  // Test basic plugin call
  if (GoogleAuth) {
    console.log('🧪 Testing GoogleAuth.initialize...');
    GoogleAuth.initialize({
      clientId: '1064591086523-ru8pn28k9hkqv0uo6nr9njig1t378pjs.apps.googleusercontent.com'
    }).then(() => {
      console.log('✅ GoogleAuth initialized successfully');
    }).catch((error) => {
      console.error('❌ GoogleAuth init failed:', error);
    });
  }
  
} catch (error) {
  console.error('❌ Plugin test failed:', error);
}
```

## Alternative Initialization Approach

If the plugins still show UNIMPLEMENTED, try this initialization approach:

```javascript
// Alternative initialization method
import { registerPlugin } from '@capacitor/core';

const GoogleAuth = registerPlugin('GoogleAuth');
const SignInWithApple = registerPlugin('SignInWithApple');

// Then use normally
GoogleAuth.initialize({
  clientId: '1064591086523-ru8pn28k9hkqv0uo6nr9njig1t378pjs.apps.googleusercontent.com'
});
```

## Native iOS Debugging

### 1. Check Xcode Console for Errors
- Open Xcode Console while running the app
- Look for any plugin registration errors
- Filter by "Capacitor" or "Plugin"

### 2. Verify Plugin Registration
Add this to your AppDelegate.swift to manually verify plugins:

```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Debug: Print all registered plugins
        print("🔍 DEBUG: Capacitor plugins loading...")
        
        return true
    }
}
```

### 3. Common Fixes for UNIMPLEMENTED

#### Fix 1: Clean and Rebuild
```bash
# Clean everything
rm -rf ios/App/Pods
rm -rf ios/App/Podfile.lock
cd ios/App && pod install
npx cap sync ios
```

#### Fix 2: Verify Bundle ID Matches Google Console
- Bundle ID in Xcode: `app.photoshare`
- Google Console iOS app: must have same bundle ID

#### Fix 3: Check iOS Deployment Target
- Must be iOS 13.0 or later for Apple Sign-In
- Check in Xcode: Project > Deployment Target

#### Fix 4: Plugin Import Issues
Your website might need to import plugins differently:

```javascript
// Instead of direct import
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Try dynamic import
const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
```

## Expected Working Flow

When working correctly, you should see:
1. ✅ Plugins appear in `window.Capacitor.Plugins`
2. ✅ `GoogleAuth.initialize()` succeeds without errors  
3. ✅ `SignInWithApple.isAvailable()` returns true on iOS 13+
4. ✅ Native dialogs appear instead of UNIMPLEMENTED errors

## If Still Failing

The issue might be:
1. **Website not loading in native context** - Check if Capacitor bridge is working
2. **Plugin version incompatibility** - Capacitor 7.x vs plugin versions
3. **iOS project configuration** - Missing capabilities or entitlements
4. **Google Console configuration** - Bundle ID mismatch

Run the debug script above and let me know what it outputs!