console.log('🔄 Loading uploadStatusSharingService.js...');

// For browser testing, we'll simulate these imports
const Device = window.Capacitor?.Plugins?.Device || {
  getInfo: async () => ({ platform: 'web', model: 'Browser' })
};

const Capacitor = window.Capacitor || {
  isNativePlatform: () => false
};

const showToast = window.showToast || function(message, type) {
  console.log(`${type.toUpperCase()}: ${message}`);
};

/**
 * UploadStatusSharingService - Simple upload status sharing for event organizers
 * Provides event organizers with real-time visibility into photo upload progress
 */
class UploadStatusSharingService {
  constructor() {
    this.isInitialized = false;
    this.eventUploads = new Map(); // eventId -> upload summary
    this.statusSubscribers = new Set();
    this.updateInterval = null;
    this.lastStatusUpdate = null;
    
    // Configuration
    this.config = {
      // Update settings
      statusUpdateInterval: 10000, // Update every 10 seconds
      batchStatusUpdates: true, // Batch multiple updates together
      includeDetailedStats: true,
      
      // Status sharing
      shareViaWebInterface: true, // Simple web interface for organizers
      statusCacheTime: 60000, // Cache status for 1 minute
      
      // Privacy settings
      includePhotoThumbnails: false, // Don't share actual photos
      shareOnlyAggregateStats: true, // Only totals, not individual uploads
      anonymizeUploadSources: true // Don't identify specific devices/users
    };
    
    console.log('📊 UploadStatusSharingService initialized for event organizers');
  }

