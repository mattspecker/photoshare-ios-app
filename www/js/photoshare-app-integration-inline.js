console.log('📸 Photo-Share.app Event Photo Picker Integration loading...');

(function() {
    'use strict';

    class PhotoShareAppIntegration {
        constructor() {
            this.isNative = window.Capacitor && window.Capacitor.isNativePlatform &&
window.Capacitor.isNativePlatform();
            this.eventPhotoPicker = null;
            this.originalShareFunction = null;
            this.isInitialized = false;

            console.log(`📱 Photo-Share.app running in ${this.isNative ? 'native app' : 'web browser'}`);

            if (this.isNative) {
                this.initialize();
            }
        }

        async initialize() {
            try {
                console.log('🚀 Initializing Event Photo Picker integration...');

                // Wait for core dependencies if loading coordinator is available
                if (window.waitForPhotoshareCoreReady) {
                    try {
                        console.log('📸 Waiting for core dependencies...');
                        await window.waitForPhotoshareCoreReady();
                        console.log('📸 Core dependencies ready, proceeding with integration');
                    } catch (error) {
                        console.warn('📸 Core dependencies timeout, proceeding anyway:', error);
                    }
                }

                // Wait for Capacitor plugins to be ready
                await this.waitForCapacitor();

                // Check for Event Photo Picker plugin
                this.eventPhotoPicker = window.Capacitor?.Plugins?.EventPhotoPicker;

                if (this.eventPhotoPicker) {
                    console.log('✅ Event Photo Picker plugin detected');

                     // Hook into existing upload functionality
                     this.hookIntoUploadFlow();

                    this.isInitialized = true;
                    console.log('✅ Event Photo Picker integration ready');
                } else {
                    console.warn('⚠️ Event Photo Picker plugin not available - using standard upload');
                }
            } catch (error) {
                console.error('❌ Error initializing Event Photo Picker:', error);
            }
        }

        async waitForCapacitor() {
            return new Promise((resolve) => {
                const checkCapacitor = () => {
                    if (window.Capacitor && window.Capacitor.Plugins) {
                        resolve();
                    } else {
                        setTimeout(checkCapacitor, 100);
                    }
                };
                checkCapacitor();
            });
        }

        /**
         * Hook into existing upload functionality
         */
        hookIntoUploadFlow() {
            // Override Share.share if available
            if (window.Capacitor?.Plugins?.Share?.share) {
                this.originalShareFunction = window.Capacitor.Plugins.Share.share;
                window.Capacitor.Plugins.Share.share = this.enhancedShareFunction.bind(this);
                console.log('✅ Share function enhanced with Event Photo Picker');
            }

            // Hook into any upload buttons or forms
            this.hookIntoUploadButtons();

            // Hook into drag & drop areas
            this.hookIntoDragDrop();
        }

        /**
         * Enhanced share function that uses Event Photo Picker when appropriate
         */
        async enhancedShareFunction(options) {
            console.log('📤 Enhanced share function called:', options);

            try {
                // Check if this is a photo upload action
                if (this.isPhotoUploadAction(options)) {
                    console.log('📸 Photo upload detected - opening Event Photo Picker...');

                    // Get current event context
                    const eventData = this.getCurrentEventData();

                    if (eventData.eventId) {
                        // Show event info for confirmation
                        await this.showEventInfo(eventData);

                        // Open Event Photo Picker
                        const result = await this.openEventPhotoPicker(eventData);

                        if (result && result.photos && result.photos.length > 0) {
                            console.log(`✅ User selected ${result.photos.length} photos from event picker`);

                            // Convert to format expected by original share function
                            const enhancedOptions = this.convertEventPhotosToShareFormat(result.photos,
options);

                            // Call original share function with event photos
                            return await this.originalShareFunction.call(window.Capacitor.Plugins.Share,
enhancedOptions);
                        } else {
                            console.log('ℹ️ No photos selected from event picker');
                            throw new Error('No photos selected');
                        }
                    } else {
                        console.log('⚠️ No event context found - using standard share');
                    }
                }

                // Not a photo upload or no event context - use original function
                return await this.originalShareFunction.call(window.Capacitor.Plugins.Share, options);

            } catch (error) {
                console.error('❌ Enhanced share function error:', error);

                // Fall back to original share function
                return await this.originalShareFunction.call(window.Capacitor.Plugins.Share, options);
            }
        }

        /**
         * Hook into upload buttons on the page
         */
        hookIntoUploadButtons() {
            // Android fix: let React handle EventPhotoPicker to avoid duplicate pickers
            if (window.Capacitor?.getPlatform?.() === 'android') {
                console.log('🤖 Android detected - skipping inline upload button hooks');
                return;
            }
            // Common selectors for upload buttons
            const uploadSelectors = [
                'input[type="file"]',
                '[data-upload]',
                '.upload-button',
                '.photo-upload',
                '#upload-btn',
                'button[onclick*="upload"]'
            ];

            uploadSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'INPUT' && element.type === 'file') {
                        element.addEventListener('click', this.handleFileInputClick.bind(this));
                    } else {
                        element.addEventListener('click', this.handleUploadButtonClick.bind(this));
                    }
                });
            });

            // Use MutationObserver to catch dynamically added upload buttons
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            uploadSelectors.forEach(selector => {
                                if (node.matches && node.matches(selector)) {
                                    this.attachUploadHandler(node);
                                } else if (node.querySelectorAll) {
                                    const uploadElements = node.querySelectorAll(selector);
                                    uploadElements.forEach(element => this.attachUploadHandler(element));
                                }
                            });
                        }
                    });
                });
            });

            // Safely observe document.body with comprehensive fallback
            const startObserver = () => {
                // Wait for DOM to be ready first
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', startObserver);
                    return;
                }
                
                // Then check for document.body
                if (document.body && document.body instanceof Node) {
                    try {
                        observer.observe(document.body, { childList: true, subtree: true });
                        console.log('✅ MutationObserver started for upload buttons');
                    } catch (error) {
                        console.error('❌ MutationObserver failed to start:', error);
                        // Retry after a delay
                        setTimeout(startObserver, 500);
                    }
                } else if (document.readyState === 'complete') {
                    // DOM is complete but still no body - something is wrong
                    console.error('❌ document.body not available even after DOM complete');
                } else {
                    // DOM not ready yet, wait and retry
                    console.warn('⚠️ document.body not available, retrying observer setup...');
                    setTimeout(startObserver, 100);
                }
            };
            
            startObserver();
        }

        attachUploadHandler(element) {
            if (element.tagName === 'INPUT' && element.type === 'file') {
                element.addEventListener('click', this.handleFileInputClick.bind(this));
            } else {
                element.addEventListener('click', this.handleUploadButtonClick.bind(this));
            }
        }

        /**
         * Handle file input clicks
         */
        async handleFileInputClick(event) {
            if (window.Capacitor?.getPlatform?.() === 'android') return;
            const eventData = this.getCurrentEventData();

            if (eventData.eventId) {
                event.preventDefault();

                try {
                    console.log('📁 File input clicked - opening Event Photo Picker...');

                    const result = await this.openEventPhotoPicker(eventData);

                    if (result && result.photos && result.photos.length > 0) {
                        // Create FileList-like object with selected photos
                        this.simulateFileSelection(event.target, result.photos);
                    }
                } catch (error) {
                    console.error('❌ Event Photo Picker error:', error);
                    // Let original file input work
                }
            }
        }

        /**
         * Handle upload button clicks
         */
        async handleUploadButtonClick(event) {
            if (window.Capacitor?.getPlatform?.() === 'android') return;
            const eventData = this.getCurrentEventData();

            if (eventData.eventId) {
                event.preventDefault();

                try {
                    console.log('🔘 Upload button clicked - opening Event Photo Picker...');

                    const result = await this.openEventPhotoPicker(eventData);

                    if (result && result.photos && result.photos.length > 0) {
                        // Trigger upload with selected photos
                        this.triggerUploadWithEventPhotos(result.photos);
                    }
                } catch (error) {
                    console.error('❌ Event Photo Picker error:', error);
                    // Continue with original button action
                }
            }
        }

        /**
         * Hook into drag & drop areas
         */
        hookIntoDragDrop() {
            const dropAreas = document.querySelectorAll('[data-drop-zone], .drop-zone, .upload-area');

            dropAreas.forEach(area => {
                area.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    // Add visual feedback that Event Photo Picker is available
                    area.style.borderColor = '#007AFF';
                    area.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                });

                area.addEventListener('dragleave', () => {
                    area.style.borderColor = '';
                    area.style.backgroundColor = '';
                });

                area.addEventListener('drop', async (event) => {
                    event.preventDefault();
                    area.style.borderColor = '';
                    area.style.backgroundColor = '';

                    const eventData = this.getCurrentEventData();

                    if (eventData.eventId) {
                        try {
                            console.log('📦 Drop area activated - opening Event Photo Picker...');

                            const result = await this.openEventPhotoPicker(eventData);

                            if (result && result.photos && result.photos.length > 0) {
                                this.triggerUploadWithEventPhotos(result.photos);
                            }
                        } catch (error) {
                            console.error('❌ Event Photo Picker error:', error);
                        }
                    }
                });
            });
        }

        /**
         * Show event information modal
         */
        async showEventInfo(eventData) {
            try {
                const result = await this.eventPhotoPicker.showEventInfo({
                    eventName: eventData.eventName,
                    memberId: eventData.memberId,
                    eventId: eventData.eventId,
                    startDate: eventData.startDate,
                    endDate: eventData.endDate
                });

                console.log('📋 Event info displayed:', result);
                return result;
            } catch (error) {
                console.error('❌ Error showing event info:', error);
                throw error;
            }
        }

        /**
         * Open Event Photo Picker
         */
        async openEventPhotoPicker(eventData) {
            try {
                const options = {
                    eventId: eventData.eventId,
                    startDate: this.formatDateForIOS(eventData.startDate),
                    endDate: this.formatDateForIOS(eventData.endDate),
                    uploadedPhotoIds: eventData.uploadedPhotoIds || [],
                    allowMultipleSelection: true,
                    title: `${eventData.eventName} Photos`
                };

                console.log('🚀 Opening Event Photo Picker:', options);

                const result = await this.eventPhotoPicker.openEventPhotoPicker(options);
                console.log('✅ Event Photo Picker result:', result);

                return result;
            } catch (error) {
                console.error('❌ Event Photo Picker error:', error);
                throw error;
            }
        }

        /**
         * Format date for iOS compatibility
         */
        formatDateForIOS(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
            } catch (error) {
                console.warn('⚠️ Date format error:', error);
                return dateString;
            }
        }

        /**
         * Get current event data from page context
         */
        getCurrentEventData() {
            // Try multiple methods to get event data
            return this.getEventFromURL() ||
                   this.getEventFromLocalStorage() ||
                   this.getEventFromPageData() ||
                   this.getEventFromGlobals() ||
                   this.getFallbackEventData();
        }

        getEventFromURL() {
            // Extract event ID from current URL path
            const pathMatch = window.location.pathname.match(/\/event\/([^\/]+)/);
            let eventId = pathMatch ? pathMatch[1] : null;
            
            // Also check camera route
            if (!eventId) {
                const cameraMatch = window.location.pathname.match(/\/camera\/([^\/]+)/);
                eventId = cameraMatch ? cameraMatch[1] : null;
            }
            
            // Fallback to query params
            if (!eventId) {
                const params = new URLSearchParams(window.location.search);
                eventId = params.get('eventId') || params.get('event');
            }
            
            if (eventId && eventId !== 'live-site-event') {
                console.log('📊 Extracted real event ID from URL:', eventId);
                return this.fetchEventDataFromAPI(eventId);
            }
            return null;
        }

        getEventFromLocalStorage() {
            try {
                const eventData = localStorage.getItem('currentEvent') ||
                                localStorage.getItem('activeEvent');
                if (eventData) {
                    return JSON.parse(eventData);
                }
            } catch (error) {
                console.warn('⚠️ Error reading event from localStorage:', error);
            }
            return null;
        }

        getEventFromPageData() {
            // Look for event data in page elements
            const eventElement = document.querySelector('[data-event-id]') ||
                               document.querySelector('[data-eventid]');

            if (eventElement) {
                return {
                    eventId: eventElement.getAttribute('data-event-id') ||
eventElement.getAttribute('data-eventid'),
                    eventName: eventElement.getAttribute('data-event-name') || 'Page Event',
                    memberId: eventElement.getAttribute('data-member-id') || 'page_user',
                    startDate: eventElement.getAttribute('data-start-date') || '',
                    endDate: eventElement.getAttribute('data-end-date') || '',
                    uploadedPhotoIds: []
                };
            }
            return null;
        }

        getEventFromGlobals() {
            // Check for global variables that might contain event data
            if (window.currentEvent) return window.currentEvent;
            if (window.eventData) return window.eventData;
            if (window.__INITIAL_STATE__?.event) return window.__INITIAL_STATE__.event;

            return null;
        }

        getFallbackEventData() {
            // Return null instead of hardcoded data to prevent duplicate picker issues
            console.warn('⚠️ No event context found - EventPhotoPicker will not be available');
            return null;
        }

        /**
         * Fetch event data from API or DOM
         */
        fetchEventDataFromAPI(eventId) {
            try {
                // Try to get event data from page DOM elements first
                const eventData = this.getEventDataFromDOM(eventId);
                if (eventData) {
                    return eventData;
                }
                
                // If no DOM data, return basic structure for API call
                return {
                    eventId: eventId,
                    eventName: this.getEventNameFromPage(),
                    startTime: this.getEventStartTime(),
                    endTime: this.getEventEndTime(),
                    allowMultipleSelection: true
                };
            } catch (error) {
                console.warn('⚠️ Error fetching event data:', error);
                return null;
            }
        }

        /**
         * Extract event data from DOM elements
         */
        getEventDataFromDOM(eventId) {
            // Look for event data in React component props or data attributes
            const eventNameEl = document.querySelector('[data-event-name]') || 
                               document.querySelector('h1') ||
                               document.querySelector('.event-title');
            
            const eventName = eventNameEl?.textContent?.trim() || 
                             document.title.split(' - ')[0] || 
                             'Event Photos';
                             
            return {
                eventId: eventId,
                eventName: eventName,
                startTime: this.getEventStartTime(),
                endTime: this.getEventEndTime(),
                allowMultipleSelection: true
            };
        }

        /**
         * Get event name from page
         */
        getEventNameFromPage() {
            return document.querySelector('[data-event-name]')?.textContent ||
                   document.querySelector('h1')?.textContent ||
                   document.title.split(' - ')[0] ||
                   'Event Photos';
        }

        /**
         * Get event start time from page or meta
         */
        getEventStartTime() {
            return document.querySelector('meta[name="event-start"]')?.content ||
                   document.querySelector('[data-event-start]')?.textContent ||
                   new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago fallback
        }

        /**
         * Get event end time from page or meta
         */
        getEventEndTime() {
            return document.querySelector('meta[name="event-end"]')?.content ||
                   document.querySelector('[data-event-end]')?.textContent ||
                   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now fallback
        }

        /**
         * Check if an action is a photo upload
         */
        isPhotoUploadAction(options) {
            return (
                (options.files && options.files.length > 0) ||
                (options.url && options.url.includes('image')) ||
                (options.title && options.title.toLowerCase().includes('photo')) ||
                (options.text && options.text.toLowerCase().includes('upload'))
            );
        }

        /**
         * Convert event photos to share format
         */
        convertEventPhotosToShareFormat(photos, originalOptions) {
            const files = photos.map(photo => ({
                data: photo.base64,
                mimeType: photo.mimeType || 'image/jpeg',
                name: `event_photo_${photo.localIdentifier}.jpg`
            }));

            return {
                ...originalOptions,
                files: files,
                title: originalOptions.title || `${photos.length} Event Photos`,
                text: originalOptions.text || `Uploading ${photos.length} photos from event`
            };
        }


        /**
         * Simulate file selection for file inputs
         */
        simulateFileSelection(fileInput, photos) {
            // Create File objects from photos
            const files = photos.map(photo => {
                const byteCharacters = atob(photo.base64.split(',')[1] || photo.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);

                return new File([byteArray], `event_photo_${photo.localIdentifier}.jpg`, {
                    type: photo.mimeType || 'image/jpeg'
                });
            });

            // Update file input
            Object.defineProperty(fileInput, 'files', {
                value: files,
                writable: false
            });

            // Trigger change event
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }

        /**
         * Trigger upload with event photos
         */
        triggerUploadWithEventPhotos(photos) {
            // Emit custom event that the site can listen for
            const uploadEvent = new CustomEvent('eventPhotosSelected', {
                detail: {
                    photos: photos,
                    count: photos.length
                }
            });

            document.dispatchEvent(uploadEvent);

            console.log('📤 Event photos upload triggered:', photos.length, 'photos');
        }

        /**
         * Get integration status
         */
        getStatus() {
            return {
                isNative: this.isNative,
                isInitialized: this.isInitialized,
                hasEventPhotoPicker: !!this.eventPhotoPicker,
                currentEventData: this.getCurrentEventData()
            };
        }
    }

    // Initialize if running in native app
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        window.photoShareAppIntegration = new PhotoShareAppIntegration();

         // Global functions for testing
         window.getEventPickerStatus = () => window.photoShareAppIntegration.getStatus();

         console.log('✅ Photo-Share.app Event Photo Picker Integration ready');
         console.log('🧪 Test: getEventPickerStatus()');
    } else {
        console.log('📱 Photo-Share.app running in web mode - Event Photo Picker not available');
    }

})();