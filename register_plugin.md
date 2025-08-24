# Capacitor 7 Custom Plugin Registration Guide

This guide provides the **complete, tested solution** for registering custom plugins in Capacitor 7 iOS applications, based on our successful EventPhotoPicker implementation.

## Overview

Capacitor 7 changed how local custom plugins are registered. The old automatic discovery mechanism doesn't work for local plugins, requiring explicit registration via the `packageClassList` configuration.

## ✅ Working Solution: packageClassList Registration

### Step 1: Implement CAPBridgedPlugin Protocol

Your custom plugin **must** implement both `CAPPlugin` and `CAPBridgedPlugin`:

```swift
import Foundation
import Capacitor

@objc(YourPluginName)
public class YourPluginName: CAPPlugin, CAPBridgedPlugin {
    // Required properties for CAPBridgedPlugin
    public let identifier = "YourPluginName"
    public let jsName = "YourPluginName"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "yourMethod", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "anotherMethod", returnType: CAPPluginReturnPromise)
    ]
    
    override public func load() {
        super.load()
        print("🎯 YourPluginName plugin loaded successfully!")
    }
    
    @objc func yourMethod(_ call: CAPPluginCall) {
        // Your implementation here
        call.resolve(["success": true])
    }
}
```

**Critical Requirements:**
- `@objc(YourPluginName)` annotation for Objective-C visibility
- `CAPBridgedPlugin` protocol implementation
- `identifier`, `jsName`, and `pluginMethods` properties
- `@objc` annotation on all methods you want to call from JavaScript

### Step 2: Add to packageClassList

Edit both configuration files:

#### capacitor.config.json (project root)
```json
{
  "appId": "your.app.id",
  "appName": "YourApp",
  "packageClassList": [
    "SignInWithApple",
    "BarcodeScanner",
    // ... other plugins
    "YourPluginName"
  ]
}
```

#### ios/App/App/capacitor.config.json (generated)
```json
{
  "packageClassList": [
    "SignInWithApple", 
    "BarcodeScanner",
    // ... other plugins
    "YourPluginName"
  ]
}
```

### Step 3: Ensure Class Loading (AppDelegate.swift)

Add class loading to ensure the plugin is compiled and available:

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    // ... other initialization code
    
    // Ensure custom plugin classes are loaded for packageClassList auto-registration
    print("🔧 Loading custom plugin classes for auto-registration...")
    _ = YourPluginName.self
    print("✅ Custom plugin classes loaded for packageClassList discovery")
    
    return true
}
```

### Step 4: JavaScript Plugin Registration

Create proper JavaScript plugin registration:

```javascript
// Method 1: Using registerPlugin (Capacitor 7 recommended)
const { registerPlugin } = window.Capacitor || {};

if (registerPlugin) {
    console.log('📱 Registering YourPluginName plugin...');
    window.YourPluginNamePlugin = registerPlugin('YourPluginName');
}

// Method 2: Direct access fallback
function getPlugin() {
    if (window.YourPluginNamePlugin) {
        return window.YourPluginNamePlugin;
    } else if (window.Capacitor?.Plugins?.YourPluginName) {
        return window.Capacitor.Plugins.YourPluginName;
    }
    throw new Error('YourPluginName plugin not available');
}

