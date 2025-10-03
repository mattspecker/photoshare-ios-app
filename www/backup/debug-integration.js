// Enhanced Debug Integration for Google & Apple SSO
(function() {
  'use strict';
  
  console.log('🔍 DEBUG INTEGRATION: Starting comprehensive debugging...');
  
  // Wait for Capacitor to be ready
  function waitForCapacitor() {
    return new Promise((resolve) => {
      const checkCapacitor = () => {
        if (window.Capacitor && window.Capacitor.Plugins) {
          console.log('✅ DEBUG: Capacitor is ready');
          resolve();
        } else {
          console.log('⏳ DEBUG: Waiting for Capacitor...');
          setTimeout(checkCapacitor, 200);
        }
      };
      checkCapacitor();
    });
  }
  
  async function setupDebugIntegration() {
    await waitForCapacitor();
    
    console.log('🔍 DEBUG: === FULL CAPACITOR ANALYSIS ===');
    console.log('DEBUG: window.Capacitor:', !!window.Capacitor);
    console.log('DEBUG: window.Capacitor.Plugins:', Object.keys(window.Capacitor.Plugins || {}));
    
    // Check Firebase Authentication plugin
    if (window.Capacitor.Plugins.FirebaseAuthentication) {
      console.log('✅ DEBUG: FirebaseAuthentication plugin found');
      console.log('DEBUG: FirebaseAuthentication methods:', Object.getOwnPropertyNames(window.Capacitor.Plugins.FirebaseAuthentication));
      
      // Test if signInWithGoogle method exists
      if (typeof window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle === 'function') {
        console.log('✅ DEBUG: signInWithGoogle method is available');
      } else {
        console.log('❌ DEBUG: signInWithGoogle method NOT found');
      }
    } else {
      console.log('❌ DEBUG: FirebaseAuthentication plugin NOT found');
    }
    
    // Check Apple Sign-In plugin
    if (window.Capacitor.Plugins.SignInWithApple) {
      console.log('✅ DEBUG: SignInWithApple plugin found');
      console.log('DEBUG: SignInWithApple methods:', Object.getOwnPropertyNames(window.Capacitor.Plugins.SignInWithApple));
      
      // Test if authorize method exists
      if (typeof window.Capacitor.Plugins.SignInWithApple.authorize === 'function') {
        console.log('✅ DEBUG: SignInWithApple.authorize method is available');
      } else {
        console.log('❌ DEBUG: SignInWithApple.authorize method NOT found');
      }
    } else {
      console.log('❌ DEBUG: SignInWithApple plugin NOT found');
    }
    
    // Override original functions with debug versions
    const originalLoginWithGoogle = window.loginWithGoogle;
    const originalLoginWithApple = window.loginWithApple;
    
    // DEBUG GOOGLE SIGN-IN
    window.loginWithGoogle = async function() {
      console.log('🔥 DEBUG: loginWithGoogle() called - starting trace...');
      console.log('DEBUG: Original function exists:', !!originalLoginWithGoogle);
      
      try {
        console.log('DEBUG: About to call FirebaseAuthentication.signInWithGoogle()');
        console.log('DEBUG: Plugin available:', !!window.Capacitor.Plugins.FirebaseAuthentication);
        console.log('DEBUG: Method available:', !!window.Capacitor.Plugins.FirebaseAuthentication?.signInWithGoogle);
        
        if (!window.Capacitor.Plugins.FirebaseAuthentication) {
          throw new Error('DEBUG: FirebaseAuthentication plugin not available');
        }
        
        if (!window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle) {
          throw new Error('DEBUG: signInWithGoogle method not available');
        }
        
        console.log('DEBUG: Calling signInWithGoogle with empty options...');
        const result = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle({});
        
        console.log('✅ DEBUG: Google Sign-In SUCCESS:', result);
        return result;
        
      } catch (error) {
        console.error('❌ DEBUG: Google Sign-In FAILED:', error);
        console.log('DEBUG: Error type:', typeof error);
        console.log('DEBUG: Error code:', error.code);
        console.log('DEBUG: Error message:', error.message);
        console.log('DEBUG: Full error object:', JSON.stringify(error, null, 2));
        
        // Try calling original function if it exists
        if (originalLoginWithGoogle && typeof originalLoginWithGoogle === 'function') {
          console.log('DEBUG: Trying original loginWithGoogle function...');
          try {
            const originalResult = await originalLoginWithGoogle();
            console.log('DEBUG: Original function result:', originalResult);
            return originalResult;
          } catch (originalError) {
            console.error('DEBUG: Original function also failed:', originalError);
          }
        }
        
        throw error;
      }
    };
    
    // DEBUG APPLE SIGN-IN
    window.loginWithApple = async function() {
      console.log('🍎 DEBUG: loginWithApple() called - starting trace...');
      console.log('DEBUG: Original function exists:', !!originalLoginWithApple);
      
      try {
        console.log('DEBUG: About to call SignInWithApple.authorize()');
        console.log('DEBUG: Plugin available:', !!window.Capacitor.Plugins.SignInWithApple);
        console.log('DEBUG: Method available:', !!window.Capacitor.Plugins.SignInWithApple?.authorize);
        
        if (!window.Capacitor.Plugins.SignInWithApple) {
          throw new Error('DEBUG: SignInWithApple plugin not available');
        }
        
        if (!window.Capacitor.Plugins.SignInWithApple.authorize) {
          throw new Error('DEBUG: authorize method not available');
        }
        
        console.log('DEBUG: Calling authorize with requestedScopes...');
        const result = await window.Capacitor.Plugins.SignInWithApple.authorize({
          requestedScopes: ['email', 'fullName']
        });
        
        console.log('✅ DEBUG: Apple Sign-In SUCCESS:', result);
        return result;
        
      } catch (error) {
        console.error('❌ DEBUG: Apple Sign-In FAILED:', error);
        console.log('DEBUG: Error type:', typeof error);
        console.log('DEBUG: Error code:', error.code);
        console.log('DEBUG: Error message:', error.message);
        console.log('DEBUG: Full error object:', JSON.stringify(error, null, 2));
        
        // Try calling original function if it exists
        if (originalLoginWithApple && typeof originalLoginWithApple === 'function') {
          console.log('DEBUG: Trying original loginWithApple function...');
          try {
            const originalResult = await originalLoginWithApple();
            console.log('DEBUG: Original function result:', originalResult);
            return originalResult;
          } catch (originalError) {
            console.error('DEBUG: Original function also failed:', originalError);
          }
        }
        
        throw error;
      }
    };
    
    console.log('✅ DEBUG: Debug integration complete');
    console.log('🔍 DEBUG: === END CAPACITOR ANALYSIS ===');
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDebugIntegration);
  } else {
    setupDebugIntegration();
  }
  
})();