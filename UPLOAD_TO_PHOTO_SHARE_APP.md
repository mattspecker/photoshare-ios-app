# Files to Upload to photo-share.app

## Required JavaScript Files

Upload these files to photo-share.app and include them in the main HTML:

### 1. Core Event Photo Picker Files
```html
<!-- Add these script tags to photo-share.app HTML -->
<script src="/js/event-photo-picker.js"></script>
<script src="/js/photo-share-app-integration.js"></script>
```

**Files to upload:**
- `www/event-photo-picker.js` - Core Event Photo Picker JavaScript interface
- `www/photo-share-app-integration.js` - Main integration that hooks into upload flow

### 2. Optional Demo/Testing Files (for development)
```html
<!-- Optional for testing during development -->
<script src="/js/event-photo-picker-demo.js"></script>
```

**Files to upload:**
- `www/event-photo-picker-demo.js` - Demo interface for testing

## Integration Points

### 1. Primary Integration - CapacitorCameraLib.pickImages() Override
**🎯 MAIN TARGET**: The integration specifically overrides:
- **CapacitorCameraLib.pickImages()** - Used by the "Upload" button in Share Photos sheet
- **Automatic detection** of `window.CapacitorCameraLib`, `window.Capacitor.Plugins.Camera`, or `window.Camera`
- **Seamless replacement** - Event Photo Picker appears instead of camera gallery
- **Compatible return format** - Returns photos in the same format as original pickImages()

### 2. Fallback Integrations
For additional coverage, also hooks into:
- **@capacitor/share** - Intercepts `Share.share()` calls for photo uploads
- **File inputs** - `<input type="file">` elements
- **Upload buttons** - Buttons with upload-related classes/attributes
- **Drag & drop areas** - Elements with drop zone classes

### 2. Event Data Detection
The system automatically detects event data from:
- **URL parameters** - `?eventId=123&eventName=Wedding`
- **localStorage** - `currentEvent`, `activeEvent`
- **sessionStorage** - Event data stored in session
- **Page elements** - `[data-event-id]`, `[data-event-name]` attributes
- **Global variables** - `window.currentEvent`, `window.eventData`

### 3. Manual Integration (if needed)
```javascript
// Set event data manually
window.photoShareAppIntegration.setEventData({
    eventId: 'wedding_2025',
    eventName: 'John & Jane Wedding',
    memberId: 'user_12345',
    startDate: '2025-08-20T14:00:00Z',
    endDate: '2025-08-21T02:00:00Z',
    uploadedPhotoIds: ['photo1', 'photo2'] // optional
});

// Test event info display
await testEventInfoOnSite();

// Get integration status
console.log(getEventPickerStatus());
```

## How It Works

### 1. Native App Detection
- Only activates when running in the native iOS app
- Gracefully falls back to standard upload in web browsers

### 2. Upload Flow Enhancement
1. User clicks upload button/area on photo-share.app
2. System intercepts `CapacitorCameraLib.pickImages()` call
3. **Native Event Information Modal appears** (centered, comprehensive)
4. User reviews event details and photo library permissions
5. User can request photo access if needed
6. User clicks "Continue" to proceed (or "Cancel" to abort)
7. *(Optional)* Event Photo Picker opens with date filtering
8. *(Optional)* User selects photos from event timeframe
9. *(Optional)* Selected photos are passed to original upload system

### 3. Native Event Information Modal Features
- **📋 Event Details Section** - Event name, ID, member ID
- **🕐 Event Time Period** - Formatted start/end dates and times
- **📱 Photo Library Access** - Real-time permission status with visual indicators
- **🎨 Modern iOS Design** - Centered modal with dark overlay
- **⚡ Smart Actions** - Request permission, continue, or cancel buttons
- **🔍 Debug Logging** - Comprehensive console output for troubleshooting

### 4. Event Photo Picker Features *(Currently Disabled for Testing)*
- **Date filtering** - Only shows photos from event start/end dates
- **Upload status** - Hides/dims already uploaded photos
- **Multi-selection** - Select individual photos or "Select All"
- **Permission handling** - Requests photo library access if needed

