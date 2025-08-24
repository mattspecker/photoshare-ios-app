# EventPhotoPicker Integration Plan

## Current Status ✅

**Native iOS Plugin:**
- ✅ EventPhotoPicker.swift - Native iOS implementation with photo filtering
- ✅ EventPhotoPicker.m - Objective-C bridge for Capacitor
- ✅ Plugin compiled and linked in Xcode project
- ✅ Manual registration via `window.Capacitor.registerPlugin('EventPhotoPicker')` works
- ✅ Native methods available: `showEventInfo`, `getEventPhotosMetadata`, `openEventPhotoPicker`

**Issues:**
- ❌ Automatic plugin registration timing issues
- ❌ Multiple competing scripts causing conflicts
- ❌ Integration with photo-share.app website needs deployment

## Phase 1: Clean App Integration 🧹

### 1.1 Simplify JavaScript Loading
**Goal:** Create a single, reliable EventPhotoPicker service

**Actions:**
- Remove all diagnostic and test scripts
- Create one consolidated `eventPhotoPicker.js` file
- Ensure proper initialization order
- Add failsafe manual registration

### 1.2 Core Integration Script
```javascript
// eventPhotoPicker.js - Single source of truth
class EventPhotoPickerIntegration {
    constructor() {
        this.plugin = null;
        this.isReady = false;
        this.init();
    }
    
    async init() {
        // Manual registration with retry logic
        this.plugin = window.Capacitor.registerPlugin('EventPhotoPicker');
        this.isReady = true;
    }
    
    async showEventDialog(eventData) {
        // Native dialog implementation
    }
    
    async getPhotoCount(startDate, endDate, timezone) {
        // Photo metadata implementation
    }
    
    async openPhotoPicker(eventData) {
        // Full photo picker implementation
    }
}

window.EventPhotoPickerApp = new EventPhotoPickerIntegration();
```

### 1.3 Camera Override for Photo-Share.app
**Goal:** Intercept upload buttons and replace with EventPhotoPicker

**Implementation:**
```javascript
// Override camera.pickImages when on photo-share.app
if (window.location.href.includes('photo-share.app')) {
    // Hook into upload buttons
    // Show event info dialog
    // Open EventPhotoPicker instead of regular camera
}
```

## Phase 2: Website Integration Script 🌐

### 2.1 Standalone Integration Script
**File:** `photo-share-eventpicker-integration.js`
**Deploy to:** photo-share.app website

**Features:**
- Detect if running in native app vs browser
- Extract current event data from page/API
- Replace upload button behavior
- Fallback to normal upload in browser

### 2.2 Event Data Detection
```javascript
// Extract event information from current page
function getCurrentEventInfo() {
    // Method 1: URL parsing (/events/[event-id])
    // Method 2: Page elements (event title, dates)
    // Method 3: API call to get event details
    // Method 4: Local storage/session data
}
```

### 2.3 Upload Button Override
```javascript
// Find and override upload buttons
function overrideUploadButtons() {
    const uploadButtons = document.querySelectorAll('[data-upload], .upload-btn');
    uploadButtons.forEach(button => {
        button.addEventListener('click', handleEventUpload);
    });
}

async function handleEventUpload(event) {
    event.preventDefault();
    
    if (isNativeApp()) {
        // Show EventPhotoPicker
        const result = await window.EventPhotoPickerApp.openPhotoPicker(eventData);
        // Process selected photos
    } else {
        // Fallback to normal upload
    }
}
```

## Phase 3: Deployment Strategy 📦

### 3.1 App Deployment
1. Clean build with simplified integration
2. Test core functionality
3. Deploy to TestFlight/App Store

### 3.2 Website Deployment
1. Create standalone integration script
2. Add script tag to photo-share.app
3. Test in both native app and browser
4. Gradual rollout with feature flags

### 3.3 Testing Matrix
| Platform | Upload Method | Expected Behavior |
|----------|---------------|-------------------|
| iOS App | Event Upload | EventPhotoPicker opens |
| iOS App | Regular Upload | EventPhotoPicker opens |
| Web Browser | Event Upload | Normal camera picker |
| Web Browser | Regular Upload | Normal camera picker |

## Phase 4: Advanced Features 🚀

### 4.1 Real Event Data Integration
- Connect to Supabase API
- Extract event start/end times with timezone
- Filter photos by event date range
- Track upload status

### 4.2 Multi-Event Support
- Detect multiple concurrent events
- Show event selection dialog
- Per-event photo filtering

### 4.3 Performance Optimization
- Photo thumbnail caching
- Background photo analysis
- Upload queue management

## Implementation Priority 🎯

**Week 1:**
1. ✅ Clean app integration (Phase 1)
2. ✅ Basic website script (Phase 2.1)
3. ✅ Manual testing

**Week 2:**
1. ✅ Event data detection (Phase 2.2)
2. ✅ Upload button override (Phase 2.3)
3. ✅ Cross-platform testing

**Week 3:**
1. ✅ Production deployment (Phase 3)
2. ✅ User acceptance testing
3. ✅ Bug fixes and optimization

## Files to Create/Update 📁

**App Files:**
- `www/eventPhotoPicker.js` (new, consolidated)
- `www/index.html` (update script tags)
- Remove: diagnostic scripts, test scripts

**Website Files:**
- ` ` (deploy to website)
- Update photo-share.app to include script

**Documentation:**
- Integration testing guide
- Deployment checklist
- Troubleshooting guide

## Success Criteria ✅

1. **Functional:** EventPhotoPicker opens from upload buttons
2. **Reliable:** Works consistently across app restarts
3. **Integrated:** Extracts real event data from website
4. **Fallback:** Graceful degradation in web browser
5. **Performant:** Fast photo loading and filtering
6. **User-friendly:** Clear event information display

---

This plan focuses on simplification and reliability rather than complex diagnostics. The goal is a production-ready integration that "just works" for users.
