# Background Uploads Implementation for PhotoShare iOS App

## Executive Summary

This document outlines the implementation requirements for adding background upload capabilities to the PhotoShare iOS app using Capacitor 7.4.3. Currently, the app uses foreground uploads that require the user to keep the app open during the upload process. Background uploads would allow users to start uploads and leave the app while the system continues uploading in the background.

## Current Implementation Analysis

### Existing Upload Architecture

**EventPhotoPicker Plugin** (`EventPhotoPicker.swift`):
- ✅ **Current Capabilities**: Full upload implementation with photo selection, JWT token management, and sequential upload processing
- ✅ **File Handling**: Converts photos to base64, builds multipart form data, handles upload progress
- ✅ **Error Handling**: Comprehensive error handling with retry logic and user feedback
- ✅ **API Integration**: Direct integration with Supabase Functions endpoint (`/functions/v1/mobile-upload`)
- ❌ **Limitation**: Uses `URLSession.shared.dataTask` - stops when app backgrounds

**UploadManager Plugin** (`UploadManager.swift`):
- ❌ **Current State**: Minimal test plugin with only basic method stubs
- ❌ **Missing Functionality**: No actual upload implementation

### Web Layer Integration

**Current Web Methods**:
1. `useCameraPicture.ts` → `Camera.getPhoto()` (camera capture)
2. `useRegularPhotoPicker.ts` → `Camera.getPhoto()` (gallery selection)
3. `useEventPhotoPicker.ts` → `EventPhotoPickerIntegration.openPhotoPicker()` (event upload)

## Background Upload Requirements for iOS

### iOS System Requirements

**URLSession Background Configuration**:
```swift
let config = URLSessionConfiguration.background(withIdentifier: "com.photoshare.background-uploads")
config.sessionSendsLaunchEvents = true
config.isDiscretionary = false
config.timeoutIntervalForResource = 7 * 24 * 60 * 60 // 7 days
```

**Key iOS Limitations**:
- Background uploads **only work with file-based uploads** (`uploadTask(with:fromFile:)`)
- Cannot use data-based uploads (`uploadTask(with:from:)`) - they fail when app backgrounds
- Must use delegate-based API, completion handler blocks are not supported
- Requires proper AppDelegate integration for session restoration

### Required iOS Delegate Methods

**AppDelegate Integration**:
```swift
func application(_ application: UIApplication, 
                handleEventsForBackgroundURLSession identifier: String, 
                completionHandler: @escaping () -> Void) {
    backgroundSessionCompletionHandler = completionHandler
    // Recreate background session with same identifier
}
```

**URLSession Delegate Methods**:
```swift
func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?)
func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data)
func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession)
```

## Implementation Plan

### Phase 1: Enhanced UploadManager Plugin

**Upgrade UploadManager.swift** to handle background uploads:

```swift
@objc(UploadManager)
public class UploadManager: CAPPlugin, CAPBridgedPlugin {
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startBackgroundUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUploadStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelUpload", returnType: CAPPluginReturnPromise)
    ]
    
    private var backgroundSession: URLSession!
    private var activeUploads: [String: UploadTask] = [:]
}
```

**Core Background Upload Logic**:
1. **File Preparation**: Save base64 photo data to temporary files
2. **Session Management**: Create persistent background URLSession
3. **Task Tracking**: Maintain upload state across app lifecycle
4. **Progress Reporting**: Bridge progress updates to JavaScript layer
5. **Completion Handling**: Process upload results when app resumes

### Phase 2: AppDelegate Integration

**Update AppDelegate.swift**:
```swift
class AppDelegate: UIResponder, UIApplicationDelegate {
    var backgroundSessionCompletionHandler: (() -> Void)?
    
    func application(_ application: UIApplication, 
                    handleEventsForBackgroundURLSession identifier: String, 
                    completionHandler: @escaping () -> Void) {
        backgroundSessionCompletionHandler = completionHandler
        
        // Notify UploadManager to recreate session
        NotificationCenter.default.post(
            name: NSNotification.Name("RestoreBackgroundSession"), 
            object: identifier
        )
    }
}
```

### Phase 3: Multipart Form Data Challenge

**Current Issue**: Capacitor's CapacitorHttp plugin has known limitations with multipart/form-data uploads:
- GitHub Issue #6142: "Support multipart/form-data (FormData)"
- GitHub Issue #7498: "CapacitorHttp plugin is not accepting Formdata for image upload"

**Proposed Solution**: 
- Implement native multipart form data construction in Swift
- Use `AFMultipartFormData` pattern or manual boundary construction
- Save constructed multipart data to temporary files for background upload

