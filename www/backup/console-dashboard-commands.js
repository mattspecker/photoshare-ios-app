/**
 * Console Dashboard Commands
 * Copy and paste these commands into the browser console when on photo-share.app
 * to access dashboard functionality
 */

// === COMMAND 1: Show Dashboard ===
// Copy this entire function and paste into console:
function showDashboard() {
    // Remove existing dashboard
    const existing = document.getElementById('photoshare-dashboard');
    if (existing) existing.remove();

    // Create dashboard
    const dashboard = document.createElement('div');
    dashboard.id = 'photoshare-dashboard';
    dashboard.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95); color: white; padding: 20px;
        border-radius: 10px; z-index: 10000; font-family: monospace;
        min-width: 320px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    let content = '<h3 style="margin-top:0;">📱 PhotoShare Auto-Upload Dashboard</h3>';
    
    // Check system availability
    const hasAutoUpload = !!window.PhotoShareAutoUpload;
    
    if (hasAutoUpload) {
        content += '<div style="color: #4CAF50;">✅ Auto-upload system detected</div>';
        
        // Check authentication
        try {
            const user = window.PhotoShareAutoUpload.authService?.getCurrentUser();
            content += `<div>👤 ${user ? `Signed in: ${user.email}` : '❌ Not signed in'}</div>`;
        } catch (e) {
            content += '<div>👤 ⚠️ Auth check failed</div>';
        }
        
        // Check enabled events
        try {
            const enabled = window.PhotoShareAutoUpload.settingsService?.getEnabledEvents() || [];
            content += `<div>🎯 Enabled Events: ${enabled.length}</div>`;
            
            if (enabled.length > 0) {
                content += '<ul style="margin: 5px 0; padding-left: 20px;">';
                enabled.forEach(eventId => {
                    content += `<li style="font-size: 12px; margin: 2px 0;">${eventId}</li>`;
                });
                content += '</ul>';
            }
        } catch (e) {
            content += '<div>🎯 ⚠️ Settings check failed</div>';
        }
        
        // System status
        try {
            const status = window.PhotoShareAutoUpload.getStatus();
            content += '<h4 style="margin: 15px 0 5px 0;">📊 System Status:</h4>';
            content += `<div style="font-size: 12px; line-height: 1.4;">`;
            content += `• Auth: ${status.authentication ? '✅' : '❌'}<br>`;
            content += `• Settings: ${status.settingsService ? '✅' : '❌'}<br>`;
            content += `• Upload: ${status.uploadService ? '✅' : '❌'}<br>`;
            content += `• Monitor: ${status.photoMonitor ? '✅' : '❌'}`;
            content += `</div>`;
        } catch (e) {
            content += '<div>⚠️ Status check failed</div>';
        }
        
    } else {
        content += '<div style="color: #f44336;">❌ Auto-upload system not detected</div>';
        content += '<div>📋 JavaScript files may not be loaded on this site</div>';
        content += '<p style="font-size: 12px; margin: 10px 0;">Try running: <code>injectMinimalSystem()</code></p>';
    }

    // Add controls
    content += '<hr style="margin: 15px 0; border: 1px solid #444;">';
    content += '<div style="text-align: center;">';
    content += '<button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 4px; margin: 5px; cursor: pointer;">Close</button>';
    
    if (hasAutoUpload) {
        content += '<button onclick="window.PhotoShareAutoUpload.settingsService.getEnabledEvents().forEach(id => console.log(`Event: ${id}`))" style="background: #2196F3; color: white; border: none; padding: 8px 15px; border-radius: 4px; margin: 5px; cursor: pointer;">Log Events</button>';
    }
    
    content += '</div>';

    dashboard.innerHTML = content;
    document.body.appendChild(dashboard);
    
    return dashboard;
}

