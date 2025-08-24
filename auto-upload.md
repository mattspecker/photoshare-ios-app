# Auto-Upload Media Tool for iOS

## App Architecture Overview

### **Project Structure**
- **Type**: Capacitor 7 iOS application
- **Remote Website**: https://photo-share.app (loads as web content in Capacitor WebView)
- **Bundle ID**: `com.photoshare.photo-share`
- **App Name**: PhotoShare
- **Platform**: iOS with native plugin integration

### **Technology Stack**
- **Framework**: Capacitor 7.4.2 (CLI, Core, iOS)
- **Web Content**: Remote website served from https://photo-share.app
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Firebase Authentication + Supabase JWT
- **Storage**: Supabase Storage (event-photos bucket)
- **File Management**: Capacitor Camera Plugin + community plugins

### **Key Installed Plugins**
```json
"@capacitor-community/apple-sign-in": "^7.0.1",          // Apple authentication
"@capacitor-community/barcode-scanner": "^4.0.1",        // QR/barcode scanning  
"@capacitor-community/date-picker": "^7.0.0",            // Date selection
"@capacitor-firebase/app": "^7.3.0",                     // Firebase app
"@capacitor-firebase/authentication": "^7.3.0",          // Firebase auth (Google only)
"@capacitor/camera": "^7.0.2",                           // Camera + photo picker
"@capacitor/device": "^7.0.2",                           // Device info
"@capacitor/filesystem": "^7.1.4",                       // File system access
"firebase": "^11.10.0"                                   // Firebase SDK
```

### **Authentication Setup**
- **Google Sign In**: Via Firebase Authentication plugin (`google.com` provider)
- **Apple Sign In**: Via dedicated `@capacitor-community/apple-sign-in` plugin (NOT Firebase)
- **Nonce Security**: Implemented SHA-256 hashing for Apple auth security
- **Platform Detection**: Uses Device plugin to detect iOS vs web environment

### **Current Feature Set**
- **Photo Selection**: Single + multiple photo picker from device gallery
- **Camera Permissions**: Comprehensive permission handling with Settings redirect
- **Barcode Scanning**: QR code and barcode scanning functionality
- **Image Processing**: Base64 conversion, metadata extraction, CDN upload preparation
- **Platform Integration**: Native iOS capabilities with web content compatibility

### **File Structure**
```
/ios/App/App/
├── GoogleService-Info.plist          // Firebase configuration
├── Info.plist                        // iOS permissions and settings
├── App.entitlements                  // Apple Sign In capabilities
└── public/                           // Capacitor web assets
    ├── cameraPermissions.js          // Camera + photo picker + Apple auth
    ├── qrScanner.js                  // Barcode scanning functionality
    └── index.html                    // Entry point (loads remote website)
```

### **Permissions Configured**
- **Camera**: `NSCameraUsageDescription` - Photo taking capability
- **Photo Library**: `NSPhotoLibraryUsageDescription` - Gallery access
- **Photo Library Add**: `NSPhotoLibraryAddUsageDescription` - Saving photos
- **Apple Sign In**: `com.apple.developer.applesignin` - Apple authentication
- **Limited Photo Library**: `PHPhotoLibraryPreventAutomaticLimitedAccessAlert` - iOS 14+ privacy

### **Capacitor Configuration**
```json
{
  "appId": "com.photoshare.photo-share",
  "appName": "PhotoShare", 
  "webDir": "www",
  "server": {
    "url": "https://photo-share.app",
    "cleartext": false
  },
  "plugins": {
    "FirebaseAuthentication": {
      "providers": ["google.com"]     // Apple removed - uses dedicated plugin
    },
    "Camera": {
      "permissions": ["camera", "photos"]
    }
  }
}
```

### **Integration Pattern**
The app follows a **hybrid architecture**:
1. **Remote Website**: Main UI and business logic served from https://photo-share.app
2. **Native Plugins**: Camera, authentication, device features via Capacitor plugins
3. **JavaScript Bridge**: Functions in `www/cameraPermissions.js` expose native capabilities to remote website
4. **Platform Detection**: Uses `Device.getInfo()` and `Capacitor.isNativePlatform()` to detect iOS environment

## Auto-Upload Feature Overview
Automated photo upload system that monitors device photos and uploads content created during live events to CDN, with support for both foreground and background operation.

**Current Scope**: Photos only (videos will be added in future release)

## Web/DB/CDN Infrastructure (Implemented)

### Database Schema
- **Table**: `event_participants`
- **New Columns**:
  - `auto_upload_start_time` - Event auto-upload window start
  - `auto_upload_end_time` - Event auto-upload window end

### Database Functions (Available)
```sql
get_auto_upload_settings(user_id) - Get user's auto-upload configuration
update_auto_upload_settings(user_id, event_id, enabled) - Update auto-upload preferences  
is_auto_upload_active(user_id, event_id) - Check if auto-upload is currently active
```

