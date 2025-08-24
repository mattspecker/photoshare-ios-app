import { autoUploadManager, initializeAutoUpload } from './autoUploadManager.js';
import { mediaMonitor, startPhotoMonitoring, stopPhotoMonitoring } from './mediaMonitor.js';
import { uploadQueue, getUploadQueueStatus, getUploadQueueItems, retryFailedUploads } from './uploadQueue.js';
import { backgroundUploadService, initializeBackgroundUploadService } from './backgroundUploadService.js';
import { showToast } from './cameraPermissions.js';

/**
 * Auto-Upload System Integration
 * Main interface for the auto-upload functionality
 */
export class AutoUploadSystem {
  constructor() {
    this.isActive = false;
    this.isMonitoring = false;
    this.supabaseClient = null;
    this.currentUser = null;
    
    console.log('🚀 AutoUploadSystem initialized');
  }

  /**
   * Initialize the complete auto-upload system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🔄 Initializing Auto-Upload System...');
      
      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;
      
      // Initialize the main auto-upload manager
      const managerInitialized = await initializeAutoUpload(supabaseClient, currentUser);
      if (!managerInitialized) {
        throw new Error('Failed to initialize AutoUploadManager');
      }
      
      // Initialize background upload service
      const backgroundInitialized = await initializeBackgroundUploadService();
      if (!backgroundInitialized) {
        console.log('⚠️ Background upload service initialization failed (continuing without background support)');
      } else {
        console.log('✅ Background upload service initialized');
      }
      
      this.isActive = true;
      
      console.log('✅ Auto-Upload System initialized successfully');
      showToast('Auto-upload system ready!', 'success');
      
      // Start monitoring if there are active events
      if (autoUploadManager.isAutoUploadActive()) {
        await this.startMonitoring();
      }
      
      return true;
      
    } catch (error) {
      console.error('Error initializing Auto-Upload System:', error);
      showToast('Failed to initialize auto-upload: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Start photo monitoring for active events
   */
  async startMonitoring() {
    try {
      if (this.isMonitoring) {
        console.log('📸 Photo monitoring already active');
        return true;
      }
      
      console.log('🔍 Starting photo monitoring...');
      
      // Get active events that are currently in upload window
      const activeEvents = autoUploadManager.getActiveUploadEvents();
      if (activeEvents.length === 0) {
        console.log('📴 No active events for photo monitoring');
        return false;
      }
      
      // Prepare event timeframes for monitoring
      const eventTimeframes = new Map();
      activeEvents.forEach(event => {
        eventTimeframes.set(event.eventId, {
          start: event.uploadWindow.start,
          end: event.uploadWindow.end,
          isLive: event.isLive
        });
      });
      
      // Callback for when new photos are detected
      const onNewPhotoCallback = async (photoData) => {
        console.log('📸 New photo detected for auto-upload:', photoData.filename);
        
        // The MediaMonitor already handles adding to upload queue
        // This callback can be used for additional processing or notifications
        
        showToast(`New photo detected: ${photoData.filename}`, 'info');
      };
      
      // Start monitoring
      const monitoringStarted = await startPhotoMonitoring(eventTimeframes, onNewPhotoCallback);
      
      if (monitoringStarted) {
        this.isMonitoring = true;
        console.log(`✅ Photo monitoring started for ${activeEvents.length} events`);
        showToast(`Monitoring photos for ${activeEvents.length} events`, 'success');
        return true;
      } else {
        console.log('❌ Failed to start photo monitoring');
        return false;
      }
      
    } catch (error) {
      console.error('Error starting photo monitoring:', error);
      showToast('Error starting photo monitoring: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Stop photo monitoring
   */
  stopMonitoring() {
    try {
      console.log('🛑 Stopping photo monitoring...');
      
      stopPhotoMonitoring();
      this.isMonitoring = false;
      
      console.log('✅ Photo monitoring stopped');
      showToast('Photo monitoring stopped', 'info');
      
    } catch (error) {
      console.error('Error stopping photo monitoring:', error);
    }
  }

  /**
   * Get comprehensive auto-upload status
   */
  getStatus() {
    const managerStatus = autoUploadManager.getStatus();
    const monitorStatus = mediaMonitor.getStatus();
    const queueStatus = uploadQueue.getStatus();
    const backgroundStatus = backgroundUploadService.getStatus();
    
    return {
      system: {
        isActive: this.isActive,
        isMonitoring: this.isMonitoring,
        hasActiveEvents: managerStatus.activeEventsCount > 0,
        backgroundSupported: backgroundStatus.isInitialized
      },
      manager: managerStatus,
      monitor: monitorStatus,
      queue: queueStatus,
      background: backgroundStatus,
      
      // Summary for UI display
      summary: {
        activeEvents: managerStatus.activeEventsCount,
        isAutoUploadActive: managerStatus.isAutoUploadActive,
        isMonitoring: monitorStatus.isMonitoring,
        isBackgroundActive: backgroundStatus.isBackgroundActive,
        pendingUploads: queueStatus.queueStats.pending,
        processingUploads: queueStatus.queueStats.processing,
        completedUploads: queueStatus.queueStats.completed,
        failedUploads: queueStatus.queueStats.failed,
        totalInQueue: queueStatus.queueStats.total
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
      console.log('🔄 Retrying failed uploads...');
      await retryFailedUploads();
      showToast('Failed uploads queued for retry', 'success');
      
    } catch (error) {
      console.error('Error retrying failed uploads:', error);
      showToast('Error retrying failed uploads: ' + error.message, 'error');
    }
  }

  /**
   * Trigger manual photo scan (for testing)
   */
  async triggerManualScan() {
    if (!this.isMonitoring) {
      console.log('❌ Photo monitoring not active');
      showToast('Photo monitoring not active', 'error');
      return false;
    }
    
    try {
      console.log('🔄 Triggering manual photo scan...');
      await mediaMonitor.triggerManualScan();
      showToast('Manual photo scan triggered', 'info');
      return true;
      
    } catch (error) {
      console.error('Error triggering manual scan:', error);
      showToast('Error triggering manual scan: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Update event monitoring when events change
   */
  async refreshEventMonitoring() {
    try {
      console.log('🔄 Refreshing event monitoring...');
      
      // Reload active events
      await autoUploadManager.loadActiveEvents();
      
      // Restart monitoring if it was active
      if (this.isMonitoring) {
        this.stopMonitoring();
        
        // Only restart if there are active events
        if (autoUploadManager.isAutoUploadActive()) {
          await this.startMonitoring();
        }
      }
      
      console.log('✅ Event monitoring refreshed');
      
    } catch (error) {
      console.error('Error refreshing event monitoring:', error);
      showToast('Error refreshing events: ' + error.message, 'error');
    }
  }

  /**
   * Enable/disable auto-upload system
   */
  setEnabled(enabled) {
    try {
      console.log(`🔄 ${enabled ? 'Enabling' : 'Disabling'} auto-upload system...`);
      
      autoUploadManager.setAutoUploadEnabled(enabled);
      
      if (enabled && autoUploadManager.isAutoUploadActive()) {
        // Start monitoring if enabled and there are active events
        this.startMonitoring();
      } else {
        // Stop monitoring if disabled
        this.stopMonitoring();
      }
      
      console.log(`✅ Auto-upload system ${enabled ? 'enabled' : 'disabled'}`);
      
    } catch (error) {
      console.error('Error toggling auto-upload system:', error);
      showToast('Error toggling auto-upload: ' + error.message, 'error');
    }
  }

  /**
   * Get configuration for remote website integration
   */
  getConfig() {
    const status = this.getStatus();
    
    return {
      // System state
      isInitialized: this.isActive,
      isMonitoring: this.isMonitoring,
      isAutoUploadActive: status.manager.isAutoUploadActive,
      
      // Active events
      activeEvents: status.manager.activeEvents || [],
      
      // Queue statistics
      queueStats: status.queue.queueStats,
      
      // Rate limiting info
      rateLimitStatus: status.queue.rateLimitStatus,
      
      // Available actions
      actions: {
        canStart: this.isActive && !this.isMonitoring && status.manager.activeEventsCount > 0,
        canStop: this.isMonitoring,
        canRetryFailed: status.queue.queueStats.failed > 0,
        canTriggerScan: this.isMonitoring
      }
    };
  }

  /**
   * Clean up the auto-upload system
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up Auto-Upload System...');
      
      this.stopMonitoring();
      await autoUploadManager.cleanup();
      await backgroundUploadService.cleanup();
      
      this.isActive = false;
      this.supabaseClient = null;
      this.currentUser = null;
      
      console.log('✅ Auto-Upload System cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up Auto-Upload System:', error);
    }
  }
}

// Export singleton instance
export const autoUploadSystem = new AutoUploadSystem();

// Export convenience functions for remote website integration
export async function initializeAutoUploadSystem(supabaseClient, currentUser) {
  return await autoUploadSystem.initialize(supabaseClient, currentUser);
}

export function getAutoUploadSystemStatus() {
  return autoUploadSystem.getStatus();
}

export function getAutoUploadConfig() {
  return autoUploadSystem.getConfig();
}

export async function startAutoUploadMonitoring() {
  return await autoUploadSystem.startMonitoring();
}

export function stopAutoUploadMonitoring() {
  autoUploadSystem.stopMonitoring();
}

export async function retryFailedAutoUploads() {
  await autoUploadSystem.retryFailedUploads();
}

export async function triggerManualPhotoScan() {
  return await autoUploadSystem.triggerManualScan();
}

export function setAutoUploadEnabled(enabled) {
  autoUploadSystem.setEnabled(enabled);
}

export async function refreshAutoUploadEvents() {
  await autoUploadSystem.refreshEventMonitoring();
}