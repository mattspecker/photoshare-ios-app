# iOS EventPhotoPicker Upload Flow - JWT Token & Upload Process

**IMPORTANT**: This documents the **working iOS implementation** that successfully resolves 401 authentication errors. If uploads start failing with 401 errors in the future, verify this flow is still intact.

## Overview

The iOS EventPhotoPicker implements a robust JWT token management and photo upload system based on proven Android patterns. This document details the complete flow from JWT token retrieval through successful photo upload.

## JWT Token Management Flow

### 1. App Wake JWT Preloading (AppDelegate.swift)

JWT tokens are automatically preloaded when the app becomes active:

```swift
func applicationDidBecomeActive(_ application: UIApplication) {
    // Pre-load fresh JWT token every time app becomes active (Android pattern)
    print("🔄 App became active - checking for fresh JWT token...")
    self.preloadFreshJwtToken()
}

private func preloadFreshJwtToken() {
    // Check if we already have a fresh token (less than 5 minutes old)
    let tokenData = AppDelegate.getStoredJwtData()
    
    if let tokenData = tokenData,
       let retrievedAt = tokenData["retrievedAt"] as? TimeInterval {
        let tokenAge = Date().timeIntervalSince1970 - retrievedAt
        
        if tokenAge < 300 { // 5 minutes = 300 seconds
            print("🔄 Fresh token already available (age: \(Int(tokenAge))s) - no need to pre-load")
            return
        }
    }
    
    // Request fresh token via Capacitor WebView bridge (with 1 second delay like Android)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
        self.retrieveJwtTokenForNativePlugins()
    }
}
```

**Key Points:**
- ✅ Triggers on every app wake/resume
- ✅ Uses 5-minute freshness check (Android pattern)
- ✅ 1-second delay for WebView readiness
- ✅ Only refreshes when needed (performance optimization)

### 2. JWT Token Storage (AppDelegate.swift)

JWT tokens are stored with comprehensive metadata for validation:

```swift
private func storeJwtToken(token: String) {
    // Parse JWT to get expiration
    let expiresAt = parseJwtExpiration(token: token)
    let tokenData: [String: Any] = [
        "token": token,
        "expiresAt": expiresAt?.timeIntervalSince1970 ?? 0,
        "retrievedAt": Date().timeIntervalSince1970
    ]
    
    // Store in UserDefaults for EventPhotoPicker access
    UserDefaults.standard.set(tokenData, forKey: "photoshare_jwt_data")
    UserDefaults.standard.set(token, forKey: "photoshare_jwt_token")
    
    // Process token for instance variables
    processJwtToken(token: token)
}
```

**Key Points:**
- ✅ Stores token, expiration, and retrieval timestamp
- ✅ Dual storage: both `photoshare_jwt_data` (full data) and `photoshare_jwt_token` (simple)
- ✅ Calls both `storeJwtToken()` and `processJwtToken()` for consistency

### 3. JWT Token Validation (AppDelegate.swift)

Token validity is checked using timestamp-based validation:

```swift
@objc static func isJwtTokenValid() -> Bool {
    guard let tokenData = getStoredJwtData(),
          let expiresAt = tokenData["expiresAt"] as? TimeInterval,
          expiresAt > 0 else {
        print("🔍 JWT validation failed - no token data or expiration")
        return false
    }
    
    let expirationDate = Date(timeIntervalSince1970: expiresAt)
    let now = Date()
    let timeUntilExpiry = expirationDate.timeIntervalSince(now)
    
    // Consider token valid if it expires more than 5 minutes from now
    let isValid = timeUntilExpiry > 300
    print("🔍 JWT is valid: \(isValid)")
    return isValid
}
```

**Key Points:**
- ✅ Uses actual JWT expiration time from token payload
- ✅ 5-minute buffer for token validity (matches Android)
- ✅ Comprehensive logging for debugging

## EventPhotoPicker Upload Flow

### 4. EventPhotoPicker Initialization (EventPhotoPicker.swift)

When EventPhotoPicker opens, it validates and refreshes JWT tokens:

```swift
@objc func openEventPhotoPicker(_ call: CAPPluginCall) {
    // Check JWT token availability (with fallback for immediate retrieval if needed)
    var jwtToken = AppDelegate.getStoredJwtToken()
    
    if jwtToken == nil || !AppDelegate.isJwtTokenValid() {
        print("⚠️ No valid JWT token stored, triggering refresh...")
        
        // Trigger JWT token refresh when EventPhotoPicker opens with invalid token
        AppDelegate.refreshJwtTokenIfNeeded()
        
        // Use whatever token we have for now (might be expired but better than nothing)
        if let storedToken = AppDelegate.getStoredJwtToken() {
            jwtToken = storedToken
            print("🔐 Using stored JWT token (refreshing in background): \(storedToken.prefix(20))...")
        }
    } else {
        print("✅ Valid JWT token available for EventPhotoPicker: \(jwtToken!.prefix(20))...")
    }
    
    // Store JWT token in current instance for potential API calls
    self.currentJwtToken = jwtToken
}
```

