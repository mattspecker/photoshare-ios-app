/**
 * AppPermissionPlugin Integration
 * Provides the required native methods for the onboarding permission flow
 * Compatible with Capacitor 7.4.3
 */

console.log('📱 AppPermissionPlugin Integration Loading...');

class AppPermissionIntegration {
    constructor() {
        this.plugin = null;
        this.isReady = false;
        this.isNativeApp = this.checkNativeApp();
        
        if (this.isNativeApp) {
            this.init();
        } else {
            console.log('🌐 Not running in native app - AppPermissionPlugin disabled');
        }
    }
    
    checkNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }
    
    async init() {
        console.log('🚀 Initializing AppPermissionPlugin Integration...');
        
        try {
            // Wait for Capacitor to be ready
            await this.waitForCapacitor();
            
            // Register the plugin using Capacitor 7 method
            const { registerPlugin } = window.Capacitor || {};
            if (registerPlugin) {
                console.log('📱 Registering AppPermissionPlugin...');
                this.plugin = registerPlugin('AppPermissionPlugin');
            } else {
                // Fallback to direct access
                this.plugin = window.Capacitor?.Plugins?.AppPermissionPlugin;
            }
            
            if (this.plugin) {
                this.isReady = true;
                console.log('✅ AppPermissionPlugin ready for use');
                this.exposeGlobalMethods();
            } else {
                console.error('❌ AppPermissionPlugin not found');
            }
            
        } catch (error) {
            console.error('❌ AppPermissionPlugin initialization failed:', error);
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
    
    exposeGlobalMethods() {
        // Create CapacitorApp namespace if it doesn't exist
        if (!window.CapacitorApp) {
            window.CapacitorApp = {};
        }
        
        // Expose the required methods for the web app
        window.CapacitorApp.isFirstLaunch = async () => {
            console.log('📱 Checking if first launch...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return false;
            }
            
            try {
                const result = await this.plugin.isFirstLaunch();
                console.log('📱 First launch check result:', result);
                // Return the boolean value directly
                return result.value !== undefined ? result.value : false;
            } catch (error) {
                console.error('❌ Error checking first launch:', error);
                return false;
            }
        };
        
        window.CapacitorApp.requestNotificationPermission = async () => {
            console.log('🔔 Requesting notification permission...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return { granted: false, error: 'Plugin not ready' };
            }
            
            try {
                const result = await this.plugin.requestNotificationPermission();
                console.log('🔔 Notification permission result:', result);
                return result;
            } catch (error) {
                console.error('❌ Error requesting notification permission:', error);
                return { granted: false, error: error.message };
            }
        };
        
        window.CapacitorApp.requestCameraPermission = async () => {
            console.log('📷 Requesting camera permission...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return { granted: false, error: 'Plugin not ready' };
            }
            
            try {
                const result = await this.plugin.requestCameraPermission();
                console.log('📷 Camera permission result:', result);
                return result;
            } catch (error) {
                console.error('❌ Error requesting camera permission:', error);
                return { granted: false, error: error.message };
            }
        };
        
        window.CapacitorApp.requestPhotoPermission = async () => {
            console.log('🖼️ Requesting photo library permission...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return { granted: false, error: 'Plugin not ready' };
            }
            
            try {
                const result = await this.plugin.requestPhotoPermission();
                console.log('🖼️ Photo permission result:', result);
                return result;
            } catch (error) {
                console.error('❌ Error requesting photo permission:', error);
                return { granted: false, error: error.message };
            }
        };
        
        window.CapacitorApp.markOnboardingComplete = async () => {
            console.log('✅ Marking onboarding as complete...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return;
            }
            
            try {
                await this.plugin.markOnboardingComplete();
                console.log('✅ Onboarding marked complete');
            } catch (error) {
                console.error('❌ Error marking onboarding complete:', error);
            }
        };
        
        // Additional helper method to check onboarding status
        window.CapacitorApp.isOnboardingComplete = async () => {
            console.log('📱 Checking if onboarding is complete...');
            if (!this.isReady || !this.plugin) {
                console.error('❌ AppPermissionPlugin not ready');
                return false;
            }
            
            try {
                const result = await this.plugin.isOnboardingComplete();
                console.log('📱 Onboarding complete check result:', result);
                return result.value !== undefined ? result.value : false;
            } catch (error) {
                console.error('❌ Error checking onboarding status:', error);
                return false;
            }
        };
        
        console.log('✅ AppPermissionPlugin methods exposed on window.CapacitorApp');
        console.log('Available methods:');
        console.log('  - window.CapacitorApp.isFirstLaunch()');
        console.log('  - window.CapacitorApp.requestNotificationPermission()');
        console.log('  - window.CapacitorApp.requestCameraPermission()');
        console.log('  - window.CapacitorApp.requestPhotoPermission()');
        console.log('  - window.CapacitorApp.markOnboardingComplete()');
        console.log('  - window.CapacitorApp.isOnboardingComplete()');
    }
    
    // Status check method
    getStatus() {
        return {
            isNativeApp: this.isNativeApp,
            isReady: this.isReady,
            pluginAvailable: !!this.plugin,
            methodsExposed: !!(window.CapacitorApp?.isFirstLaunch)
        };
    }
}

// Initialize immediately
const appPermissionApp = new AppPermissionIntegration();

// Make available globally
window.AppPermissionApp = appPermissionApp;

// Debug function for testing
window.testAppPermissions = async function() {
    console.log('🧪 Testing AppPermissionPlugin...');
    console.log('Plugin status:', appPermissionApp.getStatus());
    
    if (window.CapacitorApp?.isFirstLaunch) {
        console.log('Testing isFirstLaunch...');
        const isFirst = await window.CapacitorApp.isFirstLaunch();
        console.log('Is first launch?', isFirst);
        
        console.log('Testing isOnboardingComplete...');
        const isComplete = await window.CapacitorApp.isOnboardingComplete();
        console.log('Is onboarding complete?', isComplete);
        
        return { isFirstLaunch: isFirst, isOnboardingComplete: isComplete };
    } else {
        console.log('❌ AppPermissionPlugin methods not available');
        return null;
    }
};

console.log('✅ AppPermissionPlugin Integration Ready');
console.log('📱 Status:', appPermissionApp.getStatus());