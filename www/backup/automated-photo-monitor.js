/**
 * Automated Photo Monitor - Native iOS Background Monitoring
 * Uses custom PhotoLibraryMonitor plugin for true background photo detection
 */

console.log('📸 Automated Photo Monitor loading...');

(function() {
    'use strict';

    class AutomatedPhotoMonitor {
        constructor() {
            this.isMonitoring = false;
            this.plugin = null;
            this.lastCheckTime = null;
            this.uploadQueue = [];
            this.processingUpload = false;
        }

        async initialize() {
            console.log('🚀 Initializing automated photo monitor...');

            try {
                // Check if the native plugin is available
                if (!window.Capacitor?.Plugins?.PhotoLibraryMonitor) {
                    console.warn('⚠️ PhotoLibraryMonitor plugin not available, falling back to manual mode');
                    return false;
                }

                this.plugin = window.Capacitor.Plugins.PhotoLibraryMonitor;
                
                // Set up event listeners for native notifications
                this.setupEventListeners();
                
                // Check current monitoring status
                const status = await this.plugin.getMonitoringStatus();
                console.log('📊 Plugin status:', status);
                
                if (status.authorizationStatus === 'denied' || status.authorizationStatus === 'restricted') {
                    console.error('❌ Photo library access denied');
                    return false;
                }
                
                console.log('✅ Automated photo monitor ready');
                return true;
                
            } catch (error) {
                console.error('❌ Failed to initialize photo monitor:', error);
                return false;
            }
        }

        setupEventListeners() {
            console.log('🔄 Setting up native event listeners...');

            // Listen for new photos detected by native plugin
            window.Capacitor.Plugins.PhotoLibraryMonitor.addListener('newPhotosDetected', (data) => {
                console.log(`📸 Native detected ${data.photos.length} new photos!`);
                this.handleNewPhotosDetected(data.photos);
            });

            // Listen for photos ready for upload (with base64 data)
            window.Capacitor.Plugins.PhotoLibraryMonitor.addListener('photoReadyForUpload', (photoData) => {
                console.log('📤 Photo ready for upload:', photoData.id);
                this.handlePhotoReadyForUpload(photoData);
            });

            console.log('✅ Event listeners set up');
        }

        async startMonitoring() {
            if (this.isMonitoring) {
                console.log('⚠️ Already monitoring');
                return true;
            }

            console.log('🚀 Starting automated photo monitoring...');

            try {
                // Check if we have enabled events
                const enabledEvents = this.getEnabledEvents();
                if (enabledEvents.length === 0) {
                    console.log('⚠️ No enabled events for photo monitoring');
                    return false;
                }

                console.log(`🎯 Monitoring for ${enabledEvents.length} enabled events`);

                // Start native monitoring
                const result = await this.plugin.startMonitoring();
                
                if (result.success) {
                    this.isMonitoring = true;
                    this.lastCheckTime = new Date();
                    
                    console.log('✅ Automated monitoring started');
                    console.log('📋 Message:', result.message);
                    
                    // Show monitoring notification
                    this.showMonitoringNotification(true);
                    
                    return true;
                } else {
                    console.error('❌ Failed to start monitoring');
                    return false;
                }
                
            } catch (error) {
                console.error('❌ Error starting monitoring:', error);
                return false;
            }
        }

        async stopMonitoring() {
            if (!this.isMonitoring) {
                console.log('⚠️ Not currently monitoring');
                return true;
            }

            console.log('⏹️ Stopping automated photo monitoring...');

            try {
                const result = await this.plugin.stopMonitoring();
                
                this.isMonitoring = false;
                this.lastCheckTime = null;
                
                console.log('✅ Monitoring stopped');
                this.showMonitoringNotification(false);
                
                return true;
                
            } catch (error) {
                console.error('❌ Error stopping monitoring:', error);
                return false;
            }
        }

        async handleNewPhotosDetected(photos) {
            console.log(`🔍 Processing ${photos.length} newly detected photos...`);

            // Check if photos are within event timeframes
            const relevantPhotos = this.filterPhotosForEvents(photos);
            
            if (relevantPhotos.length === 0) {
                console.log('📋 No photos match current event timeframes');
                return;
            }

            console.log(`📸 ${relevantPhotos.length} photos match event criteria`);

            // Request full photo data from native plugin for relevant photos
            for (const photo of relevantPhotos) {
                try {
                    // Native plugin will automatically send 'photoReadyForUpload' event
                    console.log(`📱 Requesting full data for photo: ${photo.id}`);
                } catch (error) {
                    console.error(`❌ Error processing photo ${photo.id}:`, error);
                }
            }
        }

        async handlePhotoReadyForUpload(photoData) {
            console.log(`📤 Queueing photo for upload: ${photoData.id}`);

            // Add to upload queue
            this.uploadQueue.push({
                id: photoData.id,
                base64: photoData.base64,
                mimeType: photoData.mimeType,
                creationDate: new Date(photoData.creationDate * 1000),
                width: photoData.width,
                height: photoData.height,
                queuedAt: new Date()
            });

            console.log(`📋 Upload queue now has ${this.uploadQueue.length} photos`);

            // Process upload queue
            this.processUploadQueue();
        }

        async processUploadQueue() {
            if (this.processingUpload || this.uploadQueue.length === 0) {
                return;
            }

            this.processingUpload = true;
            console.log(`🔄 Processing upload queue (${this.uploadQueue.length} photos)...`);

            const enabledEvents = this.getEnabledEvents();
            
            while (this.uploadQueue.length > 0 && enabledEvents.length > 0) {
                const photo = this.uploadQueue.shift();
                
                try {
                    console.log(`📤 Uploading photo ${photo.id} to ${enabledEvents.length} events...`);
                    
                    // Upload to all enabled events
                    const uploadPromises = enabledEvents.map(eventId => 
                        this.uploadPhotoToEvent(photo, eventId)
                    );
                    
                    const results = await Promise.allSettled(uploadPromises);
                    
                    let successCount = 0;
                    results.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            successCount++;
                            console.log(`✅ Uploaded to event: ${enabledEvents[index]}`);
                        } else {
                            console.error(`❌ Upload failed for event ${enabledEvents[index]}:`, result.reason);
                        }
                    });
                    
                    console.log(`📊 Photo ${photo.id}: ${successCount}/${enabledEvents.length} uploads successful`);
                    
                    // Show upload success notification
                    if (successCount > 0) {
                        this.showUploadNotification(`📤 Photo uploaded to ${successCount} events`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error uploading photo ${photo.id}:`, error);
                }
                
                // Small delay between uploads to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.processingUpload = false;
            console.log('✅ Upload queue processing complete');
        }

        async uploadPhotoToEvent(photo, eventId) {
            const uploadService = window.PhotoShareAutoUpload?.uploadService;
            
            if (!uploadService) {
                throw new Error('Upload service not available');
            }

            // Prepare photo data for upload service
            const uploadData = {
                base64: photo.base64,
                mimeType: photo.mimeType,
                timestamp: photo.creationDate.toISOString(),
                source: 'automated_background',
                originalId: photo.id,
                dimensions: {
                    width: photo.width,
                    height: photo.height
                }
            };

            // Queue for reliable upload
            return await uploadService.queuePhotoUpload(uploadData, eventId);
        }

        filterPhotosForEvents(photos) {
            const enabledEvents = this.getEnabledEvents();
            if (enabledEvents.length === 0) return [];

            // Get event timeframes from settings
            const eventTimeframes = this.getEventTimeframes(enabledEvents);
            
            return photos.filter(photo => {
                const photoDate = new Date(photo.creationDate * 1000);
                
                // Check if photo falls within any enabled event timeframe
                return eventTimeframes.some(timeframe => {
                    const start = timeframe.startTime || new Date(0);
                    const end = timeframe.endTime || new Date();
                    
                    return photoDate >= start && photoDate <= end;
                });
            });
        }

        getEnabledEvents() {
            try {
                return window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
            } catch (e) {
                console.warn('Could not get enabled events:', e);
                return [];
            }
        }

        getEventTimeframes(eventIds) {
            const timeframes = [];
            
            try {
                const settingsService = window.PhotoShareAutoUpload?.settingsService;
                if (!settingsService) return timeframes;

                eventIds.forEach(eventId => {
                    const settings = settingsService.getEventSettings(eventId);
                    if (settings) {
                        timeframes.push({
                            eventId,
                            startTime: settings.startTime ? new Date(settings.startTime) : null,
                            endTime: settings.endTime ? new Date(settings.endTime) : null
                        });
                    }
                });
                
            } catch (e) {
                console.warn('Could not get event timeframes:', e);
            }
            
            return timeframes;
        }

        showMonitoringNotification(isActive) {
            const message = isActive 
                ? '📸 Background photo monitoring active'
                : '⏹️ Photo monitoring stopped';
                
            this.showNotification(message, isActive ? 'success' : 'info');
        }

        showUploadNotification(message) {
            this.showNotification(message, 'success');
        }

        showNotification(message, type = 'info') {
            // Remove existing notification
            const existing = document.getElementById('photo-monitor-notification');
            if (existing) existing.remove();

            // Create notification
            const notification = document.createElement('div');
            notification.id = 'photo-monitor-notification';
            notification.style.cssText = `
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                z-index: 10000;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                max-width: 80vw;
                text-align: center;
            `;

            notification.textContent = message;
            document.body.appendChild(notification);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        }

        async getStatus() {
            try {
                const pluginStatus = await this.plugin?.getMonitoringStatus();
                
                return {
                    available: !!this.plugin,
                    monitoring: this.isMonitoring,
                    queueLength: this.uploadQueue.length,
                    processingUpload: this.processingUpload,
                    lastCheckTime: this.lastCheckTime,
                    authorizationStatus: pluginStatus?.authorizationStatus,
                    enabledEvents: this.getEnabledEvents().length
                };
            } catch (e) {
                return {
                    available: false,
                    error: e.message
                };
            }
        }

        // Public API methods
        async checkForNewPhotos() {
            if (!this.plugin) {
                console.warn('⚠️ Plugin not available');
                return [];
            }

            try {
                const result = await this.plugin.getPhotosSinceLastCheck();
                return result.photos || [];
            } catch (error) {
                console.error('❌ Error checking for new photos:', error);
                return [];
            }
        }
    }

    // Create global instance
    const automatedMonitor = new AutomatedPhotoMonitor();

    // Auto-initialize if auto-upload system is available
    if (window.PhotoShareAutoUpload) {
        automatedMonitor.initialize();
    } else {
        // Wait for auto-upload system to load
        const checkForSystem = setInterval(() => {
            if (window.PhotoShareAutoUpload) {
                clearInterval(checkForSystem);
                automatedMonitor.initialize();
            }
        }, 1000);
        
        // Stop checking after 30 seconds
        setTimeout(() => clearInterval(checkForSystem), 30000);
    }

    // Expose globally
    window.PhotoShareAutomatedMonitor = automatedMonitor;

    // Add to main system if available
    if (window.PhotoShareAutoUpload) {
        window.PhotoShareAutoUpload.automatedMonitor = automatedMonitor;
    }

    console.log('✅ Automated Photo Monitor system ready');
    console.log('💡 Commands available:');
    console.log('• window.PhotoShareAutomatedMonitor.startMonitoring() - Start background monitoring');
    console.log('• window.PhotoShareAutomatedMonitor.stopMonitoring() - Stop monitoring');
    console.log('• window.PhotoShareAutomatedMonitor.getStatus() - Get monitoring status');
    console.log('• window.PhotoShareAutomatedMonitor.checkForNewPhotos() - Manual check for new photos');

})();