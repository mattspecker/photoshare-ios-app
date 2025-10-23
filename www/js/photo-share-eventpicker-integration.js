/**
 * EventPhotoPicker Integration for Photo-Share.app Website - LEGACY
 * This version is being replaced by Phase 2 implementation
 * @deprecated Use photo-share-eventpicker-phase2.js instead
 */

console.log('📸 LEGACY EventPhotoPicker Integration Loading...');
console.log('⚠️ This is the legacy version - Phase 2 version available');

// ===== FIXED: Delayed native app check to wait for Capacitor =====
function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// Initialize function that waits for Capacitor
async function initializeEventPhotoPicker() {
    console.log('🔍 Checking if running in native app...');
    
    // Wait for Capacitor to be available
    await new Promise((resolve) => {
        const checkCapacitor = () => {
            if (window.Capacitor) {
                resolve();
            } else {
                setTimeout(checkCapacitor, 100);
            }
        };
        checkCapacitor();
    });
    
    if (!isNativeApp()) {
        console.log('🌐 Running in web browser - EventPhotoPicker integration disabled');
        // Create stub object to prevent errors
        window.EventPhotoPickerIntegration = {
            isReady: false,
            isNativeApp: false,
            showEventDialog: () => Promise.resolve({ action: 'cancelled', reason: 'Not in native app' }),
            getPhotoMetadata: () => Promise.resolve({ count: 0, photos: [], reason: 'Not in native app' }),
            openPhotoPicker: () => Promise.resolve({ selectedPhotos: [], reason: 'Not in native app' })
        };
        console.log('✅ Photo-Share.app EventPhotoPicker Integration Ready (web browser mode)');
    } else {
        console.log('📱 Running in native app - initializing EventPhotoPicker...');
    
    // Original EventPhotoPicker integration code for native apps
    class EventPhotoPickerIntegration {
        constructor() {
            this.plugin = null;
            this.isReady = false;
            this.isNativeApp = true;
            this.init();
        }
        
        async init() {
            console.log('🚀 Initializing EventPhotoPicker for native app...');
            
            try {
                // Wait for Capacitor to be ready
                await this.waitForCapacitor();
                
                // Wait for EventPhotoPicker plugin to be available
                await this.waitForEventPhotoPicker();
                
                // Only set plugin and isReady if plugin actually exists
                if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                    this.plugin = window.Capacitor.Plugins.EventPhotoPicker;
                    this.isReady = true;
                    console.log('✅ EventPhotoPicker ready for use');
                } else {
                    // EventPhotoPicker plugin not found - integration disabled
                    this.plugin = null;
                    this.isReady = false;
                }
                
            } catch (error) {
                console.error('❌ EventPhotoPicker initialization failed:', error);
                this.isReady = false;
            }
        }
        
        async waitForCapacitor() {
            return new Promise((resolve) => {
                const check = () => {
                    if (window.Capacitor && window.Capacitor.Plugins) {
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }
        
        async waitForEventPhotoPicker() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 200; // 20 seconds total (200 * 100ms) - increased timeout
                
                const check = () => {
                    attempts++;
                    
                    if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                        console.log('✅ EventPhotoPicker plugin detected');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        // EventPhotoPicker not available after timeout - continuing without plugin
                        // Don't reject, just resolve to prevent blocking
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        }
        
        async showEventDialog(eventData) {
            if (!this.isReady) {
                throw new Error('EventPhotoPicker not ready');
            }
            
            try {
                return await this.plugin.showEventInfo(eventData);
            } catch (error) {
                console.error('❌ showEventDialog failed:', error);
                throw error;
            }
        }
        
        async getPhotoMetadata(options) {
            if (!this.isReady) {
                throw new Error('EventPhotoPicker not ready');
            }
            
            try {
                return await this.plugin.getEventPhotosMetadata(options);
            } catch (error) {
                console.error('❌ getPhotoMetadata failed:', error);
                throw error;
            }
        }
        
        async openPhotoPicker(options) {
            if (!this.isReady) {
                throw new Error('EventPhotoPicker not ready');
            }
            
            try {
                return await this.plugin.openEventPhotoPicker(options);
            } catch (error) {
                // Check if this is user cancellation (not an actual error)
                const errorMessage = error.message || error.toString();
                if (errorMessage.toLowerCase().includes('cancelled') || 
                    errorMessage.toLowerCase().includes('canceled')) {
                    console.log('ℹ️ User cancelled photo selection');
                } else {
                    console.error('❌ openPhotoPicker failed:', error);
                }
                throw error;
            }
        }
    }
    
        // Initialize for native app
        window.EventPhotoPickerIntegration = new EventPhotoPickerIntegration();
        console.log('✅ Photo-Share.app EventPhotoPicker Integration Ready (native app mode)');
    }
}

// Start initialization
initializeEventPhotoPicker();

// Global helper functions available in both modes
window.getEventPhotoPickerStatus = function() {
    return {
        isNativeApp: isNativeApp(),
        isReady: window.EventPhotoPickerIntegration?.isReady || false,
        integration: !!window.EventPhotoPickerIntegration
    };
};

console.log('📱 EventPhotoPicker integration status:', window.getEventPhotoPickerStatus());