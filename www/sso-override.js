// SSO Function Override - Force correct Capacitor integration
(function() {
  'use strict';
  
  console.log('🔧 SSO OVERRIDE: Injecting correct SSO functions...');
  
  // Wait for page to fully load and then override functions
  function injectSSO() {
    // Force override loginWithGoogle
    window.loginWithGoogle = async function() {
      console.log('🔥 OVERRIDE: loginWithGoogle() called - using Capacitor directly...');
      try {
        console.log('OVERRIDE: Checking Capacitor availability...');
        
        if (!window.Capacitor) {
          throw new Error('OVERRIDE: Capacitor not available');
        }
        
        if (!window.Capacitor.Plugins) {
          throw new Error('OVERRIDE: Capacitor.Plugins not available');
        }
        
        if (!window.Capacitor.Plugins.FirebaseAuthentication) {
          throw new Error('OVERRIDE: FirebaseAuthentication plugin not available');
        }
        
        console.log('OVERRIDE: Calling FirebaseAuthentication.signInWithGoogle...');
        const result = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle({});
        
        console.log('✅ OVERRIDE: Google Sign-In SUCCESS:', result);
        return result;
        
      } catch (error) {
        console.error('❌ OVERRIDE: Google Sign-In FAILED:', error);
        throw error;
      }
    };
    
    // Force override loginWithApple  
    window.loginWithApple = async function() {
      console.log('🍎 OVERRIDE: loginWithApple() called - using Capacitor directly...');
      try {
        console.log('OVERRIDE: Checking Capacitor availability...');
        
        if (!window.Capacitor) {
          throw new Error('OVERRIDE: Capacitor not available');
        }
        
        if (!window.Capacitor.Plugins) {
          throw new Error('OVERRIDE: Capacitor.Plugins not available');
        }
        
        if (!window.Capacitor.Plugins.SignInWithApple) {
          throw new Error('OVERRIDE: SignInWithApple plugin not available');
        }
        
        console.log('OVERRIDE: Calling SignInWithApple.authorize...');
        const result = await window.Capacitor.Plugins.SignInWithApple.authorize({
          requestedScopes: ['email', 'fullName']
        });
        
        console.log('✅ OVERRIDE: Apple Sign-In SUCCESS:', result);
        return result;
        
      } catch (error) {
        console.error('❌ OVERRIDE: Apple Sign-In FAILED:', error);
        throw error;
      }
    };
    
    console.log('✅ OVERRIDE: SSO functions injected successfully');
    console.log('OVERRIDE: loginWithGoogle type:', typeof window.loginWithGoogle);
    console.log('OVERRIDE: loginWithApple type:', typeof window.loginWithApple);
  }
  
  // Inject immediately and also after page loads
  injectSSO();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSSO);
  } else {
    setTimeout(injectSSO, 1000);
  }
  
  // Keep re-injecting every few seconds to override any website code that might redefine these
  setInterval(injectSSO, 3000);
  
})();