### Secure Upload Endpoint
- **URL**: `/functions/mobile-upload` (Supabase Edge Function)
- **Features**:
  - Validates user authentication (Supabase JWT tokens)
  - Checks user permissions for event uploads
  - Accepts base64-encoded photos from mobile apps
  - Generates SHA-256 hashes for duplicate prevention
  - Stores files in Supabase storage buckets
  - Updates media database with metadata
  - Handles photos (video support planned for future)
  - Preserves original timestamps and device info

### Web Interface (Available)
- **AutoUploadSettings Component**: Event organizers can enable/disable auto-upload
- **useAutoUpload Hook**: Mobile integration functions
- **API Methods**:
  - `isAutoUploadActive(eventId)` - Check upload status
  - `uploadFile(fileData)` - Secure file upload
  - Batch upload functionality

## iOS Implementation Plan

### 1. Core Architecture

#### Components to Build:
- **AutoUploadManager**: Main service class
- **MediaMonitor**: Watches for new media
- **UploadQueue**: Manages upload queue and retries
- **BackgroundUploadService**: Handles background uploads
- **EventStateManager**: Tracks event status
- **PermissionHandler**: Manages photo library permissions

### 2. Required Capacitor Plugins & Dependencies

#### Existing (Available):
- `@capacitor/camera` - Photo library access ✅
- `@capacitor/device` - Device information ✅
- `@capacitor-firebase/authentication` - User authentication ✅

#### Additional Needed:
- **Background Tasks**: iOS background execution
- **Photo Library Monitoring**: Detect new media creation
- **HTTP Client**: Upload API communication
- **Persistent Storage**: Queue management
- **Notification System**: Upload status updates

### 3. Implementation Strategy

#### Phase 1: Core Infrastructure
1. **AutoUploadManager Service**
   - Event status checking (`isAutoUploadActive`)
   - User authentication validation
   - Settings management

2. **MediaMonitor Component**
   - Photo library permission handling
   - New photo detection during event timeframes (photos only)
   - Metadata extraction (creation time, location, device info)

3. **Upload Queue System**
   - File queuing with metadata
   - SHA-256 hash generation
   - Retry logic for failed uploads
   - Progress tracking

#### Phase 2: Background Operation
1. **Background Task Registration**
   - iOS Background App Refresh capability
   - Background processing time management
   - System resource optimization

2. **Upload Service**
   - HTTP client for Supabase edge function
   - Base64 encoding for file transfer
   - JWT token management
   - Error handling and logging

#### Phase 3: User Experience
1. **Settings Interface**
   - Auto-upload toggle per event
   - Upload status indicators
   - Manual sync options
   - Progress notifications

2. **Monitoring & Feedback**
   - Upload progress tracking
   - Success/failure notifications
   - Storage usage indicators
   - Network status awareness

### 4. iOS Specific Implementation Details

#### Background Capabilities Required:
```xml
<key>UIBackgroundModes</key>
<array>
    <string>background-app-refresh</string>
    <string>background-processing</string>
</array>
```

#### Permission Requirements:
- Photo Library Access (`NSPhotoLibraryUsageDescription`)
- Background App Refresh
- Network access for uploads

#### Technical Challenges to Address:
1. **iOS Background Execution Limits**
   - 30-second background execution limit
   - Background App Refresh dependency
   - System resource constraints

2. **Photo Library Monitoring**
   - PHPhotoLibrary change notifications
   - Filtering by creation date/time
   - Handling large photo files (focusing on photos only)

3. **Network Management**
   - WiFi vs cellular upload policies
   - Upload queue persistence across app launches
   - Retry strategies for network failures

### 5. Data Flow Architecture

```
[New Photo Created] 
    ↓
[MediaMonitor Detects Change]
    ↓
[Check if Auto-Upload Active] → API: isAutoUploadActive(eventId)
    ↓
[Add to Upload Queue if Active]
    ↓
[Generate SHA-256 Hash]
    ↓
[Convert to Base64 & Upload] → API: uploadFile(photoData)
    ↓
[Update Local Status & Notify User]
```

### 6. Required Information from Web/DB/CDN

#### API Endpoints Needed:
1. **Authentication**:
   - Supabase JWT token validation endpoint
   - Token refresh mechanism
   - User permission verification

2. **Event Management**:
   - Get user's active events with auto-upload enabled
   - Real-time event status updates (live/ended)
   - Event participant validation

3. **Upload Configuration**:
   - Maximum file size limits
   - Supported file formats
   - Upload rate limiting rules
   - Storage quota information

