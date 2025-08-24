/**
 * Event Photo Picker Integration for photo-share.app
 * Add this script to your website to enable Event Photo Picker in the native iOS app
 */

// Only run in native Capacitor apps
if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
  console.log('📱 Native iOS app detected - initializing Event Photo Picker integration...');

  // Event Photo Picker Integration
  class EventPhotoPickerIntegration {
    constructor() {
      this.init();
    }

    async init() {
      // Wait for Capacitor to be ready
      await this.waitForCapacitor();
      
      // Override camera methods
      this.overrideCameraMethods();
      
      console.log('✅ Event Photo Picker integration ready');
    }

    async waitForCapacitor() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.Capacitor?.Plugins) {
            console.log('✅ Capacitor plugins loaded');
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    overrideCameraMethods() {
      // Override window.camera.pickImages (most common)
      if (window.camera?.pickImages) {
        console.log('🎯 Overriding window.camera.pickImages');
        const original = window.camera.pickImages.bind(window.camera);
        
        window.camera.pickImages = (args) => {
          console.log('📸 Camera picker intercepted - showing Event Photo Picker dialog');
          this.showEventDialog(args);
        };
      }

      // Override Capacitor.Plugins.Camera.pickImages as backup
      if (window.Capacitor?.Plugins?.Camera?.pickImages) {
        console.log('🎯 Overriding Capacitor.Plugins.Camera.pickImages');
        const original = window.Capacitor.Plugins.Camera.pickImages.bind(window.Capacitor.Plugins.Camera);
        
        window.Capacitor.Plugins.Camera.pickImages = (args) => {
          console.log('📸 Capacitor camera intercepted - showing Event Photo Picker dialog');
          this.showEventDialog(args);
        };
      }

      // Check every 500ms for 10 seconds in case camera loads later
      let retries = 0;
      const checkInterval = setInterval(() => {
        if (window.camera?.pickImages || retries >= 20) {
          clearInterval(checkInterval);
          if (window.camera?.pickImages) {
            this.overrideCameraMethods();
          }
        }
        retries++;
      }, 500);
    }

    async showEventDialog(cameraArgs = {}) {
      try {
        // Get event context from URL or page data
        const eventData = this.getEventContext();
        
        const message = `🎯 Event Photo Picker Active!

Event: ${eventData.name}
${eventData.description ? `\n${eventData.description}\n` : ''}
This upload will use the Event Photo Picker to show only photos from this event's time period.

📱 Feature Status: Testing Mode`;

        // Use native dialog if available
        if (window.Capacitor?.Plugins?.Dialog) {
          const result = await window.Capacitor.Plugins.Dialog.confirm({
            title: '📸 Event Photo Upload',
            message: message,
            okButtonTitle: 'Continue with Event Photos',
            cancelButtonTitle: 'Cancel'
          });

          if (result.value) {
            console.log('✅ User chose Event Photo Picker');
            // Here you would normally open the Event Photo Picker
            // For now, show success message
            await this.showSuccessMessage();
          } else {
            console.log('❌ User cancelled Event Photo Picker');
          }
        } else {
          // Fallback to browser confirm
          const confirmed = confirm(`📸 Event Photo Upload\n\n${message}\n\nClick OK to continue or Cancel to abort.`);
          
          if (confirmed) {
            console.log('✅ User chose Event Photo Picker');
            await this.showSuccessMessage();
          }
        }
      } catch (error) {
        console.error('❌ Error showing event dialog:', error);
      }
    }

    async showSuccessMessage() {
      if (window.Capacitor?.Plugins?.Dialog) {
        await window.Capacitor.Plugins.Dialog.alert({
          title: '✅ Success!',
          message: 'Event Photo Picker integration is working!\n\nIn the full implementation, this would open the native Event Photo Picker showing only photos from the event time period.'
        });
      } else {
        alert('✅ Success!\n\nEvent Photo Picker integration is working!\n\nIn the full implementation, this would open the native Event Photo Picker showing only photos from the event time period.');
      }
    }

    getEventContext() {
      // Try to extract event information from the page
      // Customize this based on your website structure
      
      // Method 1: From URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const eventId = urlParams.get('eventId') || urlParams.get('event');
      
      // Method 2: From page title or meta tags
      const pageTitle = document.title;
      
      // Method 3: From data attributes or page content
      const eventElement = document.querySelector('[data-event-name]') || 
                          document.querySelector('.event-title') ||
                          document.querySelector('h1');
      
      // Method 4: From JavaScript globals (if your app sets them)
      const globalEvent = window.currentEvent || window.eventData;
      
      return {
        id: eventId || globalEvent?.id || 'current-event',
        name: globalEvent?.name || 
              eventElement?.textContent || 
              eventElement?.getAttribute('data-event-name') || 
              pageTitle || 
              'Current Event',
        description: globalEvent?.description || 'Smart photo selection for this event'
      };
    }

    // Public API for testing
    test() {
      console.log('🧪 Testing Event Photo Picker integration...');
      this.showEventDialog({ test: true });
    }
  }

  // Initialize integration
  const integration = new EventPhotoPickerIntegration();
  
  // Expose for testing
  window.eventPhotoPickerIntegration = integration;
  window.testEventPhotoPicker = () => integration.test();
  
  console.log('📸 Event Photo Picker integration loaded');
  console.log('🧪 Test with: testEventPhotoPicker()');
  
} else {
  console.log('🌐 Running in web browser - Event Photo Picker not available');
}