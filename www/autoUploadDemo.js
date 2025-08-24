import { 
  initializeAutoUploadSystem,
  getAutoUploadSystemStatus,
  getAutoUploadConfig,
  startAutoUploadMonitoring,
  stopAutoUploadMonitoring,
  triggerManualPhotoScan,
  retryFailedAutoUploads,
  setAutoUploadEnabled
} from './autoUpload.js';
import { getUploadQueueItems } from './uploadQueue.js';
import { showToast } from './cameraPermissions.js';

/**
 * Auto-Upload System Demo and Testing
 * Demonstrates how to integrate and use the auto-upload system
 */
export class AutoUploadDemo {
  constructor() {
    this.isInitialized = false;
    this.demoInterval = null;
    
    console.log('🧪 AutoUploadDemo initialized');
  }

  /**
   * Initialize the demo with Supabase client and user
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🚀 Initializing Auto-Upload Demo...');
      
      // Initialize the complete auto-upload system
      const initialized = await initializeAutoUploadSystem(supabaseClient, currentUser);
      
      if (!initialized) {
        throw new Error('Failed to initialize auto-upload system');
      }
      
      this.isInitialized = true;
      
      console.log('✅ Auto-Upload Demo initialized successfully');
      showToast('Auto-upload demo ready!', 'success');
      
      // Show initial status
      this.showSystemStatus();
      
      return true;
      
    } catch (error) {
      console.error('Error initializing Auto-Upload Demo:', error);
      showToast('Demo initialization failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Show comprehensive system status
   */
  showSystemStatus() {
    try {
      console.log('📊 Auto-Upload System Status:');
      
      const status = getAutoUploadSystemStatus();
      const config = getAutoUploadConfig();
      
      console.log('=== SYSTEM STATUS ===');
      console.log(`🟢 System Active: ${status.system.isActive}`);
      console.log(`🔍 Monitoring: ${status.system.isMonitoring}`);
      console.log(`📱 Background Supported: ${status.system.backgroundSupported}`);
      console.log(`🎯 Active Events: ${status.summary.activeEvents}`);
      console.log(`🚀 Auto-Upload Active: ${status.summary.isAutoUploadActive}`);
      
      console.log('\n=== UPLOAD QUEUE ===');
      console.log(`📦 Total in Queue: ${status.summary.totalInQueue}`);
      console.log(`⏳ Pending: ${status.summary.pendingUploads}`);
      console.log(`🔄 Processing: ${status.summary.processingUploads}`);
      console.log(`✅ Completed: ${status.summary.completedUploads}`);
      console.log(`❌ Failed: ${status.summary.failedUploads}`);
      
      console.log('\n=== RATE LIMITING ===');
      console.log(`📈 Current Uploads: ${status.queue.rateLimitStatus.currentUploads}/${status.queue.rateLimitStatus.maxUploads}`);
      console.log(`⏰ Window: ${status.queue.rateLimitStatus.windowMinutes} minutes`);
      
      console.log('\n=== AVAILABLE ACTIONS ===');
      console.log(`🎬 Can Start Monitoring: ${config.actions.canStart}`);
      console.log(`⏹️ Can Stop Monitoring: ${config.actions.canStop}`);
      console.log(`🔄 Can Retry Failed: ${config.actions.canRetryFailed}`);
      console.log(`📸 Can Trigger Scan: ${config.actions.canTriggerScan}`);
      
      return status;
      
    } catch (error) {
      console.error('Error showing system status:', error);
      return null;
    }
  }

