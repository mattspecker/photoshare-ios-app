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
            
            // Check if this is a permission error
            const errorMessage = error.message || error.errorMessage || '';
            if (errorMessage.includes('Photo library permission required') || 
                errorMessage.includes('enable in Settings') ||
                errorMessage.includes('Privacy') ||
                errorMessage.includes('Photos')) {
                
                console.log('📸 Detected photo permission error - showing settings dialog');
                await this.showPermissionSettingsDialog();
                
                // Return a cancelled result instead of throwing
                return { cancelled: true, reason: 'Photo permissions required' };
            }
            
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
        
        // Check photo permissions first
        const hasPermission = await this.checkPhotoPermissions();
        if (!hasPermission) {
            console.log('❌ Photo permissions not granted, picker test cancelled');
            return { error: 'Photo permissions not granted' };
        }
        
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
    
    async checkPhotoPermissions() {
        console.log('📸 Checking photo/video permissions...');
        
        if (!this.isReady) {
            console.error('❌ EventPhotoPicker not ready for permission check');
            return false;
        }
        
        try {
            // Use Capacitor Camera plugin to check permissions
            const Camera = window.Capacitor?.Plugins?.Camera;
            if (!Camera) {
                console.error('❌ Camera plugin not available for permission check');
                return false;
            }
            
            // Check current permission status
            const status = await Camera.checkPermissions();
            console.log('📸 Current photo permissions:', status);
            
            // Handle different permission states
            if (status.photos === 'granted') {
                console.log('✅ Photo permissions already granted');
                return true;
            } else if (status.photos === 'prompt') {
                console.log('🔔 Requesting photo permissions from user...');
                
                // Request permissions - this will show the system dialog
                const result = await Camera.requestPermissions({ permissions: ['photos'] });
                console.log('📸 Permission request result:', result);
                
                if (result.photos === 'granted') {
                    console.log('✅ Photo permissions granted by user');
                    return true;
                } else {
                    console.log('❌ Photo permissions denied by user');
                    return false;
                }
            } else if (status.photos === 'denied') {
                console.log('⚠️ Photo permissions denied - redirecting to settings');
                
                // Take user to app settings
                await this.showPermissionSettingsDialog();
                return false;
            } else if (status.photos === 'limited') {
                console.log('⚠️ Photo permissions limited - redirecting to settings');
                
                // Take user to app settings for limited access
                await this.showPermissionSettingsDialog();
                return false;
            } else {
                console.log('❌ Unknown photo permission status:', status.photos);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error checking photo permissions:', error);
            return false;
        }
    }
    
    async showPermissionSettingsDialog() {
        console.log('⚙️ Showing permission settings dialog...');
        
        // Show native dialog to take user to settings
        const title = 'Photo Access Required';
        const message = 'Photo access is required to select event photos. Please go to Settings > Privacy & Security > Photos and enable "All Photos" access for this app.';
        
        try {
            const Dialog = window.Capacitor?.Plugins?.Dialog;
            if (Dialog) {
                console.log('📱 Showing native dialog for photo permissions');
                const result = await Dialog.confirm({
                    title: title,
                    message: message,
                    okButtonTitle: 'Open Settings',
                    cancelButtonTitle: 'Cancel'
                });
                
                console.log('📱 Dialog result:', result);
                
                if (result.value) {
                    // Open app settings
                    console.log('📱 User chose to open settings');
                    const App = window.Capacitor?.Plugins?.App;
                    if (App) {
                        try {
                            await App.openUrl({ url: 'app-settings:' });
                            console.log('✅ Successfully opened app settings');
                        } catch (settingsError) {
                            console.error('❌ Failed to open settings:', settingsError);
                            // Fallback: show message about manual settings
                            alert('Please manually go to Settings > Privacy & Security > Photos and enable access for this app.');
                        }
                    } else {
                        console.error('❌ App plugin not available');
                        alert('Please manually go to Settings > Privacy & Security > Photos and enable access for this app.');
                    }
                } else {
                    console.log('📱 User cancelled settings dialog');
                }
            } else {
                // Fallback to browser alert
                console.log('📱 Using fallback browser confirm dialog');
                const openSettings = confirm(`${title}\n\n${message}\n\nOpen Settings?`);
                if (openSettings) {
                    // Try to open settings URL
                    try {
                        window.open('app-settings:', '_system');
                        console.log('✅ Attempted to open settings via window.open');
                    } catch (error) {
                        console.error('❌ Failed to open settings via window.open:', error);
                        alert('Please manually go to Settings > Privacy & Security > Photos and enable access for this app.');
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error showing permission dialog:', error);
            // Simple fallback
            alert(`${title}\n\n${message}\n\nPlease manually go to Settings > Privacy & Security > Photos and enable access for this app.`);
        }
    }
    
    async handleUploadClick() {
        try {
            // Check photo permissions first
            const hasPermission = await this.checkPhotoPermissions();
            if (!hasPermission) {
                console.log('❌ Photo permissions not granted, picker cancelled');
                return;
            }
            
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