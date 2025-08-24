// Simple Camera Override for photo-share.app
// Inject this directly into the website to test the dialog

(function() {
    console.log('🎯 Injecting camera override...');
    
    // Function to show native dialog
    async function showEventDialog() {
        try {
            // Try native Capacitor Dialog first
            if (window.Capacitor?.Plugins?.Dialog) {
                console.log('✅ Using native Capacitor Dialog');
                
                const result = await window.Capacitor.Plugins.Dialog.confirm({
                    title: '📸 Event Photo Upload',
                    message: `🎯 Event Photo Picker Active!

Event: Live Photo Upload Test
ID: test-live-site-event

This upload will use the Event Photo Picker to show only photos from this event's time period.

📱 This feature is currently in testing mode.`,
                    okButtonTitle: 'Continue',
                    cancelButtonTitle: 'Cancel'
                });
                
                if (result.value) {
                    console.log('✅ User confirmed - would proceed to Event Photo Picker');
                    alert('✅ Success! Dialog worked. In full implementation, this would open the Event Photo Picker.');
                } else {
                    console.log('❌ User cancelled');
                }
                
                return true;
            } else {
                // Fallback to browser confirm
                console.log('⚠️ Using browser confirm dialog');
                const confirmed = confirm(`📸 Event Photo Upload

🎯 Event Photo Picker Active!

Event: Live Photo Upload Test
ID: test-live-site-event

This upload will use the Event Photo Picker to show only photos from this event's time period.

📱 This feature is currently in testing mode.

Click OK to continue or Cancel to abort.`);
                
                if (confirmed) {
                    console.log('✅ User confirmed - would proceed to Event Photo Picker');
                    alert('✅ Success! Dialog worked. In full implementation, this would open the Event Photo Picker.');
                } else {
                    console.log('❌ User cancelled');
                }
                
                return true;
            }
        } catch (error) {
            console.error('❌ Error showing dialog:', error);
            return false;
        }
    }
    
    // Override function to replace camera.pickImages
    function overrideCameraMethod() {
        // Method 1: Override window.camera.pickImages
        if (window.camera && typeof window.camera.pickImages === 'function') {
            console.log('🎯 Found window.camera.pickImages - overriding');
            
            const originalPickImages = window.camera.pickImages.bind(window.camera);
            
            window.camera.pickImages = function(args) {
                console.log('🎯🎯🎯 INTERCEPTED window.camera.pickImages!', args);
                
                // Show dialog instead of camera picker
                showEventDialog();
                
                // Don't call the original function
                console.log('🚫 Camera picker blocked - dialog shown instead');
            };
            
            console.log('✅ Successfully overridden window.camera.pickImages');
            return true;
        }
        
        // Method 2: Override Capacitor.Plugins.Camera.pickImages
        if (window.Capacitor?.Plugins?.Camera?.pickImages) {
            console.log('🎯 Found Capacitor.Plugins.Camera.pickImages - overriding');
            
            const originalPickImages = window.Capacitor.Plugins.Camera.pickImages.bind(window.Capacitor.Plugins.Camera);
            
            window.Capacitor.Plugins.Camera.pickImages = function(args) {
                console.log('🎯🎯🎯 INTERCEPTED Capacitor.Plugins.Camera.pickImages!', args);
                
                // Show dialog instead of camera picker
                showEventDialog();
                
                // Don't call the original function
                console.log('🚫 Camera picker blocked - dialog shown instead');
            };
            
            console.log('✅ Successfully overridden Capacitor.Plugins.Camera.pickImages');
            return true;
        }
        
        console.log('❌ No camera methods found to override');
        return false;
    }
    
    // Try to override immediately
    if (overrideCameraMethod()) {
        console.log('✅ Camera override injection successful');
    } else {
        console.log('⏳ Camera methods not ready yet, will retry...');
        
        // Retry every 500ms for up to 10 seconds
        let retryCount = 0;
        const maxRetries = 20;
        
        const retryInterval = setInterval(() => {
            retryCount++;
            console.log(`🔄 Retry ${retryCount}/${maxRetries} - checking for camera methods...`);
            
            if (overrideCameraMethod()) {
                console.log('✅ Camera override successful on retry');
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                console.log('❌ Camera override failed after max retries');
                clearInterval(retryInterval);
                
                // Show available window properties for debugging
                console.log('🔍 Available window properties containing "camera":');
                Object.keys(window).filter(key => key.toLowerCase().includes('camera')).forEach(key => {
                    console.log(`  ${key}:`, window[key]);
                });
            }
        }, 500);
    }
    
    // Expose test function
    window.testEventDialog = showEventDialog;
    
    console.log('📱 Camera override injection complete');
    console.log('🧪 Test function available: testEventDialog()');
    
})();