## Testing

### Current Testing Mode (Event Info Modal Only)

**🎯 PRIMARY TEST**: Upload button integration
1. Open the iOS app and navigate to photo-share.app
2. Navigate to any event page (e.g., `/event/xyz`)  
3. Click any "Upload" or "Share Photos" button
4. **Expected**: Native Event Information Modal appears (centered on screen)

### Debug Console Logging
Watch for these log messages in order:
```
🎯 Event context detected - showing Event Information Modal ONLY
🚀 showEventInfo called in JavaScript integration  
📋 Event data received: [object]
✅ Calling native showEventInfo...
🚀 showEventInfo called - Starting modal presentation
📊 Event Data - Name: X, ID: X, Member: X
🎯 EventInfoModalViewController.viewDidLoad() - Modal is loading!
✅ EventInfoModalViewController setup complete
✅ Event info modal presented successfully
```

### Manual Testing Commands (in browser console):
```javascript
// Test event info display directly
await testEventInfoOnSite()

// Test CapacitorCameraLib.pickImages() override 
testPickImagesOverride()

// Check integration status  
getEventPickerStatus()

// Manually set event data for testing
window.photoShareAppIntegration.setEventData({
    eventId: 'test_event_123',
    eventName: 'Test Event',
    memberId: 'test_user',
    startDate: '2025-08-15T10:00:00Z',
    endDate: '2025-08-16T22:00:00Z'
})
```

### Expected Behavior (Current State):
1. ✅ Upload buttons should trigger `CapacitorCameraLib.pickImages()` override
2. ✅ **Native Event Information Modal appears** with:
   - Event details (name, ID, member)
   - Formatted start/end times
   - Photo library permission status with visual indicators
   - "Request Permission" button (if needed)
   - "Continue" and "Cancel" buttons
3. ✅ Modal is **centered on screen** with dark background overlay
4. ✅ **Debug logging** shows complete flow in console
5. ✅ Photo picker is **currently disabled** (prevents camera picker from opening)

### Troubleshooting

**If modal doesn't appear:**
- Check console for debug logs to see where the chain breaks
- Verify you're on an event page with valid event data
- Ensure you're using the native iOS app (not web browser)

**If getting standard camera picker:**
- Integration may not be hooking into the right upload button
- Check console for `CapacitorCameraLib.pickImages intercepted` message

## Configuration Updated

### Capacitor Config
- ✅ Server URL set to `https://photo-share.app`
- ✅ Auto-redirect enabled to live site

### iOS Info.plist  
- ✅ App Transport Security configured for photo-share.app
- ✅ Photo library permissions configured
- ✅ Background modes enabled for uploads

## Current Status & Next Steps

### ✅ Completed
- Native Event Information Modal with comprehensive UI
- CapacitorCameraLib.pickImages() override integration  
- Debug logging throughout the entire flow
- Centered modal design with dark background overlay
- Smart permission handling and action buttons
- iOS app build and sync completed

### 🔄 Current Testing Phase  
**Focus**: Native Event Information Modal display and functionality
- Modal shows event details, time periods, and permissions
- Photo picker functionality temporarily disabled for modal testing
- Comprehensive debug logging helps identify any integration issues

### 📋 Next Steps (After Modal Testing)
1. **Test the native modal** on photo-share.app upload buttons
2. **Verify debug logging** shows complete flow in console  
3. **Confirm modal displays** event info and permissions correctly
4. **Re-enable Event Photo Picker** (remove testing disable)
5. **Test complete upload flow** with photo selection
6. **Upload JavaScript files** to production photo-share.app

### 🎯 Testing Instructions
1. **Upload the JavaScript files** to photo-share.app:
   - `www/event-photo-picker.js` 
   - `www/photo-share-app-integration.js`
2. **Include script tags** in the main HTML template
3. **Test modal integration** by clicking upload buttons
4. **Check console logs** for debug output
5. **Verify modal appearance** and functionality

The system automatically enhances existing upload functionality when running in the native iOS app, without requiring changes to photo-share.app's existing code.
