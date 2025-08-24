// Capacitor SSO Fix - Immediate injection for remote website
console.log('🚀 SSO FIX: Capacitor SSO Fix loading...');

// Execute immediately when script loads
(function() {
  'use strict';
  
  let injectionAttempts = 0;
  const MAX_ATTEMPTS = 50;
  
  function forceInjectSSO() {
    injectionAttempts++;
    console.log(`🔧 SSO FIX: Injection attempt ${injectionAttempts}/${MAX_ATTEMPTS}`);
    
    if (!window.Capacitor) {
      console.log('⏳ SSO FIX: Capacitor not ready, will retry...');
      if (injectionAttempts < MAX_ATTEMPTS) {
        setTimeout(forceInjectSSO, 200);
      }
      return;
    }
    
    console.log('✅ SSO FIX: Capacitor found! Injecting SSO functions...');
    console.log('SSO FIX: Available plugins:', Object.keys(window.Capacitor.Plugins || {}));
    
    // Force override loginWithGoogle
    const originalGoogleLogin = window.loginWithGoogle;
    window.loginWithGoogle = async function() {
      console.log('🔥 SSO FIX: loginWithGoogle() intercepted!');
      console.log('SSO FIX: Original function existed:', !!originalGoogleLogin);
      
      try {
        if (!window.Capacitor?.Plugins?.FirebaseAuthentication) {
          throw new Error('SSO FIX: FirebaseAuthentication plugin not available');
        }
        
        console.log('SSO FIX: Calling FirebaseAuthentication.signInWithGoogle...');
        const result = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle({});
        console.log('✅ SSO FIX: Google Sign-In Success:', result);
        return result;
      } catch (error) {
        console.error('❌ SSO FIX: Google Sign-In Failed:', error);
        throw error;
      }
    };
    
    // Force override loginWithApple
    const originalAppleLogin = window.loginWithApple;
    window.loginWithApple = async function() {
      console.log('🍎 SSO FIX: loginWithApple() intercepted!');
      console.log('SSO FIX: Original function existed:', !!originalAppleLogin);
      
      try {
        if (!window.Capacitor?.Plugins?.SignInWithApple) {
          throw new Error('SSO FIX: SignInWithApple plugin not available');
        }
        
        console.log('SSO FIX: Calling SignInWithApple.authorize...');
        const result = await window.Capacitor.Plugins.SignInWithApple.authorize({
          requestedScopes: ['email', 'fullName']
        });
        console.log('✅ SSO FIX: Apple Sign-In Success:', result);
        return result;
      } catch (error) {
        console.error('❌ SSO FIX: Apple Sign-In Failed:', error);
        throw error;
      }
    };
    
    console.log('✅ SSO FIX: Functions injected successfully');
    console.log('SSO FIX: loginWithGoogle type:', typeof window.loginWithGoogle);
    console.log('SSO FIX: loginWithApple type:', typeof window.loginWithApple);
    
    // Keep re-injecting every 2 seconds to override any website changes
    setInterval(() => {
      if (typeof window.loginWithGoogle !== 'function' || 
          window.loginWithGoogle.toString().indexOf('SSO FIX') === -1) {
        console.log('🔄 SSO FIX: Re-injecting Google function...');
        forceInjectSSO();
      }
    }, 2000);
  }
  
  // Start injection immediately
  forceInjectSSO();
  
  // Also try when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceInjectSSO);
  }
  
  // And when window loads
  window.addEventListener('load', forceInjectSSO);
  
})();