# Auto-Upload Web Integration Guide

## Overview
The iOS app now supports intelligent automatic photo uploading with user preferences and WiFi-only options. Here's how to integrate it with your web application.

## Required User Settings (Web Side)

Your web app needs to store and manage these user preferences:

### 1. User Profile Settings
Add these fields to your user settings/preferences:

```json
{
  "autoUploadEnabled": false,        // Global auto-upload toggle
  "wifiOnlyUpload": false           // Only upload when on WiFi
}
```

### 2. Event-Specific Settings
For each PhotoShare event, track:

```json
{
  "eventId": "event_123",
  "autoUploadActive": false,        // Auto-upload enabled for this event
  "lastAutoUploadCheck": "2025-01-15T10:30:00Z"
}
```

## JavaScript API Integration

### 1. Update User Preferences
When user changes auto-upload settings in your web app:

```javascript
// User toggles auto-upload ON/OFF
async function updateAutoUploadSettings(enabled, wifiOnly) {
  try {
    await PhotoLibraryMonitor.updateAutoUploadSettings({
      userAutoUploadEnabled: enabled,
      wifiOnlyUpload: wifiOnly
    });
    
    console.log('✅ Auto-upload settings updated');
  } catch (error) {
    console.error('❌ Failed to update settings:', error);
  }
}

// Example usage
await updateAutoUploadSettings(true, true); // Enable with WiFi-only
await updateAutoUploadSettings(true, false); // Enable with any connection
await updateAutoUploadSettings(false, false); // Disable
```

### 2. Enable Auto-Upload for Event
When user joins/creates an event and wants auto-upload:

```javascript
async function enableEventAutoUpload(eventId) {
  try {
    // First check if user has auto-upload enabled globally
    const settings = await PhotoLibraryMonitor.getAutoUploadSettings();
    
    if (!settings.userAutoUploadEnabled) {
      // Show UI to ask user to enable auto-upload first
      showAutoUploadPrompt();
      return;
    }
    
    // Enable auto-upload for this specific event
    await PhotoLibraryMonitor.enableAutoUpload({
      eventId: eventId
    });
    
    console.log(`✅ Auto-upload enabled for event: ${eventId}`);
    
    // Update your database that this event has auto-upload active
    await updateEventAutoUploadStatus(eventId, true);
    
  } catch (error) {
    console.error('❌ Failed to enable auto-upload:', error);
  }
}
```

### 3. Disable Auto-Upload
When user leaves event or disables auto-upload:

```javascript
async function disableEventAutoUpload(eventId) {
  try {
    await PhotoLibraryMonitor.disableAutoUpload();
    
    console.log('✅ Auto-upload disabled');
    
    // Update your database
    await updateEventAutoUploadStatus(eventId, false);
    
  } catch (error) {
    console.error('❌ Failed to disable auto-upload:', error);
  }
}
```

### 4. Check Current Status
Get current auto-upload status and settings:

```javascript
async function getAutoUploadStatus() {
  try {
    const status = await PhotoLibraryMonitor.getMonitoringStatus();
    
    console.log('Auto-upload status:', {
      systemEnabled: status.autoUploadEnabled,      // Event-specific
      userEnabled: status.userAutoUploadEnabled,    // Global user setting
      wifiOnly: status.wifiOnlyUpload,
      currentEvent: status.currentEventId,
      uploading: status.uploadInProgress,
      pending: status.pendingUploads
    });
    
    return status;
  } catch (error) {
    console.error('❌ Failed to get status:', error);
  }
}
```

### 5. Check Network Status
Check if uploads can proceed based on network conditions:

```javascript
async function checkCanUpload() {
  try {
    const network = await PhotoLibraryMonitor.checkNetworkStatus();
    
    console.log('Network status:', {
      connected: network.isConnected,
      wifi: network.isWifi,
      cellular: network.isCellular,
      canUpload: network.canUpload  // Considers WiFi-only setting
    });
    
    return network.canUpload;
  } catch (error) {
    console.error('❌ Failed to check network:', error);
    return false;
  }
}
```

## Event Listeners

Listen for auto-upload events to update your UI:

```javascript
// Photo successfully auto-uploaded
PhotoLibraryMonitor.addListener('photoAutoUploaded', (data) => {
  if (data.success) {
    console.log(`✅ Auto-uploaded: ${data.photoId} to ${data.eventId}`);
    
    // Update your UI - photo count, progress, etc.
    updateEventPhotoCount(data.eventId);
    showToast('Photo auto-uploaded!');
  } else {
    console.log(`❌ Auto-upload failed: ${data.error}`);
    showToast('Auto-upload failed', 'error');
  }
});

// Upload batch completed
PhotoLibraryMonitor.addListener('autoUploadBatchCompleted', (data) => {
  console.log(`✅ Upload batch completed, ${data.pendingUploads} remaining`);
  
  // Update progress indicators
  updateUploadProgress(data.pendingUploads);
});

// Upload skipped due to WiFi-only setting
PhotoLibraryMonitor.addListener('autoUploadSkipped', (data) => {
  if (data.reason === 'wifiOnly') {
    console.log(`⏩ Skipped ${data.photoCount} photos - WiFi only mode`);
    
    // Show user notification
    showToast('Upload skipped - connect to WiFi to continue');
  }
});
```

