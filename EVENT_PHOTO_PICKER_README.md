# 📸 Event Photo Picker - Custom Capacitor Plugin

**A powerful, event-aware photo picker that shows only photos taken during specific date ranges with upload status tracking.**

## 🎯 **Key Features**

### **Smart Filtering**
✅ **Date Range Filtering** - Only shows photos taken between event start/end dates  
✅ **Upload Status Tracking** - Visually distinguishes uploaded vs pending photos  
✅ **Multi-Selection Support** - Select one or multiple photos with batch operations  
✅ **Video-Ready Architecture** - Designed to support videos in future updates  

### **User Experience**
✅ **Native iOS Interface** - Familiar photo grid with custom event logic  
✅ **Upload Indicators** - Uploaded photos are dimmed with "✓ Uploaded" overlay  
✅ **Selection States** - Clear visual feedback for selected photos  
✅ **Batch Operations** - "Select All" and "Upload (count)" buttons  

### **Developer Integration**
✅ **Simple API** - Easy integration with existing upload systems  
✅ **Event Detection** - Auto-detects event info from URL/context  
✅ **Photo Processing** - Returns photos with base64 data ready for upload  
✅ **Error Handling** - Graceful permission and cancellation handling  

## 🏗️ **Architecture**

### **Native iOS Plugin**
- **`EventPhotoPicker.swift`** - Main plugin with PHPhotoLibrary integration
- **`EventPhotoPicker.m`** - Capacitor plugin definition
- **`EventPhotoPickerViewController`** - Custom photo picker UI
- **`EventPhotoCell`** - Custom collection view cells with upload status

### **JavaScript Interface**
- **`event-photo-picker.js`** - Main service interface
- **`event-photo-picker-demo.js`** - Testing and demo functionality

## 📱 **Native Plugin API**

### **openEventPhotoPicker**
Opens the custom photo picker with event filtering and upload status.

```swift
// Parameters:
startDate: String (ISO8601)     // Event start date
endDate: String (ISO8601)       // Event end date  
eventId: String                 // Event identifier
uploadedPhotoIds: [String]      // Already uploaded photo IDs
allowMultipleSelection: Bool    // Enable multi-select (default: true)
title: String                   // Picker title (default: "Select Event Photos")

// Returns:
{
  photos: [PhotoData],          // Selected photos with base64 data
  count: Int                    // Number of selected photos
}
```

### **getEventPhotosMetadata**
Gets photo metadata without opening the picker.

```swift
// Parameters:
startDate: String (ISO8601)     // Event start date
endDate: String (ISO8601)       // Event end date
uploadedPhotoIds: [String]      // Already uploaded photo IDs

// Returns:
{
  photos: [PhotoMetadata],      // Photo metadata without base64
  totalCount: Int,              // Total photos in date range
  uploadedCount: Int,           // Number of uploaded photos
  pendingCount: Int             // Number of pending photos
}
```

## 🌐 **JavaScript API**

### **Basic Usage**

```javascript
// Open picker for specific event
const result = await EventPhotoPicker.openEventPhotoPicker({
    eventId: 'bd1935c5-b9ad-4aad-96d7-96f3db0e551c',
    startDate: '2025-08-14T10:00:00Z',
    endDate: '2025-08-14T18:00:00Z',
    uploadedPhotoIds: ['photo-id-1', 'photo-id-2'],
    allowMultipleSelection: true,
    title: 'Select Wedding Photos'
});

console.log(`Selected ${result.count} photos`);
result.photos.forEach(photo => {
    console.log(`Photo: ${photo.localIdentifier}`);
    // Upload photo.base64 to your backend
});
```

### **Quick Current Event Picker**

```javascript
// Auto-detects event from current page
const result = await EventPhotoPicker.openPickerForCurrentEvent(
    uploadedPhotoIds = [],
    { allowMultipleSelection: true }
);
```

### **Get Photos Metadata**

