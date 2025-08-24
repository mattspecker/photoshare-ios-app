# PhotoShare iOS Native App

A native iOS wrapper for https://photo-share.app using Capacitor.

## Project Overview

This is a minimal Capacitor iOS project that loads your existing website in a native WebView while providing access to native device features through Capacitor plugins.

### Bundle ID: `com.photoshare.photo-share`
### Target Website: `https://photo-share.app`

## Features Supported

✅ **Camera Access** - Native camera functionality for your website
✅ **Photo Library Access** - Native photo picker and saving
✅ **Google Single Sign-On** - Native Google OAuth flow
✅ **Apple Single Sign-On** - Native Apple Sign-In (iOS 13+)
✅ **File System** - Native file operations
✅ **Haptic Feedback** - Native haptic responses
✅ **Status Bar Control** - Native status bar styling
✅ **Keyboard Management** - Native keyboard handling

## Quick Start

### Prerequisites
- Xcode 14+
- iOS 13+ target device/simulator
- Apple Developer account (for device testing)
- Node.js 18+

### Build and Run
```bash
# Open in Xcode
npm run ios:open

# Or run directly on simulator
npm run ios:run
```

## Required Manual Setup in Xcode

Follow these guides for complete setup:

1. **[iOS Setup Guide](iOS_SETUP_GUIDE.md)** - Configure permissions and Info.plist
2. **[OAuth Configuration](OAUTH_CONFIGURATION.md)** - Set up Google and Apple authentication
3. **[Debugging Guide](DEBUGGING_GUIDE.md)** - Troubleshooting and maintenance

### Critical Steps:
1. Add camera/photo permissions to Info.plist
2. Configure Google OAuth URL schemes
3. Enable Apple Sign-In capability
4. Add your GoogleService-Info.plist file

## Project Structure

```
├── capacitor.config.json    # Main Capacitor configuration
├── package.json            # Dependencies and scripts
├── www/                    # Minimal web assets (unused)
├── ios/                    # Generated iOS project
└── documentation files     # Setup and debugging guides
```

## Key Configuration

The app is configured to:
- Load `https://photo-share.app` directly in a WebView
- Provide native plugin support for all Capacitor features
- Handle OAuth redirects natively
- Support all camera and photo library operations

## Development Workflow

Since your website is already built with Capacitor:
1. Most changes are automatic (website updates)
2. Only sync when adding new plugins or changing iOS config
3. Test native features on physical device

## Installed Plugins

- `@capacitor/camera` - Camera and photo library access
- `@capacitor/filesystem` - File system operations  
- `@capacitor/preferences` - Secure storage
- `@capacitor/haptics` - Haptic feedback
- `@capacitor/status-bar` - Status bar control
- `@capacitor/keyboard` - Keyboard management
- `@codetrix-studio/capacitor-google-auth` - Google OAuth
- `@capacitor-community/apple-sign-in` - Apple Sign-In

## Commands

```bash
npm run ios:sync    # Sync config changes
npm run ios:open    # Open in Xcode  
npm run ios:run     # Build and run
npm run cap:update  # Update Capacitor
```

## Important Notes

- ✅ **No React/Vite needed** - Pure WebView wrapper
- ✅ **Website loads directly** - Your existing site works as-is
- ✅ **Native plugins enabled** - All Capacitor features available
- ✅ **OAuth configured** - Native authentication flows
- ⚠️ **Requires setup** - Follow iOS_SETUP_GUIDE.md for permissions

## Support

For issues:
1. Check [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md)
2. Review Xcode console logs
3. Test website functionality in Safari first
4. Verify plugin configurations

The app should provide a seamless native experience for your existing photo-sharing website!