**Implementation Example**:
```swift
private func createMultipartFormData(photo: EventPhoto, base64Data: String) -> URL? {
    let boundary = "Boundary-\(UUID().uuidString)"
    var data = Data()
    
    // Add form fields
    data.append("--\(boundary)\r\n".data(using: .utf8)!)
    data.append("Content-Disposition: form-data; name=\"eventId\"\r\n\r\n".data(using: .utf8)!)
    data.append("\(eventId)\r\n".data(using: .utf8)!)
    
    // Add file data
    data.append("--\(boundary)\r\n".data(using: .utf8)!)
    data.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(photo.filename)\"\r\n".data(using: .utf8)!)
    data.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    
    if let imageData = Data(base64Encoded: base64Data) {
        data.append(imageData)
    }
    
    data.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
    
    // Save to temporary file
    let tempURL = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString)
        .appendingPathExtension("multipart")
    
    try? data.write(to: tempURL)
    return tempURL
}
```

### Phase 4: Web Layer Updates

**New Web Service** (`useBackgroundUpload.ts`):
```typescript
interface BackgroundUploadOptions {
  photos: PhotoFile[]
  eventId: string
  onProgress?: (progress: UploadProgress) => void
  onComplete?: (results: UploadResults) => void
}

export const useBackgroundUpload = () => {
  const startBackgroundUpload = async (options: BackgroundUploadOptions) => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback to foreground upload on web
      return useEventPhotoPicker().uploadPhotos(options.photos)
    }
    
    return await CapacitorPlugins.UploadManager.startBackgroundUpload({
      photos: options.photos,
      eventId: options.eventId
    })
  }
  
  const getUploadStatus = async () => {
    return await CapacitorPlugins.UploadManager.getUploadStatus()
  }
  
  return {
    startBackgroundUpload,
    getUploadStatus,
    pauseUpload: () => CapacitorPlugins.UploadManager.pauseUpload(),
    resumeUpload: () => CapacitorPlugins.UploadManager.resumeUpload(),
    cancelUpload: () => CapacitorPlugins.UploadManager.cancelUpload()
  }
}
```

## Technical Challenges & Solutions

### Challenge 1: File-Based Upload Requirement

**Problem**: iOS background uploads require file references, not data objects
**Solution**: 
- Convert base64 photo data to temporary files before starting upload
- Implement cleanup mechanism to remove temporary files after upload completion
- Use `FileManager.default.temporaryDirectory` for temporary file storage

### Challenge 2: Multipart Form Data Construction

**Problem**: Standard Capacitor HTTP doesn't support multipart/form-data properly
**Solution**:
- Implement native Swift multipart form data builder
- Construct complete HTTP request body with proper boundaries
- Save multipart data to temporary file for background upload

### Challenge 3: Session Restoration

**Problem**: App may be terminated and relaunched during background uploads
**Solution**:
- Implement `handleEventsForBackgroundURLSession` in AppDelegate
- Recreate URLSession with same identifier when app resumes
- Maintain persistent upload state using UserDefaults or Core Data

### Challenge 4: Progress Reporting

**Problem**: Background tasks can't directly communicate with suspended app
**Solution**:
- Store progress updates in persistent storage
- Implement polling mechanism when app becomes active
- Use local notifications for major upload events (completion, errors)

### Challenge 5: Authentication Token Refresh

**Problem**: JWT tokens may expire during long background uploads
**Solution**:
- Implement token refresh logic in background task
- Store refresh token securely in Keychain
- Retry failed uploads with refreshed tokens

## Implementation Priority

### High Priority (MVP)
1. ✅ **File-based upload conversion** - Essential for background functionality
2. ✅ **Basic background URLSession setup** - Core requirement
3. ✅ **AppDelegate integration** - Required for session restoration
4. ✅ **Upload state persistence** - Prevent data loss

### Medium Priority
1. **Progress reporting to JavaScript** - User experience improvement
2. **Pause/Resume functionality** - User control
3. **Multiple concurrent uploads** - Performance optimization
4. **Local notification integration** - User awareness

### Low Priority
1. **Advanced retry logic** - Error resilience
2. **Upload queue management** - Complex scenarios
3. **Bandwidth throttling** - Network optimization
4. **Upload analytics** - Performance monitoring

## Development Timeline

**Week 1-2**: UploadManager plugin enhancement with basic background upload support
**Week 3**: AppDelegate integration and session restoration
**Week 4**: Multipart form data implementation and file handling
**Week 5**: Web layer integration and testing
**Week 6**: Error handling, progress reporting, and polish

## Conclusion

Implementing background uploads in the PhotoShare iOS app is technically feasible but requires significant native iOS development. The main challenges are:

1. **iOS System Constraints**: Background uploads must use file-based URLSession tasks
2. **Capacitor Limitations**: Standard HTTP plugin doesn't support multipart/form-data properly
3. **Architecture Complexity**: Requires AppDelegate integration and session management

The recommended approach is to enhance the existing UploadManager plugin with native iOS background upload capabilities while maintaining backward compatibility with the current EventPhotoPicker implementation for immediate foreground uploads.

**ROI Assessment**: High user value (can leave app during uploads) with moderate-high development complexity (2-3 weeks iOS native development + testing).