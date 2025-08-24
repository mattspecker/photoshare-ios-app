/**
 * Real Event Data Integration for EventPhotoPicker
 * Extracts actual event data from photo-share.app and integrates with EventPhotoPicker
 */

console.log('🎯 Real Event Integration Loading...');

class RealEventIntegration {
    constructor() {
        this.isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
        this.eventPhotoPicker = null;
        this.currentEventData = null;
        
        if (this.isNative) {
            console.log('📱 Native app detected - initializing real event integration');
            this.init();
        } else {
            console.log('🌐 Web browser - real event integration disabled');
        }
    }
    
    async init() {
        try {
            // Wait for EventPhotoPicker to be available
            await this.waitForEventPhotoPicker();
            
            // Extract current event data
            this.currentEventData = this.extractEventData();
            console.log('📋 Extracted event data:', this.currentEventData);
            
            // Test photo count with real event data
            await this.testRealEventPhotoCount();
            
            // Override upload functions
            this.setupUploadOverride();
            
            console.log('✅ Real event integration ready');
            
        } catch (error) {
            console.error('❌ Real event integration failed:', error);
        }
    }
    
    async waitForEventPhotoPicker() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // Increased to 10 seconds
            
            const check = () => {
                attempts++;
                
                // Enhanced debugging
                console.log(`🔍 Attempt ${attempts}/${maxAttempts} - Checking for EventPhotoPicker...`);
                console.log('Available Capacitor plugins:', Object.keys(window.Capacitor?.Plugins || {}));
                
                if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                    this.eventPhotoPicker = window.Capacitor.Plugins.EventPhotoPicker;
                    console.log('✅ EventPhotoPicker plugin found');
                    console.log('Plugin methods available:', Object.keys(this.eventPhotoPicker));
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ EventPhotoPicker not found after 10 seconds');
                    console.error('Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
                    console.error('Capacitor object:', window.Capacitor);
                    reject(new Error('EventPhotoPicker not found after 10 seconds'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    extractEventData() {
        console.log('🔍 Extracting real event data from page...');
        
        const eventData = {
            eventId: this.extractEventId(),
            eventName: this.extractEventName(),
            startDate: this.extractStartDate(),
            endDate: this.extractEndDate(),
            timezone: this.extractTimezone(),
            uploadedPhotoIds: this.extractUploadedPhotoIds()
        };
        
        // Fallback values if extraction fails
        if (!eventData.startDate) {
            // Default to yesterday to tomorrow if no dates found
            const now = new Date();
            eventData.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            eventData.endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        }
        
        if (!eventData.timezone) {
            eventData.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        
        return eventData;
    }
    
    extractEventId() {
        // Extract from URL: /event/[EVENT_ID]
        const urlMatch = window.location.pathname.match(/\/event\/([a-f0-9-]+)/);
        if (urlMatch) {
            console.log('📋 Event ID from URL:', urlMatch[1]);
            return urlMatch[1];
        }
        
        // Try to find in page data
        const metaEvent = document.querySelector('meta[name="event-id"]');
        if (metaEvent) {
            return metaEvent.content;
        }
        
        return 'unknown-event';
    }
    
    extractEventName() {
        // Try page title first
        const title = document.title;
        if (title && !title.includes('PhotoShare')) {
            console.log('📋 Event name from title:', title);
            return title;
        }
        
        // Try main heading
        const h1 = document.querySelector('h1');
        if (h1) {
            console.log('📋 Event name from h1:', h1.textContent);
            return h1.textContent.trim();
        }
        
        // Try event name in data attributes or classes
        const eventElement = document.querySelector('[data-event-name], .event-name, .event-title');
        if (eventElement) {
            return eventElement.textContent.trim() || eventElement.dataset.eventName;
        }
        
        return 'Current Event';
    }
    
    extractStartDate() {
        // Try various selectors for start date
        const selectors = [
            '[data-start-date]',
            '[data-event-start]',
            '.event-start-date',
            '.start-date',
            'time[datetime]:first-of-type'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const date = element.dataset.startDate || 
                           element.dataset.eventStart || 
                           element.getAttribute('datetime') ||
                           element.textContent;
                
                if (date) {
                    console.log('📅 Start date found:', date);
                    return this.normalizeDate(date);
                }
            }
        }
        
        return null;
    }
    
    extractEndDate() {
        // Try various selectors for end date  
        const selectors = [
            '[data-end-date]',
            '[data-event-end]',
            '.event-end-date',
            '.end-date',
            'time[datetime]:last-of-type'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                const date = element.dataset.endDate || 
                           element.dataset.eventEnd || 
                           element.getAttribute('datetime') ||
                           element.textContent;
                
                if (date) {
                    console.log('📅 End date found:', date);
                    return this.normalizeDate(date);
                }
            }
        }
        
        return null;
    }
    
    extractTimezone() {
        // Try to find timezone in page data
        const timezoneElement = document.querySelector('[data-timezone], [data-event-timezone]');
        if (timezoneElement) {
            return timezoneElement.dataset.timezone || timezoneElement.dataset.eventTimezone;
        }
        
        // Default to user's timezone
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    
    extractUploadedPhotoIds() {
        // Look for existing uploaded photos on the page
        const uploadedPhotos = document.querySelectorAll('[data-photo-id], .uploaded-photo');
        const photoIds = [];
        
        uploadedPhotos.forEach(photo => {
            const id = photo.dataset.photoId || photo.id;
            if (id) photoIds.push(id);
        });
        
        console.log('📸 Found uploaded photo IDs:', photoIds);
        return photoIds;
    }
    
    normalizeDate(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (error) {
            console.warn('⚠️ Could not parse date:', dateString);
        }
        return null;
    }
    
    async testRealEventPhotoCount() {
        if (!this.currentEventData) return;
        
        console.log('🧪 Testing photo count with real event data...');
        
        try {
            const result = await this.eventPhotoPicker.getEventPhotosMetadata({
                startDate: this.currentEventData.startDate,
                endDate: this.currentEventData.endDate,
                uploadedPhotoIds: this.currentEventData.uploadedPhotoIds,
                timezone: this.currentEventData.timezone
            });
            
            console.log('✅ Real event photo count results:');
            console.log(`   📸 Total photos: ${result.totalCount}`);
            console.log(`   ⬆️ Uploaded: ${result.uploadedCount}`);
            console.log(`   ⏳ Pending: ${result.pendingCount}`);
            console.log(`   📋 Event: ${this.currentEventData.eventName}`);
            console.log(`   🌍 Timezone: ${this.currentEventData.timezone}`);
            
            // Store result for later use
            this.lastPhotoCount = result;
            
            return result;
            
        } catch (error) {
            console.error('❌ Real event photo count failed:', error);
        }
    }
    
    setupUploadOverride() {
        console.log('🔗 Setting up upload button override...');
        
        // Override existing upload functionality
        this.overrideUploadButtons();
        
        // Monitor for new upload buttons
        this.monitorForNewButtons();
        
        // Add EventPhotoPicker button to page
        this.addEventPhotoPickerButton();
    }
    
    overrideUploadButtons() {
        const uploadButtons = document.querySelectorAll('button, input[type="file"], .upload-btn, [class*="upload"]');
        let overrideCount = 0;
        
        uploadButtons.forEach(button => {
            const text = (button.textContent || button.value || '').toLowerCase();
            
            if (text.includes('upload') || text.includes('photo') || text.includes('camera') || text.includes('add')) {
                console.log('📤 Overriding upload button:', text.substring(0, 30));
                
                // Detect hook type from data attributes or classes
                const hookType = this.detectHookType(button);
                console.log(`🔍 Detected hook type: ${hookType} for button: ${text.substring(0, 30)}`);
                
                // Store original handlers
                const originalClick = button.onclick;
                const originalChange = button.onchange;
                
                // Replace with appropriate picker based on hook type
                button.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    if (hookType === 'useRegularPhotoPicker') {
                        this.handleRegularPhotoPickerUpload(button);
                    } else {
                        this.handleEventPhotoPickerUpload(button);
                    }
                    return false;
                };
                
                if (button.type === 'file') {
                    button.onchange = (event) => {
                        event.preventDefault();
                        
                        if (hookType === 'useRegularPhotoPicker') {
                            this.handleRegularPhotoPickerUpload(button);
                        } else {
                            this.handleEventPhotoPickerUpload(button);
                        }
                    };
                }
                
                overrideCount++;
            }
        });
        
        console.log(`✅ Overrode ${overrideCount} upload buttons`);
    }
    
    detectHookType(button) {
        // Check for explicit hook type in data attributes
        if (button.dataset.hook === 'useRegularPhotoPicker') {
            return 'useRegularPhotoPicker';
        }
        if (button.dataset.hook === 'useEventPhotoPicker') {
            return 'useEventPhotoPicker';
        }
        
        // Check for hook type in classes
        if (button.classList.contains('useRegularPhotoPicker')) {
            return 'useRegularPhotoPicker';
        }
        if (button.classList.contains('useEventPhotoPicker')) {
            return 'useEventPhotoPicker';
        }
        
        // Check button text/context for hints
        const text = (button.textContent || button.value || '').toLowerCase();
        const parentText = (button.parentElement?.textContent || '').toLowerCase();
        const contextText = text + ' ' + parentText;
        
        // Regular picker patterns (for assets like headers, QR codes, logos)
        const regularPatterns = [
            'header', 'logo', 'qr', 'code', 'avatar', 'profile', 
            'banner', 'background', 'asset', 'icon', 'cover'
        ];
        
        // Event picker patterns (for time-based event photos)
        const eventPatterns = [
            'event', 'moment', 'memory', 'gallery', 'album', 
            'share', 'capture', 'snapshot'
        ];
        
        // Check for regular picker patterns
        for (const pattern of regularPatterns) {
            if (contextText.includes(pattern)) {
                console.log(`🎯 Detected regular picker pattern: "${pattern}" in "${contextText}"`);
                return 'useRegularPhotoPicker';
            }
        }
        
        // Check for event picker patterns
        for (const pattern of eventPatterns) {
            if (contextText.includes(pattern)) {
                console.log(`🎯 Detected event picker pattern: "${pattern}" in "${contextText}"`);
                return 'useEventPhotoPicker';
            }
        }
        
        // Default to event picker if no specific pattern detected
        console.log(`🎯 No specific pattern detected, defaulting to event picker for: "${contextText}"`);
        return 'useEventPhotoPicker';
    }
    
    monitorForNewButtons() {
        const observer = new MutationObserver(() => {
            setTimeout(() => this.overrideUploadButtons(), 500);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    addEventPhotoPickerButton() {
        // Add floating photo picker buttons
        this.addFloatingButton('📸 Event Photos', 20, '#007AFF', () => this.handleEventPhotoPickerUpload());
        this.addFloatingButton('📱 All Photos', 80, '#34C759', (button) => this.handleRegularPhotoPickerUpload(button));
        console.log('✅ Added floating photo picker buttons');
    }
    
    addFloatingButton(text, bottomOffset, backgroundColor, clickHandler) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.style.cssText = `
            position: fixed;
            bottom: ${bottomOffset}px;
            right: 20px;
            z-index: 10000;
            background: ${backgroundColor};
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 20px;
            font-size: 16px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        
        button.onmouseover = () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        };
        
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        };
        
        button.onclick = () => clickHandler(button);
        
        document.body.appendChild(button);
    }
    
    async handleEventPhotoPickerUpload() {
        console.log('🎯 EventPhotoPicker upload triggered!');
        
        if (!this.currentEventData) {
            console.error('❌ No event data available');
            return;
        }
        
        try {
            // Show event info dialog first
            console.log('📋 Showing event info dialog...');
            const dialogResult = await this.eventPhotoPicker.showEventInfo(this.currentEventData);
            console.log('📋 Event info dialog result:', dialogResult);
            
            if (dialogResult.action === 'continue') {
                // Get latest photo count
                const photoResult = await this.eventPhotoPicker.getEventPhotosMetadata({
                    startDate: this.currentEventData.startDate,
                    endDate: this.currentEventData.endDate,
                    uploadedPhotoIds: this.currentEventData.uploadedPhotoIds,
                    timezone: this.currentEventData.timezone
                });
                
                console.log(`📸 Found ${photoResult.totalCount} photos for upload`);
                
                if (photoResult.totalCount > 0) {
                    // Open photo picker for selection
                    console.log('🖼️ Opening photo picker...');
                    const pickerResult = await this.eventPhotoPicker.openEventPhotoPicker({
                        startDate: this.currentEventData.startDate,
                        endDate: this.currentEventData.endDate,
                        eventId: this.currentEventData.eventId,
                        timezone: this.currentEventData.timezone,
                        uploadedPhotoIds: this.currentEventData.uploadedPhotoIds,
                        allowMultipleSelection: true,
                        title: `Select Photos for ${this.currentEventData.eventName}`
                    });
                    
                    console.log('✅ Photo picker completed:', pickerResult);
                    console.log(`📤 User selected ${pickerResult.count} photos for upload`);
                    
                    // TODO: Process selected photos for actual upload
                    // For now, just log the selected photo data
                    if (pickerResult.photos && pickerResult.photos.length > 0) {
                        console.log('📋 Selected photo details:');
                        pickerResult.photos.forEach((photo, index) => {
                            console.log(`   ${index + 1}. ID: ${photo.localIdentifier}, Size: ${photo.width}x${photo.height}`);
                        });
                    }
                } else {
                    console.log('📸 No photos found in event time range for selection');
                }
                
            } else {
                console.log('❌ User cancelled event dialog');
            }
            
        } catch (error) {
            console.error('❌ EventPhotoPicker upload failed:', error);
            alert(`EventPhotoPicker Error: ${error.message}`);
        }
    }
    
    async handleRegularPhotoPickerUpload(button) {
        console.log('🎯 Regular photo picker upload triggered!');
        console.log('📋 Button context:', {
            text: button.textContent || button.value || 'No text',
            classes: Array.from(button.classList),
            dataHook: button.dataset.hook
        });
        
        try {
            // Extract title from button context
            const buttonText = button.textContent || button.value || '';
            const parentText = button.parentElement?.textContent || '';
            const title = buttonText || `Select Photos for ${parentText}` || 'Select Photos';
            
            console.log('🖼️ Opening regular photo picker...');
            const pickerResult = await this.eventPhotoPicker.openRegularPhotoPicker({
                allowMultipleSelection: true,
                title: title.substring(0, 50), // Limit title length
                maxSelectionCount: 10
            });
            
            console.log('✅ Regular photo picker completed:', pickerResult);
            console.log(`📤 User selected ${pickerResult.count} photos for upload`);
            
            // TODO: Process selected photos for actual upload
            // For now, just log the selected photo data
            if (pickerResult.photos && pickerResult.photos.length > 0) {
                console.log('📋 Selected photo details:');
                pickerResult.photos.forEach((photo, index) => {
                    console.log(`   ${index + 1}. ID: ${photo.localIdentifier}, Size: ${photo.width}x${photo.height}`);
                });
                
                // Log picker type for verification
                console.log(`🔧 Picker type used: ${pickerResult.pickerType || 'regular'}`);
            }
            
        } catch (error) {
            console.error('❌ Regular photo picker upload failed:', error);
            alert(`Regular Photo Picker Error: ${error.message}`);
        }
    }
    
    // Utility methods for manual testing
    manualTest() {
        console.log('🧪 Manual test - Current event data:', this.currentEventData);
        return this.testRealEventPhotoCount();
    }
    
    getEventData() {
        return this.currentEventData;
    }
    
    getPhotoCount() {
        return this.lastPhotoCount;
    }
}

// Initialize
const realEventIntegration = new RealEventIntegration();

// Expose globally for testing
window.RealEventIntegration = realEventIntegration;
window.testRealEvent = () => realEventIntegration.manualTest();

console.log('✅ Real Event Integration Ready');
console.log('🧪 Test with: testRealEvent()');