**Key Points:**
- ✅ Validates JWT token on every EventPhotoPicker open
- ✅ Triggers refresh if token is invalid/expired
- ✅ Stores token in instance variable for uploads
- ✅ Comprehensive logging for debugging

### 5. Upload Token Selection (EventPhotoPicker.swift)

The critical JWT token selection logic that prevents 401 errors:

```swift
private func getJwtTokenForUpload() -> String? {
    print("🔄 Getting JWT token for upload - checking freshness like Android...")
    
    // Priority 1: Fresh JWT token with timestamp check (Android pattern)
    if let tokenData = AppDelegate.getStoredJwtData(),
       let storedToken = tokenData["token"] as? String,
       let retrievedAt = tokenData["retrievedAt"] as? TimeInterval {
        
        let tokenAge = Date().timeIntervalSince1970 - retrievedAt
        print("🔍 Stored token age: \(Int(tokenAge)) seconds")
        
        // Fresh token must be less than 5 minutes old (300 seconds) like Android
        if tokenAge < 300 {
            print("✅ Using fresh JWT token from storage (age: \(Int(tokenAge))s, length: \(storedToken.count))")
            return storedToken
        } else {
            print("⚠️ Stored JWT token is expired (age: \(Int(tokenAge))s > 300s)")
            print("🔄 Triggering background JWT refresh for future uploads...")
            AppDelegate.refreshJwtTokenIfNeeded()
        }
    } else {
        print("⚠️ No stored JWT token data found, triggering refresh...")
        AppDelegate.refreshJwtTokenIfNeeded()
    }
    
    // Priority 2: Instance JWT token (from EventPhotoPicker initialization)
    if let instanceToken = jwtToken {
        print("✅ Using instance JWT token as fallback (length: \(instanceToken.count))")
        return instanceToken
    }
    
    // Priority 3: Any stored token as last resort (even if expired)
    if let fallbackToken = AppDelegate.getStoredJwtToken() {
        print("⚠️ Using potentially expired JWT token as last resort (length: \(fallbackToken.count))")
        return fallbackToken
    }
    
    print("❌ No JWT token available at all")
    return nil
}
```

**CRITICAL**: This is the **key function that prevents 401 errors**. It implements Android's proven patterns:

- ✅ **Timestamp-based freshness check** (< 5 minutes old)
- ✅ **Automatic refresh trigger** when expired tokens detected
- ✅ **Priority fallback system** (fresh → instance → expired)
- ✅ **Comprehensive logging** for debugging

### 6. Photo Upload Request (EventPhotoPicker.swift)

The actual upload request with proper JWT authentication:

```swift
private func sendUploadRequest(jwtToken: String, requestBody: Data) -> Bool {
    guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/mobile-upload") else {
        print("❌ Invalid upload URL")
        return false
    }
    
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
    request.setValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY", forHTTPHeaderField: "apikey")
    request.setValue("ios", forHTTPHeaderField: "X-Client-Platform")
    request.setValue("native-plugin", forHTTPHeaderField: "X-Upload-Source")
    request.setValue("1.0.0", forHTTPHeaderField: "X-Client-Version")
    request.timeoutInterval = 90 // 90 seconds timeout for large uploads
    request.httpBody = requestBody
}
```

**Key Points:**
- ✅ Correct Supabase Edge Function endpoint
- ✅ Proper JWT token in Authorization header
- ✅ Required apikey header for Supabase
- ✅ Platform identification headers
- ✅ Appropriate timeout for large uploads

## Upload Request Body Format

The JSON request body matches the API specification:

```swift
private func buildUploadRequestBody(photo: EventPhoto, base64Data: String, photoName: String) -> Data? {
    let uploadData: [String: Any] = [
        "eventId": eventId,
        "fileName": photoName,
        "fileData": base64Data,
        "mediaType": "photo",
        "originalTimestamp": ISO8601DateFormatter().string(from: photo.creationDate),
        "deviceId": getDeviceIdentifier() ?? "unknown-ios-device",
        "metadata": [
            "source": "ios-native-plugin",
            "pixelWidth": photo.pixelWidth,
            "pixelHeight": photo.pixelHeight,
            "fileSize": base64Data.count
        ]
    ]
}
```

## Critical JWT Token Fixes Applied

### Fix #1: Chunked Token Storage Issue

**Problem**: Chunked tokens (large JWT tokens) were calling `processJwtToken()` but not `storeJwtToken()`, causing validation failures.

