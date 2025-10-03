// Remote Website SSO Diagnostic Script
(function() {
  'use strict';
  
  console.log('🔍 REMOTE DEBUG: Script loading...');
  
  // Wait for everything to load
  setTimeout(() => {
    console.log('=== REMOTE WEBSITE SSO DIAGNOSTIC ===');
    console.log('Current URL:', window.location.href);
    console.log('User Agent:', navigator.userAgent);
    console.log('Capacitor available:', !!window.Capacitor);
    
    if (window.Capacitor) {
      console.log('Capacitor Plugins:', Object.keys(window.Capacitor.Plugins || {}));
      console.log('FirebaseAuth available:', !!window.Capacitor.Plugins.FirebaseAuthentication);
      console.log('AppleSignIn available:', !!window.Capacitor.Plugins.SignInWithApple);
    } else {
      console.log('❌ Capacitor not available on remote website');
    }
    
    // Check if functions exist
    console.log('loginWithGoogle function exists:', typeof window.loginWithGoogle);
    console.log('loginWithApple function exists:', typeof window.loginWithApple);
    
    // Override console.error to catch any errors
    const originalError = console.error;
    console.error = function(...args) {
      console.log('🚨 ERROR CAUGHT:', ...args);
      originalError.apply(console, args);
    };
    
    console.log('=== END DIAGNOSTIC ===');
    
    // Try to call the functions after a delay to see what happens
    setTimeout(() => {
      if (typeof window.loginWithGoogle === 'function') {
        console.log('🧪 Testing loginWithGoogle function...');
        window.loginWithGoogle().catch(err => {
          console.log('🔥 loginWithGoogle failed:', err);
        });
      }
    }, 3000);
    
  }, 2000);
  
})();