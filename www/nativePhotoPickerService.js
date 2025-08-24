import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { showToast } from './cameraPermissions.js';
import { addPhotoToUploadQueue } from './uploadQueue.js';
import { extractPhotoMetadata } from './photoMetadataExtractor.js';
import { autoUploadManager } from './autoUploadManager.js';

/**
 * NativePhotoPickerService - Native iOS photo picker integration
 * Provides manual photo selection from iOS photo library with enhanced metadata
 */
export class NativePhotoPickerService {
  constructor() {
    this.isInitialized = false;
    this.isPickerActive = false;
    this.currentEventId = null;
    this.selectionHistory = [];
    this.batchSelections = new Map();
    
    // Configuration
    this.config = {
      // Selection options
      allowMultiple: true,
      maxSelections: 20,
      quality: 90,
      preserveAspectRatio: true,
      correctOrientation: true,
      
      // Photo requirements
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['jpeg', 'jpg', 'png', 'heic', 'heif'],
      minDimensions: { width: 640, height: 480 },
      
      // UI customization for iOS
      presentationStyle: 'popover',
      allowsEditing: false,
      showsCameraControls: true,
      cameraOverlayView: null,
      
      // Performance settings
      batchProcessing: true,
      parallelMetadataExtraction: true,
      progressCallbacks: true
    };
    
    console.log('📷 NativePhotoPickerService initialized for iOS');
  }

  /**
   * Initialize native photo picker service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing NativePhotoPickerService...');
      
      // Platform check
      const deviceInfo = await Device.getInfo();
      if (!Capacitor.isNativePlatform() || deviceInfo.platform !== 'ios') {
        console.log('❌ Native photo picker only available on iOS');
        return false;
      }

      // Check permissions
      const hasPermissions = await this.checkPhotoLibraryPermissions();
      if (!hasPermissions) {
        console.log('❌ Photo library permissions required');
        return false;
      }

      this.isInitialized = true;
      console.log('✅ NativePhotoPickerService initialized');
      return true;
      
    } catch (error) {
      console.error('Error initializing NativePhotoPickerService:', error);
      return false;
    }
  }

  /**
   * Check photo library permissions
   */
  async checkPhotoLibraryPermissions() {
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.photos !== 'granted') {
        const requestResult = await Camera.requestPermissions({
          permissions: ['photos']
        });
        
        return requestResult.photos === 'granted';
      }
      
