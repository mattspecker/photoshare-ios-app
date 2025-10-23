/**
 * Android FCM Handler for Capacitor 7.4.3
 * Provides global window function for Android native app to handle FCM token requests
 */

console.log('🤖 Android FCM Handler loading...');

(function() {
    'use strict';

    // Prevent multiple simultaneous token requests
    let isTokenRequestInProgress = false;

    // Android FCM Token Handler - build the API object
    const handlerApi = {
        async requestPermissionAndGetToken() {
            try {
                // Prevent multiple simultaneous requests
                if (isTokenRequestInProgress) {
                    console.log('🔄 Android: Token request already in progress, waiting...');
                    return { success: false, error: 'Token request already in progress' };
                }

                isTokenRequestInProgress = true;
                console.log('🔔 Android: Requesting FCM token and device permissions');

                // Check if Capacitor and PushNotifications are available
                if (!window.Capacitor) {
                    console.error('❌ Android: Capacitor not available');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'Capacitor not available' };
                }

                if (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
                    console.error('❌ Android: Not running on native platform');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'Not running on native platform' };
                }

                const pushPlugin = window.Capacitor?.Plugins?.PushNotifications;
                if (!pushPlugin) {
                    console.error('❌ Android: PushNotifications plugin not available');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'PushNotifications plugin not available' };
                }

                console.log('pushPlugin_available : loaded', !!pushPlugin);
                
                // Check if native Android provides initializeFCM method
                const hasNativeInitFCM = typeof pushPlugin.initializeFCM === 'function';
                console.log('hasInitializeFCM : loaded', hasNativeInitFCM);

                if (hasNativeInitFCM) {
                    // Use Android's custom native FCM initialization with built-in retry logic
                    console.log('📱 Android: Using native initializeFCM method (has authentication retry logic)');
                    console.log('using_native_fcm_init : loaded');

                    return new Promise(async (resolve) => {
                        const cleanup = () => {
                            isTokenRequestInProgress = false;
                        };

                        try {
                            // Call native Android FCM initialization
                            // The native method handles:
                            // - FCM token generation
                            // - Authentication retry logic (10 attempts with delays)
                            // - Token registration with Supabase
                            console.log('🎯 Calling native initializeFCM (handles registration with retry logic)...');
                            const initResult = await pushPlugin.initializeFCM();
                            console.log('🎯 Android: Native FCM init result:', initResult);

                            if (initResult && initResult.token) {
                                console.log('✅ FCM Token received from native with successful registration:', { 
                                    platform: 'android',
                                    tokenLength: initResult.token?.length || 0,
                                    tokenPreview: initResult.token?.substring(0, 20) + '...',
                                    isValidToken: initResult.token?.length > 50,
                                    note: 'Token registration with Supabase handled by native code with retry logic'
                                });

                                // Native method attempted registration, now verifying/retrying via web layer
                                // This provides defense-in-depth and triggers React hook's enhanced logging
                                if (window.CapacitorPushNotifications?.registerFCMToken) {
                                    console.log('🔗 [FCM TOKEN] Starting web layer verification/registration...');
                                    try {
                                        const webRegisterResult = await window.CapacitorPushNotifications.registerFCMToken(
                                            initResult.token, 
                                            'android'
                                        );
                                        
                                        if (webRegisterResult.success) {
                                            console.log('✅ [FCM TOKEN] Web layer registration verified successfully');
                                        } else {
                                            console.warn('⚠️ [FCM TOKEN] Web layer registration failed (native may have succeeded):', webRegisterResult.error);
                                        }
                                    } catch (webRegError) {
                                        console.warn('⚠️ [FCM TOKEN] Web layer registration error (native may have succeeded):', webRegError);
                                    }
                                } else {
                                    console.warn('⚠️ [FCM TOKEN] CapacitorPushNotifications not available for web verification');
                                }

                                cleanup();
                                resolve({ 
                                    success: true, 
                                    token: initResult.token,
                                    platform: 'android'
                                });
                            } else {
                                console.error('❌ Android: No token received from native initializeFCM');
                                cleanup();
                                resolve({ 
                                    success: false, 
                                    error: 'No token received from native initializeFCM' 
                                });
                            }
                        } catch (error) {
                            console.error('❌ Android: Native FCM initialization failed:', error);
                            cleanup();
                            resolve({ 
                                success: false, 
                                error: `Native FCM init failed: ${error.message}` 
                            });
                        }
                    });
                } else {
                    // Fallback to standard Capacitor flow with FirebaseMessaging
                    console.log('📱 Android: Using standard FCM token handler flow (fallback)');
                    console.log('using_standard_fcm_flow : loaded');

                    return new Promise(async (resolve) => {
                        const cleanup = () => {
                            isTokenRequestInProgress = false;
                        };

                        const getFirebaseToken = async () => {
                            console.log('🎯 Requesting FCM token from FirebaseMessaging plugin...');
                            
                            try {
                                const firebaseMessaging = window.Capacitor?.Plugins?.FirebaseMessaging;
                                if (!firebaseMessaging) {
                                    console.error('❌ Android: FirebaseMessaging plugin not available');
                                    cleanup();
                                    resolve({ success: false, error: 'FirebaseMessaging plugin not available' });
                                    return;
                                }

                                // Use getToken() directly - no need for register() with FirebaseMessaging
                                const fcmResult = await firebaseMessaging.getToken();
                                console.log('🎯 FCM Token received:', { 
                                    platform: 'android',
                                    tokenLength: fcmResult.token?.length || 0,
                                    tokenPreview: fcmResult.token?.substring(0, 20) + '...',
                                    isValidToken: fcmResult.token?.length > 50
                                });
                                
                                // Register the token with Supabase
                                if (fcmResult.token && window.CapacitorPushNotifications?.registerFCMToken) {
                                    console.log('📝 Registering FCM token with Supabase...');
                                    try {
                                        const registerResult = await window.CapacitorPushNotifications.registerFCMToken(
                                            fcmResult.token, 
                                            'android'
                                        );
                                        
                                        if (registerResult.success) {
                                            console.log('✅ FCM token registered with Supabase successfully');
                                        } else {
                                            console.error('❌ Failed to register FCM token with Supabase:', registerResult.error);
                                        }
                                    } catch (regError) {
                                        console.error('❌ Error registering FCM token:', regError);
                                    }
                                } else {
                                    console.warn('⚠️ No token received or CapacitorPushNotifications not available');
                                }
                                
                                cleanup();
                                resolve({ 
                                    success: true, 
                                    token: fcmResult.token,
                                    platform: 'android'
                                });
                            } catch (error) {
                                console.error('❌ Android: Failed to get FCM token:', error);
                                cleanup();
                                resolve({ 
                                    success: false, 
                                    error: `FCM token request failed: ${error.message}` 
                                });
                            }
                        };

                        // Request permissions first using FirebaseMessaging
                        try {
                            const firebaseMessaging = window.Capacitor?.Plugins?.FirebaseMessaging;
                            if (!firebaseMessaging) {
                                console.error('❌ Android: FirebaseMessaging plugin not available');
                                cleanup();
                                resolve({ success: false, error: 'FirebaseMessaging plugin not available' });
                                return;
                            }

                            const currentPermissions = await firebaseMessaging.checkPermissions();
                            console.log('🤖 Android: Current permissions:', currentPermissions);
                            
                            if (currentPermissions.receive !== 'granted') {
                                console.log('🤖 Android: Requesting new permissions...');
                                const permissions = await firebaseMessaging.requestPermissions();
                                console.log('🤖 Android: Permission request result:', permissions);
                                
                                if (permissions.receive !== 'granted') {
                                    console.log('❌ Android: Push notification permissions denied:', permissions);
                                    cleanup();
                                    resolve({ 
                                        success: false, 
                                        error: 'Push notification permissions denied. Please enable in Settings > Notifications.' 
                                    });
                                    return;
                                }
                            }
                            
                            console.log('✅ Android: Permissions granted, getting token');
                            
                            // Get the FCM token directly (no register() call needed)
                            await getFirebaseToken();
                            
                        } catch (error) {
                            console.error('❌ Android: Error in permission/token flow:', error);
                            cleanup();
                            resolve({ success: false, error: `Android setup failed: ${error.message}` });
                        }
                    });
                }

            } catch (error) {
                console.error('❌ Android: Failed to get FCM token:', error);
                isTokenRequestInProgress = false;
                return { success: false, error: error.message };
            }
        }
    };

    // Expose as both a function (for calling pattern) and object (for direct access)
    // This makes both patterns work:
    // 1. window.useMobileTokenHandler().requestPermissionAndGetToken()
    // 2. window.useMobileTokenHandler.requestPermissionAndGetToken()
    window.useMobileTokenHandler = function() {
        return handlerApi;
    };
    window.useMobileTokenHandler.requestPermissionAndGetToken = handlerApi.requestPermissionAndGetToken;

    console.log('✅ Android FCM Handler ready - window.useMobileTokenHandler available');
})();
