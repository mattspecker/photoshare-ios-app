/**
 * Loading Coordinator - Ensures proper initialization order
 * This script manages the loading sequence of critical components
 */

console.log('🚀 Loading Coordinator initializing...');

(function() {
    'use strict';

    // Global loading state tracker
    window.PhotoShareLoadingState = {
        // Core dependencies
        capacitorReady: false,
        supabaseReady: false,
        authBridgeReady: false,
        firebaseReady: false,
        
        // App state
        reactMounted: false,
        authContextReady: false,
        
        // Initialization promises for coordination
        promises: {
            capacitor: null,
            supabase: null,
            authBridge: null,
            firebase: null
        },
        
        // Event listeners for coordination
        listeners: new Map(),
        
        // Mark a dependency as ready
        markReady: function(dependency, data = null) {
            console.log(`✅ Loading Coordinator: ${dependency} is ready`);
            this[dependency + 'Ready'] = true;
            
            // Resolve any waiting promises
            if (this.promises[dependency]) {
                this.promises[dependency].resolve(data);
            }
            
            // Trigger custom event
            window.dispatchEvent(new CustomEvent(`photoshare-${dependency}-ready`, {
                detail: data
            }));
            
            // Check if all core dependencies are ready
            this.checkCoreReady();
        },
        
        // Wait for a specific dependency
        waitFor: function(dependency, timeout = 10000) {
            if (this[dependency + 'Ready']) {
                return Promise.resolve();
            }
            
            if (!this.promises[dependency]) {
                this.promises[dependency] = {};
                this.promises[dependency].promise = new Promise((resolve, reject) => {
                    this.promises[dependency].resolve = resolve;
                    this.promises[dependency].reject = reject;
                    
                    // Set timeout
                    setTimeout(() => {
                        reject(new Error(`Timeout waiting for ${dependency}`));
                    }, timeout);
                });
            }
            
            return this.promises[dependency].promise;
        },
        
        // Wait for multiple dependencies
        waitForAll: function(dependencies, timeout = 10000) {
            const promises = dependencies.map(dep => this.waitFor(dep, timeout));
            return Promise.all(promises);
        },
        
        // Check if core dependencies are ready
        checkCoreReady: function() {
            const coreReady = this.capacitorReady && this.supabaseReady && this.authBridgeReady;
            
            if (coreReady && !this.coreSystemsReady) {
                console.log('🎉 Loading Coordinator: All core systems ready!');
                this.coreSystemsReady = true;
                
                // Trigger core ready event
                window.dispatchEvent(new CustomEvent('photoshare-core-ready'));
                
                // Initialize non-critical systems
                this.initializeSecondarySystem();
            }
        },
        
        // Initialize secondary systems after core is ready
        initializeSecondarySystem: function() {
            console.log('🔄 Loading Coordinator: Initializing secondary systems...');
            
            // Defer Firebase and other heavy initialization
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    this.initializeFirebase();
                }, { timeout: 2000 });
            } else {
                setTimeout(() => {
                    this.initializeFirebase();
                }, 100);
            }
            
            // Initialize plugins after a short delay
            setTimeout(() => {
                this.initializePlugins();
            }, 500);
        },
        
        // Initialize Firebase (deferred)
        initializeFirebase: function() {
            console.log('🔥 Loading Coordinator: Firebase initialization deferred');
            // Firebase will be initialized by AuthContext when needed
            this.markReady('firebase');
        },
        
        // Initialize plugins (deferred)
        initializePlugins: function() {
            console.log('🔌 Loading Coordinator: Plugin initialization deferred');
            
            // Check for push extensions
            if (window.checkPushExtensions) {
                setTimeout(() => {
                    try {
                        window.checkPushExtensions();
                    } catch (error) {
                        console.error('❌ Push extensions check failed:', error);
                    }
                }, 1000);
            }
        }
    };

    // Wait for Capacitor to be ready
    function waitForCapacitor() {
        if (window.Capacitor && window.Capacitor.Plugins) {
            window.PhotoShareLoadingState.markReady('capacitor');
            return;
        }
        
        const checkCapacitor = () => {
            if (window.Capacitor && window.Capacitor.Plugins) {
                window.PhotoShareLoadingState.markReady('capacitor');
            } else {
                setTimeout(checkCapacitor, 50);
            }
        };
        
        checkCapacitor();
    }

    // Wait for Supabase to be ready
    // OPTIMIZATION: Already at 50ms polling - optimal for critical path
    function waitForSupabase() {
        if (window.supabase) {
            window.PhotoShareLoadingState.markReady('supabase');
            return;
        }
        
        const checkSupabase = () => {
            if (window.supabase) {
                window.PhotoShareLoadingState.markReady('supabase');
            } else {
                setTimeout(checkSupabase, 50); // Optimal interval for critical path
            }
        };
        
        checkSupabase();
    }

    // Wait for Auth Bridge to be ready
    // OPTIMIZATION: Reduced polling interval from 100ms to 50ms for faster detection
    function waitForAuthBridge() {
        if (window.PhotoShareAuthBridge && window.PhotoShareAuthBridge.isReady()) {
            window.PhotoShareLoadingState.markReady('authBridge');
            return;
        }
        
        // Listen for auth bridge ready event
        window.addEventListener('photoshare-auth-bridge-ready', () => {
            window.PhotoShareLoadingState.markReady('authBridge');
        });
        
        // Also poll for readiness
        const checkAuthBridge = () => {
            if (window.PhotoShareAuthBridge && window.PhotoShareAuthBridge.isReady()) {
                window.PhotoShareLoadingState.markReady('authBridge');
            } else {
                setTimeout(checkAuthBridge, 50); // Optimized: 100ms -> 50ms
            }
        };
        
        checkAuthBridge();
    }

    // Start monitoring dependencies
    function startMonitoring() {
        console.log('👀 Loading Coordinator: Starting dependency monitoring...');
        
        waitForCapacitor();
        waitForSupabase();
        waitForAuthBridge();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startMonitoring);
    } else {
        startMonitoring();
    }

    // Expose helper functions globally
    window.waitForPhotoshareCoreReady = function() {
        return window.PhotoShareLoadingState.waitForAll(['capacitor', 'supabase', 'authBridge']);
    };

    window.waitForPhotoshareReady = function(dependency) {
        return window.PhotoShareLoadingState.waitFor(dependency);
    };

    console.log('✅ Loading Coordinator initialized');

})();