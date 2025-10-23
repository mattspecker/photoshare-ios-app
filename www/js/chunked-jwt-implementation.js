/**
 * CHUNKED JWT TOKEN TRANSFER IMPLEMENTATION
 * For PhotoShare Web Team Integration
 * 
 * This JavaScript code should be integrated into the PhotoShare web application
 * to split long JWT tokens and send them to the Android EventPhotoPicker plugin
 * in manageable chunks that WebView can handle reliably.
 */

console.log('🧩 PhotoShare Chunked JWT Implementation Loaded');

/**
 * Sends JWT token to Android EventPhotoPicker using chunked transfer
 * This solves the WebView evaluateJavascript() limitation with long strings
 * 
 * @param {string} jwtToken - The complete JWT token to send
 * @param {number} chunkSize - Size of each chunk (default: 200 chars)
 * @returns {Promise<boolean>} - Success status
 */
async function sendJwtTokenToAndroidEventPicker(jwtToken, chunkSize = 200) {
    if (!jwtToken || typeof jwtToken !== 'string') {
        console.error('🧩 ❌ Invalid JWT token provided');
        return false;
    }
    
    // Validate JWT structure before sending
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
        console.error('🧩 ❌ Invalid JWT structure - expected 3 parts, got:', parts.length);
        return false;
    }
    
    console.log(`🧩 Starting chunked JWT transfer - Token length: ${jwtToken.length} chars`);
    console.log(`🧩 Using chunk size: ${chunkSize} chars`);
    
    // Split token into chunks
    const chunks = [];
    for (let i = 0; i < jwtToken.length; i += chunkSize) {
        chunks.push(jwtToken.slice(i, i + chunkSize));
    }
    
    const totalChunks = chunks.length;
    const requestId = `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🧩 Split token into ${totalChunks} chunks (ID: ${requestId})`);
    
    // Check if Capacitor plugin is available
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.EventPhotoPicker) {
        console.error('🧩 ❌ EventPhotoPicker plugin not available');
        return false;
    }
    
    try {
        // Send each chunk sequentially
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            console.log(`🧩 Sending chunk ${i + 1}/${totalChunks} (length: ${chunk.length})`);
            
            await window.Capacitor.Plugins.EventPhotoPicker.sendJwtChunk({
                chunk: chunk,
                index: i,
                total: totalChunks,
                requestId: requestId
            });
            
            console.log(`🧩 ✅ Chunk ${i + 1}/${totalChunks} sent successfully`);
        }
        
        console.log('🧩 ✅ All JWT chunks sent successfully!');
        return true;
        
    } catch (error) {
        console.error('🧩 ❌ Error sending JWT chunks:', error);
        return false;
    }
}

/**
 * Enhanced version of getPhotoShareJwtTokenForAndroid that uses chunked transfer
 * This should replace or augment the existing JWT function
 */
async function getPhotoShareJwtTokenForAndroidChunked() {
    try {
        console.log('🧩 Getting JWT token with chunked transfer...');
        
        // First, get the JWT token using existing method
        let jwtToken = null;
        
        if (window.getPhotoShareJwtTokenForAndroid) {
            console.log('🧩 Using existing getPhotoShareJwtTokenForAndroid function');
            jwtToken = await window.getPhotoShareJwtTokenForAndroid();
        } else if (window.supabase && window.supabase.auth) {
            console.log('🧩 Getting JWT directly from Supabase');
            const { data: { session }, error } = await window.supabase.auth.getSession();
            
            if (error) {
                console.error('🧩 ❌ Supabase session error:', error);
                return null;
            }
            
            if (session && session.access_token) {
                jwtToken = session.access_token;
                console.log('🧩 ✅ Got JWT from Supabase session');
            } else {
                console.log('🧩 ❌ No session or access token available');
                return null;
            }
        } else {
            console.error('🧩 ❌ No JWT source available');
            return null;
        }
        
        if (!jwtToken) {
            console.error('🧩 ❌ No JWT token obtained');
            return null;
        }
        
        console.log(`🧩 JWT token obtained (length: ${jwtToken.length})`);
        
        // Send via chunked transfer if token is long
        if (jwtToken.length > 100) {
            console.log('🧩 Token is long, using chunked transfer...');
            const success = await sendJwtTokenToAndroidEventPicker(jwtToken);
            
            if (success) {
                console.log('🧩 ✅ Chunked transfer completed successfully');
                return jwtToken; // Still return the token for compatibility
            } else {
                console.error('🧩 ❌ Chunked transfer failed');
                return null;
            }
        } else {
            console.log('🧩 Token is short, returning directly');
            return jwtToken;
        }
        
    } catch (error) {
        console.error('🧩 ❌ Error in getPhotoShareJwtTokenForAndroidChunked:', error);
        return null;
    }
}

