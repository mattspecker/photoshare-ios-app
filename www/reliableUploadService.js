console.log('🔄 Loading reliableUploadService.js...');

// For browser testing, we'll simulate these imports
// In real iOS app, these would be actual Capacitor imports
const Network = window.Capacitor?.Plugins?.Network || {
  getStatus: async () => ({ connected: true, connectionType: 'wifi' }),
  addListener: (event, callback) => ({ remove: () => {} })
};

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
 * ReliableUploadService - Enhanced upload reliability and network handling
 * Ensures photos reliably reach the event for other guests to download
 */
class ReliableUploadService {
  constructor() {
    this.isInitialized = false;
    this.uploadQueue = new Map(); // uploadId -> upload details
    this.activeUploads = new Map(); // uploadId -> upload promise
    this.networkStatus = null;
    this.networkListener = null;
    this.uploadStats = new Map();
    this.retryQueue = [];
    
    // Configuration
    this.config = {
      // Network handling
      network: {
        requiredConnectionTypes: ['wifi', '4g', '5g', 'cellular'],
        minBandwidthMbps: 1.0, // Minimum 1 Mbps for uploads
        timeoutMs: 60000, // 60 second timeout per photo
        heartbeatInterval: 5000, // Check connection every 5 seconds
        adaptiveQuality: true
      },
      
      // Retry mechanism
      retry: {
        maxAttempts: 5,
        baseDelayMs: 2000, // Start with 2 second delay
        maxDelayMs: 30000, // Cap at 30 seconds
        backoffMultiplier: 2, // Exponential backoff
        retryOnNetworkReconnect: true,
        permanentFailureThreshold: 3 // After 3 consecutive failures, mark as permanent
      },
      
      // Upload optimization
      upload: {
        maxConcurrentUploads: 3, // Conservative for reliability
        chunkSize: 1024 * 1024, // 1MB chunks for large photos
        compressionQuality: 0.85, // Good balance of quality vs size
        progressUpdateInterval: 1000, // Update progress every second
        verifyUploadCompletion: true
      },
      
      // Quality adaptation
      qualityAdaptation: {
        wifiQuality: 0.95, // High quality on WiFi
        cellularQuality: 0.80, // Reduced quality on cellular
        lowBandwidthQuality: 0.65, // Further reduced on slow connections
        adaptBasedOnFailures: true
      },
      
      // Error handling
      errorHandling: {
        categorizeErrors: true,
        autoResolveableErrors: ['network', 'timeout', 'server_busy'],
        permanentErrors: ['invalid_file', 'too_large', 'forbidden'],
        logDetailedErrors: true
      }
    };
    
    console.log('📡 ReliableUploadService initialized');
  }

  /**
   * Initialize the reliable upload service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing ReliableUploadService...');
      
      // Get initial network status
      await this.initializeNetworkMonitoring();
      
      // Initialize upload statistics
      this.initializeUploadStats();
      
      // Start network heartbeat
      this.startNetworkHeartbeat();
      
      // Load any pending uploads from storage
      await this.loadPendingUploads();
      
      this.isInitialized = true;
      console.log('✅ ReliableUploadService initialized');
      
      return true;
      
    } catch (error) {
      console.error('Error initializing ReliableUploadService:', error);
      return false;
    }
  }

  /**
   * Initialize network monitoring
   */
  async initializeNetworkMonitoring() {
    try {
      console.log('📡 Setting up network monitoring...');
      
      // Get initial network status
      this.networkStatus = await Network.getStatus();
      console.log(`📶 Initial network: ${this.networkStatus.connectionType}, connected: ${this.networkStatus.connected}`);
      
      // Listen for network changes
      this.networkListener = Network.addListener('networkStatusChange', async (status) => {
        const wasConnected = this.networkStatus?.connected;
        const nowConnected = status.connected;
        
        console.log(`📶 Network changed: ${status.connectionType}, connected: ${status.connected}`);
        
        this.networkStatus = status;
        
        // Handle network reconnection
        if (!wasConnected && nowConnected) {
          console.log('🔄 Network reconnected - resuming uploads...');
          await this.handleNetworkReconnection();
        }
        
        // Handle network disconnection
        if (wasConnected && !nowConnected) {
          console.log('❌ Network disconnected - pausing uploads...');
          this.handleNetworkDisconnection();
        }
        
        // Adapt upload quality based on connection type
        this.adaptUploadQuality(status);
      });
      
      console.log('✅ Network monitoring active');
      
    } catch (error) {
      console.error('Error setting up network monitoring:', error);
    }
  }