      return true;
    } catch (error) {
      console.error('Error checking photo library permissions:', error);
      return false;
    }
  }

  /**
   * Open native iOS photo picker for single photo selection
   */
  async openSinglePhotoPicker(eventId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('NativePhotoPickerService not initialized');
    }

    if (this.isPickerActive) {
      throw new Error('Photo picker already active');
    }

    try {
      console.log('📷 Opening native iOS photo picker for single selection...');
      this.isPickerActive = true;
      this.currentEventId = eventId;

      const pickerOptions = {
        source: CameraSource.Photos,
        resultType: CameraResultType.DataUrl,
        quality: this.config.quality,
        allowEditing: options.allowEditing || this.config.allowsEditing,
        correctOrientation: this.config.correctOrientation,
        presentationStyle: 'popover',
        ...options
      };

      // Open native photo picker
      const result = await Camera.getPhoto(pickerOptions);
      
      if (result && result.dataUrl) {
        console.log('📸 Photo selected from native picker');
        
        // Process the selected photo
        const processedPhoto = await this.processSingleSelectedPhoto(result, eventId);
        
        if (processedPhoto) {
          console.log('✅ Photo processed and queued for upload');
          showToast('Photo selected and queued for upload', 'success');
          
          // Add to selection history
          this.selectionHistory.push({
            photoId: processedPhoto.id,
            eventId: eventId,
            selectedAt: new Date(),
            method: 'single-picker'
          });
          
          return processedPhoto;
        }
      }

      return null;
      
    } catch (error) {
      console.error('Error opening single photo picker:', error);
      
      if (error.message === 'User cancelled photos app') {
        showToast('Photo selection cancelled', 'info');
        return null;
      }
      
      showToast('Error selecting photo: ' + error.message, 'error');
      throw error;
      
    } finally {
      this.isPickerActive = false;
      this.currentEventId = null;
    }
  }

  /**
   * Process a single selected photo
   */
  async processSingleSelectedPhoto(cameraResult, eventId) {
    try {
      console.log('🔄 Processing selected photo...');

      // Extract basic information from camera result
      const photoData = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventId: eventId,
        dataUrl: cameraResult.dataUrl,
        source: 'manual-picker',
        selectedAt: new Date(),
        
        // Basic metadata from camera result
        format: cameraResult.format || 'jpeg',
        saved: cameraResult.saved || false,
        
        // Will be enhanced with extracted metadata
        filename: `manual_photo_${Date.now()}.${cameraResult.format || 'jpg'}`,
        mimeType: `image/${cameraResult.format || 'jpeg'}`,
      };

      // Extract comprehensive metadata
      console.log('📊 Extracting metadata from selected photo...');
      const extractedMetadata = await extractPhotoMetadata(photoData, 'camera');

      // Calculate file size from base64
      const base64Data = photoData.dataUrl.split(',')[1];
      const fileSize = Math.round((base64Data.length * 3) / 4);
      
      // Create comprehensive photo object
      const processedPhoto = {
        ...photoData,
        fileSize: fileSize,
        extractedMetadata: extractedMetadata,
        
        // Enhanced properties
        dimensions: extractedMetadata.basic?.dimensions || null,
        location: extractedMetadata.location || null,
        deviceInfo: extractedMetadata.deviceContext || null,
        exifData: extractedMetadata.exif || null,
        
        // Processing metadata
        phase: 2,
        hasEnhancedMetadata: true,
        selectionMethod: 'native-picker',
        processedAt: new Date()
      };

      // Validate photo
      if (!this.validateSelectedPhoto(processedPhoto)) {
        throw new Error('Selected photo does not meet requirements');
      }

      // Add to upload queue
      const uploadId = await addPhotoToUploadQueue(processedPhoto);
      if (uploadId) {
        processedPhoto.uploadId = uploadId;
        console.log(`📦 Photo queued for upload: ${uploadId}`);
      }

      return processedPhoto;

    } catch (error) {
      console.error('Error processing selected photo:', error);
      throw error;
    }
  }

  /**
   * Open batch photo selection interface
   */
  async openBatchPhotoPicker(eventId, maxPhotos = null) {
    if (!this.isInitialized) {
      throw new Error('NativePhotoPickerService not initialized');
    }

    try {
      console.log('📷 Starting batch photo selection...');
      
      const maxSelections = maxPhotos || this.config.maxSelections;
      const selectedPhotos = [];
      let selectionCount = 0;

      showToast(`Select up to ${maxSelections} photos for the event`, 'info');

      // Create batch selection session
      const batchId = `batch_${Date.now()}`;
      this.batchSelections.set(batchId, {
        eventId: eventId,
        startedAt: new Date(),
        maxPhotos: maxSelections,
        photos: []
      });

      // Sequential photo selection (iOS limitation workaround)
      while (selectionCount < maxSelections) {
        try {
          const continueSelection = await this.showContinueSelectionDialog(
            selectionCount, maxSelections
          );
          
          if (!continueSelection) {
            break;
          }

          const photo = await this.openSinglePhotoPicker(eventId, {
            skipValidation: true // We'll validate the batch at the end
          });
          
          if (photo) {
            selectedPhotos.push(photo);
            selectionCount++;
            
            // Update batch session
            const batch = this.batchSelections.get(batchId);
            if (batch) {
              batch.photos.push(photo);
            }
            
            showToast(`${selectionCount} of ${maxSelections} photos selected`, 'info');
          }
          
        } catch (error) {
          if (error.message === 'User cancelled photos app') {
            break; // User cancelled, exit selection
          }
          console.error('Error in batch selection:', error);
        }
      }

      // Complete batch selection
      console.log(`📦 Batch selection completed: ${selectedPhotos.length} photos`);
      
      if (selectedPhotos.length > 0) {
        showToast(`${selectedPhotos.length} photos selected and queued for upload`, 'success');
        
        // Process batch for additional optimizations
        await this.processBatchSelection(batchId);
      } else {
        showToast('No photos selected', 'info');
      }

      return selectedPhotos;

    } catch (error) {
      console.error('Error in batch photo selection:', error);
      showToast('Error selecting photos: ' + error.message, 'error');
      return [];
    }
  }

  /**
   * Show continue selection dialog
   */
  async showContinueSelectionDialog(currentCount, maxCount) {
    return new Promise((resolve) => {
      if (currentCount === 0) {
        // First selection
        resolve(true);
        return;
      }

      // For demo purposes, simulate user choice
      // In real implementation, this would show a native iOS dialog
      const shouldContinue = confirm(
        `${currentCount} photos selected. Select another photo? (${maxCount - currentCount} remaining)`
      );
      
      resolve(shouldContinue);
    });
  }

  /**
   * Process batch selection for optimizations
   */
  async processBatchSelection(batchId) {
    try {
      const batch = this.batchSelections.get(batchId);
      if (!batch) return;

      console.log('🔄 Processing batch selection optimizations...');

      // Batch processing optimizations
      const photos = batch.photos;
      
      // 1. Duplicate detection
      const duplicates = this.detectDuplicatePhotos(photos);
      if (duplicates.length > 0) {
        console.log(`⚠️ ${duplicates.length} potential duplicates detected`);
      }

      // 2. Size optimization recommendations
      const largePhotos = photos.filter(photo => photo.fileSize > 10 * 1024 * 1024);
      if (largePhotos.length > 0) {
        console.log(`📏 ${largePhotos.length} large photos (>10MB) selected`);
      }

      // 3. Batch metadata summary
      const metadataSummary = this.createBatchMetadataSummary(photos);
      console.log('📊 Batch metadata summary:', metadataSummary);

      // Update batch with processing results
      batch.processedAt = new Date();
      batch.duplicates = duplicates;
      batch.largePhotos = largePhotos.length;
      batch.metadataSummary = metadataSummary;

    } catch (error) {
      console.error('Error processing batch selection:', error);
    }
  }

  /**
   * Detect potential duplicate photos in batch
   */
  detectDuplicatePhotos(photos) {
    const duplicates = [];
    const seenHashes = new Set();

    for (const photo of photos) {
      // Simple duplicate detection based on file size and timestamp
      const hash = `${photo.fileSize}_${photo.extractedMetadata?.basic?.timestamp}`;
      
      if (seenHashes.has(hash)) {
        duplicates.push({
          photoId: photo.id,
          duplicateOf: hash,
          confidence: 'medium'
        });
      } else {
        seenHashes.add(hash);
      }
    }

    return duplicates;
  }

  /**
   * Create batch metadata summary
   */
  createBatchMetadataSummary(photos) {
    const summary = {
      totalPhotos: photos.length,
      totalSize: photos.reduce((sum, photo) => sum + (photo.fileSize || 0), 0),
      dateRange: this.getPhotoDateRange(photos),
      locations: this.getPhotoLocationSummary(photos),
      cameras: this.getCameraSummary(photos),
      formats: this.getFormatSummary(photos)
    };

    return summary;
  }

  /**
   * Get date range of photos
   */
  getPhotoDateRange(photos) {
    const dates = photos
      .map(photo => photo.extractedMetadata?.basic?.timestamp)
      .filter(date => date)
      .map(date => new Date(date));

    if (dates.length === 0) return null;

    return {
      earliest: new Date(Math.min(...dates)),
      latest: new Date(Math.max(...dates)),
      span: Math.max(...dates) - Math.min(...dates)
    };
  }

  /**
   * Get location summary of photos
   */
  getPhotoLocationSummary(photos) {
    const locations = photos
      .map(photo => photo.location)
      .filter(location => location);

    return {
      withLocation: locations.length,
      withoutLocation: photos.length - locations.length,
      locations: locations.slice(0, 5) // Sample of locations
    };
  }

  /**
   * Get camera summary
   */
  getCameraSummary(photos) {
    const cameras = {};
    
    photos.forEach(photo => {
      const camera = photo.extractedMetadata?.camera?.model || 'Unknown';
      cameras[camera] = (cameras[camera] || 0) + 1;
    });

    return cameras;
  }

  /**
   * Get format summary
   */
  getFormatSummary(photos) {
    const formats = {};
    
    photos.forEach(photo => {
      const format = photo.extractedMetadata?.basic?.format || 'Unknown';
      formats[format] = (formats[format] || 0) + 1;
    });

    return formats;
  }

  /**
   * Validate selected photo
   */
  validateSelectedPhoto(photoData) {
    try {
      // File size check
      if (photoData.fileSize > this.config.maxFileSize) {
        showToast(`Photo too large: ${(photoData.fileSize / 1024 / 1024).toFixed(1)}MB (max 50MB)`, 'error');
        return false;
      }

      // Format check
      const format = photoData.extractedMetadata?.basic?.format || photoData.format;
      if (format && !this.config.supportedFormats.includes(format.toLowerCase())) {
        showToast(`Unsupported format: ${format}`, 'error');
        return false;
      }

      // Dimension check (if available)
      const dimensions = photoData.dimensions;
      if (dimensions && 
          (dimensions.width < this.config.minDimensions.width || 
           dimensions.height < this.config.minDimensions.height)) {
        showToast('Photo resolution too low', 'error');
        return false;
      }

      return true;

    } catch (error) {
      console.error('Error validating selected photo:', error);
      return false;
    }
  }

  /**
   * Get selection history
   */
  getSelectionHistory(limit = 10) {
    return this.selectionHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get batch selection info
   */
  getBatchSelectionInfo(batchId) {
    return this.batchSelections.get(batchId);
  }

  /**
   * Get all batch selections
   */
  getAllBatchSelections() {
    return Array.from(this.batchSelections.values());
  }

  /**
   * Clear selection history
   */
  clearSelectionHistory() {
    this.selectionHistory = [];
    this.batchSelections.clear();
    console.log('🧹 Selection history cleared');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isPickerActive: this.isPickerActive,
      currentEventId: this.currentEventId,
      selectionHistoryCount: this.selectionHistory.length,
      batchSelectionsCount: this.batchSelections.size,
      config: this.config,
      capabilities: {
        singleSelection: true,
        batchSelection: true,
        metadataExtraction: true,
        duplicateDetection: true,
        nativeIOSIntegration: true
      }
    };
  }

  /**
   * Test photo picker functionality
   */
  async testPhotoPicker() {
    try {
      console.log('🧪 Testing native photo picker...');
      
      if (!this.isInitialized) {
        throw new Error('NativePhotoPickerService not initialized');
      }

      // Get test event
      const activeEvents = autoUploadManager.getActiveUploadEvents();
      if (activeEvents.length === 0) {
        throw new Error('No active events for testing');
      }

      const testEventId = activeEvents[0].eventId;
      console.log(`📱 Opening photo picker for test event: ${testEventId}`);
      
      // Test single photo selection
      const selectedPhoto = await this.openSinglePhotoPicker(testEventId);
      
      if (selectedPhoto) {
        console.log('✅ Photo picker test successful');
        showToast('Photo picker test completed successfully', 'success');
        return true;
      } else {
        console.log('📷 Photo picker test cancelled by user');
        showToast('Photo picker test cancelled', 'info');
        return false;
      }

    } catch (error) {
      console.error('Error testing photo picker:', error);
      showToast('Photo picker test failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Clean up service
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up NativePhotoPickerService...');
      
      this.clearSelectionHistory();
      this.isInitialized = false;
      this.isPickerActive = false;
      this.currentEventId = null;
      
      console.log('✅ NativePhotoPickerService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up NativePhotoPickerService:', error);
    }
  }
}

// Export singleton instance
export const nativePhotoPickerService = new NativePhotoPickerService();

// Export convenience functions
export async function initializeNativePhotoPicker() {
  return await nativePhotoPickerService.initialize();
}

export async function openPhotoPicker(eventId, options = {}) {
  return await nativePhotoPickerService.openSinglePhotoPicker(eventId, options);
}

export async function openBatchPhotoPicker(eventId, maxPhotos = null) {
  return await nativePhotoPickerService.openBatchPhotoPicker(eventId, maxPhotos);
}

export function getNativePhotoPickerStatus() {
  return nativePhotoPickerService.getStatus();
}

export function getPhotoSelectionHistory(limit = 10) {
  return nativePhotoPickerService.getSelectionHistory(limit);
}

export async function testNativePhotoPicker() {
  return await nativePhotoPickerService.testPhotoPicker();
}