**Solution**: 
```swift
// BEFORE (BROKEN):
self.processJwtToken(token: fullToken)

// AFTER (FIXED):
self.storeJwtToken(token: fullToken)
```

### Fix #2: Missing JWT Refresh on EventPhotoPicker Open

**Problem**: EventPhotoPicker detected invalid tokens but didn't trigger refresh, just used expired tokens.

**Solution**:
```swift
// BEFORE (BROKEN):
// For now, proceed without JWT validation - let the user try and the API will handle auth

// AFTER (FIXED):
AppDelegate.refreshJwtTokenIfNeeded()
```

### Fix #3: Missing Android Timestamp Validation

**Problem**: iOS used any stored token without checking freshness, while Android checked 5-minute age limit.

**Solution**:
```swift
// BEFORE (BROKEN):
if let storedToken = AppDelegate.getStoredJwtToken() {
    return storedToken // No freshness check!
}

// AFTER (FIXED):
let tokenAge = Date().timeIntervalSince1970 - retrievedAt
if tokenAge < 300 { // 5 minutes like Android
    return storedToken
}
```

## Debugging JWT Token Issues

### Log Markers for Easy Identification

- 🔄 - Token retrieval and refresh operations
- ✅ - Successful operations  
- ⚠️ - Warnings and fallbacks
- ❌ - Errors and failures
- 🔍 - Debug information and validation
- 🔐 - JWT token operations

### Key Log Messages to Look For

**Successful Flow:**
```
🔄 App became active - checking for fresh JWT token...
🔄 Fresh token already available (age: 45s) - no need to pre-load
✅ Valid JWT token available for EventPhotoPicker: eyJhbGciOiJIUzI1N...
🔄 Getting JWT token for upload - checking freshness like Android...
🔍 Stored token age: 45 seconds
✅ Using fresh JWT token from storage (age: 45s, length: 1423)
📡 Sending upload request to: https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/mobile-upload
📨 Upload response code: 200
✅ Upload successful
```

**Problem Indicators:**
```
⚠️ Stored JWT token is expired (age: 450s > 300s)
🔄 Triggering background JWT refresh for future uploads...
⚠️ Using potentially expired JWT token as last resort
📨 Upload response code: 401
❌ Upload failed with code 401: Authentication failed
```

### JWT Token Storage Keys

**UserDefaults Keys:**
- `"photoshare_jwt_data"` - Complete token data with metadata
- `"photoshare_jwt_token"` - Simple token string

**Token Data Structure:**
```swift
[
    "token": "eyJhbGciOiJIUzI1NiI...",
    "expiresAt": 1735689600.0,           // JWT expiration timestamp
    "retrievedAt": 1735686000.0          // When token was stored
]
```

### Common Issues & Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **401 Authentication Failed** | Upload returns 401 error | Check token freshness, ensure `getJwtTokenForUpload()` is working |
| **No JWT Token Available** | "❌ No JWT token available at all" | Check app wake preloading, ensure WebView functions exist |
| **Token Always Expired** | All tokens show > 300s age | Check system time, verify `retrievedAt` timestamp storage |
| **Chunked Token Not Stored** | Large tokens work in logs but fail validation | Verify `storeJwtToken()` called for chunked tokens |
| **WebView Functions Missing** | "❌ getPhotoShareJwtToken function not available" | Check web app has required JWT functions loaded |

### Manual Testing Steps

1. **Fresh App Launch:**
   - Kill app completely
   - Reopen app → Should see "🔄 App became active - checking for fresh JWT token..."
   - Open EventPhotoPicker → Should see valid token message

2. **Token Age Testing:**
   - Wait 6+ minutes after app wake
   - Open EventPhotoPicker → Should trigger refresh
   - Check logs for "⚠️ Stored JWT token is expired" message

3. **Upload Testing:**
   - Select photos in EventPhotoPicker
   - Click Upload → Check logs for fresh token usage
   - Verify 200 response code, not 401

### Critical File Locations

- **`AppDelegate.swift`** - JWT token retrieval, storage, and validation
- **`EventPhotoPicker.swift`** - Token selection for uploads, upload request handling
- **UserDefaults** - Token storage location (`photoshare_jwt_data`, `photoshare_jwt_token`)
- **Capacitor WebView** - JavaScript JWT token functions (`window.getPhotoShareJwtToken`)

## API Endpoint & Headers

**Endpoint:** `POST https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/mobile-upload`

**Required Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY
X-Client-Platform: ios
X-Upload-Source: native-plugin
X-Client-Version: 1.0.0
```

---

**Status:** ✅ **WORKING** as of 2025-01-24  
**Next Review:** If 401 errors return, verify this flow is intact  
**Key Fix:** Android-style timestamp-based JWT token freshness validation