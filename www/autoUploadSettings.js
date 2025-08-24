/**
 * AutoUploadSettings - User interface for managing auto-upload preferences
 * Provides opt-in/opt-out controls for event-specific auto-upload functionality
 */

console.log('⚙️ Loading autoUploadSettings.js...');

class AutoUploadSettings {
  constructor() {
    this.isInitialized = false;
    this.supabaseClient = null;
    this.currentUser = null;
    this.userSettings = new Map(); // eventId -> settings
    this.eventsList = new Map(); // eventId -> event data
    
    // Configuration from config.js
    this.config = window.PHOTOSHARE_CONFIG || {};
    
    console.log('⚙️ AutoUploadSettings initialized');
  }

  /**
   * Initialize auto-upload settings system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🚀 Initializing AutoUploadSettings...');
      
      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;
      
      if (!this.supabaseClient || !this.currentUser) {
        console.log('⚠️ Using mock mode - no Supabase client or user');
        await this.initializeMockMode();
      } else {
        // Load real user settings
        await this.loadUserSettings();
      }
      
      this.isInitialized = true;
      console.log('✅ AutoUploadSettings initialized successfully');
      
      return true;
      
    } catch (error) {
      console.error('❌ Error initializing AutoUploadSettings:', error);
      
      // Fallback to mock mode
      await this.initializeMockMode();
      this.isInitialized = true;
      
      return true;
    }
  }

  /**
   * Initialize with mock data for testing
   */
  async initializeMockMode() {
    console.log('🧪 Initializing mock auto-upload settings...');
    
    // Mock events
    const mockEvents = [
      {
        id: 'event_001',
        name: 'Family Reunion 2024',
        isLive: true,
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        organizerName: 'Sarah Johnson',
        participantCount: 12,
        description: 'Annual family gathering at the lake house'
      },
      {
        id: 'event_002', 
        name: 'Birthday Party',
        isLive: false,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 30 * 60 * 60 * 1000), // Tomorrow + 6 hours
        organizerName: 'Mike Chen',
        participantCount: 8,
        description: 'Celebrating Emma\'s 25th birthday'
      },
      {
        id: 'event_003',
        name: 'Wedding Reception',
        isLive: true,
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        organizerName: 'David & Jennifer',
        participantCount: 45,
        description: 'Reception celebration at Riverside Gardens'
      }
    ];
    
    // Store mock events
    mockEvents.forEach(event => {
      this.eventsList.set(event.id, event);
      
      // Mock user settings for each event
      this.userSettings.set(event.id, {
        eventId: event.id,
        autoUploadEnabled: event.id === 'event_001' || event.id === 'event_003', // Some enabled by default
        uploadStartTime: event.startTime,
        uploadEndTime: event.endTime,
        notificationsEnabled: true,
        uploadQuality: 'high', // high, medium, low
        wifiOnly: false,
        lastModified: new Date()
      });
    });
    
