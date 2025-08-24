/**
 * UploadManager - Basic Plugin Registration Test
 */

console.log('📤 Testing UploadManager plugin registration...');

// Wait for Capacitor to be ready before checking plugins
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.Capacitor && window.Capacitor.Plugins) {
            console.log('🔍 ALL PLUGINS:', Object.keys(window.Capacitor.Plugins));
        } else {
            console.log('❌ Capacitor or Capacitor.Plugins not available yet');
        }
    }, 1000);
});

// Simple registration test
window.testUploadManagerRegistration = function() {
    console.log('🧪 Testing UploadManager plugin registration...');
    
    if (!window.Capacitor) {
        console.log('❌ Capacitor not available');
        return { success: false, error: 'Capacitor not available' };
    }
    
    if (!window.Capacitor.Plugins) {
        console.log('❌ Capacitor.Plugins not available');
        return { success: false, error: 'Capacitor.Plugins not available' };
    }
    
    const availablePlugins = Object.keys(window.Capacitor.Plugins);
    console.log('📋 Available plugins:', availablePlugins);
    
    if (window.Capacitor.Plugins.UploadManager) {
        console.log('✅ UploadManager plugin found!');
        return { 
            success: true, 
            message: 'UploadManager plugin registered successfully',
            availablePlugins: availablePlugins
        };
    } else {
        console.log('❌ UploadManager plugin not found');
        return { 
            success: false, 
            error: 'UploadManager plugin not registered',
            availablePlugins: availablePlugins
        };
    }
};

console.log('✅ UploadManager registration test ready');