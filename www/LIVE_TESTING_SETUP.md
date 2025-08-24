# 🚀 Live End-to-End Testing Setup

## Step 1: Get Supabase Credentials from photo-share.app

You'll need to get the actual Supabase credentials from your photo-share.app website. Here are several ways to find them:

### Option A: Check the website's JavaScript files
1. Open https://photo-share.app in your browser
2. Open Developer Tools (F12)
3. Go to the Network tab
4. Look for JavaScript files that contain Supabase configuration
5. Search for strings like "supabase.co" or "createClient"

### Option B: Check website source code
1. Visit https://photo-share.app
2. Right-click → "View Page Source"
3. Search for "supabase" or "createClient"
4. Look for configuration objects

### Option C: Browser Console Method
1. Go to https://photo-share.app
2. Open Developer Tools (F12) → Console tab
3. Try running: `console.log(window.supabase)` or `console.log(window.supabaseClient)`
4. This might show the configured client

### Option D: Check for environment variables
Look for patterns like:
```javascript
const supabaseUrl = "https://your-project.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Step 2: Update config.js

Once you have the credentials, update the `config.js` file:

```javascript
// In config.js, update these sections:
window.PHOTOSHARE_CONFIG = {
  website: {
    url: 'https://photo-share.app',
    useRealWebsite: true  // ← Change this to true
  },
  
  supabase: {
    url: 'https://your-actual-project.supabase.co',  // ← Replace with real URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',      // ← Replace with real key
    useRealSupabase: true                             // ← Change this to true
  }
}
```

## Step 3: Test the Connection

1. Open `phase2-test.html`
2. Click "🔌 Connect to Website"
3. You should see:
   - "✅ Using real Supabase client" instead of mock
   - Actual authentication status
   - Real event data from your database

## Step 4: Create Test User Account (if needed)

If you need a test account:
1. Go to https://photo-share.app
2. Sign up for a new account or use existing credentials
3. Create or join some test events with auto-upload enabled

## Step 5: Run Live Tests

Once connected, you can run:
- **🚀 Full End-to-End Test**: Tests with real database and API
- **📤 Test Website Upload**: Uploads actual photos to your website
- **⚙️ Initialize Settings**: Loads real user events and settings
- **🎛️ Open Settings UI**: Manage real auto-upload preferences

## Common Issues & Solutions

### Issue: CORS Errors
If you see CORS errors, it's because the browser blocks cross-origin requests:
```
Access to fetch at 'https://photo-share.app' from origin 'file://' has been blocked by CORS
```

**Solutions:**
1. **Serve files locally**: Use a local server instead of file:// URLs
2. **Update CORS settings**: Add your local testing domain to photo-share.app CORS settings
3. **Use browser flags**: Start browser with `--disable-web-security` (not recommended for regular use)

### Issue: Authentication Failures
```
Error: User not authenticated or invalid token
```

**Solutions:**
1. Log into https://photo-share.app first
2. Copy authentication tokens from browser
3. Make sure your test user has permission to access events

### Issue: API Endpoint Not Found
```
Error: 404 - /functions/v1/mobile-upload not found
```

**Solutions:**
1. Verify the API endpoint exists on your website
2. Check if the mobile-upload function is deployed
3. Try alternative endpoints or check API documentation

## Step 6: Production Testing Workflow

Once connected to real website:

1. **Initialize Connection**:
   ```
   🔌 Connect to Website → Should show real credentials
   ```

2. **Load Real Data**:
   ```
   ⚙️ Initialize Settings → Loads your actual events
   📅 Show User Events → Displays real events you're participating in
   ```

3. **Test Real Uploads**:
   ```
   📤 Test Website Upload → Uploads test photo to actual website
   🚀 Full End-to-End Test → Complete workflow with real API calls
   ```

4. **Manage Settings**:
   ```
   🎛️ Open Settings UI → Manage real auto-upload preferences
   🔄 Test Opt-In/Out → Change settings for real events
   ```

## What You'll See With Real Connection

### Before (Mock Mode):
- "🧪 Using mock Supabase client for testing"
- Test events with fake data
- Simulated uploads

### After (Live Mode):
- "✅ Using real Supabase client"
- Your actual events from photo-share.app
- Real uploads to your website storage
- Actual database updates

## Security Notes

- **Public Anon Keys**: The Supabase anon key is safe to use in browser - it's designed to be public
- **RLS Policies**: Make sure your database has proper Row Level Security policies
- **CORS Settings**: Ensure photo-share.app accepts requests from your test domain

## Need Help Finding Credentials?

If you can't find the Supabase credentials, I can help you:
1. **Inspect Network Traffic**: Look at API requests to identify endpoints
2. **Analyze JavaScript Bundle**: Search through minified code for configuration
3. **Check for Environment Files**: Look for .env or config files in the project

Would you like me to help you find the specific credentials for photo-share.app?