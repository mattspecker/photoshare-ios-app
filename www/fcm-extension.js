/**
 * FCM Integration - Following EventPhotoPicker Pattern
 * Proper Capacitor plugin integration for Firebase Cloud Messaging
 */

console.log('🔥 FCM Integration Loading...');

class FCMIntegration {
    constructor() {
        this.pushPlugin = null;
        this.messagingPlugin = null;
        this.isReady = false;
        this.isNativeApp = this.checkNativeApp();
        
        if (this.isNativeApp) {
            this.init();
        } else {
            console.log('📱 Not running in native app - FCM disabled');
        }
    }
    
    checkNativeApp() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }
    
    async init() {
        console.log('🚀 Initializing FCM Integration...');
        
        try {
            // Wait for Capacitor to be ready
            await this.waitForCapacitor();
            
            // Wait for plugins to be available (Capacitor auto-registers from packageClassList)
            await this.waitForPlugins();
            
            // Get plugin references directly from Capacitor.Plugins
            this.pushPlugin = window.Capacitor.Plugins.PushNotifications;
            this.messagingPlugin = window.Capacitor.Plugins.FirebaseMessaging;
            console.log('✅ FCM plugins found and connected');
            
            this.isReady = true;
            console.log('✅ FCM Integration ready for use');
            
            // Expose global methods
            this.exposeGlobalMethods();
            
        } catch (error) {
            console.error('❌ FCM Integration initialization failed:', error);
            this.isReady = false;
        }
    }
    
    async waitForCapacitor() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.Capacitor && window.Capacitor.Plugins) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    async waitForPlugins() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds
            
            const check = () => {
                attempts++;
                
                console.log(`🔍 Attempt ${attempts}/${maxAttempts} - Checking for FCM plugins...`);
                console.log('Available plugins:', Object.keys(window.Capacitor?.Plugins || {}));
                
                if (window.Capacitor?.Plugins?.PushNotifications && window.Capacitor?.Plugins?.FirebaseMessaging) {
                    console.log('✅ FCM plugins found in Capacitor.Plugins');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ FCM plugins not found after 10 seconds');
                    console.error('Final plugin list:', Object.keys(window.Capacitor?.Plugins || {}));
                    reject(new Error('FCM plugins not available after 10 seconds'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    
    exposeGlobalMethods() {
        // Create wrapper function with detailed logging
        const fcmWrapper = async () => {
            console.log('🎯 FCM WRAPPER: initializeFCM called from web');
            console.log('🎯 FCM WRAPPER: this.isReady =', this.isReady);
            console.log('🎯 FCM WRAPPER: About to call this.initializeFCM()');
            
            try {
                const result = await this.initializeFCM();
                console.log('🎯 FCM WRAPPER: initializeFCM completed with result:', result);
                return result;
            } catch (error) {
                console.error('🎯 FCM WRAPPER: initializeFCM failed with error:', error);
                throw error;
            }
        };
        
        // Expose FCM initialization using correct Capacitor patterns
        
        // Method 1: Standard Capacitor plugin pattern
        if (!window.CapacitorPlugins) {
            window.CapacitorPlugins = {};
        }
        if (!window.CapacitorPlugins.PushNotifications) {
            window.CapacitorPlugins.PushNotifications = {};
        }
        window.CapacitorPlugins.PushNotifications.initialize = fcmWrapper;
        
        // Method 2: Legacy pattern for compatibility
        window.Capacitor.Plugins.PushNotifications.initializeFCM = fcmWrapper;
        
        // Method 3: Global initialize function
        window.initializeFCM = fcmWrapper;
        
        // Method 4: Mobile token handler pattern
        window.useMobileTokenHandler = {
            requestPermissionAndGetToken: fcmWrapper,
            isAvailable: () => this.isReady,
            getToken: fcmWrapper,
            initialize: fcmWrapper
        };
        
        console.log('🧪 FCM Capacitor endpoints exposed:');
        console.log('  - window.CapacitorPlugins.PushNotifications.initialize() ✅');
        console.log('  - window.Capacitor.Plugins.PushNotifications.initializeFCM() (legacy)');
        console.log('  - window.initializeFCM() ✅');
        console.log('  - window.useMobileTokenHandler.requestPermissionAndGetToken() ✅');
        console.log('✅ iOS FCM Handler ready with all Capacitor patterns');
    }

    // Core FCM Methods
    async initializeFCM() {
        console.log('🚀 initializeFCM() called by web!');
        console.log('🚀 FCM STATUS CHECK: this.isReady =', this.isReady);
        console.log('🚀 FCM STATUS CHECK: this.pushPlugin =', !!this.pushPlugin);
        console.log('🚀 FCM STATUS CHECK: this.messagingPlugin =', !!this.messagingPlugin);
        
        if (!this.isReady) {
            console.error('❌ FCM Integration not ready');
            console.error('❌ Debug info: isReady=', this.isReady, 'pushPlugin=', !!this.pushPlugin, 'messagingPlugin=', !!this.messagingPlugin);
            return { success: false, error: 'FCM Integration not initialized' };
        }
        
        try {
            // Check permissions first
            console.log('📋 Checking push notification permissions...');
            const status = await this.pushPlugin.checkPermissions();
            console.log('📋 Current permissions:', status);
            
            let granted = status.receive === 'granted';
            
            // Request permissions if not granted
            if (!granted) {
                console.log('🔔 Requesting push notification permissions...');
                const result = await this.pushPlugin.requestPermissions();
                console.log('🔔 Permission request result:', result);
                granted = result.receive === 'granted';
            }
            
            if (!granted) {
                console.log('❌ Push notification permissions denied by user');
                return { success: false, error: 'Permissions denied' };
            }
            
            console.log('✅ Push notification permissions granted');
            
            // Register for push notifications
            console.log('📝 Registering for push notifications...');
            await this.pushPlugin.register();
            console.log('✅ Successfully registered for push notifications');
            
            // IMPORTANT: Get FCM token directly from Firebase Messaging plugin
            console.log('🎯 Requesting FCM token from Firebase Messaging plugin...');
            console.log('🔍 Firebase Messaging plugin available:', !!this.messagingPlugin);
            
            if (!this.messagingPlugin) {
                throw new Error('FirebaseMessaging plugin not available');
            }
            
            const fcmResult = await this.messagingPlugin.getToken();
            console.log('🎯 FCM getToken result:', fcmResult);
            console.log('🎯 FCM getToken type:', typeof fcmResult);
            console.log('🎯 FCM getToken keys:', Object.keys(fcmResult || {}));
            
            if (fcmResult?.token) {
                const token = fcmResult.token;
                console.log('✅ FCM Token received successfully!');
                console.log('📱 Token (first 30 chars):', token.substring(0, 30) + '...');
                console.log('📱 Token (last 30 chars):', '...' + token.substring(token.length - 30));
                
                // Store token globally for debugging
                window.FCM_TOKEN = token;
                
                // Register FCM token using the correct Capacitor endpoints
                try {
                    console.log('📤 Registering FCM token using Capacitor endpoints...');
                    console.log('🎯 Token to register:', token.substring(0, 50) + '...');
                    console.log('📱 Platform: ios');
                    
                    // Method 1: Call window.registerFCMToken (primary method)
                    if (window.registerFCMToken && typeof window.registerFCMToken === 'function') {
                        console.log('✅ Using window.registerFCMToken');
                        await window.registerFCMToken(token, 'ios');
                        console.log('✅ Token successfully registered via registerFCMToken');
                    } else {
                        console.log('⚠️ window.registerFCMToken not found - trying alternative methods');
                        
                        // Method 2: PostMessage method
                        console.log('📤 Trying postMessage method...');
                        window.parent.postMessage({ 
                            type: 'FCM_TOKEN',
                            token: token,
                            platform: 'ios' 
                        }, '*');
                        
                        // Method 3: Custom event method  
                        console.log('📤 Trying custom event method...');
                        document.dispatchEvent(new CustomEvent('fcm-token-received', {
                            detail: { 
                                token: token, 
                                platform: 'ios',
                                timestamp: new Date().toISOString()
                            }
                        }));
                        
                        console.log('✅ Token sent via alternative methods');
                    }
                } catch (tokenRegistrationError) {
                    console.error('❌ Error registering token:', tokenRegistrationError);
                    // Don't fail the whole flow - token generation was successful
                }
                
                return {
                    success: true,
                    token: token,
                    platform: 'ios',
                    timestamp: new Date().toISOString()
                };
                
            } else {
                console.log('❌ No FCM token received from Firebase');
                console.log('🔍 FCM response was:', fcmResult);
                return { success: false, error: 'No FCM token received' };
            }
            
        } catch (error) {
            console.error('❌ Error in initializeFCM:', error);
            console.error('❌ Error stack:', error.stack);
            return { 
                success: false, 
                error: error.message,
                stack: error.stack 
            };
        }
    }
    
    // Direct Supabase Registration
    async registerTokenWithSupabase(token, platform) {
        console.log('🗄️ Starting direct Supabase token registration...');
        
        try {
            // Get current user from auth bridge
            const userId = window.PhotoShareAuthState?.userId || window.currentUser?.id;
            console.log('👤 Current user ID:', userId);
            
            if (!userId) {
                throw new Error('No authenticated user found');
            }
            
            // Prepare token data
            const tokenData = {
                user_id: userId,
                fcm_token: token,
                platform: platform,
                device_info: {
                    userAgent: navigator.userAgent,
                    platform: platform,
                    timestamp: new Date().toISOString()
                },
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            console.log('📝 Token data to insert:', {
                user_id: userId,
                fcm_token: token.substring(0, 30) + '...',
                platform: platform,
                device_info: tokenData.device_info,
                is_active: true
            });
            
            // Check if Supabase client is available
            if (window.supabase) {
                console.log('✅ Using global Supabase client');
                
                // Upsert token (insert or update if exists)
                const { data, error } = await window.supabase
                    .from('user_fcm_tokens')
                    .upsert(tokenData, { 
                        onConflict: 'user_id,platform',
                        ignoreDuplicates: false 
                    })
                    .select();
                
                if (error) {
                    console.error('❌ Supabase upsert error:', error);
                    throw error;
                }
                
                console.log('✅ Supabase upsert success:', data);
                return { success: true, data };
                
            } else {
                console.log('⚠️ Global Supabase client not found - using fetch API');
                
                // Fallback: use PhotoShare auth bridge or direct API call
                if (window.getPhotoShareJwtToken) {
                    const jwtToken = await window.getPhotoShareJwtToken();
                    console.log('🔐 Got JWT token for API call');
                    
                    // Make direct API call to your backend
                    const response = await fetch('/api/register-fcm-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${jwtToken}`
                        },
                        body: JSON.stringify(tokenData)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`API call failed: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log('✅ API call success:', result);
                    return { success: true, data: result };
                } else {
                    throw new Error('No Supabase client or auth token available');
                }
            }
            
        } catch (error) {
            console.error('❌ Token registration failed:', error);
            throw error;
        }
    }
    
    // Status Methods
    getStatus() {
        return {
            isNativeApp: this.isNativeApp,
            isReady: this.isReady,
            pushPluginAvailable: !!window.Capacitor?.Plugins?.PushNotifications,
            messagingPluginAvailable: !!window.Capacitor?.Plugins?.FirebaseMessaging
        };
    }
}

// Initialize the FCM integration immediately
const fcmApp = new FCMIntegration();

// Make available globally
window.FCMApp = fcmApp;

// Ensure immediate availability for web detection
if (window.Capacitor?.isNativePlatform?.()) {
    console.log('📱 iOS Native App Detected - Setting up Early Mobile Token Handler');
    
    // Create immediate handler that waits for full initialization
    const earlyHandler = async () => {
        console.log('🚀 EARLY HANDLER: Mobile token handler called before full init');
        
        // Wait for FCM to be ready if not already
        let attempts = 0;
        while (!fcmApp.isReady && attempts < 50) {
            console.log('⏳ EARLY HANDLER: Waiting for FCM integration to be ready... attempt', attempts + 1);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (fcmApp.isReady) {
            console.log('✅ EARLY HANDLER: FCM ready, calling initializeFCM');
            return fcmApp.initializeFCM();
        } else {
            console.error('❌ EARLY HANDLER: FCM integration not ready after 5 seconds');
            return { success: false, error: 'FCM not initialized' };
        }
    };
    
    // Set up immediate handler
    window.useMobileTokenHandler = {
        requestPermissionAndGetToken: earlyHandler,
        isAvailable: () => true, // Always available on iOS
        getToken: earlyHandler,
        initialize: earlyHandler
    };
    console.log('✅ Early iOS Mobile Token Handler available immediately');
}

console.log('✅ FCM Integration Ready');
console.log('📱 Status:', fcmApp.getStatus());

// Debug what's actually available on window
console.log('🔍 WINDOW DEBUG: Checking what handlers are available...');
console.log('🔍 window.useMobileTokenHandler exists:', !!window.useMobileTokenHandler);
console.log('🔍 window.useMobileTokenHandler methods:', window.useMobileTokenHandler ? Object.keys(window.useMobileTokenHandler) : 'N/A');
console.log('🔍 window.Capacitor.Plugins.PushNotifications.initializeFCM exists:', !!(window.Capacitor?.Plugins?.PushNotifications?.initializeFCM));
console.log('🔍 window.FCMApp exists:', !!window.FCMApp);

// Test the handler immediately
if (window.useMobileTokenHandler) {
    console.log('✅ useMobileTokenHandler is available for web app');
    console.log('✅ Methods available:', Object.keys(window.useMobileTokenHandler));
} else {
    console.error('❌ useMobileTokenHandler NOT available - web app will fail');
}

// Add global debug function for web app to check handler status
window.debugFCMHandler = () => {
    console.log('🔍 FCM HANDLER DEBUG:');
    console.log('  - useMobileTokenHandler exists:', !!window.useMobileTokenHandler);
    console.log('  - useMobileTokenHandler methods:', window.useMobileTokenHandler ? Object.keys(window.useMobileTokenHandler) : 'N/A');
    console.log('  - FCM integration ready:', fcmApp.isReady);
    console.log('  - Capacitor platform:', window.Capacitor?.getPlatform?.());
    console.log('  - Is native platform:', window.Capacitor?.isNativePlatform?.());
    return {
        handlerExists: !!window.useMobileTokenHandler,
        fcmReady: fcmApp.isReady,
        platform: window.Capacitor?.getPlatform?.(),
        isNative: window.Capacitor?.isNativePlatform?.()
    };
};