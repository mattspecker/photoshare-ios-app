/**
 * Custom Camera Integration for PhotoShare
 * Replaces standard Capacitor Camera with advanced editing features
 * Compatible with existing web app camera calls
 */

console.log('📷 ==================== CUSTOM CAMERA INTEGRATION LOADING ====================');
console.log('📷 Script loaded at:', new Date().toISOString());
console.log('📷 Capacitor available:', !!window.Capacitor);
console.log('📷 Capacitor.isNativePlatform available:', !!window.Capacitor?.isNativePlatform);

class CustomCameraIntegration {
    constructor() {
        this.isReady = false;
        this.isNativeApp = this.checkNativeApp();
        
        if (this.isNativeApp) {
            this.init();
        } else {
            console.log('🌐 Not running in native app - Custom Camera disabled');
            this.setupWebFallback();
        }
    }
    
    checkNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }
    
    async init() {
        console.log('🚀 Initializing Custom Camera Integration...');
        
        try {
            // Wait for Capacitor to be ready
            await this.waitForCapacitor();
            
            // Check if our custom camera plugin is available
            if (window.Capacitor?.Plugins?.Camera) {
                console.log('✅ Custom Camera plugin detected');
                this.isReady = true;
                this.overrideStandardCamera();
            } else {
                console.error('❌ Custom Camera plugin not found');
                this.isReady = false;
            }
            
        } catch (error) {
            console.error('❌ Custom Camera initialization failed:', error);
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
    
    overrideStandardCamera() {
        console.log('🔄 Overriding standard camera methods...');
        
        // Store reference to our custom camera
        const customCamera = window.Capacitor.Plugins.Camera;
        
        // Override the getPhoto method that web apps call
        const originalGetPhoto = customCamera.getPhoto;
        customCamera.getPhoto = async (options) => {
            console.log('📷 Custom Camera: getPhoto called with options:', options);
            
            try {
                // Call our custom implementation
                return await originalGetPhoto.call(customCamera, options);
            } catch (error) {
                console.error('❌ Custom Camera getPhoto failed:', error);
                throw error;
            }
        };
        
        // Override pickImages if it exists
        if (customCamera.pickImages) {
            const originalPickImages = customCamera.pickImages;
            customCamera.pickImages = async (options) => {
                console.log('📷 Custom Camera: pickImages called with options:', options);
                
                try {
                    return await originalPickImages.call(customCamera, options);
                } catch (error) {
                    console.error('❌ Custom Camera pickImages failed:', error);
                    throw error;
                }
            };
        }
        
        console.log('✅ Standard camera methods overridden with custom implementation');
    }
    
    setupWebFallback() {
        console.log('🌐 Setting up web fallback for custom camera...');
        
        // For web browsers, provide a fallback that uses standard HTML5 camera
        if (!window.Capacitor) {
            window.Capacitor = { Plugins: {} };
        }
        
        if (!window.Capacitor.Plugins.Camera) {
            window.Capacitor.Plugins.Camera = {
                getPhoto: async (options) => {
                    console.log('🌐 Web fallback camera called');
                    return this.webCameraFallback(options);
                }
            };
        }
    }
    
    async webCameraFallback(options) {
        return new Promise((resolve, reject) => {
            // Create file input for web
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Use rear camera by default
            
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64 = e.target.result;
                        resolve({
                            dataUrl: base64,
                            format: 'jpeg'
                        });
                    };
                    reader.readAsDataURL(file);
                } else {
                    reject(new Error('No file selected'));
                }
            };
            
            // Trigger file picker
            input.click();
        });
    }
    
    // Status check method
    getStatus() {
        return {
            isNativeApp: this.isNativeApp,
            isReady: this.isReady,
            customCameraAvailable: this.isReady && !!window.Capacitor?.Plugins?.Camera
        };
    }
}

// Initialize immediately
const customCameraApp = new CustomCameraIntegration();

// Make available globally for debugging
window.CustomCameraApp = customCameraApp;

// Debug function for testing
window.testCustomCamera = async function() {
    console.log('🧪 ==================== TESTING CUSTOM CAMERA ====================');
    console.log('🧪 Custom Camera App Status:', customCameraApp.getStatus());
    
    console.log('🧪 Checking Capacitor availability:');
    console.log('  - window.Capacitor:', !!window.Capacitor);
    console.log('  - window.Capacitor.Plugins:', !!window.Capacitor?.Plugins);
    console.log('  - Camera plugin:', !!window.Capacitor?.Plugins?.Camera);
    
    if (window.Capacitor?.Plugins?.Camera) {
        try {
            console.log('📷 Available Camera methods:', Object.keys(window.Capacitor.Plugins.Camera));
            console.log('📷 Calling Camera.getPhoto() with test options...');
            
            const options = {
                quality: 90,
                allowEditing: true,
                resultType: 'dataUrl',
                source: 'camera'
            };
            console.log('📷 Camera options:', options);
            
            const result = await window.Capacitor.Plugins.Camera.getPhoto(options);
            
            console.log('✅ Camera result received:', result);
            return result;
        } catch (error) {
            console.error('❌ Camera test failed:', error);
            console.error('❌ Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return { error: error.message };
        }
    } else {
        console.log('❌ Camera plugin not available');
        console.log('❌ Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
        return { error: 'Camera plugin not available' };
    }
};

// Integrate with existing PhotoShare debug system
if (window.PhotoShareDebug) {
    window.PhotoShareDebug.testCustomCamera = () => window.testCustomCamera?.();
    window.PhotoShareDebug.getCustomCameraStatus = () => window.CustomCameraApp?.getStatus?.();
}

console.log('✅ ==================== CUSTOM CAMERA INTEGRATION READY ====================');
console.log('📷 Final Status:', customCameraApp.getStatus());
console.log('📷 window.testCustomCamera available:', typeof window.testCustomCamera);
console.log('📷 window.CustomCameraApp available:', !!window.CustomCameraApp);

// Force add to global scope for debugging
if (typeof window.testCustomCamera === 'undefined') {
    console.log('⚠️ testCustomCamera not available, adding to global scope...');
    // The function should already be defined above, but let's make sure
}

// Test if our class is working
try {
    const status = customCameraApp.getStatus();
    console.log('📷 Integration test successful:', status);
} catch (error) {
    console.error('❌ Integration test failed:', error);
}