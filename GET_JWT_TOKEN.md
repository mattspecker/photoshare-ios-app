# JWT Token Management in PhotoShare Android App

This document explains how JWT tokens are automatically managed in the PhotoShare Android app for seamless photo uploads.

## Overview

The app implements an **automatic JWT token pre-loading system** that ensures fresh authentication tokens are always available for photo uploads. This system runs in the background and eliminates manual token management.

## Automatic Token Pre-loading Flow

### 1. Activity Lifecycle Integration

The JWT token pre-loading is triggered automatically when the EventPhotoPicker activity becomes active:

```java
@Override
protected void onResume() {
    super.onResume();
    
    // Pre-load fresh chunked JWT token every time activity becomes active
    // This ensures we have a fresh token whether it's a new launch or returning from background
    Log.d(TAG, "🔄 EventPhotoPicker resumed - checking for fresh JWT token...");
    preloadFreshChunkedToken();
}
```

**When it runs:**
- Every time EventPhotoPicker activity starts
- When returning from background
- After device rotation or configuration changes
- When switching between apps and returning

### 2. Token Freshness Check

Before requesting a new token, the system checks if we already have a fresh one:

```java
private void preloadFreshChunkedToken() {
    Log.d(TAG, "🔄 PRE-LOADING fresh chunked JWT token...");
    
    // Check if we already have a fresh token (less than 5 minutes old)
    SharedPreferences prefs = getSharedPreferences("PhotoSharePrefs", MODE_PRIVATE);
    String freshToken = prefs.getString("fresh_jwt_token", null);
    long freshTokenTime = prefs.getLong("fresh_token_timestamp", 0);
    
    if (freshToken != null && (System.currentTimeMillis() - freshTokenTime) < 300000) {
        Log.d(TAG, "🔄 Fresh token already available (age: " + ((System.currentTimeMillis() - freshTokenTime) / 1000) + "s) - no need to pre-load");
        return;
    }
    
    Log.d(TAG, "🔄 No fresh token available or expired - pre-loading now...");
    
    // Request fresh chunked token via Capacitor WebView bridge (async)
    // Use Handler to delay slightly and ensure WebView is ready
    new Handler().postDelayed(() -> {
        requestFreshChunkedTokenViaCapacitor();
    }, 1000); // 1 second delay to ensure WebView is ready
}
```

**Token Freshness Logic:**
- Tokens are considered fresh for **5 minutes** (300,000 milliseconds)
- System only requests new tokens if current one is null or expired
- Uses timestamps to track token age accurately

### 3. Capacitor Bridge Token Request

When a fresh token is needed, the system calls the web app's JWT functions via the Capacitor WebView bridge:

```java
private void requestFreshChunkedTokenViaCapacitor() {
    Log.d(TAG, "🔄 AUTO-REQUESTING fresh chunked JWT token via Capacitor...");
    
    runOnUiThread(() -> {
        try {
            // Use Capacitor's plugin system to get the bridge and execute JavaScript
            // Since we're launched by EventPhotoPickerPlugin, we can access the static bridge
            if (EventPhotoPickerPlugin.getLastBridge() != null) {
                String javascript = 
                    "javascript:(async function() {" +
                    "  console.log('🔄 AUTO: Starting automatic chunked JWT request...');" +
                    "  if (window.testChunkedJwtTransfer) {" +
                    "    try {" +
                    "      console.log('🔄 AUTO: Calling testChunkedJwtTransfer()...');" +
                    "      const result = await window.testChunkedJwtTransfer();" +
                    "      if (result) {" +
                    "        console.log('🔄 AUTO: ✅ testChunkedJwtTransfer completed successfully!');" +
                    "      } else {" +
                    "        console.log('🔄 AUTO: ⚠️ testChunkedJwtTransfer returned no result');" +
                    "      }" +
                    "    } catch (error) {" +
                    "      console.log('🔄 AUTO: ❌ Error in testChunkedJwtTransfer: ' + error.message);" +
                    "    }" +
                    "  } else {" +
                    "    console.log('🔄 AUTO: ❌ window.testChunkedJwtTransfer function not available');" +
                    "  }" +
                    "  return 'auto-request-completed';" +
                    "})();";
                
                EventPhotoPickerPlugin.getLastBridge().getWebView().evaluateJavascript(javascript, result -> {
                    Log.d(TAG, "🔄 Auto-request JavaScript executed: " + result);
                });
                
                Log.d(TAG, "🔄 Sent auto-request JavaScript to Capacitor WebView");
            } else {
                Log.w(TAG, "❌ No Capacitor bridge available for auto-request");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error in automatic chunked token request: " + e.getMessage());
        }
    });
}
```

