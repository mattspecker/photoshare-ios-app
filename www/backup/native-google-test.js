// Test native GoogleSignIn SDK directly
(function() {
  'use strict';
  
  // Create native test button
  const nativeButton = document.createElement('button');
  nativeButton.id = 'nativeGoogleSignInBtn';
  nativeButton.innerHTML = 'Native<br>Google';
  
  Object.assign(nativeButton.style, {
    position: 'fixed',
    top: '160px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80px',
    height: '80px',
    backgroundColor: '#FF6600',
    color: 'white',
    border: 'none',
    borderRadius: '40px',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: '1.1',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    zIndex: '9999'
  });
  
  nativeButton.addEventListener('click', async function() {
    try {
      console.log('Testing native Capacitor call...');
      
      // Test if Capacitor itself is working
      if (window.Capacitor && window.Capacitor.Plugins.Device) {
        const info = await window.Capacitor.Plugins.Device.getInfo();
        console.log('Device info (Capacitor working):', info);
      }
      
      // Test Firebase App plugin
      if (window.Capacitor && window.Capacitor.Plugins.FirebaseApp) {
        console.log('FirebaseApp plugin available');
      } else {
        console.log('FirebaseApp plugin NOT available');
      }
      
      // Try calling Firebase Authentication methods one by one
      if (window.Capacitor && window.Capacitor.Plugins.FirebaseAuthentication) {
        const plugin = window.Capacitor.Plugins.FirebaseAuthentication;
        console.log('FirebaseAuthentication plugin methods:', Object.getOwnPropertyNames(plugin));
        
        try {
          console.log('Testing getCurrentUser...');
          const currentUser = await plugin.getCurrentUser();
          console.log('Current user:', currentUser);
        } catch (e) {
          console.log('getCurrentUser error:', e);
        }
        
        try {
          console.log('Testing getIdToken...');
          const token = await plugin.getIdToken();
          console.log('ID Token:', token);
        } catch (e) {
          console.log('getIdToken error:', e);
        }
      }
      
    } catch (error) {
      console.error('Native test error:', error);
    }
  });
  
  document.body.appendChild(nativeButton);
  
})();