```javascript
// Check photos without opening picker
const metadata = await EventPhotoPicker.getEventPhotosMetadata({
    startDate: '2025-08-14T10:00:00Z',
    endDate: '2025-08-14T18:00:00Z',
    uploadedPhotoIds: ['photo-id-1']
});

console.log(`Found ${metadata.totalCount} photos`);
console.log(`${metadata.uploadedCount} uploaded, ${metadata.pendingCount} pending`);
```

### **Create UI Button**

```javascript
// Create a styled picker button
const button = EventPhotoPicker.createPickerButton({
    text: '📸 Select Event Photos',
    uploadedPhotoIds: [],
    onclick: async () => {
        const result = await EventPhotoPicker.openPickerForCurrentEvent();
        console.log('Photos selected:', result);
    }
});

// Add to page
document.body.appendChild(button);
```

## 🎨 **User Interface**

### **Photo Grid**
- **3-column responsive grid** with square thumbnails
- **Creation date sorting** (newest first)
- **Smooth scrolling** with efficient memory management

### **Upload Status Indicators**
- **Normal Photos**: Full opacity, selectable
- **Uploaded Photos**: 50% opacity, "✓ Uploaded" overlay, not selectable
- **Selected Photos**: Blue overlay with checkmark in top-right

### **Navigation Bar**
- **Left**: Cancel button
- **Title**: Customizable picker title
- **Right**: "Upload (count)" button (multi-select) or "Done" (single-select)
- **Additional**: "Select All" / "Deselect All" toggle

### **Batch Operations**
- **Select All**: Selects all non-uploaded photos
- **Deselect All**: Clears all selections
- **Upload Button**: Shows count and enables when photos selected

## 🔧 **Setup & Integration**

### **1. Add Native Files to Xcode**
```bash
# Files to add to Xcode project:
ios/App/App/EventPhotoPicker.swift
ios/App/App/EventPhotoPicker.m
```

### **2. Include JavaScript Files**
```html
<!-- Add to photo-share.app -->
<script src="/js/event-photo-picker.js"></script>
<script src="/js/event-photo-picker-demo.js"></script>
```

### **3. Build & Test**
```bash
# Run build script
./build-ios-with-automation.sh

# Test in console
demoEventPhotoPicker()
```

## 🧪 **Testing**

### **Demo Interface**
```javascript
// Show interactive demo
demoEventPhotoPicker()

// Test with current event
testEventPhotoPicker()

// Test date range filtering
testPhotoDateRange(7) // Last 7 days
```

### **Demo Features**
- **Plugin availability check**
- **Interactive picker testing**
- **Metadata retrieval demo**
- **Button creation example**
- **Upload status simulation**

## 📊 **Photo Data Structure**

### **Selected Photo Object**
```javascript
{
  localIdentifier: "ABC123-DEF456",     // iOS photo identifier
  creationDate: 1692025200,            // Unix timestamp
  modificationDate: 1692025300,        // Unix timestamp
  width: 4032,                         // Photo width in pixels
  height: 3024,                        // Photo height in pixels
  base64: "data:image/jpeg;base64,/9j/4...", // Base64 image data
  mimeType: "image/jpeg",              // MIME type
  isUploaded: false,                   // Upload status
  location: {                          // GPS location (if available)
    latitude: 37.7749,
    longitude: -122.4194
  }
}
```

### **Metadata Object**
```javascript
{
  photos: [                            // Array of photo metadata
    {
      localIdentifier: "ABC123-DEF456",
      creationDate: 1692025200,
      width: 4032,
      height: 3024,
      isUploaded: false
    }
  ],
  totalCount: 25,                      // Total photos in date range
  uploadedCount: 10,                   // Already uploaded
  pendingCount: 15                     // Pending upload
}
```

## 🔮 **Future Video Support**

The plugin is architected to easily support videos:

