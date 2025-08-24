// Test Script - Event data extraction without native plugin
(function() {
    console.log('📸 Test script loading (no plugin required)...');
    
    // Get current event info from URL and fetch real data
    async function getCurrentEventInfo() {
        console.log('🔍 Getting current event info from photo-share.app...');
        
        // Extract event ID from URL (supports /event/:eventId, /camera/:eventId, /join/:eventCode)
        const path = window.location.pathname;
        const eventIdMatch = path.match(/\/(?:event|camera|join)\/([^/?]+)/);
        
        if (!eventIdMatch) {
            console.log('❌ No event ID found in URL');
            return null;
        }
        
        const eventId = eventIdMatch[1];
        console.log('📋 Found event ID:', eventId);
        
        try {
            // Try to access Supabase client from the page
            if (window.supabase) {
                console.log('✅ Supabase client found, fetching event data...');
                
                const { data: eventData, error } = await window.supabase
                    .from('events')
                    .select(`
                        event_id,
                        name,
                        start_time,
                        end_time,
                        status,
                        timezone,
                        owner_id
                    `)
                    .eq('event_id', eventId)
                    .single();
                
                if (error) {
                    console.error('❌ Error fetching event data:', error);
                    return null;
                }
                
                console.log('✅ Fetched event data:', eventData);
                
                return {
                    eventId: eventData.event_id,
                    eventName: eventData.name,
                    startTime: new Date(eventData.start_time),
                    endTime: new Date(eventData.end_time),
                    isLive: eventData.status === 'live',
                    timezone: eventData.timezone,
                    ownerId: eventData.owner_id,
                    status: eventData.status
                };
            } else {
                console.log('⚠️ Supabase client not found on window object');
                return null;
            }
        } catch (error) {
            console.error('❌ Error getting current event info:', error);
            return null;
        }
    }
    
    // Extract event data with real API data
    async function extractEventData() {
        console.log('🔍 Extracting event data from photo-share.app...');
        
        // Get real event data from API
        const eventInfo = await getCurrentEventInfo();
        
        if (eventInfo) {
            console.log('✅ Using real event data from API');
            console.log('📊 Event info details:', eventInfo);
            
            // Extract user (look for common patterns)
            let user = 'Unknown User';
            const userElement = document.querySelector('[data-user-id]') || 
                               document.querySelector('.user-id') ||
                               document.querySelector('.current-user') ||
                               document.querySelector('.user-name') ||
                               document.querySelector('[data-user]');
            if (userElement) {
                user = userElement.textContent.trim() || userElement.getAttribute('data-user-id') || userElement.getAttribute('data-user');
            }
            
            const extractedData = {
                eventName: eventInfo.eventName,
                user: user,
                eventId: eventInfo.eventId,
                startDate: eventInfo.startTime.toISOString(),
                endDate: eventInfo.endTime.toISOString(),
                isLive: eventInfo.isLive,
                timezone: eventInfo.timezone,
                status: eventInfo.status
            };
            
            console.log('📋 Final extracted data:', extractedData);
            return extractedData;
        } else {
            console.log('⚠️ Falling back to page extraction');
            
            // Fallback to page extraction
            const pathMatch = window.location.pathname.match(/\/(?:event|camera|join)\/([^/?]+)/);
            const eventId = pathMatch?.[1] || 'unknown-event-id';
            
            // Extract event name from page
            let eventName = 'Unknown Event';
            const nameSelectors = ['h1', '.event-title', '[data-event-name]', 'title'];
            for (const selector of nameSelectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    eventName = element.textContent.trim();
                    break;
                }
            }
            
            // Extract user
            let user = 'Unknown User';
            const userElement = document.querySelector('[data-user-id]') || 
                               document.querySelector('.user-id') ||
                               document.querySelector('.current-user') ||
                               document.querySelector('.user-name') ||
                               document.querySelector('[data-user]');
            if (userElement) {
                user = userElement.textContent.trim() || userElement.getAttribute('data-user-id') || userElement.getAttribute('data-user');
            }
            
            // Fallback dates
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
            const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            
            return {
                eventName,
                user,
                eventId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                isLive: false,
                timezone: 'UTC'
            };
        }
    }
    
    // Test function to show event data without plugin
    async function showTestDialog() {
        console.log('🎯 Showing test dialog with event data (no plugin required)...');
        
        // Extract real event data from page
        const eventData = await extractEventData();
        
        // Check Capacitor status
        console.log('🔍 Capacitor debug info:', {
            capacitorExists: !!window.Capacitor,
            isNativePlatform: window.Capacitor?.isNativePlatform?.(),
            plugins: window.Capacitor?.Plugins ? Object.keys(window.Capacitor.Plugins) : 'No plugins'
        });
        
        // Build message with extracted data
        const message = `📅 Event Name: ${eventData.eventName}
🕐 Start Date: ${eventData.startDate}
🕐 End Date: ${eventData.endDate}
🌍 Timezone: ${eventData.timezone}
📸 Photos in date range: [Plugin not available - would need EventPhotoPicker]

Event data extraction is working! ✅

🔍 Capacitor Status:
- Platform: ${window.Capacitor?.isNativePlatform?.() ? 'Native' : 'Web'}
- Plugins: ${window.Capacitor?.Plugins ? Object.keys(window.Capacitor.Plugins).length : 0} available

📱 Testing Mode (No Plugin Required)`;
        
        if (window.Capacitor?.Plugins?.Dialog) {
            const result = await window.Capacitor.Plugins.Dialog.confirm({
                title: '📸 Event Data Test',
                message: message,
                okButtonTitle: 'Data Looks Good',
                cancelButtonTitle: 'Close'
            });
            
            if (result.value) {
                await window.Capacitor.Plugins.Dialog.alert({
                    title: '✅ Success!',
                    message: 'Event data extraction is working perfectly!\n\nNext step: Fix EventPhotoPicker plugin registration.'
                });
            }
        } else {
            alert(`📸 Event Data Test\n\n${message}`);
        }
    }
    
    // Override upload buttons with test version
    function overrideUploadButtons() {
        const buttons = document.querySelectorAll('button');
        let found = 0;
        
        buttons.forEach(button => {
            const text = (button.textContent || '').toLowerCase();
            
            if (text.includes('upload') || text.includes('share') || text.includes('photo')) {
                console.log('📤 Found upload button:', text.substring(0, 30));
                
                // Clone button to remove existing listeners
                const newButton = button.cloneNode(true);
                
                // Add our click handler
                newButton.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📸 Upload button intercepted! (Test mode)');
                    showTestDialog();
                    return false;
                };
                
                // Replace the button
                button.parentNode.replaceChild(newButton, button);
                found++;
            }
        });
        
        console.log(`✅ Overrode ${found} upload buttons (test mode)`);
        return found;
    }
    
    // Run after page loads
    setTimeout(overrideUploadButtons, 1000);
    
    // Expose test functions
    window.testEventDataOnly = showTestDialog;
    window.extractEventData = extractEventData;
    window.getCurrentEventInfo = getCurrentEventInfo;
    window.overrideButtonsTest = overrideUploadButtons;
    
    console.log('✅ Test script ready (no plugin required)');
    console.log('🧪 Test: testEventDataOnly()');
    
})();