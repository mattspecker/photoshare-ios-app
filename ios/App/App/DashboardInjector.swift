import Foundation
import Capacitor
import WebKit

/**
 * Dashboard Injector - Injects auto-upload dashboard into any webpage
 * This runs after every page load, including external sites like photo-share.app
 */

@objc public class DashboardInjector: NSObject {
    
    private var webView: WKWebView?
    private var isInjected = false
    
    @objc public init(webView: WKWebView) {
        self.webView = webView
        super.init()
        setupInjection()
    }
    
    private func setupInjection() {
        guard let webView = self.webView else { return }
        
        print("🔧 DashboardInjector: Setting up JavaScript injection")
        
        // Create the dashboard JavaScript code
        let dashboardJS = createDashboardJavaScript()
        
        // Create user script that runs after document loads
        let userScript = WKUserScript(
            source: dashboardJS,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        
        // Add to web view configuration
        webView.configuration.userContentController.addUserScript(userScript)
        
        print("✅ DashboardInjector: JavaScript injection configured")
    }
    
    private func createDashboardJavaScript() -> String {
        return """
        (function() {
            console.log('🔥 Dashboard injector running on: ' + window.location.hostname);
            
            // Only inject once per page
            if (window.PhotoShareDashboardInjected) {
                console.log('⚠️ Dashboard already injected, skipping');
                return;
            }
            window.PhotoShareDashboardInjected = true;
            
            // Create dashboard overlay
            function createNativeDashboard() {
                console.log('📱 Creating native dashboard overlay...');
                
                // Remove existing dashboard
                const existing = document.getElementById('native-photo-share-dashboard');
                if (existing) existing.remove();
                
                const dashboard = document.createElement('div');
                dashboard.id = 'native-photo-share-dashboard';
                dashboard.style.cssText = `
                    position: fixed;
                    top: -320px;
                    left: 15px;
                    right: 15px;
                    height: 300px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-radius: 16px;
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 14px;
                    z-index: 2147483647;
                    transition: top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.6);
                    border: 2px solid rgba(255,255,255,0.15);
                `;
                
                dashboard.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
                        <div>
                            <h3 style="margin: 0; font-size: 18px;">📱 PhotoShare Dashboard</h3>
                            <div id="dashboard-url" style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${window.location.hostname}</div>
                        </div>
                        <button id="close-native-dashboard" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 16px;">✕</button>
                    </div>
                    <div id="native-dashboard-content" style="height: 200px; overflow-y: auto;">
                        <div style="text-align: center; padding: 30px 0; opacity: 0.8;">
                            Loading auto-upload status...
                        </div>
                    </div>
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; opacity: 0.7; text-align: center;">
                        🖐️ 3-finger tap to toggle • 📳 Shake device • Console: showDashboard()
                    </div>
                `;
                
                document.body.appendChild(dashboard);
                
                // Add close button handler
                document.getElementById('close-native-dashboard').addEventListener('click', hideDashboard);
                
                return dashboard;
            }
            
            // Show dashboard
            function showDashboard() {
                const dashboard = document.getElementById('native-photo-share-dashboard') || createNativeDashboard();
                dashboard.style.top = '20px';
                updateDashboardStatus();
                console.log('📊 Native dashboard shown');
            }
            
            // Hide dashboard
            function hideDashboard() {
                const dashboard = document.getElementById('native-photo-share-dashboard');
                if (dashboard) {
                    dashboard.style.top = '-320px';
                }
                console.log('📊 Native dashboard hidden');
            }
            
            // Toggle dashboard
            function toggleDashboard() {
                const dashboard = document.getElementById('native-photo-share-dashboard');
                if (dashboard && dashboard.style.top === '20px') {
                    hideDashboard();
                } else {
                    showDashboard();
                }
            }
            
            // Update dashboard content
            function updateDashboardStatus() {
                const content = document.getElementById('native-dashboard-content');
                if (!content) return;
                
                const status = gatherCurrentStatus();
                content.innerHTML = formatStatusHTML(status);
            }
            
            // Gather status information
            function gatherCurrentStatus() {
                const status = {
                    timestamp: new Date().toLocaleTimeString(),
                    url: window.location.href,
                    domain: window.location.hostname,
                    isPhotoShareApp: window.location.hostname.includes('photo-share.app'),
                    capacitor: typeof window.Capacitor !== 'undefined',
                    isNative: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
                    services: {},
                    autoUpload: { status: 'checking...' },
                    authentication: { status: 'checking...' }
                };
                
                // Check for auto-upload services
                const serviceNames = [
                    'PhotoShareAutoUpload',
                    'reliableUploadService', 
                    'autoUploadIntegration',
                    'websiteIntegration'
                ];
                
                serviceNames.forEach(name => {
                    status.services[name] = typeof window[name] !== 'undefined';
                });
                
                // Check auto-upload status
                try {
                    if (window.getAutoUploadStatus) {
                        const autoStatus = window.getAutoUploadStatus();
                        status.autoUpload = autoStatus;
                    } else if (window.autoUploadIntegration && window.autoUploadIntegration.getAutoUploadStatus) {
                        status.autoUpload = window.autoUploadIntegration.getAutoUploadStatus();
                    }
                } catch (e) {
                    status.autoUpload = { error: e.message };
                }
                
                // Check authentication (for photo-share.app)
                try {
                    if (status.isPhotoShareApp) {
                        // Try common authentication patterns
                        if (window.supabase) {
                            window.supabase.auth.getUser().then(result => {
                                const user = result.data?.user;
                                status.authentication = {
                                    authenticated: !!user,
                                    email: user?.email,
                                    provider: user?.app_metadata?.provider
                                };
                                updateDashboardStatus(); // Refresh with auth data
                            }).catch(e => {
                                status.authentication = { error: e.message };
                            });
                        }
                    }
                } catch (e) {
                    status.authentication = { error: e.message };
                }
                
                return status;
            }
            
            // Format status as HTML
            function formatStatusHTML(status) {
                const nativeIcon = status.isNative ? '✅' : '❌';
                const capacitorIcon = status.capacitor ? '✅' : '❌';
                const photoShareIcon = status.isPhotoShareApp ? '🎯' : '🌐';
                
                let html = `
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #4FC3F7;">${photoShareIcon} Current Site</strong><br/>
                        ${status.domain}<br/>
                        <small style="opacity: 0.7;">Updated: ${status.timestamp}</small>
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #81C784;">📱 Native Status</strong><br/>
                        ${nativeIcon} iOS App: ${status.isNative ? 'Active' : 'Browser Mode'}<br/>
                        ${capacitorIcon} Capacitor: ${status.capacitor ? 'Available' : 'Not Available'}
                    </div>
                `;
                
                // Services status
                const serviceCount = Object.values(status.services).filter(Boolean).length;
                const totalServices = Object.keys(status.services).length;
                
                html += `
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #FFB74D;">🔧 Services (${serviceCount}/${totalServices})</strong><br/>
                `;
                
                Object.entries(status.services).forEach(([name, available]) => {
                    const shortName = name.replace('Service', '').replace('PhotoShare', '');
                    const icon = available ? '✅' : '❌';
                    html += `${icon} ${shortName}<br/>`;
                });
                
                html += '</div>';
                
                // Auto-upload status
                if (status.autoUpload) {
                    html += `
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #E57373;">📤 Auto-Upload</strong><br/>
                    `;
                    
                    if (status.autoUpload.error) {
                        html += `❌ Error: ${status.autoUpload.error}`;
                    } else if (status.autoUpload.status) {
                        html += `📊 Status: ${status.autoUpload.status}`;
                    } else {
                        html += `${status.autoUpload.isActive ? '🟢' : '⚪'} ${status.autoUpload.isActive ? 'Active' : 'Inactive'}`;
                    }
                    
                    html += '</div>';
                }
                
                // Authentication status (for photo-share.app)
                if (status.isPhotoShareApp && status.authentication) {
                    html += `
                        <div style="margin-bottom: 12px;">
                            <strong style="color: #BA68C8;">🔐 Authentication</strong><br/>
                    `;
                    
                    if (status.authentication.error) {
                        html += `❌ Error: ${status.authentication.error}`;
                    } else if (status.authentication.authenticated) {
                        html += `✅ Signed in: ${status.authentication.email || 'User'}`;
                    } else {
                        html += `❌ Not signed in`;
                    }
                    
                    html += '</div>';
                }
                
                return html;
            }
            
            // Set up touch gestures
            let touchCount = 0;
            let touchTimer = null;
            
            document.addEventListener('touchstart', function(e) {
                if (e.touches.length === 3) {
                    e.preventDefault();
                    touchCount++;
                    
                    if (touchTimer) clearTimeout(touchTimer);
                    
                    touchTimer = setTimeout(() => {
                        if (touchCount >= 1) {
                            toggleDashboard();
                        }
                        touchCount = 0;
                    }, 1000);
                }
            }, { passive: false });
            
            // Shake detection
            if (window.DeviceMotionEvent) {
                let lastShake = 0;
                
                window.addEventListener('devicemotion', function(e) {
                    const now = Date.now();
                    if (now - lastShake < 1000) return;
                    
                    const acc = e.accelerationIncludingGravity;
                    if (acc && (Math.abs(acc.x) > 12 || Math.abs(acc.y) > 12 || Math.abs(acc.z) > 12)) {
                        lastShake = now;
                        toggleDashboard();
                    }
                });
            }
            
            // Expose global functions
            window.showDashboard = showDashboard;
            window.hideDashboard = hideDashboard;
            window.toggleDashboard = toggleDashboard;
            window.updateDashboardStatus = updateDashboardStatus;
            
            // Create dashboard immediately
            createNativeDashboard();
            
            console.log('✅ Native dashboard ready on ' + window.location.hostname);
            console.log('💡 Access: showDashboard(), 3-finger tap, or shake device');
        })();
        """
    }
}

// Extension to automatically inject dashboard
extension CAPBridgeViewController {
    
    override open func viewDidLoad() {
        super.viewDidLoad()
        
        print("🚀 CAPBridgeViewController: Setting up dashboard injection")
        
        // Inject dashboard into web view
        if let webView = self.webView {
            _ = DashboardInjector(webView: webView)
        }
    }
}