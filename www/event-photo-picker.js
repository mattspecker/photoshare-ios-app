/**
 * Event Photo Picker - JavaScript Interface
 * Custom Capacitor plugin for event-specific photo selection with upload status tracking
 */

console.log('📸 Event Photo Picker loading...');

(function() {
    'use strict';

    class EventPhotoPickerService {
        constructor() {
            this.plugin = null;
            this.isAvailable = false;
            this.initialize();
        }

        async initialize() {
            try {
                // Wait for plugin to be registered
                await this.waitForPlugin();
                
                this.plugin = window.Capacitor?.Plugins?.EventPhotoPicker;
                this.isAvailable = !!this.plugin;
                
                if (this.isAvailable) {
                    console.log('✅ EventPhotoPicker plugin available');
                } else {
                    console.warn('⚠️ EventPhotoPicker plugin not available');
                }
            } catch (error) {
                console.error('❌ Error initializing EventPhotoPicker:', error);
                this.isAvailable = false;
            }
        }

        /**
         * Wait for EventPhotoPicker plugin to be registered
         * @returns {Promise<boolean>} True if plugin becomes available
         */
        async waitForPlugin() {
            return new Promise((resolve) => {
                const checkPlugin = () => {
                    if (window.Capacitor?.Plugins?.EventPhotoPicker) {
                        console.log('✅ EventPhotoPicker plugin found during wait');
                        resolve(true);
                    } else {
                        setTimeout(checkPlugin, 100);
                    }
                };
                
                // Start checking immediately
                checkPlugin();
                
                // Also set a timeout after 5 seconds
                setTimeout(() => {
                    console.warn('⚠️ EventPhotoPicker plugin not found after 5 seconds');
                    resolve(false);
                }, 5000);
            });
        }

        /**
         * Opens the event photo picker with date filtering and upload status tracking
         * @param {Object} options - Configuration options
         * @param {string} options.eventId - The event ID
         * @param {string} options.startDate - ISO8601 start date for filtering
         * @param {string} options.endDate - ISO8601 end date for filtering
         * @param {string[]} options.uploadedPhotoIds - Array of already uploaded photo IDs
         * @param {boolean} options.allowMultipleSelection - Allow multiple photo selection (default: true)
         * @param {string} options.title - Picker title (default: "Select Event Photos")
         * @returns {Promise<Object>} Selected photos with metadata
         */
        async openEventPhotoPicker(options = {}) {
            if (!this.isAvailable) {
                throw new Error('EventPhotoPicker plugin not available');
            }

            const {
                eventId,
                startDate,
                endDate,
                uploadedPhotoIds = [],
                allowMultipleSelection = true,
                title = 'Select Event Photos'
            } = options;

            // Validate required parameters
            if (!eventId) {
                throw new Error('eventId is required');
            }
            if (!startDate || !endDate) {
                throw new Error('startDate and endDate are required');
            }

            console.log(`📸 Opening event photo picker for event: ${eventId}`);
            console.log(`📅 Date range: ${startDate} to ${endDate}`);
            console.log(`📤 ${uploadedPhotoIds.length} photos already uploaded`);

            try {
                const result = await this.plugin.openEventPhotoPicker({
                    eventId,
                    startDate,
                    endDate,
                    uploadedPhotoIds,
                    allowMultipleSelection,
                    title
                });

                console.log(`✅ User selected ${result.count} photos`);
                return result;

            } catch (error) {
                if (error.message === 'User cancelled photo selection') {
                    console.log('🚫 User cancelled photo selection');
                    throw new Error('cancelled');
                } else {
                    console.error('❌ Error opening photo picker:', error);
                    throw error;
                }
            }
        }

        /**
         * Gets metadata for photos in the event date range without opening picker
         * @param {Object} options - Configuration options
         * @param {string} options.startDate - ISO8601 start date for filtering
         * @param {string} options.endDate - ISO8601 end date for filtering
         * @param {string[]} options.uploadedPhotoIds - Array of already uploaded photo IDs
         * @returns {Promise<Object>} Photos metadata and counts
         */
        async getEventPhotosMetadata(options = {}) {
            if (!this.isAvailable) {
                throw new Error('EventPhotoPicker plugin not available');
            }

            const {
                startDate,
                endDate,
                uploadedPhotoIds = []
            } = options;

            if (!startDate || !endDate) {
                throw new Error('startDate and endDate are required');
            }

            console.log(`📋 Getting photos metadata for date range: ${startDate} to ${endDate}`);

            try {
                const result = await this.plugin.getEventPhotosMetadata({
                    startDate,
                    endDate,
                    uploadedPhotoIds
                });

                console.log(`📊 Found ${result.totalCount} photos (${result.uploadedCount} uploaded, ${result.pendingCount} pending)`);
                return result;

            } catch (error) {
                console.error('❌ Error getting photos metadata:', error);
                throw error;
            }
        }

        /**
         * Quick helper to open picker for current event page
         * @param {string[]} uploadedPhotoIds - Array of already uploaded photo IDs
         * @param {Object} eventOptions - Optional event configuration
         * @returns {Promise<Object>} Selected photos
         */
        async openPickerForCurrentEvent(uploadedPhotoIds = [], eventOptions = {}) {
            // Try to detect event info from current page/context
            const eventInfo = this.detectCurrentEventInfo();
            
            if (!eventInfo.eventId) {
                throw new Error('Could not detect current event. Please provide event details manually.');
            }

            const options = {
                eventId: eventInfo.eventId,
                startDate: eventInfo.startDate,
                endDate: eventInfo.endDate,
                uploadedPhotoIds,
                ...eventOptions
            };

            return await this.openEventPhotoPicker(options);
        }

        /**
         * Helper to detect event information from current page
         * @returns {Object} Event information if detected
         */
        detectCurrentEventInfo() {
            let eventId = null;
            let startDate = null;
            let endDate = null;

            // Try to detect event ID from URL
            const urlMatch = window.location.pathname.match(/\/event\/([a-f0-9-]+)/);
            if (urlMatch) {
                eventId = urlMatch[1];
                console.log(`🎯 Detected event ID from URL: ${eventId}`);
            }

            // Try to get event dates from global state or DOM
            if (window.eventData) {
                startDate = window.eventData.startDate;
                endDate = window.eventData.endDate;
                console.log(`📅 Found event dates in global state`);
            }

            // Try to get from PhotoShare context
            if (window.PhotoShareEventContext) {
                eventId = eventId || window.PhotoShareEventContext.eventId;
                startDate = startDate || window.PhotoShareEventContext.startDate;
                endDate = endDate || window.PhotoShareEventContext.endDate;
                console.log(`📅 Found event info in PhotoShare context`);
            }

            // Default date range if not found (last 7 days)
            if (!startDate || !endDate) {
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                startDate = weekAgo.toISOString();
                endDate = now.toISOString();
                console.log(`📅 Using default date range: ${startDate} to ${endDate}`);
            }

            return { eventId, startDate, endDate };
        }

        /**
         * Process selected photos and prepare for upload
         * @param {Object} pickerResult - Result from openEventPhotoPicker
         * @param {string} eventId - Target event ID for upload
         * @returns {Object} Processed photos ready for upload
         */
        processSelectedPhotos(pickerResult, eventId) {
            if (!pickerResult || !pickerResult.photos) {
                return { photos: [], count: 0 };
            }

            const processedPhotos = pickerResult.photos.map(photo => ({
                localIdentifier: photo.localIdentifier,
                base64: photo.base64,
                mimeType: photo.mimeType,
                creationDate: photo.creationDate,
                dimensions: {
                    width: photo.width,
                    height: photo.height
                },
                location: photo.location,
                targetEventId: eventId,
                uploadStatus: 'pending'
            }));

            console.log(`📤 Processed ${processedPhotos.length} photos for upload to event: ${eventId}`);
            
            return {
                photos: processedPhotos,
                count: processedPhotos.length,
                totalSize: processedPhotos.reduce((total, photo) => {
                    // Estimate size from base64 length
                    return total + (photo.base64.length * 0.75);
                }, 0)
            };
        }

        /**
         * Create a simple photo picker button for integration
         * @param {Object} options - Button configuration
         * @returns {HTMLElement} Button element
         */
        createPickerButton(options = {}) {
            const {
                text = '📸 Select Event Photos',
                className = 'event-photo-picker-btn',
                onclick = null,
                uploadedPhotoIds = []
            } = options;

            const button = document.createElement('button');
            button.textContent = text;
            button.className = className;
            
            // Default styles
            button.style.cssText = `
                background: linear-gradient(45deg, #4CAF50, #45a049);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
            `;

            // Hover effects
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.05)';
                button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
            });

            // Click handler
            button.addEventListener('click', async () => {
                if (onclick) {
                    onclick();
                } else {
                    try {
                        const result = await this.openPickerForCurrentEvent(uploadedPhotoIds);
                        console.log('📸 Photos selected:', result);
                        
                        // Dispatch custom event with result
                        window.dispatchEvent(new CustomEvent('eventPhotosSelected', {
                            detail: result
                        }));
                        
                    } catch (error) {
                        if (error.message !== 'cancelled') {
                            console.error('❌ Photo picker error:', error);
                            alert('Error selecting photos: ' + error.message);
                        }
                    }
                }
            });

            return button;
        }

        /**
         * Get plugin availability status
         * @returns {boolean} Whether the plugin is available
         */
        isPluginAvailable() {
            return this.isAvailable;
        }

        /**
         * Get estimated photos count for date range (quick check)
         * @param {string} startDate - ISO8601 start date
         * @param {string} endDate - ISO8601 end date
         * @returns {Promise<number>} Estimated photo count
         */
        async getEstimatedPhotoCount(startDate, endDate) {
            try {
                const metadata = await this.getEventPhotosMetadata({
                    startDate,
                    endDate,
                    uploadedPhotoIds: []
                });
                return metadata.totalCount;
            } catch (error) {
                console.warn('Could not get photo count:', error);
                return 0;
            }
        }
    }

    // Create global instance
    const eventPhotoPickerService = new EventPhotoPickerService();

    // Expose globally
    window.EventPhotoPickerService = eventPhotoPickerService;
    window.EventPhotoPicker = eventPhotoPickerService; // Shorter alias

    // Add integration with existing auto-upload system
    if (window.PhotoShareAutoUpload) {
        window.PhotoShareAutoUpload.eventPhotoPicker = eventPhotoPickerService;
    }

    // Listen for global event photos selected
    window.addEventListener('eventPhotosSelected', (event) => {
        console.log('📸 Event photos selected globally:', event.detail);
        
        // Auto-integrate with upload system if available
        if (window.PhotoShareAutoUpload?.uploadService && event.detail.photos) {
            const eventInfo = eventPhotoPickerService.detectCurrentEventInfo();
            if (eventInfo.eventId) {
                const processedPhotos = eventPhotoPickerService.processSelectedPhotos(
                    event.detail, 
                    eventInfo.eventId
                );
                
                console.log(`📤 Auto-queuing ${processedPhotos.count} photos for upload`);
                
                // Queue photos for upload
                processedPhotos.photos.forEach(photo => {
                    window.PhotoShareAutoUpload.uploadService.queuePhotoUpload(photo, eventInfo.eventId);
                });
            }
        }
    });

    console.log('✅ Event Photo Picker service ready');
    console.log('💡 Usage:');
    console.log('• EventPhotoPicker.openPickerForCurrentEvent() - Quick picker for current event');
    console.log('• EventPhotoPicker.createPickerButton() - Create UI button');
    console.log('• EventPhotoPicker.getEventPhotosMetadata() - Get photos metadata');

})();