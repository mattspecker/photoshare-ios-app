/**
 * Web App Ready Signal for Android Auto-Upload Integration
 * 
 * This signals to the Android native layer that the web app has fully initialized,
 * including localStorage, authentication, and auto-upload settings.
 * 
 * Android waits for this signal before attempting to read localStorage to prevent
 * timing issues where settings aren't yet initialized.
 */

/**
 * Notify Android that the web app is ready and localStorage is fully initialized
 */
window.notifyAndroidWebAppReady = function() {
  console.log('🎉 [WEB] Notifying Android that web app is ready');
  
  try {
    // Check if the Android MultiEventAutoUpload plugin is available
    if (window.MultiEventAutoUpload && typeof window.MultiEventAutoUpload.webAppReady === 'function') {
      console.log('📱 [WEB] Calling MultiEventAutoUpload.webAppReady()');
      window.MultiEventAutoUpload.webAppReady();
      console.log('✅ [WEB] Android notified successfully');
    } else {
      console.log('ℹ️ [WEB] MultiEventAutoUpload not available (not running on Android or plugin not loaded)');
    }
  } catch (error) {
    console.error('❌ [WEB] Error notifying Android:', error);
  }
};

console.log('✅ [WEB] web-app-ready-signal.js loaded - notifyAndroidWebAppReady() available');
