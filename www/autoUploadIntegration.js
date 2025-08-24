/**
 * AutoUploadIntegration - Connects existing auto-upload system with reliable upload service
 * Bridges AutoUploadManager/MediaMonitor with ReliableUploadService for robust photo uploads
 */

console.log('🔄 Loading autoUploadIntegration.js...');

class AutoUploadIntegration {
  constructor() {
    this.isInitialized = false;
    this.autoUploadManager = null;
    this.mediaMonitor = null;
    this.reliableUploadService = null;
    this.uploadStatusSharing = null;
    this.supabaseClient = null;
    this.currentUser = null;
    this.activeUploads = new Map(); // uploadId -> metadata
    
    // Configuration
    this.config = {
      // Retry and reliability settings
      maxRetryAttempts: 3,
      retryDelayMs: 5000,
      uploadTimeoutMs: 60000,
      
      // Batch processing
      maxConcurrentUploads: 3,
      batchSize: 5,
      
      // Network awareness
      wifiOnly: false, // Allow cellular uploads
      adaptiveQuality: true,
      
      // Status sharing
      enableStatusSharing: true,
      shareWithOrganizers: true
    };
    
    console.log('🔗 AutoUploadIntegration initialized');
  }

  /**
   * Initialize the integrated auto-upload system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🚀 Initializing AutoUploadIntegration...');
      
      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;

      // Initialize reliable upload services (using our minimal test services)
      if (!window.reliableUploadService) {
        console.log('❌ ReliableUploadService not available');
        return false;
      }

      this.reliableUploadService = window.reliableUploadService;
      this.uploadStatusSharing = window.uploadStatusSharingService;

      // Initialize reliable upload service
      await window.initializeReliableUpload();
      
      if (this.config.enableStatusSharing) {
        await window.initializeUploadStatusSharing();
      }

      // Initialize existing auto-upload components
      if (typeof window.AutoUploadManager !== 'undefined') {
        this.autoUploadManager = new window.AutoUploadManager();
        await this.autoUploadManager.initialize(supabaseClient, currentUser);
      } else {
        console.log('⚠️ AutoUploadManager not available - creating minimal version');
        await this.createMinimalAutoUploadManager();
      }

      if (typeof window.MediaMonitor !== 'undefined') {
        this.mediaMonitor = new window.MediaMonitor();
      } else {
        console.log('⚠️ MediaMonitor not available - creating minimal version');
        this.createMinimalMediaMonitor();
      }

      // Set up photo detection callback
      this.setupPhotoDetectionCallback();

      this.isInitialized = true;
      console.log('✅ AutoUploadIntegration initialized successfully');
      
      return true;
      
    } catch (error) {
      console.error('Error initializing AutoUploadIntegration:', error);
      return false;
    }
  }

  /**
   * Create minimal auto-upload manager for testing
   */
  async createMinimalAutoUploadManager() {
    this.autoUploadManager = {
      isInitialized: true,
      activeEvents: new Map(),
      uploadEnabled: true,
      
      initialize: async (supabaseClient, currentUser) => {
        // Simulate having an active event with auto-upload enabled
        this.autoUploadManager.activeEvents.set('test_event_123', {
          eventId: 'test_event_123',
          name: 'Test Auto-Upload Event',
          autoUploadEnabled: true,
          startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          uploadWindow: {
            start: new Date(Date.now() - 60 * 60 * 1000),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000)
          }
        });
        return true;
      },
      
      isAutoUploadActive: () => {
        return this.autoUploadManager.uploadEnabled && this.autoUploadManager.activeEvents.size > 0;
      },
      
      getActiveEvents: () => {
        return Array.from(this.autoUploadManager.activeEvents.values());
      }
    };
    
