/**
 * FCM Token Service for iOS - Web Integration
 * Gets FCM token and calls web's registerFCMToken function
 */

console.log('🔥 iOS FCM Service loading...');

// Function to initialize FCM and get token  
async function initializeFCMToken() {
  try {
    console.log('🔥 Starting iOS FCM token initialization...');
    
    // Check if we're in native app
    if (!window.Capacitor?.isNativePlatform()) {
      console.log('⏩ Skipping FCM - not in native app');
      return;
    }

    const { PushNotifications } = window.Capacitor.Plugins;
    
    // Step 1: Check current permission status
    console.log('📋 Checking current push notification permissions...');
    const currentStatus = await PushNotifications.checkPermissions();
    console.log('📋 Current permission status:', currentStatus);
    
    let permissionGranted = currentStatus.receive === 'granted';
    
    // Step 2: Request permissions if not already granted
    if (!permissionGranted) {
      console.log('🔔 Requesting push notification permissions...');
      const permissionResult = await PushNotifications.requestPermissions();
      console.log('🔔 Permission request result:', permissionResult);
      
      permissionGranted = permissionResult.receive === 'granted';
    }
    
    // Step 3: Only proceed if permissions are granted
    if (!permissionGranted) {
      console.log('❌ Push notification permissions not granted - cannot get FCM token');
      console.log('💡 User needs to enable push notifications in Settings > PhotoShare > Notifications');
      return null;
    }
    
    console.log('✅ Push notification permissions granted - proceeding to get FCM token');

    // Step 4: Get FCM token only after permissions are confirmed
    const { FirebaseMessaging } = window.Capacitor.Plugins;
    console.log('🎯 Requesting FCM token from Firebase...');
    const result = await FirebaseMessaging.getToken();
    
    if (result?.token) {
      console.log('🎯 iOS FCM Token received:', result.token.substring(0, 50) + '...');
      
      // Store token globally
      window.FCM_TOKEN = result.token;
      
      // Call web's registerFCMToken function
      if (typeof window.registerFCMToken === 'function') {
        console.log('📞 Calling web registerFCMToken...');
        await window.registerFCMToken(result.token, 'ios');
        console.log('✅ Token registered with web successfully');
      } else {
        console.log('⚠️ window.registerFCMToken not found - web may not be ready yet');
        
        // Try alternative methods
        tryAlternativeRegistration(result.token);
      }
      
      return result.token;
    } else {
      console.log('❌ No FCM token received');
    }
    
  } catch (error) {
    console.error('❌ FCM Token initialization failed:', error);
  }
}

// Try alternative registration methods if main one fails
function tryAlternativeRegistration(token) {
  console.log('🔄 Trying alternative FCM registration methods...');
  
  // Method A: PostMessage
  try {
    window.parent.postMessage({ 
      type: 'FCM_TOKEN',
      token: token,
      platform: 'ios'
    }, '*');
    console.log('📤 Sent FCM token via postMessage');
  } catch (error) {
    console.log('⚠️ PostMessage failed:', error);
  }
  
  // Method B: Custom event
  try {
    document.dispatchEvent(new CustomEvent('fcm-initialize', {
      detail: { 
        eventId: 'session', 
        eventName: 'EventPhoto App',
        token: token,
        platform: 'ios'
      }
    }));
    console.log('📡 Dispatched fcm-initialize event');
  } catch (error) {
    console.log('⚠️ Custom event failed:', error);
  }
  
  // Store in global for web to pick up
  window.MOBILE_FCM_TOKEN = { token, platform: 'ios' };
  console.log('💾 Stored token in window.MOBILE_FCM_TOKEN');
}

// Set up CapacitorPlugins for web integration
if (!window.CapacitorPlugins) {
  window.CapacitorPlugins = {};
}

if (!window.CapacitorPlugins.PushNotifications) {
  window.CapacitorPlugins.PushNotifications = {};
}

// Handle web's initialization call
window.CapacitorPlugins.PushNotifications.initialize = async function() {
  console.log('📲 Web called PushNotifications.initialize() - starting FCM...');
  return await initializeFCMToken();
};

// Auto-initialize when page loads and we're in native app
if (window.Capacitor?.isNativePlatform()) {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Scheduling iOS FCM token initialization...');
    // Wait 3 seconds for other services to load
    setTimeout(initializeFCMToken, 3000);
  });
}

// Expose for manual testing and web integration
window.initializeFCMToken = initializeFCMToken;
window.getFCMToken = () => window.FCM_TOKEN;

console.log('✅ iOS FCM Service ready - listening for web initialize calls');