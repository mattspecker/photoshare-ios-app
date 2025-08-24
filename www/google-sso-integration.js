// Google SSO Integration for PhotoShare App
(function() {
  'use strict';
  
  console.log('🔥 Google & Apple SSO Integration loaded');
  
  // Wait for both Capacitor and the webpage to be ready
  function waitForReady() {
    return new Promise((resolve) => {
      const checkReady = () => {
        const capacitorReady = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication;
        const domReady = document.readyState === 'complete';
        
        if (capacitorReady && domReady) {
          console.log('✅ Capacitor and DOM ready');
          resolve();
        } else {
          console.log('⏳ Waiting for Capacitor and DOM...');
          setTimeout(checkReady, 500);
        }
      };
      checkReady();
    });
  }
  
  // Override or enhance existing loginWithGoogle function
  async function setupGoogleSignInIntegration() {
    await waitForReady();
    
    console.log('🚀 Setting up Google Sign-In integration...');
    
    // Store original function if it exists
    const originalLoginWithGoogle = window.loginWithGoogle;
    
    // Store original functions if they exist
    const originalLoginWithApple = window.loginWithApple;
    
    // GOOGLE SIGN-IN: Override with working Capacitor Firebase Authentication
    window.loginWithGoogle = async function() {
      console.log('🔥 loginWithGoogle() OVERRIDDEN - using Capacitor Firebase Authentication');
      console.log('🚀 Starting Firebase Google Sign-In...');
      
      try {
        // Use our working Capacitor Firebase Authentication
        console.log('📱 Calling FirebaseAuthentication.signInWithGoogle()...');
        const authResult = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle();
        console.log('✅ Firebase Google Sign-In SUCCESS:', authResult);
        
        // Extract user information in the format your app expects
        const userInfo = {
          uid: authResult.user?.uid,
          email: authResult.user?.email,
          displayName: authResult.user?.displayName,
          photoURL: authResult.user?.photoURL,
          accessToken: authResult.credential?.accessToken,
          idToken: authResult.credential?.idToken,
          provider: 'google'
        };
        
        console.log('👤 Google User Info:', userInfo);
        console.log('✨ Google Sign-In completed successfully');
        showSuccess(`Welcome ${userInfo.displayName || userInfo.email}!`);
        
        return userInfo;
        
      } catch (error) {
        console.error('❌ Firebase Google Sign-In ERROR:', error);
        showError('Google Sign-In failed. Please try again.');
        throw error;
      }
    };
    
    // APPLE SIGN-IN: Override with working Capacitor Apple Sign-In
    window.loginWithApple = async function() {
      console.log('🍎 loginWithApple() OVERRIDDEN - using Capacitor Apple Sign-In');
      console.log('🚀 Starting Apple Sign-In...');
      
      try {
        // Use Capacitor Community Apple Sign-In plugin
        console.log('📱 Calling SignInWithApple.authorize()...');
        const authResult = await window.Capacitor.Plugins.SignInWithApple.authorize({
          requestedScopes: ['email', 'fullName']
        });
        console.log('✅ Apple Sign-In SUCCESS:', authResult);
        
        // Extract user information in the format your app expects
        const userInfo = {
          uid: authResult.response?.user,
          email: authResult.response?.email,
          displayName: authResult.response?.givenName && authResult.response?.familyName 
            ? `${authResult.response.givenName} ${authResult.response.familyName}`
            : authResult.response?.email,
          photoURL: null, // Apple doesn't provide photos
          identityToken: authResult.response?.identityToken,
          authorizationCode: authResult.response?.authorizationCode,
          provider: 'apple'
        };
        
        console.log('👤 Apple User Info:', userInfo);
        console.log('✨ Apple Sign-In completed successfully');
        showSuccess(`Welcome ${userInfo.displayName || userInfo.email || 'Apple User'}!`);
        
        return userInfo;
        
      } catch (error) {
        console.error('❌ Apple Sign-In ERROR:', error);
        showError('Apple Sign-In failed. Please try again.');
        throw error;
      }
    };
    
    // Create backup function names
    window.googleLogin = window.loginWithGoogle;
    window.signInWithGoogle = window.loginWithGoogle;
    window.appleLogin = window.loginWithApple;
    window.signInWithApple = window.loginWithApple;
    
    // Also attach to any existing authentication buttons
    setTimeout(() => {
      attachToAuthButtons();
    }, 1000);
    
    console.log('✅ Google & Apple Sign-In integration complete');
  }
  
  // Handle successful Google Sign-In
  async function handleGoogleSignInSuccess(userInfo) {
    console.log('🎉 Handling Google Sign-In success:', userInfo);
    
    try {
      hideLoadingState();
      
      // You can customize this based on your app's needs
      // For now, let's show success and potentially redirect or update UI
      showSuccess(`Welcome ${userInfo.displayName || userInfo.email}!`);
      
      // Example: Post to your backend API
      /*
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: userInfo.idToken,
          accessToken: userInfo.accessToken,
          user: userInfo
        })
      });
      
      const result = await response.json();
      console.log('Backend response:', result);
      */
      
      return userInfo;
      
    } catch (error) {
      console.error('Error handling Google Sign-In success:', error);
      showError('Authentication succeeded but app setup failed.');
    }
  }
  
  // Attach to existing authentication buttons on the page
  function attachToAuthButtons() {
    // Google Sign-In buttons
    const googleSelectors = [
      '[data-google-signin]',
      '.google-signin',
      '.google-login',
      '.google-auth',
      'button[onclick*="loginWithGoogle"]',
      'button[onclick*="googleLogin"]',
      'a[href*="google"]',
      '.btn-google',
      'button:contains("Continue with Google")',
      'button:contains("Sign in with Google")'
    ];
    
    // Apple Sign-In buttons
    const appleSelectors = [
      '[data-apple-signin]',
      '.apple-signin',
      '.apple-login',
      '.apple-auth',
      'button[onclick*="loginWithApple"]',
      'button[onclick*="appleLogin"]',
      'a[href*="apple"]',
      '.btn-apple',
      'button:contains("Continue with Apple")',
      'button:contains("Sign in with Apple")'
    ];
    
    // Attach Google Sign-In
    googleSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        console.log('🔗 Attaching Google Sign-In to button:', button);
        
        // Remove existing click handlers and add ours
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('🔘 Google button clicked');
          await window.loginWithGoogle();
        });
      });
    });
    
    // Attach Apple Sign-In
    appleSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        console.log('🔗 Attaching Apple Sign-In to button:', button);
        
        // Remove existing click handlers and add ours
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('🍎 Apple button clicked');
          await window.loginWithApple();
        });
      });
    });
  }
  
  // UI Helper Functions
  function showLoadingState() {
    console.log('⏳ Showing loading state...');
    // You can customize this to match your app's UI
    // Example: Show a loading spinner or disable buttons
  }
  
  function hideLoadingState() {
    console.log('✅ Hiding loading state...');
    // Hide loading spinner or re-enable buttons
  }
  
  function showSuccess(message) {
    console.log('✅ Success:', message);
    // You can show a toast notification or update UI
    // alert(message); // Simple fallback
  }
  
  function showError(message) {
    console.log('❌ Error:', message);
    // You can show a toast notification or update UI
    // alert(message); // Simple fallback
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGoogleSignInIntegration);
  } else {
    setupGoogleSignInIntegration();
  }
  
})();