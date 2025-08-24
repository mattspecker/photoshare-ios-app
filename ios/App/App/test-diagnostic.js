// Simple test to verify diagnostic function availability
console.log('🧪 test-diagnostic.js loading...');

// Wait for DOM and scripts to load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧪 DOM loaded - checking for diagnostic functions...');
    
    setTimeout(() => {
        console.log('🔍 Checking window.runPluginDiagnostic:', typeof window.runPluginDiagnostic);
        console.log('🔍 All window properties with "diagnostic":', 
            Object.keys(window).filter(key => key.toLowerCase().includes('diagnostic')));
        console.log('🔍 All window properties with "plugin":', 
            Object.keys(window).filter(key => key.toLowerCase().includes('plugin')));
        
        if (typeof window.runPluginDiagnostic === 'function') {
            console.log('✅ runPluginDiagnostic is available!');
            window.testDiagnosticAvailable = true;
        } else {
            console.log('❌ runPluginDiagnostic is NOT available');
            window.testDiagnosticAvailable = false;
            
            // Try to debug what's happening with the diagnostic script
            console.log('🔍 Checking if diagnostic script ran at all...');
            console.log('🔍 Window has properties:', Object.keys(window).length);
        }
    }, 1000);
});

// Expose a simple test function
window.testSimpleDiagnostic = function() {
    console.log('🧪 Simple diagnostic test running...');
    
    if (window.Capacitor) {
        console.log('✅ Capacitor available');
        if (window.Capacitor.Plugins) {
            console.log('✅ Plugins available:', Object.keys(window.Capacitor.Plugins));
            if (window.Capacitor.Plugins.EventPhotoPicker) {
                console.log('✅ EventPhotoPicker plugin found!');
                return 'Plugin available';
            } else {
                console.log('❌ EventPhotoPicker plugin not found');
                return 'Plugin missing';
            }
        } else {
            console.log('❌ Capacitor.Plugins not available');
            return 'No plugins';
        }
    } else {
        console.log('❌ Capacitor not available');
        return 'No Capacitor';
    }
};

console.log('✅ test-diagnostic.js loaded - function testSimpleDiagnostic() available');