  /**
   * Start monitoring demo
   */
  async startMonitoringDemo() {
    try {
      console.log('🎬 Starting monitoring demo...');
      
      if (!this.isInitialized) {
        throw new Error('Demo not initialized');
      }
      
      const started = await startAutoUploadMonitoring();
      
      if (started) {
        console.log('✅ Monitoring started successfully');
        showToast('Photo monitoring started', 'success');
        
        // Show updated status
        this.showSystemStatus();
        
        return true;
      } else {
        console.log('❌ Failed to start monitoring');
        showToast('Failed to start monitoring', 'error');
        return false;
      }
      
    } catch (error) {
      console.error('Error starting monitoring demo:', error);
      showToast('Monitoring demo error: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Stop monitoring demo
   */
  stopMonitoringDemo() {
    try {
      console.log('⏹️ Stopping monitoring demo...');
      
      stopAutoUploadMonitoring();
      
      console.log('✅ Monitoring stopped');
      showToast('Photo monitoring stopped', 'info');
      
      // Show updated status
      this.showSystemStatus();
      
    } catch (error) {
      console.error('Error stopping monitoring demo:', error);
      showToast('Stop monitoring error: ' + error.message, 'error');
    }
  }

  /**
   * Trigger manual photo scan demo
   */
  async triggerScanDemo() {
    try {
      console.log('📸 Triggering manual scan demo...');
      
      const triggered = await triggerManualPhotoScan();
      
      if (triggered) {
        console.log('✅ Manual scan triggered');
        showToast('Manual photo scan triggered', 'info');
      } else {
        console.log('❌ Failed to trigger scan');
        showToast('Failed to trigger scan', 'error');
      }
      
      return triggered;
      
    } catch (error) {
      console.error('Error triggering scan demo:', error);
      showToast('Scan demo error: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Retry failed uploads demo
   */
  async retryFailedDemo() {
    try {
      console.log('🔄 Retrying failed uploads demo...');
      
      await retryFailedAutoUploads();
      
      console.log('✅ Failed uploads queued for retry');
      showToast('Failed uploads queued for retry', 'success');
      
      // Show updated status
      setTimeout(() => this.showSystemStatus(), 1000);
      
    } catch (error) {
      console.error('Error retrying failed uploads:', error);
      showToast('Retry failed error: ' + error.message, 'error');
    }
  }

  /**
   * Show upload queue details
   */
  showUploadQueueDetails() {
    try {
      console.log('📦 Upload Queue Details:');
      
      const allItems = getUploadQueueItems();
      const pendingItems = getUploadQueueItems('pending');
      const processingItems = getUploadQueueItems('processing');
      const completedItems = getUploadQueueItems('completed');
      const failedItems = getUploadQueueItems('failed');
      
      console.log(`\n📊 Queue Summary:`);
      console.log(`Total Items: ${allItems.length}`);
      console.log(`Pending: ${pendingItems.length}`);
      console.log(`Processing: ${processingItems.length}`);
      console.log(`Completed: ${completedItems.length}`);
      console.log(`Failed: ${failedItems.length}`);
      
      if (pendingItems.length > 0) {
        console.log(`\n⏳ Pending Items:`);
        pendingItems.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. ${item.filename} (Event: ${item.eventId})`);
        });
        if (pendingItems.length > 3) {
          console.log(`... and ${pendingItems.length - 3} more`);
        }
      }
      
      if (failedItems.length > 0) {
        console.log(`\n❌ Failed Items:`);
        failedItems.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. ${item.filename} - ${item.error || 'Unknown error'}`);
        });
        if (failedItems.length > 3) {
          console.log(`... and ${failedItems.length - 3} more`);
        }
      }
      
      return {
        all: allItems,
        pending: pendingItems,
        processing: processingItems,
        completed: completedItems,
        failed: failedItems
      };
      
    } catch (error) {
      console.error('Error showing upload queue details:', error);
      return null;
    }
  }

  /**
   * Toggle auto-upload enabled/disabled
   */
  toggleAutoUpload() {
    try {
      const status = getAutoUploadSystemStatus();
      const currentlyEnabled = status.manager.uploadEnabled;
      const newState = !currentlyEnabled;
      
      console.log(`🔄 Toggling auto-upload: ${currentlyEnabled} → ${newState}`);
      
      setAutoUploadEnabled(newState);
      
      console.log(`✅ Auto-upload ${newState ? 'enabled' : 'disabled'}`);
      showToast(`Auto-upload ${newState ? 'enabled' : 'disabled'}`, 'info');
      
      // Show updated status
      setTimeout(() => this.showSystemStatus(), 500);
      
    } catch (error) {
      console.error('Error toggling auto-upload:', error);
      showToast('Toggle error: ' + error.message, 'error');
    }
  }

  /**
   * Start live status monitoring
   */
  startLiveStatusMonitoring(intervalMs = 10000) {
    try {
      console.log(`📊 Starting live status monitoring (${intervalMs}ms interval)...`);
      
      if (this.demoInterval) {
        clearInterval(this.demoInterval);
      }
      
      this.demoInterval = setInterval(() => {
        const status = getAutoUploadSystemStatus();
        
        console.log(`📊 [${new Date().toLocaleTimeString()}] Status: ` +
          `Events: ${status.summary.activeEvents}, ` +
          `Queue: ${status.summary.totalInQueue} ` +
          `(P:${status.summary.pendingUploads} C:${status.summary.completedUploads} F:${status.summary.failedUploads}), ` +
          `Monitoring: ${status.system.isMonitoring ? '🟢' : '🔴'}`
        );
      }, intervalMs);
      
      console.log('✅ Live status monitoring started');
      showToast('Live status monitoring started', 'info');
      
    } catch (error) {
      console.error('Error starting live status monitoring:', error);
      showToast('Live monitoring error: ' + error.message, 'error');
    }
  }

  /**
   * Stop live status monitoring
   */
  stopLiveStatusMonitoring() {
    try {
      if (this.demoInterval) {
        clearInterval(this.demoInterval);
        this.demoInterval = null;
        console.log('✅ Live status monitoring stopped');
        showToast('Live status monitoring stopped', 'info');
      }
      
    } catch (error) {
      console.error('Error stopping live status monitoring:', error);
    }
  }

  /**
   * Run comprehensive demo workflow
   */
  async runFullDemo() {
    try {
      console.log('🎭 Starting comprehensive auto-upload demo...');
      
      if (!this.isInitialized) {
        throw new Error('Demo not initialized');
      }
      
      // Step 1: Show initial status
      console.log('\n📊 STEP 1: Initial Status');
      this.showSystemStatus();
      
      await this.delay(2000);
      
      // Step 2: Show queue details
      console.log('\n📦 STEP 2: Upload Queue Details');
      this.showUploadQueueDetails();
      
      await this.delay(2000);
      
      // Step 3: Start monitoring (if possible)
      console.log('\n🎬 STEP 3: Start Monitoring');
      const config = getAutoUploadConfig();
      if (config.actions.canStart) {
        await this.startMonitoringDemo();
        await this.delay(3000);
      } else {
        console.log('ℹ️ Cannot start monitoring - no active events or already monitoring');
      }
      
      // Step 4: Trigger manual scan (if possible)
      console.log('\n📸 STEP 4: Manual Photo Scan');
      if (config.actions.canTriggerScan) {
        await this.triggerScanDemo();
        await this.delay(2000);
      } else {
        console.log('ℹ️ Cannot trigger scan - monitoring not active');
      }
      
      // Step 5: Check for failed uploads and retry
      console.log('\n🔄 STEP 5: Retry Failed Uploads');
      if (config.actions.canRetryFailed) {
        await this.retryFailedDemo();
        await this.delay(2000);
      } else {
        console.log('ℹ️ No failed uploads to retry');
      }
      
      // Step 6: Final status
      console.log('\n📊 STEP 6: Final Status');
      this.showSystemStatus();
      
      console.log('\n🎉 Comprehensive demo completed!');
      showToast('Auto-upload demo completed!', 'success');
      
    } catch (error) {
      console.error('Error running full demo:', error);
      showToast('Demo error: ' + error.message, 'error');
    }
  }

  /**
   * Helper: Add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up demo resources
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up demo...');
      
      this.stopLiveStatusMonitoring();
      this.isInitialized = false;
      
      console.log('✅ Demo cleanup completed');
      
    } catch (error) {
      console.error('Error cleaning up demo:', error);
    }
  }
}

// Export singleton instance
export const autoUploadDemo = new AutoUploadDemo();

// Export convenience functions for remote website integration
export async function initializeDemo(supabaseClient, currentUser) {
  return await autoUploadDemo.initialize(supabaseClient, currentUser);
}

export function showAutoUploadStatus() {
  return autoUploadDemo.showSystemStatus();
}

export async function startDemo() {
  return await autoUploadDemo.startMonitoringDemo();
}

export function stopDemo() {
  autoUploadDemo.stopMonitoringDemo();
}

export async function triggerDemo() {
  return await autoUploadDemo.triggerScanDemo();
}

export async function retryDemo() {
  await autoUploadDemo.retryFailedDemo();
}

export function toggleDemo() {
  autoUploadDemo.toggleAutoUpload();
}

export function showQueueDetails() {
  return autoUploadDemo.showUploadQueueDetails();
}

export async function runFullAutoUploadDemo() {
  await autoUploadDemo.runFullDemo();
}

export function startLiveMonitoring(interval = 10000) {
  autoUploadDemo.startLiveStatusMonitoring(interval);
}

export function stopLiveMonitoring() {
  autoUploadDemo.stopLiveStatusMonitoring();
}

// Export ready-to-use demo object for global access
if (typeof window !== 'undefined') {
  window.autoUploadDemo = {
    // Status and information
    showStatus: showAutoUploadStatus,
    showQueue: showQueueDetails,
    
    // Controls
    start: startDemo,
    stop: stopDemo,
    trigger: triggerDemo,
    retry: retryDemo,
    toggle: toggleDemo,
    
    // Demo workflows
    runFull: runFullAutoUploadDemo,
    startLive: startLiveMonitoring,
    stopLive: stopLiveMonitoring,
    
    // Advanced
    instance: autoUploadDemo
  };
  
  console.log('🌐 Auto-upload demo available at window.autoUploadDemo');
}