# 🚀 PhotoShare Auto-Upload Integration Instructions

## Quick Setup for photo-share.app Website

Add this **single JavaScript file** to your photo-share.app website to enable cross-platform auto-upload functionality.

### 1. Add Scripts to Website

Add these lines to your photo-share.app HTML (before closing `</body>` tag):

```html
<!-- Authentication Bridge (FIRST) -->
<script src="/js/photoshare-auth-bridge.js"></script>

<!-- Auto-Upload Bundle (SECOND) -->
<script src="/js/photoshare-auto-upload-bundle.js"></script>

<!-- Event Detector (THIRD) -->
<script src="/js/photoshare-event-detector.js"></script>

<!-- Real-Time Sync (FOURTH) -->
<script src="/js/photoshare-realtime-sync.js"></script>
```

**Order is important**: Load in sequence for proper initialization.

### 2. Upload the Files

Copy all four files to your website's `/js/` directory:
- `photoshare-auth-bridge.js` 
- `photoshare-auto-upload-bundle.js`
- `photoshare-event-detector.js`
- `photoshare-realtime-sync.js`

**That's it!** The auto-upload system will automatically:
- ✅ Detect if running in native iOS/Android app
- ✅ Initialize authentication with your existing Supabase
- ✅ Add dashboard accessible via 3-finger tap or shake
- ✅ Add auto-upload toggles to event pages
- ✅ Handle photo uploads from mobile apps

## 📱 User Experience

### On Native iOS App:
- Dashboard appears with 3-finger tap or shake
- Shows authentication status, upload progress
- Event pages automatically get auto-upload toggles
- Photos upload automatically when enabled

### On Web Browser:
- Dashboard shows platform detection
- All features work except photo library access
- Users can manually upload photos

### On Future Android App:
- Same functionality as iOS
- Cross-platform compatibility built-in

## 🔧 Dashboard Features

Users can access real-time monitoring via:
- **3-finger tap** on screen
- **Shake device** (mobile)
- **Console**: `showDashboard()`

Dashboard shows:
- ✅ Platform detection (iOS/Android/Web)
- ✅ Authentication status
- ✅ Upload statistics and success rates
- ✅ Auto-upload settings per event
- ✅ Photo monitoring status
- ✅ Real-time controls

## ⚙️ Configuration

The script uses your existing photo-share.app configuration:
- **Supabase client**: Automatically detected from `window.supabase`
- **Authentication**: Uses existing user sessions
- **API endpoints**: Uses your `/functions/v1/mobile-upload`
- **Database**: Uploads to your `mobile_uploads` table

## 🎯 Event Integration

The script automatically:
1. **Scans for event elements** with `data-event-id`, `.event-card`, `.event-item`
2. **Adds auto-upload toggles** to each event
3. **Saves settings** to localStorage
4. **Handles uploads** when users opt-in to events

## 📊 Analytics & Monitoring

Built-in monitoring includes:
- Upload success/failure rates
- Network quality adaptation
- Retry logic with exponential backoff
- Real-time status sharing
- Platform-specific capabilities

## 🔒 Security & Privacy

- ✅ Only works with authenticated users
- ✅ Uses your existing authentication system
- ✅ Respects user opt-in/opt-out preferences
- ✅ Deduplication via SHA-256 hashing
- ✅ No photos stored locally

## 🚀 Benefits

### For You:
- **Single file** integration
- **Cross-platform** compatibility
- **No server changes** required
- **Uses existing infrastructure**

### For Users:
- **Seamless experience** on photo-share.app
- **Native app features** with web interface
- **Easy opt-in/opt-out** per event
- **Real-time progress** monitoring

## 🧪 Testing

After integration, test by:
1. Loading photo-share.app in iOS app
2. Using 3-finger tap to show dashboard
3. Checking authentication status
4. Toggling auto-upload on test events
5. Verifying uploads appear in database

## 📞 Debug Commands

For troubleshooting authentication issues:
```javascript
// Debug authentication specifically
debugPhotoShareAuth()

// Check auth bridge status
window.PhotoShareAuthBridge.isReady()

// Get current user via bridge
await window.PhotoShareAuthBridge.getUser()

// Show dashboard
showDashboard()

// Get full status
window.PhotoShareAutoUpload.getStatus()

// Reinitialize system
window.PhotoShareAutoUpload.reinitialize()

// Check platform
window.PhotoShareAutoUpload.getStatus().platform
```

## 🔧 Troubleshooting Authentication

If dashboard shows "Not signed in" even when logged in:

1. **Check auth bridge**: `debugPhotoShareAuth()`
2. **Verify Supabase**: `window.supabase` should exist
3. **Check timing**: Auth bridge loads before auto-upload bundle
4. **Manual refresh**: `window.PhotoShareAutoUpload.reinitialize()`

This single-file solution provides complete auto-upload functionality across all platforms while integrating seamlessly with your existing photo-share.app infrastructure!