    console.log(`✅ Mock mode initialized with ${mockEvents.length} events`);
  }

  /**
   * Load user's auto-upload settings from database
   */
  async loadUserSettings() {
    try {
      console.log('📊 Loading user auto-upload settings...');
      
      // Query user's event participations with auto-upload settings
      const { data: eventParticipants, error } = await this.supabaseClient
        .from('event_participants')
        .select(`
          event_id,
          auto_upload_enabled,
          auto_upload_start_time,
          auto_upload_end_time,
          events!inner (
            id,
            name,
            is_live,
            start_time,
            end_time,
            description,
            created_by,
            profiles!events_created_by_fkey (
              display_name
            )
          )
        `)
        .eq('user_id', this.currentUser.id);

      if (error) {
        throw error;
      }

      // Clear existing data
      this.userSettings.clear();
      this.eventsList.clear();

      if (eventParticipants && eventParticipants.length > 0) {
        eventParticipants.forEach(participant => {
          const event = participant.events;
          
          // Store event data
          this.eventsList.set(event.id, {
            id: event.id,
            name: event.name,
            isLive: event.is_live,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            description: event.description,
            organizerName: event.profiles?.display_name || 'Unknown',
            participantCount: 0 // Would need separate query to get this
          });
          
          // Store user settings for this event
          this.userSettings.set(event.id, {
            eventId: event.id,
            autoUploadEnabled: participant.auto_upload_enabled || false,
            uploadStartTime: participant.auto_upload_start_time ? new Date(participant.auto_upload_start_time) : new Date(event.start_time),
            uploadEndTime: participant.auto_upload_end_time ? new Date(participant.auto_upload_end_time) : new Date(event.end_time),
            notificationsEnabled: true, // Default
            uploadQuality: 'high', // Default
            wifiOnly: false, // Default
            lastModified: new Date()
          });
        });
      }
      
      console.log(`✅ Loaded settings for ${this.eventsList.size} events`);
      
    } catch (error) {
      console.error('Error loading user settings:', error);
      throw error;
    }
  }

  /**
   * Get all events user is participating in
   */
  getUserEvents() {
    return Array.from(this.eventsList.values()).map(event => {
      const settings = this.userSettings.get(event.id) || {};
      
      return {
        ...event,
        autoUploadEnabled: settings.autoUploadEnabled || false,
        uploadWindow: {
          start: settings.uploadStartTime || event.startTime,
          end: settings.uploadEndTime || event.endTime
        },
        uploadSettings: {
          quality: settings.uploadQuality || 'high',
          wifiOnly: settings.wifiOnly || false,
          notificationsEnabled: settings.notificationsEnabled !== false
        }
      };
    });
  }

  /**
   * Get settings for specific event
   */
  getEventSettings(eventId) {
    const event = this.eventsList.get(eventId);
    const settings = this.userSettings.get(eventId);
    
    if (!event) {
      return null;
    }
    
    return {
      eventId: eventId,
      eventName: event.name,
      isLive: event.isLive,
      autoUploadEnabled: settings?.autoUploadEnabled || false,
      uploadWindow: {
        start: settings?.uploadStartTime || event.startTime,
        end: settings?.uploadEndTime || event.endTime
      },
      uploadSettings: {
        quality: settings?.uploadQuality || 'high',
        wifiOnly: settings?.wifiOnly || false,
        notificationsEnabled: settings?.notificationsEnabled !== false
      },
      lastModified: settings?.lastModified
    };
  }

  /**
   * Enable auto-upload for an event
   */
  async enableAutoUpload(eventId, options = {}) {
    try {
      console.log(`✅ Enabling auto-upload for event: ${eventId}`);
      
      const event = this.eventsList.get(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Update local settings
      const currentSettings = this.userSettings.get(eventId) || {};
      const newSettings = {
        ...currentSettings,
        eventId: eventId,
        autoUploadEnabled: true,
        uploadStartTime: options.startTime || event.startTime,
        uploadEndTime: options.endTime || event.endTime,
        uploadQuality: options.quality || currentSettings.uploadQuality || 'high',
        wifiOnly: options.wifiOnly !== undefined ? options.wifiOnly : (currentSettings.wifiOnly || false),
        notificationsEnabled: options.notifications !== undefined ? options.notifications : (currentSettings.notificationsEnabled !== false),
        lastModified: new Date()
      };
      
      this.userSettings.set(eventId, newSettings);

      // Update database if we have a real connection
      if (this.supabaseClient && this.currentUser) {
        await this.updateDatabaseSettings(eventId, newSettings);
      }
      
      console.log(`✅ Auto-upload enabled for event: ${event.name}`);
      
      // Trigger callback if auto-upload integration is available
      if (window.autoUploadIntegration?.isInitialized) {
        window.autoUploadIntegration.onSettingsChanged?.(eventId, newSettings);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error enabling auto-upload:', error);
      throw error;
    }
  }

  /**
   * Disable auto-upload for an event
   */
  async disableAutoUpload(eventId) {
    try {
      console.log(`❌ Disabling auto-upload for event: ${eventId}`);
      
      const event = this.eventsList.get(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      // Update local settings
      const currentSettings = this.userSettings.get(eventId) || {};
      const newSettings = {
        ...currentSettings,
        autoUploadEnabled: false,
        lastModified: new Date()
      };
      
      this.userSettings.set(eventId, newSettings);

      // Update database if we have a real connection
      if (this.supabaseClient && this.currentUser) {
        await this.updateDatabaseSettings(eventId, newSettings);
      }
      
      console.log(`✅ Auto-upload disabled for event: ${event.name}`);
      
      // Trigger callback if auto-upload integration is available
      if (window.autoUploadIntegration?.isInitialized) {
        window.autoUploadIntegration.onSettingsChanged?.(eventId, newSettings);
      }
      
      return true;
      
    } catch (error) {
      console.error('Error disabling auto-upload:', error);
      throw error;
    }
  }

  /**
   * Update upload window for an event
   */
  async updateUploadWindow(eventId, startTime, endTime) {
    try {
      console.log(`⏰ Updating upload window for event: ${eventId}`);
      
      const currentSettings = this.userSettings.get(eventId) || {};
      const newSettings = {
        ...currentSettings,
        uploadStartTime: new Date(startTime),
        uploadEndTime: new Date(endTime),
        lastModified: new Date()
      };
      
      this.userSettings.set(eventId, newSettings);

      // Update database if we have a real connection
      if (this.supabaseClient && this.currentUser) {
        await this.updateDatabaseSettings(eventId, newSettings);
      }
      
      console.log('✅ Upload window updated successfully');
      return true;
      
    } catch (error) {
      console.error('Error updating upload window:', error);
      throw error;
    }
  }

  /**
   * Update upload quality setting
   */
  async updateUploadQuality(eventId, quality) {
    try {
      console.log(`📊 Updating upload quality for event ${eventId}: ${quality}`);
      
      const validQualities = ['high', 'medium', 'low'];
      if (!validQualities.includes(quality)) {
        throw new Error('Invalid quality setting');
      }
      
      const currentSettings = this.userSettings.get(eventId) || {};
      const newSettings = {
        ...currentSettings,
        uploadQuality: quality,
        lastModified: new Date()
      };
      
      this.userSettings.set(eventId, newSettings);

      // Update database if we have a real connection
      if (this.supabaseClient && this.currentUser) {
        await this.updateDatabaseSettings(eventId, newSettings);
      }
      
      console.log('✅ Upload quality updated successfully');
      return true;
      
    } catch (error) {
      console.error('Error updating upload quality:', error);
      throw error;
    }
  }

  /**
   * Update database with new settings
   */
  async updateDatabaseSettings(eventId, settings) {
    try {
      const { error } = await this.supabaseClient
        .from('event_participants')
        .update({
          auto_upload_enabled: settings.autoUploadEnabled,
          auto_upload_start_time: settings.uploadStartTime?.toISOString(),
          auto_upload_end_time: settings.uploadEndTime?.toISOString()
        })
        .eq('user_id', this.currentUser.id)
        .eq('event_id', eventId);

      if (error) {
        throw error;
      }
      
      console.log('✅ Database settings updated successfully');
      
    } catch (error) {
      console.error('Error updating database settings:', error);
      throw error;
    }
  }

  /**
   * Get auto-upload statistics
   */
  getAutoUploadStats() {
    const events = Array.from(this.eventsList.values());
    const enabledEvents = events.filter(event => {
      const settings = this.userSettings.get(event.id);
      return settings?.autoUploadEnabled === true;
    });
    
    const liveEnabledEvents = enabledEvents.filter(event => event.isLive);
    
    return {
      totalEvents: events.length,
      enabledEvents: enabledEvents.length,
      liveEnabledEvents: liveEnabledEvents.length,
      disabledEvents: events.length - enabledEvents.length,
      upcomingEvents: events.filter(event => event.startTime > new Date()).length
    };
  }

  /**
   * Export settings for debugging
   */
  exportSettings() {
    const settings = {};
    
    for (const [eventId, eventSettings] of this.userSettings) {
      const event = this.eventsList.get(eventId);
      settings[eventId] = {
        eventName: event?.name,
        ...eventSettings
      };
    }
    
    return {
      userId: this.currentUser?.id,
      exportedAt: new Date(),
      settings: settings,
      stats: this.getAutoUploadStats()
    };
  }

  /**
   * Get status for debugging
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasSupabaseClient: !!this.supabaseClient,
      currentUser: this.currentUser ? {
        id: this.currentUser.id,
        email: this.currentUser.email
      } : null,
      eventsCount: this.eventsList.size,
      settingsCount: this.userSettings.size,
      stats: this.getAutoUploadStats()
    };
  }
}

// Export to global window
console.log('Creating AutoUploadSettings service...');
window.autoUploadSettings = new AutoUploadSettings();

// Export convenience functions
window.initializeAutoUploadSettings = async function(supabaseClient, currentUser) {
  return await window.autoUploadSettings.initialize(supabaseClient, currentUser);
};

window.getUserEvents = function() {
  return window.autoUploadSettings.getUserEvents();
};

window.enableAutoUploadForEvent = async function(eventId, options) {
  return await window.autoUploadSettings.enableAutoUpload(eventId, options);
};

window.disableAutoUploadForEvent = async function(eventId) {
  return await window.autoUploadSettings.disableAutoUpload(eventId);
};

window.getAutoUploadStats = function() {
  return window.autoUploadSettings.getAutoUploadStats();
};

window.getAutoUploadSettingsStatus = function() {
  return window.autoUploadSettings.getStatus();
};

console.log('✅ AutoUploadSettings service created');