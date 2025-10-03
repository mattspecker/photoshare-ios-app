/**
 * Event Photo Picker Demo
 * Test interface and examples for the custom event photo picker
 */

console.log('🧪 Event Photo Picker Demo loading...');

(function() {
    'use strict';

    class EventPhotoPickerDemo {
        constructor() {
            this.uploadedPhotoIds = []; // Simulated uploaded photos
            this.setupDemo();
        }

        setupDemo() {
            console.log('🧪 Setting up Event Photo Picker demo...');

            // Wait for the picker service to be available
            const checkService = setInterval(() => {
                if (window.EventPhotoPicker) {
                    clearInterval(checkService);
                    this.createDemoInterface();
                }
            }, 1000);

            // Stop checking after 10 seconds
            setTimeout(() => clearInterval(checkService), 10000);
        }

        createDemoInterface() {
            // Remove existing demo interface
            const existing = document.getElementById('event-photo-picker-demo');
            if (existing) existing.remove();

            // Create demo container
            const demoContainer = document.createElement('div');
            demoContainer.id = 'event-photo-picker-demo';
            demoContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 9999;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;

            let content = '<h4 style="margin-top:0;">📸 Event Photo Picker Demo</h4>';
            
            // Check plugin availability
            if (window.EventPhotoPicker?.isPluginAvailable()) {
                content += '<div style="color: #4CAF50;">✅ Native plugin available</div>';
                
                // Add demo buttons
                content += '<div style="margin-top: 10px;">';
                content += '<button id="demo-open-picker" style="background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;">📸 Open Picker</button>';
                content += '<button id="demo-get-metadata" style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;">📋 Get Metadata</button>';
                content += '<button id="demo-add-button" style="background: #FF9800; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin: 2px; cursor: pointer; font-size: 12px;">➕ Add Button</button>';
                content += '</div>';
                
                // Status area
                content += '<div id="demo-status" style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 12px; min-height: 40px;"></div>';
                
            } else {
                content += '<div style="color: #f44336;">❌ Native plugin not available</div>';
                content += '<div style="font-size: 12px; margin-top: 5px;">Plugin may not be built or device not available</div>';
            }

            // Add close button
            content += '<div style="text-align: right; margin-top: 10px;">';
            content += '<button id="demo-close" style="background: #f44336; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">Close</button>';
            content += '</div>';

            demoContainer.innerHTML = content;
            document.body.appendChild(demoContainer);

            // Add event listeners
            this.setupDemoEventListeners();

            console.log('✅ Demo interface created');
        }

        setupDemoEventListeners() {
            // Close button
            document.getElementById('demo-close')?.addEventListener('click', () => {
                document.getElementById('event-photo-picker-demo')?.remove();
            });

            // Open picker button
            document.getElementById('demo-open-picker')?.addEventListener('click', () => {
                this.demoOpenPicker();
            });

            // Get metadata button
            document.getElementById('demo-get-metadata')?.addEventListener('click', () => {
                this.demoGetMetadata();
            });

            // Add button demo
            document.getElementById('demo-add-button')?.addEventListener('click', () => {
                this.demoAddPickerButton();
            });
        }

        async demoOpenPicker() {
            const statusEl = document.getElementById('demo-status');
            if (statusEl) statusEl.textContent = '📸 Opening photo picker...';

            try {
                // Get demo date range (last 7 days)
                const endDate = new Date();
                const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

                // Format dates to ensure iOS compatibility (remove milliseconds)
                const formatDateForIOS = (date) => {
                    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
                };

                const options = {
                    eventId: 'demo-event-123',
                    startDate: formatDateForIOS(startDate),
                    endDate: formatDateForIOS(endDate),
                    uploadedPhotoIds: this.uploadedPhotoIds,
                    allowMultipleSelection: true,
                    title: 'Demo Event Photos'
                };

                console.log('🧪 Demo picker options:', options);
                console.log('📅 Start date string:', startDate.toISOString());
                console.log('📅 End date string:', endDate.toISOString());
                console.log('📅 Start date object:', startDate);
                console.log('📅 End date object:', endDate);

                const result = await window.EventPhotoPicker.openEventPhotoPicker(options);
                
                if (statusEl) {
                    statusEl.innerHTML = `✅ Selected ${result.count} photos<br>Total size: ${this.formatBytes(this.estimateSize(result.photos))}`;
                }

                // Simulate marking photos as uploaded
                if (result.photos) {
                    result.photos.forEach(photo => {
                        if (!this.uploadedPhotoIds.includes(photo.localIdentifier)) {
                            this.uploadedPhotoIds.push(photo.localIdentifier);
                        }
                    });
                }

                console.log('✅ Demo picker result:', result);

            } catch (error) {
                console.error('❌ Demo picker error:', error);
                if (statusEl) {
                    statusEl.textContent = `❌ Error: ${error.message}`;
                }
            }
        }

        async demoGetMetadata() {
            const statusEl = document.getElementById('demo-status');
            if (statusEl) statusEl.textContent = '📋 Getting photos metadata...';

            try {
                const endDate = new Date();
                const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

                const result = await window.EventPhotoPicker.getEventPhotosMetadata({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    uploadedPhotoIds: this.uploadedPhotoIds
                });

                if (statusEl) {
                    statusEl.innerHTML = `📊 Found ${result.totalCount} photos<br>📤 ${result.uploadedCount} uploaded<br>📋 ${result.pendingCount} pending`;
                }

                console.log('📊 Demo metadata result:', result);

            } catch (error) {
                console.error('❌ Demo metadata error:', error);
                if (statusEl) {
                    statusEl.textContent = `❌ Error: ${error.message}`;
                }
            }
        }

        demoAddPickerButton() {
            // Remove existing demo button
            const existing = document.getElementById('demo-picker-button');
            if (existing) existing.remove();

            // Create demo picker button
            const button = window.EventPhotoPicker.createPickerButton({
                text: '📸 Demo Event Photos',
                uploadedPhotoIds: this.uploadedPhotoIds,
                onclick: () => {
                    console.log('🧪 Demo picker button clicked!');
                }
            });

            button.id = 'demo-picker-button';
            button.style.position = 'fixed';
            button.style.top = '20px';
            button.style.right = '20px';
            button.style.zIndex = '9998';

            document.body.appendChild(button);

            const statusEl = document.getElementById('demo-status');
            if (statusEl) {
                statusEl.textContent = '➕ Demo button added to page (top-right)';
            }

            console.log('✅ Demo picker button added');
        }

        estimateSize(photos) {
            if (!photos) return 0;
            return photos.reduce((total, photo) => {
                return total + (photo.base64?.length || 0) * 0.75; // Estimate from base64
            }, 0);
        }

        formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Public API for testing
        async testCurrentEvent() {
            try {
                const result = await window.EventPhotoPicker.openPickerForCurrentEvent(this.uploadedPhotoIds);
                console.log('🧪 Current event test result:', result);
                return result;
            } catch (error) {
                console.error('❌ Current event test error:', error);
                throw error;
            }
        }

        async testDateRange(daysBack = 7) {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
            
            try {
                const result = await window.EventPhotoPicker.getEventPhotosMetadata({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                    uploadedPhotoIds: this.uploadedPhotoIds
                });
                
                console.log(`🧪 ${daysBack} days test result:`, result);
                return result;
            } catch (error) {
                console.error('❌ Date range test error:', error);
                throw error;
            }
        }

        clearUploadedPhotos() {
            this.uploadedPhotoIds = [];
            console.log('🧹 Cleared uploaded photos list');
        }

        getUploadedPhotos() {
            return [...this.uploadedPhotoIds];
        }
    }

    // Create global demo instance
    const demo = new EventPhotoPickerDemo();

    // Expose demo globally
    window.EventPhotoPickerDemo = demo;

    // Demo commands
    window.demoEventPhotoPicker = () => demo.createDemoInterface();
    window.testEventPhotoPicker = () => demo.testCurrentEvent();
    window.testPhotoDateRange = (days) => demo.testDateRange(days);

    console.log('✅ Event Photo Picker Demo ready');
    console.log('💡 Commands:');
    console.log('• demoEventPhotoPicker() - Show demo interface');
    console.log('• testEventPhotoPicker() - Test with current event');
    console.log('• testPhotoDateRange(7) - Test date range filtering');

})();