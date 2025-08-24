/**
 * Automated Upload Integration
 * Combines the automated photo monitor with the existing upload system
 */

console.log('🔗 Automated Upload Integration loading...');

(function() {
    'use strict';

    class AutomatedUploadIntegration {
        constructor() {
            this.isInitialized = false;
            this.monitoringActive = false;
            this.statusCheckInterval = null;
        }

        async initialize() {
            console.log('🚀 Initializing automated upload integration...');

            try {
                // Wait for required systems to be available
                await this.waitForSystems();
                
                // Initialize automated monitor
                const monitorAvailable = await window.PhotoShareAutomatedMonitor.initialize();
                
                if (!monitorAvailable) {
                    console.warn('⚠️ Automated monitor not available, integration will use manual mode');
                    return false;
                }

                // Set up integration between systems
                this.setupIntegration();
                
                // Start monitoring if events are enabled
                await this.checkAndStartMonitoring();
                
                // Set up periodic status checks
                this.startStatusChecking();
                
                this.isInitialized = true;
                console.log('✅ Automated upload integration ready');
                
                return true;
                
            } catch (error) {
                console.error('❌ Failed to initialize automated upload integration:', error);
                return false;
            }
        }

        async waitForSystems() {
            console.log('⏳ Waiting for required systems...');
            
            // Wait for auto-upload system
            let attempts = 0;
            while (!window.PhotoShareAutoUpload && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            if (!window.PhotoShareAutoUpload) {
                throw new Error('PhotoShareAutoUpload system not available');
            }
            
            // Wait for automated monitor
            attempts = 0;
            while (!window.PhotoShareAutomatedMonitor && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
            
            if (!window.PhotoShareAutomatedMonitor) {
                throw new Error('PhotoShareAutomatedMonitor not available');
            }
            
            console.log('✅ All required systems available');
        }

        setupIntegration() {
            console.log('🔗 Setting up system integration...');

            // Override the photo monitor in the main auto-upload system
            if (window.PhotoShareAutoUpload.photoMonitor) {
                console.log('📱 Replacing manual photo monitor with automated monitor');
                
                // Keep reference to original for fallback
                window.PhotoShareAutoUpload.manualPhotoMonitor = window.PhotoShareAutoUpload.photoMonitor;
                
                // Replace with automated monitor
                window.PhotoShareAutoUpload.photoMonitor = {
                    startMonitoring: () => this.startAutomatedMonitoring(),
                    stopMonitoring: () => this.stopAutomatedMonitoring(),
                    isMonitoring: () => this.monitoringActive,
                    getStatus: () => this.getMonitoringStatus(),
                    checkForNewPhotos: () => window.PhotoShareAutomatedMonitor.checkForNewPhotos()
                };
            }

            // Integrate with settings service to auto-start/stop monitoring
            this.enhanceSettingsService();
            
            console.log('✅ System integration complete');
        }

        enhanceSettingsService() {
            const settingsService = window.PhotoShareAutoUpload?.settingsService;
            if (!settingsService) return;

            // Store original methods
            const originalEnableEvent = settingsService.enableAutoUploadForEvent?.bind(settingsService);
            const originalDisableEvent = settingsService.disableAutoUploadForEvent?.bind(settingsService);

            // Override to trigger monitoring changes
            if (originalEnableEvent) {
                settingsService.enableAutoUploadForEvent = async (eventId, options) => {
                    const result = originalEnableEvent(eventId, options);
                    await this.checkAndStartMonitoring();
                    return result;
                };
            }

            if (originalDisableEvent) {
                settingsService.disableAutoUploadForEvent = async (eventId) => {
                    const result = originalDisableEvent(eventId);
                    await this.checkAndStopMonitoring();
                    return result;
                };
            }

            console.log('✅ Settings service enhanced with monitoring hooks');
        }

        async checkAndStartMonitoring() {
            const enabledEvents = this.getEnabledEvents();
            
            if (enabledEvents.length > 0 && !this.monitoringActive) {
                console.log(`🎯 Found ${enabledEvents.length} enabled events, starting monitoring...`);
                await this.startAutomatedMonitoring();
            } else if (enabledEvents.length === 0 && this.monitoringActive) {
                console.log('⏹️ No enabled events, stopping monitoring...');
                await this.stopAutomatedMonitoring();
            }
        }

        async checkAndStopMonitoring() {
            const enabledEvents = this.getEnabledEvents();
            
            if (enabledEvents.length === 0 && this.monitoringActive) {
                console.log('⏹️ No more enabled events, stopping monitoring...');
                await this.stopAutomatedMonitoring();
            }
        }

        async startAutomatedMonitoring() {
            if (this.monitoringActive) {
                console.log('⚠️ Automated monitoring already active');
                return true;
            }

            try {
                const success = await window.PhotoShareAutomatedMonitor.startMonitoring();
                
                if (success) {
                    this.monitoringActive = true;
                    console.log('✅ Automated monitoring started');
                    
                    // Update main system status
                    this.updateMainSystemStatus();
                    
                    return true;
                } else {
                    console.error('❌ Failed to start automated monitoring');
                    return false;
                }
                
            } catch (error) {
                console.error('❌ Error starting automated monitoring:', error);
                return false;
            }
        }

        async stopAutomatedMonitoring() {
            if (!this.monitoringActive) {
                console.log('⚠️ Automated monitoring not active');
                return true;
            }

            try {
                const success = await window.PhotoShareAutomatedMonitor.stopMonitoring();
                
                this.monitoringActive = false;
                console.log('✅ Automated monitoring stopped');
                
                // Update main system status
                this.updateMainSystemStatus();
                
                return true;
                
            } catch (error) {
                console.error('❌ Error stopping automated monitoring:', error);
                return false;
            }
        }

        getMonitoringStatus() {
            return {
                automated: this.monitoringActive,
                available: !!window.PhotoShareAutomatedMonitor,
                initialized: this.isInitialized,
                enabledEvents: this.getEnabledEvents().length
            };
        }

        getEnabledEvents() {
            try {
                return window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
            } catch (e) {
                return [];
            }
        }

        updateMainSystemStatus() {
            // Trigger status update in main auto-upload system
            if (window.PhotoShareAutoUpload?.getStatus) {
                const status = window.PhotoShareAutoUpload.getStatus();
                console.log('📊 Updated system status:', {
                    monitoring: this.monitoringActive,
                    enabledEvents: this.getEnabledEvents().length
                });
            }
        }

        startStatusChecking() {
            // Check status every 30 seconds
            this.statusCheckInterval = setInterval(() => {
                this.checkSystemHealth();
            }, 30000);

            console.log('✅ Status checking started (30 second intervals)');
        }

        async checkSystemHealth() {
            try {
                const enabledEvents = this.getEnabledEvents();
                const monitorStatus = await window.PhotoShareAutomatedMonitor?.getStatus();
                
                // Auto-restart monitoring if needed
                if (enabledEvents.length > 0 && !this.monitoringActive && monitorStatus?.available) {
                    console.log('🔄 Auto-restarting monitoring for enabled events...');
                    await this.startAutomatedMonitoring();
                }
                
                // Auto-stop monitoring if no events
                if (enabledEvents.length === 0 && this.monitoringActive) {
                    console.log('🔄 Auto-stopping monitoring (no enabled events)...');
                    await this.stopAutomatedMonitoring();
                }
                
            } catch (error) {
                console.warn('⚠️ System health check failed:', error);
            }
        }

        // Public API
        async getFullStatus() {
            try {
                const monitorStatus = await window.PhotoShareAutomatedMonitor?.getStatus();
                const mainStatus = window.PhotoShareAutoUpload?.getStatus();
                
                return {
                    integration: {
                        initialized: this.isInitialized,
                        monitoring: this.monitoringActive
                    },
                    automated: monitorStatus,
                    mainSystem: mainStatus,
                    enabledEvents: this.getEnabledEvents()
                };
            } catch (error) {
                return {
                    error: error.message,
                    integration: {
                        initialized: this.isInitialized,
                        monitoring: this.monitoringActive
                    }
                };
            }
        }

        async forceStartMonitoring() {
            console.log('🔧 Force starting automated monitoring...');
            return await this.startAutomatedMonitoring();
        }

        async forceStopMonitoring() {
            console.log('🔧 Force stopping automated monitoring...');
            return await this.stopAutomatedMonitoring();
        }

        async triggerManualPhotoCheck() {
            console.log('🔍 Triggering manual photo check...');
            
            try {
                const photos = await window.PhotoShareAutomatedMonitor?.checkForNewPhotos();
                console.log(`📸 Manual check found ${photos?.length || 0} new photos`);
                return photos || [];
            } catch (error) {
                console.error('❌ Manual photo check failed:', error);
                return [];
            }
        }
    }

    // Create global instance
    const integration = new AutomatedUploadIntegration();

    // Auto-initialize
    integration.initialize();

    // Expose globally
    window.PhotoShareAutomatedUploadIntegration = integration;

    // Add to main system
    if (window.PhotoShareAutoUpload) {
        window.PhotoShareAutoUpload.automatedIntegration = integration;
    }

    console.log('✅ Automated Upload Integration ready');
    console.log('💡 Commands available:');
    console.log('• window.PhotoShareAutomatedUploadIntegration.getFullStatus() - Get complete status');
    console.log('• window.PhotoShareAutomatedUploadIntegration.forceStartMonitoring() - Force start monitoring');
    console.log('• window.PhotoShareAutomatedUploadIntegration.forceStopMonitoring() - Force stop monitoring');
    console.log('• window.PhotoShareAutomatedUploadIntegration.triggerManualPhotoCheck() - Manual photo check');

})();