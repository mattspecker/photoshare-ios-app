import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { isRunningInNativeApp, showToast } from './cameraPermissions.js';
import { uploadQueue, initializeUploadQueue } from './uploadQueue.js';

/**
 * AutoUploadManager - Main orchestrator for auto-upload functionality
 * Handles event checking, user authentication, and upload coordination
 */
export class AutoUploadManager {
  constructor() {
    this.isInitialized = false;
    this.activeEvents = new Map(); // eventId -> event data
    this.uploadEnabled = false;
    this.currentUser = null;
    this.supabaseClient = null;
    this.realtimeSubscription = null;
    
    // Configuration
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      uploadEndpoint: '/functions/v1/mobile-upload',
      rateLimit: {
        maxUploads: 50,
        windowMinutes: 60
      }
    };
    
    console.log('🚀 AutoUploadManager initialized');
  }

  /**
   * Initialize the auto-upload system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('📱 Initializing AutoUploadManager...');
      
      // Platform check
      const platformInfo = await isRunningInNativeApp();
      if (!platformInfo.isNative) {
        console.log('❌ Auto-upload only available on native platforms');
        return false;
      }

      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;
      
      // Check required permissions
      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.log('❌ Required permissions not granted');
        return false;
      }

      // Load user's active events with auto-upload enabled
      await this.loadActiveEvents();
      
      // Initialize upload queue
      const queueInitialized = await initializeUploadQueue(supabaseClient, currentUser);
      if (!queueInitialized) {
        console.log('❌ Upload queue initialization failed');
        return false;
      }
      
      // Set up real-time subscriptions for event updates
      await this.setupRealtimeSubscriptions();
      
      this.isInitialized = true;
      this.uploadEnabled = this.activeEvents.size > 0;
      
      console.log('✅ AutoUploadManager initialized successfully');
      console.log(`📊 Active events: ${this.activeEvents.size}`);
      
      showToast(`Auto-upload ready: ${this.activeEvents.size} active events`, 'success');
      return true;
      
    } catch (error) {
      console.error('Error initializing AutoUploadManager:', error);
      showToast('Error initializing auto-upload: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Check if auto-upload is currently active for any events
   */
  isAutoUploadActive() {
    if (!this.isInitialized || !this.uploadEnabled) {
      return false;
    }
    
    const now = new Date();
    
    // Check if any active events are currently within their upload window
    for (const [eventId, eventData] of this.activeEvents) {
      if (this.isEventInUploadWindow(eventData, now)) {
        console.log(`✅ Auto-upload active for event: ${eventId}`);
        return true;
      }
    }
    
    console.log('📴 No events currently in upload window');
    return false;
  }

  /**
   * Get active events that are currently accepting uploads
   */
  getActiveUploadEvents() {
    if (!this.isInitialized) {
      return [];
    }
    
    const now = new Date();
    const activeEvents = [];
    
    for (const [eventId, eventData] of this.activeEvents) {
      if (this.isEventInUploadWindow(eventData, now)) {
        activeEvents.push({
          eventId,
          eventName: eventData.name,
          uploadWindow: {
            start: eventData.auto_upload_start_time,
            end: eventData.auto_upload_end_time
          },
          isLive: eventData.is_live
        });
      }
    }
    
    return activeEvents;
  }

  /**
   * Check if an event is currently in its upload window
   */
  isEventInUploadWindow(eventData, currentTime = new Date()) {
    if (!eventData.is_live) {
      return false;
    }
    
    const startTime = new Date(eventData.auto_upload_start_time);
    const endTime = new Date(eventData.auto_upload_end_time);
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Load user's events with auto-upload enabled
   */
  async loadActiveEvents() {
    try {
      console.log('📊 Loading active events...');
      
      if (!this.supabaseClient || !this.currentUser) {
        throw new Error('Supabase client or user not available');
      }

      // Query for events where user is participant and auto-upload is enabled
      const { data: events, error } = await this.supabaseClient
        .from('event_participants')
        .select(`
          event_id,
          auto_upload_start_time,
          auto_upload_end_time,
          events!inner (
            id,
            name,
            is_live,
            created_at
          )
        `)
        .eq('user_id', this.currentUser.id)
        .eq('auto_upload_enabled', true);

      if (error) {
        throw error;
      }

      // Store active events
      this.activeEvents.clear();
      
      if (events && events.length > 0) {
        events.forEach(participant => {
          const eventData = {
            id: participant.events.id,
            name: participant.events.name,
            is_live: participant.events.is_live,
            auto_upload_start_time: participant.auto_upload_start_time,
            auto_upload_end_time: participant.auto_upload_end_time,
            created_at: participant.events.created_at
          };
          
          this.activeEvents.set(participant.event_id, eventData);
          console.log(`📅 Loaded event: ${eventData.name} (ID: ${participant.event_id})`);
        });
      }
      
      console.log(`✅ Loaded ${this.activeEvents.size} active events`);
      
    } catch (error) {
      console.error('Error loading active events:', error);
      throw error;
    }
  }

  /**
   * Set up real-time subscriptions for event status changes
   */
  async setupRealtimeSubscriptions() {
    try {
      console.log('🔔 Setting up real-time subscriptions...');
      
      if (!this.supabaseClient) {
        return;
      }

      // Subscribe to event status changes
      this.realtimeSubscription = this.supabaseClient
        .channel('auto-upload-events')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes
            schema: 'public',
            table: 'events'
          },
          (payload) => this.handleEventStatusChange(payload)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public', 
            table: 'event_participants'
          },
          (payload) => this.handleParticipantChange(payload)
        )
        .subscribe();

      console.log('✅ Real-time subscriptions established');
      
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
      // Non-fatal error - auto-upload can work without real-time updates
    }
  }

  /**
   * Handle real-time event status changes
   */
  handleEventStatusChange(payload) {
    try {
      console.log('🔄 Event status change received:', payload);
      
      const { new: newRecord, old: oldRecord, eventType } = payload;
      
      if (eventType === 'UPDATE' && newRecord && oldRecord) {
        const eventId = newRecord.id;
        
        // Check if this is an event we're tracking
        if (this.activeEvents.has(eventId)) {
          const eventData = this.activeEvents.get(eventId);
          
          // Update the event data
          eventData.is_live = newRecord.is_live;
          eventData.name = newRecord.name;
          
          this.activeEvents.set(eventId, eventData);
          
          console.log(`📊 Updated event ${eventId}: is_live=${newRecord.is_live}`);
          
          // Notify about status change
          if (oldRecord.is_live !== newRecord.is_live) {
            const status = newRecord.is_live ? 'started' : 'ended';
            showToast(`Event "${eventData.name}" ${status}`, 'info');
          }
        }
      }
      
    } catch (error) {
      console.error('Error handling event status change:', error);
    }
  }

  /**
   * Handle real-time participant changes
   */
  handleParticipantChange(payload) {
    try {
      console.log('👥 Participant change received:', payload);
      
      const { new: newRecord, eventType } = payload;
      
      // If this affects current user, reload events
      if (newRecord && newRecord.user_id === this.currentUser?.id) {
        console.log('🔄 Reloading events due to participant change...');
        this.loadActiveEvents();
      }
      
    } catch (error) {
      console.error('Error handling participant change:', error);
    }
  }

  /**
   * Check required permissions for auto-upload
   */
  async checkPermissions() {
    try {
      console.log('🔐 Checking permissions...');
      
      // Check photo library permissions
      const permissions = await Camera.checkPermissions();
      
      if (permissions.photos !== 'granted') {
        console.log('❌ Photo library permission not granted');
        showToast('Photo library access required for auto-upload', 'error');
        return false;
      }
      
      console.log('✅ All permissions granted');
      return true;
      
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Get upload configuration and limits
   */
  getUploadConfig() {
    return {
      ...this.config,
      isActive: this.isAutoUploadActive(),
      activeEvents: this.getActiveUploadEvents(),
      rateLimitStatus: {
        maxUploads: this.config.rateLimit.maxUploads,
        windowMinutes: this.config.rateLimit.windowMinutes,
        // TODO: Track actual usage once upload queue is implemented
        currentUploads: 0,
        remainingUploads: this.config.rateLimit.maxUploads
      }
    };
  }

  /**
   * Enable/disable auto-upload
   */
  setAutoUploadEnabled(enabled) {
    if (this.isInitialized) {
      this.uploadEnabled = enabled && this.activeEvents.size > 0;
      console.log(`🔄 Auto-upload ${this.uploadEnabled ? 'enabled' : 'disabled'}`);
      showToast(`Auto-upload ${this.uploadEnabled ? 'enabled' : 'disabled'}`, 'info');
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up AutoUploadManager...');
      
      // Unsubscribe from real-time updates
      if (this.realtimeSubscription) {
        await this.realtimeSubscription.unsubscribe();
        this.realtimeSubscription = null;
      }
      
      // Clean up upload queue
      await uploadQueue.cleanup();
      
      // Clear data
      this.activeEvents.clear();
      this.isInitialized = false;
      this.uploadEnabled = false;
      this.currentUser = null;
      this.supabaseClient = null;
      
      console.log('✅ AutoUploadManager cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up AutoUploadManager:', error);
    }
  }

  /**
   * Get current status for debugging
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      uploadEnabled: this.uploadEnabled,
      activeEventsCount: this.activeEvents.size,
      isAutoUploadActive: this.isAutoUploadActive(),
      currentUser: this.currentUser?.id || null,
      hasRealtimeSubscription: !!this.realtimeSubscription,
      activeEvents: Array.from(this.activeEvents.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        isLive: data.is_live,
        inUploadWindow: this.isEventInUploadWindow(data)
      }))
    };
  }
}

// Export singleton instance
export const autoUploadManager = new AutoUploadManager();

// Export for remote website integration
export async function initializeAutoUpload(supabaseClient, currentUser) {
  return await autoUploadManager.initialize(supabaseClient, currentUser);
}

export function getAutoUploadStatus() {
  return autoUploadManager.getStatus();
}

export function isAutoUploadActive() {
  return autoUploadManager.isAutoUploadActive();
}

export function getAutoUploadConfig() {
  return autoUploadManager.getUploadConfig();
}

export function setAutoUploadEnabled(enabled) {
  autoUploadManager.setAutoUploadEnabled(enabled);
}