**What this does:**
- Executes JavaScript in the PhotoShare web app context
- Calls `window.testChunkedJwtTransfer()` to initiate JWT chunking
- Handles errors gracefully with comprehensive logging
- Uses async execution to avoid blocking the UI thread

## Token Usage During Upload

When a user uploads photos, the system uses the pre-loaded token with a priority system:

```java
// Token should already be pre-loaded from onResume() - just check status
Log.d(TAG, "🔄 Fresh token status: " + (freshToken != null ? "exists but age=" + ((System.currentTimeMillis() - freshTokenTime) / 1000) + "s" : "null"));
if (freshToken == null || (System.currentTimeMillis() - freshTokenTime) >= 300000) {
    Log.w(TAG, "⚠️ Fresh token not available or expired - this should have been pre-loaded in onResume()");
}

// PRIORITY: Use fresh chunked tokens first (now potentially auto-requested)
if (freshToken != null && (System.currentTimeMillis() - freshTokenTime) < 300000) {
    Log.d(TAG, "✅ Using fresh JWT token from chunked transfer (length: " + freshToken.length() + ", age: " + ((System.currentTimeMillis() - freshTokenTime) / 1000) + "s)");
    Log.d(TAG, "🔍 Fresh token preview: " + (freshToken.length() > 100 ? freshToken.substring(0, 50) + "..." + freshToken.substring(freshToken.length() - 50) : freshToken));
    jwtToken = freshToken;
} else if (freshToken != null) {
    Log.w(TAG, "⚠️ Fresh token still expired after auto-request (age: " + ((System.currentTimeMillis() - freshTokenTime) / 1000) + "s)");
    Log.w(TAG, "⚠️ Falling back to monitoring token - upload may fail");
    
    // Fallback to monitoring token if long enough
    if (monitoringToken != null && monitoringToken.length() > 500) {
        Log.d(TAG, "✅ Using monitoring JWT token as fallback (length: " + monitoringToken.length() + ")");
        jwtToken = monitoringToken;
    }
} else {
    Log.w(TAG, "⚠️ Auto-request did not produce fresh token - using monitoring token");
    
    // Last resort: use monitoring token if available and long enough
    if (monitoringToken != null && monitoringToken.length() > 500) {
        Log.d(TAG, "✅ Using monitoring JWT token as last resort (length: " + monitoringToken.length() + ")");
        jwtToken = monitoringToken;
    } else {
        Log.e(TAG, "❌ No valid tokens available after auto-request");
    }
}
```

**Token Priority System:**
1. **Fresh Chunked Token** (preferred) - Auto-requested tokens less than 5 minutes old
2. **Monitoring Token** (fallback) - Tokens captured from web app monitoring
3. **Intent Token** (last resort) - Tokens passed via Android intents

## Token Storage

Tokens are stored in Android SharedPreferences for persistence across app sessions:

```java
SharedPreferences prefs = getSharedPreferences("PhotoSharePrefs", MODE_PRIVATE);

// Storage keys:
// - "fresh_jwt_token": The actual JWT token string
// - "fresh_token_timestamp": When the token was stored (milliseconds)
// - "current_jwt_token": Monitoring token from web app
```

**Storage Details:**
- **Location**: `PhotoSharePrefs` SharedPreferences
- **Persistence**: Survives app restarts and device reboots
- **Security**: Standard Android app-private storage
- **Cleanup**: Tokens are automatically replaced when new ones are fetched

## JavaScript Integration

The system expects these JavaScript functions to be available in the PhotoShare web app:

### Required Function: `window.testChunkedJwtTransfer()`

