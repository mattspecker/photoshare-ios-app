/**
 * Dashboard Injector - Manual Dashboard Access
 * Use this when the full JavaScript files aren't loaded on photo-share.app
 */

console.log('🚀 Dashboard Injector loading...');

(function() {
    'use strict';

    // Simple dashboard creation function
    window.createDashboard = function() {
        // Remove existing dashboard if any
        const existing = document.getElementById('photoshare-dashboard');
        if (existing) {
            existing.remove();
        }

        // Create dashboard overlay
        const dashboard = document.createElement('div');
        dashboard.id = 'photoshare-dashboard';
        dashboard.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 10000;
            font-family: monospace;
            min-width: 300px;
            max-width: 90vw;
            max-height: 80vh;
            overflow-y: auto;
        `;

        // Check system availability
        const hasAutoUpload = !!window.PhotoShareAutoUpload;
        const hasSettings = !!window.PhotoShareAutoUpload?.settingsService;
        const hasAuth = !!window.PhotoShareAutoUpload?.authService;

        let content = '<h3>📱 PhotoShare Dashboard</h3>';
        
        if (hasAutoUpload) {
            content += '<p>✅ Auto-upload system detected</p>';
            
            if (hasAuth) {
                const user = window.PhotoShareAutoUpload.authService.getCurrentUser();
                content += `<p>👤 User: ${user ? user.email : 'Not signed in'}</p>`;
            }
            
            if (hasSettings) {
                const enabledEvents = window.PhotoShareAutoUpload.settingsService.getEnabledEvents() || [];
                content += `<p>🎯 Enabled Events: ${enabledEvents.length}</p>`;
                
                if (enabledEvents.length > 0) {
                    content += '<ul>';
                    enabledEvents.forEach(eventId => {
                        content += `<li>${eventId}</li>`;
                    });
                    content += '</ul>';
                }
            }
            
            // Get system status
            try {
                const status = window.PhotoShareAutoUpload.getStatus();
                content += '<h4>📊 System Status:</h4>';
                content += `<p>• Authentication: ${status.authentication ? '✅' : '❌'}</p>`;
                content += `<p>• Settings Service: ${status.settingsService ? '✅' : '❌'}</p>`;
                content += `<p>• Upload Service: ${status.uploadService ? '✅' : '❌'}</p>`;
                content += `<p>• Photo Monitor: ${status.photoMonitor ? '✅' : '❌'}</p>`;
            } catch (e) {
                content += '<p>⚠️ Could not get system status</p>';
            }
        } else {
            content += '<p>❌ Auto-upload system not detected</p>';
            content += '<p>📋 JavaScript files may not be loaded</p>';
        }

        // Add close button
        content += '<br><button onclick="document.getElementById(\'photoshare-dashboard\').remove()" style="background: #ff4444; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer;">Close</button>';

        dashboard.innerHTML = content;
        document.body.appendChild(dashboard);

        return dashboard;
    };

    // Simple status check function
    window.checkAutoUploadStatus = function() {
        console.log('🔍 Auto-upload System Check:');
        console.log('• PhotoShareAutoUpload:', !!window.PhotoShareAutoUpload);
        console.log('• Settings Service:', !!window.PhotoShareAutoUpload?.settingsService);
        console.log('• Auth Service:', !!window.PhotoShareAutoUpload?.authService);
        console.log('• Upload Service:', !!window.PhotoShareAutoUpload?.uploadService);
        
        if (window.PhotoShareAutoUpload?.settingsService) {
            const enabled = window.PhotoShareAutoUpload.settingsService.getEnabledEvents();
            console.log('• Enabled Events:', enabled);
        }
        
        return {
            available: !!window.PhotoShareAutoUpload,
            enabled: window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || []
        };
    };

    // Force inject minimal auto-upload system
    window.injectMinimalAutoUpload = function() {
        if (window.PhotoShareAutoUpload) {
            console.log('✅ Auto-upload already available');
            return true;
        }

        console.log('🚀 Injecting minimal auto-upload system...');

        // Create minimal settings service
        class MinimalSettingsService {
            constructor() {
                this.eventSettings = new Map();
                this.loadFromStorage();
            }

            loadFromStorage() {
                try {
                    const saved = localStorage.getItem('photoshare_auto_upload_settings');
                    if (saved) {
                        const data = JSON.parse(saved);
                        if (data.eventSettings) {
                            data.eventSettings.forEach(([eventId, settings]) => {
                                this.eventSettings.set(eventId, settings);
                            });
                        }
                    }
                } catch (e) {
                    console.warn('Could not load settings from storage:', e);
                }
            }

            getEnabledEvents() {
                const enabled = [];
                for (const [eventId, settings] of this.eventSettings) {
                    if (settings.enabled) {
                        enabled.push(eventId);
                    }
                }
                return enabled;
            }

            enableAutoUploadForEvent(eventId) {
                this.eventSettings.set(eventId, {
                    enabled: true,
                    enabledAt: new Date().toISOString(),
                    options: {}
                });
                this.saveToStorage();
                console.log(`✅ Enabled auto-upload for event: ${eventId}`);
            }

            saveToStorage() {
                try {
                    const data = {
                        eventSettings: Array.from(this.eventSettings.entries())
                    };
                    localStorage.setItem('photoshare_auto_upload_settings', JSON.stringify(data));
                } catch (e) {
                    console.warn('Could not save settings:', e);
                }
            }
        }

        // Create minimal auth service
        class MinimalAuthService {
            getCurrentUser() {
                // Try multiple methods to get user
                if (window.PhotoShareAuthState?.user) {
                    return window.PhotoShareAuthState.user;
                }
                if (window.supabase) {
                    // This is async, but return null for now
                    return null;
                }
                return null;
            }

            isAuthenticated() {
                return !!this.getCurrentUser();
            }
        }

        // Create minimal system
        window.PhotoShareAutoUpload = {
            settingsService: new MinimalSettingsService(),
            authService: new MinimalAuthService(),
            getStatus: function() {
                return {
                    authentication: this.authService.isAuthenticated(),
                    settingsService: true,
                    uploadService: false,
                    photoMonitor: false
                };
            }
        };

        console.log('✅ Minimal auto-upload system injected');
        return true;
    };

    // Auto-inject if needed
    if (!window.PhotoShareAutoUpload) {
        console.log('⚠️ Auto-upload system not detected, injecting minimal version...');
        window.injectMinimalAutoUpload();
    }

    // Expose quick commands
    window.showDashboard = window.createDashboard;

    console.log('✅ Dashboard Injector ready');
    console.log('💡 Commands available:');
    console.log('• showDashboard() - Show dashboard overlay');
    console.log('• createDashboard() - Create dashboard');
    console.log('• checkAutoUploadStatus() - Check system status');
    console.log('• injectMinimalAutoUpload() - Inject minimal system');

})();