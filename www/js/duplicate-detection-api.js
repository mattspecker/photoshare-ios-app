/**
 * ENHANCED CHUNKED TRANSFER SYSTEM - DUPLICATE DETECTION API
 * Extension of existing chunked JWT system for API calls
 */

console.log('🔍 PhotoShare Duplicate Detection API Loaded');

/**
 * Fetch uploaded photos for an event using the chunked JWT system
 * This leverages the existing chunked JWT transfer instead of large JavaScript injection
 *
 * @param {string} eventId - The event ID to fetch photos for
 * @returns {Promise<Object>} - API response with photos array
 */
async function fetchUploadedPhotosForEvent(eventId) {
    try {
        console.log('🔍 STEP 1: Starting duplicate detection for event:', eventId);

        // First, ensure we have a fresh JWT token via chunked transfer
        console.log('🔍 STEP 2: Ensuring fresh JWT token...');

        const jwtResult = await window.getSilentJwtTokenForAndroid();
        if (!jwtResult) {
            throw new Error('Failed to obtain JWT token');
        }

        console.log('🔍 STEP 3: JWT token ready, making API call via Capacitor...');

        // Check if Capacitor plugin is available
        if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.EventPhotoPicker) {
            throw new Error('EventPhotoPicker plugin not available');
        }

        // Make the API call via Capacitor plugin (avoids WebView size limitations)
        const response = await window.Capacitor.Plugins.EventPhotoPicker.fetchUploadedPhotos({
            eventId: eventId
        });

        console.log('🔍 STEP 4: API response received:', response);

        // Process the response data
        const photos = response.photos || [];
        console.log('🔍 STEP 5: Found', photos.length, 'uploaded photos');

        // Extract file hashes for duplicate detection
        const photoHashes = [];
        const photoData = [];

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            if (photo && photo.file_hash) {
                photoHashes.push(photo.file_hash);
                photoData.push({
                    hash: photo.file_hash,
                    perceptual_hash: photo.perceptual_hash || '',
                    width: photo.image_width || 0,
                    height: photo.image_height || 0,
                    original_timestamp: photo.original_timestamp || '',
                    file_size: photo.file_size_bytes || 0,
                    filename: photo.file_name || ''
                });
            }
        }

        console.log('🔍 STEP 6: Processed', photoHashes.length, 'photo hashes');

        // Store in window variables for EventPhotoPicker to access
        window.uploadedPhotosData = photoData;
        window.uploadedPhotosHashes = photoHashes;

        console.log('🔍 STEP FINAL: ✅ Successfully fetched uploaded photos');

        return {
            success: true,
            photos: photos,
            hashes: photoHashes,
            data: photoData,
            total: photos.length
        };

    } catch (error) {
        console.error('🔍 ❌ Error fetching uploaded photos:', error);

        // Set empty arrays on error
        window.uploadedPhotosData = [];
        window.uploadedPhotosHashes = [];

        return {
            success: false,
            error: error.message,
            photos: [],
            hashes: [],
            data: [],
            total: 0
        };
    }
}

/**
 * Simple trigger function to be called via small JavaScript injection
 * This replaces the large JavaScript injection with a simple function call
 */
async function triggerDuplicateDetection(eventId) {
    try {
        console.log('🔍 🚀 Triggering duplicate detection for event:', eventId);

        const result = await fetchUploadedPhotosForEvent(eventId);

        if (result.success) {
            console.log('🔍 ✅ Duplicate detection completed successfully');
            return result;
        } else {
            console.error('🔍 ❌ Duplicate detection failed:', result.error);
            return result;
        }

    } catch (error) {
        console.error('🔍 ❌ Error in triggerDuplicateDetection:', error);
        return {
            success: false,
            error: error.message,
            photos: [],
            hashes: [],
            data: [],
            total: 0
        };
    }
}

/**
 * Test function to verify the duplicate detection API is working
 */
async function testDuplicateDetectionAPI(eventId = '3a7b86c0-7d73-492d-8f2f-9245e923d2a8') {
    console.log('🔍 🧪 Testing Duplicate Detection API...');

    try {
        const result = await fetchUploadedPhotosForEvent(eventId);

        if (result.success) {
            console.log('🔍 ✅ Test passed - Duplicate detection API working');
            alert(`🔍 ✅ Duplicate Detection Test PASSED!\n\nEvent: ${eventId}\nPhotos found: ${result.total}\nHashes: ${result.hashes.length}`);
        } else {
            console.log('🔍 ❌ Test failed:', result.error);
            alert(`🔍 ❌ Duplicate Detection Test FAILED!\n\nError: ${result.error}`);
        }

        return result;

    } catch (error) {
        console.error('🔍 ❌ Test error:', error);
        alert(`🔍 ❌ Duplicate Detection Test ERROR!\n\n${error.message}`);
        return null;
    }
}

// Expose functions globally
window.fetchUploadedPhotosForEvent = fetchUploadedPhotosForEvent;
window.triggerDuplicateDetection = triggerDuplicateDetection;
window.testDuplicateDetectionAPI = testDuplicateDetectionAPI;

console.log('🔍 ✅ Duplicate Detection API Ready');

/**
 * INTEGRATION INSTRUCTIONS FOR WEB TEAM:
 *
 * 1. Add this script after the existing chunked-jwt-implementation.js
 * 2. Test with: window.testDuplicateDetectionAPI()
 * 3. Android code can now call: window.triggerDuplicateDetection(eventId)
 * 4. This avoids large JavaScript injection and WebView limitations
 *
 * BENEFITS:
 * - Uses existing chunked JWT transfer system
 * - Makes API calls via Capacitor plugin (no WebView size limits)
 * - Maintains all existing functionality
 * - Much more reliable than JavaScript injection
 * - Better error handling and debugging
 *
 * TESTING:
 * - Open browser console on photo-share.app
 * - Run: window.testDuplicateDetectionAPI('your-event-id')
 * - Should show success dialog with photo count
 * - Check Android logs for "🔍" messages
 */