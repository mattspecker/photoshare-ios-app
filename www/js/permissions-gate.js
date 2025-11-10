/**
 * Permission Gate Bootstrap Script
 * CRITICAL: Loads FIRST before any auth/upload logic
 * Prevents auto-upload until all required permissions are granted
 */

console.log('🚪 Permission Gate Bootstrap loading...');

(function() {
    'use strict';

    // Global permission gate state
    window.PhotoSharePermissionGate = {
        blocked: false,
        reason: 'checking',
        timestamp: Date.now(),
        permissions: {
            photos: 'prompt',
            camera: 'prompt',
            notifications: 'prompt'
        }
    };

    /**
     * Check permissions via native plugin
     */
    async function checkPermissions() {
        try {
            console.log('🚪 PermissionGate: Checking native permissions...');

            // Get AppPermissions plugin reference once
            const AppPermissions = window.Capacitor?.Plugins?.AppPermissions;

            // Check if onboarding was already completed
            if (AppPermissions?.hasCompletedOnboarding) {
                try {
                    const result = await AppPermissions.hasCompletedOnboarding();
                    const hasCompleted = typeof result === 'boolean' ? result : result?.completed;
                    
                    if (hasCompleted) {
                        console.log('🚪 PermissionGate: Onboarding completed - AUTO OPEN');
                        window.PhotoSharePermissionGate.blocked = false;
                        window.PhotoSharePermissionGate.reason = 'onboarding_complete';
                        dispatchComplete();
                        return;
                    }
                } catch (error) {
                    console.warn('🚪 Could not check onboarding status:', error);
                }
            }

            // Detect if we're on native platform
            const isNative = window.Capacitor?.isNativePlatform?.();
            const platform = window.Capacitor?.getPlatform?.();
            const isAndroid = platform === 'android';
            const isIOS = platform === 'ios';

            console.log('🚪 Platform check:', { isNative, platform, isAndroid, isIOS });

            // ✅ CRITICAL FIX: Only skip permission checks for web, not iOS
            if (!isNative) {
                console.log('🚪 Not native platform - gate is OPEN');
                window.PhotoSharePermissionGate.blocked = false;
                window.PhotoSharePermissionGate.reason = 'web_platform';
                dispatchComplete();
                return;
            }

            console.log('🚪 Native platform detected - checking permissions...', { platform });

            // Wait for Capacitor plugins to be ready
            await waitForCapacitor();

            // Check permissions via plugin (AppPermissions already declared above)
            if (!AppPermissions) {
                console.warn('🚪 AppPermissions plugin not available - assuming OK');
                window.PhotoSharePermissionGate.blocked = false;
                window.PhotoSharePermissionGate.reason = 'plugin_unavailable';
                dispatchComplete();
                return;
            }

            // Check photo permission (primary gate)
            let photoPermission = 'prompt';
            try {
                const photoResult = await AppPermissions.checkPhotoPermission();
                photoPermission = photoResult?.permission || 'prompt';
                window.PhotoSharePermissionGate.permissions.photos = photoPermission;
                console.log('🚪 Photo permission:', photoPermission);
            } catch (error) {
                console.warn('🚪 Photo permission check failed:', error);
            }

            // Check camera permission
            let cameraPermission = 'prompt';
            try {
                const cameraResult = await AppPermissions.checkCameraPermission();
                cameraPermission = cameraResult?.permission || 'prompt';
                window.PhotoSharePermissionGate.permissions.camera = cameraPermission;
                console.log('🚪 Camera permission:', cameraPermission);
            } catch (error) {
                console.warn('🚪 Camera permission check failed:', error);
            }

            // Check notification permission
            let notificationPermission = 'prompt';
            try {
                const notifResult = await AppPermissions.checkNotificationPermission();
                notificationPermission = notifResult?.permission || 'prompt';
                window.PhotoSharePermissionGate.permissions.notifications = notificationPermission;
                console.log('🚪 Notification permission:', notificationPermission);
            } catch (error) {
                console.warn('🚪 Notification permission check failed:', error);
            }

            // GATE DECISION: Block if photo permission is not granted
            const shouldBlock = photoPermission !== 'granted';
            
            window.PhotoSharePermissionGate.blocked = shouldBlock;
            window.PhotoSharePermissionGate.reason = shouldBlock ? 'missing_photo_permission' : 'all_granted';
            window.PhotoSharePermissionGate.timestamp = Date.now();

            console.log('🚪 PermissionGate Decision:', {
                blocked: shouldBlock,
                reason: window.PhotoSharePermissionGate.reason,
                permissions: window.PhotoSharePermissionGate.permissions
            });

            if (shouldBlock) {
                dispatchPending();
            } else {
                dispatchComplete();
            }

        } catch (error) {
            console.error('🚪 PermissionGate: Error checking permissions:', error);
            // On error, be permissive (don't block)
            window.PhotoSharePermissionGate.blocked = false;
            window.PhotoSharePermissionGate.reason = 'check_failed';
            dispatchComplete();
        }
    }

    /**
     * Get max wait attempts based on iOS version
     * iOS 17.x.x needs more time for plugin initialization
     */
    function getMaxWaitAttempts() {
        try {
            const platform = window.Capacitor?.getPlatform?.();
            if (platform === 'ios') {
                // Try to get iOS version from Device plugin if available
                const isIOS17 = /OS 17\.|Version\/17\./i.test(navigator.userAgent);
                if (isIOS17) {
                    console.log('🍎 iOS 17.x.x detected - using extended timeout (15 seconds)');
                    return 300; // 300 * 50ms = 15 seconds
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not detect iOS version:', error);
        }
        
        // Default: 5 seconds for other platforms/versions
        return 100; // 100 * 50ms = 5 seconds
    }

    /**
     * Wait for Capacitor to be ready
     */
    function waitForCapacitor() {
        return new Promise((resolve) => {
            if (window.Capacitor?.Plugins) {
                resolve();
                return;
            }

            let attempts = 0;
            // iOS 17.x.x needs more time for plugin initialization
            const maxAttempts = getMaxWaitAttempts();
            const checkInterval = setInterval(() => {
                attempts++;
                if (window.Capacitor?.Plugins) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts > maxAttempts) {
                    clearInterval(checkInterval);
                    console.warn(`⚠️ Capacitor plugins timeout after ${maxAttempts * 50}ms`);
                    resolve();
                }
            }, 50);
        });
    }

    /**
     * Dispatch pending event (permissions needed)
     */
    function dispatchPending() {
        console.log('🚪 PermissionGate: PENDING - Dispatching photoshare-permissions-pending');
        window.dispatchEvent(new CustomEvent('photoshare-permissions-pending', {
            detail: {
                source: 'bootstrap',
                gate: window.PhotoSharePermissionGate
            }
        }));
    }

    /**
     * Dispatch complete event (all permissions granted)
     */
    function dispatchComplete() {
        console.log('🚪 PermissionGate: COMPLETE - Dispatching photoshare-permissions-complete');
        window.dispatchEvent(new CustomEvent('photoshare-permissions-complete', {
            detail: {
                source: 'bootstrap',
                gate: window.PhotoSharePermissionGate
            }
        }));
    }

    /**
     * Public API for native team to hook into
     */
    window.PhotoSharePermissionsEvents = {
        onPending: function(callback) {
            window.addEventListener('photoshare-permissions-pending', callback);
            console.log('🚪 Registered pending listener');
        },
        onComplete: function(callback) {
            window.addEventListener('photoshare-permissions-complete', callback);
            console.log('🚪 Registered complete listener');
        },
        getState: function() {
            return window.PhotoSharePermissionGate;
        },
        // Allow React to update the gate
        setBlocked: function(blocked, reason) {
            window.PhotoSharePermissionGate.blocked = blocked;
            window.PhotoSharePermissionGate.reason = reason || (blocked ? 'react_onboarding' : 'react_complete');
            window.PhotoSharePermissionGate.timestamp = Date.now();
            
            console.log('🚪 PermissionGate updated by React:', {
                blocked,
                reason: window.PhotoSharePermissionGate.reason
            });
            
            if (blocked) {
                dispatchPending();
            } else {
                dispatchComplete();
            }
        }
    };

    /**
     * Promise-based wait for permission gate to complete initial check
     * ANDROID TEAM: Use this instead of polling!
     * 
     * @param {number} timeout - Max time to wait in milliseconds (default: 10000)
     * @returns {Promise<object>} Resolves with gate state when ready
     * 
     * Example usage:
     *   const gate = await window.waitForPermissionGate(5000);
     *   if (gate.blocked) { ... } else { ... }
     */
    window.waitForPermissionGate = function(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const gate = window.PhotoSharePermissionGate;
            
            // If already determined (not 'checking'), return immediately
            if (gate && gate.reason !== 'checking') {
                console.log('🚪 waitForPermissionGate: Already determined:', gate.reason, gate);
                resolve(gate);
                return;
            }
            
            console.log('🚪 waitForPermissionGate: Waiting for initial check... (timeout:', timeout + 'ms)');
            
            // Set timeout
            const timeoutId = setTimeout(() => {
                console.warn('🚪 waitForPermissionGate: TIMEOUT after', timeout + 'ms - defaulting to permissive');
                // On timeout, resolve with permissive state (don't block app)
                resolve({
                    blocked: false,
                    reason: 'timeout',
                    timestamp: Date.now(),
                    permissions: {
                        photos: 'unknown',
                        camera: 'unknown',
                        notifications: 'unknown'
                    }
                });
            }, timeout);
            
            // Handler for completion
            const handleComplete = (event) => {
                clearTimeout(timeoutId);
                const resultGate = event.detail.gate;
                console.log('🚪 waitForPermissionGate: RESOLVED:', {
                    blocked: resultGate.blocked,
                    reason: resultGate.reason,
                    permissions: resultGate.permissions
                });
                resolve(resultGate);
            };
            
            // Listen for either pending or complete (both mean check is done)
            window.addEventListener('photoshare-permissions-pending', handleComplete, { once: true });
            window.addEventListener('photoshare-permissions-complete', handleComplete, { once: true });
            
            // Double-check in case we missed the event (race condition safety)
            setTimeout(() => {
                const currentGate = window.PhotoSharePermissionGate;
                if (currentGate && currentGate.reason !== 'checking') {
                    clearTimeout(timeoutId);
                    console.log('🚪 waitForPermissionGate: Caught via polling:', currentGate.reason);
                    resolve(currentGate);
                }
            }, 50);
        });
    };

    // Wait for bridge coordinator signal from Android
    let bridgeReady = false;
    window.addEventListener('bridge-coordinator-ready', () => {
        console.log('🚪 Bridge coordinator ready signal received');
        bridgeReady = true;
    });
    
    async function checkPermissionsWhenReady() {
        // Wait up to 3 seconds for bridge coordinator
        const startTime = Date.now();
        while (!bridgeReady && (Date.now() - startTime) < 3000) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (!bridgeReady) {
            console.warn('🚪 Bridge coordinator timeout - proceeding anyway');
        }
        
        checkPermissions();
    }

    // Dispatch gate-ready event
    window.dispatchEvent(new CustomEvent('photoshare-permissions-gate-ready', {
        detail: window.PhotoSharePermissionGate
    }));

    // Start permission check (with coordination)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPermissionsWhenReady);
    } else {
        checkPermissionsWhenReady();
    }

    console.log('✅ Permission Gate Bootstrap ready');
})();
