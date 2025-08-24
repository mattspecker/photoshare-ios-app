// Google SSO Test Button - Injects button into any web page
(function() {
  'use strict';
  
  // Remove existing button if present
  const existingBtn = document.getElementById('googleSignInTestBtn');
  if (existingBtn) {
    existingBtn.remove();
  }
  
  // Create the test button
  const button = document.createElement('button');
  button.id = 'googleSignInTestBtn';
  button.innerHTML = 'Google<br>Sign In';
  
  // Apply styles
  Object.assign(button.style, {
    position: 'fixed',
    top: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100px',
    height: '100px',
    backgroundColor: '#00AA00',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: '1.2',
    cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    zIndex: '10000'
  });
  
  // Add hover effects
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#008800';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#00AA00';
  });
  
  button.addEventListener('mousedown', () => {
    button.style.transform = 'translateX(-50%) scale(0.95)';
  });
  
  button.addEventListener('mouseup', () => {
    button.style.transform = 'translateX(-50%)';
  });
  
  // Create result display
  const resultDiv = document.createElement('div');
  resultDiv.id = 'googleSignInResult';
  Object.assign(resultDiv.style, {
    position: 'fixed',
    top: '160px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px',
    backgroundColor: 'white',
    border: '2px solid #00AA00',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: '9999',
    maxWidth: '300px',
    textAlign: 'center',
    fontSize: '14px',
    display: 'none'
  });
  
  // Add click handler
  button.addEventListener('click', async function() {
    try {
      resultDiv.innerHTML = 'Starting Google Sign In...';
      resultDiv.style.display = 'block';
      console.log('Attempting Google Sign In with Firebase...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sign-in timeout after 30 seconds')), 30000);
      });
      
      // Use Capacitor Firebase Authentication plugin
      if (window.Capacitor && window.Capacitor.Plugins.FirebaseAuthentication) {
        console.log('FirebaseAuthentication plugin found, calling signInWithGoogle...');
        
        const signInPromise = window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle();
        const authResult = await Promise.race([signInPromise, timeoutPromise]);
        
        resultDiv.innerHTML = `✅ Success!<br>User: ${authResult.user?.email || authResult.user?.displayName || 'Authenticated'}`;
        console.log('Google Sign In Success:', authResult);
      } else {
        resultDiv.innerHTML = '❌ Firebase Authentication plugin not found.<br>Check console for available plugins.';
        console.log('Available Capacitor plugins:', window.Capacitor ? Object.keys(window.Capacitor.Plugins || {}) : 'Capacitor not loaded');
        
        // Try alternative plugin names
        if (window.CapacitorFirebaseAuthentication) {
          console.log('Trying global CapacitorFirebaseAuthentication...');
          const authResult = await window.CapacitorFirebaseAuthentication.signInWithGoogle();
          resultDiv.innerHTML = `✅ Success via global!<br>User: ${authResult.user?.email || 'Authenticated'}`;
        } else {
          throw new Error('No Firebase Authentication plugin available');
        }
      }
      
    } catch (error) {
      console.error('Google Sign In Error:', error);
      console.log('Error details:', error);
      console.log('Error type:', typeof error);
      console.log('Error constructor:', error?.constructor?.name);
      console.log('Error keys:', Object.keys(error || {}));
      console.log('Error string:', String(error));
      
      let errorMessage = 'Unknown error occurred';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Code: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && Object.keys(error).length > 0) {
        errorMessage = JSON.stringify(error, null, 2);
      }
      
      resultDiv.innerHTML = `❌ Error: ${errorMessage}<br><small>Check Xcode console for iOS logs</small>`;
    }
    
    // Hide result after 15 seconds
    setTimeout(() => {
      resultDiv.style.display = 'none';
    }, 15000);
  });
  
  // Add to page
  document.body.appendChild(button);
  document.body.appendChild(resultDiv);
  
  // Debug logging
  setTimeout(() => {
    console.log('=== GOOGLE SSO BUTTON INJECTED ===');
    console.log('Window.Capacitor:', !!window.Capacitor);
    if (window.Capacitor) {
      console.log('Available plugins:', Object.keys(window.Capacitor.Plugins || {}));
    }
    console.log('FirebaseAuthentication global:', !!window.CapacitorFirebaseAuthentication);
    console.log('====================================');
  }, 1000);
  
})();