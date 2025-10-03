// Manual EventPhotoPicker Test Script
console.log('🧪 Manual EventPhotoPicker test script loading...');

// Function to manually register and test EventPhotoPicker
window.testEventPhotoPickerManual = async function() {
    console.log('🚀 Starting manual EventPhotoPicker test...');
    
    try {
        // Step 1: Manual registration
        console.log('📦 Step 1: Manual plugin registration...');
        if (!window.Capacitor?.registerPlugin) {
            throw new Error('Capacitor.registerPlugin not available');
        }
        
        const EventPhotoPicker = window.Capacitor.registerPlugin('EventPhotoPicker');
        console.log('✅ Plugin registered:', !!EventPhotoPicker);
        
        // Step 2: Verify plugin is available in Plugins
        console.log('📦 Step 2: Verify plugin availability...');
        const pluginAvailable = !!window.Capacitor.Plugins.EventPhotoPicker;
        console.log('✅ Plugin in Capacitor.Plugins:', pluginAvailable);
        
        if (!pluginAvailable) {
            throw new Error('Plugin not available after registration');
        }
        
        // Step 3: Test showEventInfo method
        console.log('📦 Step 3: Testing showEventInfo method...');
        const eventData = {
            eventName: 'Manual Test Event',
            eventId: 'test-event-123',
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            timezone: 'America/New_York'
        };
        
        const showEventResult = await window.Capacitor.Plugins.EventPhotoPicker.showEventInfo(eventData);
        console.log('✅ showEventInfo result:', showEventResult);
        
        // Step 4: Test getEventPhotosMetadata method
        console.log('📦 Step 4: Testing getEventPhotosMetadata method...');
        const metadataResult = await window.Capacitor.Plugins.EventPhotoPicker.getEventPhotosMetadata({
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            uploadedPhotoIds: [],
            timezone: 'America/New_York'
        });
        console.log('✅ getEventPhotosMetadata result:', metadataResult);
        
        // Step 5: Test openEventPhotoPicker method (this opens the photo picker UI)
        console.log('📦 Step 5: Testing openEventPhotoPicker method...');
        const pickerResult = await window.Capacitor.Plugins.EventPhotoPicker.openEventPhotoPicker({
            eventName: 'Manual Test Event',
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            uploadedPhotoIds: [],
            timezone: 'America/New_York',
            maxSelections: 5
        });
        console.log('✅ openEventPhotoPicker result:', pickerResult);
        
        console.log('🎉 ALL TESTS PASSED! EventPhotoPicker is fully functional!');
        return {
            success: true,
            results: {
                registration: true,
                availability: true,
                showEventInfo: showEventResult,
                getEventPhotosMetadata: metadataResult,
                openEventPhotoPicker: pickerResult
            }
        };
        
    } catch (error) {
        console.error('❌ Manual test failed:', error);
        return {
            success: false,
            error: error.message,
            details: error
        };
    }
};

// Function to test just the metadata (no UI)
window.testEventPhotoMetadata = async function() {
    console.log('🧪 Testing EventPhotoPicker metadata only...');
    
    try {
        // Register plugin if needed
        if (!window.Capacitor.Plugins.EventPhotoPicker) {
            const EventPhotoPicker = window.Capacitor.registerPlugin('EventPhotoPicker');
            console.log('✅ Plugin registered for metadata test');
        }
        
        // Test metadata method
        const result = await window.Capacitor.Plugins.EventPhotoPicker.getEventPhotosMetadata({
            startDate: '2025-08-17T10:00:00Z',
            endDate: '2025-08-17T18:00:00Z',
            uploadedPhotoIds: [],
            timezone: 'America/New_York'
        });
        
        console.log('✅ Metadata test result:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Metadata test failed:', error);
        return { error: error.message };
    }
};

console.log('✅ Manual test functions ready:');
console.log('🧪 testEventPhotoPickerManual() - Full test with UI');
console.log('🧪 testEventPhotoMetadata() - Metadata only test');