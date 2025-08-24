# Auto-Upload System for iOS

## Overview

This auto-upload system automatically monitors and uploads photos taken during live events to your Supabase CDN. The system runs in both foreground and background modes on iOS devices.

## Core Components

### 1. **AutoUploadManager** (`autoUploadManager.js`)
- Main orchestrator for auto-upload functionality
- Handles event checking, user authentication, and real-time subscriptions
- Manages active events and upload windows

### 2. **MediaMonitor** (`mediaMonitor.js`)
- Detects new photos created during event timeframes
- Integrates with iOS Photos framework to monitor photo library changes
- Filters photos by event upload windows

### 3. **UploadQueue** (`uploadQueue.js`)
- Manages upload queue with persistence and retry logic
- Handles SHA-256 hash generation for duplicate prevention
- Implements rate limiting and file validation

### 4. **BackgroundUploadService** (`backgroundUploadService.js`)
- Manages background upload tasks for iOS
- Handles iOS background execution limits and app state changes
- Processes uploads when app goes to background

### 5. **AutoUploadSystem** (`autoUpload.js`)
- Main integration interface that ties all components together
- Provides unified API for the remote website

## Quick Start

### Basic Integration

```javascript
import { initializeAutoUploadSystem, getAutoUploadConfig } from './autoUpload.js';

// Initialize the system
const initialized = await initializeAutoUploadSystem(supabaseClient, currentUser);

if (initialized) {
  console.log('✅ Auto-upload system ready');
  
  // Check configuration
  const config = getAutoUploadConfig();
  console.log('System config:', config);
}
```

### Demo Integration

```javascript
import { initializeDemo, runFullAutoUploadDemo } from './autoUploadDemo.js';

// Initialize demo
await initializeDemo(supabaseClient, currentUser);

// Run comprehensive demo
await runFullAutoUploadDemo();

// Or use individual demo functions
window.autoUploadDemo.showStatus();
window.autoUploadDemo.start();
```

## System Requirements

### iOS Configuration

**Info.plist** - Background modes enabled:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>background-app-refresh</string>
    <string>background-processing</string>
    <string>background-fetch</string>
</array>
```

**Permissions required:**
- Photo Library Access (`NSPhotoLibraryUsageDescription`)
- Camera Access (`NSCameraUsageDescription`)
- Background App Refresh (user-enabled in Settings)

### Required Capacitor Plugins

```json
{
  "@capacitor/app": "^7.0.2",
  "@capacitor/camera": "^7.0.2", 
  "@capacitor/device": "^7.0.2",
  "@capacitor/filesystem": "^7.1.4"
}
```

## API Reference

### Initialization

```javascript
// Initialize complete auto-upload system
await initializeAutoUploadSystem(supabaseClient, currentUser)

// Get system status
const status = getAutoUploadSystemStatus()

// Get system configuration  
const config = getAutoUploadConfig()
```

### Controls

```javascript
// Start/stop photo monitoring
await startAutoUploadMonitoring()
stopAutoUploadMonitoring()

// Enable/disable auto-upload
setAutoUploadEnabled(true)  // or false

// Trigger manual photo scan
await triggerManualPhotoScan()

// Retry failed uploads
await retryFailedAutoUploads()
```

### Status Monitoring

```javascript
// Get comprehensive status
const status = getAutoUploadSystemStatus()
console.log({
  activeEvents: status.summary.activeEvents,
  isMonitoring: status.system.isMonitoring,
  pendingUploads: status.summary.pendingUploads,
  completedUploads: status.summary.completedUploads,
  failedUploads: status.summary.failedUploads
})

// Get upload queue items
const pendingItems = getUploadQueueItems('pending')
const failedItems = getUploadQueueItems('failed')
```

## System Flow

1. **Initialization**: System checks permissions, loads active events, initializes upload queue
2. **Event Detection**: Real-time subscriptions monitor for live events with auto-upload enabled
3. **Photo Monitoring**: When events are active, system monitors device photos library for new images
4. **Photo Processing**: New photos during event windows are validated and added to upload queue
5. **Upload Processing**: Queue processor uploads photos to Supabase edge function with retry logic
6. **Background Handling**: When app backgrounds, system continues processing uploads within iOS limits

## Configuration

### Rate Limiting
- Default: 50 uploads per hour per user
- Server-side enforcement via Supabase edge function
- Client-side tracking prevents unnecessary requests

### File Limits
- Maximum file size: 50MB
- Supported formats: JPEG, PNG, GIF, WebP
- Photos only (video support planned for future)

### Background Processing
- iOS background execution time limit: ~30 seconds
- Maximum concurrent background uploads: 3
- Auto-retry failed uploads when app returns to foreground

## Troubleshooting

### Common Issues

**"Photo library permission not granted"**
- Ensure `NSPhotoLibraryUsageDescription` is set in Info.plist
- User must grant permission in iOS Settings > Privacy > Photos

**"No active events for photo monitoring"**
- User must be participant in a live event with auto-upload enabled
- Check event timeframes and `is_live` status

**"Background uploads not working"**
- Verify Background App Refresh is enabled in iOS Settings
- Check `UIBackgroundModes` in Info.plist
- iOS limits background execution time

**"Upload queue not processing"**
- Check network connectivity
- Verify Supabase authentication token is valid
- Check server-side rate limiting and quotas

### Debug Tools

```javascript
// Show comprehensive status
window.autoUploadDemo.showStatus()

// Show upload queue details  
window.autoUploadDemo.showQueue()

// Start live monitoring
window.autoUploadDemo.startLive(5000) // 5 second intervals

// Run full diagnostic
await window.autoUploadDemo.runFull()
```

### Log Monitoring

The system provides detailed console logging with emojis for easy filtering:

- 🚀 System initialization
- 📸 Photo detection and processing  
- 📤 Upload operations
- 🌙 Background processing
- 🔄 Real-time updates
- ❌ Errors and failures

## Backend Integration

### Required Database Schema

```sql
-- Event participants table with auto-upload settings
ALTER TABLE event_participants ADD COLUMN auto_upload_enabled BOOLEAN DEFAULT false;
ALTER TABLE event_participants ADD COLUMN auto_upload_start_time TIMESTAMP;
ALTER TABLE event_participants ADD COLUMN auto_upload_end_time TIMESTAMP;
```

### Required Edge Function

- **Function**: `mobile-upload`
- **Purpose**: Secure photo upload with validation
- **Features**: Rate limiting, duplicate detection, quota enforcement

### Webhook Support

- Database triggers on upload completion/failure
- Real-time status updates via Supabase subscriptions
- Retry logic with exponential backoff

## Performance Considerations

### Memory Management
- Upload queue persists to filesystem to survive app crashes
- Large photos processed in chunks to prevent memory issues
- Automatic cleanup of old completed uploads

### Battery Optimization  
- Smart scan intervals (30 seconds default)
- Background processing time limits
- Conditional monitoring based on active events

### Network Efficiency
- Base64 encoding for secure transfer
- SHA-256 hashing for duplicate prevention
- Batch processing capabilities
- Automatic retry with exponential backoff

## Future Enhancements

- Video upload support
- Push notification integration
- Advanced photo filtering (location, time ranges)
- Progressive upload (low quality first, then full resolution)
- Cloud-to-cloud transfer optimization
- Machine learning photo categorization

## Support

For issues or questions:
1. Check the debug tools and console logs
2. Verify system requirements and configuration
3. Test with the demo functions
4. Review the auto-upload.md documentation
5. Check Supabase function logs for server-side issues