/**
 * IMMEDIATE FIX FOR WEB TEAM
 * Replace the red button JWT test code with this corrected version
 */

console.log('🔧 Loading corrected JWT integration for red button test...');

// CORRECTED: Replace the failing CapacitorCustom code with this
async function sendJwtTokenToRedBox(token) {
    if (!token || token === 'null' || token === 'FUNCTION_NOT_FOUND') {
        console.error('🔍 RED BOX: Invalid token provided:', token);
        return false;
    }

    console.log(`🔍 RED BOX: Starting chunked transfer for token (length: ${token.length})`);

    // Check if EventPhotoPicker plugin is available
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.EventPhotoPicker) {
        console.error('🔍 RED BOX: EventPhotoPicker plugin not available');
        alert('❌ EventPhotoPicker plugin not available');
        return false;
    }

    try {
        // Use the chunked transfer method from our implementation
        const success = await sendJwtTokenToAndroidEventPicker(token, 200);

        if (success) {
            console.log('🔍 RED BOX: ✅ Chunked JWT transfer completed successfully!');
            alert('✅ RED BOX JWT SUCCESS!\n\nToken transferred via chunked method\nLength: ' + token.length + ' chars');
        } else {
            console.error('🔍 RED BOX: ❌ Chunked transfer failed');
            alert('❌ RED BOX JWT FAILED!\n\nChunked transfer unsuccessful');
        }

        return success;

    } catch (error) {
        console.error('🔍 RED BOX: Error in chunked transfer:', error);
        alert('❌ RED BOX JWT ERROR!\n\n' + error.message);
        return false;
    }
}

// CORRECTED: Red button handler (replace the existing one)
async function handleRedBoxJwtTest() {
    console.log('🔍 RED BOX: Starting JWT test with chunked transfer...');

    try {
        // Get the JWT token
        console.log('🔍 RED BOX: Calling getPhotoShareJwtTokenForAndroid()');
        const token = await window.getPhotoShareJwtTokenForAndroid();

        if (token && token !== 'null' && token !== 'FUNCTION_NOT_FOUND') {
            console.log('🔍 RED BOX: Got token, sending via chunked transfer: TOKEN_' + token.length + '_CHARS');

            // Use corrected chunked transfer instead of CapacitorCustom
            await sendJwtTokenToRedBox(token);

        } else {
            console.error('🔍 RED BOX: No valid token received:', token);
            alert('❌ RED BOX: No valid JWT token available');
        }

    } catch (error) {
        console.error('🔍 RED BOX: JWT test error:', error);
        alert('❌ RED BOX JWT ERROR!\n\n' + error.message);
    }
}

// CORRECTED: Enhanced chunked transfer function (already provided in chunked-jwt-implementation.js)
async function sendJwtTokenToAndroidEventPicker(jwtToken, chunkSize = 200) {
    if (!jwtToken || typeof jwtToken !== 'string') {
        console.error('🧩 ❌ Invalid JWT token provided');
        return false;
    }

    // Validate JWT structure
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

    // Check plugin availability
    if (!window.Capacitor?.Plugins?.EventPhotoPicker) {
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

// Expose globally for the red button
window.handleRedBoxJwtTest = handleRedBoxJwtTest;
window.sendJwtTokenToRedBox = sendJwtTokenToRedBox;
window.sendJwtTokenToAndroidEventPicker = sendJwtTokenToAndroidEventPicker;

console.log('✅ Corrected red button JWT integration loaded');

/**
 * INSTRUCTIONS FOR WEB TEAM:
 *
 * 1. Replace the existing red button handler with handleRedBoxJwtTest()
 * 2. Remove any references to CapacitorCustom (it doesn't exist)
 * 3. Use the EventPhotoPicker.sendJwtChunk() method instead
 * 4. Test by clicking red button - should show success dialog
 * 5. Check Android logs for 🧩 chunking messages
 *
 * WHAT THIS FIXES:
 * - Removes CapacitorCustom error (doesn't exist in Capacitor)
 * - Uses proper chunked transfer via EventPhotoPicker plugin
 * - Handles 1399-character JWT tokens reliably
 * - Shows success/error dialogs for feedback
 */