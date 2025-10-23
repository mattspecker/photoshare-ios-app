/**
 * Photo Duplicate Prevention for Native Capacitor Plugins
 * 
 * This module provides functions to prevent duplicate photo selection
 * by fetching already uploaded photos and providing identifiers to
 * the native EventPhotoPicker plugin.
 */

class PhotoDuplicatePrevention {
    constructor() {
        this.baseUrl = 'https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1';
    }

    /**
     * Get authentication headers for API calls
     * @returns {Object} Headers object with authorization
     */
    async getAuthHeaders() {
        try {
            // Try multiple methods to get auth token
            if (window.getNativeAuthHeaders && typeof window.getNativeAuthHeaders === 'function') {
                const headers = await window.getNativeAuthHeaders();
                return headers;
            }
            
            if (window.getJwtTokenForNativePlugin && typeof window.getJwtTokenForNativePlugin === 'function') {
                const token = await window.getJwtTokenForNativePlugin();
                return {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY'
                };
            }

            throw new Error('No authentication method available');
        } catch (error) {
            console.error('Failed to get auth headers:', error);
            throw error;
        }
    }

    /**
     * Compare perceptual hashes for similarity
     */
    comparePerceptualHashes(hash1, hash2) {
      if (!hash1 || !hash2 || hash1.length !== hash2.length) {
        return 0;
      }
      
      let matches = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] === hash2[i]) {
          matches++;
        }
      }
      
      return matches / hash1.length;
    }

    /**
     * Check if perceptual hashes are similar enough to be duplicates
     */
    arePerceptualHashesSimilar(hash1, hash2, threshold = 0.9) {
      const similarity = this.comparePerceptualHashes(hash1, hash2);
      return similarity >= threshold;
    }

    /**
     * Fetch uploaded photos for an event with pagination
     * @param {string} eventId - The event ID
     * @returns {Promise<Object>} Object containing uploaded photos data
     */
    async getUploadedPhotosForEvent(eventId) {
        try {
            console.log(`🔍 Fetching uploaded photos for event: ${eventId}`);

            const headers = await this.getAuthHeaders();
            const limit = 50; // Fetch in batches of 50
            let offset = 0;
            let allPhotos = [];
            let totalCount = 0;

            // Fetch all pages of photos
            while (true) {
                const url = `${this.baseUrl}/get-uploaded-photos?event_id=${eventId}&limit=${limit}&offset=${offset}`;
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP ${response.status}: ${errorData.error || 'Failed to fetch uploaded photos'}`);
                }

                const result = await response.json();
                
                // First batch sets the total count
                if (offset === 0) {
                    totalCount = result.pagination?.total || result.count || 0;
                    console.log(`📊 Total photos available: ${totalCount}`);
                }

                // Add photos from this batch
                allPhotos.push(...(result.photos || []));
                console.log(`📖 Fetched ${result.photos?.length || 0} photos (batch ${Math.floor(offset/limit) + 1})`);

                // Check if we have more pages
                if (!result.pagination?.has_more || result.photos?.length === 0) {
                    break;
                }

                offset += limit;
            }

            console.log(`✅ Fetched all ${allPhotos.length} uploaded photos for event ${eventId}`);
            
            return {
                success: true,
                photos: allPhotos,
                count: allPhotos.length,
                total_count: totalCount
            };
        } catch (error) {
            console.error('Error fetching uploaded photos:', error);
            throw error;
        }
    }

    /**
     * Generate photo identifiers that can be used by EventPhotoPicker
     * This creates identifiers based on file hashes and timestamps
     * that can potentially match with device photos
     * 
     * @param {Array} uploadedPhotos - Array of uploaded photos from the server
     * @returns {Array} Array of identifiers for the EventPhotoPicker
     */
    generatePhotoIdentifiers(uploadedPhotos) {
        if (!uploadedPhotos || !Array.isArray(uploadedPhotos)) {
            return [];
        }

        return uploadedPhotos.map(photo => {
            // Create a composite identifier that includes multiple fields
            // The native plugin can use these to match against device photos
            return {
                // Primary identifier - file hash if available
                hash: photo.file_hash,
                
                // Perceptual hash for visual duplicate detection
                perceptualHash: photo.perceptual_hash,
                
                // Secondary identifiers for enhanced matching
                originalTimestamp: photo.original_timestamp,
                uploadTime: photo.upload_time,
                
                // Enhanced metadata for multi-factor duplicate detection
                fileSize: photo.file_size_bytes || photo.metadata?.file_size_bytes || photo.metadata?.fileSize,
                fileName: photo.metadata?.original_name || photo.metadata?.fileName,
                
                // Camera information for device matching
                cameraMake: photo.camera_make || photo.metadata?.cameraMake || photo.metadata?.camera_make,
                cameraModel: photo.camera_model || photo.metadata?.cameraModel || photo.metadata?.camera_model,
                
                // Image dimensions for format conversion detection
                imageWidth: photo.image_width || photo.metadata?.image_width || photo.metadata?.originalDimensions?.width,
                imageHeight: photo.image_height || photo.metadata?.image_height || photo.metadata?.originalDimensions?.height,
                
                // For debugging/logging
                mediaId: photo.media_id,
                uploaderId: photo.uploader_id
            };
        });
    }

    /**
     * Get photo identifiers for EventPhotoPicker exclusion
     * This is the main function to call before opening the photo picker
     * 
     * @param {string} eventId - The event ID
     * @returns {Promise<Array>} Array of photo identifiers to exclude
     */
    async getPhotoIdentifiersForExclusion(eventId) {
        try {
            const uploadedData = await this.getUploadedPhotosForEvent(eventId);
            const identifiers = this.generatePhotoIdentifiers(uploadedData.photos);
            
            console.log(`📋 Generated ${identifiers.length} photo identifiers for exclusion`);
            return identifiers;
        } catch (error) {
            console.error('Error getting photo identifiers for exclusion:', error);
            // Return empty array on error to allow photo picker to work
            return [];
        }
    }

    /**
     * Helper function to get simple hash list for basic duplicate prevention
     * @param {string} eventId - The event ID  
     * @returns {Promise<Array>} Array of file hashes
     */
    async getUploadedPhotoHashes(eventId) {
        try {
            const uploadedData = await this.getUploadedPhotosForEvent(eventId);
            return uploadedData.photos
                .filter(photo => photo.file_hash)
                .map(photo => photo.file_hash);
        } catch (error) {
            console.error('Error getting uploaded photo hashes:', error);
            return [];
        }
    }

    /**
     * Check if a specific photo hash has already been uploaded (Enhanced with perceptual hashing)
     * @param {string} eventId - The event ID
     * @param {string} fileHash - The file hash to check
     * @param {string} perceptualHash - The perceptual hash to check (optional)
     * @param {Object} photoMetadata - Optional metadata for enhanced duplicate detection
     * @returns {Promise<Object>} Object with isDuplicate boolean and match type
     */
    async isPhotoAlreadyUploaded(eventId, fileHash, perceptualHash = null, photoMetadata = {}) {
        try {
            const uploadedData = await this.getUploadedPhotosForEvent(eventId);
            
            // Check against all uploaded photos
            for (const uploadedPhoto of uploadedData.photos) {
                // First check exact file hash match
                if (uploadedPhoto.file_hash === fileHash) {
                    return { isDuplicate: true, matchType: 'exact', matchedPhoto: uploadedPhoto };
                }
                
                // Then check perceptual hash similarity (if available)
                if (perceptualHash && uploadedPhoto.perceptual_hash) {
                    if (this.arePerceptualHashesSimilar(perceptualHash, uploadedPhoto.perceptual_hash)) {
                        return { isDuplicate: true, matchType: 'visual', matchedPhoto: uploadedPhoto };
                    }
                }
                
                // Finally check metadata-based duplicate detection (fallback for format conversions)
                if (this.isDuplicatePhoto(fileHash, photoMetadata, [uploadedPhoto])) {
                    return { isDuplicate: true, matchType: 'metadata', matchedPhoto: uploadedPhoto };
                }
            }

            return { isDuplicate: false, matchType: null, matchedPhoto: null };
        } catch (error) {
            console.error('Error checking for duplicate photo:', error);
            return { isDuplicate: false, matchType: null, matchedPhoto: null }; // Allow upload if check fails
        }
    }

    /**
     * Multi-factor duplicate detection logic
     * @param {string} deviceFileHash - Hash of the device photo
     * @param {Object} deviceMetadata - Metadata of the device photo  
     * @param {Array} uploadedPhotos - Array of uploaded photos
     * @returns {boolean} True if duplicate is detected
     */
    isDuplicatePhoto(deviceFileHash, deviceMetadata, uploadedPhotos) {
        return uploadedPhotos.some(uploaded => {
            // Primary: Hash match (works for 95% of cases)
            if (deviceFileHash === uploaded.file_hash) {
                console.log('✅ Duplicate detected by file hash:', deviceFileHash);
                return true;
            }
            
            // Fallback: Metadata match for HEIF conversion cases
            if (this.isMetadataMatch(deviceMetadata, uploaded)) {
                console.log('✅ Duplicate detected by metadata match:', {
                    deviceTimestamp: deviceMetadata.timestamp,
                    uploadedTimestamp: uploaded.original_timestamp,
                    deviceSize: deviceMetadata.fileSize,
                    uploadedSize: uploaded.file_size_bytes
                });
                return true;
            }
            
            return false;
        });
    }

    /**
     * Check if two photos match based on metadata (for HEIF conversion edge cases)
     * @param {Object} deviceMetadata - Device photo metadata
     * @param {Object} uploadedPhoto - Uploaded photo data
     * @returns {boolean} True if photos match based on metadata
     */
    isMetadataMatch(deviceMetadata, uploadedPhoto) {
        // Must have timestamp for metadata matching
        if (!deviceMetadata.timestamp || !uploadedPhoto.original_timestamp) {
            return false;
        }

        try {
            const deviceTime = new Date(deviceMetadata.timestamp);
            const uploadedTime = new Date(uploadedPhoto.original_timestamp);
            const timeDiff = Math.abs(deviceTime.getTime() - uploadedTime.getTime());

            // Photos must be within 2 seconds of each other
            if (timeDiff > 2000) {
                return false;
            }

            // Check file size similarity (within 100KB for format conversion tolerance)
            if (deviceMetadata.fileSize && uploadedPhoto.file_size_bytes) {
                const sizeDiff = Math.abs(deviceMetadata.fileSize - uploadedPhoto.file_size_bytes);
                if (sizeDiff > 100000) { // 100KB tolerance
                    return false;
                }
            }

            // Check image dimensions if available
            if (deviceMetadata.width && deviceMetadata.height && 
                uploadedPhoto.image_width && uploadedPhoto.image_height) {
                const dimensionsMatch = 
                    deviceMetadata.width === uploadedPhoto.image_width &&
                    deviceMetadata.height === uploadedPhoto.image_height;
                
                if (!dimensionsMatch) {
                    return false;
                }
            }

            // Check camera model if available (helps distinguish between different devices)
            if (deviceMetadata.cameraModel && uploadedPhoto.camera_model) {
                const cameraMatch = deviceMetadata.cameraModel === uploadedPhoto.camera_model;
                if (!cameraMatch) {
                    return false;
                }
            }

            // If we've passed all checks, consider it a match
            return true;

        } catch (error) {
            console.error('Error in metadata matching:', error);
            return false;
        }
    }
}

// Global instance
window.PhotoDuplicatePrevention = new PhotoDuplicatePrevention();

// Convenience global functions
window.getUploadedPhotosForEvent = (eventId) => 
    window.PhotoDuplicatePrevention.getUploadedPhotosForEvent(eventId);

window.getPhotoIdentifiersForExclusion = (eventId) => 
    window.PhotoDuplicatePrevention.getPhotoIdentifiersForExclusion(eventId);

window.getUploadedPhotoHashes = (eventId) => 
    window.PhotoDuplicatePrevention.getUploadedPhotoHashes(eventId);

window.isPhotoAlreadyUploaded = (eventId, fileHash, perceptualHash, photoMetadata) => 
    window.PhotoDuplicatePrevention.isPhotoAlreadyUploaded(eventId, fileHash, perceptualHash, photoMetadata);

console.log('📸 Photo Duplicate Prevention system loaded');