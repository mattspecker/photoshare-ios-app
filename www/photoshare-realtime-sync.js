/**
 * PhotoShare Real-Time Sync Integration
 * Connects mobile auto-upload system with useAutoUploadSync hook
 * Provides bidirectional real-time synchronization
 */

console.log('🔄 PhotoShare Real-Time Sync loading...');

(function() {
    'use strict';

    class PhotoShareRealTimeSync {
        constructor() {
            this.initialized = false;
            this.activeSubscriptions = new Map(); // eventId -> subscription
            this.currentUser = null;
            this.supabaseClient = null;
            this.syncCallbacks = new Set();
            this.isUpdating = false; // Prevent circular updates
        }

        async initialize() {
            if (this.initialized) return;

            console.log('🔧 Initializing Real-Time Sync...');

            // Wait for auth and auto-upload systems
            await this.waitForDependencies();

            // Get user and Supabase client
            this.currentUser = window.PhotoShareAutoUpload?.authService?.getCurrentUser();
            this.supabaseClient = window.PhotoShareAutoUpload?.authService?.getSupabaseClient();

            if (!this.currentUser || !this.supabaseClient) {
                console.log('❌ User or Supabase not available for real-time sync');
                return false;
            }

            // Set up real-time subscription for user's auto-upload changes
            this.setupUserSubscription();

            // Integrate with mobile settings service
            this.integrateWithMobileSettings();

            this.initialized = true;
            console.log('✅ Real-Time Sync initialized successfully');
            return true;
        }

        async waitForDependencies() {
            let retries = 0;
            while ((!window.PhotoShareAutoUpload?.initialized || !window.PhotoShareAutoUpload?.authService?.isAuthenticated()) && retries < 20) {
                console.log(`⏳ Waiting for dependencies... (${retries + 1}/20)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }
        }

        setupUserSubscription() {
            console.log('📡 Setting up real-time subscription for user auto-upload changes');

            // Subscribe to changes in event_participants table for this user
            const subscription = this.supabaseClient
                .channel(`user_auto_upload_${this.currentUser.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'event_participants',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    this.handleRemoteSettingsChange(payload);
                })
                .subscribe((status) => {
                    console.log(`📡 Real-time subscription status: ${status}`);
                });

            // Store subscription for cleanup
            this.activeSubscriptions.set('user_global', subscription);
        }

        handleRemoteSettingsChange(payload) {
            if (this.isUpdating) {
                console.log('🔄 Ignoring remote change (local update in progress)');
                return;
            }

            console.log('📥 Received remote auto-upload settings change:', payload);

            const { new: newRecord, old: oldRecord } = payload;
            
            // Check if auto-upload settings actually changed
            const autoUploadChanged = 
                newRecord.auto_upload_enabled !== oldRecord?.auto_upload_enabled ||
                newRecord.auto_upload_start_time !== oldRecord?.auto_upload_start_time ||
                newRecord.auto_upload_end_time !== oldRecord?.auto_upload_end_time;

            if (!autoUploadChanged) {
                console.log('ℹ️ Auto-upload settings unchanged, ignoring');
                return;
            }

            // Convert to mobile settings format
            const mobileSettings = this.convertToMobileSettings(newRecord);
            
            // Update mobile settings without triggering sync back
            this.updateMobileSettingsFromRemote(mobileSettings);

            // Notify callbacks
            this.notifyCallbacks(mobileSettings);
        }

        convertToMobileSettings(dbRecord) {
            return {
                eventId: dbRecord.event_id,
                userId: dbRecord.user_id,
                enabled: dbRecord.auto_upload_enabled || false,
                startTime: dbRecord.auto_upload_start_time,
                endTime: dbRecord.auto_upload_end_time,
                timestamp: new Date().toISOString(),
                source: 'remote'
            };
        }

        async updateMobileSettingsFromRemote(settings) {
            console.log(`🔄 Updating mobile settings from remote for event: ${settings.eventId}`);

            try {
                const settingsService = window.PhotoShareAutoUpload?.settingsService;
                if (!settingsService) return;

                if (settings.enabled) {
                    // Enable auto-upload with time constraints
                    await settingsService.enableAutoUploadForEvent(settings.eventId, {
                        startTime: settings.startTime,
                        endTime: settings.endTime,
                        source: 'remote-sync'
                    });
                } else {
                    // Disable auto-upload
                    await settingsService.disableAutoUploadForEvent(settings.eventId);
                }

                // Update dashboard
                if (window.PhotoShareAutoUpload?.uiIntegration) {
                    window.PhotoShareAutoUpload.uiIntegration.updateDashboardContent();
                }

                console.log(`✅ Mobile settings updated from remote for event: ${settings.eventId}`);

            } catch (error) {
                console.error('❌ Failed to update mobile settings from remote:', error);
            }
        }

        integrateWithMobileSettings() {
            console.log('🔗 Integrating with mobile settings service');

            const settingsService = window.PhotoShareAutoUpload?.settingsService;
            if (!settingsService) return;

            // Override the settings service methods to sync with backend
            const originalEnable = settingsService.enableAutoUploadForEvent.bind(settingsService);
            const originalDisable = settingsService.disableAutoUploadForEvent.bind(settingsService);

            settingsService.enableAutoUploadForEvent = async (eventId, options = {}) => {
                // Call original method first
                const result = await originalEnable(eventId, options);

                // Sync with backend if not from remote
                if (options.source !== 'remote-sync') {
                    await this.syncToBackend(eventId, true, options.startTime, options.endTime);
                }

                return result;
            };

            settingsService.disableAutoUploadForEvent = async (eventId) => {
                // Call original method first
                const result = await originalDisable(eventId);

                // Sync with backend
                await this.syncToBackend(eventId, false);

                return result;
            };

            console.log('✅ Mobile settings service integration complete');
        }

        async syncToBackend(eventId, enabled, startTime = null, endTime = null) {
            if (this.isUpdating) return; // Prevent circular updates

            console.log(`📤 Syncing to backend: Event ${eventId}, Enabled: ${enabled}`);

            try {
                this.isUpdating = true;

                // Method 1: Try using the RPC function
                const { data, error } = await this.supabaseClient.rpc('update_auto_upload_settings', {
                    event_uuid: eventId,
                    enabled: enabled,
                    start_time: startTime,
                    end_time: endTime
                });

                if (error) {
                    console.log('RPC failed, trying direct table update:', error.message);

                    // Method 2: Direct table update
                    const updateData = { auto_upload_enabled: enabled };
                    if (startTime) updateData.auto_upload_start_time = startTime;
                    if (endTime) updateData.auto_upload_end_time = endTime;

                    const { error: updateError } = await this.supabaseClient
                        .from('event_participants')
                        .update(updateData)
                        .eq('event_id', eventId)
                        .eq('user_id', this.currentUser.id);

                    if (updateError) {
                        throw updateError;
                    }
                }

                console.log(`✅ Successfully synced to backend: Event ${eventId}`);

            } catch (error) {
                console.error(`❌ Failed to sync to backend for event ${eventId}:`, error);
                throw error;
            } finally {
                // Reset flag after a delay to allow for real-time propagation
                setTimeout(() => {
                    this.isUpdating = false;
                }, 2000);
            }
        }

        // Manual sync methods for external use
        async syncEventToBackend(eventId) {
            const settingsService = window.PhotoShareAutoUpload?.settingsService;
            if (!settingsService) return false;

            const isEnabled = settingsService.isEnabledForEvent(eventId);
            const settings = settingsService.eventSettings.get(eventId);

            await this.syncToBackend(
                eventId, 
                isEnabled, 
                settings?.options?.startTime,
                settings?.options?.endTime
            );

            return true;
        }

        async syncAllEventsToBackend() {
            const settingsService = window.PhotoShareAutoUpload?.settingsService;
            if (!settingsService) return 0;

            const enabledEvents = settingsService.getEnabledEvents();
            let synced = 0;

            for (const eventId of enabledEvents) {
                try {
                    await this.syncEventToBackend(eventId);
                    synced++;
                } catch (error) {
                    console.error(`Failed to sync event ${eventId}:`, error);
                }
            }

            console.log(`✅ Synced ${synced}/${enabledEvents.length} events to backend`);
            return synced;
        }

        // Callback management
        onSettingsChange(callback) {
            this.syncCallbacks.add(callback);
            return () => this.syncCallbacks.delete(callback);
        }

        notifyCallbacks(settings) {
            this.syncCallbacks.forEach(callback => {
                try {
                    callback(settings);
                } catch (error) {
                    console.error('Error in sync callback:', error);
                }
            });
        }

        // Cleanup
        destroy() {
            console.log('🧹 Cleaning up real-time sync');

            // Unsubscribe from all channels
            this.activeSubscriptions.forEach((subscription, key) => {
                subscription.unsubscribe();
                console.log(`📡 Unsubscribed from ${key}`);
            });

            this.activeSubscriptions.clear();
            this.syncCallbacks.clear();
            this.initialized = false;
        }

        // Status and debugging
        getStatus() {
            return {
                initialized: this.initialized,
                user: this.currentUser?.email || 'None',
                activeSubscriptions: this.activeSubscriptions.size,
                isUpdating: this.isUpdating,
                callbackCount: this.syncCallbacks.size
            };
        }

        async testSync(eventId = 'test-event') {
            console.log(`🧪 Testing sync for event: ${eventId}`);

            try {
                // Test enable
                await window.PhotoShareAutoUpload.settingsService.enableAutoUploadForEvent(eventId);
                console.log('✅ Enable test passed');

                // Wait a bit
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Test disable  
                await window.PhotoShareAutoUpload.settingsService.disableAutoUploadForEvent(eventId);
                console.log('✅ Disable test passed');

                console.log('🎉 Sync test completed successfully');
                return true;

            } catch (error) {
                console.error('❌ Sync test failed:', error);
                return false;
            }
        }
    }

    // Create global instance
    const realTimeSync = new PhotoShareRealTimeSync();

    // Expose globally
    window.PhotoShareRealTimeSync = realTimeSync;

    // Auto-initialize when auto-upload system is ready
    const initializeSync = async () => {
        if (window.PhotoShareAutoUpload?.initialized) {
            await realTimeSync.initialize();
        } else {
            // Wait for auto-upload system
            setTimeout(initializeSync, 2000);
        }
    };

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeSync, 3000);
        });
    } else {
        setTimeout(initializeSync, 3000);
    }

    // Expose debug functions
    window.debugRealTimeSync = () => realTimeSync.getStatus();
    window.testAutoUploadSync = (eventId) => realTimeSync.testSync(eventId);
    window.syncAllEvents = () => realTimeSync.syncAllEventsToBackend();

    console.log('✅ PhotoShare Real-Time Sync loaded');

})();