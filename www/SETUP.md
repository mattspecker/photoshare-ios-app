# PhotoShare Auto-Upload End-to-End Testing Setup

## 🚀 Quick Start for End-to-End Testing

### 1. Configure Real Website Connection

To test with your actual photo-share.app website, update the configuration in `config.js`:

```javascript
// In config.js, update these values:
window.PHOTOSHARE_CONFIG = {
  website: {
    url: 'https://photo-share.app',
    useRealWebsite: true  // ← Set this to true
  },
  
  supabase: {
    url: 'YOUR_ACTUAL_SUPABASE_URL',     // ← Replace with your Supabase URL
    anonKey: 'YOUR_ACTUAL_ANON_KEY',     // ← Replace with your anon key
    useRealSupabase: true                // ← Set this to true
  }
}
```

### 2. Test with Mock Data (Default)

The system works out-of-the-box with mock data for testing:

1. Open `phase2-test.html` in a browser
2. Click "🔌 Connect to Website" - uses mock Supabase client
3. Click "🚀 Full End-to-End Test" - simulates the complete workflow
4. All tests will pass using simulated data

### 3. Test with Real Website

Once you've configured real credentials:

1. Open `phase2-test.html` in a browser  
2. Click "🔌 Connect to Website" - connects to real Supabase
3. Authenticate if needed (or use test user)
4. Click "🚀 Full End-to-End Test" - tests with real API endpoints
5. Photos will actually upload to your website!

## 🧪 Available Tests

### Auto-Upload Integration Tests
- **Initialize Auto-Upload Integration**: Sets up the bridge between photo monitoring and reliable upload
- **Start Photo Monitoring**: Begins watching for new photos during event timeframes  
- **Simulate Photo Detection**: Simulates iOS detecting a new photo and processing it
- **Auto-Upload Status**: Shows current status of all auto-upload components

### Website Integration Tests  
- **Connect to Website**: Initializes connection to photo-share.app and Supabase
- **Test Website Upload**: Directly uploads a test photo to the website API
- **Full End-to-End Test**: Complete 6-step workflow simulation
- **Website Status**: Shows connection status and configuration

## 📊 Test Results Interpretation

### Full End-to-End Test Steps:
1. **Initialize Auto-Upload Integration** - Sets up photo monitoring system
2. **Connect to Website** - Establishes Supabase connection  
3. **Check Active Events** - Verifies user has events with auto-upload enabled
4. **Simulate Photo Detection** - iOS Photos framework detects new photo
5. **Process Reliable Upload** - Photo goes through retry logic and quality adaptation  
6. **Upload to Website** - Photo reaches the actual /functions/v1/mobile-upload endpoint

### Success Criteria:
- **6/6 Steps**: 🎉 System is production-ready!
- **5/6 Steps**: ⚠️ Mostly functional, minor issues
- **<5/6 Steps**: ❌ Needs debugging before production

## 🔧 Troubleshooting

### Common Issues:

**"WebsiteIntegration not loaded"**
- Ensure `config.js` loads before other scripts
- Check browser console for JavaScript errors

**"No active events available"**  
- Mock events are automatically created for testing
- In production, user needs events with `auto_upload_enabled=true`

**"Failed to load Supabase client"**
- Expected in local testing due to CORS restrictions
- System falls back to mock client automatically

**"Upload failed: 403 Forbidden"**
- Check that test user has permissions for test event
- Verify `isAutoUploadActive()` returns true for the event

## 🔐 Authentication Notes

The system supports:
- **Real Authentication**: When connected to actual Supabase
- **Mock Authentication**: Test user for development
- **Graceful Fallback**: Continues testing even if auth fails

For production testing, ensure your Supabase RLS policies allow:
- Event participants to query their active events
- Authenticated users to upload to events they're participating in
- Auto-upload status checking for events

## 🚀 Next Steps

1. **Mock Testing**: Use default configuration to verify all components work
2. **Real Integration**: Update config.js with actual credentials  
3. **Production Testing**: Test with real user accounts and events
4. **iOS Integration**: Deploy to actual iOS app with Capacitor
5. **Background Processing**: Enable iOS background app refresh

## 📱 iOS Capacitor Integration

To integrate with your iOS app:

1. Copy all `.js` files to your Capacitor `www/` directory
2. Update your main HTML file to include the scripts
3. Ensure iOS permissions are configured (Photos, Background App Refresh)
4. Test in iOS Simulator or device
5. Deploy to TestFlight for real-world testing