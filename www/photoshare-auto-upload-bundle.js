/**
 * PhotoShare Auto-Upload Bundle
 * Complete cross-platform auto-upload system for photo-share.app
 * 
 * TO USE: Add this single file to your photo-share.app website:
 * <script src="/js/photoshare-auto-upload-bundle.js"></script>
 * 
 * Supports: iOS Native App, Android (future), Web Browser
 */

console.log('🚀 PhotoShare Auto-Upload Bundle loading...');

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    
    const CONFIG = {
        supabase: {
            url: 'https://jgfcfdlfcnmaripgpepl.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY'
        },
        upload: {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            apiEndpoint: '/functions/v1/mobile-upload'
        },
        network: {
            qualityByConnection: {
                wifi: 0.95,     // 95% quality on WiFi
                cellular: 0.80,  // 80% quality on cellular
                slow: 0.65      // 65% quality on slow connections
            }
        }
    };

    // ==================== PLATFORM DETECTION ====================
    
    const Platform = {
        isNative: () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
        isIOS: () => Platform.isNative() && window.Capacitor.getPlatform() === 'ios',
        isAndroid: () => Platform.isNative() && window.Capacitor.getPlatform() === 'android',
        isWeb: () => !Platform.isNative(),
        hasCamera: () => !!(window.Capacitor?.Plugins?.Camera),
        hasPhotos: () => Platform.isNative() && Platform.hasCamera()
    };

    // ==================== UTILITIES ====================
    
    const Utils = {
        async generateSHA256(data) {
            if (typeof data === 'string') {
                data = new TextEncoder().encode(data);
            }
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        },
        
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`${emoji} [${timestamp}] ${message}`);
        }
    };

    // ==================== AUTHENTICATION SERVICE ====================
    
    class AuthService {
        constructor() {
            this.currentUser = null;
            this.supabaseClient = null;
        }

        async initialize() {
            // Wait for auth bridge if available
            if (window.PhotoShareAuthBridge) {
                let retries = 0;
                while (!window.PhotoShareAuthBridge.isReady() && retries < 10) {
                    Utils.log(`Waiting for auth bridge... (${retries + 1}/10)`);
                    await Utils.delay(1000);
                    retries++;
                }
            }

            // Try to get Supabase client from website
            if (window.supabase) {
                this.supabaseClient = window.supabase;
                Utils.log('Using existing Supabase client from website');
            } else if (window.PhotoShareAuthBridge?.getSupabase()) {
                this.supabaseClient = window.PhotoShareAuthBridge.getSupabase();
                Utils.log('Using Supabase client from auth bridge');
            } else {
                Utils.log('No existing Supabase client found');
                return false;
            }

            // Get current user with multiple methods
            try {
                let user = null;

                // Method 1: Use auth bridge if available
                if (window.PhotoShareAuthBridge?.getUser) {
                    user = await window.PhotoShareAuthBridge.getUser();
                    if (user) {
                        Utils.log(`Auth bridge found user: ${user.email}`, 'success');
                    }
                }

                // Method 2: Direct Supabase check
                if (!user && this.supabaseClient) {
                    const { data: { user: supabaseUser } } = await this.supabaseClient.auth.getUser();
                    user = supabaseUser;
                    if (user) {
                        Utils.log(`Direct Supabase found user: ${user.email}`, 'success');
                    }
                }

                // Method 3: Check global auth state
                if (!user && window.PhotoShareAuthState?.user) {
                    user = window.PhotoShareAuthState.user;
                    Utils.log(`Global auth state found user: ${user.email}`, 'success');
                }

                // Method 4: Check other global patterns
                if (!user) {
                    const globalUser = window.currentUser || window.user || window.authUser;
                    if (globalUser) {
                        user = globalUser;
                        Utils.log(`Global user object found: ${user.email || 'Unknown'}`, 'success');
                    }
                }

                this.currentUser = user;
                Utils.log(user ? `Authenticated as ${user.email}` : 'Not authenticated', user ? 'success' : 'warning');
                return !!user;
            } catch (error) {
                Utils.log(`Auth check failed: ${error.message}`, 'error');
                return false;
            }
        }

        getCurrentUser() {
            return this.currentUser;
        }

        getSupabaseClient() {
            return this.supabaseClient;
        }

        isAuthenticated() {
            return !!this.currentUser;
        }
    }

    // ==================== RELIABLE UPLOAD SERVICE ====================
    
    class ReliableUploadService {
        constructor() {
            this.uploadQueue = new Map();
            this.activeUploads = new Map();
            this.stats = {
                totalUploads: 0,
                successfulUploads: 0,
                failedUploads: 0,
                totalBytes: 0
            };
        }

        async queuePhotoUpload(photoData, eventId, options = {}) {
            const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const uploadItem = {
                uploadId,
                photoData,
                eventId,
                status: 'queued',
                attempts: 0,
                maxAttempts: options.maxRetries || 3,
                queuedAt: new Date(),
                priority: options.priority || 'normal'
            };

            this.uploadQueue.set(uploadId, uploadItem);
            Utils.log(`Photo queued for upload: ${uploadId}`);

            // Start upload immediately
            this.processUpload(uploadId);
            return uploadId;
        }

        async processUpload(uploadId) {
            const uploadItem = this.uploadQueue.get(uploadId);
            if (!uploadItem) return;

            uploadItem.status = 'uploading';
            uploadItem.attempts += 1;
            
            try {
                Utils.log(`Starting upload attempt ${uploadItem.attempts}/${uploadItem.maxAttempts} for ${uploadId}`);
                
                const result = await this.performUpload(uploadItem);
                
                uploadItem.status = 'completed';
                uploadItem.completedAt = new Date();
                uploadItem.result = result;
                
                this.stats.successfulUploads++;
                this.stats.totalBytes += uploadItem.photoData.fileSize || 0;
                
                Utils.log(`Upload completed successfully: ${uploadId}`, 'success');
                
            } catch (error) {
                Utils.log(`Upload attempt ${uploadItem.attempts} failed: ${error.message}`, 'error');
                
                if (uploadItem.attempts < uploadItem.maxAttempts) {
                    uploadItem.status = 'retrying';
                    const delay = Math.pow(2, uploadItem.attempts) * 1000; // Exponential backoff
                    Utils.log(`Retrying upload in ${delay}ms...`);
                    setTimeout(() => this.processUpload(uploadId), delay);
                } else {
                    uploadItem.status = 'failed';
                    uploadItem.error = error.message;
                    this.stats.failedUploads++;
                    Utils.log(`Upload failed permanently: ${uploadId}`, 'error');
                }
            }
        }

        async performUpload(uploadItem) {
            const authService = window.PhotoShareAutoUpload?.authService;
            if (!authService?.isAuthenticated()) {
                throw new Error('User not authenticated');
            }

            const supabase = authService.getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client not available');
            }

            // Prepare upload data
            const uploadData = {
                event_id: uploadItem.eventId,
                file_data: uploadItem.photoData.base64Data || uploadItem.photoData.data,
                file_name: uploadItem.photoData.filename || `photo_${Date.now()}.jpg`,
                file_type: 'photo',
                mime_type: uploadItem.photoData.mimeType || 'image/jpeg',
                file_size: uploadItem.photoData.fileSize || 0,
                created_at: uploadItem.photoData.createdAt || new Date().toISOString(),
                device_info: {
                    platform: Platform.isIOS() ? 'ios' : Platform.isAndroid() ? 'android' : 'web',
                    model: uploadItem.photoData.deviceInfo?.model || 'Unknown',
                    upload_method: 'auto-upload'
                }
            };

            // Generate hash for deduplication
            if (uploadData.file_data) {
                uploadData.sha256_hash = await Utils.generateSHA256(uploadData.file_data);
            }

            // Upload to Supabase
            const { data, error } = await supabase
                .from('mobile_uploads')
                .insert([uploadData])
                .select();

            if (error) {
                throw new Error(`Upload failed: ${error.message}`);
            }

            return data[0];
        }

        getStats() {
            return {
                ...this.stats,
                activeUploads: this.activeUploads.size,
                queuedUploads: Array.from(this.uploadQueue.values()).filter(u => u.status === 'queued').length,
                successRate: this.stats.totalUploads > 0 ? (this.stats.successfulUploads / this.stats.totalUploads * 100).toFixed(1) : 0
            };
        }

        getStatus() {
            return {
                isActive: this.activeUploads.size > 0,
                queueSize: this.uploadQueue.size,
                stats: this.getStats()
            };
        }
    }

    // ==================== AUTO-UPLOAD SETTINGS ====================
    
    class AutoUploadSettings {
        constructor() {
            this.settings = new Map();
            this.eventSettings = new Map();
        }

        async enableAutoUploadForEvent(eventId, options = {}) {
            const setting = {
                eventId,
                enabled: true,
                enabledAt: new Date(),
                options: {
                    quality: options.quality || 'high',
                    wifiOnly: options.wifiOnly || false,
                    maxFileSize: options.maxFileSize || CONFIG.upload.maxFileSize
                }
            };

            this.eventSettings.set(eventId, setting);
            Utils.log(`Auto-upload enabled for event: ${eventId}`, 'success');
            
            // Save to local storage for persistence
            this.saveSettings();
            
            return true;
        }

        async disableAutoUploadForEvent(eventId) {
            if (this.eventSettings.has(eventId)) {
                this.eventSettings.delete(eventId);
                Utils.log(`Auto-upload disabled for event: ${eventId}`);
                this.saveSettings();
            }
            return true;
        }

        isEnabledForEvent(eventId) {
            const setting = this.eventSettings.get(eventId);
            return setting?.enabled || false;
        }

        getEnabledEvents() {
            return Array.from(this.eventSettings.keys()).filter(eventId => 
                this.isEnabledForEvent(eventId)
            );
        }

        saveSettings() {
            try {
                const settingsData = {
                    eventSettings: Array.from(this.eventSettings.entries())
                };
                localStorage.setItem('photoshare_auto_upload_settings', JSON.stringify(settingsData));
            } catch (error) {
                Utils.log(`Failed to save settings: ${error.message}`, 'error');
            }
        }

        loadSettings() {
            try {
                const saved = localStorage.getItem('photoshare_auto_upload_settings');
                if (saved) {
                    const data = JSON.parse(saved);
                    this.eventSettings = new Map(data.eventSettings || []);
                    Utils.log(`Loaded settings for ${this.eventSettings.size} events`);
                }
            } catch (error) {
                Utils.log(`Failed to load settings: ${error.message}`, 'error');
            }
        }
    }

    // ==================== PHOTO MONITOR (iOS ONLY) ====================
    
    class PhotoMonitor {
        constructor() {
            this.isMonitoring = false;
            this.lastPhotoCheck = null;
        }

        async startMonitoring() {
            if (!Platform.hasPhotos()) {
                Utils.log('Photo monitoring not available on this platform', 'warning');
                return false;
            }

            // Request photo library permissions first
            const hasPermissions = await this.requestPhotoPermissions();
            if (!hasPermissions) {
                Utils.log('Photo permissions not granted', 'error');
                return false;
            }

            this.isMonitoring = true;
            this.lastPhotoCheck = new Date();
            
            Utils.log('Photo monitoring started with permissions', 'success');
            
            // Check for new photos every 30 seconds
            this.monitorInterval = setInterval(() => {
                this.checkForNewPhotos();
            }, 30000);

            // Initial photo check
            setTimeout(() => this.checkForNewPhotos(), 2000);

            return true;
        }

        async requestPhotoPermissions() {
            if (!Platform.isNative()) return false;

            try {
                const permissions = await window.Capacitor.Plugins.Camera.requestPermissions(['photos']);
                Utils.log('Photo permissions result:', permissions.photos);
                return permissions.photos === 'granted';
            } catch (error) {
                Utils.log('Error requesting photo permissions:', error.message, 'error');
                return false;
            }
        }

        stopMonitoring() {
            this.isMonitoring = false;
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            Utils.log('Photo monitoring stopped');
        }

        async checkForNewPhotos() {
            if (!this.isMonitoring) return;

            try {
                Utils.log('Checking for new photos using iOS Camera plugin...');
                
                // For iOS, we need to use the Camera plugin's pickImages method
                // This is a workaround since getPhotos() isn't implemented
                
                const settingsService = window.PhotoShareAutoUpload?.settingsService;
                const enabledEvents = settingsService?.getEnabledEvents() || [];
                
                if (enabledEvents.length === 0) {
                    Utils.log('No enabled events, skipping photo check');
                    return;
                }
                
                // Since iOS doesn't have automatic photo detection via Capacitor,
                // we'll create a manual photo upload interface
                this.createManualPhotoInterface();
                
            } catch (error) {
                Utils.log(`Photo check failed: ${error.message}`, 'error');
            }
        }

        createManualPhotoInterface() {
            // Only create once
            if (document.getElementById('manual-photo-upload')) return;

            const uploadInterface = document.createElement('div');
            uploadInterface.id = 'manual-photo-upload';
            uploadInterface.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 999999;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                min-width: 200px;
            `;

            const enabledEvents = window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
            const eventCount = enabledEvents.length;

            uploadInterface.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>📤 Auto-Upload Active</strong><br/>
                    <small>${eventCount} event${eventCount !== 1 ? 's' : ''} enabled</small>
                </div>
                <button id="upload-photos-btn" style="
                    width: 100%;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-bottom: 8px;
                ">📷 Upload Photos</button>
                <button id="close-upload-interface" style="
                    width: 100%;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">Hide</button>
            `;

            document.body.appendChild(uploadInterface);

            // Add event listeners
            document.getElementById('upload-photos-btn').addEventListener('click', () => {
                this.triggerPhotoUpload();
            });

            document.getElementById('close-upload-interface').addEventListener('click', () => {
                uploadInterface.remove();
            });

            Utils.log('Manual photo upload interface created');
        }

        async triggerPhotoUpload() {
            try {
                Utils.log('Triggering photo upload via Camera plugin...');

                // Use Camera plugin to pick photos
                const image = await window.Capacitor.Plugins.Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: window.Capacitor.Plugins.Camera.CameraResultType.DataUrl,
                    source: window.Capacitor.Plugins.Camera.CameraSource.Photos
                });

                if (image?.dataUrl) {
                    Utils.log('Photo selected, queuing for upload...', 'success');
                    
                    // Get enabled events
                    const enabledEvents = window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || [];
                    
                    if (enabledEvents.length === 0) {
                        Utils.log('No enabled events for upload', 'warning');
                        return;
                    }

                    // Create photo data object
                    const photoData = {
                        base64Data: image.dataUrl,
                        filename: `photo_${Date.now()}.jpg`,
                        mimeType: 'image/jpeg',
                        fileSize: image.dataUrl.length,
                        createdAt: new Date().toISOString(),
                        source: 'manual-upload'
                    };

                    // Upload to each enabled event
                    for (const eventId of enabledEvents) {
                        try {
                            const uploadService = window.PhotoShareAutoUpload?.uploadService;
                            if (uploadService) {
                                const uploadId = await uploadService.queuePhotoUpload(photoData, eventId);
                                Utils.log(`Photo queued for event ${eventId}: ${uploadId}`, 'success');
                            }
                        } catch (uploadError) {
                            Utils.log(`Upload failed for event ${eventId}: ${uploadError.message}`, 'error');
                        }
                    }

                    // Show success notification
                    this.showUploadNotification('📤 Photo queued for upload to enabled events!');
                }

            } catch (error) {
                Utils.log(`Photo upload failed: ${error.message}`, 'error');
                this.showUploadNotification('❌ Photo upload failed: ' + error.message);
            }
        }

        showUploadNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                background: #333;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 5000);
        }

        getStatus() {
            return {
                isMonitoring: this.isMonitoring,
                lastCheck: this.lastPhotoCheck,
                platform: Platform.isIOS() ? 'ios' : Platform.isAndroid() ? 'android' : 'web'
            };
        }
    }

    // ==================== UI INTEGRATION ====================
    
    class UIIntegration {
        constructor() {
            this.dashboardVisible = false;
        }

        initialize() {
            this.createDashboard();
            this.addEventListeners();
            this.addAutoUploadControls();
        }

        createDashboard() {
            // Remove existing dashboard
            const existing = document.getElementById('photoshare-auto-upload-dashboard');
            if (existing) existing.remove();

            const dashboard = document.createElement('div');
            dashboard.id = 'photoshare-auto-upload-dashboard';
            dashboard.style.cssText = `
                position: fixed;
                top: -350px;
                left: 10px;
                right: 10px;
                height: 330px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                padding: 15px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13px;
                z-index: 999999;
                transition: top 0.4s ease;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.2);
            `;

            dashboard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 8px;">
                    <h3 style="margin: 0; font-size: 16px;">📱 PhotoShare Auto-Upload</h3>
                    <button onclick="window.PhotoShareAutoUpload.hideDashboard()" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 4px; padding: 6px 10px; cursor: pointer;">✕</button>
                </div>
                <div id="auto-upload-dashboard-content" style="height: 250px; overflow-y: auto;">
                    <div style="text-align: center; padding: 20px; opacity: 0.8;">Loading...</div>
                </div>
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 11px; opacity: 0.7; text-align: center;">
                    3-finger tap, shake device, or console: showDashboard()
                </div>
            `;

            document.body.appendChild(dashboard);
        }

        showDashboard() {
            const dashboard = document.getElementById('photoshare-auto-upload-dashboard');
            if (dashboard) {
                dashboard.style.top = '20px';
                this.dashboardVisible = true;
                this.updateDashboardContent();
            }
        }

        hideDashboard() {
            const dashboard = document.getElementById('photoshare-auto-upload-dashboard');
            if (dashboard) {
                dashboard.style.top = '-350px';
                this.dashboardVisible = false;
            }
        }

        toggleDashboard() {
            if (this.dashboardVisible) {
                this.hideDashboard();
            } else {
                this.showDashboard();
            }
        }

        updateDashboardContent() {
            const content = document.getElementById('auto-upload-dashboard-content');
            if (!content) return;

            const autoUpload = window.PhotoShareAutoUpload;
            const authService = autoUpload?.authService;
            const uploadService = autoUpload?.uploadService;
            const settingsService = autoUpload?.settingsService;
            const photoMonitor = autoUpload?.photoMonitor;

            const authStatus = authService?.isAuthenticated() ? '✅' : '❌';
            const user = authService?.getCurrentUser();
            const uploadStats = uploadService?.getStats() || {};
            const monitorStatus = photoMonitor?.getStatus() || {};
            const enabledEvents = settingsService?.getEnabledEvents() || [];

            content.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>🌐 Environment</strong><br/>
                    📱 Platform: ${Platform.isIOS() ? 'iOS' : Platform.isAndroid() ? 'Android' : 'Web'}<br/>
                    🎯 Native App: ${Platform.isNative() ? 'Yes' : 'No'}<br/>
                    📷 Camera Access: ${Platform.hasCamera() ? 'Yes' : 'No'}
                </div>

                <div style="margin-bottom: 12px;">
                    <strong>🔐 Authentication</strong><br/>
                    ${authStatus} Status: ${user ? `Signed in as ${user.email}` : 'Not signed in'}
                </div>

                <div style="margin-bottom: 12px;">
                    <strong>📤 Upload Service</strong><br/>
                    ✅ Service: Loaded<br/>
                    📊 Success Rate: ${uploadStats.successRate || 0}%<br/>
                    📈 Total Uploads: ${uploadStats.totalUploads || 0}<br/>
                    ⏳ Active: ${uploadStats.activeUploads || 0}
                </div>

                <div style="margin-bottom: 12px;">
                    <strong>⚙️ Auto-Upload Settings</strong><br/>
                    📅 Enabled Events: ${enabledEvents.length}<br/>
                    ${enabledEvents.length > 0 ? enabledEvents.map(id => `• Event ${id}`).join('<br/>') : '• No events enabled'}
                </div>

                ${Platform.hasPhotos() ? `
                    <div style="margin-bottom: 12px;">
                        <strong>📷 Photo Monitor</strong><br/>
                        ${monitorStatus.isMonitoring ? '🟢' : '⚪'} Status: ${monitorStatus.isMonitoring ? 'Active' : 'Inactive'}<br/>
                        ⏰ Last Check: ${monitorStatus.lastCheck ? new Date(monitorStatus.lastCheck).toLocaleTimeString() : 'Never'}
                    </div>
                ` : ''}

                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="window.PhotoShareAutoUpload.reinitialize()" 
                            style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; padding: 8px 16px; cursor: pointer; margin: 0 5px;">
                        🔄 Refresh
                    </button>
                    ${Platform.hasPhotos() ? `
                        <button onclick="window.PhotoShareAutoUpload.toggleMonitoring()" 
                                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; padding: 8px 16px; cursor: pointer; margin: 0 5px;">
                            ${monitorStatus.isMonitoring ? '⏸️ Stop' : '▶️ Start'}
                        </button>
                    ` : ''}
                </div>
            `;
        }

        addEventListeners() {
            // Touch gesture for 3-finger tap
            let touchCount = 0;
            document.addEventListener('touchstart', (e) => {
                if (e.touches.length === 3) {
                    touchCount++;
                    setTimeout(() => {
                        if (touchCount >= 1) {
                            this.toggleDashboard();
                        }
                        touchCount = 0;
                    }, 1000);
                }
            });

            // Shake detection for mobile devices
            if (window.DeviceMotionEvent) {
                let lastShake = 0;
                window.addEventListener('devicemotion', (e) => {
                    const now = Date.now();
                    if (now - lastShake < 1000) return;

                    const acc = e.accelerationIncludingGravity;
                    if (acc && (Math.abs(acc.x) > 12 || Math.abs(acc.y) > 12 || Math.abs(acc.z) > 12)) {
                        lastShake = now;
                        this.toggleDashboard();
                    }
                });
            }
        }

        addAutoUploadControls() {
            // Add auto-upload controls to event pages
            // This would scan for event elements and add toggle buttons
            const eventElements = document.querySelectorAll('[data-event-id], .event-card, .event-item');
            eventElements.forEach(element => {
                this.addToggleToEvent(element);
            });
        }

        addToggleToEvent(eventElement) {
            const eventId = eventElement.dataset.eventId || 
                           eventElement.getAttribute('data-event-id') || 
                           eventElement.id;
            
            if (!eventId || eventElement.querySelector('.auto-upload-toggle')) return;

            const toggle = document.createElement('div');
            toggle.className = 'auto-upload-toggle';
            toggle.style.cssText = `
                margin-top: 10px;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 6px;
                border-left: 3px solid #007bff;
            `;

            const isEnabled = window.PhotoShareAutoUpload?.settingsService?.isEnabledForEvent(eventId);

            toggle.innerHTML = `
                <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                           style="margin-right: 8px;"
                           onchange="window.PhotoShareAutoUpload.toggleEventUpload('${eventId}', this.checked)">
                    <span>📤 Auto-upload photos from this event</span>
                </label>
            `;

            eventElement.appendChild(toggle);
        }
    }

    // ==================== MAIN AUTO-UPLOAD CLASS ====================
    
    class PhotoShareAutoUpload {
        constructor() {
            this.initialized = false;
            this.authService = new AuthService();
            this.uploadService = new ReliableUploadService();
            this.settingsService = new AutoUploadSettings();
            this.photoMonitor = new PhotoMonitor();
            this.uiIntegration = new UIIntegration();
        }

        async initialize() {
            if (this.initialized) return;

            Utils.log('Initializing PhotoShare Auto-Upload...');

            try {
                // Load saved settings
                this.settingsService.loadSettings();

                // Initialize authentication with retry logic
                let authInitialized = false;
                let retries = 0;
                const maxRetries = 5;

                while (!authInitialized && retries < maxRetries) {
                    authInitialized = await this.authService.initialize();
                    if (!authInitialized) {
                        retries++;
                        Utils.log(`Auth initialization attempt ${retries}/${maxRetries} failed, retrying...`);
                        await Utils.delay(2000); // Wait 2 seconds before retry
                    }
                }

                if (!authInitialized) {
                    Utils.log('Authentication initialization failed after retries, continuing anyway...', 'warning');
                }

                // Initialize UI
                this.uiIntegration.initialize();

                // Start photo monitoring if on supported platform
                if (Platform.hasPhotos()) {
                    await this.photoMonitor.startMonitoring();
                }

                this.initialized = true;
                Utils.log('PhotoShare Auto-Upload initialized successfully!', 'success');

                // Update dashboard after short delay
                setTimeout(() => {
                    this.uiIntegration.updateDashboardContent();
                }, 1000);

                // Set up auth state monitoring
                this.setupAuthStateMonitoring();

            } catch (error) {
                Utils.log(`Initialization failed: ${error.message}`, 'error');
            }
        }

        setupAuthStateMonitoring() {
            // Listen for auth bridge events
            window.addEventListener('photoshare-auth-change', (event) => {
                Utils.log('Auth state changed, reinitializing...', 'success');
                setTimeout(() => {
                    this.authService.initialize().then(() => {
                        this.uiIntegration.updateDashboardContent();
                    });
                }, 1000);
            });

            // Periodic auth check
            setInterval(async () => {
                if (this.authService.supabaseClient && !this.authService.currentUser) {
                    try {
                        const { data: { user } } = await this.authService.supabaseClient.auth.getUser();
                        if (user && user !== this.authService.currentUser) {
                            Utils.log('Auth state change detected, updating...', 'success');
                            this.authService.currentUser = user;
                            this.uiIntegration.updateDashboardContent();
                        }
                    } catch (error) {
                        // Silently ignore periodic check errors
                    }
                }
            }, 5000); // Check every 5 seconds
        }

        async reinitialize() {
            Utils.log('Reinitializing PhotoShare Auto-Upload...');
            this.initialized = false;
            await this.initialize();
        }

        // Dashboard controls
        showDashboard() {
            this.uiIntegration.showDashboard();
        }

        hideDashboard() {
            this.uiIntegration.hideDashboard();
        }

        toggleDashboard() {
            this.uiIntegration.toggleDashboard();
        }

        // Event management
        async toggleEventUpload(eventId, enabled) {
            if (enabled) {
                await this.settingsService.enableAutoUploadForEvent(eventId);
                Utils.log(`Auto-upload enabled for event ${eventId}`, 'success');
            } else {
                await this.settingsService.disableAutoUploadForEvent(eventId);
                Utils.log(`Auto-upload disabled for event ${eventId}`);
            }
            this.uiIntegration.updateDashboardContent();
        }

        // Monitoring controls
        toggleMonitoring() {
            if (this.photoMonitor.isMonitoring) {
                this.photoMonitor.stopMonitoring();
            } else {
                this.photoMonitor.startMonitoring();
            }
            this.uiIntegration.updateDashboardContent();
        }

        // Status and stats
        getStatus() {
            return {
                initialized: this.initialized,
                platform: {
                    isNative: Platform.isNative(),
                    isIOS: Platform.isIOS(),
                    isAndroid: Platform.isAndroid(),
                    hasCamera: Platform.hasCamera()
                },
                auth: {
                    authenticated: this.authService.isAuthenticated(),
                    user: this.authService.getCurrentUser()
                },
                upload: this.uploadService.getStatus(),
                monitor: this.photoMonitor.getStatus(),
                settings: {
                    enabledEvents: this.settingsService.getEnabledEvents()
                }
            };
        }

        // Manual upload
        async uploadPhoto(photoData, eventId) {
            return await this.uploadService.queuePhotoUpload(photoData, eventId);
        }
    }

    // ==================== INITIALIZATION ====================
    
    // Create global instance
    window.PhotoShareAutoUpload = new PhotoShareAutoUpload();

    // Expose convenience functions
    window.showDashboard = () => window.PhotoShareAutoUpload.showDashboard();
    window.hideDashboard = () => window.PhotoShareAutoUpload.hideDashboard();
    window.toggleDashboard = () => window.PhotoShareAutoUpload.toggleDashboard();
    
    // Debug functions for troubleshooting
    window.diagnoseLiveEvents = async () => {
        console.log('🔍 LIVE EVENTS DIAGNOSTIC');
        console.log('========================');
        
        const autoUpload = window.PhotoShareAutoUpload;
        if (!autoUpload) {
            console.log('❌ PhotoShareAutoUpload not available');
            return;
        }
        
        // Check authentication
        const auth = autoUpload.authService;
        const user = auth?.getCurrentUser();
        console.log('🔐 Authentication:');
        console.log('  - User:', user ? `${user.email} (${user.id})` : 'Not authenticated');
        console.log('  - Supabase:', !!auth?.getSupabaseClient());
        
        // Check mobile settings
        const settings = autoUpload.settingsService;
        const enabledEvents = settings?.getEnabledEvents() || [];
        console.log('\n⚙️ Mobile Settings:');
        console.log('  - Enabled events count:', enabledEvents.length);
        console.log('  - Enabled events:', enabledEvents);
        
        if (settings?.eventSettings) {
            console.log('  - All stored settings:');
            settings.eventSettings.forEach((setting, eventId) => {
                console.log(`    ${eventId}: enabled=${setting.enabled}, options=`, setting.options);
            });
        }
        
        // Check local storage
        const stored = localStorage.getItem('photoshare_auto_upload_settings');
        console.log('\n💾 Local Storage:');
        console.log('  - Has data:', !!stored);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                console.log('  - Stored events:', parsed.eventSettings?.length || 0);
            } catch (e) {
                console.log('  - Parse error:', e.message);
            }
        }
        
        // Check backend if available
        if (user && auth?.getSupabaseClient()) {
            console.log('\n🌐 Checking backend...');
            try {
                const { data, error } = await auth.getSupabaseClient()
                    .from('event_participants')
                    .select('event_id, auto_upload_enabled, auto_upload_start_time, auto_upload_end_time')
                    .eq('user_id', user.id);
                
                if (error) {
                    console.log('  - Backend error:', error.message);
                } else {
                    const autoEnabled = data.filter(p => p.auto_upload_enabled);
                    console.log('  - Total participations:', data.length);
                    console.log('  - Auto-upload enabled:', autoEnabled.length);
                    console.log('  - Backend enabled events:', autoEnabled.map(p => p.event_id));
                    
                    if (autoEnabled.length > 0) {
                        console.log('  - Backend details:', autoEnabled);
                    }
                }
            } catch (backendError) {
                console.log('  - Backend check failed:', backendError.message);
            }
        }
        
        // Check URL for current event
        console.log('\n🎯 Current Page:');
        console.log('  - URL:', window.location.href);
        console.log('  - Pathname:', window.location.pathname);
        
        // URL event detection
        const url = window.location.href;
        const eventPatterns = [
            /\/event\/([^\/\?]+)/i,
            /\/events\/([^\/\?]+)/i,
            /event[_-]?id[=:]([^&\?]+)/i
        ];
        
        let urlEventId = null;
        for (const pattern of eventPatterns) {
            const match = url.match(pattern);
            if (match) {
                urlEventId = match[1];
                break;
            }
        }
        console.log('  - Detected event ID from URL:', urlEventId || 'None');
        
        // Quick fixes
        console.log('\n🔧 QUICK FIXES:');
        console.log('1. Force reinitialize: quickFixReinit()');
        console.log('2. Manual event toggle: manualToggle("EVENT_ID", true)');
        console.log('3. Show current status: window.PhotoShareAutoUpload.getStatus()');
        if (urlEventId) {
            console.log(`4. Toggle current event: manualToggle("${urlEventId}", true)`);
        }
    };
    
    window.quickFixReinit = async () => {
        console.log('🔧 Reinitializing auto-upload system...');
        try {
            await window.PhotoShareAutoUpload.reinitialize();
            console.log('✅ Reinitialized successfully');
            setTimeout(() => {
                console.log('📊 New status:', window.PhotoShareAutoUpload.getStatus());
            }, 2000);
        } catch (error) {
            console.log('❌ Reinitialize failed:', error);
        }
    };
    
    window.manualToggle = async (eventId, enabled = true) => {
        console.log(`🔧 Manual toggle: Event ${eventId} = ${enabled}`);
        try {
            const settings = window.PhotoShareAutoUpload?.settingsService;
            if (enabled) {
                await settings.enableAutoUploadForEvent(eventId);
                console.log(`✅ Enabled auto-upload for event: ${eventId}`);
            } else {
                await settings.disableAutoUploadForEvent(eventId);
                console.log(`❌ Disabled auto-upload for event: ${eventId}`);
            }
            
            // Update dashboard
            if (window.PhotoShareAutoUpload?.uiIntegration) {
                window.PhotoShareAutoUpload.uiIntegration.updateDashboardContent();
            }
            
            // Show updated status
            setTimeout(() => {
                const newEnabledEvents = settings.getEnabledEvents();
                console.log('📊 Updated enabled events:', newEnabledEvents);
            }, 1000);
            
        } catch (error) {
            console.log('❌ Manual toggle failed:', error);
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => window.PhotoShareAutoUpload.initialize(), 1000);
        });
    } else {
        setTimeout(() => window.PhotoShareAutoUpload.initialize(), 1000);
    }

    Utils.log('PhotoShare Auto-Upload Bundle loaded successfully!', 'success');
    Utils.log('Access dashboard: 3-finger tap, shake device, or showDashboard()');

})();