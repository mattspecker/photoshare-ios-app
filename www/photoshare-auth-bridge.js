/**
 * PhotoShare Authentication Bridge
 * Ensures auto-upload system can properly detect authentication status
 * Add this to photo-share.app BEFORE the auto-upload bundle
 */

console.log('🔐 PhotoShare Auth Bridge loading...');

(function() {
    'use strict';

    // Authentication bridge for auto-upload system
    class PhotoShareAuthBridge {
        constructor() {
            this.initialized = false;
            this.authCheckInterval = null;
            this.maxRetries = 30; // 30 seconds of checking
            this.retryCount = 0;
        }

        async initialize() {
            if (this.initialized) return;

            console.log('🔧 Initializing PhotoShare Auth Bridge...');
            
            // Wait for Supabase to be available
            await this.waitForSupabase();
            
            // Set up auth state monitoring
            this.setupAuthMonitoring();
            
            // Expose auth functions globally
            this.exposeAuthFunctions();
            
            this.initialized = true;
            console.log('✅ PhotoShare Auth Bridge ready');
        }

        async waitForSupabase() {
            return new Promise((resolve) => {
                const checkSupabase = () => {
                    this.retryCount++;
                    
                    if (window.supabase) {
                        console.log('✅ Supabase client detected');
                        resolve();
                    } else if (this.retryCount >= this.maxRetries) {
                        console.log('❌ Supabase client not found after 30 seconds');
                        resolve(); // Continue anyway
                    } else {
                        console.log(`⏳ Waiting for Supabase client... (${this.retryCount}/${this.maxRetries})`);
                        setTimeout(checkSupabase, 1000);
                    }
                };
                
                checkSupabase();
            });
        }

        setupAuthMonitoring() {
            if (!window.supabase) return;

            // Listen for auth state changes
            window.supabase.auth.onAuthStateChange((event, session) => {
                console.log(`🔐 Auth state changed: ${event}`, session?.user?.email || 'No user');
                
                // Notify auto-upload system of auth changes
                if (window.PhotoShareAutoUpload) {
                    setTimeout(() => {
                        window.PhotoShareAutoUpload.reinitialize();
                    }, 1000);
                }
                
                // Update global auth state
                window.PhotoShareAuthState = {
                    authenticated: !!session?.user,
                    user: session?.user || null,
                    session: session,
                    lastUpdated: new Date()
                };
                
                // Dispatch custom event for other listeners
                window.dispatchEvent(new CustomEvent('photoshare-auth-change', {
                    detail: { event, session, user: session?.user }
                }));
            });

            // Initial auth check
            this.checkAuthStatus();
        }

        async checkAuthStatus() {
            if (!window.supabase) return null;

            try {
                const { data: { user }, error } = await window.supabase.auth.getUser();
                
                if (error) {
                    console.log('❌ Auth check error:', error.message);
                    return null;
                }

                console.log(user ? `✅ User authenticated: ${user.email}` : '❌ No authenticated user');
                
                // Update global auth state
                window.PhotoShareAuthState = {
                    authenticated: !!user,
                    user: user,
                    session: await this.getSession(),
                    lastUpdated: new Date()
                };

                return user;
            } catch (error) {
                console.log('❌ Auth check failed:', error.message);
                return null;
            }
        }

        async getSession() {
            if (!window.supabase) return null;
            
            try {
                const { data: { session } } = await window.supabase.auth.getSession();
                return session;
            } catch (error) {
                console.log('❌ Session check failed:', error.message);
                return null;
            }
        }

        exposeAuthFunctions() {
            // Expose auth bridge functions globally
            window.PhotoShareAuthBridge = {
                checkAuth: () => this.checkAuthStatus(),
                getUser: async () => {
                    const user = await this.checkAuthStatus();
                    return user;
                },
                getSession: () => this.getSession(),
                getSupabase: () => window.supabase,
                isReady: () => this.initialized && !!window.supabase,
                getAuthState: () => window.PhotoShareAuthState || null
            };

            // Enhanced auth detection for auto-upload system
            window.getCurrentUserFromWebsite = async () => {
                // Try multiple methods to get current user
                
                // Method 1: Use auth bridge
                if (window.PhotoShareAuthState?.user) {
                    return window.PhotoShareAuthState.user;
                }
                
                // Method 2: Direct Supabase check
                if (window.supabase) {
                    try {
                        const { data: { user } } = await window.supabase.auth.getUser();
                        return user;
                    } catch (error) {
                        console.log('Direct Supabase auth check failed:', error.message);
                    }
                }
                
                // Method 3: Check for other auth patterns
                if (window.currentUser) return window.currentUser;
                if (window.user) return window.user;
                if (window.authUser) return window.authUser;
                
                // Method 4: Check app state
                if (window.__INITIAL_STATE__?.user) return window.__INITIAL_STATE__.user;
                
                return null;
            };

            // Enhanced Supabase client detection
            window.getSupabaseClientFromWebsite = () => {
                if (window.supabase) return window.supabase;
                if (window.supabaseClient) return window.supabaseClient;
                return null;
            };
        }

        // Debug functions
        async debugAuth() {
            console.log('🔍 PhotoShare Auth Debug:');
            console.log('- Supabase available:', !!window.supabase);
            console.log('- Auth bridge ready:', this.initialized);
            console.log('- Auth state:', window.PhotoShareAuthState);
            
            if (window.supabase) {
                try {
                    const { data: { user } } = await window.supabase.auth.getUser();
                    console.log('- Current user:', user?.email || 'None');
                    
                    const { data: { session } } = await window.supabase.auth.getSession();
                    console.log('- Session valid:', !!session);
                } catch (error) {
                    console.log('- Auth check error:', error.message);
                }
            }
        }
    }

    // Create and initialize auth bridge
    const authBridge = new PhotoShareAuthBridge();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => authBridge.initialize(), 500);
        });
    } else {
        setTimeout(() => authBridge.initialize(), 500);
    }

    // Expose debug function
    window.debugPhotoShareAuth = () => authBridge.debugAuth();

    console.log('✅ PhotoShare Auth Bridge script loaded');
})();