/**
 * Native FCM Handler for iOS
 * Handles the complete flow: permissions → FCM token → send to backend
 */

console.log('📱 Native FCM Handler loading...');

// Main handler function that web will call
async function handleFCMInitialization() {
  try {
    console.log('🚀 Native FCM initialization started');
    
    if (!window.Capacitor?.isNativePlatform()) {
      console.log('⏩ Not in native app, skipping');
      return { success: false, error: 'Not native platform' };
    }

    const { PushNotifications, FirebaseMessaging } = window.Capacitor.Plugins;
    
    // Step 1: Check current permission status
    console.log('📋 Checking permission status...');
    const currentStatus = await PushNotifications.checkPermissions();
    console.log('Current status:', currentStatus);
    
    let isGranted = currentStatus.receive === 'granted';
    
    // Step 2: Request permissions if not already granted
    if (currentStatus.receive === 'prompt' || currentStatus.receive === 'denied') {
      console.log('🔔 Requesting push notification permissions...');
      const permissionResult = await PushNotifications.requestPermissions();
      console.log('Permission result:', permissionResult);
      isGranted = permissionResult.receive === 'granted';
    }
    
    // Step 3: Handle permission result
    if (!isGranted) {
      console.log('❌ Push permissions denied/not granted');
      return { 
        success: false, 
        error: 'Permissions not granted',
        permissionStatus: 'denied'
      };
    }
    
    console.log('✅ Push permissions granted');
    
    // Step 4: Register for push notifications (gets APNs token)
    console.log('📝 Registering for push notifications...');
    await PushNotifications.register();
    
    // Step 5: Get FCM token
    console.log('🎯 Getting FCM token...');
    const fcmResult = await FirebaseMessaging.getToken();
    
    if (!fcmResult?.token) {
      console.log('❌ No FCM token received');
      return { success: false, error: 'No FCM token' };
    }
    
    console.log('✅ FCM token received:', fcmResult.token.substring(0, 50) + '...');
    
    // Step 6: Send token to backend/web with useMobileTokenHandler params
    // Store token globally for access
    window.FCM_TOKEN = fcmResult.token;
    
    // Call web's register function if available
    if (typeof window.registerFCMToken === 'function') {
      console.log('📤 Sending token to web registerFCMToken...');
      // Pass token and platform (web handles the rest)
      await window.registerFCMToken(fcmResult.token, 'ios');
      console.log('✅ Token registered with backend');
    } else {
      console.log('⚠️ window.registerFCMToken not found, storing token only');
      
      // Try dispatching event with token
      window.dispatchEvent(new CustomEvent('fcm-token-ready', {
        detail: {
          token: fcmResult.token,
          platform: 'ios'
        }
      }));
    }
    
    // Also dispatch event for web to catch
    window.dispatchEvent(new CustomEvent('fcm-token-received', {
      detail: {
        token: fcmResult.token,
        platform: 'ios'
      }
    }));
    
    return {
      success: true,
      token: fcmResult.token,
      platform: 'ios'
    };
    
  } catch (error) {
    console.error('❌ FCM initialization error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// Set up the hook for web to call
if (window.Capacitor?.isNativePlatform()) {
  // Method 1: Direct function
  window.initializeFCM = handleFCMInitialization;
  
  // Method 2: CapacitorPlugins interface
  if (!window.CapacitorPlugins) {
    window.CapacitorPlugins = {};
  }
  
  if (!window.CapacitorPlugins.PushNotifications) {
    window.CapacitorPlugins.PushNotifications = {};
  }
  
  // Override or add initialize method
  window.CapacitorPlugins.PushNotifications.initialize = handleFCMInitialization;
  
  // Method 3: Listen for custom event from web
  document.addEventListener('fcm-initialize', async (event) => {
    console.log('📨 Received fcm-initialize event from web');
    const result = await handleFCMInitialization();
    
    // Send result back via event
    window.dispatchEvent(new CustomEvent('fcm-initialized', {
      detail: result
    }));
  });
  
  console.log('✅ Native FCM handler ready - web can call:');
  console.log('  - window.initializeFCM()');
  console.log('  - window.CapacitorPlugins.PushNotifications.initialize()');
  console.log('  - dispatch "fcm-initialize" event');
}

// Expose for debugging
window.getFCMToken = () => window.FCM_TOKEN;
window.testFCMFlow = handleFCMInitialization;