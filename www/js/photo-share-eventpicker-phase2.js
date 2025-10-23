/**
 * EventPhotoPicker Integration for Photo-Share.app Website - Phase 2
 * Updated version that works with Phase 1 early override system
 */

console.log('📸 Phase 2 EventPhotoPicker Integration Loading...');

// Phase 2: Work with Phase 1 early override system
function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// Initialize Phase 2 integration
async function initializeEventPhotoPickerPhase2() {
    console.log('🔍 Phase 2: Checking environment...');
    
    // Wait for Capacitor to be available
    await new Promise((resolve) => {
        const checkCapacitor = () => {
            if (window.Capacitor) {
                resolve();
            } else {
                setTimeout(checkCapacitor, 100);
            }
        };
        checkCapacitor();
    });
    
    if (!isNativeApp()) {
        console.log('🌐 Phase 2: Running in web browser - creating stub');
        
        // Create stub object to prevent errors
        window.EventPhotoPickerIntegration = {
            isReady: false,
            isNativeApp: false,
            showEventDialog: () => Promise.resolve({ action: 'cancelled', reason: 'Not in native app' }),
            getPhotoMetadata: () => Promise.resolve({ count: 0, photos: [], reason: 'Not in native app' }),
            openPhotoPicker: () => Promise.resolve({ selectedPhotos: [], reason: 'Not in native app' })
        };
        
        console.log('✅ Phase 2 EventPhotoPicker Ready (web browser mode)');
    } else {
        console.log('📱 Phase 2: Running in native app - setting up feature integration...');
    
        // Phase 2 EventPhotoPicker integration for native apps
        class EventPhotoPickerPhase2Integration {
            constructor() {
                this.plugin = null;
                this.isReady = false;
                this.isNativeApp = true;
                this.init();
            }
            
            async init() {
                console.log('🚀 Phase 2: Initializing EventPhotoPicker feature integration...');
                
                try {
                    // Wait for Capacitor to be ready
                    await this.waitForCapacitor();
                    
                    // Wait for EventPhotoPicker plugin to be available
                    await this.waitForEventPhotoPicker();
                    
                    // Setup Phase 2 feature integration
                    if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                        this.plugin = window.Capacitor.Plugins.EventPhotoPicker;
                        this.isReady = true;
                        this.setupPhase2Integration();
                        console.log('✅ Phase 2 EventPhotoPicker feature integration ready');
                    } else {
                        console.warn('⚠️ EventPhotoPicker plugin not found - Phase 2 disabled');
                        this.plugin = null;
                        this.isReady = false;
                    }
                    
                } catch (error) {
                    console.error('❌ Phase 2 EventPhotoPicker initialization failed:', error);
                    this.isReady = false;
                }
            }
            
            async waitForCapacitor() {
                return new Promise((resolve) => {
                    const check = () => {
                        if (window.Capacitor && window.Capacitor.Plugins) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            }
            
            async waitForEventPhotoPicker() {
                return new Promise((resolve) => {
                    let attempts = 0;
                    const maxAttempts = 200; // 20 seconds total
                    
                    const check = () => {
                        attempts++;
                        
                        if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                            console.log('✅ EventPhotoPicker plugin detected');
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            console.warn('⚠️ EventPhotoPicker not available after 20 seconds');
                            resolve(); // Don't block initialization
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            }
            
            /**
             * Phase 2: Setup integration with Phase 1 override system
             */
            setupPhase2Integration() {
                console.log('🔧 Phase 2: Setting up feature-level integration...');
                
                // Register event metadata provider for Phase 1
                window.getEventMetadataForPhase1 = () => {
                    return this.getCurrentEventMetadata();
                };
                
                // Register photo filtering for Phase 1
                window.filterPhotosForEvent = async (photos, eventData) => {
                    return this.filterPhotosForEvent(photos, eventData);
                };
                
                // Setup event info modal for Phase 1
                window.showEventInfoModal = async (eventData) => {
                    return this.showEventDialog(eventData);
                };
                
                console.log('✅ Phase 2 feature integration setup complete');
            }
            
            /**
             * Get current event metadata for Phase 1 override
             */
            getCurrentEventMetadata() {
                const url = window.location.href;
                
                // Extract event ID from URL
                const eventIdMatch = url.match(/\/event\/([a-f0-9-]+)/i);
                
                if (eventIdMatch) {
                    const eventId = eventIdMatch[1];
                    
                    return {
                        eventId: eventId,
                        // Try to get additional event info from DOM or global state
                        eventName: this.getEventNameFromDOM(),
                        eventDates: this.getEventDatesFromDOM(),
                        source: 'Phase2_URL_Detection'
                    };
                }
                
                return null;
            }
            
            /**
             * Get event name from DOM elements
             */
            getEventNameFromDOM() {
                // Look for common selectors that might contain event name
                const selectors = [
                    'h1[class*="event"]',
                    'h1[class*="title"]',
                    '[data-event-name]',
                    '.event-title',
                    '.event-name'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                
                return 'Event'; // Default fallback
            }
            
            /**
             * Get event dates from DOM or URL parameters
             */
            getEventDatesFromDOM() {
                // Try to extract dates from URL parameters or DOM
                const urlParams = new URLSearchParams(window.location.search);
                const startDate = urlParams.get('start_date') || urlParams.get('startDate');
                const endDate = urlParams.get('end_date') || urlParams.get('endDate');
                
                if (startDate && endDate) {
                    return { startDate, endDate };
                }
                
                // Look for date elements in DOM
                const dateElements = document.querySelectorAll('[data-event-date], .event-date, [class*="date"]');
                if (dateElements.length > 0) {
                    // Extract dates from first element found
                    const dateText = dateElements[0].textContent;
                    // Basic date extraction logic
                    const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/g);
                    if (dateMatch && dateMatch.length >= 2) {
                        return { startDate: dateMatch[0], endDate: dateMatch[1] };
                    }
                }
                
                return null;
            }
            
            /**
             * Filter photos for event context (used by Phase 1)
             */
            async filterPhotosForEvent(photos, eventData) {
                if (!eventData || !eventData.eventDates) {
                    return photos; // No filtering without date info
                }
                
                // Filter photos by date range if available
                return photos.filter(photo => {
                    if (!photo.creationDate) return true; // Include if no date info
                    
                    const photoDate = new Date(photo.creationDate);
                    const startDate = new Date(eventData.eventDates.startDate);
                    const endDate = new Date(eventData.eventDates.endDate);
                    
                    return photoDate >= startDate && photoDate <= endDate;
                });
            }
            
            async showEventDialog(eventData) {
                if (!this.isReady) {
                    throw new Error('EventPhotoPicker not ready');
                }
                
                try {
                    return await this.plugin.showEventInfo(eventData);
                } catch (error) {
                    console.error('❌ showEventDialog failed:', error);
                    throw error;
                }
            }
            
            async getPhotoMetadata(options) {
                if (!this.isReady) {
                    throw new Error('EventPhotoPicker not ready');
                }
                
                try {
                    return await this.plugin.getEventPhotosMetadata(options);
                } catch (error) {
                    console.error('❌ getPhotoMetadata failed:', error);
                    throw error;
                }
            }
            
            async openPhotoPicker(options) {
                if (!this.isReady) {
                    throw new Error('EventPhotoPicker not ready');
                }
                
                try {
                    return await this.plugin.openEventPhotoPicker(options);
                } catch (error) {
                    console.error('❌ openPhotoPicker failed:', error);
                    throw error;
                }
            }
        }
        
        // Initialize Phase 2 for native app
        window.EventPhotoPickerIntegration = new EventPhotoPickerPhase2Integration();
        console.log('✅ Phase 2 EventPhotoPicker Integration Ready (native app mode)');
    }
}

// Start Phase 2 initialization
initializeEventPhotoPickerPhase2();

// Global helper functions
window.getEventPhotoPickerPhase2Status = function() {
    return {
        isNativeApp: isNativeApp(),
        isReady: window.EventPhotoPickerIntegration?.isReady || false,
        integration: !!window.EventPhotoPickerIntegration,
        phase: 'Phase2_FeatureLevel'
    };
};

console.log('📱 Phase 2 EventPhotoPicker integration status:', window.getEventPhotoPickerPhase2Status());