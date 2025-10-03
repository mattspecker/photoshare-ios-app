import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { showToast } from './cameraPermissions.js';
import { addPhotoToUploadQueue } from './uploadQueue.js';

/**
 * MediaMonitor - Detects new photos created during event timeframes
 * Integrates with iOS Photos framework to monitor photo library changes
 */
export class MediaMonitor {
  constructor() {
    this.isMonitoring = false;
    this.lastScanTime = null;
    this.knownPhotos = new Set(); // Track photos we've already seen
    this.monitoringInterval = null;
    this.eventTimeframes = new Map(); // eventId -> timeframe
    this.onNewPhotoCallback = null;
    
    // Configuration
    this.config = {
      scanInterval: 30000, // 30 seconds
      maxPhotosPerScan: 50, // Limit to prevent performance issues
      supportedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    };
    
    console.log('📸 MediaMonitor initialized');
  }

  /**
   * Start monitoring for new photos
   */
  async startMonitoring(eventTimeframes, onNewPhotoCallback) {
    try {
      console.log('🔍 Starting photo monitoring...');
      
      // Platform check
      if (!Capacitor.isNativePlatform()) {
        console.log('❌ Photo monitoring only available on native platforms');
        return false;
      }

      // Check permissions
      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        console.log('❌ Photo library permissions required for monitoring');
        return false;
      }

      this.eventTimeframes = new Map(eventTimeframes);
      this.onNewPhotoCallback = onNewPhotoCallback;
      this.lastScanTime = new Date();
      this.isMonitoring = true;

      // Perform initial scan to establish baseline
      await this.performInitialScan();

      // Start periodic scanning
      this.monitoringInterval = setInterval(() => {
        this.scanForNewPhotos();
      }, this.config.scanInterval);

      console.log(`✅ Photo monitoring started (${this.eventTimeframes.size} events)`);
      console.log(`📊 Scan interval: ${this.config.scanInterval / 1000}s`);
      
      return true;
      
    } catch (error) {
      console.error('Error starting photo monitoring:', error);
      showToast('Error starting photo monitoring: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Stop monitoring for photos
   */
  stopMonitoring() {
    try {
      console.log('🛑 Stopping photo monitoring...');
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      this.isMonitoring = false;
      this.eventTimeframes.clear();
      this.knownPhotos.clear();
      this.onNewPhotoCallback = null;
      
      console.log('✅ Photo monitoring stopped');
      
    } catch (error) {
      console.error('Error stopping photo monitoring:', error);
    }
  }

  /**
   * Perform initial scan to establish baseline of existing photos
   */
  async performInitialScan() {
    try {
      console.log('🔄 Performing initial photo scan...');
      
      // For initial scan, we'll use a simplified approach
      // In a real implementation, you'd query the iOS Photos library
      // For now, we'll simulate by tracking timestamp
      
      const deviceInfo = await Device.getInfo();
      console.log(`📱 Scanning on ${deviceInfo.platform} ${deviceInfo.model}`);
      
      // Reset known photos set
      this.knownPhotos.clear();
      
      // TODO: In actual implementation, query iOS Photos library
      // and populate knownPhotos with existing photo identifiers
      
      console.log('✅ Initial scan completed');
      
    } catch (error) {
      console.error('Error in initial scan:', error);
      throw error;
    }
  }

  /**
   * Scan for new photos since last scan
   */
  async scanForNewPhotos() {
    if (!this.isMonitoring) {
      return;
    }

    try {
      console.log('🔍 Scanning for new photos...');
      
      const currentTime = new Date();
      const scanStartTime = this.lastScanTime;
      
      // Get device info for metadata
      const deviceInfo = await Device.getInfo();
      
      // TODO: In actual implementation, this would query iOS Photos library
      // For now, we'll simulate the photo detection process
      
      const newPhotos = await this.detectNewPhotosFromLibrary(scanStartTime, currentTime);
      
      if (newPhotos.length > 0) {
        console.log(`📸 Found ${newPhotos.length} new photos`);
        
        // Filter photos that were created during active event timeframes
        const relevantPhotos = this.filterPhotosByEventTimeframes(newPhotos);
        
        if (relevantPhotos.length > 0) {
          console.log(`🎯 ${relevantPhotos.length} photos match event timeframes`);
          
          // Process each relevant photo
          for (const photo of relevantPhotos) {
            await this.processNewPhoto(photo, deviceInfo);
          }
        }
      }
      
      this.lastScanTime = currentTime;
      
    } catch (error) {
      console.error('Error scanning for new photos:', error);
    }
  }

  /**
   * Detect new photos from library (SIMULATION)
   * In actual implementation, this would use iOS Photos framework
   */
  async detectNewPhotosFromLibrary(startTime, endTime) {
    // SIMULATION: In real implementation, this would:
    // 1. Query iOS Photos library using PHPhotoLibrary
    // 2. Filter by creation date between startTime and endTime
    // 3. Return photo metadata including creation time, location, etc.
    
    const simulatedPhotos = [];
    
    // For demo purposes, simulate finding photos occasionally
    if (Math.random() > 0.8) { // 20% chance of finding a new photo
      const createdAt = new Date(startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime()));
      
      simulatedPhotos.push({
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: createdAt,
        filename: `IMG_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
        // TODO: Add actual photo data in real implementation
        localIdentifier: `local_${Date.now()}`,
        location: null // Would contain GPS data if available
      });
      
      console.log('🔍 Simulated photo detection:', simulatedPhotos[0]);
    }
    
    return simulatedPhotos;
  }

  /**
   * Filter photos by event timeframes
   */
  filterPhotosByEventTimeframes(photos) {
    const relevantPhotos = [];
    
    for (const photo of photos) {
      const photoCreatedAt = new Date(photo.createdAt);
      
      // Check if photo was created during any event timeframe
      for (const [eventId, timeframe] of this.eventTimeframes) {
        const startTime = new Date(timeframe.start);
        const endTime = new Date(timeframe.end);
        
        if (photoCreatedAt >= startTime && photoCreatedAt <= endTime && timeframe.isLive) {
          console.log(`🎯 Photo ${photo.filename} matches event ${eventId}`);
          
          relevantPhotos.push({
            ...photo,
            eventId: eventId,
            eventTimeframe: timeframe
          });
          
          break; // Photo matches this event, no need to check others
        }
      }
    }
    
    return relevantPhotos;
  }

  /**
   * Process a new photo that matches event criteria
   */
  async processNewPhoto(photo, deviceInfo) {
    try {
      console.log(`📸 Processing new photo: ${photo.filename} for event ${photo.eventId}`);
      
      // Check if we've already processed this photo
      if (this.knownPhotos.has(photo.id)) {
        console.log('⏭️ Photo already processed, skipping');
        return;
      }
      
      // Add to known photos
      this.knownPhotos.add(photo.id);
      
      // Prepare photo data for upload queue
      const photoData = {
        id: photo.id,
        eventId: photo.eventId,
        filename: photo.filename,
        mimeType: photo.mimeType,
        fileSize: photo.fileSize,
        createdAt: photo.createdAt,
        detectedAt: new Date(),
        localIdentifier: photo.localIdentifier,
        location: photo.location,
        deviceInfo: {
          platform: deviceInfo.platform,
          model: deviceInfo.model,
          osVersion: deviceInfo.osVersion
        },
        status: 'pending'
      };
      
      // Validate photo meets requirements
      if (!this.validatePhoto(photoData)) {
        console.log('❌ Photo validation failed, skipping');
        return;
      }
      
      console.log('✅ Photo ready for upload queue');
      
      // Add photo to upload queue
      const uploadId = await addPhotoToUploadQueue(photoData);
      if (uploadId) {
        console.log(`📦 Photo added to upload queue: ${uploadId}`);
      }
      
      // Notify callback about new photo
      if (this.onNewPhotoCallback) {
        await this.onNewPhotoCallback(photoData);
      }
      
    } catch (error) {
      console.error('Error processing new photo:', error);
    }
  }

  /**
   * Validate photo meets upload requirements
   */
  validatePhoto(photoData) {
    try {
      // Check file size (50MB limit from backend)
      if (photoData.fileSize > 50 * 1024 * 1024) {
        console.log(`❌ Photo too large: ${(photoData.fileSize / 1024 / 1024).toFixed(2)}MB`);
        return false;
      }
      
      // Check MIME type
      if (!this.config.supportedMimeTypes.includes(photoData.mimeType)) {
        console.log(`❌ Unsupported format: ${photoData.mimeType}`);
        return false;
      }
      
      // Check if photo is too old (basic sanity check)
      const photoAge = Date.now() - new Date(photoData.createdAt).getTime();
      if (photoAge > 24 * 60 * 60 * 1000) { // 24 hours
        console.log('❌ Photo too old, likely not from current event');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error validating photo:', error);
      return false;
    }
  }

  /**
   * Update event timeframes (when events start/stop)
   */
  updateEventTimeframes(eventTimeframes) {
    console.log(`🔄 Updating event timeframes: ${eventTimeframes.size} events`);
    this.eventTimeframes = new Map(eventTimeframes);
  }

  /**
   * Check photo library permissions
   */
  async checkPermissions() {
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.photos !== 'granted') {
        console.log('❌ Photo library permission not granted');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastScanTime: this.lastScanTime,
      knownPhotosCount: this.knownPhotos.size,
      eventTimeframesCount: this.eventTimeframes.size,
      scanInterval: this.config.scanInterval,
      config: this.config
    };
  }

  /**
   * Manual scan trigger (for testing)
   */
  async triggerManualScan() {
    if (this.isMonitoring) {
      console.log('🔄 Manual scan triggered');
      await this.scanForNewPhotos();
    } else {
      console.log('❌ Monitoring not active, cannot trigger manual scan');
    }
  }
}

// Export singleton instance
export const mediaMonitor = new MediaMonitor();

// Export for remote website integration
export async function startPhotoMonitoring(eventTimeframes, onNewPhotoCallback) {
  return await mediaMonitor.startMonitoring(eventTimeframes, onNewPhotoCallback);
}

export function stopPhotoMonitoring() {
  mediaMonitor.stopMonitoring();
}

export function updateEventTimeframes(eventTimeframes) {
  mediaMonitor.updateEventTimeframes(eventTimeframes);
}

export function getPhotoMonitoringStatus() {
  return mediaMonitor.getStatus();
}

export async function triggerManualPhotoScan() {
  return await mediaMonitor.triggerManualScan();
}