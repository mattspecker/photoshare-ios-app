/**
 * Web-side Deep Link Handler for Capacitor App
 * This code should be added to your web app (photo-share.app)
 */

import { App } from '@capacitor/app';

// Listen for deep links when app is opened via custom URL scheme
App.addListener('appUrlOpen', (event) => {
  console.log('[Web] App opened with URL:', event.url);
  
  // Parse the URL
  const url = new URL(event.url);
  
  if (url.protocol === 'photoshare:') {
    // Handle photoshare:// deep links
    const action = url.hostname || url.pathname?.replace('//', '').split('?')[0];
    const params = Object.fromEntries(url.searchParams.entries());
    
    console.log('[Web] Deep link action:', action, 'params:', params);
    
    // Route based on action
    switch (action) {
      case 'upload':
        if (params.eventId) {
          // Navigate to upload screen for this event
          window.location.href = `/events/${params.eventId}/upload`;
        }
        break;
        
      case 'download':
        if (params.eventId) {
          // Open bulk download for this event
          window.location.href = `/events/${params.eventId}/download`;
        }
        break;
        
      case 'event':
        if (params.id) {
          // Navigate to event page
          window.location.href = `/events/${params.id}`;
        }
        break;
        
      case 'join':
        if (params.code) {
          // Navigate to join event with code
          window.location.href = `/join?code=${params.code}`;
        }
        break;
        
      case 'create':
        // Navigate to create event
        window.location.href = '/events/create';
        break;
        
      case 'home':
      default:
        // Navigate to home
        window.location.href = '/';
        break;
    }
  }
});

// Alternative: Listen for resume with URL (when app comes from background)
App.addListener('resumed', () => {
  console.log('[Web] App resumed');
  // Check for any pending deep links
  App.getLaunchUrl().then(result => {
    if (result?.url) {
      console.log('[Web] Launch URL:', result.url);
      // Handle the URL same as above
    }
  });
});

// Check for launch URL when app starts
App.getLaunchUrl().then(result => {
  if (result?.url) {
    console.log('[Web] App launched with URL:', result.url);
    // Handle initial deep link
  }
});

console.log('[Web] Deep link handler initialized');