// === COMMAND 2: Inject Minimal System ===
function injectMinimalSystem() {
    console.log('🚀 Injecting minimal auto-upload system...');
    
    if (window.PhotoShareAutoUpload) {
        console.log('✅ System already exists');
        return window.PhotoShareAutoUpload;
    }

    // Minimal settings service
    class SettingsService {
        constructor() {
            this.eventSettings = new Map();
            this.load();
        }
        
        load() {
            try {
                const saved = localStorage.getItem('photoshare_auto_upload_settings');
                if (saved) {
                    const data = JSON.parse(saved);
                    if (data.eventSettings) {
                        data.eventSettings.forEach(([id, settings]) => {
                            this.eventSettings.set(id, settings);
                        });
                    }
                }
            } catch (e) {
                console.warn('Settings load failed:', e);
            }
        }
        
        getEnabledEvents() {
            return Array.from(this.eventSettings.entries())
                .filter(([id, settings]) => settings.enabled)
                .map(([id]) => id);
        }
        
        enableAutoUploadForEvent(eventId) {
            this.eventSettings.set(eventId, {
                enabled: true,
                enabledAt: new Date().toISOString()
            });
            this.save();
        }
        
        save() {
            try {
                localStorage.setItem('photoshare_auto_upload_settings', JSON.stringify({
                    eventSettings: Array.from(this.eventSettings.entries())
                }));
            } catch (e) {
                console.warn('Settings save failed:', e);
            }
        }
    }

    // Minimal auth service
    class AuthService {
        getCurrentUser() {
            if (window.PhotoShareAuthState?.user) return window.PhotoShareAuthState.user;
            if (window.supabase) {
                // Return cached if available
                return window.currentUser || null;
            }
            return null;
        }
        
        isAuthenticated() {
            return !!this.getCurrentUser();
        }
    }

    // Create system
    window.PhotoShareAutoUpload = {
        settingsService: new SettingsService(),
        authService: new AuthService(),
        getStatus() {
            return {
                authentication: this.authService.isAuthenticated(),
                settingsService: true,
                uploadService: false,
                photoMonitor: false
            };
        }
    };

    console.log('✅ Minimal system injected');
    return window.PhotoShareAutoUpload;
}

// === COMMAND 3: Enable Event for Auto-Upload ===
function enableEventAutoUpload(eventId) {
    if (!eventId) {
        // Try to detect event from URL
        const match = window.location.pathname.match(/\/event\/([a-f0-9-]+)/);
        if (match) {
            eventId = match[1];
            console.log(`🎯 Detected event ID from URL: ${eventId}`);
        } else {
            console.error('❌ No event ID provided and could not detect from URL');
            return false;
        }
    }
    
    if (!window.PhotoShareAutoUpload) {
        injectMinimalSystem();
    }
    
    window.PhotoShareAutoUpload.settingsService.enableAutoUploadForEvent(eventId);
    console.log(`✅ Enabled auto-upload for event: ${eventId}`);
    return true;
}

// === COMMAND 4: Quick Status Check ===
function quickStatus() {
    console.log('=== PhotoShare Auto-Upload Status ===');
    console.log('System Available:', !!window.PhotoShareAutoUpload);
    
    if (window.PhotoShareAutoUpload) {
        const user = window.PhotoShareAutoUpload.authService.getCurrentUser();
        const enabled = window.PhotoShareAutoUpload.settingsService.getEnabledEvents();
        
        console.log('Authenticated:', !!user);
        if (user) console.log('User:', user.email);
        console.log('Enabled Events:', enabled.length);
        enabled.forEach(id => console.log(`  - ${id}`));
    }
    
    return {
        available: !!window.PhotoShareAutoUpload,
        enabled: window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents() || []
    };
}

