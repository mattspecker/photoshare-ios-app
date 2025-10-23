/**
 * iOS JWT Authentication Bridge
 * Provides early availability of JWT token functions for iOS AppDelegate
 * Ensures window.getPhotoShareJwtToken() is available when iOS tries to access it
 */

console.log('🍎 iOS JWT Auth Bridge loading...');

(function() {
    'use strict';

    let authState = {
        isReady: false,
        user: null,
        session: null,
        accessToken: null,
        lastUpdated: null
    };

    /**
     * Create auth bridge object that iOS expects
     */
    window.PhotoShareAuthBridge = {
        isReady: () => authState.isReady,
        
        checkAuth: async () => {
            return authState;
        },
        
        getUser: async () => {
            return authState.user;
        },
        
        getSession: async () => {
            return authState.session;
        },
        
        getSupabase: () => {
            return window.supabase || null;
        },
        
        getAuthState: () => {
            return authState;
        },
        
        getJwtToken: async () => {
            return await getJwtTokenForNativePlugin();
        }
    };

    /**
     * Store auth state for quick access
     */
    window.PhotoShareAuthState = authState;

    /**
     * Main JWT token function that iOS AppDelegate calls
     */
    window.getPhotoShareJwtToken = async function() {
        console.log('🍎 getPhotoShareJwtToken called');
        
        try {
            // Wait for auth system to be ready
            await waitForAuthSystem();
            
            // Get session from Supabase
            if (window.supabase?.auth) {
                const { data: { session }, error } = await window.supabase.auth.getSession();
                
                if (error) {
                    console.error('🍎 ❌ Supabase session error:', error);
                    return null;
                }
                
                if (session?.access_token) {
                    console.log('🍎 ✅ JWT token retrieved from Supabase');
                    return session.access_token;
                }
            }
            
            console.log('🍎 ❌ No JWT token available');
            return null;
            
        } catch (error) {
            console.error('🍎 ❌ Error getting JWT token:', error);
            return null;
        }
    };

    /**
     * Alternative JWT function for native plugins
     */
    window.getJwtTokenForNativePlugin = async function() {
        console.log('🍎 getJwtTokenForNativePlugin called');
        
        // PERMISSION GATE: Block token if permissions pending
        if (window.PhotoSharePermissionGate?.blocked) {
            console.log('⛔ Token blocked by permission gate - permissions pending');
            return null;
        }
        
        return await window.getPhotoShareJwtToken();
    };

    /**
     * OPTIMIZATION: Fast token retrieval for iOS that bypasses initialization wait
     * Returns cached token immediately if available, 'LOADING' if still initializing
     */
    window.getPhotoShareJwtTokenFast = function() {
        console.log('🍎 getPhotoShareJwtTokenFast called');
        
        // PERMISSION GATE: Block token if permissions pending
        if (window.PhotoSharePermissionGate?.blocked) {
            console.log('⛔ Token blocked by permission gate - permissions pending');
            return null;
        }
        
        // Try PhotoShareAuthState first (fastest path)
        if (window.PhotoShareAuthState?.accessToken) {
            console.log('🍎 ✅ Token from PhotoShareAuthState');
            return window.PhotoShareAuthState.accessToken;
        }
        
        // Try localStorage as fallback (for returning users)
        try {
            const supabaseKey = `sb-jgfcfdlfcnmaripgpepl-auth-token`;
            const stored = localStorage.getItem(supabaseKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                const token = parsed?.currentSession?.access_token;
                if (token) {
                    console.log('🍎 ✅ Token from localStorage');
                    return token;
                }
            }
        } catch (error) {
            console.warn('🍎 localStorage access failed:', error);
        }
        
        // Return 'LOADING' to indicate token is being fetched
        console.log('🍎 ⏳ Token still loading');
        return 'LOADING';
    };

    /**
     * Check if auth is ready
     */
    window.isPhotoShareAuthReady = function() {
        return authState.isReady;
    };

    /**
     * Get current auth state
     */
    window.getPhotoShareAuthState = function() {
        return authState;
    };

    /**
     * Wait for auth system to be initialized
     * OPTIMIZATION: Reduced polling interval from 100ms to 50ms for faster detection
     */
    async function waitForAuthSystem() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (window.supabase?.auth || authState.isReady) {
                    resolve();
                } else {
                    setTimeout(checkAuth, 50); // Optimized: 100ms -> 50ms
                }
            };
            checkAuth();
        });
    }

    /**
     * Initialize auth bridge when Supabase becomes available
     * OPTIMIZATION: Removed waitForPhotoshareCoreReady() to eliminate 2-5 second delay
     * Auth bridge only needs Supabase, not Capacitor or other core dependencies
     */
    async function initializeAuthBridge() {
        console.log('🍎 Initializing auth bridge...');
        
        // OPTIMIZATION: Removed unnecessary wait for Capacitor/core dependencies
        // Auth bridge only needs Supabase to function properly
        
        if (window.supabase?.auth) {
            // Set up auth state change listener
            window.supabase.auth.onAuthStateChange((event, session) => {
                console.log('🍎 Auth state changed:', event);
                
                authState.session = session;
                authState.user = session?.user || null;
                authState.accessToken = session?.access_token || null;
                authState.lastUpdated = new Date();
                authState.isReady = true;
                
                // Notify iOS that auth bridge is ready
                window.dispatchEvent(new CustomEvent('photoshare-auth-bridge-ready'));
                
                // Also trigger auth change event
                window.dispatchEvent(new CustomEvent('photoshare-auth-change', {
                    detail: { event, session }
                }));
            });
            
            // Get initial session
            window.supabase.auth.getSession().then(({ data: { session } }) => {
                authState.session = session;
                authState.user = session?.user || null;
                authState.accessToken = session?.access_token || null;
                authState.lastUpdated = new Date();
                authState.isReady = true;
                
                console.log('🍎 ✅ Auth bridge initialized with session');
                
                // Notify iOS that auth bridge is ready
                window.dispatchEvent(new CustomEvent('photoshare-auth-bridge-ready'));
                
                // Notify loading coordinator if available
                if (window.PhotoShareLoadingState) {
                    window.PhotoShareLoadingState.markReady('authBridge');
                }
            });
        } else {
            // Wait for Supabase to load
            // OPTIMIZATION: Reduced polling interval from 100ms to 50ms
            setTimeout(initializeAuthBridge, 50);
        }
    }

    /**
     * Start initialization when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAuthBridge);
    } else {
        initializeAuthBridge();
    }

    console.log('🍎 ✅ iOS JWT Auth Bridge loaded - Functions available:');
    console.log('   - window.getPhotoShareJwtToken()');
    console.log('   - window.getJwtTokenForNativePlugin()');
    console.log('   - window.isPhotoShareAuthReady()');
    console.log('   - window.getPhotoShareAuthState()');

})();