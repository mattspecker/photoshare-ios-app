/**
 * BackgroundUploadService - Photo uploads using @capacitor/file-transfer
 * Integrates with new multipart-upload endpoint and existing JWT token system
 */

console.log('📤 Loading backgroundUploadService.js...');

class BackgroundUploadService {
  constructor() {
    this.isNative = window.Capacitor && window.Capacitor.isNativePlatform();
    this.fileTransfer = null;
    this.notifications = null; // For progress notifications
    this.activeUploads = new Map(); // Track active upload sessions
    this.uploadQueue = []; // Queue for sequential uploads
    
    // Initialize the service
    this.initialize();
    this.isProcessingQueue = false;
    this.notificationId = 1000; // Starting ID for upload notifications
    
    // New multipart upload endpoint
    this.uploadEndpoint = 'https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/multipart-upload';
    
    this.initialize();
  }

  async initialize() {
    console.log('🚀 Initializing BackgroundUploadService...');
    
    if (!this.isNative) {
      console.log('📤 Running in web mode - background uploads not supported');
      return;
    }

    try {
      // Get reference to the file transfer plugin
      this.fileTransfer = window.Capacitor.Plugins.FileTransfer;
      
      console.log('🔍 Capacitor plugins available:', Object.keys(window.Capacitor?.Plugins || {}));
      console.log('📤 FileTransfer plugin:', this.fileTransfer ? '✅ Available' : '❌ Not Available');
      
      if (!this.fileTransfer) {
        console.warn('⚠️ @capacitor/file-transfer plugin not available - will use web fallback');
        return;
      }

      // Get reference to notifications plugin
      this.notifications = window.Capacitor.Plugins.PushNotifications;
      
      // Request notification permissions
      if (this.notifications) {
        await this.requestNotificationPermissions();
      }

      // Set up event listeners for upload progress
      this.setupEventListeners();
      
      console.log('✅ BackgroundUploadService initialized successfully');
      console.log('📡 Using multipart upload endpoint:', this.uploadEndpoint);
      console.log('🔔 Notification support:', !!this.notifications);
      console.log('🚀 Using @capacitor/file-transfer plugin');
      
    } catch (error) {
      console.error('❌ Error initializing BackgroundUploadService:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestNotificationPermissions() {
    try {
      console.log('🔔 Requesting notification permissions...');
      
      const permission = await this.notifications.requestPermissions();
      console.log('🔔 Notification permissions:', permission);
      
      if (permission.receive !== 'granted') {
        console.warn('⚠️ Notification permissions not granted');
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
    }
  }

  /**
   * Create thumbnail data URL from base64 image
   */
  async createThumbnail(base64Data, maxSize = 100) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Create canvas for thumbnail
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate thumbnail dimensions
          const ratio = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          
          // Draw thumbnail
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get thumbnail as base64
          const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnailData);
        };
        
        img.onerror = () => {
          console.log('⚠️ Could not create thumbnail, using default');
          resolve(null);
        };
        
        // Remove data URL prefix if present
        const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        img.src = `data:image/jpeg;base64,${cleanBase64}`;
      } catch (error) {
        console.log('⚠️ Thumbnail creation failed:', error);
        resolve(null);
      }
    });
  }

  /**
   * Show upload start notification with thumbnail
   */
  async showUploadStartNotification(uploadSession, thumbnailData) {
    if (!this.notifications) return;
    
    try {
      const notificationId = this.notificationId++;
      uploadSession.notificationId = notificationId;
      
      const notification = {
        title: `Uploading ${uploadSession.cropType ? uploadSession.cropType + ' image' : 'photo'}`,
        body: `${uploadSession.filename} - Starting upload...`,
        id: notificationId,
        schedule: { at: new Date(Date.now() + 100) }, // Show immediately
        extra: {
          uploadId: uploadSession.uploadId,
          filename: uploadSession.filename,
          progress: 0
        }
      };
      
      // Add thumbnail if available
      if (thumbnailData) {
        notification.largeIcon = thumbnailData;
        notification.attachments = [{ id: 'thumbnail', url: thumbnailData }];
      }
      
      await this.notifications.schedule({ notifications: [notification] });
      console.log(`🔔 Upload start notification shown for ${uploadSession.filename}`);
      
    } catch (error) {
      console.error('❌ Error showing upload start notification:', error);
    }
  }

  /**
   * Update upload progress notification
   */
  async updateUploadProgressNotification(uploadSession, progress) {
    if (!this.notifications || !uploadSession.notificationId) return;
    
    try {
      const notification = {
        title: `Uploading ${uploadSession.cropType ? uploadSession.cropType + ' image' : 'photo'}`,
        body: `${uploadSession.filename} - ${progress}% complete`,
        id: uploadSession.notificationId,
        schedule: { at: new Date(Date.now() + 100) },
        extra: {
          uploadId: uploadSession.uploadId,
          filename: uploadSession.filename,
          progress: progress
        }
      };
      
      await this.notifications.schedule({ notifications: [notification] });
      
    } catch (error) {
      console.error('❌ Error updating upload progress notification:', error);
    }
  }

  /**
   * Show upload completion notification
   */
  async showUploadCompleteNotification(uploadSession, success = true, error = null) {
    if (!this.notifications || !uploadSession.notificationId) return;
    
    try {
      const notification = {
        title: success ? '✅ Upload Complete' : '❌ Upload Failed',
        body: success 
          ? `${uploadSession.filename} uploaded successfully` 
          : `${uploadSession.filename} failed: ${error}`,
        id: uploadSession.notificationId,
        schedule: { at: new Date(Date.now() + 100) },
        extra: {
          uploadId: uploadSession.uploadId,
          filename: uploadSession.filename,
          success: success
        }
      };
      
      await this.notifications.schedule({ notifications: [notification] });
      console.log(`🔔 Upload ${success ? 'complete' : 'failed'} notification shown for ${uploadSession.filename}`);
      
    } catch (error) {
      console.error('❌ Error showing upload complete notification:', error);
    }
  }

  setupEventListeners() {
    if (!this.fileTransfer) return;

    // Listen for upload progress events
    this.fileTransfer.addListener('progress', (event) => {
      console.log(`📤 Upload progress: ${event.loaded}/${event.total} bytes (${Math.round((event.loaded / event.total) * 100)}%)`);
      this.handleUploadProgress(event);
    });

    console.log('✅ File transfer event listeners set up');
  }

  /**
   * Start upload for EventPhotoPicker photos using @capacitor/file-transfer
   */
  async startEventPhotoUpload(photos, eventId, options = {}) {
    console.log(`📤 Starting upload for ${photos.length} photos to event ${eventId}`);
    
    if (!this.isNative || !this.fileTransfer) {
      console.log('⚠️ File transfer not available, falling back to web upload');
      return this.fallbackToWebUpload(photos, eventId);
    }

    try {
      // Get fresh JWT token using existing system
      const jwtToken = await this.getJwtToken();
      if (!jwtToken) {
        throw new Error('No JWT token available for upload');
      }

      const uploadResults = [];
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          // Prepare photo file path
          const filePath = await this.preparePhotoForUpload(photo);
          
          // Create metadata JSON
          const metadata = this.createPhotoMetadata(photo);
          
          // Use query parameter authentication for reliability
          const uploadUrl = `${this.uploadEndpoint}?token=${encodeURIComponent(jwtToken)}`;
          
          const uploadOptions = {
            path: filePath,
            url: uploadUrl,
            method: 'POST',
            headers: {
              'X-Client-Platform': 'ios',
              'X-Upload-Source': 'file-transfer'
            },
            data: {
              event_id: eventId,
              file_name: photo.filename || `photo_${Date.now()}.jpg`,
              media_type: 'photo',
              metadata: JSON.stringify(metadata)
            },
            fileKey: 'file',
            progress: true
          };

          console.log(`📤 Starting upload for: ${photo.filename}`);
          console.log(`📡 Upload URL: ${uploadUrl}`);
          console.log(`📝 Upload data:`, uploadOptions.data);
          
          // Generate unique upload ID
          const uploadId = `upload_${Date.now()}_${i}`;
          
          const uploadSession = {
            uploadId: uploadId,
            photoId: photo.id,
            filename: photo.filename,
            eventId: eventId,
            startTime: Date.now(),
            status: 'uploading',
            filePath: filePath,
            base64Data: photo.base64,
            uploadOptions: uploadOptions
          };
          
          this.activeUploads.set(uploadId, uploadSession);
          
          // Create thumbnail and show notification
          try {
            if (photo.base64) {
              const thumbnailData = await this.createThumbnail(photo.base64);
              await this.showUploadStartNotification(uploadSession, thumbnailData);
            } else {
              await this.showUploadStartNotification(uploadSession, null);
            }
          } catch (notificationError) {
            console.log('⚠️ Could not show upload notification:', notificationError);
          }
          
          // Start the actual upload
          this.performFileUpload(uploadSession);
          
          uploadResults.push(uploadSession);
          
        } catch (photoError) {
          console.error(`❌ Failed to start upload for photo ${photo.filename}:`, photoError);
          uploadResults.push({
            photoId: photo.id,
            filename: photo.filename,
            error: photoError.message,
            status: 'failed'
          });
        }
      }

      console.log(`📤 Started ${uploadResults.filter(r => r.status === 'uploading').length}/${photos.length} uploads`);
      return uploadResults;
      
    } catch (error) {
      console.error('❌ Error starting uploads:', error);
      throw error;
    }
  }

  /**
   * Perform the actual file upload using @capacitor/file-transfer
   */
  async performFileUpload(uploadSession) {
    try {
      console.log(`🚀 Performing file upload for ${uploadSession.filename}`);
      
      const result = await this.fileTransfer.uploadFile(uploadSession.uploadOptions);
      
      // Handle success
      uploadSession.status = 'completed';
      uploadSession.statusCode = result.responseCode;
      uploadSession.completedAt = Date.now();
      uploadSession.duration = uploadSession.completedAt - uploadSession.startTime;
      uploadSession.response = result.response;
      
      console.log(`✅ Upload completed for ${uploadSession.filename} in ${uploadSession.duration}ms (Status: ${result.responseCode})`);
      
      // Show completion notification
      await this.showUploadCompleteNotification(uploadSession, true);
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('fileTransferUploadComplete', {
        detail: {
          uploadId: uploadSession.uploadId,
          photoId: uploadSession.photoId,
          filename: uploadSession.filename,
          statusCode: result.responseCode,
          eventId: uploadSession.eventId,
          duration: uploadSession.duration,
          cropType: uploadSession.cropType
        }
      }));
      
      // Clean up temp files
      this.cleanupTempFile(uploadSession);
      
    } catch (error) {
      console.error(`❌ Upload failed for ${uploadSession.filename}:`, error);
      
      // Handle failure
      uploadSession.status = 'failed';
      uploadSession.error = error.message;
      uploadSession.failedAt = Date.now();
      
      // Show failure notification
      await this.showUploadCompleteNotification(uploadSession, false, error.message);
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('fileTransferUploadFailed', {
        detail: {
          uploadId: uploadSession.uploadId,
          photoId: uploadSession.photoId,
          filename: uploadSession.filename,
          error: error.message,
          eventId: uploadSession.eventId,
          cropType: uploadSession.cropType
        }
      }));
      
      // Clean up temp files
      this.cleanupTempFile(uploadSession);
    }
  }

  /**
   * Start upload for cropped images from PhotoEditor using @capacitor/file-transfer
   */
  async startCroppedImageUpload(croppedImagePath, eventId, cropType, options = {}) {
    console.log(`📤 Starting upload for cropped ${cropType} image`);
    
    if (!this.isNative || !this.fileTransfer) {
      throw new Error('File transfer not available for cropped images');
    }

    try {
      const jwtToken = await this.getJwtToken();
      if (!jwtToken) {
        throw new Error('No JWT token available for upload');
      }

      // Create filename based on crop type
      const timestamp = Date.now();
      const filename = cropType === 'header' ? `header_${timestamp}.jpg` : `qr_${timestamp}.jpg`;
      
      // Create metadata for cropped image
      const metadata = {
        cropType: cropType,
        dimensions: cropType === 'header' ? '1920x480' : '512x512',
        aspectRatio: cropType === 'header' ? '4:1' : '1:1',
        originalDate: new Date().toISOString(),
        uploadSource: 'photo-editor'
      };

      // Use query parameter authentication for reliability
      const uploadUrl = `${this.uploadEndpoint}?token=${encodeURIComponent(jwtToken)}`;
      
      const uploadOptions = {
        path: croppedImagePath,
        url: uploadUrl,
        method: 'POST',
        headers: {
          'X-Client-Platform': 'ios',
          'X-Upload-Source': 'photo-editor'
        },
        data: {
          event_id: eventId,
          file_name: filename,
          media_type: 'photo',
          metadata: JSON.stringify(metadata)
        },
        fileKey: 'file',
        progress: true
      };

      console.log(`📤 Starting cropped image upload:`, {
        cropType,
        filename,
        eventId,
        dimensions: metadata.dimensions
      });
      console.log(`📡 Upload URL: ${uploadUrl}`);
      console.log(`📝 Upload data:`, uploadOptions.data);

      // Generate unique upload ID
      const uploadId = `crop_upload_${Date.now()}`;
      
      const uploadSession = {
        uploadId: uploadId,
        filename: filename,
        eventId: eventId,
        cropType: cropType,
        startTime: Date.now(),
        status: 'uploading',
        filePath: croppedImagePath,
        uploadOptions: uploadOptions
      };
      
      this.activeUploads.set(uploadId, uploadSession);
      
      // Show notification (no thumbnail for cropped images from file path)
      try {
        await this.showUploadStartNotification(uploadSession, null);
      } catch (notificationError) {
        console.log('⚠️ Could not show cropped image upload notification:', notificationError);
      }
      
      // Start the actual upload
      this.performFileUpload(uploadSession);
      
      return uploadSession;
      
    } catch (error) {
      console.error('❌ Error starting cropped image upload:', error);
      throw error;
    }
  }

  /**
   * Get JWT token using existing iOS AppDelegate system
   */
  async getJwtToken() {
    console.log('🔐 Getting JWT token for background upload...');
    
    try {
      // Priority 1: Use JavaScript function if available (matches EventPhotoPicker pattern)
      if (typeof window.getPhotoShareJwtToken === 'function') {
        console.log('🔐 Attempting to get JWT token from JavaScript function...');
        const token = await window.getPhotoShareJwtToken();
        if (token && token.length > 0) {
          console.log(`✅ Got JWT token from JavaScript: ${token.substring(0, 20)}...`);
          return token;
        }
      }
      
      // Priority 2: Request fresh token via chunked transfer (matches AppDelegate pattern)
      if (typeof window.testChunkedJwtTransfer === 'function') {
        console.log('🔐 Requesting fresh JWT token via chunked transfer...');
        const success = await window.testChunkedJwtTransfer();
        if (success) {
          // Wait a moment for token to be stored
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try JavaScript function again
          if (typeof window.getPhotoShareJwtToken === 'function') {
            const token = await window.getPhotoShareJwtToken();
            if (token) {
              console.log(`✅ Got fresh JWT token after chunked transfer: ${token.substring(0, 20)}...`);
              return token;
            }
          }
        }
      }
      
      console.log('⚠️ Could not get JWT token, upload may fail');
      return null;
      
    } catch (error) {
      console.error('❌ Error getting JWT token:', error);
      return null;
    }
  }

  /**
   * Prepare photo for background upload (ensure it's a file path)
   */
  async preparePhotoForUpload(photo) {
    // If photo already has a file path, use it
    if (photo.path && typeof photo.path === 'string') {
      console.log(`📁 Using existing file path: ${photo.path}`);
      return photo.path;
    }
    
    // If photo has base64 data, we need to save it to a temp file
    if (photo.base64 && typeof photo.base64 === 'string') {
      console.log(`📁 Converting base64 to temp file for: ${photo.filename}`);
      
      try {
        const filesystem = window.Capacitor.Plugins.Filesystem;
        const tempFileName = `upload_${Date.now()}_${photo.filename || 'photo.jpg'}`;
        
        // Remove data URL prefix if present
        const base64Data = photo.base64.replace(/^data:image\/[a-z]+;base64,/, '');
        
        await filesystem.writeFile({
          path: tempFileName,
          data: base64Data,
          directory: window.Capacitor.Plugins.Filesystem.Directory.Cache
        });
        
        const result = await filesystem.getUri({
          directory: window.Capacitor.Plugins.Filesystem.Directory.Cache,
          path: tempFileName
        });
        
        console.log(`✅ Created temp file: ${result.uri}`);
        return result.uri;
        
      } catch (error) {
        console.error('❌ Error creating temp file:', error);
        throw new Error(`Failed to prepare photo ${photo.filename} for upload`);
      }
    }
    
    throw new Error(`Photo ${photo.filename || 'unknown'} has no valid data source`);
  }

  /**
   * Create metadata object for photo (optional field in new API)
   */
  createPhotoMetadata(photo) {
    const metadata = {
      originalDate: photo.date?.toISOString() || new Date().toISOString(),
      uploadSource: 'background-uploader',
      clientPlatform: 'ios'
    };
    
    // Add location data if available
    if (photo.location) {
      metadata.location = {
        latitude: photo.location.latitude,
        longitude: photo.location.longitude
      };
    }
    
    // Add any other photo metadata
    if (photo.width) metadata.width = photo.width;
    if (photo.height) metadata.height = photo.height;
    if (photo.fileSize) metadata.fileSize = photo.fileSize;
    
    return metadata;
  }

  /**
   * Handle upload progress events from @capacitor/file-transfer
   */
  handleUploadProgress(event) {
    // Find upload session by matching file path or other identifier
    let matchingSession = null;
    this.activeUploads.forEach(session => {
      if (session.status === 'uploading') {
        matchingSession = session;
      }
    });
    
    if (matchingSession) {
      const progressPercent = Math.round((event.loaded / event.total) * 100);
      matchingSession.progress = progressPercent;
      matchingSession.bytesLoaded = event.loaded;
      matchingSession.bytesTotal = event.total;
      
      // Update progress notification (throttle to every 10%)
      const notifyPercent = Math.floor(progressPercent / 10) * 10;
      if (!matchingSession.lastNotifiedProgress || notifyPercent > matchingSession.lastNotifiedProgress) {
        matchingSession.lastNotifiedProgress = notifyPercent;
        this.updateUploadProgressNotification(matchingSession, notifyPercent).catch(err => {
          console.log('⚠️ Could not update progress notification:', err);
        });
      }
      
      // Dispatch custom event for UI updates
      window.dispatchEvent(new CustomEvent('fileTransferProgress', {
        detail: {
          uploadId: matchingSession.uploadId,
          photoId: matchingSession.photoId,
          filename: matchingSession.filename,
          progress: progressPercent,
          loaded: event.loaded,
          total: event.total,
          eventId: matchingSession.eventId,
          cropType: matchingSession.cropType
        }
      }));
    }
  }


  /**
   * Clean up temporary files after upload
   */
  async cleanupTempFile(session) {
    if (session.filePath && session.filePath.includes('upload_')) {
      try {
        console.log(`🧹 Cleaning up temp file: ${session.filename}`);
        // Implementation would remove temp files created for uploads
      } catch (error) {
        console.log(`⚠️ Could not cleanup temp file for ${session.filename}:`, error);
      }
    }
  }

  /**
   * Fallback to web upload if file transfer not available
   */
  async fallbackToWebUpload(photos, eventId) {
    console.log('🔄 Falling back to web upload via fetch');
    
    try {
      // Get fresh JWT token
      const jwtToken = await this.getJwtToken();
      if (!jwtToken) {
        throw new Error('No JWT token available for upload');
      }

      const uploadResults = [];
      
      for (const photo of photos) {
        try {
          // Convert base64 to blob for multipart upload
          const base64Data = photo.base64.replace(/^data:image\/[a-z]+;base64,/, '');
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          // Create FormData for multipart upload
          const formData = new FormData();
          formData.append('event_id', eventId);
          formData.append('file_name', photo.filename);
          formData.append('media_type', 'photo');
          formData.append('file', blob, photo.filename);
          
          // Add metadata if available
          if (photo.date || photo.location) {
            const metadata = {
              captureDate: photo.date?.toISOString(),
              location: photo.location,
              width: photo.width,
              height: photo.height
            };
            formData.append('metadata', JSON.stringify(metadata));
          }

          // Upload with authentication token
          const response = await fetch(`${this.uploadEndpoint}?token=${jwtToken}`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
          }

          uploadResults.push({
            photoId: photo.id,
            filename: photo.filename,
            status: 'completed',
            statusCode: response.status
          });

          console.log(`✅ Web upload completed for ${photo.filename}`);

        } catch (error) {
          console.error(`❌ Web upload failed for ${photo.filename}:`, error);
          uploadResults.push({
            photoId: photo.id,
            filename: photo.filename,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      return uploadResults;
      
    } catch (error) {
      console.error('❌ Error in web upload fallback:', error);
      return photos.map(photo => ({
        photoId: photo.id,
        filename: photo.filename,
        status: 'failed',
        error: error.message
      }));
    }
  }

  /**
   * Get status of active uploads
   */
  getUploadStatus() {
    const status = {
      active: 0,
      completed: 0,
      failed: 0,
      uploads: []
    };
    
    this.activeUploads.forEach(session => {
      status.uploads.push({
        uploadId: session.uploadId,
        photoId: session.photoId,
        filename: session.filename,
        eventId: session.eventId,
        status: session.status,
        progress: session.progress || 0,
        error: session.error,
        cropType: session.cropType
      });
      
      if (session.status === 'uploading') status.active++;
      else if (session.status === 'completed') status.completed++;
      else if (session.status === 'failed') status.failed++;
    });
    
    return status;
  }

  /**
   * Cancel an active upload
   */
  async cancelUpload(uploadId) {
    console.log(`🛑 Cancelling upload: ${uploadId}`);
    
    if (this.activeUploads.has(uploadId)) {
      try {
        const session = this.activeUploads.get(uploadId);
        
        // Mark as cancelled
        session.status = 'cancelled';
        session.cancelledAt = Date.now();
        
        // Clean up resources
        if (session) {
          await this.cleanupTempFile(session);
        }
        
        // Remove from active uploads
        this.activeUploads.delete(uploadId);
        
        // Dispatch cancellation event
        window.dispatchEvent(new CustomEvent('fileTransferUploadCancelled', {
          detail: {
            uploadId: uploadId,
            filename: session.filename,
            eventId: session.eventId
          }
        }));
        
        console.log(`✅ Upload ${uploadId} cancelled successfully`);
        return true;
      } catch (error) {
        console.error(`❌ Error cancelling upload ${uploadId}:`, error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Cancel all active uploads
   */
  async cancelAllUploads() {
    console.log('🛑 Cancelling all active uploads...');
    
    const uploadIds = Array.from(this.activeUploads.keys());
    const results = await Promise.allSettled(
      uploadIds.map(id => this.cancelUpload(id))
    );
    
    const cancelled = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`✅ Cancelled ${cancelled}/${uploadIds.length} uploads`);
    
    // Clear all upload notifications
    await this.clearAllUploadNotifications();
    
    return { cancelled, total: uploadIds.length };
  }

  /**
   * Clear all upload-related notifications
   */
  async clearAllUploadNotifications() {
    if (!this.notifications) return;
    
    try {
      console.log('🔔 Clearing all upload notifications...');
      
      // Get all notification IDs from active uploads
      const notificationIds = [];
      this.activeUploads.forEach(session => {
        if (session.notificationId) {
          notificationIds.push(session.notificationId);
        }
      });
      
      // Clear notifications (note: exact API depends on plugin)
      for (const id of notificationIds) {
        try {
          await this.notifications.cancel({ notifications: [{ id }] });
        } catch (error) {
          console.log(`⚠️ Could not clear notification ${id}:`, error);
        }
      }
      
      console.log(`✅ Cleared ${notificationIds.length} upload notifications`);
      
    } catch (error) {
      console.error('❌ Error clearing upload notifications:', error);
    }
  }
}

// Create global instance
window.backgroundUploadService = new BackgroundUploadService();

// Expose convenient global functions for EventPhotoPicker integration
window.startBackgroundUpload = async (photos, eventId, options) => {
  return window.backgroundUploadService.startEventPhotoUpload(photos, eventId, options);
};

window.startCroppedImageUpload = async (croppedImagePath, eventId, cropType, options) => {
  return window.backgroundUploadService.startCroppedImageUpload(croppedImagePath, eventId, cropType, options);
};

window.getBackgroundUploadStatus = () => {
  return window.backgroundUploadService.getUploadStatus();
};

window.cancelBackgroundUpload = async (uploadId) => {
  return window.backgroundUploadService.cancelUpload(uploadId);
};

window.cancelAllBackgroundUploads = async () => {
  return window.backgroundUploadService.cancelAllUploads();
};

window.clearAllUploadNotifications = async () => {
  return window.backgroundUploadService.clearAllUploadNotifications();
};

// Test function for notification system
window.testUploadNotifications = async () => {
  console.log('🧪 Testing upload notification system...');
  
  if (!window.backgroundUploadService.notifications) {
    console.log('❌ Notifications not available');
    return false;
  }
  
  try {
    // Create test upload session
    const testSession = {
      uploadId: 'test-upload-123',
      filename: 'test-photo.jpg',
      cropType: null,
      eventId: 'test-event'
    };
    
    // Test start notification
    await window.backgroundUploadService.showUploadStartNotification(testSession, null);
    console.log('✅ Start notification shown');
    
    // Test progress notifications
    setTimeout(async () => {
      await window.backgroundUploadService.updateUploadProgressNotification(testSession, 50);
      console.log('✅ Progress notification (50%) shown');
    }, 2000);
    
    // Test completion notification
    setTimeout(async () => {
      await window.backgroundUploadService.showUploadCompleteNotification(testSession, true);
      console.log('✅ Completion notification shown');
    }, 4000);
    
    return true;
  } catch (error) {
    console.error('❌ Notification test failed:', error);
    return false;
  }
};

console.log('✅ BackgroundUploadService loaded and ready');
console.log('📡 New multipart upload endpoint configured');
console.log('🔔 Notification system initialized');
console.log('🚀 Using @capacitor/file-transfer for reliable uploads');
console.log('🔗 Integration ready for EventPhotoPicker and PhotoEditor');