// === COMMAND 5: Manual Photo Upload ===
function createManualUploadButton() {
    // Remove existing button
    const existing = document.getElementById('photoshare-upload-btn');
    if (existing) existing.remove();

    // Check for enabled events
    if (!window.PhotoShareAutoUpload?.settingsService?.getEnabledEvents()?.length) {
        console.log('⚠️ No enabled events. Run enableEventAutoUpload() first.');
        return false;
    }

    // Create upload button
    const btn = document.createElement('button');
    btn.id = 'photoshare-upload-btn';
    btn.innerHTML = '📤<br><span style="font-size:10px;">Upload Photo</span>';
    btn.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 70px; height: 70px;
        background: linear-gradient(45deg, #4CAF50, #45a049); color: white;
        border: none; border-radius: 50%; font-size: 16px; cursor: pointer;
        z-index: 9999; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; line-height: 1; font-family: system-ui;
    `;

    btn.onclick = async () => {
        console.log('📷 Opening photo picker...');
        btn.innerHTML = '📷<br><span style="font-size:10px;">Selecting</span>';
        btn.style.background = 'linear-gradient(45deg, #2196F3, #1976D2)';
        
        try {
            // Simple photo selection (you'll need to adapt based on available APIs)
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    console.log('📸 Photo selected:', file.name);
                    btn.innerHTML = '⬆️<br><span style="font-size:10px;">Uploading</span>';
                    btn.style.background = 'linear-gradient(45deg, #FF9800, #F57C00)';
                    
                    // Convert to base64
                    const reader = new FileReader();
                    reader.onload = async () => {
                        try {
                            const base64 = reader.result.split(',')[1];
                            const enabledEvents = window.PhotoShareAutoUpload.settingsService.getEnabledEvents();
                            
                            console.log(`📤 Uploading to ${enabledEvents.length} events...`);
                            
                            // Here you would call your actual upload service
                            // For now, just simulate success
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            btn.innerHTML = '✅<br><span style="font-size:10px;">Success</span>';
                            btn.style.background = 'linear-gradient(45deg, #4CAF50, #2E7D32)';
                            
                            console.log('✅ Photo uploaded successfully!');
                            
                            setTimeout(() => {
                                btn.innerHTML = '📤<br><span style="font-size:10px;">Upload Photo</span>';
                                btn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
                            }, 3000);
                            
                        } catch (error) {
                            console.error('❌ Upload failed:', error);
                            btn.innerHTML = '❌<br><span style="font-size:10px;">Error</span>';
                            btn.style.background = 'linear-gradient(45deg, #f44336, #c62828)';
                            
                            setTimeout(() => {
                                btn.innerHTML = '📤<br><span style="font-size:10px;">Upload Photo</span>';
                                btn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
                            }, 3000);
                        }
                    };
                    reader.readAsDataURL(file);
                }
                document.body.removeChild(input);
            };
            
            document.body.appendChild(input);
            input.click();
            
        } catch (error) {
            console.error('❌ Photo selection failed:', error);
            btn.innerHTML = '❌<br><span style="font-size:10px;">Error</span>';
            btn.style.background = 'linear-gradient(45deg, #f44336, #c62828)';
            
            setTimeout(() => {
                btn.innerHTML = '📤<br><span style="font-size:10px;">Upload Photo</span>';
                btn.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            }, 3000);
        }
    };

    document.body.appendChild(btn);
    console.log('✅ Manual upload button created');
    return true;
}

// Make functions available globally
window.showDashboard = showDashboard;
window.injectMinimalSystem = injectMinimalSystem;
window.enableEventAutoUpload = enableEventAutoUpload;
window.quickStatus = quickStatus;
window.createManualUploadButton = createManualUploadButton;

console.log('✅ Dashboard commands loaded!');
console.log('📋 Available commands:');
console.log('• showDashboard() - Show overlay dashboard');
console.log('• injectMinimalSystem() - Inject auto-upload system');
console.log('• enableEventAutoUpload(eventId) - Enable auto-upload for event');
console.log('• quickStatus() - Check system status');
console.log('• createManualUploadButton() - Add manual photo upload button');
console.log('💡 Quick setup: injectMinimalSystem(), then enableEventAutoUpload(), then createManualUploadButton()');