#### Database Queries Needed:
```sql
-- Get user's events with auto-upload enabled
SELECT event_id, auto_upload_start_time, auto_upload_end_time 
FROM event_participants 
WHERE user_id = ? AND auto_upload_enabled = true

-- Check if event is currently live and within upload window  
SELECT is_live, auto_upload_active 
FROM events e 
JOIN event_participants ep ON e.id = ep.event_id 
WHERE e.id = ? AND ep.user_id = ?
```

#### Upload Endpoint Specifications:
```typescript
POST /functions/mobile-upload
Headers: {
  'Authorization': 'Bearer <supabase_jwt_token>',
  'Content-Type': 'application/json'
}
Body: {
  event_id: string,
  file_data: string, // base64 encoded photo
  file_name: string,
  file_type: 'photo', // photos only for now
  mime_type: string, // e.g. 'image/jpeg', 'image/png'
  file_size: number,
  sha256_hash: string,
  created_at: timestamp,
  device_info: {
    platform: 'ios',
    model: string,
    os_version: string
  },
  location?: {
    latitude: number,
    longitude: number
  }
}
```

### 7. Performance Considerations

#### Optimization Strategies:
- **Batch Processing**: Upload multiple photos in batches
- **Progressive Upload**: Upload lower quality first, then full resolution
- **Smart Scheduling**: Upload during optimal network conditions
- **Storage Management**: Clean up uploaded photos locally
- **Memory Management**: Process large photo files in chunks

#### Monitoring Metrics:
- Upload success/failure rates
- Average upload time per photo
- Background task completion rates
- User engagement with auto-upload feature
- Storage space utilization

### 8. Implementation Timeline

#### Week 1: Core Infrastructure
- AutoUploadManager service
- MediaMonitor component
- Basic upload queue system

#### Week 2: Background Processing
- Background task implementation
- Upload service with API integration
- Error handling and retry logic

#### Week 3: User Interface
- Settings integration
- Progress indicators
- Notification system

#### Week 4: Testing & Optimization
- Background operation testing
- Performance optimization
- User experience refinement

## Next Steps

1. **Confirm API Specifications** - Validate upload endpoint format and authentication
2. **Set up Background Capabilities** - Configure iOS project for background execution
3. **Implement Core Services** - Start with AutoUploadManager and MediaMonitor
4. **Test Photo Library Integration** - Verify photo detection and filtering
5. **Develop Upload Pipeline** - Integrate with Supabase edge function

## Web/DB/CDN Team Responses ✅

1. **Rate Limiting**:
   - Current: No server-side rate limiting in mobile-upload endpoint
   - Client-side: Basic rate limiting utility (checkRateLimit - 5 attempts per 60s window)
   - Recommendation: Should implement server-side rate limiting per user/event

2. **File Size Limits**:
   - Maximum: 50MB per file (defined in validateFileUpload)
   - Types: Images (JPEG, PNG, GIF, WebP) - Photos only for now

3. **Storage Quotas**:
   - Current: No per-user or per-event storage limits implemented
   - Buckets: event-photos (public bucket)
   - Recommendation: Should implement quota tracking

4. **Real-time Updates**:
   - Current: No WebSocket/SSE endpoint implemented
   - Available: Supabase realtime subscriptions for event status changes
   - Recommendation: Implement realtime channel for event status updates

5. **Error Codes from mobile-upload**:
   - `401`: Missing/invalid authorization header or token
   - `400`: Missing required fields or invalid base64 data
   - `403`: Upload permissions denied or auto-upload not active
   - `500`: Storage upload failed, database insert failed, or internal server error
   - `200`: Success (includes duplicate file detection with `duplicate: true` flag)

6. **Webhook Support**:
   - Current: No webhook system implemented
   - Available: Could implement using Supabase Edge Functions with database triggers
   - Recommendation: Add webhook endpoints for upload completion/failure notifications

### Implementation Notes from Web Team:
- Duplicate detection uses SHA-256 file hashing
- Auto-upload requires user to be event participant with active auto-upload settings
- Files stored with unique paths: `{eventId}/{userId}/{timestamp}_{random}.{ext}`
- Metadata includes original filename, upload timestamp, and capture method

## 📋 **Recommendation for Webhook Support (Item 6)**

### **Best Option: Supabase Database Triggers + Edge Functions**

I recommend implementing webhooks using Supabase's database triggers combined with Edge Functions. Here's why this is the optimal approach:

#### **Benefits:**
1. **Real-time Response** - Triggers fire immediately when uploads complete/fail
2. **Reliable Delivery** - Database-level triggers ensure no missed events
3. **Scalable** - Leverages existing Supabase infrastructure
4. **Cost-effective** - No additional webhook infrastructure needed
5. **Flexible** - Can send notifications to multiple endpoints (iOS app, web dashboard, etc.)

