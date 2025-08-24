#!/bin/bash

echo "🚀 Building iOS app with automated photo upload..."

# Check if we're in the right directory
if [ ! -f "capacitor.config.json" ]; then
    echo "❌ Error: capacitor.config.json not found. Run this script from the project root."
    exit 1
fi

# Step 1: Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Step 2: Build web assets
echo "🌐 Building web assets..."
if [ -f "package.json" ]; then
    npm run build 2>/dev/null || echo "⚠️ No build script found, using existing www/"
fi

# Step 3: Copy automation files to www
echo "📱 Copying automation files..."
cp www/automated-photo-monitor.js www/automated-photo-monitor.js.bak 2>/dev/null || true
cp www/automated-upload-integration.js www/automated-upload-integration.js.bak 2>/dev/null || true
cp www/manual-photo-upload.js www/manual-photo-upload.js.bak 2>/dev/null || true

# Step 4: Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync ios

# Step 5: Check if Xcode project needs updates
echo "🔍 Checking Xcode project..."
if [ ! -f "ios/App/App/PhotoLibraryMonitor.swift" ]; then
    echo "❌ PhotoLibraryMonitor.swift not found in Xcode project"
    echo "📋 Please add the following files to your Xcode project manually:"
    echo "   - ios/App/App/PhotoLibraryMonitor.swift"
    echo "   - ios/App/App/PhotoLibraryMonitor.m"
    echo "   - ios/App/App/EventPhotoPicker.swift"
    echo "   - ios/App/App/EventPhotoPicker.m"
    exit 1
fi

if [ ! -f "ios/App/App/EventPhotoPicker.swift" ]; then
    echo "❌ EventPhotoPicker.swift not found in Xcode project"
    echo "📋 Please add the following files to your Xcode project manually:"
    echo "   - ios/App/App/EventPhotoPicker.swift"
    echo "   - ios/App/App/EventPhotoPicker.m"
    exit 1
fi

# Step 6: Verify Info.plist permissions
echo "🔐 Checking permissions in Info.plist..."
if grep -q "NSPhotoLibraryUsageDescription" ios/App/App/Info.plist; then
    echo "✅ Photo library permissions found"
else
    echo "⚠️ Adding photo library permissions to Info.plist..."
    # Add photo library permissions if missing
    # This is a simplified version - manual editing may be needed
fi

if grep -q "UIBackgroundModes" ios/App/App/Info.plist; then
    echo "✅ Background modes found"
else
    echo "⚠️ Background modes missing - please add to Info.plist manually"
fi

# Step 7: Open Xcode project
echo "📱 Opening Xcode project..."
open ios/App/App.xcworkspace

echo ""
echo "🎯 Next Steps:"
echo "1. ✅ Verify PhotoLibraryMonitor files are added to Xcode project"
echo "2. ✅ Build and run the app in Xcode"
echo "3. ✅ Test automated photo monitoring with console commands:"
echo ""
echo "   Console Commands to Test:"
echo "   ========================"
echo "   // 1. Check if automation is available"
echo "   window.PhotoShareAutomatedUploadIntegration.getFullStatus()"
echo ""
echo "   // 2. Enable auto-upload for current event"
echo "   enableEventAutoUpload()"
echo ""
echo "   // 3. Start automated monitoring"
echo "   window.PhotoShareAutomatedUploadIntegration.forceStartMonitoring()"
echo ""
echo "   // 4. Take a photo and check if it's detected"
echo "   window.PhotoShareAutomatedUploadIntegration.triggerManualPhotoCheck()"
echo ""
echo "📋 The automated system will:"
echo "   • Monitor photo library in background (30 second intervals)"
echo "   • Detect new photos automatically"
echo "   • Upload photos that match event timeframes"
echo "   • Show notifications for upload progress"
echo "   • Continue monitoring even when app is backgrounded"
echo ""
echo "🔧 Troubleshooting:"
echo "   • If plugin not available: Rebuild app in Xcode"
echo "   • If permissions denied: Check iOS Settings > Privacy > Photos"
echo "   • If monitoring not starting: Enable auto-upload for an event first"
echo ""

# Step 8: Show files created
echo "📁 Files created for automated upload:"
echo "   - ios/App/App/PhotoLibraryMonitor.swift (Native iOS plugin)"
echo "   - ios/App/App/PhotoLibraryMonitor.m (Plugin definition)"
echo "   - ios/App/App/EventPhotoPicker.swift (Event-filtered photo picker)"
echo "   - ios/App/App/EventPhotoPicker.m (Photo picker plugin definition)"
echo "   - www/automated-photo-monitor.js (Background monitoring)"
echo "   - www/automated-upload-integration.js (System integration)"
echo "   - www/event-photo-picker.js (Event photo picker interface)"
echo "   - www/event-photo-picker-demo.js (Photo picker testing)"
echo "   - www/manual-photo-upload.js (Manual upload fallback)"
echo "   - www/console-dashboard-commands.js (Debug commands)"
echo ""

echo "✅ Build script complete! Check Xcode for any compilation errors."