    await this.autoUploadManager.initialize(this.supabaseClient, this.currentUser);
  }

  /**
   * Create minimal media monitor for testing
   */
  createMinimalMediaMonitor() {
    this.mediaMonitor = {
      isMonitoring: false,
      startMonitoring: (eventTimeframes, callback) => {
        this.mediaMonitor.isMonitoring = true;
        this.mediaMonitor.onNewPhotoCallback = callback;
        console.log('📸 Minimal media monitoring started');
        return true;
      },
      stopMonitoring: () => {
        this.mediaMonitor.isMonitoring = false;
        console.log('📸 Media monitoring stopped');
      }
    };
  }

  /**
   * Set up callback for when new photos are detected
   */
  setupPhotoDetectionCallback() {
    const onNewPhotoDetected = async (photoData, eventId) => {
      try {
        console.log(`📸 New photo detected: ${photoData.filename} for event ${eventId}`);
        
        // Check if auto-upload is still active
        if (!this.autoUploadManager.isAutoUploadActive()) {
          console.log('❌ Auto-upload no longer active, skipping photo');
          return;
        }

        // Queue photo for reliable upload
        await this.queuePhotoForReliableUpload(photoData, eventId);
        
      } catch (error) {
        console.error('Error handling new photo:', error);
      }
    };

    // Start monitoring if we have active events
    if (this.autoUploadManager.isAutoUploadActive()) {
      this.startPhotoMonitoring();
    }
  }

  /**
   * Start photo monitoring for active events
   */
  async startPhotoMonitoring() {
    try {
      const activeEvents = this.autoUploadManager.getActiveEvents();
      
      if (activeEvents.length === 0) {
        console.log('📴 No active events for photo monitoring');
        return false;
      }

      // Create event timeframes for monitoring
      const eventTimeframes = activeEvents.map(event => [
        event.eventId, 
        {
          start: event.uploadWindow.start,
          end: event.uploadWindow.end
        }
      ]);

      // Start monitoring
      const started = await this.mediaMonitor.startMonitoring(
        eventTimeframes, 
        this.handleNewPhotoDetected.bind(this)
      );

      if (started) {
        console.log(`✅ Photo monitoring started for ${activeEvents.length} events`);
      } else {
        console.log('❌ Failed to start photo monitoring');
      }

      return started;
      
    } catch (error) {
      console.error('Error starting photo monitoring:', error);
      return false;
    }
  }

  /**
   * Handle new photo detected by MediaMonitor
   */
  async handleNewPhotoDetected(photoData, eventId) {
    try {
      console.log(`📸 Processing detected photo: ${photoData.filename}`);
      
      // Validate photo data
      if (!this.validatePhotoForUpload(photoData)) {
        console.log('❌ Photo validation failed');
        return;
      }

      // Queue for reliable upload
      await this.queuePhotoForReliableUpload(photoData, eventId);
      
    } catch (error) {
      console.error('Error processing detected photo:', error);
    }
  }

  /**
   * Queue photo for reliable upload
   */
  async queuePhotoForReliableUpload(photoData, eventId) {
    try {
      console.log(`📤 Queuing photo for reliable upload: ${photoData.filename}`);
      
      // Enhance photo data with upload metadata
      const enhancedPhotoData = {
        ...photoData,
        eventId: eventId,
        userId: this.currentUser?.id,
        uploadMethod: 'auto-upload',
        queuedAt: new Date(),
        source: 'ios-photos-monitor'
      };

      // Use our reliable upload service
      const uploadId = await window.queueReliablePhotoUpload(enhancedPhotoData, eventId, {
        priority: 'auto-upload',
        enableRetry: true,
        maxRetries: this.config.maxRetryAttempts
      });

      // Track the upload
      this.activeUploads.set(uploadId, {
        uploadId: uploadId,
        photoData: enhancedPhotoData,
        eventId: eventId,
        status: 'queued',
        queuedAt: new Date()
      });

      // Register with status sharing if enabled
      if (this.config.enableStatusSharing && this.uploadStatusSharing) {
        window.registerUploadForStatusSharing(uploadId, enhancedPhotoData, eventId, 'queued');
      }

      console.log(`✅ Photo queued for reliable upload: ${uploadId}`);
      
      return uploadId;
      
    } catch (error) {
      console.error('Error queuing photo for upload:', error);
      throw error;
    }
  }

  /**
   * Validate photo for upload
   */
  validatePhotoForUpload(photoData) {
    try {
      // Check required fields
      if (!photoData.filename || !photoData.fileSize) {
        console.log('❌ Missing required photo data fields');
        return false;
      }

      // Check file size (50MB limit from auto-upload.md)
      if (photoData.fileSize > 50 * 1024 * 1024) {
        console.log(`❌ Photo too large: ${photoData.fileSize} bytes`);
        return false;
      }

      // Check MIME type
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (photoData.mimeType && !supportedTypes.includes(photoData.mimeType)) {
        console.log(`❌ Unsupported photo type: ${photoData.mimeType}`);
        return false;
      }

      return true;
      
    } catch (error) {
      console.error('Error validating photo:', error);
      return false;
    }
  }

  /**
   * Start auto-upload system
   */
  async startAutoUpload() {
    try {
      if (!this.isInitialized) {
        console.log('❌ AutoUploadIntegration not initialized');
        return false;
      }

      console.log('🚀 Starting integrated auto-upload system...');

      // Start photo monitoring
      const monitoringStarted = await this.startPhotoMonitoring();
      
      if (monitoringStarted) {
        console.log('✅ Integrated auto-upload system started');
        window.showToast('Auto-upload monitoring started', 'success');
        return true;
      } else {
        console.log('❌ Failed to start auto-upload monitoring');
        window.showToast('Failed to start auto-upload monitoring', 'error');
        return false;
      }
      
    } catch (error) {
      console.error('Error starting auto-upload:', error);
      window.showToast('Error starting auto-upload: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Stop auto-upload system
   */
  stopAutoUpload() {
    try {
      console.log('🛑 Stopping integrated auto-upload system...');

      if (this.mediaMonitor && this.mediaMonitor.stopMonitoring) {
        this.mediaMonitor.stopMonitoring();
      }

      console.log('✅ Integrated auto-upload system stopped');
      window.showToast('Auto-upload monitoring stopped', 'info');
      
    } catch (error) {
      console.error('Error stopping auto-upload:', error);
    }
  }

  /**
   * Get auto-upload status
   */
  getAutoUploadStatus() {
    return {
      isInitialized: this.isInitialized,
      isActive: this.autoUploadManager?.isAutoUploadActive() || false,
      isMonitoring: this.mediaMonitor?.isMonitoring || false,
      activeEvents: this.autoUploadManager?.getActiveEvents() || [],
      activeUploads: this.activeUploads.size,
      uploadService: {
        initialized: this.reliableUploadService?.isInitialized || false,
        status: window.reliableUploadService?.getUploadStatus() || null
      }
    };
  }

  /**
   * Simulate photo detection for testing
   */
  async simulatePhotoDetection(eventId = 'test_event_123') {
    try {
      console.log('🧪 Simulating photo detection...');
      
      const mockPhoto = {
        id: 'mock_photo_' + Date.now(),
        filename: `AUTO_${Date.now()}.jpg`,
        fileSize: Math.floor(Math.random() * 3000000 + 1000000), // 1-4MB
        mimeType: 'image/jpeg',
        dimensions: { width: 4032, height: 3024 },
        createdAt: new Date(),
        metadata: {
          camera: 'iPhone 15 Pro',
          location: { lat: 37.7749, lng: -122.4194 }
        }
      };

      await this.handleNewPhotoDetected(mockPhoto, eventId);
      
      console.log('✅ Photo detection simulation completed');
      return mockPhoto;
      
    } catch (error) {
      console.error('Error simulating photo detection:', error);
      throw error;
    }
  }
}

// Export to global window
console.log('Creating AutoUploadIntegration service...');
window.autoUploadIntegration = new AutoUploadIntegration();

// Export convenience functions
window.initializeAutoUploadIntegration = async function(supabaseClient, currentUser) {
  return await window.autoUploadIntegration.initialize(supabaseClient, currentUser);
};

window.startAutoUpload = async function() {
  return await window.autoUploadIntegration.startAutoUpload();
};

window.stopAutoUpload = function() {
  return window.autoUploadIntegration.stopAutoUpload();
};

window.getAutoUploadStatus = function() {
  return window.autoUploadIntegration.getAutoUploadStatus();
};

window.simulatePhotoDetection = async function(eventId) {
  return await window.autoUploadIntegration.simulatePhotoDetection(eventId);
};

console.log('✅ AutoUploadIntegration service created');