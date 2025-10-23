/**
 * Photo-Share.app Event Photo Picker Integration - Phase 2
 * 
 * This provides feature-level integration that works with Phase 1 early override system.
 * Phase 1 handles core camera API overrides, Phase 2 provides event context and filtering.
 */

console.log('📸 Phase 2 Photo-Share.app Integration loading...');

(function() {
    'use strict';

    class PhotoShareAppIntegration {
        constructor() {
            console.log('🚀 Phase 2 PhotoShareAppIntegration constructor called');
            console.log('🌐 Current URL:', window.location.href);
            console.log('📱 User agent:', navigator.userAgent);
            console.log('🔧 Capacitor available:', !!window.Capacitor);
            
            // Defer platform detection until Capacitor is ready
            this.isNative = false;
            this.isIOS = false;
            this.isAndroid = false;
            this.eventPhotoPicker = null;
            this.originalShareFunction = null;
            this.originalSelectPhotosFromGallery = null;
            this.isInitialized = false;
            
            console.log('⏳ Deferring platform detection until Capacitor is ready');
            // Always initialize; initialize() will wait for Capacitor and DOM
            this.initialize();
        }

        async initialize() {
            try {
                console.log('🚀 Phase 2: Initializing feature-level integration...');
                
                // Wait for Capacitor plugins to be ready (Capacitor 5.4+ best practice)
                await this.waitForCapacitor();
                
                // Detect platform now that Capacitor is ready
                this.isNative = !!(window.Capacitor?.isNativePlatform?.());
                this.isIOS = this.isNative && window.Capacitor?.getPlatform?.() === 'ios';
                this.isAndroid = this.isNative && window.Capacitor?.getPlatform?.() === 'android';
                console.log(`📱 Phase 2 running in ${this.isNative ? 'native app' : 'web browser'}`);
                console.log(`🍎 iOS platform: ${this.isIOS ? 'YES' : 'NO'}`);
                console.log(`🤖 Android platform: ${this.isAndroid ? 'YES' : 'NO'}`);
                
                // Additional wait for DOM readiness
                await this.waitForDOMReady();
                
                // Check for Event Photo Picker plugin
                this.eventPhotoPicker = window.Capacitor?.Plugins?.EventPhotoPicker;
                
                if (this.eventPhotoPicker) {
                    console.log('✅ EventPhotoPicker plugin detected - Phase 2 ready');
                    
                    // Setup EventPhotoPickerIntegration on window (for compatibility)
                    this.setupEventPhotoPickerIntegration();
                    
                    // Setup Phase 2 feature integrations
                    this.hookIntoUploadFlow();
                    
                    this.isInitialized = true;
                    console.log('✅ Phase 2 integration ready - working with Phase 1 overrides');
                } else {
                    console.warn('⚠️ EventPhotoPicker plugin not available - Phase 2 disabled');
                }
            } catch (error) {
                console.error('❌ Error initializing Event Photo Picker:', error);
            }
        }

        async waitForDOMReady() {
            return new Promise((resolve) => {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    resolve();
                } else {
                    document.addEventListener('DOMContentLoaded', resolve, { once: true });
                }
            });
        }

        setupEventPhotoPickerIntegration() {
            // Make EventPhotoPicker available globally for React components
            window.EventPhotoPickerIntegration = {
                isReady: true,
                openPhotoPicker: async (options) => {
                    console.log('🎯 EventPhotoPickerIntegration.openPhotoPicker called with:', options);
                    
                    if (!this.eventPhotoPicker) {
                        throw new Error('EventPhotoPicker plugin not available');
                    }
                    
                    try {
                        // Fix 1: Use correct method name 'openEventPhotoPicker'
                        // Fix 2: Convert time format to what the plugin expects
                        // iOS requires 'Z' suffix for UTC, Android accepts '+00:00'
                        const formatDateForIOS = (dateString) => {
                            if (!dateString) return dateString;
                            // Convert '+00:00' to 'Z' for iOS compatibility
                            return dateString.replace(/\+00:00$/, 'Z');
                        };

                        const formattedOptions = {
                            eventId: options.eventId,
                            eventName: options.eventName,
                            // iOS requires strict ISO8601 with 'Z' suffix
                            startTime: formatDateForIOS(options.startTime),
                            endTime: formatDateForIOS(options.endTime),
                            allowMultipleSelection: options.allowMultipleSelection || true,
                            showTimeFilter: options.showTimeFilter || true
                        };
                        console.log('📅 Formatted options for plugin:', formattedOptions);
                        
                        const result = await this.eventPhotoPicker.openEventPhotoPicker(formattedOptions);
                        console.log('📸 EventPhotoPicker raw result:', result);
                        
                        // Normalize to { selectedPhotos: [...] } for React hook compatibility
                        const selectedPhotos = Array.isArray(result?.selectedPhotos)
                          ? result.selectedPhotos
                          : Array.isArray(result?.photos)
                            ? result.photos.map((p) => {
                                if (p?.dataUrl) return { dataUrl: p.dataUrl };
                                if (p?.base64) return { dataUrl: `data:${p.mimeType || 'image/jpeg'};base64,${p.base64}` };
                                if (p?.webPath) return { webPath: p.webPath };
                                if (p?.path) return { webPath: p.path };
                                return {};
                              })
                            : [];
                        
                        return { selectedPhotos };
                    } catch (error) {
                        console.error('❌ EventPhotoPicker error:', error);
                        throw error;
                    } finally {
                        // Ensure React hook can reset state even if plugin misbehaves
                        window.dispatchEvent(new Event('resetPhotoPicker'));
                    }
                }
            };
            
            console.log('✅ EventPhotoPickerIntegration setup complete');
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
         * Phase 2: Work with early camera override system from Phase 1
         */
        hookIntoUploadFlow() {
            console.log('📱 Phase 2: Setting up feature-level integrations...');
            
            // PHASE 2: Register event data provider (Phase 1 will call this)
            this.registerEventDataProvider();

            // PHASE 2: Enhanced selectPhotosFromGallery for web integration
            this.hookIntoSelectPhotosFromGallery();

            // PHASE 2: Share function enhancement
            if (window.Capacitor?.Plugins?.Share?.share) {
                this.originalShareFunction = window.Capacitor.Plugins.Share.share;
                window.Capacitor.Plugins.Share.share = this.enhancedShareFunction.bind(this);
                console.log('✅ Share function enhanced with Event Photo Picker');
            }

            // PHASE 2: UI integration hooks
            this.hookIntoUploadButtons();
            this.hookIntoDragDrop();
            
            console.log('✅ Phase 2 integration complete - ready to work with Phase 1 overrides');
        }

        /**
         * Phase 2: Register event data provider for Phase 1 early override system
         * Phase 1 camera override will call this to get event context
         */
        registerEventDataProvider() {
            console.log('🎯 Phase 2: Registering event data provider...');
            
            // Make event data available globally for Phase 1 override
            window.getEventDataForPhotoPicker = () => {
                const eventData = this.getCurrentEventData();
                console.log('📊 Providing event data to Phase 1 override:', eventData);
                return eventData;
            };
            
            // Register EventPhotoPicker handler for Phase 1 override
            window.openEventPhotoPickerFromPhase1 = async (eventData) => {
                console.log('🎯 Phase 1 requesting EventPhotoPicker:', eventData);
                return await this.openEventPhotoPicker(eventData);
            };
            
            console.log('✅ Event data provider registered for Phase 1 integration');
        }

        /**
         * Phase 2: Event context detection for Phase 1 camera override
         * This provides event data to the early override system
         */
        getCurrentEventData() {
            console.log('📊 Phase 2: Detecting event context...');
            
            // Check URL for event context
            const urlEventData = this.getCurrentEventDataFromURL();
            if (urlEventData && urlEventData.eventId) {
                console.log('✅ Event context from URL:', urlEventData);
                return urlEventData;
            }
            
            // Check global state
            const globalEventData = this.getEventDataFromGlobals();
            if (globalEventData && globalEventData.eventId) {
                console.log('✅ Event context from globals:', globalEventData);
                return globalEventData;
            }
            
            // Check DOM for event info
            const domEventData = this.getEventDataFromDOM();
            if (domEventData && domEventData.eventId) {
                console.log('✅ Event context from DOM:', domEventData);
                return domEventData;
            }
            
            console.log('ℹ️ No event context detected');
            return { eventId: null };
        }

        /**
         * Convert Event Photo Picker photo to Camera.getPhoto format
         */
        convertEventPhotoToCameraFormat(photo) {
            return {
                // Camera.getPhoto returns format: { webPath, format, saved }
                webPath: `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`,
                format: this.getFormatFromMimeType(photo.mimeType),
                saved: false,
                
                // Additional metadata from Event Photo Picker
                localIdentifier: photo.localIdentifier,
                creationDate: photo.creationDate,
                width: photo.width,
                height: photo.height,
                location: photo.location,
                isUploaded: photo.isUploaded,
                
                // Mark as Event Photo Picker source
                source: 'EventPhotoPicker'
            };
        }

        /**
         * Phase 2: Enhanced multi-photo picker (works with Phase 1 for single photos)
         * Only handles multi-photo scenarios that Phase 1 doesn't cover
         */
        setupMultiPhotoIntegration() {
            console.log('🔗 Phase 2: Setting up multi-photo integration...');
            
            // Register multi-photo handler for scenarios Phase 1 doesn't handle
            window.handleMultiPhotoSelection = async (options = {}) => {
                console.log('📸 Multi-photo selection requested:', options);
                
                const eventData = this.getCurrentEventData();
                if (eventData.eventId) {
                    console.log('🎯 Using EventPhotoPicker for multi-photo selection');
                    return await this.openEventPhotoPicker(eventData);
                } else {
                    console.log('ℹ️ No event context - using standard picker');
                    return null; // Let Phase 1 handle standard camera
                }
            };
            
            console.log('✅ Multi-photo integration ready');
        }

        /**
         * Phase 2: Web-specific photo gallery integration
         * Handles web gallery functions that don't go through camera API
         */
        hookIntoSelectPhotosFromGallery() {
            console.log('🔗 Phase 2: Setting up web gallery integration...');
            
            const setupGalleryOverride = () => {
                if (window.selectPhotosFromGallery && typeof window.selectPhotosFromGallery === 'function') {
                    console.log('🎯 Found selectPhotosFromGallery - installing EventPhotoPicker override');
                    
                    this.originalSelectPhotosFromGallery = window.selectPhotosFromGallery.bind(window);
                    window.selectPhotosFromGallery = this.enhancedSelectPhotosFromGallery.bind(this);
                    
                    console.log('✅ Web gallery integration active');
                    return true;
                }
                return false;
            };

            // Setup immediately or wait
            if (!setupGalleryOverride()) {
                const checkInterval = setInterval(() => {
                    if (setupGalleryOverride()) clearInterval(checkInterval);
                }, 500);
                
                setTimeout(() => clearInterval(checkInterval), 10000);
            }
        }

        /**
         * Enhanced selectPhotosFromGallery - calls EventPhotoPicker directly
         * DISABLED FOR ANDROID - React hook handles EventPhotoPicker calls
         */
        async enhancedSelectPhotosFromGallery(...args) {
            console.log('📸 selectPhotosFromGallery called - deferring to React hook');
            
            // CRITICAL FIX: Don't intercept on Android - React handles it
            // This prevents duplicate EventPhotoPicker calls
            if (this.isAndroid) {
                console.log('🤖 Android detected - skipping web integration, letting React handle EventPhotoPicker');
                if (this.originalSelectPhotosFromGallery) {
                    return await this.originalSelectPhotosFromGallery(...args);
                }
                return { photos: [], count: 0 };
            }
            
            try {
                // Only intercept for iOS
                const eventData = await this.getCurrentEventDataFromURL();
                
                if (eventData && eventData.eventId && eventData.startDate && eventData.endDate) {
                    console.log('🍎 iOS - using EventPhotoPicker:', eventData);
                    
                    const result = await this.openEventPhotoPicker(eventData);
                    
                    if (result && result.photos && result.photos.length > 0) {
                        console.log(`✅ EventPhotoPicker returned ${result.photos.length} photos`);
                        return this.convertEventPhotosToWebFormat(result.photos);
                    } else {
                        console.log('ℹ️ No photos selected');
                        return { photos: [], count: 0 };
                    }
                } else {
                    console.log('⚠️ No valid event context - using fallback');
                    return await this.originalSelectPhotosFromGallery(...args);
                }
                
            } catch (error) {
                console.error('❌ EventPhotoPicker error:', error);
                return await this.originalSelectPhotosFromGallery(...args);
            }
        }

        /**
         * Get event data from URL for photo-share.app/event/[eventid] pages
         */
        async getCurrentEventDataFromURL() {
            const url = window.location.href;
            console.log('🔍 Extracting event data from URL:', url);
            
            // Extract event ID from URL pattern: https://photo-share.app/event/[eventid]
            const eventIdMatch = url.match(/\/event\/([a-f0-9-]+)/i);
            
            if (!eventIdMatch) {
                console.log('❌ No event ID found in URL pattern');
                return null;
            }
            
            const eventId = eventIdMatch[1];
            console.log('✅ Event ID extracted from URL:', eventId);
            
            // Try to fetch real event data from React app state first
            const reactEventData = this.getEventDataFromGlobals();
            if (reactEventData && reactEventData.eventId === eventId && reactEventData.startTime && reactEventData.endTime) {
                console.log('✅ Using event data from React state:', reactEventData);
                return {
                    eventId: eventId,
                    eventName: reactEventData.eventName || 'Current Event',
                    startDate: reactEventData.startTime,
                    endDate: reactEventData.endTime,
                    uploadedPhotoIds: []
                };
            }
            
            // Fallback to default dates ONLY if we can't get real data
            console.warn('⚠️ Using default dates - real event dates not available');
            return null; // Return null instead of using wrong dates
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
         * Enhanced pickImages function that uses Event Photo Picker
         */
        async enhancedPickImages(options = {}) {
            console.log('🎯🎯🎯 ENHANCED PICK IMAGES CALLED! 🎯🎯🎯');
            console.log('📸 CapacitorCameraLib.pickImages intercepted:', options);
            
            try {
                // Get current event context
                const eventData = this.getCurrentEventData();
                
                if (eventData.eventId && eventData.eventId !== 'live-site-event') {
                    console.log('🎯 Event context detected - opening Event Photo Picker directly');
                    const result = await this.openEventPhotoPicker(eventData);
                    return this.convertEventPhotosToPickImagesFormat(result.photos || [], options);
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
            // Android fix: let React handle EventPhotoPicker to avoid double grids
            if (this.isAndroid) {
                console.log('🤖 Android detected - skipping web upload button hooks to prevent duplicate pickers');
                return;
            }
            // Common selectors for upload buttons
            const uploadSelectors = [
                'input[type="file"]',
                '[data-upload]',
                '.upload-button',
                '.photo-upload',
                '#upload-btn',
                'button[onclick*="upload"]',
                'button[class*="Upload"]'  // For buttons with Upload in className
            ];

            const attachHandlersToExistingButtons = () => {
                let attachedCount = 0;
                
                // Method 1: CSS selectors (fastest, but avoid problematic ones)
                const safeUploadSelectors = [
                    'input[type="file"]',
                    '[data-upload]',
                    '.upload-button',
                    '.photo-upload',
                    '#upload-btn',
                    'button[onclick*="upload"]',
                    'button[class*="Upload"]'
                ];
                
                safeUploadSelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            if (!element.dataset.eventPickerAttached) {
                                this.attachUploadHandler(element);
                                element.dataset.eventPickerAttached = 'true';
                                attachedCount++;
                            }
                        });
                    } catch (e) {
                        console.warn('Invalid selector:', selector, e);
                    }
                });

                // Method 2: Data attributes approach (Option 3 - Capacitor best practice)
                const dataAttributeButtons = document.querySelectorAll('[data-action="upload"], [data-upload="true"], [data-role="upload"]');
                dataAttributeButtons.forEach(button => {
                    if (!button.dataset.eventPickerAttached) {
                        this.attachUploadHandler(button);
                        button.dataset.eventPickerAttached = 'true';
                        attachedCount++;
                    }
                });

                // Method 3: Text-based filtering with icon detection (Option 1 refined)
                const textBasedButtons = Array.from(document.querySelectorAll('button'))
                    .filter(button => {
                        if (button.dataset.eventPickerAttached) return false;
                        
                        const buttonText = (button.textContent || button.innerText || '').toLowerCase();
                        const hasUploadIcon = button.querySelector('.lucide-upload, .upload-icon') || 
                                            button.querySelector('[class*="upload"]') ||
                                            button.querySelector('svg[class*="upload"]') ||
                                            button.querySelector('svg path[d*="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"]'); // Upload icon path
                        
                        return buttonText.includes('upload') || buttonText.includes('select') || hasUploadIcon;
                    });

                textBasedButtons.forEach(button => {
                    this.attachUploadHandler(button);
                    button.dataset.eventPickerAttached = 'true';
                    attachedCount++;
                });

                // Method 4: XPath fallback (Option 2) - broader text matching
                if (attachedCount === 0) {
                    try {
                        // More flexible XPath for various upload-related text
                        const xpathQueries = [
                            "//button[contains(translate(text(), 'UPLOAD', 'upload'), 'upload')]",
                            "//button[contains(translate(text(), 'SELECT', 'select'), 'select')]",
                            "//button[contains(translate(text(), 'CHOOSE', 'choose'), 'choose')]",
                            "//input[@type='file']"
                        ];
                        
                        xpathQueries.forEach(xpath => {
                            try {
                                const result = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                                
                                for (let i = 0; i < result.snapshotLength; i++) {
                                    const element = result.snapshotItem(i);
                                    if (element && !element.dataset.eventPickerAttached) {
                                        this.attachUploadHandler(element);
                                        element.dataset.eventPickerAttached = 'true';
                                        attachedCount++;
                                    }
                                }
                            } catch (xpathError) {
                                console.warn('XPath query failed:', xpath, xpathError);
                            }
                        });
                    } catch (xpathError) {
                        console.warn('XPath approach failed:', xpathError);
                    }
                }

                console.log(`📎 Attached event handlers to ${attachedCount} upload buttons using multi-method approach`);
                
                // If still no buttons found, log detailed info for debugging
                if (attachedCount === 0) {
                    console.warn('🔍 No upload buttons found. Available buttons:', 
                        Array.from(document.querySelectorAll('button')).map(btn => ({
                            text: btn.textContent?.trim(),
                            classes: btn.className,
                            id: btn.id
                        }))
                    );
                }
            };

            // Wait for document.body to exist before setting up observer
            const setupObserver = () => {
                if (!document.body) {
                    setTimeout(setupObserver, 50);
                    return;
                }

                // Attach handlers to existing buttons
                attachHandlersToExistingButtons();

                // Use MutationObserver to catch dynamically added upload buttons
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check if the node itself is an upload button
                                uploadSelectors.forEach(selector => {
                                    if (node.matches && node.matches(selector) && !node.dataset.eventPickerAttached) {
                                        this.attachUploadHandler(node);
                                        node.dataset.eventPickerAttached = 'true';
                                    }
                                });

                                // Check for upload buttons within the node
                                if (node.querySelectorAll) {
                                    uploadSelectors.forEach(selector => {
                                        const uploadElements = node.querySelectorAll(selector);
                                        uploadElements.forEach(element => {
                                            if (!element.dataset.eventPickerAttached) {
                                                this.attachUploadHandler(element);
                                                element.dataset.eventPickerAttached = 'true';
                                            }
                                        });
                                    });

                                    // Also check for buttons with "Upload" text within the node
                                    const buttons = node.querySelectorAll('button');
                                    buttons.forEach(button => {
                                        if (!button.dataset.eventPickerAttached && 
                                            (button.textContent?.includes('Upload') || 
                                             button.querySelector('.lucide-upload'))) {
                                            this.attachUploadHandler(button);
                                            button.dataset.eventPickerAttached = 'true';
                                        }
                                    });
                                }
                            }
                        });
                    });
                });

                observer.observe(document.body, { childList: true, subtree: true });
            };

            setupObserver();
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
            // Android fix: let React handle it
            if (this.isAndroid) return;
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
            // Android fix: let React handle it
            if (this.isAndroid) return;
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
                const options = {
                    eventId: eventData.eventId,
                    startTime: eventData.startTime || eventData.startDate,
                    endTime: eventData.endTime || eventData.endDate,
                    uploadedPhotoIds: eventData.uploadedPhotoIds || [],
                    allowMultipleSelection: true,
                    title: `${eventData.eventName} Photos`
                };
                
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
            // 1. Check globals first (fresh React state - HIGHEST PRIORITY)
            const globalData = this.getEventFromGlobals();
            if (globalData && globalData.eventId) return globalData;
            
            // 2. Check URL
            const urlData = this.getEventFromURL();
            if (urlData && urlData.eventId) return urlData;
            
            // 3. Check localStorage (may be stale)
            const storageData = this.getEventFromLocalStorage();
            if (storageData && storageData.eventId) return storageData;
            
            // 4. Check page data attributes
            const pageData = this.getEventFromPageData();
            if (pageData && pageData.eventId) return pageData;
            
            // 5. Last resort - return null
            return this.getFallbackEventData();
        }

        getEventFromURL() {
            // Extract event ID from current URL path
            const pathMatch = window.location.pathname.match(/\/event\/([^\/]+)/);
            let eventId = pathMatch ? pathMatch[1] : null;
            
            // Also check camera route
            if (!eventId) {
                const cameraMatch = window.location.pathname.match(/\/camera\/([^\/]+)/);
                eventId = cameraMatch ? cameraMatch[1] : null;
            }
            
            // Fallback to query params
            if (!eventId) {
                const params = new URLSearchParams(window.location.search);
                eventId = params.get('eventId') || params.get('event');
            }
            
            if (eventId && eventId !== 'live-site-event') {
                console.log('📊 Extracted real event ID from URL:', eventId);
                return this.fetchEventDataFromAPI(eventId);
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
            // Check for React-provided event data (FRESH DATA - highest priority)
            if (window.currentEvent && window.currentEvent.eventId) {
                console.log('✅ Using fresh event data from window.currentEvent:', window.currentEvent);
                return {
                    eventId: window.currentEvent.eventId,
                    eventName: window.currentEvent.eventName,
                    startTime: window.currentEvent.startTime,
                    endTime: window.currentEvent.endTime,
                    allowMultipleSelection: true
                };
            }
            
            // Fallback to other globals
            if (window.eventData) return window.eventData;
            if (window.__INITIAL_STATE__?.event) return window.__INITIAL_STATE__.event;
            
            return null;
        }

        getFallbackEventData() {
            // Return null instead of hardcoded data to prevent duplicate picker issues
            console.warn('⚠️ No event context found - EventPhotoPicker will not be available');
            return null;
        }

        /**
         * Fetch event data from API or DOM
         */
        fetchEventDataFromAPI(eventId) {
            try {
                // Try to get event data from page DOM elements first
                const eventData = this.getEventDataFromDOM(eventId);
                if (eventData) {
                    return eventData;
                }
                
                // If no DOM data, return basic structure for API call
                return {
                    eventId: eventId,
                    eventName: this.getEventNameFromPage(),
                    startTime: this.getEventStartTime(),
                    endTime: this.getEventEndTime(),
                    allowMultipleSelection: true
                };
            } catch (error) {
                console.warn('⚠️ Error fetching event data:', error);
                return null;
            }
        }

        /**
         * Extract event data from DOM elements
         */
        getEventDataFromDOM(eventId) {
            // Look for event data in React component props or data attributes
            const eventNameEl = document.querySelector('[data-event-name]') || 
                               document.querySelector('h1') ||
                               document.querySelector('.event-title');
            
            const eventName = eventNameEl?.textContent?.trim() || 
                             document.title.split(' - ')[0] || 
                             'Event Photos';
                             
            return {
                eventId: eventId,
                eventName: eventName,
                startTime: this.getEventStartTime(),
                endTime: this.getEventEndTime(),
                allowMultipleSelection: true
            };
        }

        /**
         * Get event name from page
         */
        getEventNameFromPage() {
            return document.querySelector('[data-event-name]')?.textContent ||
                   document.querySelector('h1')?.textContent ||
                   document.title.split(' - ')[0] ||
                   'Event Photos';
        }

        /**
         * Get event start time from page or meta
         */
        getEventStartTime() {
            const metaStart = document.querySelector('meta[name="event-start"]')?.content;
            const dataStart = document.querySelector('[data-event-start]')?.textContent;
            
            if (metaStart) return metaStart;
            if (dataStart) return dataStart;
            
            console.warn('⚠️ Using fallback start time (24h ago) - event data not available from React');
            return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago instead of 7 days
        }

        /**
         * Get event end time from page or meta
         */
        getEventEndTime() {
            const metaEnd = document.querySelector('meta[name="event-end"]')?.content;
            const dataEnd = document.querySelector('[data-event-end]')?.textContent;
            
            if (metaEnd) return metaEnd;
            if (dataEnd) return dataEnd;
            
            console.warn('⚠️ Using fallback end time (24h from now) - event data not available from React');
            return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now instead of 7 days
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
            // Native apps: ALWAYS initialize integration regardless of domain
            // This ensures EventPhotoPicker works on Lovable sandbox and production
            console.log('🎯 Native app detected - Initializing Event Photo Picker integration...');
            console.log('📍 Current URL:', window.location.href);
            window.photoShareAppIntegration = new PhotoShareAppIntegration();
                
                // Global functions for testing
                window.testPickImagesOverride = () => window.photoShareAppIntegration.testPickImagesOverride();
                
                window.testSelectPhotosFromGallery = () => window.photoShareAppIntegration.testSelectPhotosFromGalleryOverride();
                
                window.getEventPickerStatus = () => window.photoShareAppIntegration.getStatus();
                
            console.log('✅ Photo-Share.app Event Photo Picker Integration ready');
            console.log('🧪 Test commands:');
            console.log('  • testPickImagesOverride() - Test camera override with Event Photo Picker');
            console.log('  • testSelectPhotosFromGallery() - Test selectPhotosFromGallery override');
            console.log('  • getEventPickerStatus() - Check integration status');
            
            return true;
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