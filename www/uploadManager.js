/**
 * UploadManager - Delegates to AutoUploadPlugin for proper upload functionality
 */

console.log('📤 UploadManager plugin - delegates to AutoUploadPlugin...');

// Wait for Capacitor to be ready before checking plugins
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (window.Capacitor && window.Capacitor.Plugins) {
            console.log('🔍 ALL PLUGINS:', Object.keys(window.Capacitor.Plugins));
            
            // Check if both UploadManager and AutoUploadPlugin are available
            const hasUploadManager = !!window.Capacitor.Plugins.UploadManager;
            const hasAutoUploadPlugin = !!window.Capacitor.Plugins.AutoUploadPlugin;
            
            console.log('📤 UploadManager available:', hasUploadManager);
            console.log('🚀 AutoUploadPlugin available:', hasAutoUploadPlugin);
            
            if (hasUploadManager && hasAutoUploadPlugin) {
                console.log('✅ UploadManager delegation setup ready');
            }
        } else {
            console.log('❌ Capacitor or Capacitor.Plugins not available yet');
        }
    }, 1000);
});

// Test UploadManager delegation functionality
window.testUploadManagerDelegation = async function() {
    console.log('🧪 Testing UploadManager delegation to AutoUploadPlugin...');
    
    if (!window.Capacitor?.Plugins?.UploadManager) {
        console.log('❌ UploadManager not available');
        return { success: false, error: 'UploadManager not available' };
    }
    
    if (!window.Capacitor?.Plugins?.AutoUploadPlugin) {
        console.log('❌ AutoUploadPlugin not available');
        return { success: false, error: 'AutoUploadPlugin not available' };
    }
    
    try {
        console.log('📤 Testing UploadManager.uploadPhotos delegation...');
        
        // This should now delegate to AutoUploadPlugin.startAutoUploadFlow
        const result = await window.Capacitor.Plugins.UploadManager.uploadPhotos({
            test: true,
            jwtToken: 'test-token'
        });
        
        console.log('✅ UploadManager delegation test result:', result);
        return { 
            success: true, 
            message: 'UploadManager successfully delegates to AutoUploadPlugin',
            result: result
        };
        
    } catch (error) {
        console.log('❌ UploadManager delegation test failed:', error);
        return { 
            success: false, 
            error: error.message || 'Delegation test failed',
            details: error
        };
    }
};

// Test upload status delegation
window.testUploadStatusDelegation = async function() {
    console.log('🧪 Testing UploadManager status delegation...');
    
    if (!window.Capacitor?.Plugins?.UploadManager) {
        return { success: false, error: 'UploadManager not available' };
    }
    
    try {
        const result = await window.Capacitor.Plugins.UploadManager.getUploadStatus();
        console.log('✅ UploadManager status delegation result:', result);
        return { success: true, result: result };
    } catch (error) {
        console.log('❌ UploadManager status delegation failed:', error);
        return { success: false, error: error.message };
    }
};

console.log('✅ UploadManager delegation tests ready');