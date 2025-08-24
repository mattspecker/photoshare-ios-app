# Debugging and Maintenance Guide

## Development Workflow

### Daily Development Commands
```bash
# Sync any configuration changes
npm run ios:sync

# Open in Xcode for building/testing
npm run ios:open

# Run on simulator (auto-builds)
npm run ios:run
```

### When Your Website Changes
The app loads your live website, so most changes are automatic. However, sync when:
- You add new Capacitor plugins to your website
- You change OAuth configurations
- You update iOS-specific settings

## Debugging Tools

### 1. Safari Web Inspector
**For debugging your website within the app:**
1. Connect device to Mac
2. Open Safari > Develop > [Your Device] > PhotoShare
3. Full web debugging tools available

### 2. Xcode Console
**For native plugin issues:**
1. In Xcode, open the Console tab
2. Look for Capacitor plugin errors
3. Filter by "Capacitor" to see plugin logs

### 3. Device Logs
**For system-level issues:**
1. Xcode > Window > Devices and Simulators
2. Select device > Open Console
3. Search for "PhotoShare" or specific errors

## Common Issues and Solutions

### Website Not Loading
**Symptoms:** Blank screen or connection errors
**Solutions:**
1. Check internet connection
2. Verify `https://photo-share.app` loads in Safari
3. Check for SSL certificate issues
4. Review ATS settings in Info.plist

### Camera/Photos Not Working
**Symptoms:** Permission denied or plugin errors
**Solutions:**
1. Verify Info.plist permissions are added
2. Check device Settings > PhotoShare > Camera/Photos
3. Test on physical device (simulator has limitations)
4. Review Capacitor Camera plugin logs

### Google OAuth Failing
**Symptoms:** OAuth popup doesn't appear or fails
**Solutions:**
1. Verify `GoogleService-Info.plist` is in Xcode project
2. Check Bundle ID matches Google Cloud Console
3. Verify URL scheme in Info.plist
4. Test on physical device
5. Check Google Cloud Console credentials

### Apple Sign-In Not Available
**Symptoms:** Button doesn't appear or errors
**Solutions:**
1. Test on iOS 13+ device
2. Verify "Sign In with Apple" capability in Xcode
3. Check Apple Developer account settings
4. Ensure entitlements file is correct

### Plugin Communication Issues
**Symptoms:** Capacitor plugins not responding
**Solutions:**
1. Check if your website properly initializes Capacitor
2. Verify plugin installation: `npx cap ls`
3. Check console for JavaScript errors
4. Ensure plugins are registered in native project

## Update Procedures

### Adding New Plugins
If your website adds new Capacitor plugins:
```bash
# Install the plugin
npm install @capacitor/new-plugin

# Sync to native project
npm run ios:sync

# May require manual configuration in Xcode
```

### Updating Existing Plugins
```bash
# Update plugins
npm update @capacitor/camera @capacitor/filesystem

# Sync changes
npm run ios:sync

# Test functionality
```

### Website Changes
Most website changes are automatic since the app loads the live site. However:
- Test new features in the native app
- Verify OAuth flows still work
- Check that new Capacitor plugin calls work natively

## Performance Monitoring

### Memory Usage
- Monitor in Xcode Instruments
- Website should behave as normal web app
- Watch for memory leaks in long-running sessions

### Network Usage
- Monitor in Xcode > Debug Navigator
- Consider caching strategies on your website
- Optimize for mobile data usage

### Battery Impact
- Test with Battery usage in iOS Settings
- Optimize website for mobile performance
- Consider background app refresh settings

## Testing Checklist

### Basic Functionality
- [ ] App launches and loads website
- [ ] Navigation works smoothly
- [ ] All website features accessible

### Camera & Photos
- [ ] Camera permission prompt appears
- [ ] Can take photos from website
- [ ] Can select from photo library
- [ ] Photos upload successfully

### Authentication
- [ ] Google Sign-In works natively
- [ ] Apple Sign-In available on iOS 13+
- [ ] Sign-out functions properly
- [ ] Token refresh works

### Network & Connectivity
- [ ] Works on WiFi and cellular
- [ ] Handles poor connections gracefully
- [ ] Offline behavior (if implemented on website)

## Xcode Project Structure

```
ios/App/App.xcworkspace  ← Open this file
├── App/
│   ├── Info.plist       ← Permissions and URL schemes
│   ├── App.entitlements ← Apple Sign-In capability
│   └── AppDelegate.swift
└── Pods/                ← Capacitor plugins
```

## Useful Xcode Settings

### Build Settings to Check
- iOS Deployment Target: 13.0+
- Bundle Identifier: app.photoshare
- Team: Your Apple Developer Team

### Capabilities to Enable
- Sign In with Apple (if using Apple OAuth)
- Associated Domains (if using universal links)

## Troubleshooting Commands

```bash
# Check plugin status
npx cap ls

# Doctor check for common issues
npx cap doctor ios

# Clean and rebuild
rm -rf ios/
npx cap add ios
npm run ios:sync

# Update all Capacitor dependencies
npm run cap:update
```

## Best Practices

1. **Test on Real Device**: Many features require physical device
2. **Keep Plugins Updated**: Regularly update Capacitor plugins
3. **Monitor Website Performance**: Optimize for mobile WebView
4. **Version Control**: Don't commit `ios/` folder - it's generated
5. **OAuth Testing**: Test OAuth flows thoroughly on device
6. **Permission Handling**: Gracefully handle permission denials

## Support Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [iOS Developer Documentation](https://developer.apple.com/documentation/)
- [Google OAuth iOS Setup](https://developers.google.com/identity/sign-in/ios)
- [Apple Sign-In Documentation](https://developer.apple.com/documentation/sign_in_with_apple)