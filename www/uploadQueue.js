import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType } from '@capacitor/camera';
import { showToast } from './cameraPermissions.js';

/**
 * UploadQueue - Manages upload queue with persistence and retry logic
 * Handles file queuing, SHA-256 hash generation, and upload processing
 */
export class UploadQueue {
  constructor() {
    this.isInitialized = false;
    this.queue = new Map(); // uploadId -> uploadItem
    this.isProcessing = false;
    this.processingInterval = null;
    this.supabaseClient = null;
    this.currentUser = null;
    
    // Configuration
    this.config = {
      queueFileName: 'auto-upload-queue.json',
      maxRetries: 3,
      retryDelays: [5000, 15000, 60000], // 5s, 15s, 1min
      processingInterval: 10000, // 10 seconds
      maxConcurrentUploads: 2,
      uploadEndpoint: '/functions/v1/mobile-upload',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    };
    
    // Rate limiting tracking
    this.rateLimitTracker = {
      uploads: [],
      maxUploads: 50,
      windowMinutes: 60
    };
    
    console.log('📦 UploadQueue initialized');
  }

  /**
   * Initialize the upload queue system
   */
  async initialize(supabaseClient, currentUser) {
    try {
      console.log('🔄 Initializing UploadQueue...');
      
      // Platform check
      if (!Capacitor.isNativePlatform()) {
        console.log('❌ UploadQueue only available on native platforms');
        return false;
      }

      this.supabaseClient = supabaseClient;
      this.currentUser = currentUser;
      
      // Load existing queue from storage
      await this.loadQueueFromStorage();
      
      // Clean up old completed/failed uploads
      await this.cleanupOldUploads();
      
      // Start processing queue
      this.startQueueProcessing();
      
      this.isInitialized = true;
      
      console.log(`✅ UploadQueue initialized with ${this.queue.size} items`);
      return true;
      
    } catch (error) {
      console.error('Error initializing UploadQueue:', error);
      return false;
    }
  }

  /**
   * Add a photo to the upload queue
   */
  async addPhotoToQueue(photoData) {
    try {
      console.log(`📸 Adding photo to queue: ${photoData.filename}`);
      
      if (!this.isInitialized) {
        throw new Error('UploadQueue not initialized');
      }

      // Check rate limits
      if (!this.checkRateLimit()) {
        console.log('⏸️ Rate limit exceeded, queuing for later');
        showToast('Upload rate limit reached. Photo queued for later.', 'warning');
      }

      // Generate unique upload ID
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare upload item
      const uploadItem = {
        id: uploadId,
        eventId: photoData.eventId,
        userId: this.currentUser?.id,
        
        // Photo metadata
        filename: photoData.filename,
        mimeType: photoData.mimeType,
        fileSize: photoData.fileSize,
        localIdentifier: photoData.localIdentifier,
        createdAt: photoData.createdAt,
        detectedAt: photoData.detectedAt,
        location: photoData.location,
        deviceInfo: photoData.deviceInfo,
        
        // Upload state
        status: 'pending', // pending, processing, completed, failed
        attempts: 0,
        maxRetries: this.config.maxRetries,
        
        // Processing metadata
        queuedAt: new Date(),
        lastAttemptAt: null,
        completedAt: null,
        error: null,
        
        // File data (will be populated when processing)
        base64Data: null,
        sha256Hash: null
      };
      
      // Validate photo meets requirements
      if (!this.validatePhoto(uploadItem)) {
        console.log('❌ Photo validation failed');
        return false;
      }
      
      // Add to queue
      this.queue.set(uploadId, uploadItem);
      
      // Persist queue to storage
      await this.saveQueueToStorage();
      
      console.log(`✅ Photo added to queue: ${uploadId}`);
      showToast(`Photo queued for upload (${this.queue.size} in queue)`, 'info');
      
      // Trigger immediate processing if not already running
      if (!this.isProcessing) {
        setTimeout(() => this.processQueue(), 1000);
      }
      
      return uploadId;
      
    } catch (error) {
      console.error('Error adding photo to queue:', error);
      showToast('Error queuing photo: ' + error.message, 'error');
      return null;
    }
  }

