/**
 * FCM Extension Plugin for Capacitor 7
 * Custom plugin implementation using proper Capacitor 7 patterns
 */

console.log('🔥 FCM Extension Plugin loading...');

// FCM Plugin Implementation
class FCMPushNotificationsPlugin {
  constructor() {
    this.isReady = false;
    this.initializePlugin();
  }

  async initializePlugin() {
    console.log('🚀 Initializing FCM Plugin...');
    
    // Wait for Capacitor to be ready
    if (window.Capacitor) {
      await this.waitForPlugins();
    } else {
      console.log('⏳ Waiting for Capacitor...');
      window.addEventListener('capacitorReady', () => this.waitForPlugins());
      document.addEventListener('DOMContentLoaded', () => this.waitForPlugins());
    }
  }

  async waitForPlugins() {
    console.log('🔍 Checking for required plugins...');
    
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    const checkPlugins = () => {
      attempts++;
      console.log(`🔄 Plugin check attempt ${attempts}/${maxAttempts}`);
      
      if (window.Capacitor?.Plugins?.PushNotifications && window.Capacitor?.Plugins?.FirebaseMessaging) {
        console.log('✅ Required plugins found!');
        this.isReady = true;
        this.registerFCMMethod();
      } else if (attempts < maxAttempts) {
        console.log('⏳ Plugins not ready, retrying in 100ms...');
        setTimeout(checkPlugins, 100);
      } else {
        console.error('❌ Required plugins not found after maximum attempts');
      }
    };
    
    checkPlugins();
  }

  registerFCMMethod() {
    console.log('📝 Registering initializeFCM method...');
    
    // Add the method to PushNotifications plugin
    if (!window.Capacitor.Plugins.PushNotifications.initializeFCM) {
      window.Capacitor.Plugins.PushNotifications.initializeFCM = this.initializeFCM.bind(this);
      console.log('✅ initializeFCM method registered successfully!');
    } else {
      console.log('⚠️ initializeFCM method already exists');
    }
  }

  async initializeFCM() {
    console.log('🚀 initializeFCM() called by web!');
    
    if (!this.isReady) {
      console.log('❌ FCM Plugin not ready');
      return { success: false, error: 'Plugin not initialized' };
    }
    
    try {
      const { PushNotifications, FirebaseMessaging } = window.Capacitor.Plugins;
      
      // Check permissions first
      console.log('📋 Checking push notification permissions...');
      const status = await PushNotifications.checkPermissions();
      console.log('📋 Current permissions:', status);
      
      let granted = status.receive === 'granted';
      
      // Request permissions if not granted
      if (!granted) {
        console.log('🔔 Requesting push notification permissions...');
        const result = await PushNotifications.requestPermissions();
        console.log('🔔 Permission request result:', result);
        granted = result.receive === 'granted';
      }
      
      if (!granted) {
        console.log('❌ Push notification permissions denied by user');
        return { success: false, error: 'Permissions denied' };
      }
      
      console.log('✅ Push notification permissions granted');
      
      // Register for push notifications
      console.log('📝 Registering for push notifications...');
      await PushNotifications.register();
      console.log('✅ Successfully registered for push notifications');
      
      // Get FCM token
      console.log('🎯 Requesting FCM token from Firebase...');
      const fcmResult = await FirebaseMessaging.getToken();
      console.log('🎯 FCM getToken result:', fcmResult);
      
      if (fcmResult?.token) {
        const token = fcmResult.token;
        console.log('✅ FCM Token received successfully!');
        console.log('📱 Token (first 30 chars):', token.substring(0, 30) + '...');
        console.log('📱 Token (last 30 chars):', '...' + token.substring(token.length - 30));
        
        // Store token globally for debugging
        window.FCM_TOKEN = token;
        
        // Send token to web's registration function if available
        if (window.registerFCMToken && typeof window.registerFCMToken === 'function') {
          console.log('📤 Sending token to backend via registerFCMToken...');
          await window.registerFCMToken(token, 'ios');
          console.log('✅ Token successfully sent to backend');
        } else {
          console.log('⚠️ No registerFCMToken function found in web context');
        }
        
        return {
          success: true,
          token: token,
          platform: 'ios',
          timestamp: new Date().toISOString()
        };
        
      } else {
        console.log('❌ No FCM token received from Firebase');
        console.log('🔍 FCM response was:', fcmResult);
        return { success: false, error: 'No FCM token received' };
      }
      
    } catch (error) {
      console.error('❌ Error in initializeFCM:', error);
      console.error('❌ Error stack:', error.stack);
      return { 
        success: false, 
        error: error.message,
        stack: error.stack 
      };
    }
  }
}

// Initialize the FCM plugin
console.log('🔧 Creating FCM Plugin instance...');
window.FCMPushNotifications = new FCMPushNotificationsPlugin();

console.log('✅ FCM Extension Plugin loaded successfully!');