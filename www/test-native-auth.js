// Test functions for native authentication plugins
// Add to your remote website's JavaScript

// Wait for Capacitor to be ready before defining SSO functions
async function waitForCapacitor() {
  return new Promise((resolve) => {
    const checkCapacitor = () => {
      if (window.Capacitor && window.Capacitor.Plugins) {
        resolve();
      } else {
        setTimeout(checkCapacitor, 100);
      }
    };
    checkCapacitor();
  });
}

// Initialize SSO functions after Capacitor is ready
waitForCapacitor().then(() => {
  window.loginWithGoogle = async function() {
    console.log('🔥 GOOGLE LOGIN: Function called - starting authentication...');
    try {
      if (!window.Capacitor?.Plugins?.FirebaseAuthentication) {
        throw new Error('FirebaseAuthentication plugin not available');
      }

      const result = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle({});
      console.log('✅ Google Sign-In Success:', result);
      return result;
    } catch (error) {
      console.error('❌ Google Sign-In Failed:', error);
      throw error;
    }
  };

  window.loginWithApple = async function() {
    console.log('🍎 APPLE LOGIN: Function called - starting authentication...');
    try {
      if (!window.Capacitor?.Plugins?.SignInWithApple) {
        throw new Error('SignInWithApple plugin not available');
      }

      const result = await window.Capacitor.Plugins.SignInWithApple.authorize({
        requestedScopes: ['email', 'fullName']
      });
      console.log('✅ Apple Sign-In Success:', result);
      return result;
    } catch (error) {
      console.error('❌ Apple Sign-In Failed:', error);
      throw error;
    }
  };

  console.log('🧪 Native auth test functions loaded. Call loginWithGoogle() or loginWithApple() from browser console.');
});