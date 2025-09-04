# PhotoEditorPlugin Implementation for PhotoShare iOS App

## Overview

The PhotoEditorPlugin is a custom Capacitor plugin designed to add photo editing capabilities (text, stickers, drawing) to photos captured via `Camera.getPhoto()` in the PhotoShare iOS app. This plugin provides a native iOS photo editing interface that can be called after camera capture.

## Current Implementation Status

### ✅ Completed
- **Plugin Structure**: Basic PhotoEditorPlugin.swift file created with CAPBridgedPlugin protocol
- **Plugin Registration**: Added "PhotoEditorPlugin" to packageClassList in capacitor.config.json
- **Method Definitions**: Implemented `editPhoto` and `isAvailable` methods
- **Verification Dialog**: Created basic UI dialog to confirm plugin loading

### 🔄 In Progress
- **Web Integration**: Need to create JavaScript layer to call plugin after Camera.getPhoto()

### ⏳ Pending
- **Actual Photo Editing**: Implement text overlay, stickers, drawing functionality
- **File Handling**: Proper image loading and saving mechanisms
- **UI Implementation**: Native photo editing interface

## Plugin Architecture

### Swift Implementation (`PhotoEditorPlugin.swift`)

```swift
@objc(PhotoEditorPlugin)
public class PhotoEditorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoEditorPlugin"
    public let jsName = "PhotoEditorPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "editPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func editPhoto(_ call: CAPPluginCall) {
        let imagePath = call.getString("imagePath") ?? "No path provided"
        DispatchQueue.main.async { [weak self] in
            self?.showPhotoEditorDialog(call: call, imagePath: imagePath)
        }
    }
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": true,
            "platform": "iOS",
            "version": "1.0.0",
            "features": ["text_overlay", "stickers", "drawing", "filters"]
        ])
    }
}
```

### Current Verification Flow

1. **Plugin Loading**: PhotoEditorPlugin loads automatically with other Capacitor plugins
2. **Method Call**: `editPhoto({ imagePath: "path" })` can be called from JavaScript
3. **Verification Dialog**: Shows alert confirming plugin is working with image path
4. **User Interaction**: Two options - "Continue to Edit" or "Cancel"
5. **Response**: Returns success/failure status to JavaScript layer

### Plugin Registration

**File**: `capacitor.config.json`
```json
{
  "packageClassList": [
    "SignInWithApple",
    "CameraPreview", 
    "DatePickerPlugin",
    "PhotoViewerPlugin",
    "FirebaseAppPlugin",
    "FirebaseAuthenticationPlugin",
    "FirebaseMessagingPlugin",
    "AppPlugin",
    "DevicePlugin", 
    "DialogPlugin",
    "FilesystemPlugin",
    "HapticsPlugin",
    "KeyboardPlugin",
    "PreferencesPlugin",
    "PushNotificationsPlugin",
    "StatusBarPlugin",
    "EventPhotoPicker",
    "UploadManager",
    "PhotoLibraryMonitor",
    "QRScanner",
    "AppPermissionPlugin",
    "PhotoEditorPlugin"  // ← Added
  ]
}
```

## Integration Workflow

### Current Camera Flow
1. User opens app
2. Calls `Camera.getPhoto()` (standard Capacitor Camera plugin)
3. Photo is captured/selected
4. Photo data returned to JavaScript

### Planned PhotoEditor Integration
1. User opens app
2. Calls `Camera.getPhoto()` 
3. Photo is captured/selected
4. **→ Call `PhotoEditorPlugin.editPhoto({ imagePath: photoPath })`**
5. **→ Native photo editing interface opens**
6. **→ User adds text/stickers/drawing**
7. **→ Edited photo saved and returned**
8. Continue with existing upload flow

## Web Layer Integration (TODO)

### Proposed JavaScript Integration

```javascript
// After Camera.getPhoto() succeeds
const photo = await Camera.getPhoto({
  quality: 90,
  allowEditing: false,
  resultType: CameraResultType.Uri,
  source: CameraSource.Camera
});

// Launch photo editor
const editResult = await CapacitorPlugins.PhotoEditorPlugin.editPhoto({
  imagePath: photo.webPath
});

if (editResult.success) {
  // Use editResult.editedPath for upload
  console.log('Photo edited:', editResult.editedPath);
} else {
  // Use original photo
  console.log('Photo editing cancelled');
}
```

