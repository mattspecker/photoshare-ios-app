/**
 * Native Plugin Authentication Helper
 * Provides easy JWT token access for Capacitor plugins
 */

console.log('🔌 Native Plugin Auth Helper loading...');

(function() {
    'use strict';

    // Helper class for native plugin authentication
    class NativePluginAuthHelper {
        constructor() {
            this.retryCount = 0;
            this.maxRetries = 10;
        }

        // Wait for PhotoShare auth system to be ready
        async waitForAuth() {
            return new Promise((resolve, reject) => {
                const checkAuth = () => {
                    this.retryCount++;
                    
                    if (window.getJwtTokenForNativePlugin) {
                        console.log('✅ Native auth helper ready');
                        resolve(true);
                    } else if (this.retryCount >= this.maxRetries) {
                        console.log('❌ Native auth helper timeout');
                        reject(new Error('Auth system not ready'));
                    } else {
                        console.log(`⏳ Waiting for auth system... (${this.retryCount}/${this.maxRetries})`);
                        setTimeout(checkAuth, 500);
                    }
                };
                
                checkAuth();
            });
        }

        // Get JWT token with retry logic
        async getJwtToken() {
            // PERMISSION GATE: Block token if permissions pending
            if (window.PhotoSharePermissionGate?.blocked) {
                console.log('⛔ Native Plugin Auth: Token blocked by permission gate');
                return null;
            }
            
            try {
                await this.waitForAuth();
                return await window.getJwtTokenForNativePlugin();
            } catch (error) {
                console.error('Failed to get JWT token:', error);
                return null;
            }
        }

        // Get user info
        async getUser() {
            try {
                if (window.PhotoShareAuthState?.user) {
                    return window.PhotoShareAuthState.user;
                }
                
                if (window.getCurrentUserFromWebsite) {
                    return await window.getCurrentUserFromWebsite();
                }
                
                return null;
            } catch (error) {
                console.error('Failed to get user:', error);
                return null;
            }
        }

        // Check if user is authenticated
        async isAuthenticated() {
            const token = await this.getJwtToken();
            return !!token;
        }

        // Get auth headers for API calls with security validation
        async getAuthHeaders() {
            // PERMISSION GATE: Block if permissions pending
            if (window.PhotoSharePermissionGate?.blocked) {
                throw new Error('Permissions required - please complete app setup');
            }
            
            // Security Check: Only work in native environment
            if (!window.Capacitor?.isNativePlatform()) {
                throw new Error('Upload only allowed on native platforms');
            }

            const token = await this.getJwtToken();
            
            if (!token) {
                throw new Error('Authentication required for upload');
            }
            
            // Add security headers
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY',
                'X-Client-Platform': window.Capacitor?.getPlatform() || 'unknown',
                'X-Client-Version': '1.0.0',
                'X-Upload-Source': 'native-plugin'
            };
        }

        // Upload file using mobile-upload API with security validation
        async uploadFile(eventId, fileName, fileData, mediaType, metadata = {}) {
            try {
                // Security Check 1: Validate inputs
                if (!eventId || !fileName || !fileData || !mediaType) {
                    throw new Error('Missing required upload parameters');
                }

                // Security Check 2: Validate media type
                const allowedTypes = ['photo', 'video'];
                if (!allowedTypes.includes(mediaType)) {
                    throw new Error('Invalid media type - only photo and video allowed');
                }

                // Security Check 3: Validate file size (base64 length roughly equals file size)
                const maxSizeBytes = mediaType === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB video, 10MB photo
                const estimatedSize = (fileData.length * 3) / 4; // Base64 to bytes approximation
                if (estimatedSize > maxSizeBytes) {
                    throw new Error(`File too large - ${mediaType} must be under ${maxSizeBytes / (1024 * 1024)}MB`);
                }

                // Security Check 4: Validate file name
                if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
                    throw new Error('Invalid file name - only alphanumeric characters, dots, hyphens, and underscores allowed');
                }

                const headers = await this.getAuthHeaders();
                
                // Add security metadata
                const secureMetadata = {
                    ...metadata,
                    uploadSource: 'native-plugin',
                    clientPlatform: window.Capacitor?.getPlatform(),
                    uploadTimestamp: new Date().toISOString(),
                    fileSize: estimatedSize
                };
                
                const response = await fetch('https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/mobile-upload', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        eventId,
                        fileName,
                        fileData,
                        mediaType,
                        metadata: secureMetadata
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    
                    // Don't leak sensitive error details
                    let userMessage = 'Upload failed';
                    if (response.status === 401) {
                        userMessage = 'Authentication required';
                    } else if (response.status === 403) {
                        userMessage = 'Upload not permitted';
                    } else if (response.status === 429) {
                        userMessage = 'Rate limit exceeded - please wait';
                    } else if (response.status >= 500) {
                        userMessage = 'Server error - please try again';
                    }
                    
                    console.error('Upload error details:', errorText);
                    throw new Error(userMessage);
                }

                const result = await response.json();
                console.log('✅ Secure upload completed:', fileName);
                return result;
                
            } catch (error) {
                console.error('Secure upload failed:', error.message);
                
                // Log security event for failed uploads
                if (window.PhotoShareAuthBridge) {
                    window.PhotoShareAuthBridge.logSecurityEvent?.('upload_failed', {
                        fileName: fileName,
                        mediaType: mediaType,
                        error: error.message,
                        eventId: eventId
                    });
                }
                
                throw error;
            }
        }
    }

    // Create global instance
    window.NativePluginAuth = new NativePluginAuthHelper();

    // Convenience functions for direct access
    window.getNativeJwtToken = () => window.NativePluginAuth.getJwtToken();
    window.getNativeUser = () => window.NativePluginAuth.getUser();
    window.isNativeAuthenticated = () => window.NativePluginAuth.isAuthenticated();
    window.getNativeAuthHeaders = () => window.NativePluginAuth.getAuthHeaders();
    window.uploadFromNativePlugin = (eventId, fileName, fileData, mediaType, metadata) => 
        window.NativePluginAuth.uploadFile(eventId, fileName, fileData, mediaType, metadata);

    console.log('✅ Native Plugin Auth Helper ready');
})();