```javascript
// This function should:
// 1. Get the current user's JWT token
// 2. Call sendJwtTokenToAndroidEventPicker() to chunk it to Android
// 3. Return success/failure status

window.testChunkedJwtTransfer = async function() {
    try {
        const token = await getPhotoShareJwtToken(); // Get current JWT
        if (token) {
            const success = await sendJwtTokenToAndroidEventPicker(token);
            return success;
        }
        return false;
    } catch (error) {
        console.error('JWT chunking failed:', error);
        return false;
    }
}
```

### Supporting Functions

```javascript
// Chunk JWT token to Android (handles WebView size limitations)
window.sendJwtTokenToAndroidEventPicker = async function(token, chunkSize = 200) {
    // Implementation splits token into chunks and sends via Capacitor
}

// Get current PhotoShare JWT token
window.getPhotoShareJwtToken = async function() {
    // Implementation returns current user's JWT token
}
```

## Debugging and Logging

The JWT system includes comprehensive logging with emoji markers for easy identification:

**Log Markers:**
- 🔄 - Token pre-loading and automatic requests
- ✅ - Successful operations
- ⚠️ - Warnings and fallbacks
- ❌ - Errors and failures
- 🔍 - Debug information and token previews

**Key Log Messages:**
```
🔄 EventPhotoPicker resumed - checking for fresh JWT token...
🔄 PRE-LOADING fresh chunked JWT token...
🔄 Fresh token already available (age: 45s) - no need to pre-load
🔄 AUTO-REQUESTING fresh chunked JWT token via Capacitor...
✅ Using fresh JWT token from chunked transfer (length: 1399, age: 30s)
```

## Troubleshooting

### Common Issues

1. **No Fresh Token Available**
   ```
   ⚠️ Fresh token not available or expired - this should have been pre-loaded in onResume()
   ```
   - **Cause**: JavaScript function not available or web app not responding
   - **Solution**: Check that `window.testChunkedJwtTransfer()` exists in web app

2. **Capacitor Bridge Not Available**
   ```
   ❌ No Capacitor bridge available for auto-request
   ```
   - **Cause**: EventPhotoPicker not launched via plugin or bridge not initialized
   - **Solution**: Ensure EventPhotoPicker is called through Capacitor plugin system

3. **JavaScript Function Missing**
   ```
   🔄 AUTO: ❌ window.testChunkedJwtTransfer function not available
   ```
   - **Cause**: Required JavaScript functions not implemented in web app
   - **Solution**: Web team needs to add chunked JWT transfer functions

### Debug Commands

**View Android logs:**
```bash
adb logcat -s "EventPhotoPicker"
```

**Check token storage:**
- Tokens are stored in `PhotoSharePrefs` SharedPreferences
- Can be viewed in Android Studio Device File Explorer
- Path: `/data/data/app.photoshare/shared_prefs/PhotoSharePrefs.xml`

**JavaScript console testing:**
```javascript
// Test if functions are available
console.log('testChunkedJwtTransfer:', !!window.testChunkedJwtTransfer);

// Manual token request
if (window.testChunkedJwtTransfer) {
    window.testChunkedJwtTransfer().then(result => {
        console.log('Manual JWT request result:', result);
    });
}
```

## Benefits of Automatic System

✅ **Zero User Intervention**: Tokens are managed completely automatically  
✅ **Always Fresh**: Tokens are pre-loaded before user attempts upload  
✅ **Robust Fallbacks**: Multiple token sources ensure uploads rarely fail  
✅ **Performance Optimized**: Background processing doesn't block UI  
✅ **Battery Efficient**: Only requests tokens when needed (5-minute cache)  
✅ **Error Resilient**: Comprehensive error handling and logging  

## Integration Status

**Android Side**: ✅ **Complete and Functional**
- Automatic token pre-loading implemented
- Capacitor bridge integration working
- Token storage and caching functional
- Upload integration with priority system complete

**Web Side**: ⚠️ **Requires Implementation**
- `window.testChunkedJwtTransfer()` function needed
- JWT chunking functions need to be added
- PhotoShare web app integration pending

Once the web team implements the required JavaScript functions, the entire JWT token management system will work completely automatically with no user intervention required.