### **Planned Enhancements**
- **Video Filtering**: `PHAssetMediaType.video` support
- **Video Thumbnails**: Preview frames in grid
- **Video Upload**: Base64 or file path export
- **Duration Display**: Video length indicators
- **Size Limits**: Configurable video size limits

### **API Expansion**
```javascript
// Future video API
const result = await EventPhotoPicker.openEventMediaPicker({
    mediaTypes: ['photo', 'video'],    // Media type selection
    videoMaxDuration: 300,             // 5 minute limit
    videoQuality: 'medium'             // Compression level
});
```

## 🚀 **Integration Examples**

### **With Auto-Upload System**
```javascript
// Auto-integrate with existing upload system
window.addEventListener('eventPhotosSelected', async (event) => {
    const photos = event.detail.photos;
    const eventId = EventPhotoPicker.detectCurrentEventInfo().eventId;
    
    // Queue photos for upload
    for (const photo of photos) {
        await PhotoShareAutoUpload.uploadService.queuePhotoUpload(photo, eventId);
    }
});
```

### **With Upload Progress**
```javascript
async function uploadSelectedPhotos() {
    const result = await EventPhotoPicker.openPickerForCurrentEvent();
    
    for (let i = 0; i < result.photos.length; i++) {
        const photo = result.photos[i];
        
        // Show progress
        console.log(`Uploading ${i + 1}/${result.photos.length}: ${photo.localIdentifier}`);
        
        // Upload photo
        await uploadToBackend(photo);
        
        // Mark as uploaded for next picker session
        uploadedPhotoIds.push(photo.localIdentifier);
    }
}
```

### **Event Detection**
```javascript
// Auto-detect event info from page context
function detectEventInfo() {
    // From URL
    const urlMatch = window.location.pathname.match(/\/event\/([a-f0-9-]+)/);
    const eventId = urlMatch?.[1];
    
    // From global state
    const startDate = window.eventData?.startDate;
    const endDate = window.eventData?.endDate;
    
    return { eventId, startDate, endDate };
}
```

## 📋 **Error Handling**

### **Common Errors**
- **`Photo library permission denied`** - User denied photo access
- **`Missing required parameters`** - Invalid startDate/endDate/eventId  
- **`User cancelled photo selection`** - User tapped Cancel
- **`Plugin not available`** - Native plugin not built/loaded

### **Permission Handling**
```javascript
try {
    const result = await EventPhotoPicker.openEventPhotoPicker(options);
} catch (error) {
    if (error.message.includes('permission')) {
        alert('Please enable photo library access in Settings > Privacy > Photos');
    } else if (error.message === 'cancelled') {
        console.log('User cancelled selection');
    } else {
        console.error('Picker error:', error);
    }
}
```

## 🎯 **Performance Considerations**

### **Memory Management**
- **Efficient image loading** with `PHImageManager` caching
- **Thumbnail generation** for grid display (200x200px)
- **Full resolution** only for selected photos
- **Request cancellation** when cells are reused

### **Large Photo Libraries**
- **Date range filtering** reduces memory footprint
- **Lazy loading** of photo thumbnails
- **Background processing** for metadata retrieval
- **Chunked processing** for large selections

### **Battery Optimization**
- **Minimal background processing** during picker display
- **Efficient photo enumeration** with `PHFetchOptions`
- **Memory cleanup** on picker dismissal

## ✅ **Completed Features**

✅ **Native iOS photo picker** with custom UI  
✅ **Date range filtering** for event-specific photos  
✅ **Upload status tracking** with visual indicators  
✅ **Multi-selection interface** with batch operations  
✅ **JavaScript API** with simple integration  
✅ **Auto event detection** from URL/context  
✅ **Demo interface** for testing  
✅ **Error handling** and permission management  
✅ **Memory efficient** photo loading  
✅ **Video-ready architecture** for future expansion  

The Event Photo Picker provides a complete solution for event-specific photo selection with upload awareness, offering both powerful functionality and excellent user experience! 📸✨