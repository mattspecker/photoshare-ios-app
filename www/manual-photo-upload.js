/**
 * Manual Photo Upload for iOS
 * Fixes the iOS photo library access issue by providing manual photo selection
 */

console.log('📱 Manual Photo Upload system loading...');

(function() {
    'use strict';

    class ManualPhotoUpload {
        constructor() {
            this.uploadButton = null;
            this.isUploading = false;
        }

        async initialize() {
            console.log('🚀 Initializing manual photo upload...');
            
            // Check if we have enabled events
            if (!this.hasEnabledEvents()) {
                console.log('⚠️ No enabled events, skipping upload button');
                return false;
            }

            // Create floating upload button
            this.createUploadButton();
            
            // Monitor for enabled events changes
            this.startMonitoring();
            
            console.log('✅ Manual photo upload ready');
            return true;
        }

        hasEnabledEvents() {
            try {
                const enabledEvents = window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
                return enabledEvents.length > 0;
            } catch (e) {
                console.warn('Could not check enabled events:', e);
                return false;
            }
        }

        createUploadButton() {
            // Remove existing button
            if (this.uploadButton) {
                this.uploadButton.remove();
            }

            // Create floating upload button
            this.uploadButton = document.createElement('button');
            this.uploadButton.id = 'photoshare-upload-btn';
            this.uploadButton.innerHTML = '📤<br><span style="font-size:10px;">Upload</span>';
            this.uploadButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(45deg, #4CAF50, #45a049);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                line-height: 1;
                transition: all 0.3s ease;
            `;

            // Add hover effects
            this.uploadButton.addEventListener('mouseenter', () => {
                this.uploadButton.style.transform = 'scale(1.1)';
                this.uploadButton.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
            });

            this.uploadButton.addEventListener('mouseleave', () => {
                this.uploadButton.style.transform = 'scale(1)';
                this.uploadButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            });

            // Add click handler
            this.uploadButton.addEventListener('click', () => this.selectAndUploadPhoto());

            document.body.appendChild(this.uploadButton);
            console.log('✅ Upload button created');
        }

        async selectAndUploadPhoto() {
            if (this.isUploading) {
                console.log('⚠️ Upload already in progress');
                return;
            }

            console.log('📷 Opening photo picker...');
            this.setButtonState('selecting');

            try {
                // Use Capacitor Camera to access photo library
                const photo = await Capacitor.Plugins.Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: CameraResultType.Uri, // Use Uri instead of Base64 to avoid IndexedDB limits
                    source: CameraSource.Photos
                });

                console.log('📸 Photo selected, uploading...');
                this.setButtonState('uploading');

                // Upload to all enabled events
                const enabledEvents = window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
                
                if (enabledEvents.length === 0) {
                    throw new Error('No enabled events found');
                }

                let uploadCount = 0;
                const uploadPromises = enabledEvents.map(async (eventId) => {
                    try {
                        await this.uploadPhotoToEvent(photo, eventId);
                        uploadCount++;
                        console.log(`✅ Uploaded to event: ${eventId}`);
                    } catch (error) {
                        console.error(`❌ Upload failed for event ${eventId}:`, error);
                    }
                });

                await Promise.all(uploadPromises);

                if (uploadCount > 0) {
                    this.setButtonState('success');
                    this.showUploadSuccess(uploadCount, enabledEvents.length);
                } else {
                    this.setButtonState('error');
                    this.showUploadError('All uploads failed');
                }

            } catch (error) {
                console.error('❌ Photo selection/upload failed:', error);
                this.setButtonState('error');
                this.showUploadError(error.message);
            }

            // Reset button after 3 seconds
            setTimeout(() => this.setButtonState('ready'), 3000);
        }

        async uploadPhotoToEvent(photo, eventId) {
            const uploadService = window.PhotoShareAutoUpload?.uploadService;
            if (!uploadService) {
                throw new Error('Upload service not available');
            }

            // Create photo object for upload service
            const photoData = {
                base64: photo.base64String,
                format: photo.format || 'jpeg',
                timestamp: new Date().toISOString(),
                source: 'manual_upload',
                eventId: eventId
            };

            // Queue for upload
            return await uploadService.queuePhotoUpload(photoData, eventId);
        }

        setButtonState(state) {
            if (!this.uploadButton) return;

            this.isUploading = state === 'uploading' || state === 'selecting';

            switch (state) {
                case 'ready':
                    this.uploadButton.innerHTML = '📤<br><span style="font-size:10px;">Upload</span>';
                    this.uploadButton.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
                    this.uploadButton.disabled = false;
                    break;

                case 'selecting':
                    this.uploadButton.innerHTML = '📷<br><span style="font-size:10px;">Select</span>';
                    this.uploadButton.style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
                    this.uploadButton.disabled = true;
                    break;

                case 'uploading':
                    this.uploadButton.innerHTML = '⬆️<br><span style="font-size:10px;">Sending</span>';
                    this.uploadButton.style.background = 'linear-gradient(45deg, #FF9800, #F57C00)';
                    this.uploadButton.disabled = true;
                    break;

                case 'success':
                    this.uploadButton.innerHTML = '✅<br><span style="font-size:10px;">Done</span>';
                    this.uploadButton.style.background = 'linear-gradient(45deg, #4CAF50, #2E7D32)';
                    this.uploadButton.disabled = true;
                    break;

                case 'error':
                    this.uploadButton.innerHTML = '❌<br><span style="font-size:10px;">Error</span>';
                    this.uploadButton.style.background = 'linear-gradient(45deg, #f44336, #c62828)';
                    this.uploadButton.disabled = true;
                    break;
            }
        }

        showUploadSuccess(successCount, totalEvents) {
            this.showNotification(
                `✅ Photo uploaded successfully to ${successCount}/${totalEvents} events`,
                'success'
            );
        }

        showUploadError(message) {
            this.showNotification(`❌ Upload failed: ${message}`, 'error');
        }

        showNotification(message, type = 'info') {
            // Remove existing notification
            const existing = document.getElementById('photoshare-notification');
            if (existing) existing.remove();

            // Create notification
            const notification = document.createElement('div');
            notification.id = 'photoshare-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 10000;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                max-width: 90vw;
                text-align: center;
            `;

            notification.textContent = message;
            document.body.appendChild(notification);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }

        startMonitoring() {
            // Check for enabled events changes every 5 seconds
            setInterval(() => {
                const hasEnabled = this.hasEnabledEvents();
                
                if (hasEnabled && !this.uploadButton) {
                    console.log('📤 Enabled events detected, showing upload button');
                    this.createUploadButton();
                } else if (!hasEnabled && this.uploadButton) {
                    console.log('📤 No enabled events, hiding upload button');
                    this.uploadButton.remove();
                    this.uploadButton = null;
                }
            }, 5000);
        }

        // Public methods
        show() {
            if (this.hasEnabledEvents()) {
                this.createUploadButton();
            } else {
                console.log('⚠️ No enabled events for manual upload');
            }
        }

        hide() {
            if (this.uploadButton) {
                this.uploadButton.remove();
                this.uploadButton = null;
            }
        }

        triggerUpload() {
            this.selectAndUploadPhoto();
        }
    }

    // Create global instance
    const manualUpload = new ManualPhotoUpload();

    // Auto-initialize if auto-upload system is available
    if (window.PhotoShareAutoUpload) {
        manualUpload.initialize();
    } else {
        // Wait for auto-upload system to load
        const checkForSystem = setInterval(() => {
            if (window.PhotoShareAutoUpload) {
                clearInterval(checkForSystem);
                manualUpload.initialize();
            }
        }, 1000);
        
        // Stop checking after 30 seconds
        setTimeout(() => clearInterval(checkForSystem), 30000);
    }

    // Expose globally
    window.PhotoShareManualUpload = manualUpload;

    // Add to main system if available
    if (window.PhotoShareAutoUpload) {
        window.PhotoShareAutoUpload.manualUpload = manualUpload;
    }

    console.log('✅ Manual Photo Upload system ready');
    console.log('💡 Commands available:');
    console.log('• window.PhotoShareManualUpload.show() - Show upload button');
    console.log('• window.PhotoShareManualUpload.hide() - Hide upload button');
    console.log('• window.PhotoShareManualUpload.triggerUpload() - Start photo upload');

})();