import { autoUploadManager, initializeAutoUpload } from './autoUploadManager.js';
import { realMediaMonitor, startRealPhotoMonitoring, stopRealPhotoMonitoring } from './realMediaMonitor.js';
import { uploadQueue, getUploadQueueStatus, getUploadQueueItems, retryFailedUploads } from './uploadQueue.js';
import { enhancedBackgroundService, initializeEnhancedBackgroundService } from './enhancedBackgroundService.js';
import { pushNotificationService, initializePushNotifications } from './pushNotificationService.js';
import { nativePhotoPickerService, initializeNativePhotoPicker } from './nativePhotoPickerService.js';
import { realTimeSyncStatusService, startRealTimeStatusMonitoring } from './realTimeSyncStatusService.js';
import { showToast } from './cameraPermissions.js';

/**
 * Auto-Upload System Phase 2+ - Enhanced Real iOS Integration
 * Complete system with native photo picker, real-time sync, and push notifications
 */
export class AutoUploadSystemPhase2 {
  constructor() {
    this.isActive = false;
    this.isMonitoring = false;
    this.isRealTimeStatusActive = false;
    this.supabaseClient = null;
    this.currentUser = null;
    this.phase = 2;
    
    // Enhanced Phase 2+ features status
    this.enhancedFeatures = {
      nativePhotoPicker: false,
      pushNotifications: false,
      realTimeStatus: false
    };
    
    console.log('🚀 AutoUploadSystemPhase2+ initialized - Enhanced Real iOS Integration');
  }

