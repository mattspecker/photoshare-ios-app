/**
 * iOS FCM Handler for Capacitor 7.4.3
 * Provides global window function for iOS native app to handle FCM token requests
 */

console.log('🍎 iOS FCM Handler loading...');

(function() {
    'use strict';

    // Prevent multiple simultaneous token requests
    let isTokenRequestInProgress = false;

    // iOS FCM Token Handler
    window.useMobileTokenHandler = {
        async requestPermissionAndGetToken() {
            try {
                // Prevent multiple simultaneous requests
                if (isTokenRequestInProgress) {
                    console.log('🔄 iOS: Token request already in progress, waiting...');
                    return { success: false, error: 'Token request already in progress' };
                }

                isTokenRequestInProgress = true;
                console.log('🔔 iOS: Requesting FCM token and device permissions');

                // Check if Capacitor and PushNotifications are available
                if (!window.Capacitor) {
                    console.error('❌ iOS: Capacitor not available');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'Capacitor not available' };
                }

                if (!window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
                    console.error('❌ iOS: Not running on native platform');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'Not running on native platform' };
                }

                const pushPlugin = window.Capacitor?.Plugins?.PushNotifications;
                if (!pushPlugin) {
                    console.error('❌ iOS: PushNotifications plugin not available');
                    isTokenRequestInProgress = false;
                    return { success: false, error: 'PushNotifications plugin not available' };
                }

                console.log('pushPlugin_available : loaded', !!pushPlugin);
                
                // Use our custom FCM flow directly - no need to try initializeFCM first
                console.log('📱 iOS: Using custom FCM token handler flow');
                console.log('using_custom_fcm_flow : loaded');

                return new Promise(async (resolve) => {
                    const cleanup = () => {
                        isTokenRequestInProgress = false;
                    };

                    const getFirebaseToken = async () => {
                        console.log('🎯 Requesting FCM token from Firebase Messaging plugin...');
                        
                        try {
                            const firebaseMessaging = window.Capacitor?.Plugins?.FirebaseMessaging;
                            if (!firebaseMessaging) {
                                console.error('❌ iOS: FirebaseMessaging plugin not available');
                                cleanup();
                                resolve({ success: false, error: 'FirebaseMessaging plugin not available' });
                                return;
                            }

                            const fcmResult = await firebaseMessaging.getToken();
                            console.log('🎯 FCM Token received:', { 
                                platform: 'ios',
                                tokenLength: fcmResult.token?.length || 0,
                                tokenPreview: fcmResult.token?.substring(0, 20) + '...',
                                isValidToken: fcmResult.token?.length > 50
                            });
                            
                            // Register the token with Supabase using the global registration function
                            if (fcmResult.token && window.CapacitorPushNotifications?.registerFCMToken) {
                                console.log('📝 Registering FCM token with Supabase...');
                                try {
                                    const registerResult = await window.CapacitorPushNotifications.registerFCMToken(
                                        fcmResult.token, 
                                        'ios'
                                    );
                                    
                                    if (registerResult.success) {
                                        console.log('✅ FCM token registered with Supabase successfully');
                                } else {
                                    console.error('❌ Failed to register FCM token with Supabase:', registerResult.error);
                                }
                            } catch (regError) {
                                console.error('❌ Error registering FCM token:', regError);
                            }

                            // Attempt immediate registration with fallback
                            setTimeout(async () => {
                                if (window.CapacitorPushNotifications?.triggerTokenRegistration) {
                                    try {
                                        console.log('📝 iOS: Calling triggerTokenRegistration...');
                                        const result = await window.CapacitorPushNotifications.triggerTokenRegistration();
                                        console.log('📝 iOS: Registration result:', result);
                                    } catch (error) {
                                        console.warn('⚠️ iOS: triggerTokenRegistration error:', error);
                                    }
                                }
                            }, 500);
                        } else {
                            console.warn('⚠️ No token received or CapacitorPushNotifications not available');
                        }
                            
                            cleanup();
                            resolve({ 
                                success: true, 
                                token: fcmResult.token,
                                platform: 'ios'
                            });
                        } catch (error) {
                            console.error('❌ iOS: Failed to get FCM token:', error);
                            cleanup();
                            resolve({ 
                                success: false, 
                                error: `FCM token request failed: ${error.message}` 
                            });
                        }
                    };

                    // Request permissions first
                    try {
                        const currentPermissions = await pushPlugin.checkPermissions();
                        console.log('🍎 iOS: Current permissions:', currentPermissions);
                        
                        if (currentPermissions.receive !== 'granted') {
                            console.log('🍎 iOS: Requesting new permissions...');
                            const permissions = await pushPlugin.requestPermissions();
                            console.log('🍎 iOS: Permission request result:', permissions);
                            
                            if (permissions.receive !== 'granted') {
                                console.log('❌ iOS: Push notification permissions denied:', permissions);
                                cleanup();
                                resolve({ 
                                    success: false, 
                                    error: 'Push notification permissions denied. Please enable in Settings > Notifications.' 
                                });
                                return;
                            }
                        }
                        
                        console.log('✅ iOS: Permissions granted, proceeding to register');
                        
                        // Register for push notifications
                        await pushPlugin.register();
                        console.log('✅ iOS: Successfully called PushNotifications.register()');
                        
                        // Now get the FCM token directly
                        await getFirebaseToken();
                        
                    } catch (error) {
                        console.error('❌ iOS: Error in permission/registration flow:', error);
                        cleanup();
                        resolve({ success: false, error: `iOS setup failed: ${error.message}` });
                    }
                });

            } catch (error) {
                console.error('❌ iOS: Failed to get FCM token:', error);
                isTokenRequestInProgress = false;
                return { success: false, error: error.message };
            }
        }
    };

    console.log('✅ iOS FCM Handler ready - window.useMobileTokenHandler available');
})();