/**
 * Silent JWT acquisition for seamless upload flow - no modal
 */
async function getSilentJwtTokenForAndroid() {
    try {
        console.log('🔇 Getting JWT token silently (no modal)...');
        
        const result = await getPhotoShareJwtTokenForAndroidChunked();
        
        if (result) {
            console.log('🔇 ✅ Silent JWT acquisition completed successfully');
            console.log(`🔇 Token length: ${result.length} chars, Transfer method: ${result.length > 100 ? 'Chunked' : 'Direct'}`);
        } else {
            console.log('🔇 ❌ Silent JWT acquisition failed - No JWT token obtained');
        }
        
        return result;
        
    } catch (error) {
        console.error('🔇 ❌ Silent JWT acquisition error:', error);
        return null;
    }
}

/**
 * Test function to verify chunked JWT transfer is working
 */
async function testChunkedJwtTransfer() {
    console.log('🧩 🧪 Testing Chunked JWT Transfer...');
    
    try {
        const result = await getPhotoShareJwtTokenForAndroidChunked();
        
        if (result) {
            console.log('🧩 ✅ Test passed - JWT token obtained and chunked transfer completed');
            alert(`🧩 ✅ Chunked JWT Test PASSED!\n\nToken length: ${result.length} chars\nTransfer method: ${result.length > 100 ? 'Chunked' : 'Direct'}`);
        } else {
            console.log('🧩 ❌ Test failed - No JWT token obtained');
            alert('🧩 ❌ Chunked JWT Test FAILED!\n\nNo JWT token could be obtained');
        }
        
        return result;
        
    } catch (error) {
        console.error('🧩 ❌ Test error:', error);
        alert(`🧩 ❌ Chunked JWT Test ERROR!\n\n${error.message}`);
        return null;
    }
}

// Expose functions globally for integration
window.sendJwtTokenToAndroidEventPicker = sendJwtTokenToAndroidEventPicker;
window.getPhotoShareJwtTokenForAndroidChunked = getPhotoShareJwtTokenForAndroidChunked;
window.getSilentJwtTokenForAndroid = getSilentJwtTokenForAndroid;
window.testChunkedJwtTransfer = testChunkedJwtTransfer;

// Auto-replace existing JWT function if it exists
if (window.getPhotoShareJwtTokenForAndroid) {
    console.log('🧩 💡 Existing getPhotoShareJwtTokenForAndroid found - consider using getPhotoShareJwtTokenForAndroidChunked');
    
    // Optionally override the existing function (uncomment to enable)
    // window.getPhotoShareJwtTokenForAndroid = getPhotoShareJwtTokenForAndroidChunked;
    // console.log('🧩 ✅ Replaced getPhotoShareJwtTokenForAndroid with chunked version');
}

console.log('🧩 ✅ Chunked JWT Implementation Ready');

/**
 * INTEGRATION INSTRUCTIONS FOR WEB TEAM:
 * 
 * 1. Add this script to your PhotoShare web application
 * 2. Test with: window.testChunkedJwtTransfer()
 * 3. Use getPhotoShareJwtTokenForAndroidChunked() instead of the old function
 * 4. Or uncomment the auto-replacement code above to automatically upgrade
 * 
 * BENEFITS:
 * - Handles JWT tokens of any length reliably
 * - Works around WebView evaluateJavascript() limitations
 * - Maintains compatibility with existing code
 * - Includes comprehensive error handling and logging
 * - Self-contained - no external dependencies
 * 
 * TESTING:
 * - Open browser console on photo-share.app
 * - Run: window.testChunkedJwtTransfer()
 * - Should show success dialog with token info
 * - Check Android logs for "🧩" messages
 */