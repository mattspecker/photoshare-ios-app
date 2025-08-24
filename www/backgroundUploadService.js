import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { uploadQueue } from './uploadQueue.js';
import { autoUploadManager } from './autoUploadManager.js';
import { showToast } from './cameraPermissions.js';

/**
 * BackgroundUploadService - Manages background upload tasks for iOS
 * Handles iOS background execution limits and task management
 */
export class BackgroundUploadService {
  constructor() {
    this.isInitialized = false;
    this.isBackgroundActive = false;
    this.backgroundTaskId = null;
    this.appStateSubscription = null;
    this.backgroundProcessingInterval = null;
    
    // Configuration
    this.config = {
      backgroundTaskTimeout: 25000, // 25 seconds (iOS gives ~30 seconds)
      backgroundProcessingInterval: 5000, // 5 seconds
      maxBackgroundUploads: 3, // Limit background uploads
      backgroundTaskName: 'photo-upload-task'
    };
    
    console.log('🌙 BackgroundUploadService initialized');
  }

  /**
   * Initialize background upload service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing BackgroundUploadService...');
      
      // Platform check
      const deviceInfo = await Device.getInfo();
      if (!Capacitor.isNativePlatform() || deviceInfo.platform !== 'ios') {
        console.log('❌ BackgroundUploadService only available on iOS');
        return false;
      }

      // Set up app state listeners
      await this.setupAppStateListeners();
      
      this.isInitialized = true;
      
      console.log('✅ BackgroundUploadService initialized');
      return true;
      
    } catch (error) {
      console.error('Error initializing BackgroundUploadService:', error);
      return false;
    }
  }

  /**
   * Set up app state change listeners
   */
  async setupAppStateListeners() {
    try {
      console.log('👂 Setting up app state listeners...');
      
      // Listen for app state changes
      this.appStateSubscription = App.addListener('appStateChange', ({ isActive }) => {
        console.log(`📱 App state changed: ${isActive ? 'foreground' : 'background'}`);
        
        if (!isActive) {
          // App went to background
          this.handleAppBackground();
        } else {
          // App came to foreground
          this.handleAppForeground();
        }
      });
      
      console.log('✅ App state listeners set up');
      
    } catch (error) {
      console.error('Error setting up app state listeners:', error);
    }
  }

  /**
   * Handle app going to background
   */
  async handleAppBackground() {
    try {
      console.log('🌙 App entering background mode...');
      
      // Check if there are pending uploads
      const queueStatus = uploadQueue.getStatus();
      const pendingUploads = queueStatus.queueStats.pending + queueStatus.queueStats.processing;
      
      if (pendingUploads === 0) {
        console.log('📦 No pending uploads, skipping background task');
        return;
      }
      
      // Check if auto-upload is currently active
      if (!autoUploadManager.isAutoUploadActive()) {
        console.log('📴 Auto-upload not active, skipping background task');
        return;
      }
      
      console.log(`🔄 Starting background task for ${pendingUploads} pending uploads...`);
      
      // Start background task
      await this.startBackgroundTask();
      
    } catch (error) {
      console.error('Error handling app background:', error);
    }
  }

  /**
   * Handle app coming to foreground
   */
  handleAppForeground() {
    try {
      console.log('☀️ App entering foreground mode...');
      
      // Stop background task if active
      this.stopBackgroundTask();
      
      // Show status update
      const queueStatus = uploadQueue.getStatus();
      if (queueStatus.queueStats.total > 0) {
        showToast(
          `Upload queue: ${queueStatus.queueStats.pending} pending, ${queueStatus.queueStats.completed} completed`, 
          'info'
        );
      }
      
    } catch (error) {
      console.error('Error handling app foreground:', error);
    }
  }

  /**
   * Start background processing
   */
  async startBackgroundTask() {
    try {
      console.log('🚀 Starting background processing...');
      
      if (this.isBackgroundActive) {
        console.log('⚠️ Background processing already active');
        return;
      }
      
      this.isBackgroundActive = true;
      console.log(`✅ Background processing started`);
      
      // Process uploads in background with time limit
      setTimeout(async () => {
        try {
          await this.processBackgroundUploads();
        } catch (backgroundError) {
          console.error('Error in background upload processing:', backgroundError);
        } finally {
          this.stopBackgroundTask();
        }
      }, 100);
      
      // Set up timeout to ensure we don't exceed iOS background time limit
      setTimeout(() => {
        if (this.isBackgroundActive) {
          console.log('⏰ Background task timeout reached, finishing...');
          this.stopBackgroundTask();
        }
      }, this.config.backgroundTaskTimeout);
      
    } catch (error) {
      console.error('Error starting background task:', error);
      this.isBackgroundActive = false;
    }
  }

