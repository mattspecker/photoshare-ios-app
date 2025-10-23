/**
 * Capacitor Push Notifications Global Functions
 * Compatible with Capacitor 7.4.3
 * Provides global window functions for push notification management
 */

console.log('🔔 Capacitor Push Notifications loading...');

(function() {
    'use strict';

    // Global state
    let pushState = {
        isRegistered: false,
        token: null,
        isInitialized: false
    };

    // Supabase client reference (will be set from window.supabase)
    let supabaseClient = null;

    // Initialize supabase client
    const getSupabaseClient = () => {
        if (!supabaseClient && window.supabase) {
            supabaseClient = window.supabase;
            console.log('✅ Supabase client initialized for push notifications');
        }
        return supabaseClient;
    };

    // Initialize push notifications
    const initializePushNotifications = async () => {
        if (pushState.isInitialized) return;

        try {
      const platform = window.Capacitor?.getPlatform?.() || 'web';
      if (platform === 'web') {
        console.log('ℹ️ Web detected - skipping native push initialization');
        return;
      }
      // Android uses FirebaseMessaging plugin instead of PushNotifications
      if (platform === 'android') {
        const FirebaseMessaging = window.Capacitor?.Plugins?.FirebaseMessaging;
        if (!FirebaseMessaging) {
          console.warn('⚠️ FirebaseMessaging plugin not available on Android');
          return;
        }
        try {
          const perm = await FirebaseMessaging.checkPermissions();
          if (perm?.receive === 'granted') {
            try {
              const res = await FirebaseMessaging.getToken();
              if (res?.token) {
                pushState.isRegistered = true;
                pushState.token = res.token;
                localStorage.setItem('capacitor_push_token', res.token);
              }
            } catch (e) {
              console.error('❌ Error getting Android FCM token:', e);
            }
          } else {
            console.log('🔕 Android notification permission not granted');
          }
        } catch (e) {
          console.error('❌ Android permission check failed:', e);
        }
        pushState.isInitialized = true;
        console.log('✅ Push notifications initialized (android-firebase)');
        return;
      }

      if (!window.Capacitor?.Plugins?.PushNotifications) {
        console.log('⚠️ PushNotifications plugin not available');
        return;
      }

      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      
      // Detect iOS native mode (initializeFCM only exists on Android builds)
      const hasNativeInit = !!(PushNotifications?.initializeFCM);
      const isAndroidNative = platform === 'android' && hasNativeInit;
      
      if (isAndroidNative) {
        console.log('🟢 [PUSH INIT] Android native initializeFCM detected - will use native flow with authentication retry logic');
      }

            // Add registration listener
            await PushNotifications.addListener('registration', (token) => {
                console.log('🎯 Push registration success, token: ' + token.value.substring(0, 20) + '...');
                pushState.isRegistered = true;
                pushState.token = token.value;
                
                localStorage.setItem('capacitor_push_token', token.value);
                
                // Always register token with backend (including Android native mode)
                if (window.CapacitorPushNotifications?.registerFCMToken) {
                    window.CapacitorPushNotifications.registerFCMToken(token.value, window.Capacitor.getPlatform());
                }
            });

            // Add registration error listener
            await PushNotifications.addListener('registrationError', (error) => {
                console.error('❌ Push registration error: ' + JSON.stringify(error));
                pushState.isRegistered = false;
                pushState.token = null;
            });

            // Add notification received listener
            await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('📱 Push notification received: ', notification);
                
                // Dispatch custom event for app to handle
                window.dispatchEvent(new CustomEvent('capacitor-push-received', {
                    detail: notification
                }));
            });

            // Add notification action performed listener
            await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('👆 Push notification action performed: ', notification);
                
                // Handle notification tap
                const data = notification.notification.data;
                if (data?.eventId) {
                    // Navigate to specific event
                    window.location.href = `/event/${data.eventId}`;
                }
                
                // Dispatch custom event for app to handle
                window.dispatchEvent(new CustomEvent('capacitor-push-action', {
                    detail: notification
                }));
            });

            // Check existing permissions
            const permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'granted') {
                pushState.isRegistered = true;
                
                // Use native initializeFCM for Android, standard register for others
                if (isAndroidNative) {
                    console.log('🔔 [PUSH INIT] Android native initializeFCM available - delegating to native (with auth retry)');
                    try {
                        const initResult = await PushNotifications.initializeFCM();
                        console.log('🎯 [FCM TOKEN] Native init result:', initResult);
                        if (initResult?.token) {
                            pushState.token = initResult.token;
                            localStorage.setItem('capacitor_push_token', initResult.token);
                            
                            // Explicitly register with Supabase (defense-in-depth)
                            console.log('🔗 [FCM TOKEN] Starting web layer verification/registration (post-native init)...');
                            if (window.CapacitorPushNotifications?.registerFCMToken) {
                                await window.CapacitorPushNotifications.registerFCMToken(initResult.token, 'android');
                            }
                        }
                    } catch (e) {
                        console.error('❌ Native initializeFCM failed:', e);
                    }
                } else {
                    // Check for saved token (iOS/web)
                    const savedToken = localStorage.getItem('capacitor_push_token');
                    if (savedToken) {
                        pushState.token = savedToken;
                    }
                }
            }

            pushState.isInitialized = true;
            console.log('✅ Push notifications initialized');

        } catch (error) {
            console.error('❌ Push notification initialization failed:', error);
        }
    };

    // Request push permissions
  const requestPermissions = async () => {
    try {
      const platform = window.Capacitor?.getPlatform?.() || 'web';
      if (platform === 'web') {
        console.log('ℹ️ Web detected - skipping push permission request');
        return false;
      }

      if (platform === 'android') {
        const FirebaseMessaging = window.Capacitor?.Plugins?.FirebaseMessaging;
        if (!FirebaseMessaging) {
          console.error('❌ FirebaseMessaging plugin not available');
          return false;
        }
        const permStatus = await FirebaseMessaging.requestPermissions();
        if (permStatus.receive === 'granted') {
          console.log('✅ Push permissions granted on Android');
          try {
            const res = await FirebaseMessaging.getToken();
            if (res?.token) {
              pushState.token = res.token;
              pushState.isRegistered = true;
              localStorage.setItem('capacitor_push_token', res.token);
              if (window.CapacitorPushNotifications?.registerFCMToken) {
                await window.CapacitorPushNotifications.registerFCMToken(res.token, 'android');
              }
            }
          } catch (e) {
            console.error('❌ Failed to get FCM token after permission:', e);
          }
          return true;
        }
        console.log('❌ Push permissions denied on Android:', permStatus);
        return false;
      }

      if (!window.Capacitor?.Plugins?.PushNotifications) {
        console.error('❌ PushNotifications plugin not available');
        return false;
      }

      const PushNotifications = window.Capacitor.Plugins.PushNotifications;
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        console.log('✅ Push permissions granted');
        await PushNotifications.register();
        return true;
      } else {
        console.log('❌ Push permissions denied:', permStatus);
        return false;
      }
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  };

    // Register FCM token with backend
    const registerFCMToken = async (token, platform, deviceId) => {
        console.log('🔔 Registering FCM token:', {
            fcm_token: token.substring(0, 50) + '...',
            platform,
            device_id: deviceId
        });

        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                console.error('❌ Supabase client not available');
                return { success: false, error: 'Supabase client not available' };
            }

            // Check authentication status first
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (authError) {
                console.error('❌ Authentication error:', authError);
                return { success: false, error: 'Authentication failed' };
            }
            
            if (!user || !user.id || user.id === 'session') {
                console.warn('⚠️ No authenticated user - token will be registered after sign-in');
                return { success: false, error: 'No authenticated user' };
            }

            console.log('🔐 Auth check passed, user ID:', user.id);

            // Store FCM token
            const { data: tokenData, error: tokenError } = await supabase
                .from('user_fcm_tokens')
                .upsert({
                    user_id: user.id,
                    fcm_token: token,
                    platform: platform,
                    device_id: deviceId
                }, {
                    onConflict: 'user_id,fcm_token',
                    ignoreDuplicates: false
                })
                .select();

            if (tokenError) {
                console.error('❌ Error storing FCM token:', tokenError);
                return { success: false, error: tokenError.message };
            }

            console.log('✅ FCM token stored successfully:', tokenData);
            return { success: true, data: tokenData };

        } catch (error) {
            console.error('❌ Failed to register FCM token:', error);
            return { success: false, error: error.message };
        }
    };

    // Remove FCM token
    const removeFCMToken = async (token) => {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                console.error('❌ Supabase client not available');
                return { success: false, error: 'Supabase client not available' };
            }

            console.log('🔕 Removing FCM token:', token.substring(0, 20) + '...');

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            
            if (!user || !user.id || user.id === 'session') {
                console.error('❌ Authentication issue in remove token:', { user, authError });
                return { success: false, error: 'User not properly authenticated' };
            }

            // Remove specific FCM token
            const { error: tokenError } = await supabase
                .from('user_fcm_tokens')
                .delete()
                .eq('user_id', user.id)
                .eq('fcm_token', token);

            if (tokenError) {
                console.error('❌ Error removing FCM token:', tokenError);
                return { success: false, error: tokenError.message };
            }

            console.log('✅ FCM token removed successfully');
            return { success: true };

        } catch (error) {
            console.error('❌ Failed to remove FCM token:', error);
            return { success: false, error: error.message };
        }
    };

    // Send test notification via Firebase
    const sendTestNotification = async (token, eventData, customTitle, customBody) => {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) {
                console.error('❌ Supabase client not available');
                return { success: false, error: 'Supabase client not available' };
            }

            console.log('📱 Sending test Firebase notification');

            const notificationData = {
                ...eventData,
                notificationType: 'custom',
                customTitle: customTitle || `Test notification for ${eventData.eventName}`,
                customBody: customBody || 'This is a test notification to verify Firebase integration.'
            };

            const { data, error } = await supabase.functions.invoke('send-firebase-notification', {
                body: { token, ...notificationData }
            });

            if (error) {
                console.error('❌ Error sending test notification:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ Test notification sent successfully:', data);
            return { success: true, data };

        } catch (error) {
            console.error('❌ Failed to send test notification:', error);
            return { success: false, error: error.message };
        }
    };

    // Register for event notifications
    const registerForEventNotifications = async (eventData) => {
        const token = localStorage.getItem('capacitor_push_token');
        if (!token) {
            console.log('⚠️ No push token available');
            return { success: false, error: 'No push token available' };
        }

        try {
            // Store push token in localStorage for this event
            const eventNotifications = JSON.parse(localStorage.getItem('capacitor_event_notifications') || '{}');
            eventNotifications[eventData.eventId] = {
                push_token: token,
                event_start: eventData.startTime,
                event_end: eventData.endTime,
                deletion_date: eventData.deleteDate,
                notification_types: ['event_reminder', 'event_live', 'event_ending', 'deletion_warning'],
                created_at: new Date().toISOString()
            };
            localStorage.setItem('capacitor_event_notifications', JSON.stringify(eventNotifications));

            console.log(`✅ Notifications registered for ${eventData.eventName}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error registering for event notifications:', error);
            return { success: false, error: error.message };
        }
    };

    // Unregister from event notifications
    const unregisterFromEventNotifications = async (eventId) => {
        try {
            // Remove event notifications from localStorage
            const eventNotifications = JSON.parse(localStorage.getItem('capacitor_event_notifications') || '{}');
            delete eventNotifications[eventId];
            localStorage.setItem('capacitor_event_notifications', JSON.stringify(eventNotifications));

            console.log(`✅ Notifications disabled for event ${eventId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error unregistering from event notifications:', error);
            return { success: false, error: error.message };
        }
    };

    /**
     * Manually trigger FCM token registration
     * Called by iOS/Android after storing token in localStorage
     * Handles both authenticated and unauthenticated states
     */
    const triggerTokenRegistration = async () => {
        console.log('🔄 Manual token registration triggered by native layer');
        
        // Check for stored token
        const token = localStorage.getItem('capacitor_push_token');
        if (!token) {
            console.warn('⚠️ triggerTokenRegistration called but no token in localStorage');
            return { success: false, error: 'No token found in localStorage' };
        }
        
        console.log(`📍 Found stored token: ${token.substring(0, 20)}...`);
        
        // Get current auth state
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('❌ Supabase client not available');
            return { success: false, error: 'Supabase client not available' };
        }
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
                // User is authenticated - register immediately
                console.log('✅ User authenticated, registering token immediately');
                const platform = window.Capacitor?.getPlatform?.() || 'web';
                return await registerFCMToken(token, platform);
            } else {
                // User not authenticated - token will be picked up by onAuthStateChange
                console.log('⏳ User not authenticated yet');
                console.log('ℹ️ Token stored in localStorage, will register automatically on sign-in');
                return { 
                    success: true, 
                    queued: true,
                    message: 'Token queued for registration on sign-in' 
                };
            }
        } catch (error) {
            console.error('❌ Error checking auth state:', error);
            return { success: false, error: error.message };
        }
    };

    // Get current push state
    const getPushState = () => {
        return { ...pushState };
    };

    // Setup auth state listener for automatic token registration retry
    const setupAuthListener = () => {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.warn('⚠️ Supabase client not available for auth listener setup');
            return;
        }

        console.log('🔐 Setting up auth state listener for FCM registration...');
        
        supabase.auth.onAuthStateChange((event, session) => {
            console.log(`🔐 Auth state changed: ${event}, hasSession: ${!!session}`);
            
            if (event === 'SIGNED_IN' && session) {
                const token = localStorage.getItem('capacitor_push_token');
                if (token) {
                    console.log('🔄 User signed in, retrying FCM registration with stored token...');
                    console.log(`📍 Token to register: ${token.substring(0, 20)}...`);
                    
                    // Retry registration now that user is authenticated
                    registerFCMToken(token, window.Capacitor?.getPlatform() || 'web')
                        .then(result => {
                            if (result.success) {
                                console.log('✅ Post-auth FCM registration successful!');
                            } else {
                                console.warn('⚠️ Post-auth FCM registration failed:', result.error);
                            }
                        })
                        .catch(err => {
                            console.error('❌ Post-auth FCM registration error:', err);
                        });
                } else {
                    console.log('ℹ️ No stored FCM token found for post-auth registration');
                }
            }
        });
    };

    // Global API
    window.CapacitorPushNotifications = {
        // Core functions
        initialize: initializePushNotifications,
        requestPermissions,
        registerFCMToken,
        removeFCMToken,
        sendTestNotification,
        triggerTokenRegistration,
        
        // Event functions
        registerForEventNotifications,
        unregisterFromEventNotifications,
        
        // State functions
        getPushState,
        isRegistered: () => pushState.isRegistered,
        getToken: () => pushState.token,
        
        // Utility functions
        checkCapacitorAvailable: () => !!(window.Capacitor?.Plugins?.PushNotifications || window.Capacitor?.Plugins?.FirebaseMessaging),
        getPlatform: () => window.Capacitor?.getPlatform?.() || 'unknown'
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializePushNotifications, 1000);
            // Setup auth listener after a short delay to ensure supabase is ready
            setTimeout(setupAuthListener, 100);
        });
    } else {
        setTimeout(initializePushNotifications, 1000);
        // Setup auth listener after a short delay to ensure supabase is ready
        setTimeout(setupAuthListener, 100);
    }

    console.log('✅ Capacitor Push Notifications ready - window.CapacitorPushNotifications available');
})();