#### **Implementation Approach:**
```sql
-- Database trigger function
CREATE OR REPLACE FUNCTION notify_upload_status()
RETURNS trigger AS $$
BEGIN
  -- Call Edge Function webhook
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/upload-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'event_type', TG_OP,
      'event_id', NEW.event_id,
      'user_id', NEW.user_id,
      'file_id', NEW.id,
      'status', NEW.upload_status,
      'timestamp', NOW()
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to media table
CREATE TRIGGER upload_status_webhook
  AFTER INSERT OR UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION notify_upload_status();
```

#### **Edge Function Webhook Handler:**
```typescript
// /functions/upload-webhook/index.ts
export default async function handler(req: Request) {
  const { event_type, event_id, user_id, file_id, status, timestamp } = await req.json();
  
  // Send push notification to iOS app
  await sendPushNotification(user_id, {
    title: 'Upload Complete',
    body: `Photo uploaded successfully to event ${event_id}`,
    data: { event_id, file_id, status }
  });
  
  // Log for analytics
  await logUploadEvent({ event_type, event_id, user_id, status, timestamp });
  
  return new Response('OK', { status: 200 });
}
```

#### **iOS Integration:**
- **Push Notifications**: Receive instant upload status updates
- **Background Processing**: Handle webhook notifications when app is backgrounded
- **Queue Management**: Update local upload queue status
- **User Feedback**: Show success/failure notifications

#### **Priority for iOS Auto-Upload:**
**High Priority** - Webhooks will significantly improve user experience by:
- Providing immediate feedback on upload status
- Allowing proper queue management and retry logic
- Enabling background status updates
- Reducing need for polling/status checking

### **Alternative Options Considered:**
1. **Polling-based status checks** - Less efficient, higher battery usage
2. **Third-party webhook services** - Additional cost and complexity
3. **Manual status tracking** - Unreliable, poor user experience

**Recommendation**: Implement the Supabase trigger + Edge Function approach for reliable, real-time upload status notifications.

### ✅ **UPDATE: Webhook Implementation COMPLETED**
**Status**: Web team has successfully implemented the complete database trigger + Edge Function webhook system with enhanced features.

## 🚀 **Implemented Backend Infrastructure**

### **1. Database Triggers & Functions:**
- **Upload Tracking**: Automatic tracking with rate limiting (50 uploads/hour per user)
- **Storage Quotas**: 1GB default per event (configurable per event)
- **Webhook Events**: Triggered on every upload completion/failure
- **File Management**: Automatic file size tracking and duplicate detection via SHA-256 hashing

### **2. Edge Functions Deployed:**
- **`webhook-processor`**: Processes pending webhooks with retry logic and exponential backoff
- **`realtime-event-updates`**: Sends real-time status updates to all event participants
- **`mobile-upload` (Enhanced)**: Now includes server-side rate limiting and quota checks

### **3. Real-time Updates System:**
- **Media Upload Events**: Trigger realtime broadcasts to all event participants
- **Upload Status Tracking**: Real-time webhook events for immediate status updates
- **Event Notifications**: Participants get notified of upload status changes via Supabase realtime

### **4. Rate Limiting & Quotas Enforcement:**
- **Server-side Rate Limiting**: Configurable per event (default: 50 uploads/hour/user)
- **Storage Quota Enforcement**: Configurable per event (default: 1GB/event)
- **Proper Error Responses**: 
  - `429` - Rate limit exceeded
  - `413` - Storage quota exceeded
  - Enhanced error messaging for iOS client

### **5. Webhook System Features:**
- **Automatic Creation**: Webhook records created on every upload attempt
- **Retry Logic**: Exponential backoff for failed webhook deliveries
- **Error Tracking**: Comprehensive logging and error tracking
- **Status Management**: Pending → Processing → Completed/Failed state tracking

## 📱 **iOS App Benefits from Backend Implementation:**

### **Real-time Capabilities:**
✅ **Upload Status Updates** - Immediate feedback via Supabase realtime subscriptions  
✅ **Rate Limit Notifications** - Know when approaching upload limits  
✅ **Quota Warnings** - Storage limit notifications before hitting caps  
✅ **Event Updates** - Real-time event status changes (live/ended)

### **Enhanced Error Handling:**
✅ **Specific Error Codes** - 429 (rate limit), 413 (quota), 403 (permissions)  
✅ **Retry Strategy** - Backend handles webhook retries automatically  
✅ **Duplicate Prevention** - SHA-256 hashing prevents duplicate uploads  
✅ **Upload Tracking** - Complete audit trail of all upload attempts

### **Performance & Reliability:**
✅ **Server-side Validation** - Rate limits and quotas enforced at API level  
✅ **Webhook Reliability** - Retry logic ensures status updates reach iOS app  
✅ **Real-time Efficiency** - No polling needed, push-based status updates  
✅ **Storage Management** - Automatic quota tracking and enforcement