  /**
   * Initialize upload status sharing service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing UploadStatusSharingService...');
      
      // Get device info for status context
      const deviceInfo = await Device.getInfo();
      console.log(`📱 Device: ${deviceInfo.model} (${deviceInfo.platform})`);
      
      // Start periodic status updates
      this.startStatusUpdates();
      
      this.isInitialized = true;
      console.log('✅ UploadStatusSharingService initialized');
      
      return true;
      
    } catch (error) {
      console.error('Error initializing UploadStatusSharingService:', error);
      return false;
    }
  }

  /**
   * Start periodic status updates
   */
  startStatusUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.updateEventUploadStatus();
      this.notifyStatusSubscribers();
    }, this.config.statusUpdateInterval);
    
    console.log(`📊 Status updates started (every ${this.config.statusUpdateInterval / 1000}s)`);
  }

  /**
   * Register an upload for status tracking
   */
  registerUpload(uploadId, photoData, eventId, status = 'queued') {
    if (!this.isInitialized) return;

    try {
      // Get or create event upload summary
      if (!this.eventUploads.has(eventId)) {
        this.eventUploads.set(eventId, {
          eventId: eventId,
          totalUploads: 0,
          queuedUploads: 0,
          uploadingUploads: 0,
          completedUploads: 0,
          failedUploads: 0,
          totalBytes: 0,
          uploadedBytes: 0,
          uploads: new Map(), // uploadId -> upload info
          lastUpdate: new Date(),
          firstUploadAt: null,
          averageUploadTime: 0,
          estimatedTimeRemaining: 0
        });
      }

      const eventStatus = this.eventUploads.get(eventId);
      
      // Add upload to tracking
      const uploadInfo = {
        uploadId: uploadId,
        filename: this.config.anonymizeUploadSources ? `Photo_${eventStatus.totalUploads + 1}` : photoData.filename,
        fileSize: photoData.fileSize || 0,
        status: status,
        progress: 0,
        startedAt: new Date(),
        completedAt: null,
        attempts: 0,
        lastError: null,
        deviceType: this.getAnonymizedDeviceType()
      };

      eventStatus.uploads.set(uploadId, uploadInfo);
      eventStatus.totalUploads++;
      eventStatus.totalBytes += uploadInfo.fileSize;
      
      if (!eventStatus.firstUploadAt) {
        eventStatus.firstUploadAt = new Date();
      }
      
      this.updateStatusCounters(eventStatus);
      
      console.log(`📊 Registered upload for event ${eventId}: ${uploadId}`);
      console.log(`   📁 Total uploads for event: ${eventStatus.totalUploads}`);
      
    } catch (error) {
      console.error('Error registering upload:', error);
    }
  }

  /**
   * Update upload status
   */
  updateUploadStatus(uploadId, eventId, status, progress = null, error = null) {
    if (!this.eventUploads.has(eventId)) return;

    try {
      const eventStatus = this.eventUploads.get(eventId);
      const uploadInfo = eventStatus.uploads.get(uploadId);
      
      if (!uploadInfo) return;

      const oldStatus = uploadInfo.status;
      uploadInfo.status = status;
      uploadInfo.lastUpdate = new Date();
      
      if (progress !== null) {
        uploadInfo.progress = progress;
        
        // Calculate uploaded bytes based on progress
        const uploadedBytes = Math.round((uploadInfo.fileSize * progress) / 100);
        uploadInfo.uploadedBytes = uploadedBytes;
      }
      
      if (error) {
        uploadInfo.lastError = error;
        uploadInfo.attempts++;
      }
      
      if (status === 'completed' && oldStatus !== 'completed') {
        uploadInfo.completedAt = new Date();
        uploadInfo.progress = 100;
        uploadInfo.uploadedBytes = uploadInfo.fileSize;
        
        // Update average upload time
        const uploadTime = uploadInfo.completedAt.getTime() - uploadInfo.startedAt.getTime();
        this.updateAverageUploadTime(eventStatus, uploadTime);
      }
      
      this.updateStatusCounters(eventStatus);
      this.calculateEstimatedTimeRemaining(eventStatus);
      
      // Immediate update for important status changes
      if (status === 'completed' || status === 'failed') {
        this.notifyStatusSubscribers();
      }
      
    } catch (error) {
      console.error('Error updating upload status:', error);
    }
  }

  /**
   * Update status counters for an event
   */
  updateStatusCounters(eventStatus) {
    let queued = 0, uploading = 0, completed = 0, failed = 0, uploadedBytes = 0;
    
    for (const upload of eventStatus.uploads.values()) {
      switch (upload.status) {
        case 'queued': queued++; break;
        case 'uploading': uploading++; break;
        case 'completed': completed++; break;
        case 'failed': 
        case 'permanently_failed': 
          failed++; break;
      }
      
      uploadedBytes += upload.uploadedBytes || 0;
    }
    
    eventStatus.queuedUploads = queued;
    eventStatus.uploadingUploads = uploading;
    eventStatus.completedUploads = completed;
    eventStatus.failedUploads = failed;
    eventStatus.uploadedBytes = uploadedBytes;
    eventStatus.lastUpdate = new Date();
  }

  /**
   * Calculate estimated time remaining for uploads
   */
  calculateEstimatedTimeRemaining(eventStatus) {
    try {
      const remainingUploads = eventStatus.queuedUploads + eventStatus.uploadingUploads;
      
      if (remainingUploads === 0 || eventStatus.averageUploadTime === 0) {
        eventStatus.estimatedTimeRemaining = 0;
        return;
      }
      
      // Simple estimation based on average upload time
      eventStatus.estimatedTimeRemaining = remainingUploads * eventStatus.averageUploadTime;
      
    } catch (error) {
      console.error('Error calculating estimated time:', error);
    }
  }

  /**
   * Update average upload time for an event
   */
  updateAverageUploadTime(eventStatus, newUploadTime) {
    if (eventStatus.completedUploads === 1) {
      eventStatus.averageUploadTime = newUploadTime;
    } else {
      const totalTime = eventStatus.averageUploadTime * (eventStatus.completedUploads - 1) + newUploadTime;
      eventStatus.averageUploadTime = totalTime / eventStatus.completedUploads;
    }
  }

  /**
   * Get anonymized device type
   */
  getAnonymizedDeviceType() {
    if (!this.config.anonymizeUploadSources) {
      return 'Unknown';
    }
    
    // Simple device categorization without revealing specific info
    const deviceTypes = ['Mobile Device A', 'Mobile Device B', 'Mobile Device C'];
    return deviceTypes[Math.floor(Math.random() * deviceTypes.length)];
  }

  /**
   * Update event upload status (called periodically)
   */
  updateEventUploadStatus() {
    try {
      for (const [eventId, eventStatus] of this.eventUploads) {
        // Calculate real-time statistics
        const totalBytes = eventStatus.totalBytes;
        const uploadedBytes = eventStatus.uploadedBytes;
        const progressPercent = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
        
        eventStatus.overallProgress = progressPercent;
        eventStatus.uploadRate = this.calculateUploadRate(eventStatus);
        
        // Clean up old completed uploads to prevent memory issues
        this.cleanupOldUploads(eventStatus);
      }
      
      this.lastStatusUpdate = new Date();
      
    } catch (error) {
      console.error('Error updating event upload status:', error);
    }
  }

  /**
   * Calculate current upload rate
   */
  calculateUploadRate(eventStatus) {
    try {
      if (!eventStatus.firstUploadAt || eventStatus.completedUploads === 0) {
        return 0;
      }
      
      const elapsedMinutes = (Date.now() - eventStatus.firstUploadAt.getTime()) / (1000 * 60);
      return elapsedMinutes > 0 ? eventStatus.completedUploads / elapsedMinutes : 0;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clean up old completed uploads to prevent memory bloat
   */
  cleanupOldUploads(eventStatus) {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [uploadId, upload] of eventStatus.uploads) {
      if (upload.status === 'completed' && 
          upload.completedAt && 
          upload.completedAt.getTime() < cutoffTime) {
        eventStatus.uploads.delete(uploadId);
      }
    }
  }

  /**
   * Get status summary for a specific event
   */
  getEventStatusSummary(eventId) {
    const eventStatus = this.eventUploads.get(eventId);
    if (!eventStatus) {
      return {
        eventId: eventId,
        totalUploads: 0,
        completedUploads: 0,
        failedUploads: 0,
        overallProgress: 0,
        status: 'No uploads yet'
      };
    }

    const summary = {
      eventId: eventId,
      totalUploads: eventStatus.totalUploads,
      queuedUploads: eventStatus.queuedUploads,
      uploadingUploads: eventStatus.uploadingUploads,
      completedUploads: eventStatus.completedUploads,
      failedUploads: eventStatus.failedUploads,
      
      // Progress metrics
      overallProgress: eventStatus.overallProgress || 0,
      totalSizeMB: (eventStatus.totalBytes / 1024 / 1024).toFixed(1),
      uploadedSizeMB: (eventStatus.uploadedBytes / 1024 / 1024).toFixed(1),
      
      // Time metrics
      averageUploadTimeSeconds: Math.round((eventStatus.averageUploadTime || 0) / 1000),
      estimatedTimeRemainingMinutes: Math.round((eventStatus.estimatedTimeRemaining || 0) / 1000 / 60),
      uploadRatePerMinute: eventStatus.uploadRate?.toFixed(1) || '0.0',
      
      // Status
      isActive: eventStatus.queuedUploads > 0 || eventStatus.uploadingUploads > 0,
      lastUpdate: eventStatus.lastUpdate,
      
      // Simple status text
      status: this.getSimpleStatusText(eventStatus)
    };

    return summary;
  }

  /**
   * Get simple status text for organizers
   */
  getSimpleStatusText(eventStatus) {
    const { queuedUploads, uploadingUploads, completedUploads, failedUploads, totalUploads } = eventStatus;
    
    if (totalUploads === 0) {
      return 'No uploads yet';
    }
    
    if (uploadingUploads > 0) {
      return `Uploading ${uploadingUploads} photos...`;
    }
    
    if (queuedUploads > 0) {
      return `${queuedUploads} photos waiting to upload`;
    }
    
    if (failedUploads > 0 && completedUploads === 0) {
      return `${failedUploads} uploads failed`;
    }
    
    if (completedUploads === totalUploads) {
      return 'All uploads complete!';
    }
    
    return `${completedUploads}/${totalUploads} photos uploaded`;
  }

  /**
   * Get status for all events
   */
  getAllEventsStatus() {
    const allEvents = [];
    
    for (const eventId of this.eventUploads.keys()) {
      allEvents.push(this.getEventStatusSummary(eventId));
    }
    
    return {
      events: allEvents,
      totalEvents: allEvents.length,
      activeEvents: allEvents.filter(e => e.isActive).length,
      lastUpdate: this.lastStatusUpdate || new Date()
    };
  }

  /**
   * Generate simple status report for sharing
   */
  generateStatusReport(eventId) {
    const summary = this.getEventStatusSummary(eventId);
    
    const report = {
      eventId: eventId,
      generatedAt: new Date(),
      summary: summary,
      
      // Simple text summary for easy sharing
      textSummary: this.generateTextSummary(summary),
      
      // Organizer-friendly metrics
      organizerMetrics: {
        photosReadyForGuests: summary.completedUploads,
        photosStillUploading: summary.queuedUploads + summary.uploadingUploads,
        uploadIssues: summary.failedUploads,
        estimatedCompletion: summary.estimatedTimeRemainingMinutes > 0 ? 
          `${summary.estimatedTimeRemainingMinutes} minutes` : 'Complete'
      }
    };

    return report;
  }

  /**
   * Generate text summary for easy sharing
   */
  generateTextSummary(summary) {
    const lines = [];
    
    lines.push(`📊 Event Upload Status`);
    lines.push(`📸 Photos: ${summary.completedUploads}/${summary.totalUploads} uploaded`);
    
    if (summary.uploadingUploads > 0) {
      lines.push(`🔄 Currently uploading: ${summary.uploadingUploads} photos`);
    }
    
    if (summary.queuedUploads > 0) {
      lines.push(`⏳ Waiting to upload: ${summary.queuedUploads} photos`);
    }
    
    if (summary.failedUploads > 0) {
      lines.push(`❌ Failed uploads: ${summary.failedUploads} photos`);
    }
    
    lines.push(`📊 Progress: ${summary.overallProgress.toFixed(1)}%`);
    lines.push(`📦 Data: ${summary.uploadedSizeMB}/${summary.totalSizeMB} MB`);
    
    if (summary.estimatedTimeRemainingMinutes > 0) {
      lines.push(`⏱️ Estimated completion: ${summary.estimatedTimeRemainingMinutes} minutes`);
    }
    
    lines.push(`🕒 Last updated: ${summary.lastUpdate.toLocaleTimeString()}`);
    
    return lines.join('\n');
  }

  /**
   * Subscribe to status updates
   */
  subscribeToStatusUpdates(callback) {
    this.statusSubscribers.add(callback);
    
    // Send current status immediately
    callback('initial_status', this.getAllEventsStatus());
    
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of status update
   */
  notifyStatusSubscribers() {
    const status = this.getAllEventsStatus();
    
    for (const callback of this.statusSubscribers) {
      try {
        callback('status_update', status);
      } catch (error) {
        console.error('Error notifying status subscriber:', error);
      }
    }
  }

  /**
   * Create simple web interface data
   */
  createWebInterfaceData(eventId) {
    const summary = this.getEventStatusSummary(eventId);
    
    return {
      eventId: eventId,
      title: `Upload Status - Event ${eventId}`,
      summary: summary,
      textReport: this.generateTextSummary(summary),
      
      // Simple dashboard data
      dashboard: {
        totalPhotos: summary.totalUploads,
        readyForGuests: summary.completedUploads,
        stillProcessing: summary.queuedUploads + summary.uploadingUploads,
        issues: summary.failedUploads,
        progressPercent: Math.round(summary.overallProgress),
        status: summary.status,
        lastUpdate: summary.lastUpdate.toLocaleString()
      },
      
      // Auto-refresh settings
      autoRefresh: {
        enabled: summary.isActive,
        intervalSeconds: this.config.statusUpdateInterval / 1000
      }
    };
  }

  /**
   * Test status sharing functionality
   */
  async testStatusSharing() {
    try {
      console.log('🧪 Testing upload status sharing...');
      
      if (!this.isInitialized) {
        throw new Error('UploadStatusSharingService not initialized');
      }

      const testEventId = 'test_event_status';
      
      // Simulate some uploads
      const testUploads = [
        { id: 'test1', filename: 'photo1.jpg', size: 2400000 },
        { id: 'test2', filename: 'photo2.jpg', size: 3100000 },
        { id: 'test3', filename: 'photo3.jpg', size: 1800000 }
      ];

      // Register test uploads
      for (const upload of testUploads) {
        this.registerUpload(upload.id, { filename: upload.filename, fileSize: upload.size }, testEventId);
      }

      // Simulate progress updates
      setTimeout(() => {
        this.updateUploadStatus('test1', testEventId, 'uploading', 50);
        this.updateUploadStatus('test2', testEventId, 'completed', 100);
      }, 1000);

      setTimeout(() => {
        this.updateUploadStatus('test1', testEventId, 'completed', 100);
        this.updateUploadStatus('test3', testEventId, 'uploading', 25);
      }, 2000);

      // Generate test report
      setTimeout(() => {
        const report = this.generateStatusReport(testEventId);
        console.log('📊 Test Status Report:');
        console.log(report.textSummary);
      }, 3000);

      console.log('✅ Upload status sharing test completed');
      showToast('Upload status sharing test completed', 'success');
      
      return testEventId;
      
    } catch (error) {
      console.error('Error testing status sharing:', error);
      showToast('Status sharing test failed: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      trackedEvents: this.eventUploads.size,
      statusSubscribers: this.statusSubscribers.size,
      lastStatusUpdate: this.lastStatusUpdate,
      config: this.config,
      
      // Summary of all events
      totalUploads: Array.from(this.eventUploads.values())
        .reduce((sum, event) => sum + event.totalUploads, 0),
      
      totalCompletedUploads: Array.from(this.eventUploads.values())
        .reduce((sum, event) => sum + event.completedUploads, 0)
    };
  }

  /**
   * Clean up service
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up UploadStatusSharingService...');
      
      // Stop status updates
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      // Clear all data
      this.eventUploads.clear();
      this.statusSubscribers.clear();
      
      this.isInitialized = false;
      
      console.log('✅ UploadStatusSharingService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up UploadStatusSharingService:', error);
    }
  }
}

// Export singleton instance to global window
console.log('Creating UploadStatusSharingService...');
try {
  window.uploadStatusSharingService = new UploadStatusSharingService();
  console.log('UploadStatusSharingService created successfully');
} catch (error) {
  console.error('Error creating UploadStatusSharingService:', error);
  window.uploadStatusSharingService = null;
}

// Export convenience functions to global window
window.initializeUploadStatusSharing = async function() {
  return await window.uploadStatusSharingService.initialize();
}

window.registerUploadForStatusSharing = function(uploadId, photoData, eventId, status = 'queued') {
  return window.uploadStatusSharingService.registerUpload(uploadId, photoData, eventId, status);
}

window.updateUploadStatusForSharing = function(uploadId, eventId, status, progress = null, error = null) {
  return window.uploadStatusSharingService.updateUploadStatus(uploadId, eventId, status, progress, error);
}

window.getEventUploadStatus = function(eventId) {
  return window.uploadStatusSharingService.getEventStatusSummary(eventId);
}

window.getAllEventsUploadStatus = function() {
  return window.uploadStatusSharingService.getAllEventsStatus();
}

window.generateUploadStatusReport = function(eventId) {
  return window.uploadStatusSharingService.generateStatusReport(eventId);
}

window.subscribeToUploadStatusUpdates = function(callback) {
  return window.uploadStatusSharingService.subscribeToStatusUpdates(callback);
}

window.testUploadStatusSharing = async function() {
  return await window.uploadStatusSharingService.testStatusSharing();
}