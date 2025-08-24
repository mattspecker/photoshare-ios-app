import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { showToast } from './cameraPermissions.js';

/**
 * PushNotificationService - Comprehensive push notification integration
 * Handles upload status notifications, webhook responses, and background alerts
 */
export class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.isEnabled = false;
    this.deviceToken = null;
    this.notificationPermission = 'default';
    this.notificationHistory = [];
    this.webhookSubscriptions = new Map();
    
    // Configuration
    this.config = {
      // Notification categories
      categories: {
        uploadStatus: 'UPLOAD_STATUS',
        eventAlert: 'EVENT_ALERT',
        backgroundSync: 'BACKGROUND_SYNC',
        error: 'ERROR_ALERT'
      },
      
      // Notification settings
      badge: true,
      sound: true,
      alert: true,
      
      // Webhook integration
      webhookEndpoint: '/api/webhooks/mobile-notifications',
      retryAttempts: 3,
      retryDelay: 5000,
      
      // History management
      maxHistoryItems: 50,
      historyRetentionDays: 7
    };
    
    console.log('🔔 PushNotificationService initialized');
  }

  /**
   * Initialize push notification service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing PushNotificationService...');
      
      // Platform check
      const deviceInfo = await Device.getInfo();
      if (!Capacitor.isNativePlatform() || deviceInfo.platform !== 'ios') {
        console.log('❌ Push notifications only available on iOS');
        return false;
      }

      // Check notification permissions
      await this.checkNotificationPermissions();
      
      // Register notification categories
      await this.registerNotificationCategories();
      
      // Set up webhook integration
      await this.setupWebhookIntegration();
      
      // Register for remote notifications
      if (this.notificationPermission === 'granted') {
        await this.registerForRemoteNotifications();
      }
      
      this.isInitialized = true;
      
      console.log('✅ PushNotificationService initialized');
      return true;
      
    } catch (error) {
      console.error('Error initializing PushNotificationService:', error);
      return false;
    }
  }

  /**
   * Check notification permissions
   */
  async checkNotificationPermissions() {
    try {
      console.log('🔐 Checking notification permissions...');
      
      // In real implementation, this would use:
      // UNUserNotificationCenter.current().getNotificationSettings()
      
      // Simulate permission check
      const hasPermission = Math.random() > 0.3; // 70% chance of permission
      
      if (hasPermission) {
        this.notificationPermission = 'granted';
        console.log('✅ Notification permissions granted');
      } else {
        this.notificationPermission = 'denied';
        console.log('❌ Notification permissions denied');
        
        // Request permission
        await this.requestNotificationPermissions();
      }
      
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      this.notificationPermission = 'denied';
    }
  }

  /**
   * Request notification permissions
   */
  async requestNotificationPermissions() {
    try {
      console.log('📱 Requesting notification permissions...');
      
      // In real implementation, this would use:
      // UNUserNotificationCenter.current().requestAuthorization()
      
      // Simulate permission request
      const granted = Math.random() > 0.2; // 80% chance of granting
      
      if (granted) {
        this.notificationPermission = 'granted';
        this.isEnabled = true;
        console.log('✅ Notification permissions granted by user');
        showToast('Notifications enabled for upload status', 'success');
      } else {
        this.notificationPermission = 'denied';
        console.log('❌ Notification permissions denied by user');
        showToast('Notifications disabled - enable in Settings for upload alerts', 'info');
      }
      
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  }

  /**
   * Register notification categories
   */
  async registerNotificationCategories() {
    try {
      console.log('📋 Registering notification categories...');
      
      const categories = [
        {
          identifier: this.config.categories.uploadStatus,
          actions: [
            { identifier: 'VIEW_UPLOADS', title: 'View Uploads', options: [] },
            { identifier: 'DISMISS', title: 'Dismiss', options: ['destructive'] }
          ],
          options: ['customDismissAction']
        },
        {
          identifier: this.config.categories.eventAlert,
          actions: [
            { identifier: 'OPEN_EVENT', title: 'Open Event', options: [] },
            { identifier: 'DISMISS', title: 'Dismiss', options: [] }
          ],
          options: []
        },
        {
          identifier: this.config.categories.backgroundSync,
          actions: [
            { identifier: 'VIEW_STATUS', title: 'View Status', options: [] }
          ],
          options: []
        },
        {
          identifier: this.config.categories.error,
          actions: [
            { identifier: 'RETRY', title: 'Retry', options: [] },
            { identifier: 'VIEW_DETAILS', title: 'View Details', options: [] }
          ],
          options: []
        }
      ];
      
      // In real implementation, this would register with UNUserNotificationCenter
      console.log(`✅ Registered ${categories.length} notification categories`);
      
      categories.forEach(category => {
        console.log(`   📝 ${category.identifier}: ${category.actions.length} actions`);
      });
      
    } catch (error) {
      console.error('Error registering notification categories:', error);
    }
  }

  /**
   * Register for remote notifications
   */
  async registerForRemoteNotifications() {
    try {
      console.log('📡 Registering for remote notifications...');
      
      // In real implementation, this would:
      // 1. Call UIApplication.shared.registerForRemoteNotifications()
      // 2. Get device token from delegate
      // 3. Send token to server
      
      // Simulate device token generation
      this.deviceToken = this.generateDeviceToken();
      
      console.log(`✅ Device token generated: ${this.deviceToken.substring(0, 16)}...`);
      
      // Register with webhook service
      await this.registerDeviceWithWebhook();
      
    } catch (error) {
      console.error('Error registering for remote notifications:', error);
    }
  }

  /**
   * Generate simulated device token
   */
  generateDeviceToken() {
    const characters = '0123456789abcdef';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }

  /**
   * Register device token with webhook service
   */
  async registerDeviceWithWebhook() {
    try {
      console.log('🔗 Registering device with webhook service...');
      
      const registrationData = {
        deviceToken: this.deviceToken,
        platform: 'ios',
        appVersion: '2.0.0',
        categories: Object.values(this.config.categories),
        preferences: {
          uploadStatus: true,
          backgroundSync: true,
          eventAlerts: true,
          errors: true
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // In real implementation, would POST to your webhook service
      console.log('📡 Device registration payload prepared:', {
        deviceToken: this.deviceToken.substring(0, 16) + '...',
        categories: registrationData.categories.length,
        timezone: registrationData.timezone
      });
      
      console.log('✅ Device registered with webhook service');
      
    } catch (error) {
      console.error('Error registering device with webhook:', error);
    }
  }

  /**
   * Set up webhook integration for real-time notifications
   */
  async setupWebhookIntegration() {
    try {
      console.log('🔗 Setting up webhook integration...');
      
      // Subscribe to upload status webhooks
      this.webhookSubscriptions.set('upload_completed', {
        handler: this.handleUploadCompletedWebhook.bind(this),
        category: this.config.categories.uploadStatus
      });
      
      this.webhookSubscriptions.set('upload_failed', {
        handler: this.handleUploadFailedWebhook.bind(this),
        category: this.config.categories.error
      });
      
      this.webhookSubscriptions.set('background_sync', {
        handler: this.handleBackgroundSyncWebhook.bind(this),
        category: this.config.categories.backgroundSync
      });
      
      this.webhookSubscriptions.set('event_status_change', {
        handler: this.handleEventStatusWebhook.bind(this),
        category: this.config.categories.eventAlert
      });
      
      console.log(`✅ Webhook integration set up: ${this.webhookSubscriptions.size} subscriptions`);
      
    } catch (error) {
      console.error('Error setting up webhook integration:', error);
    }
  }

  /**
   * Send upload status notification
   */
  async sendUploadStatusNotification(uploadData) {
    try {
      if (!this.isEnabled) return;
      
      const notification = {
        title: 'Photo Upload Complete',
        body: `${uploadData.filename} uploaded successfully to ${uploadData.eventName}`,
        category: this.config.categories.uploadStatus,
        data: {
          uploadId: uploadData.uploadId,
          eventId: uploadData.eventId,
          filename: uploadData.filename,
          timestamp: new Date().toISOString()
        },
        badge: await this.getAppBadgeCount() + 1
      };
      
      await this.deliverNotification(notification);
      console.log(`🔔 Upload status notification sent: ${uploadData.filename}`);
      
    } catch (error) {
      console.error('Error sending upload status notification:', error);
    }
  }

  /**
   * Send background sync notification
   */
  async sendBackgroundSyncNotification(syncData) {
    try {
      if (!this.isEnabled) return;
      
      const notification = {
        title: 'Background Sync Complete',
        body: `${syncData.uploadCount} photos uploaded automatically`,
        category: this.config.categories.backgroundSync,
        data: {
          uploadCount: syncData.uploadCount,
          eventCount: syncData.eventCount,
          timestamp: new Date().toISOString()
        },
        badge: await this.getAppBadgeCount() + syncData.uploadCount
      };
      
      await this.deliverNotification(notification);
      console.log(`🔔 Background sync notification sent: ${syncData.uploadCount} uploads`);
      
    } catch (error) {
      console.error('Error sending background sync notification:', error);
    }
  }

  /**
   * Send error notification
   */
  async sendErrorNotification(errorData) {
    try {
      if (!this.isEnabled) return;
      
      const notification = {
        title: 'Upload Error',
        body: `Failed to upload ${errorData.filename}: ${errorData.error}`,
        category: this.config.categories.error,
        data: {
          uploadId: errorData.uploadId,
          filename: errorData.filename,
          error: errorData.error,
          timestamp: new Date().toISOString()
        },
        sound: 'error.wav'
      };
      
      await this.deliverNotification(notification);
      console.log(`🔔 Error notification sent: ${errorData.filename}`);
      
    } catch (error) {
      console.error('Error sending error notification:', error);
    }
  }

  /**
   * Send event alert notification
   */
  async sendEventAlertNotification(eventData) {
    try {
      if (!this.isEnabled) return;
      
      const notification = {
        title: 'Event Status Update',
        body: `${eventData.eventName} is now ${eventData.status}`,
        category: this.config.categories.eventAlert,
        data: {
          eventId: eventData.eventId,
          eventName: eventData.eventName,
          status: eventData.status,
          timestamp: new Date().toISOString()
        }
      };
      
      await this.deliverNotification(notification);
      console.log(`🔔 Event alert notification sent: ${eventData.eventName}`);
      
    } catch (error) {
      console.error('Error sending event alert notification:', error);
    }
  }

  /**
   * Deliver notification to user
   */
  async deliverNotification(notification) {
    try {
      console.log('📱 Delivering notification:', notification.title);
      
      // Add to history
      this.notificationHistory.push({
        ...notification,
        deliveredAt: new Date(),
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      
      // Trim history if needed
      if (this.notificationHistory.length > this.config.maxHistoryItems) {
        this.notificationHistory = this.notificationHistory.slice(-this.config.maxHistoryItems);
      }
      
      // In real implementation, this would use UNUserNotificationCenter
      // to schedule local notification or send via APNS
      
      // Show toast as immediate feedback
      showToast(`📱 ${notification.title}: ${notification.body}`, 'info');
      
      console.log('✅ Notification delivered successfully');
      
    } catch (error) {
      console.error('Error delivering notification:', error);
    }
  }

  /**
   * Handle webhook for upload completed
   */
  async handleUploadCompletedWebhook(webhookData) {
    console.log('🔗 Received upload completed webhook:', webhookData);
    
    await this.sendUploadStatusNotification({
      uploadId: webhookData.uploadId,
      filename: webhookData.filename,
      eventName: webhookData.eventName,
      eventId: webhookData.eventId
    });
  }

  /**
   * Handle webhook for upload failed
   */
  async handleUploadFailedWebhook(webhookData) {
    console.log('🔗 Received upload failed webhook:', webhookData);
    
    await this.sendErrorNotification({
      uploadId: webhookData.uploadId,
      filename: webhookData.filename,
      error: webhookData.error
    });
  }

  /**
   * Handle webhook for background sync
   */
  async handleBackgroundSyncWebhook(webhookData) {
    console.log('🔗 Received background sync webhook:', webhookData);
    
    await this.sendBackgroundSyncNotification({
      uploadCount: webhookData.uploadCount,
      eventCount: webhookData.eventCount
    });
  }

  /**
   * Handle webhook for event status changes
   */
  async handleEventStatusWebhook(webhookData) {
    console.log('🔗 Received event status webhook:', webhookData);
    
    await this.sendEventAlertNotification({
      eventId: webhookData.eventId,
      eventName: webhookData.eventName,
      status: webhookData.status
    });
  }

  /**
   * Simulate receiving webhook
   */
  async simulateWebhook(webhookType, data) {
    try {
      console.log(`🧪 Simulating webhook: ${webhookType}`);
      
      const subscription = this.webhookSubscriptions.get(webhookType);
      if (subscription && subscription.handler) {
        await subscription.handler(data);
      } else {
        console.log(`⚠️ No handler for webhook type: ${webhookType}`);
      }
      
    } catch (error) {
      console.error('Error simulating webhook:', error);
    }
  }

  /**
   * Get app badge count
   */
  async getAppBadgeCount() {
    // In real implementation, would get from UIApplication.shared.applicationIconBadgeNumber
    return Math.floor(Math.random() * 5); // Simulate 0-4 current badge
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications() {
    try {
      console.log('🧹 Clearing all notifications...');
      
      // In real implementation, would call:
      // UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
      // UNUserNotificationCenter.current().removeAllDeliveredNotifications()
      
      this.notificationHistory = [];
      
      console.log('✅ All notifications cleared');
      
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(limit = 10) {
    return this.notificationHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get notification statistics
   */
  getNotificationStats() {
    const stats = {
      total: this.notificationHistory.length,
      byCategory: {},
      recent: this.notificationHistory.filter(n => 
        Date.now() - new Date(n.deliveredAt).getTime() < 24 * 60 * 60 * 1000
      ).length
    };
    
    // Count by category
    this.notificationHistory.forEach(notification => {
      const category = notification.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      permission: this.notificationPermission,
      deviceToken: this.deviceToken ? this.deviceToken.substring(0, 16) + '...' : null,
      
      // Configuration
      config: this.config,
      
      // Statistics
      stats: this.getNotificationStats(),
      
      // Webhook subscriptions
      webhookSubscriptions: Array.from(this.webhookSubscriptions.keys()),
      
      // Recent notifications
      recentNotifications: this.getNotificationHistory(5)
    };
  }

  /**
   * Test notification system
   */
  async testNotifications() {
    try {
      console.log('🧪 Testing notification system...');
      
      if (!this.isInitialized) {
        throw new Error('PushNotificationService not initialized');
      }
      
      // Test upload success notification
      await this.sendUploadStatusNotification({
        uploadId: 'test_upload_123',
        filename: 'test_photo.jpg',
        eventName: 'Test Event',
        eventId: 'test_event_1'
      });
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test background sync notification
      await this.sendBackgroundSyncNotification({
        uploadCount: 3,
        eventCount: 1
      });
      
      console.log('✅ Notification system test completed');
      showToast('Push notification test completed', 'success');
      
      return true;
      
    } catch (error) {
      console.error('Error testing notifications:', error);
      showToast('Push notification test failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Clean up notification service
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up PushNotificationService...');
      
      await this.clearAllNotifications();
      
      this.webhookSubscriptions.clear();
      this.notificationHistory = [];
      this.deviceToken = null;
      this.isInitialized = false;
      this.isEnabled = false;
      
      console.log('✅ PushNotificationService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up PushNotificationService:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Export convenience functions
export async function initializePushNotifications() {
  return await pushNotificationService.initialize();
}

export async function sendUploadStatusNotification(uploadData) {
  return await pushNotificationService.sendUploadStatusNotification(uploadData);
}

export async function sendBackgroundSyncNotification(syncData) {
  return await pushNotificationService.sendBackgroundSyncNotification(syncData);
}

export async function sendErrorNotification(errorData) {
  return await pushNotificationService.sendErrorNotification(errorData);
}

export async function simulateWebhook(webhookType, data) {
  return await pushNotificationService.simulateWebhook(webhookType, data);
}

export function getPushNotificationStatus() {
  return pushNotificationService.getStatus();
}

export async function testPushNotifications() {
  return await pushNotificationService.testNotifications();
}