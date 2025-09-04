/**
 * EventPhotoPicker - Clean Integration
 * Single source of truth for EventPhotoPicker functionality
 */

console.log('📸 EventPhotoPicker Integration Loading...');

class EventPhotoPickerIntegration {
    constructor() {
        this.plugin = null;
        this.isReady = false;
        this.isNativeApp = this.checkNativeApp();
        
        if (this.isNativeApp) {
            this.init();
        } else {
            console.log('📱 Not running in native app - EventPhotoPicker disabled');
        }
    }
    
    checkNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }
    
    async init() {
        console.log('🚀 Initializing EventPhotoPicker...');
        
        try {
            // Wait for Capacitor to be ready
            await this.waitForCapacitor();
            
            // Wait for plugin to be available (Capacitor auto-registers from packageClassList)
            await this.waitForPlugin();
            
            // Get plugin reference directly from Capacitor.Plugins
            this.plugin = window.Capacitor.Plugins.EventPhotoPicker;
            console.log('✅ EventPhotoPicker plugin found and connected');
            
            this.isReady = true;
            console.log('✅ EventPhotoPicker ready for use');
            
            // Expose global methods
            this.exposeGlobalMethods();
            
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
    
    async waitForPlugin() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds
            
            const check = () => {
                attempts++;
                
                console.log(`🔍 Attempt ${attempts}/${maxAttempts} - Checking for EventPhotoPicker plugin...`);
                console.log('Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
                
                if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                    console.log('✅ EventPhotoPicker plugin found in Capacitor.Plugins');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ EventPhotoPicker plugin not found after 10 seconds');
                    console.error('Final plugin list:', Object.keys(window.Capacitor?.Plugins || {}));
                    reject(new Error('EventPhotoPicker plugin not available after 10 seconds'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    exposeGlobalMethods() {
        // Expose simple test methods
        window.testEventInfo = () => this.testShowEventInfo();
        window.testPhotoMetadata = () => this.testGetPhotoMetadata();
        window.testPhotoPicker = () => this.testOpenPhotoPicker();
        
        console.log('🧪 Global test methods available:');
        console.log('  - testEventInfo()');
        console.log('  - testPhotoMetadata()');
        console.log('  - testPhotoPicker()');
    }
    
    // Core Methods
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
            console.error('❌ openPhotoPicker failed:', error);
            throw error;
        }
    }
    
    // Test Methods
    async testShowEventInfo() {
        console.log('🧪 Testing showEventInfo...');
        
        const eventData = {
            eventName: 'Test Event',
            eventId: 'test-123',
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            timezone: 'America/New_York'
        };
        
        try {
            const result = await this.showEventDialog(eventData);
            console.log('✅ showEventInfo SUCCESS:', result);
            return result;
        } catch (error) {
            console.error('❌ showEventInfo FAILED:', error);
            return { error: error.message };
        }
    }
    
    async testGetPhotoMetadata() {
        console.log('🧪 Testing getPhotoMetadata...');
        
        const options = {
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            uploadedPhotoIds: [],
            timezone: 'America/New_York'
        };
        
        try {
            const result = await this.getPhotoMetadata(options);
            console.log('✅ getPhotoMetadata SUCCESS:', result);
            return result;
        } catch (error) {
            console.error('❌ getPhotoMetadata FAILED:', error);
            return { error: error.message };
        }
    }
    
    async testOpenPhotoPicker() {
        console.log('🧪 Testing openPhotoPicker...');
        
        const options = {
            eventName: 'Test Event Photos',
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            uploadedPhotoIds: [],
            timezone: 'America/New_York',
            maxSelections: 5
        };
        
        try {
            const result = await this.openPhotoPicker(options);
            console.log('✅ openPhotoPicker SUCCESS:', result);
            return result;
        } catch (error) {
            console.error('❌ openPhotoPicker FAILED:', error);
            return { error: error.message };
        }
    }
    
    // Camera Override for Photo-Share.app Integration
    setupCameraOverride() {
        console.log('⚠️ Camera override DISABLED - CustomCameraPlugin handles direct camera flow');
        console.log('🎥 All camera buttons will use native Camera → PhotoEditor integration');
        return; // Early return - disable camera override
        
        if (!window.location.href.includes('photo-share.app')) {
            return;
        }
        
        console.log('🌐 Setting up camera override for photo-share.app...');
        
        // Override upload buttons
        this.overrideUploadButtons();
        
        // Monitor for dynamically added buttons
        this.setupButtonMonitoring();
    }
    
    overrideUploadButtons() {
        const buttons = document.querySelectorAll('button');
        let overrideCount = 0;
        
        buttons.forEach(button => {
            const text = (button.textContent || '').toLowerCase();
            
            if (text.includes('upload') || text.includes('photo') || text.includes('camera')) {
                console.log('📤 Overriding upload button:', text.substring(0, 30));
                
                // Store original click handler
                const originalClick = button.onclick;
                
                // Replace with our handler
                button.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    console.log('🎯 Upload button intercepted - launching EventPhotoPicker');
                    this.handleUploadClick();
                    
                    return false;
                };
                
                overrideCount++;
            }
        });
        
        console.log(`✅ Overrode ${overrideCount} upload buttons`);
    }
    
    setupButtonMonitoring() {
        // Monitor for new buttons added to DOM
        const observer = new MutationObserver(() => {
            setTimeout(() => this.overrideUploadButtons(), 500);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    async handleUploadClick() {
        try {
            // Get current event data from page
            const eventData = this.extractEventData();
            
            console.log('📋 Event data extracted:', eventData);
            
            // Show event info dialog first
            const dialogResult = await this.showEventDialog(eventData);
            
            if (dialogResult.action === 'continue') {
                // Open photo picker
                const pickerResult = await this.openPhotoPicker(eventData);
                console.log('📸 Photo picker result:', pickerResult);
                
                // TODO: Process selected photos for upload
                
            } else {
                console.log('❌ User cancelled event dialog');
            }
            
        } catch (error) {
            console.error('❌ Upload click handling failed:', error);
            
            // Fallback: show error dialog
            alert(`Event Photo Picker Error: ${error.message}\n\nPlease try again or use regular upload.`);
        }
    }
    
    extractEventData() {
        // Extract event information from current page
        // This will be enhanced based on photo-share.app structure
        
        return {
            eventName: 'Current Event',
            eventId: 'extracted-event-id',
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            uploadedPhotoIds: []
        };
    }
    
    // Status Methods
    getStatus() {
        return {
            isNativeApp: this.isNativeApp,
            isReady: this.isReady,
            pluginAvailable: !!window.Capacitor?.Plugins?.EventPhotoPicker
        };
    }
}

// Initialize the integration
const eventPhotoPickerApp = new EventPhotoPickerIntegration();

// Make available globally
window.EventPhotoPickerApp = eventPhotoPickerApp;

// Auto-setup camera override after page loads
if (window.EventPhotoPickerApp.isNativeApp) {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            eventPhotoPickerApp.setupCameraOverride();
        }, 1000);
    });
    
    // Also try on navigation changes
    let currentUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            setTimeout(() => {
                eventPhotoPickerApp.setupCameraOverride();
            }, 1000);
        }
    }, 1000);
}

console.log('✅ EventPhotoPicker Integration Ready');
console.log('📱 Status:', eventPhotoPickerApp.getStatus());