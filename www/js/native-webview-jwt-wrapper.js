/**
 * Native WebView JWT Wrapper
 * Specifically designed for Android WebView evaluateJavascript() calls
 * Provides both Promise and callback-based access to JWT tokens
 */

console.log('🔗 Native WebView JWT Wrapper loading...');

(function() {
    'use strict';

    // Store the latest JWT token for synchronous access
    let cachedJwtToken = null;
    let tokenLastFetched = 0;
    let tokenExpiresAt = 0;
    let isRefreshing = false;
    let refreshTimer = null;
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000; // Refresh 5 minutes before expiry

    // Native-friendly JWT token access
    window.NativeWebViewJWT = {
        /**
         * Synchronous JWT token access for WebView evaluateJavascript()
         * Returns cached token if available and fresh
         */
        getTokenSync: function() {
            console.log('📱 Sync JWT token request');
            
            // PERMISSION GATE: Block token if permissions pending
            if (window.PhotoSharePermissionGate?.blocked) {
                console.log('⛔ Token blocked by permission gate - permissions pending');
                return null;
            }
            
            const now = Date.now();
            
            if (cachedJwtToken && (now - tokenLastFetched) < CACHE_DURATION) {
                console.log('✅ Returning cached JWT token');
                return cachedJwtToken;
            }
            
            console.log('⏳ No cached token available - use refreshToken() first');
            return null;
        },

        /**
         * Refresh JWT token asynchronously and cache it
         * Should be called before getTokenSync()
         */
        refreshToken: async function() {
            // PERMISSION GATE: Block token if permissions pending
            if (window.PhotoSharePermissionGate?.blocked) {
                console.log('⛔ Token refresh blocked by permission gate - permissions pending');
                return null;
            }
            
            if (isRefreshing) {
                console.log('⏳ Token refresh already in progress...');
                return cachedJwtToken;
            }

            isRefreshing = true;
            
            try {
                console.log('🔄 Refreshing JWT token for native access...');
                
                // Use the main JWT function
                if (!window.getJwtTokenForNativePlugin) {
                    console.error('❌ Main JWT function not available');
                    return null;
                }

                const token = await window.getJwtTokenForNativePlugin();
                
                if (token) {
                    cachedJwtToken = token;
                    tokenLastFetched = Date.now();
                    
                    // Parse JWT to get actual expiration time
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        tokenExpiresAt = payload.exp * 1000; // Convert to milliseconds
                        
                        console.log('✅ JWT token cached for native access');
                        console.log('🔍 Token info:', {
                            tokenLength: token.length,
                            tokenPreview: token.substring(0, 20) + '...',
                            cachedAt: new Date().toISOString(),
                            expiresAt: new Date(tokenExpiresAt).toISOString(),
                            timeUntilExpiry: Math.floor((tokenExpiresAt - Date.now()) / 1000 / 60) + ' minutes'
                        });
                        
                        // Schedule proactive refresh before token expires
                        this.scheduleProactiveRefresh();
                    } catch (parseError) {
                        console.warn('⚠️ Could not parse JWT expiration:', parseError);
                        tokenExpiresAt = Date.now() + (55 * 60 * 1000); // Assume 55 minutes from now
                    }
                } else {
                    console.log('❌ Failed to retrieve JWT token');
                    cachedJwtToken = null;
                    tokenExpiresAt = 0;
                }

                return token;
            } catch (error) {
                console.error('❌ JWT token refresh failed:', error);
                cachedJwtToken = null;
                tokenExpiresAt = 0;
                return null;
            } finally {
                isRefreshing = false;
            }
        },

        /**
         * Schedule proactive token refresh before expiration
         */
        scheduleProactiveRefresh: function() {
            // Clear existing timer
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }

            if (!tokenExpiresAt) return;

            const now = Date.now();
            const timeUntilExpiry = tokenExpiresAt - now;
            const refreshTime = Math.max(timeUntilExpiry - REFRESH_BEFORE_EXPIRY, 30000); // At least 30 seconds

            if (refreshTime > 0) {
                console.log('⏰ Scheduling proactive token refresh in', Math.floor(refreshTime / 1000 / 60), 'minutes');
                
                refreshTimer = setTimeout(() => {
                    console.log('🔄 Proactive JWT token refresh triggered');
                    this.refreshToken().catch(error => {
                        console.error('❌ Proactive refresh failed:', error);
                    });
                }, refreshTime);
            }
        },

        /**
         * Get token with automatic refresh if needed
         * Best for WebView calls that can handle Promises
         */
        getTokenWithRefresh: async function() {
            console.log('📱 JWT token with auto-refresh request');
            
            // PERMISSION GATE: Block token if permissions pending
            if (window.PhotoSharePermissionGate?.blocked) {
                console.log('⛔ Token blocked by permission gate - permissions pending');
                return null;
            }
            
            const now = Date.now();
            const needsRefresh = !cachedJwtToken || (now - tokenLastFetched) >= CACHE_DURATION;
            
            if (needsRefresh) {
                console.log('🔄 Token needs refresh, refreshing...');
                await this.refreshToken();
            }
            
            return this.getTokenSync();
        },

        /**
         * Callback-based token access for native integration
         * @param {Function} callback - Called with (error, token)
         */
        getTokenCallback: function(callback) {
            console.log('📱 Callback-based JWT token request');
            
            if (typeof callback !== 'function') {
                console.error('❌ Callback must be a function');
                return;
            }

            this.getTokenWithRefresh()
                .then(token => {
                    if (token) {
                        callback(null, token);
                    } else {
                        callback(new Error('No JWT token available'), null);
                    }
                })
                .catch(error => {
                    callback(error, null);
                });
        },

        /**
         * Check if cached token is available and valid
         */
        hasValidToken: function() {
            const now = Date.now();
            const cacheValid = cachedJwtToken && (now - tokenLastFetched) < CACHE_DURATION;
            const tokenNotExpired = tokenExpiresAt > now + 60000; // At least 1 minute left
            const isValid = cacheValid && tokenNotExpired;
            
            console.log('🔍 Token validity check:', {
                hasToken: !!cachedJwtToken,
                cacheExpired: cachedJwtToken && (now - tokenLastFetched) >= CACHE_DURATION,
                tokenExpired: tokenExpiresAt > 0 && tokenExpiresAt <= now,
                tokenExpiresSoon: tokenExpiresAt > 0 && tokenExpiresAt <= now + 60000,
                timeUntilExpiry: tokenExpiresAt > 0 ? Math.floor((tokenExpiresAt - now) / 1000 / 60) + ' minutes' : 'unknown',
                isValid: isValid
            });
            
            return isValid;
        },

        /**
         * Clear cached token (useful for logout)
         */
        clearToken: function() {
            console.log('🗑️ Clearing cached JWT token');
            cachedJwtToken = null;
            tokenLastFetched = 0;
            tokenExpiresAt = 0;
            
            // Clear refresh timer
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
        },

        /**
         * Get detailed status for debugging
         */
        getStatus: function() {
            const now = Date.now();
            return {
                hasToken: !!cachedJwtToken,
                tokenAge: cachedJwtToken ? now - tokenLastFetched : 0,
                cacheExpired: cachedJwtToken ? (now - tokenLastFetched) >= CACHE_DURATION : true,
                tokenExpired: tokenExpiresAt > 0 ? tokenExpiresAt <= now : true,
                tokenExpiresSoon: tokenExpiresAt > 0 ? tokenExpiresAt <= now + 300000 : true, // 5 minutes
                timeUntilExpiry: tokenExpiresAt > 0 ? tokenExpiresAt - now : 0,
                expiresAt: tokenExpiresAt > 0 ? new Date(tokenExpiresAt).toISOString() : null,
                isRefreshing: isRefreshing,
                hasRefreshTimer: !!refreshTimer,
                cacheExpiry: CACHE_DURATION,
                lastFetched: tokenLastFetched ? new Date(tokenLastFetched).toISOString() : null
            };
        }
    };

    // Auto-refresh token when auth state changes
    window.addEventListener('photoshare-auth-change', function(event) {
        console.log('🔄 Auth state changed, clearing JWT cache');
        window.NativeWebViewJWT.clearToken();
        
        // Refresh token if user is authenticated
        if (event.detail.session && event.detail.user) {
            setTimeout(() => {
                window.NativeWebViewJWT.refreshToken();
            }, 1000);
        }
    });

    // Initialize token cache if already authenticated
    setTimeout(() => {
        if (window.PhotoShareAuthState?.authenticated) {
            console.log('🔄 User already authenticated, caching JWT token');
            window.NativeWebViewJWT.refreshToken();
        }
    }, 2000);

    console.log('✅ Native WebView JWT Wrapper ready');
})();