  /**
   * Validate photo meets upload requirements
   */
  validatePhoto(photoData) {
    try {
      // Check file size
      if (photoData.fileSize > this.config.maxFileSize) {
        console.log(`❌ Photo too large: ${(photoData.fileSize / 1024 / 1024).toFixed(2)}MB`);
        return false;
      }
      
      // Check MIME type
      if (!this.config.supportedMimeTypes.includes(photoData.mimeType)) {
        console.log(`❌ Unsupported format: ${photoData.mimeType}`);
        return false;
      }
      
      // Check required fields
      if (!photoData.eventId || !photoData.filename) {
        console.log('❌ Missing required photo metadata');
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error validating photo:', error);
      return false;
    }
  }

  /**
   * Check if upload is within rate limits
   */
  checkRateLimit() {
    try {
      const now = Date.now();
      const windowStart = now - (this.config.rateLimitTracker?.windowMinutes || this.rateLimitTracker.windowMinutes) * 60 * 1000;
      
      // Clean up old entries
      this.rateLimitTracker.uploads = this.rateLimitTracker.uploads.filter(
        timestamp => timestamp > windowStart
      );
      
      // Check if under limit
      const currentUploads = this.rateLimitTracker.uploads.length;
      const maxUploads = this.config.rateLimitTracker?.maxUploads || this.rateLimitTracker.maxUploads;
      
      if (currentUploads >= maxUploads) {
        console.log(`⏸️ Rate limit: ${currentUploads}/${maxUploads} uploads in window`);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return true; // Allow upload if check fails
    }
  }

  /**
   * Start processing the upload queue
   */
  startQueueProcessing() {
    if (this.processingInterval) {
      return; // Already running
    }
    
    console.log('▶️ Starting queue processing...');
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.processingInterval);
    
    // Process immediately
    setTimeout(() => this.processQueue(), 500);
  }

  /**
   * Stop processing the upload queue
   */
  stopQueueProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('⏸️ Queue processing stopped');
    }
  }

  /**
   * Process pending uploads in the queue
   */
  async processQueue() {
    if (this.isProcessing || !this.isInitialized) {
      return;
    }
    
    try {
      this.isProcessing = true;
      
      // Get pending uploads
      const pendingUploads = Array.from(this.queue.values())
        .filter(item => item.status === 'pending')
        .sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt))
        .slice(0, this.config.maxConcurrentUploads);
      
      if (pendingUploads.length === 0) {
        return; // No pending uploads
      }
      
      console.log(`🔄 Processing ${pendingUploads.length} pending uploads...`);
      
      // Process uploads concurrently
      const uploadPromises = pendingUploads.map(uploadItem => 
        this.processUploadItem(uploadItem)
      );
      
      await Promise.allSettled(uploadPromises);
      
      // Save updated queue state
      await this.saveQueueToStorage();
      
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single upload item
   */
  async processUploadItem(uploadItem) {
    try {
      console.log(`📤 Processing upload: ${uploadItem.filename}`);
      
      // Update status to processing
      uploadItem.status = 'processing';
      uploadItem.lastAttemptAt = new Date();
      uploadItem.attempts += 1;
      
      // Check if exceeded max retries
      if (uploadItem.attempts > uploadItem.maxRetries) {
        console.log(`❌ Upload failed after ${uploadItem.maxRetries} attempts: ${uploadItem.id}`);
        uploadItem.status = 'failed';
        uploadItem.error = 'Maximum retry attempts exceeded';
        showToast(`Upload failed: ${uploadItem.filename}`, 'error');
        return;
      }

      // Check rate limit before processing
      if (!this.checkRateLimit()) {
        console.log(`⏸️ Rate limit exceeded, delaying upload: ${uploadItem.id}`);
        uploadItem.status = 'pending'; // Reset to pending
        uploadItem.attempts -= 1; // Don't count this as an attempt
        return;
      }
      
      // Convert photo to base64 and generate hash
      await this.prepareUploadData(uploadItem);
      
      // Perform the upload
      const uploadResult = await this.uploadToSupabase(uploadItem);
      
      if (uploadResult.success) {
        // Mark as completed
        uploadItem.status = 'completed';
        uploadItem.completedAt = new Date();
        uploadItem.error = null;
        
        // Track successful upload for rate limiting
        this.rateLimitTracker.uploads.push(Date.now());
        
        console.log(`✅ Upload completed: ${uploadItem.filename}`);
        showToast(`Photo uploaded successfully: ${uploadItem.filename}`, 'success');
        
      } else {
        // Handle upload failure
        console.log(`❌ Upload failed: ${uploadResult.error}`);
        uploadItem.error = uploadResult.error;
        
        // Check if we should retry or mark as failed
        if (uploadItem.attempts >= uploadItem.maxRetries) {
          uploadItem.status = 'failed';
          showToast(`Upload failed permanently: ${uploadItem.filename}`, 'error');
        } else {
          uploadItem.status = 'pending'; // Will retry later
          console.log(`⏭️ Will retry upload: ${uploadItem.filename} (attempt ${uploadItem.attempts}/${uploadItem.maxRetries})`);
        }
      }
      
    } catch (error) {
      console.error(`Error processing upload ${uploadItem.id}:`, error);
      uploadItem.status = 'pending';
      uploadItem.error = error.message;
    }
  }

  /**
   * Prepare upload data (convert to base64 and generate hash)
   */
  async prepareUploadData(uploadItem) {
    try {
      console.log(`🔄 Preparing upload data for: ${uploadItem.filename}`);
      
      if (uploadItem.base64Data && uploadItem.sha256Hash) {
        console.log('✅ Upload data already prepared');
        return; // Already prepared
      }
      
      // For now, simulate reading the photo file
      // In actual implementation, you would read from the local identifier
      // or use the photo file path stored during detection
      
      // TODO: Implement actual photo file reading from iOS Photos library
      // This would involve using the localIdentifier to fetch the actual image data
      
      // Simulate photo data conversion
      const simulatedBase64 = this.generateSimulatedPhotoData(uploadItem);
      const sha256Hash = await this.generateSHA256Hash(simulatedBase64);
      
      uploadItem.base64Data = simulatedBase64;
      uploadItem.sha256Hash = sha256Hash;
      
      console.log(`✅ Upload data prepared: hash=${sha256Hash.substring(0, 16)}...`);
      
    } catch (error) {
      console.error('Error preparing upload data:', error);
      throw error;
    }
  }

  /**
   * Generate simulated photo data (replace with actual implementation)
   */
  generateSimulatedPhotoData(uploadItem) {
    // This is a simulation - in real implementation, you would:
    // 1. Use the localIdentifier to fetch the actual photo from iOS Photos library
    // 2. Convert the image to base64 format
    // 3. Return the actual base64 data
    
    const simulatedData = `data:${uploadItem.mimeType};base64,/9j/4AAQSkZJRgABAQAAAQABAAD...${uploadItem.id}`;
    console.log('📸 Generated simulated photo data');
    return simulatedData;
  }

  /**
   * Generate SHA-256 hash for duplicate detection
   */
  async generateSHA256Hash(base64Data) {
    try {
      // Extract base64 content (remove data:image/...;base64, prefix)
      const base64Content = base64Data.split(',')[1] || base64Data;
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Generate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex;
      
    } catch (error) {
      console.error('Error generating SHA-256 hash:', error);
      throw error;
    }
  }

  /**
   * Upload photo to Supabase edge function
   */
  async uploadToSupabase(uploadItem) {
    try {
      console.log(`🌐 Uploading to Supabase: ${uploadItem.filename}`);
      
      if (!this.supabaseClient || !this.currentUser) {
        throw new Error('Supabase client or user not available');
      }

      // Prepare upload payload
      const uploadPayload = {
        event_id: uploadItem.eventId,
        file_data: uploadItem.base64Data.split(',')[1], // Remove data:image prefix
        file_name: uploadItem.filename,
        file_type: 'photo',
        mime_type: uploadItem.mimeType,
        file_size: uploadItem.fileSize,
        sha256_hash: uploadItem.sha256Hash,
        created_at: uploadItem.createdAt,
        device_info: {
          platform: uploadItem.deviceInfo?.platform || 'ios',
          model: uploadItem.deviceInfo?.model || 'unknown',
          os_version: uploadItem.deviceInfo?.osVersion || 'unknown'
        },
        location: uploadItem.location || null
      };

      // Get current session for authentication
      const { data: { session } } = await this.supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('No authenticated session available');
      }

      // Call the mobile-upload edge function
      const { data, error } = await this.supabaseClient.functions.invoke('mobile-upload', {
        body: uploadPayload,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        return {
          success: false,
          error: error.message || 'Upload failed'
        };
      }

      console.log('✅ Upload successful:', data);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error('Error uploading to Supabase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load queue from persistent storage
   */
  async loadQueueFromStorage() {
    try {
      console.log('📂 Loading queue from storage...');
      
      const { data } = await Filesystem.readFile({
        path: this.config.queueFileName,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      
      if (data) {
        const queueData = JSON.parse(data);
        
        // Restore queue items
        this.queue.clear();
        for (const [id, item] of Object.entries(queueData.queue || {})) {
          // Convert date strings back to Date objects
          if (item.queuedAt) item.queuedAt = new Date(item.queuedAt);
          if (item.lastAttemptAt) item.lastAttemptAt = new Date(item.lastAttemptAt);
          if (item.completedAt) item.completedAt = new Date(item.completedAt);
          if (item.createdAt) item.createdAt = new Date(item.createdAt);
          if (item.detectedAt) item.detectedAt = new Date(item.detectedAt);
          
          this.queue.set(id, item);
        }
        
        // Restore rate limit tracker
        if (queueData.rateLimitTracker) {
          this.rateLimitTracker = queueData.rateLimitTracker;
        }
        
        console.log(`✅ Loaded ${this.queue.size} items from storage`);
      }
      
    } catch (error) {
      if (error.message && error.message.includes('File does not exist')) {
        console.log('📂 No existing queue file found - starting fresh');
      } else {
        console.error('Error loading queue from storage:', error);
      }
    }
  }

  /**
   * Save queue to persistent storage
   */
  async saveQueueToStorage() {
    try {
      const queueData = {
        queue: Object.fromEntries(this.queue),
        rateLimitTracker: this.rateLimitTracker,
        lastSaved: new Date()
      };
      
      await Filesystem.writeFile({
        path: this.config.queueFileName,
        data: JSON.stringify(queueData, null, 2),
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      
      console.log(`💾 Queue saved to storage (${this.queue.size} items)`);
      
    } catch (error) {
      console.error('Error saving queue to storage:', error);
    }
  }

  /**
   * Clean up old completed/failed uploads
   */
  async cleanupOldUploads() {
    try {
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cleanedCount = 0;
      
      for (const [id, item] of this.queue) {
        const itemAge = now - new Date(item.queuedAt).getTime();
        
        if (itemAge > maxAge && (item.status === 'completed' || item.status === 'failed')) {
          this.queue.delete(id);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old upload records`);
        await this.saveQueueToStorage();
      }
      
    } catch (error) {
      console.error('Error cleaning up old uploads:', error);
    }
  }

  /**
   * Get queue status and statistics
   */
  getStatus() {
    const stats = {
      total: this.queue.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    for (const item of this.queue.values()) {
      stats[item.status] = (stats[item.status] || 0) + 1;
    }
    
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      queueStats: stats,
      rateLimitStatus: {
        currentUploads: this.rateLimitTracker.uploads.length,
        maxUploads: this.rateLimitTracker.maxUploads,
        windowMinutes: this.rateLimitTracker.windowMinutes
      },
      config: this.config
    };
  }

  /**
   * Get queue items for debugging
   */
  getQueueItems(status = null) {
    const items = Array.from(this.queue.values());
    
    if (status) {
      return items.filter(item => item.status === status);
    }
    
    return items;
  }

  /**
   * Retry failed uploads
   */
  async retryFailedUploads() {
    console.log('🔄 Retrying failed uploads...');
    
    let retriedCount = 0;
    for (const item of this.queue.values()) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.error = null;
        retriedCount++;
      }
    }
    
    if (retriedCount > 0) {
      await this.saveQueueToStorage();
      console.log(`✅ ${retriedCount} failed uploads reset for retry`);
      showToast(`${retriedCount} uploads queued for retry`, 'info');
    }
  }

  /**
   * Clear completed uploads from queue
   */
  async clearCompletedUploads() {
    console.log('🧹 Clearing completed uploads...');
    
    let clearedCount = 0;
    for (const [id, item] of this.queue) {
      if (item.status === 'completed') {
        this.queue.delete(id);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      await this.saveQueueToStorage();
      console.log(`✅ ${clearedCount} completed uploads cleared`);
      showToast(`${clearedCount} completed uploads cleared`, 'info');
    }
  }

  /**
   * Clean up and shutdown
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up UploadQueue...');
      
      this.stopQueueProcessing();
      await this.saveQueueToStorage();
      
      this.queue.clear();
      this.isInitialized = false;
      this.supabaseClient = null;
      this.currentUser = null;
      
      console.log('✅ UploadQueue cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up UploadQueue:', error);
    }
  }
}

// Export singleton instance
export const uploadQueue = new UploadQueue();

// Export for remote website integration
export async function initializeUploadQueue(supabaseClient, currentUser) {
  return await uploadQueue.initialize(supabaseClient, currentUser);
}

export function getUploadQueueStatus() {
  return uploadQueue.getStatus();
}

export async function addPhotoToUploadQueue(photoData) {
  return await uploadQueue.addPhotoToQueue(photoData);
}

export function getUploadQueueItems(status = null) {
  return uploadQueue.getQueueItems(status);
}

export async function retryFailedUploads() {
  return await uploadQueue.retryFailedUploads();
}

export async function clearCompletedUploads() {
  return await uploadQueue.clearCompletedUploads();
}