## UI Integration Examples

### 1. Settings Page
```html
<div class="auto-upload-settings">
  <h3>Auto-Upload Settings</h3>
  
  <label>
    <input type="checkbox" id="autoUploadToggle">
    Enable automatic photo uploading
  </label>
  
  <label>
    <input type="checkbox" id="wifiOnlyToggle">
    Only upload when connected to WiFi
  </label>
  
  <div class="network-status">
    <span id="networkStatus">Checking network...</span>
  </div>
</div>

<script>
document.getElementById('autoUploadToggle').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  const wifiOnly = document.getElementById('wifiOnlyToggle').checked;
  
  await updateAutoUploadSettings(enabled, wifiOnly);
  
  // Save to your user profile
  await saveUserSetting('autoUploadEnabled', enabled);
});

document.getElementById('wifiOnlyToggle').addEventListener('change', async (e) => {
  const wifiOnly = e.target.checked;
  const enabled = document.getElementById('autoUploadToggle').checked;
  
  await updateAutoUploadSettings(enabled, wifiOnly);
  
  // Save to your user profile
  await saveUserSetting('wifiOnlyUpload', wifiOnly);
});
</script>
```

### 2. Event Page
```html
<div class="event-auto-upload">
  <button id="toggleEventAutoUpload" class="btn">
    Enable Auto-Upload for This Event
  </button>
  
  <div id="autoUploadStatus" class="hidden">
    <span class="status-indicator">🔄</span>
    Auto-upload active - new photos will be uploaded automatically
  </div>
</div>

<script>
document.getElementById('toggleEventAutoUpload').addEventListener('click', async () => {
  const eventId = getCurrentEventId();
  const button = document.getElementById('toggleEventAutoUpload');
  
  if (button.textContent.includes('Enable')) {
    await enableEventAutoUpload(eventId);
    button.textContent = 'Disable Auto-Upload';
    document.getElementById('autoUploadStatus').classList.remove('hidden');
  } else {
    await disableEventAutoUpload(eventId);
    button.textContent = 'Enable Auto-Upload for This Event';
    document.getElementById('autoUploadStatus').classList.add('hidden');
  }
});
</script>
```

## Backend Integration

### 1. User Settings API
Add endpoints to save/retrieve user auto-upload preferences:

```javascript
// GET /api/user/auto-upload-settings
// Response:
{
  "autoUploadEnabled": true,
  "wifiOnlyUpload": false
}

// POST /api/user/auto-upload-settings
// Request:
{
  "autoUploadEnabled": true,
  "wifiOnlyUpload": true
}
```

### 2. Event Auto-Upload Tracking
Track which events have auto-upload enabled:

```javascript
// POST /api/events/:eventId/auto-upload
// Request:
{
  "enabled": true
}

// GET /api/events/:eventId/auto-upload
// Response:
{
  "eventId": "event_123",
  "autoUploadEnabled": true,
  "enabledAt": "2025-01-15T10:30:00Z"
}
```

## Initialization Flow

When your app loads, initialize the auto-upload system:

```javascript
async function initializeAutoUpload() {
  try {
    // 1. Load user preferences from your database
    const userSettings = await fetchUserSettings();
    
    // 2. Update iOS app with user preferences
    await PhotoLibraryMonitor.updateAutoUploadSettings({
      userAutoUploadEnabled: userSettings.autoUploadEnabled || false,
      wifiOnlyUpload: userSettings.wifiOnlyUpload || false
    });
    
    // 3. Check if user is currently in an event with auto-upload
    const currentEvent = getCurrentEvent();
    if (currentEvent && currentEvent.autoUploadEnabled) {
      await PhotoLibraryMonitor.enableAutoUpload({
        eventId: currentEvent.id
      });
    }
    
    // 4. Set up event listeners
    setupAutoUploadListeners();
    
    console.log('✅ Auto-upload system initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize auto-upload:', error);
  }
}

// Call this when your app starts
initializeAutoUpload();
```

## Error Handling

Handle common error scenarios:

```javascript
async function handleAutoUploadError(error) {
  switch (error.message) {
    case 'Photo library permission denied':
      showPermissionDialog('Photo library access is required for auto-upload');
      break;
      
    case 'No JWT token available':
      // Re-authenticate user
      await refreshAuthToken();
      break;
      
    case 'Auto-upload not enabled or no event set':
      // User needs to enable auto-upload first
      showAutoUploadSetupDialog();
      break;
      
    default:
      console.error('Auto-upload error:', error);
      showToast('Auto-upload error occurred', 'error');
  }
}
```

## Testing

Test the integration:

1. **Enable auto-upload** in settings
2. **Join an event** and enable event auto-upload  
3. **Take a photo** - should auto-upload
4. **Switch to cellular** - should respect WiFi-only setting
5. **Background the app** - should continue uploading
6. **Check event photos** - should see auto-uploaded photos

## Summary

The web side needs to:
1. **Store user preferences** (autoUploadEnabled, wifiOnlyUpload)
2. **Call iOS APIs** to sync settings
3. **Listen for events** to update UI
4. **Handle event lifecycle** (enable/disable per event)
5. **Provide user controls** for managing auto-upload

The iOS app handles all the complex parts:
- Photo monitoring
- Duplicate detection  
- Background uploading
- Network checking
- Queue management