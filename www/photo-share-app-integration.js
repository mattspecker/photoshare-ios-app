/**
 * Photo-Share.app Event Photo Picker Integration
 * 
 * This file should be uploaded to photo-share.app and included in the main app HTML.
 * It integrates the native Event Photo Picker with the website's upload functionality.
 */

console.log('📸 Photo-Share.app Event Photo Picker Integration loading...');
console.log('🌐 Current URL:', window.location.href);
console.log('🔧 Capacitor available:', !!window.Capacitor);

(function() {
    'use strict';

    class PhotoShareAppIntegration {
        constructor() {
            console.log('🚀 PhotoShareAppIntegration constructor called');
            console.log('🌐 Current URL:', window.location.href);
            console.log('📱 User agent:', navigator.userAgent);
            console.log('🔧 Capacitor available:', !!window.Capacitor);
            
            this.isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
            this.eventPhotoPicker = null;
            this.originalShareFunction = null;
            this.originalSelectPhotosFromGallery = null;
            this.isInitialized = false;
            
            console.log(`📱 Photo-Share.app running in ${this.isNative ? 'native app' : 'web browser'}`);
            
            if (this.isNative) {
                console.log('✅ Native platform detected - initializing integration');
                this.initialize();
            } else {
                console.log('❌ Not native platform - integration disabled');
            }
        }

        async initialize() {
            try {
                console.log('🚀 Initializing Event Photo Picker integration...');
                
                // Wait for Capacitor plugins to be ready
                await this.waitForCapacitor();
                
                // Check for Event Photo Picker plugin
                this.eventPhotoPicker = window.Capacitor?.Plugins?.EventPhotoPicker;
                
                // Always add event info display for debugging
                this.addEventInfoDisplay();
                
                // Hook into PhotoEditor for crop tool upload integration  
                this.hookIntoPhotoEditor();
                
                // Do NOT hook into Camera.getPhoto - let website work normally
                
                if (this.eventPhotoPicker) {
                    console.log('✅ Event Photo Picker plugin detected');
                    
                    // Hook into existing upload functionality (pickImages and other hooks)
                    this.hookIntoUploadFlow();
                    
                    this.isInitialized = true;
                    console.log('✅ Event Photo Picker integration ready');
                } else {
                    console.warn('⚠️ Event Photo Picker plugin not available - crop functionality still enabled');
                    this.isInitialized = true;
                }
            } catch (error) {
                console.error('❌ Error initializing Event Photo Picker:', error);
            }
        }

        async waitForCapacitor() {
            return new Promise((resolve) => {
                const checkCapacitor = () => {
                    if (window.Capacitor && window.Capacitor.Plugins) {
                        resolve();
                    } else {
                        setTimeout(checkCapacitor, 100);
                    }
                };
                checkCapacitor();
            });
        }

        /**
         * Hook into existing upload functionality
         */
        hookIntoUploadFlow() {
            // PRIMARY: Override CapacitorCameraLib.pickImages() - this is the main target
            this.hookIntoCapacitorCamera();

            // NEW: Override Camera.getPhoto() - for direct Capacitor Camera calls
            this.hookIntoCapacitorCameraGetPhoto();

            // NEW: Override selectPhotosFromGallery() - for photo-share.app website
            this.hookIntoSelectPhotosFromGallery();

            // SECONDARY: Override Share.share if available
            if (window.Capacitor?.Plugins?.Share?.share) {
                this.originalShareFunction = window.Capacitor.Plugins.Share.share;
                window.Capacitor.Plugins.Share.share = this.enhancedShareFunction.bind(this);
                console.log('✅ Share function enhanced with Event Photo Picker');
            }

            // FALLBACK: Hook into any upload buttons or forms
            this.hookIntoUploadButtons();
            
            // FALLBACK: Hook into drag & drop areas
            this.hookIntoDragDrop();
        }

        /**
         * Hook into CapacitorCameraLib.pickImages() - PRIMARY INTEGRATION POINT
         */
        hookIntoCapacitorCamera() {
            console.log('🔗 Starting CapacitorCameraLib.pickImages override setup...');
            
            // Wait for CapacitorCameraLib to be available
            const checkForCamera = () => {
                console.log('🔍 Checking for camera libraries...');
                
                // Debug: Log all window properties related to camera
                const windowKeys = Object.keys(window).filter(key => 
                    key.toLowerCase().includes('camera') || 
                    key.toLowerCase().includes('capacitor')
                );
                console.log('🌐 Window keys related to camera/capacitor:', windowKeys);
                
                // Check if Capacitor is available
                if (window.Capacitor) {
                    console.log('✅ Capacitor is available');
                    if (window.Capacitor.Plugins) {
                        console.log('✅ Capacitor.Plugins is available, keys:', Object.keys(window.Capacitor.Plugins));
                    } else {
                        console.log('❌ Capacitor.Plugins is NOT available');
                    }
                } else {
                    console.log('❌ Capacitor is NOT available');
                }
                
                // Check multiple possible locations for the camera library
                const cameraLib = window.CapacitorCameraLib || 
                                window.Capacitor?.Plugins?.Camera ||
                                window.Camera;
                
                console.log('📱 Camera library check results:', {
                    CapacitorCameraLib: !!window.CapacitorCameraLib,
                    'Capacitor.Plugins.Camera': !!(window.Capacitor?.Plugins?.Camera),
                    Camera: !!window.Camera,
                    foundLib: !!cameraLib
                });
                
                if (cameraLib) {
                    console.log('📸 Found camera library! Available methods:', Object.keys(cameraLib));
                    
                    if (cameraLib.pickImages) {
                        console.log('🎯 Found CapacitorCameraLib.pickImages - installing Event Photo Picker override');
                        
                        // Store original function
                        this.originalPickImages = cameraLib.pickImages.bind(cameraLib);
                        
                        // Override with our Event Photo Picker
                        cameraLib.pickImages = this.enhancedPickImages.bind(this);
                        
                        console.log('✅ CapacitorCameraLib.pickImages successfully overridden');
                        return true;
                    } else {
                        console.log('❌ Camera library found but no pickImages method');
                        return false;
                    }
                } else {
                    console.log('❌ No camera library found at all');
                    return false;
                }
            };

            // Try immediately
            if (!checkForCamera()) {
                // If not available, check periodically
                const checkInterval = setInterval(() => {
                    if (checkForCamera()) {
                        clearInterval(checkInterval);
                    }
                }, 500);

                // Stop checking after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('⚠️ CapacitorCameraLib.pickImages not found after 10 seconds');
                }, 10000);
            }
        }

        /**
         * Hook into Camera.getPhoto() - for direct Capacitor Camera plugin calls
         */
        hookIntoCapacitorCameraGetPhoto() {
            console.log('🔗 Setting up Camera.getPhoto override...');
            
            const setupCameraHook = () => {
                const camera = window.Capacitor?.Plugins?.Camera;
                
                if (camera && camera.getPhoto) {
                    console.log('🎯 Found Camera.getPhoto - installing override');
                    
                    // Store original function
                    this.originalGetPhoto = camera.getPhoto.bind(camera);
                    
                    // Override with our handler
                    camera.getPhoto = this.enhancedGetPhoto.bind(this);
                    
                    console.log('✅ Camera.getPhoto successfully overridden');
                    return true;
                } else {
                    console.log('❌ Camera.getPhoto not found');
                    return false;
                }
            };
            
            // Try immediately
            if (!setupCameraHook()) {
                // If not available, check periodically
                const checkInterval = setInterval(() => {
                    console.log('🔍 Checking for Camera.getPhoto...');
                    if (setupCameraHook()) {
                        clearInterval(checkInterval);
                    }
                }, 500);
                
                // Stop checking after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('⚠️ Camera.getPhoto not found after 10 seconds');
                }, 10000);
            }
        }

        /**
         * Hook into PhotoEditorPlugin.editPhoto() - for crop tool upload integration
         */
        hookIntoPhotoEditor() {
            console.log('🔗 Setting up PhotoEditor.editPhoto override...');
            
            const setupPhotoEditorHook = () => {
                const photoEditor = window.Capacitor?.Plugins?.PhotoEditorPlugin;
                
                if (photoEditor && photoEditor.editPhoto) {
                    console.log('🎯 Found PhotoEditorPlugin.editPhoto - installing upload integration');
                    
                    // Store original function
                    this.originalEditPhoto = photoEditor.editPhoto.bind(photoEditor);
                    
                    // Override with our handler that adds upload integration
                    photoEditor.editPhoto = this.enhancedEditPhoto.bind(this);
                    
                    console.log('✅ PhotoEditorPlugin.editPhoto successfully overridden');
                    return true;
                } else {
                    console.log('❌ PhotoEditorPlugin.editPhoto not found');
                    return false;
                }
            };
            
            // Try immediately
            if (!setupPhotoEditorHook()) {
                // If not available, check periodically
                const checkInterval = setInterval(() => {
                    console.log('🔍 Checking for PhotoEditorPlugin.editPhoto...');
                    if (setupPhotoEditorHook()) {
                        clearInterval(checkInterval);
                    }
                }, 500);
                
                // Stop checking after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('⚠️ PhotoEditorPlugin.editPhoto not found after 10 seconds');
                }, 10000);
            }
        }

        /**
         * Hook into selectPhotosFromGallery() - PHOTO-SHARE.APP INTEGRATION POINT
         */
        hookIntoSelectPhotosFromGallery() {
            console.log('🔗 Starting selectPhotosFromGallery override setup...');
            
            // Wait for selectPhotosFromGallery to be available
            const checkForFunction = () => {
                console.log('🔍 Checking for selectPhotosFromGallery function...');
                
                // Check if selectPhotosFromGallery exists
                if (window.selectPhotosFromGallery && typeof window.selectPhotosFromGallery === 'function') {
                    console.log('🎯 Found selectPhotosFromGallery - installing EventPhotoPicker override');
                    
                    // Store original function
                    this.originalSelectPhotosFromGallery = window.selectPhotosFromGallery.bind(window);
                    
                    // Override with our EventPhotoPicker call
                    window.selectPhotosFromGallery = this.enhancedSelectPhotosFromGallery.bind(this);
                    
                    console.log('✅ selectPhotosFromGallery successfully overridden to use EventPhotoPicker');
                    return true;
                } else {
                    console.log('❌ selectPhotosFromGallery function not found');
                    return false;
                }
            };

            // Try immediately
            if (!checkForFunction()) {
                // If not available, check periodically
                const checkInterval = setInterval(() => {
                    if (checkForFunction()) {
                        clearInterval(checkInterval);
                    }
                }, 500);

                // Stop checking after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('⚠️ selectPhotosFromGallery not found after 10 seconds');
                }, 10000);
            }
        }

        /**
         * Enhanced selectPhotosFromGallery - calls EventPhotoPicker directly
         */
        async enhancedSelectPhotosFromGallery(...args) {
            console.log('🎯🎯🎯 selectPhotosFromGallery INTERCEPTED - Using EventPhotoPicker! 🎯🎯🎯');
            console.log('📸 selectPhotosFromGallery called with args:', args);
            
            try {
                // Get event context from URL (https://photo-share.app/event/[eventid])
                const eventData = this.getCurrentEventDataFromURL();
                
                if (eventData && eventData.eventId) {
                    console.log('🎯 Event context found - calling EventPhotoPicker directly:', eventData);
                    
                    // Call EventPhotoPicker plugin directly (not CapacitorCamera)
                    const result = await this.openEventPhotoPicker(eventData);
                    
                    if (result && result.photos && result.photos.length > 0) {
                        console.log(`✅ EventPhotoPicker returned ${result.photos.length} photos`);
                        
                        // Return in format expected by photo-share.app
                        return this.convertEventPhotosToWebFormat(result.photos);
                    } else {
                        console.log('ℹ️ No photos selected from EventPhotoPicker');
                        return { photos: [], count: 0 };
                    }
                } else {
                    console.log('❌ No event context - falling back to original selectPhotosFromGallery');
                    // Fall back to original function if no event context
                    return await this.originalSelectPhotosFromGallery(...args);
                }
                
            } catch (error) {
                console.error('❌ EventPhotoPicker error:', error);
                
                // If EventPhotoPicker fails, fall back to original function
                console.log('🔄 Falling back to original selectPhotosFromGallery...');
                return await this.originalSelectPhotosFromGallery(...args);
            }
        }

        /**
         * Get event data from URL for photo-share.app/event/[eventid] pages
         */
        getCurrentEventDataFromURL() {
            const url = window.location.href;
            console.log('🔍 Extracting event data from URL:', url);
            
            // Extract event ID from URL pattern: https://photo-share.app/event/[eventid]
            const eventIdMatch = url.match(/\/event\/([a-f0-9-]+)/i);
            
            if (eventIdMatch) {
                const eventId = eventIdMatch[1];
                console.log('✅ Event ID extracted from URL:', eventId);
                
                const eventData = {
                    eventId: eventId,
                    eventName: this.extractEventNameFromPage() || 'Current Event',
                    startDate: this.getDefaultStartDate(),
                    endDate: this.getDefaultEndDate(),
                    uploadedPhotoIds: []
                };
                
                console.log('📋 Event data for EventPhotoPicker:', eventData);
                return eventData;
            } else {
                console.log('❌ No event ID found in URL pattern');
                return null;
            }
        }

        /**
         * Extract event name from page elements
         */
        extractEventNameFromPage() {
            const selectors = ['h1', '.event-title', '.event-name', '[data-event-name]'];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    return element.textContent.trim();
                }
            }
            
            return document.title || 'Event Photos';
        }

        /**
         * Get default start date (7 days ago)
         */
        getDefaultStartDate() {
            const date = new Date();
            date.setDate(date.getDate() - 7);
            return date.toISOString();
        }

        /**
         * Get default end date (now)
         */
        getDefaultEndDate() {
            return new Date().toISOString();
        }

        /**
         * Convert EventPhotoPicker results to format expected by photo-share.app
         */
        convertEventPhotosToWebFormat(photos) {
            const convertedPhotos = photos.map((photo, index) => ({
                // Standard web format
                id: photo.localIdentifier || `event_photo_${index}`,
                uri: `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`,
                name: `event_photo_${index + 1}.jpg`,
                type: photo.mimeType || 'image/jpeg',
                size: photo.base64 ? Math.floor(photo.base64.length * 0.75) : 0, // Estimate size from base64
                width: photo.width,
                height: photo.height,
                
                // EventPhotoPicker metadata
                creationDate: photo.creationDate,
                localIdentifier: photo.localIdentifier,
                isUploaded: photo.isUploaded,
                location: photo.location,
                
                // Mark as EventPhotoPicker source
                source: 'EventPhotoPicker'
            }));
            
            console.log('🔄 Converted EventPhotoPicker photos to web format:', convertedPhotos);
            
            return {
                photos: convertedPhotos,
                count: convertedPhotos.length,
                source: 'EventPhotoPicker'
            };
        }

        /**
         * Enhanced editPhoto function that adds upload integration after cropping
         */
        async enhancedEditPhoto(options = {}) {
            console.log('🎯🎯🎯 ENHANCED EDIT PHOTO CALLED! 🎯🎯🎯');
            console.log('📸 PhotoEditorPlugin.editPhoto intercepted with options:', JSON.stringify(options, null, 2));
            console.log('🔍 This means the website IS calling PhotoEditorPlugin.editPhoto - crop tool working!');
            
            try {
                // Call the original editPhoto function
                const editResult = await this.originalEditPhoto(options);
                console.log('✅ PhotoEditor completed:', editResult);
                
                // Check if this was a crop operation and upload the result
                if (editResult.success && editResult.editedPath) {
                    // Determine if this was a header or QR crop based on the options or result
                    const cropType = options.cropType || 
                        (editResult.cropType) ||
                        (editResult.wasCropped ? 'header' : null); // default to header if cropped
                    
                    if (cropType === 'header' || cropType === 'qr') {
                        console.log(`📤 Crop completed for ${cropType}, starting upload...`);
                        
                        // Get current event context
                        const eventData = this.getCurrentEventData();
                        
                        if (eventData.eventId && window.startCroppedImageUploadToEvent) {
                            console.log(`📤 Starting upload of cropped ${cropType} image to event ${eventData.eventId}`);
                            
                            // Start background upload of cropped image
                            await window.startCroppedImageUploadToEvent(
                                editResult.editedPath,
                                eventData.eventId,
                                cropType,
                                { notificationTitle: `Uploading ${cropType} image` }
                            );
                            
                            console.log(`✅ ${cropType} image upload initiated`);
                        } else {
                            console.log('⚠️ No event context or upload function available');
                        }
                    } else {
                        console.log('📸 Regular photo edit (not crop), no automatic upload');
                    }
                }
                
                return editResult;
                
            } catch (error) {
                console.error('❌ Enhanced editPhoto error:', error);
                
                // If our enhanced flow fails, fall back to original
                console.log('🔄 Falling back to original PhotoEditor.editPhoto...');
                return await this.originalEditPhoto(options);
            }
        }

        /**
         * Enhanced getPhoto function that handles header/QR crop workflow
         */
        async enhancedGetPhoto(options = {}) {
            console.log('🎯🎯🎯 ENHANCED GET PHOTO CALLED! 🎯🎯🎯');
            console.log('📸 Camera.getPhoto intercepted:', options);
            
            try {
                // Check if this is for header or QR by looking at promptLabelHeader
                const isHeaderRequest = options.promptLabelHeader && 
                    (options.promptLabelHeader.toLowerCase().includes('header') ||
                     options.promptLabelHeader.toLowerCase().includes('qr'));
                
                // Also check maxWidth/maxHeight hints for header (1920x480) or QR (512x512)
                const isHeaderByDimensions = (options.maxWidth === 1920 && options.maxHeight === 480);
                const isQRByDimensions = (options.maxWidth === 512 && options.maxHeight === 512);
                
                if (isHeaderRequest || isHeaderByDimensions || isQRByDimensions) {
                    const cropType = isQRByDimensions ? 'qr' : 'header';
                    console.log(`📷 ✂️ Photo selection for ${cropType} detected - routing to crop workflow`);
                    
                    // First, get the photo using original method
                    const photoResult = await this.originalGetPhoto({
                        ...options,
                        allowEditing: false // We'll handle cropping ourselves
                    });
                    
                    if (!photoResult || !photoResult.dataUrl) {
                        console.log('❌ No photo selected');
                        throw new Error('No photo selected');
                    }
                    
                    console.log(`📸 Photo selected, launching ${cropType} crop tool...`);
                    
                    // Convert dataUrl to file for PhotoEditor
                    const tempPath = await this.dataUrlToTempFile(photoResult.dataUrl, `temp_${cropType}_${Date.now()}.jpg`);
                    
                    // Launch the PhotoEditor crop tool
                    if (window.Capacitor?.Plugins?.PhotoEditorPlugin) {
                        const cropResult = await window.Capacitor.Plugins.PhotoEditorPlugin.editPhoto({
                            imagePath: tempPath,
                            cropType: cropType,
                            mode: 'crop'
                        });
                        
                        if (cropResult.success && cropResult.editedPath) {
                            console.log(`✅ ${cropType} image cropped successfully`);
                            
                            // Get current event context for upload
                            const eventData = this.getCurrentEventData();
                            
                            // Start upload of cropped image if we have an event
                            if (eventData.eventId && window.startCroppedImageUploadToEvent) {
                                console.log(`📤 Starting upload of cropped ${cropType} image to event ${eventData.eventId}`);
                                await window.startCroppedImageUploadToEvent(
                                    cropResult.editedPath,
                                    eventData.eventId,
                                    cropType,
                                    { notificationTitle: `Uploading ${cropType} image` }
                                );
                            }
                            
                            // Convert cropped image back to dataUrl for return value
                            const croppedDataUrl = await this.fileToDataUrl(cropResult.editedPath);
                            
                            // Return in expected Camera.getPhoto format
                            return {
                                ...photoResult,
                                dataUrl: croppedDataUrl,
                                saved: true,
                                metadata: {
                                    ...photoResult.metadata,
                                    purpose: cropType,
                                    wasEdited: true,
                                    wasCropped: true
                                }
                            };
                        } else {
                            console.log('❌ Crop cancelled or failed');
                            throw new Error('Crop cancelled');
                        }
                    } else {
                        console.error('❌ PhotoEditorPlugin not available');
                        // Fall back to original photo if crop tool not available
                        return photoResult;
                    }
                }
                
                // For regular photos, use normal flow or EventPhotoPicker
                console.log('📸 Regular photo request - using standard flow');
                return await this.originalGetPhoto(options);
                
            } catch (error) {
                console.error('❌ Enhanced getPhoto error:', error);
                
                // If our enhanced flow fails, fall back to original camera
                console.log('🔄 Falling back to original Camera.getPhoto...');
                return await this.originalGetPhoto(options);
            }
        }

        /**
         * Enhanced pickImages function that uses Event Photo Picker
         */
        async enhancedPickImages(options = {}) {
            console.log('🎯🎯🎯 ENHANCED PICK IMAGES CALLED! 🎯🎯🎯');
            console.log('📸 CapacitorCameraLib.pickImages intercepted:', options);
            
            try {
                // Get current event context
                const eventData = this.getCurrentEventData();
                
                if (eventData.eventId && eventData.eventId !== 'live-site-event') {
                    console.log('🎯 Event context detected - showing Event Information Modal ONLY');
                    
                    // Show comprehensive event info modal as the ONLY interaction
                    const eventInfoResult = await this.showEventInfo(eventData);
                    
                    console.log('✅ Event Information Modal completed:', eventInfoResult);
                    
                    // For now, just throw an error to prevent camera picker from opening
                    // This will demonstrate the modal working without continuing to photo picker
                    throw new Error('Event Information Modal shown - photo picker disabled for testing');
                } else {
                    console.log('ℹ️ No specific event context - using original camera picker');
                    // Fall back to original function if no event context
                    return await this.originalPickImages(options);
                }
                
            } catch (error) {
                console.error('❌ Enhanced pickImages error:', error);
                
                // If Event Photo Picker fails, fall back to original camera picker
                console.log('🔄 Falling back to original camera picker...');
                return await this.originalPickImages(options);
            }
        }

        /**
         * Convert Event Photo Picker results to CapacitorCameraLib.pickImages format
         */
        convertEventPhotosToPickImagesFormat(photos, originalOptions) {
            // CapacitorCameraLib.pickImages returns format: { photos: [{ path, webPath, format }] }
            const convertedPhotos = photos.map((photo, index) => ({
                // Create data URLs from base64
                path: `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`,
                webPath: `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`,
                format: this.getFormatFromMimeType(photo.mimeType),
                // Additional metadata from Event Photo Picker
                localIdentifier: photo.localIdentifier,
                creationDate: photo.creationDate,
                width: photo.width,
                height: photo.height,
                location: photo.location,
                isUploaded: photo.isUploaded
            }));

            return {
                photos: convertedPhotos
            };
        }

        /**
         * Convert MIME type to format string
         */
        getFormatFromMimeType(mimeType) {
            if (!mimeType) return 'jpeg';
            
            const formatMap = {
                'image/jpeg': 'jpeg',
                'image/jpg': 'jpeg', 
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/heic': 'heic',
                'image/heif': 'heif'
            };
            
            return formatMap[mimeType.toLowerCase()] || 'jpeg';
        }

        /**
         * Convert dataUrl to temporary file for PhotoEditor
         */
        async dataUrlToTempFile(dataUrl, filename) {
            try {
                // Use Capacitor Filesystem to write the data
                if (window.Capacitor?.Plugins?.Filesystem) {
                    const base64Data = dataUrl.split(',')[1];
                    
                    const result = await window.Capacitor.Plugins.Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: window.Capacitor.Plugins.Filesystem.Directory.Cache,
                        encoding: window.Capacitor.Plugins.Filesystem.Encoding.UTF8
                    });
                    
                    return result.uri;
                } else {
                    throw new Error('Filesystem plugin not available');
                }
            } catch (error) {
                console.error('❌ Failed to convert dataUrl to temp file:', error);
                throw error;
            }
        }

        /**
         * Convert file path to dataUrl
         */
        async fileToDataUrl(filePath) {
            try {
                // Use Capacitor Filesystem to read the file
                if (window.Capacitor?.Plugins?.Filesystem) {
                    const result = await window.Capacitor.Plugins.Filesystem.readFile({
                        path: filePath
                    });
                    
                    return `data:image/jpeg;base64,${result.data}`;
                } else {
                    throw new Error('Filesystem plugin not available');
                }
            } catch (error) {
                console.error('❌ Failed to convert file to dataUrl:', error);
                throw error;
            }
        }

        /**
         * Enhanced share function that uses Event Photo Picker when appropriate
         */
        async enhancedShareFunction(options) {
            console.log('📤 Enhanced share function called:', options);
            
            try {
                // Check if this is a photo upload action
                if (this.isPhotoUploadAction(options)) {
                    console.log('📸 Photo upload detected - opening Event Photo Picker...');
                    
                    // Get current event context
                    const eventData = this.getCurrentEventData();
                    
                    if (eventData.eventId) {
                        // Show event info for confirmation
                        await this.showEventInfo(eventData);
                        
                        // Open Event Photo Picker
                        const result = await this.openEventPhotoPicker(eventData);
                        
                        if (result && result.photos && result.photos.length > 0) {
                            console.log(`✅ User selected ${result.photos.length} photos from event picker`);
                            
                            // Convert to format expected by original share function
                            const enhancedOptions = this.convertEventPhotosToShareFormat(result.photos, options);
                            
                            // Call original share function with event photos
                            return await this.originalShareFunction.call(window.Capacitor.Plugins.Share, enhancedOptions);
                        } else {
                            console.log('ℹ️ No photos selected from event picker');
                            throw new Error('No photos selected');
                        }
                    } else {
                        console.log('⚠️ No event context found - using standard share');
                    }
                }
                
                // Not a photo upload or no event context - use original function
                return await this.originalShareFunction.call(window.Capacitor.Plugins.Share, options);
                
            } catch (error) {
                console.error('❌ Enhanced share function error:', error);
                
                // Fall back to original share function
                return await this.originalShareFunction.call(window.Capacitor.Plugins.Share, options);
            }
        }

        /**
         * Hook into upload buttons on the page
         */
        hookIntoUploadButtons() {
            // Common selectors for upload buttons
            const uploadSelectors = [
                'input[type="file"]',
                '[data-upload]',
                '.upload-button',
                '.photo-upload',
                '#upload-btn',
                'button[onclick*="upload"]'
            ];

            uploadSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'INPUT' && element.type === 'file') {
                        element.addEventListener('click', this.handleFileInputClick.bind(this));
                    } else {
                        element.addEventListener('click', this.handleUploadButtonClick.bind(this));
                    }
                });
            });

            // Use MutationObserver to catch dynamically added upload buttons
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            uploadSelectors.forEach(selector => {
                                if (node.matches && node.matches(selector)) {
                                    this.attachUploadHandler(node);
                                } else if (node.querySelectorAll) {
                                    const uploadElements = node.querySelectorAll(selector);
                                    uploadElements.forEach(element => this.attachUploadHandler(element));
                                }
                            });
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }

        attachUploadHandler(element) {
            if (element.tagName === 'INPUT' && element.type === 'file') {
                element.addEventListener('click', this.handleFileInputClick.bind(this));
            } else {
                element.addEventListener('click', this.handleUploadButtonClick.bind(this));
            }
        }

        /**
         * Handle file input clicks
         */
        async handleFileInputClick(event) {
            const eventData = this.getCurrentEventData();
            
            if (eventData.eventId) {
                event.preventDefault();
                
                try {
                    console.log('📁 File input clicked - opening Event Photo Picker...');
                    
                    const result = await this.openEventPhotoPicker(eventData);
                    
                    if (result && result.photos && result.photos.length > 0) {
                        // Create FileList-like object with selected photos
                        this.simulateFileSelection(event.target, result.photos);
                    }
                } catch (error) {
                    console.error('❌ Event Photo Picker error:', error);
                    // Let original file input work
                }
            }
        }

        /**
         * Handle upload button clicks
         */
        async handleUploadButtonClick(event) {
            const eventData = this.getCurrentEventData();
            
            if (eventData.eventId) {
                event.preventDefault();
                
                try {
                    console.log('🔘 Upload button clicked - opening Event Photo Picker...');
                    
                    const result = await this.openEventPhotoPicker(eventData);
                    
                    if (result && result.photos && result.photos.length > 0) {
                        // Trigger upload with selected photos
                        this.triggerUploadWithEventPhotos(result.photos);
                    }
                } catch (error) {
                    console.error('❌ Event Photo Picker error:', error);
                    // Continue with original button action
                }
            }
        }

        /**
         * Hook into drag & drop areas
         */
        hookIntoDragDrop() {
            const dropAreas = document.querySelectorAll('[data-drop-zone], .drop-zone, .upload-area');
            
            dropAreas.forEach(area => {
                area.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    // Add visual feedback that Event Photo Picker is available
                    area.style.borderColor = '#007AFF';
                    area.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                });
                
                area.addEventListener('dragleave', () => {
                    area.style.borderColor = '';
                    area.style.backgroundColor = '';
                });
                
                area.addEventListener('drop', async (event) => {
                    event.preventDefault();
                    area.style.borderColor = '';
                    area.style.backgroundColor = '';
                    
                    const eventData = this.getCurrentEventData();
                    
                    if (eventData.eventId) {
                        try {
                            console.log('📦 Drop area activated - opening Event Photo Picker...');
                            
                            const result = await this.openEventPhotoPicker(eventData);
                            
                            if (result && result.photos && result.photos.length > 0) {
                                this.triggerUploadWithEventPhotos(result.photos);
                            }
                        } catch (error) {
                            console.error('❌ Event Photo Picker error:', error);
                        }
                    }
                });
            });
        }

        /**
         * Show event information modal (HTML/CSS version)
         */
        async showEventInfo(eventData) {
            console.log('🚀 showEventInfo called - Creating HTML modal');
            console.log('📋 Event data received:', eventData);
            
            return new Promise((resolve, reject) => {
                // Create modal HTML
                const modal = this.createEventInfoModal(eventData);
                document.body.appendChild(modal);
                
                // Add event listeners
                const continueBtn = modal.querySelector('.event-modal-continue');
                const cancelBtn = modal.querySelector('.event-modal-cancel');
                const closeBtn = modal.querySelector('.event-modal-close');
                
                const cleanup = () => {
                    modal.remove();
                };
                
                const handleContinue = () => {
                    console.log('✅ User continued from event info modal');
                    cleanup();
                    resolve({
                        action: 'continue',
                        eventData: eventData,
                        timestamp: new Date().toISOString()
                    });
                };
                
                const handleCancel = () => {
                    console.log('❌ User cancelled from event info modal');
                    cleanup();
                    reject(new Error('Event info modal cancelled by user'));
                };
                
                continueBtn.addEventListener('click', handleContinue);
                cancelBtn.addEventListener('click', handleCancel);
                closeBtn.addEventListener('click', handleCancel);
                
                // Close on backdrop click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        handleCancel();
                    }
                });
                
                // Show modal with animation
                setTimeout(() => {
                    modal.classList.add('show');
                }, 10);
                
                console.log('✅ Event info modal displayed');
            });
        }
        
        /**
         * Create event info modal HTML
         */
        createEventInfoModal(eventData) {
            const modal = document.createElement('div');
            modal.className = 'event-info-modal';
            modal.innerHTML = `
                <div class="event-modal-backdrop"></div>
                <div class="event-modal-content">
                    <div class="event-modal-header">
                        <h2>📸 Event Photo Upload</h2>
                        <button class="event-modal-close" type="button">&times;</button>
                    </div>
                    <div class="event-modal-body">
                        <div class="event-info-card">
                            <div class="event-info-row">
                                <span class="event-info-label">Event:</span>
                                <span class="event-info-value">${eventData.eventName || 'Unknown Event'}</span>
                            </div>
                            <div class="event-info-row">
                                <span class="event-info-label">Event ID:</span>
                                <span class="event-info-value">${eventData.eventId || 'Unknown'}</span>
                            </div>
                            <div class="event-info-row">
                                <span class="event-info-label">Member:</span>
                                <span class="event-info-value">${eventData.memberId || 'Unknown Member'}</span>
                            </div>
                            ${eventData.startDate ? `
                            <div class="event-info-row">
                                <span class="event-info-label">Start:</span>
                                <span class="event-info-value">${new Date(eventData.startDate).toLocaleString()}</span>
                            </div>
                            ` : ''}
                            ${eventData.endDate ? `
                            <div class="event-info-row">
                                <span class="event-info-label">End:</span>
                                <span class="event-info-value">${new Date(eventData.endDate).toLocaleString()}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="modal-message">
                            <p><strong>🎯 Event Photo Picker is active!</strong></p>
                            <p>This upload will use the Event Photo Picker to show only photos from this event's time period.</p>
                            <p><small>📱 This feature is currently in testing mode</small></p>
                        </div>
                    </div>
                    <div class="event-modal-footer">
                        <button class="event-modal-cancel" type="button">Cancel</button>
                        <button class="event-modal-continue" type="button">Continue</button>
                    </div>
                </div>
            `;
            
            // Add modal styles
            const styles = `
                <style>
                .event-info-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .event-info-modal.show {
                    opacity: 1;
                }
                
                .event-modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }
                
                .event-modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    max-width: 90%;
                    max-height: 90%;
                    width: 400px;
                    overflow: hidden;
                }
                
                .event-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                    background: linear-gradient(135deg, #007AFF, #5856D6);
                    color: white;
                }
                
                .event-modal-header h2 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .event-modal-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background-color 0.2s;
                }
                
                .event-modal-close:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                
                .event-modal-body {
                    padding: 20px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .event-info-card {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                
                .event-info-row {
                    display: flex;
                    margin-bottom: 8px;
                }
                
                .event-info-row:last-child {
                    margin-bottom: 0;
                }
                
                .event-info-label {
                    font-weight: 600;
                    color: #6c757d;
                    min-width: 80px;
                    margin-right: 12px;
                }
                
                .event-info-value {
                    color: #212529;
                    flex: 1;
                    word-break: break-all;
                }
                
                .modal-message {
                    padding: 16px;
                    background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
                    border-radius: 8px;
                    border-left: 4px solid #007AFF;
                }
                
                .modal-message p {
                    margin: 0 0 8px 0;
                    line-height: 1.4;
                }
                
                .modal-message p:last-child {
                    margin-bottom: 0;
                }
                
                .event-modal-footer {
                    padding: 16px 20px;
                    border-top: 1px solid #eee;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    background: #f8f9fa;
                }
                
                .event-modal-cancel,
                .event-modal-continue {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 14px;
                }
                
                .event-modal-cancel {
                    background: #6c757d;
                    color: white;
                }
                
                .event-modal-cancel:hover {
                    background: #5a6268;
                }
                
                .event-modal-continue {
                    background: #007AFF;
                    color: white;
                }
                
                .event-modal-continue:hover {
                    background: #0056b3;
                }
                
                @media (max-width: 480px) {
                    .event-modal-content {
                        width: 95%;
                        margin: 20px;
                    }
                    
                    .event-modal-header {
                        padding: 16px;
                    }
                    
                    .event-modal-body {
                        padding: 16px;
                    }
                    
                    .event-modal-footer {
                        padding: 12px 16px;
                        flex-direction: column-reverse;
                    }
                    
                    .event-modal-cancel,
                    .event-modal-continue {
                        width: 100%;
                    }
                }
                </style>
            `;
            
            // Add styles to document head if not already added
            if (!document.querySelector('#event-modal-styles')) {
                const styleSheet = document.createElement('div');
                styleSheet.id = 'event-modal-styles';
                styleSheet.innerHTML = styles;
                document.head.appendChild(styleSheet);
            }
            
            return modal;
        }

        /**
         * Open Event Photo Picker
         */
        async openEventPhotoPicker(eventData) {
            try {
                // Try to get JWT token for the plugin (use standard PhotoShare function)
                let jwtToken = null;
                try {
                    if (window.getPhotoShareJwtToken && typeof window.getPhotoShareJwtToken === 'function') {
                        jwtToken = await window.getPhotoShareJwtToken();
                        console.log('🔐 JWT token obtained for EventPhotoPicker using getPhotoShareJwtToken');
                    } else if (window.getJwtTokenForNativePlugin && typeof window.getJwtTokenForNativePlugin === 'function') {
                        jwtToken = await window.getJwtTokenForNativePlugin();
                        console.log('🔐 JWT token obtained for EventPhotoPicker using getJwtTokenForNativePlugin (fallback)');
                    } else {
                        console.log('⚠️ No JWT token functions available (getPhotoShareJwtToken or getJwtTokenForNativePlugin)');
                    }
                } catch (jwtError) {
                    console.warn('⚠️ Could not get JWT token:', jwtError);
                }
                
                const options = {
                    eventId: eventData.eventId,
                    startDate: this.formatDateForIOS(eventData.startDate),
                    endDate: this.formatDateForIOS(eventData.endDate),
                    uploadedPhotoIds: eventData.uploadedPhotoIds || [],
                    allowMultipleSelection: true,
                    title: `${eventData.eventName} Photos`
                };
                
                // Add JWT token if available
                if (jwtToken) {
                    options.jwtToken = jwtToken;
                }
                
                console.log('🚀 Opening Event Photo Picker:', options);
                
                const result = await this.eventPhotoPicker.openEventPhotoPicker(options);
                console.log('✅ Event Photo Picker result:', result);
                
                return result;
            } catch (error) {
                console.error('❌ Event Photo Picker error:', error);
                throw error;
            }
        }

        /**
         * Format date for iOS compatibility
         */
        formatDateForIOS(dateString) {
            if (!dateString) return '';
            try {
                const date = new Date(dateString);
                return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
            } catch (error) {
                console.warn('⚠️ Date format error:', error);
                return dateString;
            }
        }

        /**
         * Get current event data from page context
         */
        getCurrentEventData() {
            // Try multiple methods to get event data
            return this.getEventFromURL() ||
                   this.getEventFromLocalStorage() ||
                   this.getEventFromPageData() ||
                   this.getEventFromGlobals() ||
                   this.getFallbackEventData();
        }

        getEventFromURL() {
            const params = new URLSearchParams(window.location.search);
            const eventId = params.get('eventId') || params.get('event');
            
            if (eventId) {
                return {
                    eventId: eventId,
                    eventName: params.get('eventName') || params.get('name') || 'Current Event',
                    memberId: params.get('memberId') || params.get('userId') || 'current_user',
                    startDate: params.get('startDate') || '',
                    endDate: params.get('endDate') || '',
                    uploadedPhotoIds: []
                };
            }
            return null;
        }

        getEventFromLocalStorage() {
            try {
                const eventData = localStorage.getItem('currentEvent') || 
                                localStorage.getItem('activeEvent');
                if (eventData) {
                    return JSON.parse(eventData);
                }
            } catch (error) {
                console.warn('⚠️ Error reading event from localStorage:', error);
            }
            return null;
        }

        getEventFromPageData() {
            // Look for event data in page elements
            const eventElement = document.querySelector('[data-event-id]') ||
                               document.querySelector('[data-eventid]');
            
            if (eventElement) {
                return {
                    eventId: eventElement.getAttribute('data-event-id') || eventElement.getAttribute('data-eventid'),
                    eventName: eventElement.getAttribute('data-event-name') || 'Page Event',
                    memberId: eventElement.getAttribute('data-member-id') || 'page_user',
                    startDate: eventElement.getAttribute('data-start-date') || '',
                    endDate: eventElement.getAttribute('data-end-date') || '',
                    uploadedPhotoIds: []
                };
            }
            return null;
        }

        getEventFromGlobals() {
            // Check for global variables that might contain event data
            if (window.currentEvent) return window.currentEvent;
            if (window.eventData) return window.eventData;
            if (window.__INITIAL_STATE__?.event) return window.__INITIAL_STATE__.event;
            
            return null;
        }

        getFallbackEventData() {
            return {
                eventId: 'live-site-event',
                eventName: 'Photo Upload',
                memberId: 'current_user',
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString(),
                uploadedPhotoIds: []
            };
        }

        /**
         * Check if an action is a photo upload
         */
        isPhotoUploadAction(options) {
            return (
                (options.files && options.files.length > 0) ||
                (options.url && options.url.includes('image')) ||
                (options.title && options.title.toLowerCase().includes('photo')) ||
                (options.text && options.text.toLowerCase().includes('upload'))
            );
        }

        /**
         * Convert event photos to share format
         */
        convertEventPhotosToShareFormat(photos, originalOptions) {
            const files = photos.map(photo => ({
                data: photo.base64,
                mimeType: photo.mimeType || 'image/jpeg',
                name: `event_photo_${photo.localIdentifier}.jpg`
            }));

            return {
                ...originalOptions,
                files: files,
                title: originalOptions.title || `${photos.length} Event Photos`,
                text: originalOptions.text || `Uploading ${photos.length} photos from event`
            };
        }

        /**
         * Add event info display to the page
         */
        addEventInfoDisplay() {
            // Add a floating info button for testing
            const infoButton = document.createElement('button');
            infoButton.innerHTML = '📋 Event Info';
            infoButton.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #007AFF;
                color: white;
                border: none;
                border-radius: 25px;
                padding: 10px 15px;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                cursor: pointer;
            `;
            
            infoButton.addEventListener('click', async () => {
                const eventData = this.getCurrentEventData();
                try {
                    await this.showEventInfo(eventData);
                } catch (error) {
                    console.error('❌ Error showing event info:', error);
                }
            });
            
            document.body.appendChild(infoButton);
        }

        /**
         * Simulate file selection for file inputs
         */
        simulateFileSelection(fileInput, photos) {
            // Create File objects from photos
            const files = photos.map(photo => {
                const byteCharacters = atob(photo.base64.split(',')[1] || photo.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                
                return new File([byteArray], `event_photo_${photo.localIdentifier}.jpg`, {
                    type: photo.mimeType || 'image/jpeg'
                });
            });
            
            // Update file input
            Object.defineProperty(fileInput, 'files', {
                value: files,
                writable: false
            });
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }

        /**
         * Trigger upload with event photos
         */
        triggerUploadWithEventPhotos(photos) {
            // Emit custom event that the site can listen for
            const uploadEvent = new CustomEvent('eventPhotosSelected', {
                detail: {
                    photos: photos,
                    count: photos.length
                }
            });
            
            document.dispatchEvent(uploadEvent);
            
            console.log('📤 Event photos upload triggered:', photos.length, 'photos');
        }

        /**
         * Test the CapacitorCameraLib.pickImages override
         */
        async testPickImagesOverride() {
            try {
                console.log('🧪 Testing CapacitorCameraLib.pickImages override...');
                
                // Check if the function exists
                const cameraLib = window.CapacitorCameraLib || window.Capacitor?.Plugins?.Camera || window.Camera;
                
                if (!cameraLib || !cameraLib.pickImages) {
                    throw new Error('CapacitorCameraLib.pickImages not found');
                }
                
                console.log('✅ CapacitorCameraLib.pickImages found');
                
                // Set test event data
                const testEventData = {
                    eventId: 'test_camera_override',
                    eventName: 'Camera Override Test Event',
                    memberId: 'test_user_camera',
                    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                    endDate: new Date().toISOString() // now
                };
                
                // Temporarily set event data
                const originalEventData = this.currentEventData;
                this.currentEventData = testEventData;
                
                // Call pickImages to test the override
                const result = await cameraLib.pickImages({
                    quality: 90,
                    limit: 5,
                    presentationStyle: 'popover'
                });
                
                // Restore original event data
                this.currentEventData = originalEventData;
                
                console.log('✅ CapacitorCameraLib.pickImages override test result:', result);
                return result;
                
            } catch (error) {
                console.error('❌ CapacitorCameraLib.pickImages override test error:', error);
                throw error;
            }
        }

        /**
         * Test the selectPhotosFromGallery override
         */
        async testSelectPhotosFromGalleryOverride() {
            try {
                console.log('🧪 Testing selectPhotosFromGallery override...');
                
                // Check if the function exists
                if (!window.selectPhotosFromGallery) {
                    throw new Error('selectPhotosFromGallery function not found');
                }
                
                console.log('✅ selectPhotosFromGallery found');
                
                // Call selectPhotosFromGallery to test the override
                const result = await window.selectPhotosFromGallery({
                    multiple: true,
                    quality: 90
                });
                
                console.log('✅ selectPhotosFromGallery override test result:', result);
                return result;
                
            } catch (error) {
                console.error('❌ selectPhotosFromGallery override test error:', error);
                throw error;
            }
        }

        /**
         * Get integration status
         */
        getStatus() {
            const cameraLib = window.CapacitorCameraLib || window.Capacitor?.Plugins?.Camera || window.Camera;
            
            return {
                isNative: this.isNative,
                isInitialized: this.isInitialized,
                hasEventPhotoPicker: !!this.eventPhotoPicker,
                hasCapacitorCamera: !!(cameraLib && cameraLib.pickImages),
                hasPickImagesOverride: !!this.originalPickImages,
                hasSelectPhotosFromGallery: !!window.selectPhotosFromGallery,
                hasSelectPhotosOverride: !!this.originalSelectPhotosFromGallery,
                currentEventData: this.getCurrentEventData(),
                currentEventDataFromURL: this.getCurrentEventDataFromURL()
            };
        }
    }

    // Auto-inject integration when conditions are met
    function initializeIntegration() {
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
            
            // Check if we need to inject - either on photo-share.app or always in native
            const shouldInject = window.location.href.includes('photo-share.app') || 
                               window.location.href.includes('localhost') ||
                               window.location.href === 'file://';
            
            if (shouldInject) {
                console.log('🎯 Initializing Event Photo Picker integration...');
                window.photoShareAppIntegration = new PhotoShareAppIntegration();
                
                // Global functions for testing
                window.testEventInfoOnSite = () => {
                    const eventData = window.photoShareAppIntegration.getCurrentEventData();
                    return window.photoShareAppIntegration.showEventInfo(eventData);
                };
                
                window.testPickImagesOverride = () => window.photoShareAppIntegration.testPickImagesOverride();
                
                window.testSelectPhotosFromGallery = () => window.photoShareAppIntegration.testSelectPhotosFromGalleryOverride();
                
                window.getEventPickerStatus = () => window.photoShareAppIntegration.getStatus();
                
                console.log('✅ Photo-Share.app Event Photo Picker Integration ready');
                console.log('🧪 Test commands:');
                console.log('  • testEventInfoOnSite() - Show event info modal');
                console.log('  • testPickImagesOverride() - Test camera override with Event Photo Picker');
                console.log('  • testSelectPhotosFromGallery() - Test selectPhotosFromGallery override');
                console.log('  • getEventPickerStatus() - Check integration status');
                
                return true;
            } else {
                console.log(`🌐 Not on target site (${window.location.href}) - integration skipped`);
                return false;
            }
        } else {
            console.log('📱 Photo-Share.app running in web mode - Event Photo Picker not available');
            return false;
        }
    }
    
    // Try immediate initialization
    if (!initializeIntegration()) {
        // If not ready, listen for navigation changes and try again
        let retryCount = 0;
        const maxRetries = 10;
        
        const retryInitialization = () => {
            retryCount++;
            console.log(`🔄 Retry ${retryCount}/${maxRetries} - checking for integration readiness...`);
            
            if (initializeIntegration()) {
                console.log('✅ Integration successful on retry');
                return;
            }
            
            if (retryCount < maxRetries) {
                setTimeout(retryInitialization, 1000);
            } else {
                console.log('❌ Integration failed after max retries');
            }
        };
        
        // Start retrying after a short delay
        setTimeout(retryInitialization, 1000);
    }
    
    // Also listen for page navigation if running in native app
    if (window.Capacitor) {
        // Listen for URL changes
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            setTimeout(() => initializeIntegration(), 100);
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            setTimeout(() => initializeIntegration(), 100);
        };
        
        window.addEventListener('popstate', () => {
            setTimeout(() => initializeIntegration(), 100);
        });
    }

})();