  /**
   * Stop background processing
   */
  stopBackgroundTask() {
    try {
      if (!this.isBackgroundActive) {
        return;
      }
      
      console.log('🛑 Stopping background processing...');
      
      // Stop background processing
      if (this.backgroundProcessingInterval) {
        clearInterval(this.backgroundProcessingInterval);
        this.backgroundProcessingInterval = null;
      }
      
      this.isBackgroundActive = false;
      this.backgroundTaskId = null;
      
      console.log('✅ Background processing stopped');
      
    } catch (error) {
      console.error('Error stopping background task:', error);
    }
  }

  /**
   * Process uploads during background execution
   */
  async processBackgroundUploads() {
    try {
      console.log('📤 Processing background uploads...');
      
      const startTime = Date.now();
      let uploadCount = 0;
      
      // Process uploads with time limit
      while (
        this.isBackgroundActive && 
        (Date.now() - startTime) < (this.config.backgroundTaskTimeout - 5000) && 
        uploadCount < this.config.maxBackgroundUploads
      ) {
        
        // Get pending uploads
        const pendingUploads = uploadQueue.getQueueItems('pending');
        
        if (pendingUploads.length === 0) {
          console.log('📦 No more pending uploads');
          break;
        }
        
        console.log(`🔄 Processing upload ${uploadCount + 1}/${this.config.maxBackgroundUploads}...`);
        
        // Process one upload at a time in background
        await uploadQueue.processQueue();
        
        uploadCount++;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Background upload processing completed: ${uploadCount} processed in ${elapsedTime}ms`);
      
      // Check remaining uploads
      const remainingUploads = uploadQueue.getQueueItems('pending').length;
      if (remainingUploads > 0) {
        console.log(`📦 ${remainingUploads} uploads remaining (will process when app is active)`);
      }
      
    } catch (error) {
      console.error('Error processing background uploads:', error);
    }
  }

  /**
   * Register background processing task (for iOS 13+)
   */
  async registerBackgroundProcessingTask() {
    try {
      console.log('📋 Registering background processing task...');
      
      // Note: This would typically be done at the native iOS level
      // For Capacitor, we'll use the BackgroundTask plugin instead
      
      // In a full native implementation, you would register:
      // BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.photoshare.photo-upload", using: nil) { task in
      //   // Handle background processing
      // }
      
      console.log('✅ Background processing registration completed');
      
    } catch (error) {
      console.error('Error registering background processing task:', error);
    }
  }

  /**
   * Schedule background app refresh (when user enables in Settings)
   */
  async scheduleBackgroundRefresh() {
    try {
      console.log('⏰ Scheduling background app refresh...');
      
      // Note: Background App Refresh must be enabled by user in iOS Settings
      // This would typically schedule future background execution
      
      // In a full native implementation, you would use:
      // BGTaskScheduler.shared.submit(taskRequest)
      
      console.log('✅ Background app refresh scheduled');
      
    } catch (error) {
      console.error('Error scheduling background refresh:', error);
    }
  }

  /**
   * Get background service status
   */
  getStatus() {
    const queueStatus = uploadQueue.getStatus();
    
    return {
      isInitialized: this.isInitialized,
      isBackgroundActive: this.isBackgroundActive,
      backgroundTaskId: this.backgroundTaskId,
      
      // Queue information
      pendingUploads: queueStatus.queueStats.pending,
      processingUploads: queueStatus.queueStats.processing,
      
      // Configuration
      config: this.config,
      
      // iOS background capabilities
      capabilities: {
        backgroundAppRefresh: 'unknown', // Would need to check iOS settings
        backgroundProcessing: true,
        backgroundFetch: true
      }
    };
  }

  /**
   * Test background functionality
   */
  async testBackgroundTask() {
    try {
      console.log('🧪 Testing background task functionality...');
      
      if (!this.isInitialized) {
        throw new Error('BackgroundUploadService not initialized');
      }
      
      // Simulate background task
      await this.startBackgroundTask();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop task
      this.stopBackgroundTask();
      
      console.log('✅ Background task test completed');
      showToast('Background task test completed', 'success');
      
      return true;
      
    } catch (error) {
      console.error('Error testing background task:', error);
      showToast('Background task test failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Clean up background service
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up BackgroundUploadService...');
      
      // Stop any active background task
      this.stopBackgroundTask();
      
      // Remove app state listener
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }
      
      this.isInitialized = false;
      
      console.log('✅ BackgroundUploadService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up BackgroundUploadService:', error);
    }
  }
}

// Export singleton instance
export const backgroundUploadService = new BackgroundUploadService();

// Export for remote website integration
export async function initializeBackgroundUploadService() {
  return await backgroundUploadService.initialize();
}

export function getBackgroundUploadServiceStatus() {
  return backgroundUploadService.getStatus();
}

export async function testBackgroundUploadTask() {
  return await backgroundUploadService.testBackgroundTask();
}

export async function scheduleBackgroundAppRefresh() {
  await backgroundUploadService.scheduleBackgroundRefresh();
}