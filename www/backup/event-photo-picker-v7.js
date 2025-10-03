// Capacitor 7 Plugin Registration for EventPhotoPicker
(function() {
    console.log('📦 Loading EventPhotoPicker with Capacitor 7 API...');
    
    function registerEventPhotoPicker() {
        // Check if Capacitor and registerPlugin are available
        if (!window.Capacitor || !window.Capacitor.registerPlugin) {
            console.error('❌ Capacitor 7 registerPlugin API not available');
            return false;
        }
        
        // Register the plugin using Capacitor 7 API
        const EventPhotoPicker = window.Capacitor.registerPlugin('EventPhotoPicker');
        
        console.log('✅ EventPhotoPicker registered with Capacitor 7 API');
        console.log('📋 Plugin object:', EventPhotoPicker);
        
        // Make it globally available
        window.EventPhotoPickerV7 = EventPhotoPicker;
        
        // Also replace the old window.EventPhotoPicker for backwards compatibility
        if (!window.EventPhotoPicker) {
            window.EventPhotoPicker = EventPhotoPicker;
            console.log('✅ EventPhotoPicker made globally available');
        }
        
        // Test if methods are available
        const methods = ['openEventPhotoPicker', 'getEventPhotosMetadata', 'showEventInfo'];
        methods.forEach(method => {
            if (typeof EventPhotoPicker[method] === 'function') {
                console.log(`✅ Method available: ${method}`);
            } else {
                console.log(`❌ Method missing: ${method}`);
            }
        });
        
        console.log('🎯 EventPhotoPicker Capacitor 7 registration complete');
        return true;
    }
    
    // Try immediate registration
    if (registerEventPhotoPicker()) {
        return;
    }
    
    // If immediate registration failed, wait for Capacitor to be ready
    console.log('⏳ Waiting for Capacitor to be ready...');
    
    const waitForCapacitor = () => {
        if (window.Capacitor && window.Capacitor.registerPlugin) {
            console.log('✅ Capacitor ready - registering EventPhotoPicker');
            registerEventPhotoPicker();
        } else {
            setTimeout(waitForCapacitor, 100);
        }
    };
    
    waitForCapacitor();
    
    // Also try on document ready as a fallback
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!window.Capacitor?.Plugins?.EventPhotoPicker) {
                console.log('🔄 Fallback registration on DOMContentLoaded');
                registerEventPhotoPicker();
            }
        }, 500);
    });
    
})();