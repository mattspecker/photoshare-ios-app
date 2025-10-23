/**
 * WebView JWT Token Testing Helper
 * Use this to test JWT token retrieval from Android WebView
 */

console.log('📱 WebView JWT Test Helper loaded');

// Simple test function that can be called from Android WebView
window.testWebViewJWT = async function() {
    console.log('🧪 Starting WebView JWT Test...');
    
    try {
        // Test 1: Check if function exists
        console.log('🔍 Test 1 - Function availability:');
        console.log('- getJwtTokenForNativePlugin exists:', typeof window.getJwtTokenForNativePlugin);
        
        if (!window.getJwtTokenForNativePlugin) {
            console.log('❌ JWT function not available - auth bridge may not be loaded');
            return { success: false, error: 'JWT function not available' };
        }

        // Test 2: Call the JWT function
        console.log('🔍 Test 2 - Calling JWT function...');
        const token = await window.getJwtTokenForNativePlugin();
        
        // Test 3: Analyze result
        console.log('🔍 Test 3 - Result analysis:');
        const result = {
            success: !!token,
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            tokenPreview: token ? `${token.substring(0, 20)}...` : null,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ WebView JWT Test Result:', result);
        return result;
        
    } catch (error) {
        console.log('❌ WebView JWT Test Failed:', error);
        const errorResult = {
            success: false,
            error: error.message,
            errorName: error.name,
            timestamp: new Date().toISOString()
        };
        console.log('❌ Error Details:', errorResult);
        return errorResult;
    }
};

// Alternative simple test that returns a Promise for easier Android handling
window.getJWTTokenSimple = function() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('🔍 Simple JWT retrieval starting...');
            
            if (!window.getJwtTokenForNativePlugin) {
                reject(new Error('JWT function not available'));
                return;
            }
            
            const token = await window.getJwtTokenForNativePlugin();
            
            if (token) {
                console.log('✅ Simple JWT retrieval successful');
                resolve(token);
            } else {
                console.log('❌ Simple JWT retrieval returned null');
                reject(new Error('No token available'));
            }
        } catch (error) {
            console.log('❌ Simple JWT retrieval failed:', error);
            reject(error);
        }
    });
};

// Debug context function
window.debugWebViewContext = function() {
    console.log('🔍 WebView Context Debug:');
    
    const context = {
        // User Agent Detection
        userAgent: navigator.userAgent,
        isWebView: /WebView|wv/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        
        // Capacitor Detection
        capacitorAvailable: !!window.Capacitor,
        capacitorIsNative: window.Capacitor?.isNativePlatform?.(),
        capacitorPlugins: !!window.Capacitor?.Plugins,
        capacitorPlatform: window.Capacitor?.getPlatform?.(),
        
        // Supabase Detection
        supabaseAvailable: !!window.supabase,
        supabaseAuth: !!window.supabase?.auth,
        
        // Auth Functions Detection
        authBridge: !!window.PhotoShareAuthBridge,
        jwtFunction: !!window.getJwtTokenForNativePlugin,
        authState: !!window.PhotoShareAuthState,
        
        // DOM State
        documentReady: document.readyState,
        windowLoaded: document.readyState === 'complete',
        
        // Timestamp
        timestamp: new Date().toISOString()
    };
    
    console.log('WebView Context:', context);
    return context;
};

// Auto-run context debug when loaded
setTimeout(() => {
    console.log('🔍 Auto-running WebView context debug...');
    window.debugWebViewContext();
}, 1000);

console.log('✅ WebView JWT test functions available:');
console.log('- testWebViewJWT(): Full test with detailed logging');
console.log('- getJWTTokenSimple(): Simple token retrieval');
console.log('- debugWebViewContext(): Context information');