### Integration Points

**Existing Files to Modify**:
- `useCameraPicture.ts` - Add photo editing after camera capture
- `useRegularPhotoPicker.ts` - Add photo editing after gallery selection

**New Files to Create**:
- `usePhotoEditor.ts` - Photo editor service wrapper
- Photo editor UI components (if needed)

## Technical Requirements

### iOS Native Features to Implement

1. **Text Overlay**
   - Core Text/TextKit for text rendering
   - Font selection, size, color controls
   - Text positioning and rotation

2. **Stickers/Overlays**
   - Image overlay rendering
   - Predefined sticker library
   - Custom sticker positioning/scaling

3. **Drawing Tools**
   - PencilKit integration for drawing
   - Brush size and color selection
   - Undo/redo functionality

4. **Image Processing**
   - Core Graphics for image manipulation
   - File I/O for saving edited images
   - Image format conversion (JPEG/PNG)

### Memory Management Considerations

- Proper image loading/unloading for large photos
- Efficient Core Graphics context handling
- Background queue for image processing
- Memory pressure handling for photo editing operations

## Development Timeline

### Phase 1: Basic Integration (1-2 days)
- [ ] Create web layer integration
- [ ] Test plugin calling from Camera.getPhoto()
- [ ] Verify dialog shows with actual image path

### Phase 2: Text Overlay (3-4 days)
- [ ] Implement text adding functionality
- [ ] Text positioning and styling controls
- [ ] Save image with text overlay

### Phase 3: Drawing Tools (3-4 days) 
- [ ] PencilKit integration
- [ ] Drawing controls UI
- [ ] Drawing persistence on image

### Phase 4: Stickers/Overlays (2-3 days)
- [ ] Sticker library implementation
- [ ] Sticker positioning controls
- [ ] Image overlay compositing

### Phase 5: Polish & Testing (2-3 days)
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] User experience enhancements
- [ ] Integration testing

## File Structure

```
ios/App/App/
├── PhotoEditorPlugin.swift           ✅ Created
├── ... (other plugins)

capacitor.config.json                 ✅ Updated

www/ (or web layer)
├── usePhotoEditor.ts                 ⏳ TODO
├── useCameraPicture.ts               ⏳ TODO (modify)
└── useRegularPhotoPicker.ts          ⏳ TODO (modify)
```

## Testing Strategy

### Manual Testing Steps
1. Open iOS app in simulator/device
2. Navigate to camera functionality  
3. Take/select a photo with Camera.getPhoto()
4. Verify PhotoEditorPlugin.editPhoto() can be called
5. Confirm dialog appears with image path
6. Test "Continue to Edit" and "Cancel" flows

### Automated Testing
- Unit tests for image processing functions
- Integration tests for plugin method calls
- UI tests for photo editing workflow

## Known Limitations & Considerations

### Current Limitations
- Plugin only shows verification dialog (no actual editing yet)
- No web integration - requires manual JavaScript calls
- No actual image processing implemented

### iOS Considerations
- Memory usage with large images
- iOS permission requirements for photo access
- Background processing limitations
- Device storage for temporary edited images

### Capacitor Considerations
- Plugin registration requires `npx cap sync` after changes
- Image path handling between web and native layers
- Proper error handling across JavaScript/Native bridge

## Next Steps

1. **Immediate**: Create web layer integration to call plugin after Camera.getPhoto()
2. **Short-term**: Implement basic text overlay functionality
3. **Medium-term**: Add drawing and sticker capabilities
4. **Long-term**: Polish UI/UX and optimize performance

## Related Documentation

- [Capacitor Plugin Development Guide](https://capacitorjs.com/docs/plugins/creating)
- [iOS Core Graphics Documentation](https://developer.apple.com/documentation/coregraphics)
- [PencilKit Documentation](https://developer.apple.com/documentation/pencilkit)
- Background Upload Implementation: `background_uploads.md`
- Event Photo Picker: `EVENT_PHOTO_PICKER_PLUGIN.md`