// Usage
async function callYourMethod() {
    try {
        const plugin = getPlugin();
        const result = await plugin.yourMethod({ param: 'value' });
        console.log('Plugin result:', result);
    } catch (error) {
        console.error('Plugin error:', error);
    }
}
```

## Testing & Verification

### 1. Check Plugin Registration
```javascript
// In browser console
console.log('Available plugins:', Object.keys(window.Capacitor.Plugins));
// Should include 'YourPluginName'
```

### 2. Test Plugin Functionality
```javascript
// Test direct plugin call
await window.Capacitor.Plugins.YourPluginName.yourMethod({ test: true });
```

### 3. Verify Build Success
```bash
# Build iOS app
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug build -quiet
```

## Common Issues & Solutions

### Issue 1: Plugin Not Listed
**Problem**: `Object.keys(window.Capacitor.Plugins)` doesn't show your plugin

**Solution**: 
- Verify plugin is in `packageClassList` in **both** config files
- Ensure `CAPBridgedPlugin` protocol is implemented
- Check `@objc(PluginName)` annotation matches exactly

### Issue 2: "UNIMPLEMENTED" Error
**Problem**: Plugin found but methods return "UNIMPLEMENTED"

**Solution**:
- Add `@objc` annotation to all methods
- Verify method names in `pluginMethods` array match exactly
- Check `CAPPluginMethod` declarations are correct

### Issue 3: App Hanging on Launch
**Problem**: App hangs after splash screen

**Solution**:
- Use standard `CAPBridgeViewController` (don't create custom view controllers)
- Avoid complex manual registration in `capacitorDidLoad()`
- Use `packageClassList` approach only

### Issue 4: Plugin Available in Console but Not in Code
**Problem**: Plugin works in browser console but not in app JavaScript

**Solution**:
```javascript
// Wait for Capacitor to be ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for plugins to load
    let attempts = 0;
    while (!window.Capacitor?.Plugins?.YourPluginName && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (window.Capacitor?.Plugins?.YourPluginName) {
        // Plugin is ready
        console.log('Plugin ready!');
    }
});
```

## File Structure Example

```
ios/App/App/
├── YourPluginName.swift          # Plugin implementation
├── AppDelegate.swift             # Class loading
├── capacitor.config.json         # Generated config with packageClassList
└── public/
    └── your-plugin.js            # JavaScript integration

Project Root/
└── capacitor.config.json         # Source config with packageClassList
```

## Complete Working Example

Based on our successful EventPhotoPicker implementation:

### Swift Plugin (EventPhotoPicker.swift)
```swift
@objc(EventPhotoPicker)
public class EventPhotoPicker: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EventPhotoPicker"
    public let jsName = "EventPhotoPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openEventPhotoPicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showEventInfo", returnType: CAPPluginReturnPromise)
    ]
    
    override public func load() {
        super.load()
        print("🎯 EventPhotoPicker plugin loaded successfully!")
    }
    
    @objc func openEventPhotoPicker(_ call: CAPPluginCall) {
        // Implementation
        call.resolve(["success": true])
    }
    
    @objc func showEventInfo(_ call: CAPPluginCall) {
        // Implementation  
        call.resolve(["info": "Event data"])
    }
}
```

### Configuration (capacitor.config.json)
```json
{
  "packageClassList": [
    "EventPhotoPicker"
  ]
}
```

### JavaScript Integration
```javascript
const { registerPlugin } = window.Capacitor || {};
if (registerPlugin) {
    window.EventPhotoPickerPlugin = registerPlugin('EventPhotoPicker');
}

// Usage
async function openPicker() {
    const plugin = window.EventPhotoPickerPlugin || window.Capacitor.Plugins.EventPhotoPicker;
    const result = await plugin.openEventPhotoPicker({ eventId: '123' });
    console.log('Picker result:', result);
}
```

## Key Differences from Capacitor 6

1. **CAPBridgedPlugin Required**: Must implement this protocol in addition to CAPPlugin
2. **packageClassList Registration**: Local plugins must be explicitly listed
3. **Method Declaration**: Must declare all methods in `pluginMethods` array
4. **JavaScript Registration**: Use `registerPlugin()` for better Capacitor 7 compatibility

## Summary

The **packageClassList approach** is the official and working solution for Capacitor 7 custom plugin registration. Avoid complex manual registration methods that can cause app hanging issues.

**Success Indicators:**
- ✅ App launches without hanging
- ✅ Plugin appears in `Object.keys(window.Capacitor.Plugins)`
- ✅ Plugin methods callable without "UNIMPLEMENTED" errors
- ✅ Clean build with no compilation errors

This approach has been tested and verified to work correctly with Capacitor 7.4.2 and iOS 15+.