  /**
   * Initialize upload statistics tracking
   */
  initializeUploadStats() {
    this.uploadStats.set('totalUploads', 0);
    this.uploadStats.set('successfulUploads', 0);
    this.uploadStats.set('failedUploads', 0);
    this.uploadStats.set('retriedUploads', 0);
    this.uploadStats.set('bytesUploaded', 0);
    this.uploadStats.set('averageUploadTime', 0);
    this.uploadStats.set('networkFailures', 0);
    this.uploadStats.set('serverErrors', 0);
  }

  /**
   * Start network heartbeat to monitor connection quality
   */
  startNetworkHeartbeat() {
    setInterval(async () => {
      if (this.networkStatus?.connected) {
        try {
          // Simple connectivity check
          const startTime = Date.now();
          const response = await this.performConnectivityCheck();
          const latency = Date.now() - startTime;
          
          this.updateNetworkMetrics(response, latency);
        } catch (error) {
          console.log('📶 Network heartbeat failed:', error.message);
          this.uploadStats.set('networkFailures', 
            this.uploadStats.get('networkFailures') + 1);
        }
      }
    }, this.config.network.heartbeatInterval);
  }

  /**
   * Perform simple connectivity check
   */
  async performConnectivityCheck() {
    // Simple connectivity test - in real implementation would ping server
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) { // 95% success rate
          resolve({ status: 'ok', latency: Math.random() * 200 + 50 });
        } else {
          reject(new Error('Connectivity check failed'));
        }
      }, Math.random() * 100 + 50);
    });
  }

  /**
   * Update network quality metrics
   */
  updateNetworkMetrics(response, latency) {
    // Track network quality for adaptive uploads
    const quality = latency < 100 ? 'excellent' : 
                   latency < 300 ? 'good' : 
                   latency < 500 ? 'fair' : 'poor';
    
    console.log(`📊 Network quality: ${quality} (${latency}ms latency)`);
  }

  /**
   * Queue photo for reliable upload
   */
  async queuePhotoUpload(photoData, eventId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('ReliableUploadService not initialized');
    }

    try {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare upload metadata
      const uploadItem = {
        uploadId: uploadId,
        photoData: photoData,
        eventId: eventId,
        options: options,
        
        // Upload state
        status: 'queued',
        attempts: 0,
        maxAttempts: this.config.retry.maxAttempts,
        
        // Timing
        queuedAt: new Date(),
        lastAttemptAt: null,
        completedAt: null,
        
        // Network context
        initialNetworkType: this.networkStatus?.connectionType,
        adaptedQuality: this.getAdaptedQuality(),
        
        // Progress tracking
        progress: 0,
        bytesTransferred: 0,
        totalBytes: photoData.fileSize || 0,
        
        // Error tracking
        errors: [],
        lastError: null,
        isPermanentFailure: false
      };

      // Add to upload queue
      this.uploadQueue.set(uploadId, uploadItem);
      
      console.log(`📤 Photo queued for reliable upload: ${uploadId}`);
      console.log(`   📄 File: ${photoData.filename}`);
      console.log(`   📊 Size: ${(uploadItem.totalBytes / 1024 / 1024).toFixed(1)}MB`);
      console.log(`   📶 Network: ${uploadItem.initialNetworkType}`);
      
      // Start upload if network is available
      if (this.canStartUpload()) {
        await this.startUpload(uploadId);
      } else {
        console.log('⏳ Upload queued - waiting for better network conditions');
        showToast('Photo queued - will upload when network improves', 'info');
      }
      
      return uploadId;
      
    } catch (error) {
      console.error('Error queuing photo upload:', error);
      throw error;
    }
  }

  /**
   * Start upload for queued item
   */
  async startUpload(uploadId) {
    const uploadItem = this.uploadQueue.get(uploadId);
    if (!uploadItem || uploadItem.status === 'uploading' || uploadItem.isPermanentFailure) {
      return;
    }

    try {
      // Check if we can start more uploads
      if (this.activeUploads.size >= this.config.upload.maxConcurrentUploads) {
        console.log('⏳ Upload queue full, waiting for slot...');
        return;
      }

      // Update upload status
      uploadItem.status = 'uploading';
      uploadItem.attempts++;
      uploadItem.lastAttemptAt = new Date();
      
      console.log(`🚀 Starting upload attempt ${uploadItem.attempts}/${uploadItem.maxAttempts}: ${uploadId}`);
      
      // Create upload promise
      const uploadPromise = this.performReliableUpload(uploadItem);
      this.activeUploads.set(uploadId, uploadPromise);
      
      // Handle upload completion
      uploadPromise
        .then(async (result) => {
          await this.handleUploadSuccess(uploadId, result);
        })
        .catch(async (error) => {
          await this.handleUploadFailure(uploadId, error);
        })
        .finally(() => {
          this.activeUploads.delete(uploadId);
          // Try to start next queued upload
          this.processUploadQueue();
        });
      
    } catch (error) {
      console.error('Error starting upload:', error);
      await this.handleUploadFailure(uploadId, error);
    }
  }

  /**
   * Perform the actual reliable upload
   */
  async performReliableUpload(uploadItem) {
    const { uploadId, photoData, eventId, adaptedQuality } = uploadItem;
    
    try {
      console.log(`📤 Uploading ${photoData.filename}...`);
      
      // Prepare photo data with adapted quality
      const processedPhotoData = await this.preparePhotoForUpload(photoData, adaptedQuality);
      
      // Track upload progress
      const progressCallback = (progress, bytesTransferred) => {
        uploadItem.progress = progress;
        uploadItem.bytesTransferred = bytesTransferred;
        this.notifyUploadProgress(uploadId, progress);
      };
      
      // Perform chunked upload with progress tracking
      const uploadResult = await this.performChunkedUpload(
        processedPhotoData, 
        eventId, 
        progressCallback,
        this.config.network.timeoutMs
      );
      
      // Verify upload completion if configured
      if (this.config.upload.verifyUploadCompletion) {
        await this.verifyUploadCompletion(uploadResult);
      }
      
      return uploadResult;
      
    } catch (error) {
      // Categorize the error for better handling
      const categorizedError = this.categorizeUploadError(error);
      console.error(`Upload error (${categorizedError.category}):`, categorizedError.message);
      throw categorizedError;
    }
  }

  /**
   * Prepare photo data with quality adaptation
   */
  async preparePhotoForUpload(photoData, quality) {
    try {
      // If quality is different from original, we'd compress here
      // For now, simulate the process
      const originalSize = photoData.fileSize || 0;
      const adaptedSize = Math.round(originalSize * quality);
      
      return {
        ...photoData,
        adaptedQuality: quality,
        adaptedSize: adaptedSize,
        compressionApplied: quality < 1.0
      };
      
    } catch (error) {
      console.error('Error preparing photo for upload:', error);
      throw error;
    }
  }

  /**
   * Perform chunked upload with progress tracking
   */
  async performChunkedUpload(photoData, eventId, progressCallback, timeoutMs) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let bytesTransferred = 0;
      const totalBytes = photoData.adaptedSize || photoData.fileSize || 0;
      
      // Simulate chunked upload with realistic progress
      const chunkSize = this.config.upload.chunkSize;
      const totalChunks = Math.ceil(totalBytes / chunkSize);
      let currentChunk = 0;
      
      const uploadChunk = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Upload timeout'));
          return;
        }
        
        if (currentChunk >= totalChunks) {
          // Upload complete
          const uploadTime = Date.now() - startTime;
          resolve({
            success: true,
            uploadId: `server_${Date.now()}`,
            bytesUploaded: totalBytes,
            uploadTime: uploadTime,
            averageSpeed: (totalBytes / uploadTime) * 1000, // bytes per second
            eventId: eventId,
            photoData: photoData
          });
          return;
        }
        
        // Simulate chunk upload time based on network quality
        const networkDelay = this.getNetworkDelay();
        
        setTimeout(() => {
          currentChunk++;
          bytesTransferred = Math.min(currentChunk * chunkSize, totalBytes);
          const progress = (bytesTransferred / totalBytes) * 100;
          
          progressCallback(progress, bytesTransferred);
          
          // Simulate occasional network hiccups
          if (Math.random() < 0.03) { // 3% chance of temporary failure
            reject(new Error('Network hiccup during upload'));
            return;
          }
          
          uploadChunk();
        }, networkDelay);
      };
      
      uploadChunk();
    });
  }

  /**
   * Get network delay based on current connection quality
   */
  getNetworkDelay() {
    const baseDelay = 100; // 100ms base delay per chunk
    
    switch (this.networkStatus?.connectionType) {
      case 'wifi': return baseDelay + Math.random() * 50;
      case '5g': return baseDelay + Math.random() * 100;
      case '4g': return baseDelay + Math.random() * 200;
      case 'cellular': return baseDelay + Math.random() * 400;
      default: return baseDelay + Math.random() * 300;
    }
  }

  /**
   * Verify upload completion
   */
  async verifyUploadCompletion(uploadResult) {
    try {
      // In real implementation, would verify with server
      console.log(`🔍 Verifying upload completion: ${uploadResult.uploadId}`);
      
      // Simulate verification
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (Math.random() > 0.02) { // 98% verification success
        console.log('✅ Upload verification successful');
        return true;
      } else {
        throw new Error('Upload verification failed - file may be corrupted');
      }
      
    } catch (error) {
      console.error('Upload verification failed:', error);
      throw error;
    }
  }

  /**
   * Handle successful upload
   */
  async handleUploadSuccess(uploadId, result) {
    const uploadItem = this.uploadQueue.get(uploadId);
    if (!uploadItem) return;

    try {
      // Update upload item
      uploadItem.status = 'completed';
      uploadItem.completedAt = new Date();
      uploadItem.progress = 100;
      uploadItem.result = result;
      
      // Update statistics
      this.uploadStats.set('successfulUploads', 
        this.uploadStats.get('successfulUploads') + 1);
      this.uploadStats.set('bytesUploaded', 
        this.uploadStats.get('bytesUploaded') + (result.bytesUploaded || 0));
      
      // Calculate average upload time
      this.updateAverageUploadTime(result.uploadTime);
      
      const uploadTime = (result.uploadTime / 1000).toFixed(1);
      const speed = ((result.bytesUploaded / 1024 / 1024) / (result.uploadTime / 1000)).toFixed(1);
      
      console.log(`✅ Upload completed successfully: ${uploadId}`);
      console.log(`   ⏱️ Time: ${uploadTime}s`);
      console.log(`   ⚡ Speed: ${speed} MB/s`);
      console.log(`   📊 Attempts: ${uploadItem.attempts}`);
      
      showToast(`Photo uploaded successfully: ${uploadItem.photoData.filename}`, 'success');
      
      // Notify other guests that a new photo is available
      await this.notifyGuestsOfNewPhoto(uploadItem, result);
      
      // Clean up completed upload after some time
      setTimeout(() => {
        this.uploadQueue.delete(uploadId);
      }, 300000); // Keep for 5 minutes for status checking
      
    } catch (error) {
      console.error('Error handling upload success:', error);
    }
  }

  /**
   * Handle upload failure
   */
  async handleUploadFailure(uploadId, error) {
    const uploadItem = this.uploadQueue.get(uploadId);
    if (!uploadItem) return;

    try {
      uploadItem.status = 'failed';
      uploadItem.lastError = error;
      uploadItem.errors.push({
        error: error.message,
        timestamp: new Date(),
        attempt: uploadItem.attempts,
        networkType: this.networkStatus?.connectionType
      });
      
      console.log(`❌ Upload failed: ${uploadId} (attempt ${uploadItem.attempts}/${uploadItem.maxAttempts})`);
      console.log(`   Error: ${error.message}`);
      
      // Determine if this is a permanent failure
      const isPermError = this.isPermanentError(error);
      const maxAttemptsReached = uploadItem.attempts >= uploadItem.maxAttempts;
      
      if (isPermError || maxAttemptsReached) {
        uploadItem.isPermanentFailure = true;
        uploadItem.status = 'permanently_failed';
        
        this.uploadStats.set('failedUploads', 
          this.uploadStats.get('failedUploads') + 1);
        
        console.log(`💀 Upload permanently failed: ${uploadId}`);
        showToast(`Failed to upload ${uploadItem.photoData.filename}: ${error.message}`, 'error');
        
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(uploadItem.attempts);
        console.log(`🔄 Scheduling retry in ${retryDelay}ms`);
        
        setTimeout(() => {
          if (!uploadItem.isPermanentFailure) {
            this.startUpload(uploadId);
          }
        }, retryDelay);
        
        this.uploadStats.set('retriedUploads', 
          this.uploadStats.get('retriedUploads') + 1);
      }
      
    } catch (error) {
      console.error('Error handling upload failure:', error);
    }
  }

  /**
   * Categorize upload errors for better handling
   */
  categorizeUploadError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return { ...error, category: 'network' };
    } else if (message.includes('timeout')) {
      return { ...error, category: 'timeout' };
    } else if (message.includes('server') || message.includes('500')) {
      return { ...error, category: 'server_error' };
    } else if (message.includes('too large') || message.includes('file size')) {
      return { ...error, category: 'file_too_large' };
    } else if (message.includes('invalid') || message.includes('format')) {
      return { ...error, category: 'invalid_file' };
    } else if (message.includes('forbidden') || message.includes('unauthorized')) {
      return { ...error, category: 'forbidden' };
    } else {
      return { ...error, category: 'unknown' };
    }
  }

  /**
   * Check if error is permanent (no point in retrying)
   */
  isPermanentError(error) {
    return this.config.errorHandling.permanentErrors.includes(error.category);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    const baseDelay = this.config.retry.baseDelayMs;
    const multiplier = this.config.retry.backoffMultiplier;
    const maxDelay = this.config.retry.maxDelayMs;
    
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
    
    // Add some jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    
    return delay + jitter;
  }

  /**
   * Check if we can start a new upload
   */
  canStartUpload() {
    if (!this.networkStatus?.connected) {
      return false;
    }
    
    // Check if connection type is acceptable
    if (!this.config.network.requiredConnectionTypes.includes(this.networkStatus.connectionType)) {
      return false;
    }
    
    // Check if we're at concurrent upload limit
    if (this.activeUploads.size >= this.config.upload.maxConcurrentUploads) {
      return false;
    }
    
    return true;
  }

  /**
   * Get adapted quality based on network conditions
   */
  getAdaptedQuality() {
    if (!this.config.network.adaptiveQuality) {
      return 1.0; // No adaptation
    }
    
    const connectionType = this.networkStatus?.connectionType;
    
    switch (connectionType) {
      case 'wifi':
        return this.config.qualityAdaptation.wifiQuality;
      case '5g':
        return this.config.qualityAdaptation.wifiQuality; // Treat 5G like WiFi
      case '4g':
      case 'cellular':
        return this.config.qualityAdaptation.cellularQuality;
      default:
        return this.config.qualityAdaptation.lowBandwidthQuality;
    }
  }

  /**
   * Adapt upload quality based on network status
   */
  adaptUploadQuality(networkStatus) {
    const newQuality = this.getAdaptedQuality();
    
    // Update quality for pending uploads
    for (const [uploadId, uploadItem] of this.uploadQueue) {
      if (uploadItem.status === 'queued') {
        uploadItem.adaptedQuality = newQuality;
        console.log(`📊 Adapted quality for ${uploadId}: ${(newQuality * 100).toFixed(0)}%`);
      }
    }
  }

  /**
   * Handle network reconnection
   */
  async handleNetworkReconnection() {
    if (!this.isInitialized) return;
    
    try {
      console.log('🔄 Handling network reconnection...');
      
      // Resume queued uploads
      const queuedUploads = Array.from(this.uploadQueue.values())
        .filter(item => item.status === 'queued' && !item.isPermanentFailure);
      
      if (queuedUploads.length > 0) {
        console.log(`🚀 Resuming ${queuedUploads.length} queued uploads`);
        
        // Start uploads with a slight delay to let network stabilize
        setTimeout(() => {
          this.processUploadQueue();
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error handling network reconnection:', error);
    }
  }

  /**
   * Handle network disconnection
   */
  handleNetworkDisconnection() {
    console.log('📴 Network disconnected - pausing active uploads');
    
    // Mark active uploads as queued to retry when network returns
    for (const [uploadId, uploadItem] of this.uploadQueue) {
      if (uploadItem.status === 'uploading') {
        uploadItem.status = 'queued';
        console.log(`⏸️ Paused upload: ${uploadId}`);
      }
    }
    
    showToast('Network disconnected - uploads will resume when connection returns', 'warning');
  }

  /**
   * Process upload queue to start pending uploads
   */
  processUploadQueue() {
    if (!this.canStartUpload()) return;
    
    // Find queued uploads
    const queuedUploads = Array.from(this.uploadQueue.entries())
      .filter(([_, item]) => item.status === 'queued' && !item.isPermanentFailure)
      .sort(([_, a], [__, b]) => a.queuedAt.getTime() - b.queuedAt.getTime()); // FIFO
    
    // Start uploads up to concurrent limit
    const availableSlots = this.config.upload.maxConcurrentUploads - this.activeUploads.size;
    const uploadsToStart = queuedUploads.slice(0, availableSlots);
    
    for (const [uploadId, _] of uploadsToStart) {
      this.startUpload(uploadId);
    }
  }

  /**
   * Notify upload progress to listeners
   */
  notifyUploadProgress(uploadId, progress) {
    // Emit progress event - could be extended to notify subscribers
    console.log(`📊 Upload progress ${uploadId}: ${progress.toFixed(1)}%`);
  }

  /**
   * Notify guests of new photo upload
   */
  async notifyGuestsOfNewPhoto(uploadItem, result) {
    try {
      // In real implementation, would send push notifications or websocket events
      // to other event guests that a new photo is available
      console.log('📬 Notifying guests of new photo upload');
      console.log(`   📸 Photo: ${uploadItem.photoData.filename}`);
      console.log(`   🎉 Event: ${uploadItem.eventId}`);
      
      // Simulate notification delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Error notifying guests:', error);
    }
  }

  /**
   * Update average upload time statistic
   */
  updateAverageUploadTime(uploadTime) {
    const currentAvg = this.uploadStats.get('averageUploadTime');
    const totalUploads = this.uploadStats.get('successfulUploads');
    
    if (totalUploads === 1) {
      this.uploadStats.set('averageUploadTime', uploadTime);
    } else {
      const newAvg = ((currentAvg * (totalUploads - 1)) + uploadTime) / totalUploads;
      this.uploadStats.set('averageUploadTime', newAvg);
    }
  }

  /**
   * Load pending uploads from storage (simulate persistence)
   */
  async loadPendingUploads() {
    // In real implementation, would load from localStorage or secure storage
    console.log('📂 Loading pending uploads from storage...');
    // For now, no pending uploads on fresh start
  }

  /**
   * Get current upload status summary
   */
  getUploadStatus() {
    const queuedCount = Array.from(this.uploadQueue.values())
      .filter(item => item.status === 'queued').length;
    
    const uploadingCount = this.activeUploads.size;
    
    const failedCount = Array.from(this.uploadQueue.values())
      .filter(item => item.status === 'permanently_failed').length;
    
    return {
      isOnline: this.networkStatus?.connected || false,
      networkType: this.networkStatus?.connectionType || 'unknown',
      queuedUploads: queuedCount,
      activeUploads: uploadingCount,
      failedUploads: failedCount,
      totalUploads: this.uploadStats.get('totalUploads'),
      successfulUploads: this.uploadStats.get('successfulUploads'),
      successRate: this.calculateSuccessRate(),
      averageUploadTime: this.uploadStats.get('averageUploadTime'),
      adaptiveQuality: this.getAdaptedQuality()
    };
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate() {
    const total = this.uploadStats.get('totalUploads');
    const successful = this.uploadStats.get('successfulUploads');
    return total > 0 ? (successful / total) * 100 : 100;
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats() {
    return {
      uploadStats: Object.fromEntries(this.uploadStats),
      networkStatus: this.networkStatus,
      config: this.config,
      activeUploads: this.activeUploads.size,
      queueSize: this.uploadQueue.size,
      uploadStatus: this.getUploadStatus()
    };
  }

  /**
   * Test reliable upload functionality
   */
  async testReliableUpload() {
    try {
      console.log('🧪 Testing reliable upload service...');
      
      if (!this.isInitialized) {
        throw new Error('ReliableUploadService not initialized');
      }

      // Create test photo
      const testPhoto = {
        id: 'test_reliable_upload',
        filename: 'test_reliable.jpg',
        fileSize: 2400000,
        mimeType: 'image/jpeg',
        dimensions: { width: 4032, height: 3024 }
      };

      // Test upload
      const uploadId = await this.queuePhotoUpload(testPhoto, 'test_event');
      
      console.log('✅ Reliable upload test initiated');
      console.log(`📊 Upload ID: ${uploadId}`);
      
      showToast('Reliable upload test started', 'success');
      return uploadId;
      
    } catch (error) {
      console.error('Error testing reliable upload:', error);
      showToast('Reliable upload test failed: ' + error.message, 'error');
      throw error;
    }
  }

  /**
   * Clean up service
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up ReliableUploadService...');
      
      // Remove network listener
      if (this.networkListener) {
        this.networkListener.remove();
        this.networkListener = null;
      }
      
      // Clear upload queue
      this.uploadQueue.clear();
      this.activeUploads.clear();
      this.retryQueue = [];
      
      // Reset stats
      this.uploadStats.clear();
      
      this.isInitialized = false;
      
      console.log('✅ ReliableUploadService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up ReliableUploadService:', error);
    }
  }
}

// Export singleton instance to global window
console.log('Creating ReliableUploadService...');
try {
  window.reliableUploadService = new ReliableUploadService();
  console.log('ReliableUploadService created successfully');
} catch (error) {
  console.error('Error creating ReliableUploadService:', error);
  window.reliableUploadService = null;
}

// Export convenience functions to global window
window.initializeReliableUpload = async function() {
  return await window.reliableUploadService.initialize();
}

window.queueReliablePhotoUpload = async function(photoData, eventId, options = {}) {
  return await window.reliableUploadService.queuePhotoUpload(photoData, eventId, options);
}

window.getReliableUploadStatus = function() {
  return window.reliableUploadService.getUploadStatus();
}

window.getReliableUploadStats = function() {
  return window.reliableUploadService.getDetailedStats();
}

window.testReliableUpload = async function() {
  return await window.reliableUploadService.testReliableUpload();
}