  /**
   * Initialize the complete Phase 2+ auto-upload system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🔄 Initializing Enhanced Auto-Upload System Phase 2+...');
      
      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;
      
      // Initialize the main auto-upload manager
      const managerInitialized = await initializeAutoUpload(supabaseClient, currentUser);
      if (!managerInitialized) {
        throw new Error('Failed to initialize AutoUploadManager');
      }
      
      // Initialize enhanced background upload service
      const backgroundInitialized = await initializeEnhancedBackgroundService();
      if (!backgroundInitialized) {
        console.log('⚠️ Background upload service initialization failed (continuing without background support)');
      } else {
        console.log('✅ Enhanced background upload service initialized');
      }
      
      // Initialize Push Notifications
      const pushInitialized = await initializePushNotifications();
      if (pushInitialized) {
        this.enhancedFeatures.pushNotifications = true;
        console.log('✅ Push notification service initialized');
      } else {
        console.log('⚠️ Push notification service initialization failed (continuing without notifications)');
      }
      
      // Initialize Native Photo Picker
      const pickerInitialized = await initializeNativePhotoPicker();
      if (pickerInitialized) {
        this.enhancedFeatures.nativePhotoPicker = true;
        console.log('✅ Native photo picker service initialized');
      } else {
        console.log('⚠️ Native photo picker initialization failed (continuing without picker)');
      }
      
      // Initialize Real-time Status Monitoring
      const statusInitialized = await startRealTimeStatusMonitoring();
      if (statusInitialized) {
        this.enhancedFeatures.realTimeStatus = true;
        this.isRealTimeStatusActive = true;
        console.log('✅ Real-time status monitoring initialized');
      } else {
        console.log('⚠️ Real-time status monitoring initialization failed (continuing without real-time status)');
      }
      
      this.isActive = true;
      
      console.log('✅ Enhanced Auto-Upload System Phase 2+ initialized successfully!');
      showToast('Auto-upload Phase 2 ready - Real iOS integration!', 'success');
      
      // Start monitoring if there are active events
      if (autoUploadManager.isAutoUploadActive()) {
        await this.startRealMonitoring();
      }
      
      return true;
      
    } catch (error) {
      console.error('Error initializing Auto-Upload System Phase 2:', error);
      showToast('Failed to initialize Phase 2 auto-upload: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Start real iOS photo monitoring for active events
   */
  async startRealMonitoring() {
    try {
      if (this.isMonitoring) {
        console.log('📸 Real photo monitoring already active');
        return true;
      }
      
      console.log('🔍 Starting real iOS photo monitoring...');
      
      // Get active events that are currently in upload window
      const activeEvents = autoUploadManager.getActiveUploadEvents();
      if (activeEvents.length === 0) {
        console.log('📴 No active events for real photo monitoring');
        return false;
      }
      
      // Prepare event timeframes for real monitoring
      const eventTimeframes = new Map();
      activeEvents.forEach(event => {
        eventTimeframes.set(event.eventId, {
          start: event.uploadWindow.start,
          end: event.uploadWindow.end,
          isLive: event.isLive
        });
      });
      
      // Enhanced callback for when new photos are detected
      const onNewPhotoCallback = async (photoData) => {
        console.log('📸 Real photo detected for auto-upload:', photoData.filename);
        
        // Enhanced logging for Phase 2
        console.log(`📊 Photo metadata: ${photoData.dimensions?.width}x${photoData.dimensions?.height}`);
        if (photoData.location) {
          console.log(`📍 Photo location: ${photoData.location.latitude}, ${photoData.location.longitude}`);
        }
        console.log(`📱 Camera: ${photoData.deviceInfo?.cameraModel}`);
        
        // The RealMediaMonitor already handles adding to upload queue
        showToast(`New photo detected: ${photoData.filename}`, 'info');
      };
      
      // Start real monitoring
      const monitoringStarted = await startRealPhotoMonitoring(eventTimeframes, onNewPhotoCallback);
      
      if (monitoringStarted) {
        this.isMonitoring = true;
        console.log(`✅ Real iOS photo monitoring started for ${activeEvents.length} events`);
        showToast(`Real photo monitoring active for ${activeEvents.length} events`, 'success');
        return true;
      } else {
        console.log('❌ Failed to start real photo monitoring');
        showToast('Failed to start real photo monitoring - check permissions', 'error');
        return false;
      }
      
    } catch (error) {
      console.error('Error starting real photo monitoring:', error);
      showToast('Error starting real photo monitoring: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Stop real photo monitoring
   */
  stopRealMonitoring() {
    try {
      console.log('🛑 Stopping real photo monitoring...');
      
      stopRealPhotoMonitoring();
      this.isMonitoring = false;
      
      console.log('✅ Real photo monitoring stopped');
      showToast('Real photo monitoring stopped', 'info');
      
    } catch (error) {
      console.error('Error stopping real photo monitoring:', error);
    }
  }

  /**
   * Get comprehensive Phase 2 auto-upload status
   */
  getStatus() {
    const managerStatus = autoUploadManager.getStatus();
    const realMonitorStatus = realMediaMonitor.getStatus();
    const queueStatus = uploadQueue.getStatus();
    const backgroundStatus = enhancedBackgroundService.getStatus();
    
    return {
      phase: 2,
      system: {
        isActive: this.isActive,
        isMonitoring: this.isMonitoring,
        hasActiveEvents: managerStatus.activeEventsCount > 0,
        backgroundSupported: backgroundStatus.isInitialized,
        realPhotosIntegration: true
      },
      manager: managerStatus,
      realMonitor: realMonitorStatus,
      queue: queueStatus,
      background: backgroundStatus,
      
      // Enhanced Phase 2 summary
      summary: {
        activeEvents: managerStatus.activeEventsCount,
        isAutoUploadActive: managerStatus.isAutoUploadActive,
        isRealMonitoring: realMonitorStatus.isMonitoring,
        isBackgroundActive: backgroundStatus.isBackgroundActive,
        pendingUploads: queueStatus.queueStats.pending,
        processingUploads: queueStatus.queueStats.processing,
        completedUploads: queueStatus.queueStats.completed,
        failedUploads: queueStatus.queueStats.failed,
        totalInQueue: queueStatus.queueStats.total,
        
        // Phase 2 enhancements
        realPhotosAccess: realMonitorStatus.photosFrameworkAccess,
        knownPhotosCount: realMonitorStatus.knownPhotosCount,
        permissionsGranted: realMonitorStatus.permissionsGranted
      }
    };
  }

  /**
   * Get upload queue items for display
   */
  getUploadHistory(status = null) {
    return getUploadQueueItems(status);
  }

  /**
   * Retry failed uploads
   */
  async retryFailedUploads() {
    try {
      console.log('🔄 Retrying failed uploads (Phase 2)...');
      await retryFailedUploads();
      showToast('Failed uploads queued for retry', 'success');
      
    } catch (error) {
      console.error('Error retrying failed uploads:', error);
      showToast('Error retrying failed uploads: ' + error.message, 'error');
    }
  }

  /**
   * Trigger manual real photo scan
   */
  async triggerRealPhotoScan() {
    if (!this.isMonitoring) {
      console.log('❌ Real photo monitoring not active');
      showToast('Real photo monitoring not active', 'error');
      return false;
    }
    
    try {
      console.log('🔄 Triggering manual real photo scan...');
      await realMediaMonitor.triggerManualScan();
      showToast('Manual real photo scan triggered', 'info');
      return true;
      
    } catch (error) {
      console.error('Error triggering manual real photo scan:', error);
      showToast('Error triggering manual scan: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Update event monitoring when events change
   */
  async refreshEventMonitoring() {
    try {
      console.log('🔄 Refreshing Phase 2 event monitoring...');
      
      // Reload active events
      await autoUploadManager.loadActiveEvents();
      
      // Update real monitor with new event timeframes
      const activeEvents = autoUploadManager.getActiveUploadEvents();
      const eventTimeframes = new Map();
      activeEvents.forEach(event => {
        eventTimeframes.set(event.eventId, {
          start: event.uploadWindow.start,
          end: event.uploadWindow.end,
          isLive: event.isLive
        });
      });
      
      realMediaMonitor.updateEventTimeframes(eventTimeframes);
      
      // Restart monitoring if it was active
      if (this.isMonitoring) {
        this.stopRealMonitoring();
        
        // Only restart if there are active events
        if (autoUploadManager.isAutoUploadActive()) {
          await this.startRealMonitoring();
        }
      }
      
      console.log('✅ Phase 2 event monitoring refreshed');
      
    } catch (error) {
      console.error('Error refreshing Phase 2 event monitoring:', error);
      showToast('Error refreshing events: ' + error.message, 'error');
    }
  }

  /**
   * Enable/disable Phase 2 auto-upload system
   */
  setEnabled(enabled) {
    try {
      console.log(`🔄 ${enabled ? 'Enabling' : 'Disabling'} Phase 2 auto-upload system...`);
      
      autoUploadManager.setAutoUploadEnabled(enabled);
      
      if (enabled && autoUploadManager.isAutoUploadActive()) {
        // Start real monitoring if enabled and there are active events
        this.startRealMonitoring();
      } else {
        // Stop real monitoring if disabled
        this.stopRealMonitoring();
      }
      
      console.log(`✅ Phase 2 auto-upload system ${enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('Error toggling Phase 2 auto-upload system:', error);
      showToast('Error toggling auto-upload: ' + error.message, 'error');
    }
  }

  /**
   * Get Phase 2 configuration for remote website integration
   */
  getConfig() {
    const status = this.getStatus();
    
    return {
      // System state
      phase: 2,
      isInitialized: this.isActive,
      isMonitoring: this.isMonitoring,
      isAutoUploadActive: status.manager.isAutoUploadActive,
      realPhotosIntegration: true,
      
      // Active events
      activeEvents: status.manager.activeEvents || [],
      
      // Queue statistics
      queueStats: status.queue.queueStats,
      
      // Rate limiting info
      rateLimitStatus: status.queue.rateLimitStatus,
      
      // Phase 2 enhancements
      realMonitoring: {
        isActive: status.realMonitor.isMonitoring,
        knownPhotosCount: status.realMonitor.knownPhotosCount,
        scanInterval: status.realMonitor.scanInterval,
        permissionsGranted: status.realMonitor.permissionsGranted
      },
      
      // Available actions
      actions: {
        canStart: this.isActive && !this.isMonitoring && status.manager.activeEventsCount > 0,
        canStop: this.isMonitoring,
        canRetryFailed: status.queue.queueStats.failed > 0,
        canTriggerRealScan: this.isMonitoring,
        canAccessRealPhotos: status.realMonitor.photosFrameworkAccess
      }
    };
  }

  /**
   * Open native photo picker for manual photo selection
   */
  async openPhotoPicker(eventId, options = {}) {
    if (!this.enhancedFeatures.nativePhotoPicker) {
      throw new Error('Native photo picker not available');
    }
    
    try {
      console.log('📷 Opening native photo picker...');
      const selectedPhoto = await nativePhotoPickerService.openSinglePhotoPicker(eventId, options);
      
      if (selectedPhoto) {
        console.log('✅ Photo selected via native picker');
        showToast('Photo selected and queued for upload', 'success');
      }
      
      return selectedPhoto;
      
    } catch (error) {
      console.error('Error opening photo picker:', error);
      showToast('Error opening photo picker: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Open batch photo picker for multiple photo selection
   */
  async openBatchPhotoPicker(eventId, maxPhotos = 10) {
    if (!this.enhancedFeatures.nativePhotoPicker) {
      throw new Error('Native photo picker not available');
    }
    
    try {
      console.log('📱 Opening batch photo picker...');
      const selectedPhotos = await nativePhotoPickerService.openBatchPhotoPicker(eventId, maxPhotos);
      
      if (selectedPhotos.length > 0) {
        console.log(`✅ ${selectedPhotos.length} photos selected via batch picker`);
        showToast(`${selectedPhotos.length} photos selected and queued`, 'success');
      }
      
      return selectedPhotos;
      
    } catch (error) {
      console.error('Error opening batch photo picker:', error);
      showToast('Error opening batch photo picker: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Get photo selection history
   */
  getPhotoSelectionHistory(limit = 10) {
    if (!this.enhancedFeatures.nativePhotoPicker) {
      return [];
    }
    
    return nativePhotoPickerService.getSelectionHistory(limit);
  }

  /**
   * Subscribe to real-time status updates
   */
  subscribeToStatusUpdates(callback) {
    if (!this.enhancedFeatures.realTimeStatus) {
      throw new Error('Real-time status monitoring not available');
    }
    
    return realTimeSyncStatusService.subscribe(callback);
  }

  /**
   * Get real-time status
   */
  getRealTimeStatus() {
    if (!this.enhancedFeatures.realTimeStatus) {
      return null;
    }
    
    return realTimeSyncStatusService.getStatus();
  }

  /**
   * Get performance analytics
   */
  getPerformanceAnalytics(timeRangeMs = 5 * 60 * 1000) {
    if (!this.enhancedFeatures.realTimeStatus) {
      return null;
    }
    
    return realTimeSyncStatusService.getPerformanceAnalytics(timeRangeMs);
  }

  /**
   * Force real-time status update
   */
  async forceStatusUpdate() {
    if (!this.enhancedFeatures.realTimeStatus) {
      throw new Error('Real-time status monitoring not available');
    }
    
    return await realTimeSyncStatusService.forceUpdate();
  }

  /**
   * Test push notifications
   */
  async testPushNotifications() {
    if (!this.enhancedFeatures.pushNotifications) {
      throw new Error('Push notifications not available');
    }
    
    try {
      console.log('🧪 Testing push notifications...');
      const result = await pushNotificationService.testNotifications();
      
      if (result) {
        showToast('Push notification test completed', 'success');
      } else {
        showToast('Push notification test failed', 'error');
      }
      
      return result;
      
    } catch (error) {
      console.error('Error testing push notifications:', error);
      showToast('Error testing push notifications: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Send upload status notification
   */
  async sendUploadNotification(uploadData) {
    if (!this.enhancedFeatures.pushNotifications) {
      return;
    }
    
    await pushNotificationService.sendUploadStatusNotification(uploadData);
  }

  /**
   * Get enhanced Phase 2+ features status
   */
  getEnhancedFeaturesStatus() {
    return {
      ...this.enhancedFeatures,
      nativePickerStatus: this.enhancedFeatures.nativePhotoPicker ? 
        nativePhotoPickerService.getStatus() : null,
      pushNotificationStatus: this.enhancedFeatures.pushNotifications ? 
        pushNotificationService.getStatus() : null,
      realTimeStatusActive: this.isRealTimeStatusActive
    };
  }

  /**
   * Get comprehensive enhanced status
   */
  getEnhancedStatus() {
    const baseStatus = this.getStatus();
    const enhancedFeatures = this.getEnhancedFeaturesStatus();
    
    return {
      ...baseStatus,
      enhancedFeatures: enhancedFeatures,
      
      // Enhanced Phase 2+ summary
      enhancedSummary: {
        totalFeatures: 6, // Core + 3 enhanced
        activeFeatures: Object.values(this.enhancedFeatures).filter(f => f).length + 3, // Base features
        nativeIntegrationLevel: this.enhancedFeatures.nativePhotoPicker ? 'full' : 'basic',
        realTimeCapabilities: this.enhancedFeatures.realTimeStatus,
        notificationSupport: this.enhancedFeatures.pushNotifications,
        phase: '2+',
        version: '2.1.0'
      }
    };
  }

  /**
   * Clean up the Enhanced Phase 2+ auto-upload system
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up Auto-Upload System Phase 2...');
      
      this.stopRealMonitoring();
      await autoUploadManager.cleanup();
      await enhancedBackgroundService.cleanup();
      realMediaMonitor.cleanup();
      
      this.isActive = false;
      this.supabaseClient = null;
      this.currentUser = null;
      
      console.log('✅ Auto-Upload System Phase 2 cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up Auto-Upload System Phase 2:', error);
    }
  }
}

// Export singleton instance
export const autoUploadSystemPhase2 = new AutoUploadSystemPhase2();

// Export convenience functions for remote website integration
export async function initializeAutoUploadSystemPhase2(supabaseClient, currentUser) {
  return await autoUploadSystemPhase2.initialize(supabaseClient, currentUser);
}

export function getAutoUploadSystemPhase2Status() {
  return autoUploadSystemPhase2.getStatus();
}

export function getAutoUploadPhase2Config() {
  return autoUploadSystemPhase2.getConfig();
}

export async function startRealAutoUploadMonitoring() {
  return await autoUploadSystemPhase2.startRealMonitoring();
}

export function stopRealAutoUploadMonitoring() {
  autoUploadSystemPhase2.stopRealMonitoring();
}

export async function retryFailedAutoUploadsPhase2() {
  await autoUploadSystemPhase2.retryFailedUploads();
}

export async function triggerRealManualPhotoScan() {
  return await autoUploadSystemPhase2.triggerRealPhotoScan();
}

export function setAutoUploadPhase2Enabled(enabled) {
  autoUploadSystemPhase2.setEnabled(enabled);
}

export async function refreshAutoUploadPhase2Events() {
  await autoUploadSystemPhase2.refreshEventMonitoring();
}