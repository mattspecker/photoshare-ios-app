/**
 * Native Overlay Dashboard for PhotoShare Auto-Upload
 * Creates a persistent overlay that works on ANY webpage (including photo-share.app)
 * Injects itself immediately when the app loads, before any website content
 */

console.log('🔥 Native Overlay Dashboard loading...');

// Inject dashboard immediately - don't wait for anything
(function() {
  'use strict';
  
  // Only run in native iOS app
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
    console.log('⚠️ Not in native app - overlay dashboard not loaded');
    return;
  }

  console.log('📱 Native iOS app detected - creating overlay dashboard');

  // Global dashboard state
  let dashboardVisible = false;
  let statusData = {};
  let updateInterval = null;

  // Create the overlay dashboard immediately
  function createOverlayDashboard() {
    // Remove existing dashboard if present
    const existing = document.getElementById('native-overlay-dashboard');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'native-overlay-dashboard';
    overlay.style.cssText = `
      position: fixed;
      top: -350px;
      left: 10px;
      right: 10px;
      height: 320px;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      border-radius: 12px;
      padding: 15px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      z-index: 9999999;
      transition: top 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(10px);
    `;

    overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 8px;">
        <h3 style="margin: 0; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">📱 PhotoShare Auto-Upload Status</h3>
        <button id="close-dashboard" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-weight: bold;">✕</button>
      </div>
      <div id="overlay-status-content" style="height: 250px; overflow-y: auto;">
        <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.8);">
          Loading status...
        </div>
      </div>
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 11px; color: rgba(255,255,255,0.7); text-align: center;">
        Tap screen with 3 fingers to toggle | Console: NativeDashboard.show()
      </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('close-dashboard').addEventListener('click', hideDashboard);

    return overlay;
  }

  // Show dashboard
  function showDashboard() {
    const overlay = document.getElementById('native-overlay-dashboard') || createOverlayDashboard();
    overlay.style.top = '20px';
    dashboardVisible = true;
    updateDashboardContent();
    
    // Start auto-updating
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateDashboardContent, 3000);
    
    console.log('📊 Native dashboard shown');
  }

  // Hide dashboard
  function hideDashboard() {
    const overlay = document.getElementById('native-overlay-dashboard');
    if (overlay) {
      overlay.style.top = '-350px';
    }
    dashboardVisible = false;
    
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    
    console.log('📊 Native dashboard hidden');
  }

  // Toggle dashboard
  function toggleDashboard() {
    if (dashboardVisible) {
      hideDashboard();
    } else {
      showDashboard();
    }
  }

  // Update dashboard content
  async function updateDashboardContent() {
    const content = document.getElementById('overlay-status-content');
    if (!content || !dashboardVisible) return;

    try {
      const status = await gatherNativeStatus();
      content.innerHTML = formatNativeStatusHTML(status);
      statusData = status;
    } catch (error) {
      content.innerHTML = `
        <div style="color: #ffaaaa; padding: 10px;">
          <strong>❌ Error gathering status:</strong><br/>
          ${error.message}
        </div>
      `;
    }
  }

  // Gather status from native environment
  async function gatherNativeStatus() {
    const status = {
      timestamp: new Date().toLocaleTimeString(),
      url: window.location.href,
      native: true,
      capacitor: !!window.Capacitor,
      plugins: {},
      services: {},
      autoUpload: {},
      errors: []
    };

    // Check Capacitor plugins
    try {
      const plugins = ['Camera', 'Device', 'Filesystem'];
      plugins.forEach(plugin => {
        status.plugins[plugin] = !!window.Capacitor?.Plugins?.[plugin];
      });
    } catch (e) {
      status.errors.push(`Plugin check: ${e.message}`);
    }

    // Check auto-upload services
    const serviceNames = [
      'PhotoShareAutoUpload',
      'reliableUploadService', 
      'autoUploadIntegration',
      'websiteIntegration',
      'autoUploadSettings'
    ];

    serviceNames.forEach(serviceName => {
      const service = window[serviceName];
      status.services[serviceName] = {
        available: !!service,
        type: typeof service,
        initialized: service?.isInitialized || false
      };
    });

    // Check auto-upload specific status
    try {
      if (window.getAutoUploadStatus) {
        status.autoUpload = window.getAutoUploadStatus();
      } else if (window.autoUploadIntegration?.getAutoUploadStatus) {
        status.autoUpload = window.autoUploadIntegration.getAutoUploadStatus();
      }
    } catch (e) {
      status.errors.push(`Auto-upload status: ${e.message}`);
    }

    // Check authentication
    try {
      if (window.PhotoShareAutoUpload?.getCurrentUser) {
        const user = await window.PhotoShareAutoUpload.getCurrentUser();
        status.authenticated = !!user;
        status.userInfo = user ? { id: user.id, email: user.email } : null;
      }
    } catch (e) {
      status.errors.push(`Auth check: ${e.message}`);
    }

    return status;
  }

  // Format status as HTML
  function formatNativeStatusHTML(status) {
    const domain = new URL(status.url).hostname;
    
    return `
      <div style="margin-bottom: 15px;">
        <strong style="color: #4CAF50;">🌐 Current Page</strong><br/>
        <span style="font-size: 12px; color: rgba(255,255,255,0.9);">${domain}</span><br/>
        <span style="font-size: 11px; color: rgba(255,255,255,0.7);">Updated: ${status.timestamp}</span>
      </div>

      <div style="margin-bottom: 15px;">
        <strong style="color: #2196F3;">📱 Native Environment</strong><br/>
        ✅ iOS App: ${status.native ? 'Active' : 'Not detected'}<br/>
        ${status.capacitor ? '✅' : '❌'} Capacitor: ${status.capacitor ? 'Available' : 'Missing'}<br/>
        ${status.plugins.Camera ? '✅' : '❌'} Camera Plugin<br/>
        ${status.plugins.Device ? '✅' : '❌'} Device Plugin<br/>
        ${status.plugins.Filesystem ? '✅' : '❌'} Filesystem Plugin
      </div>

      <div style="margin-bottom: 15px;">
        <strong style="color: #FF9800;">🔧 Auto-Upload Services</strong><br/>
        ${Object.entries(status.services).map(([name, info]) => {
          const shortName = name.replace('Service', '').replace('PhotoShare', '');
          const icon = info.available ? (info.initialized ? '✅' : '⚠️') : '❌';
          return `${icon} ${shortName}: ${info.available ? 'Loaded' : 'Missing'}`;
        }).join('<br/>')}
      </div>

      ${status.authenticated !== undefined ? `
        <div style="margin-bottom: 15px;">
          <strong style="color: #9C27B0;">🔐 Authentication</strong><br/>
          ${status.authenticated ? '✅' : '❌'} User: ${status.authenticated ? 'Signed In' : 'Not signed in'}<br/>
          ${status.userInfo?.email ? `📧 ${status.userInfo.email}<br/>` : ''}
        </div>
      ` : ''}

      ${Object.keys(status.autoUpload).length > 0 ? `
        <div style="margin-bottom: 15px;">
          <strong style="color: #4CAF50;">📤 Auto-Upload Status</strong><br/>
          ${status.autoUpload.isActive ? '🟢' : '⚪'} Active: ${status.autoUpload.isActive || false}<br/>
          ${status.autoUpload.isMonitoring ? '👀' : '😴'} Monitoring: ${status.autoUpload.isMonitoring || false}<br/>
        </div>
      ` : ''}

      ${status.errors.length > 0 ? `
        <div style="background: rgba(255,0,0,0.2); border-left: 3px solid #f44336; padding: 8px; margin: 10px 0;">
          <strong style="color: #ffcccb;">⚠️ Issues Detected</strong><br/>
          ${status.errors.map(error => `• ${error}`).join('<br/>')}
        </div>
      ` : ''}
    `;
  }

  // Set up touch gestures
  function setupTouchGestures() {
    let touchCount = 0;
    let touchTimer = null;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 3) {
        e.preventDefault();
        touchCount++;
        
        if (touchTimer) clearTimeout(touchTimer);
        
        touchTimer = setTimeout(() => {
          if (touchCount >= 1) {
            toggleDashboard();
          }
          touchCount = 0;
        }, 1500);
      }
    }, { passive: false });

    // Also add shake detection for alternative access
    if (window.DeviceMotionEvent) {
      let shakeDetected = false;
      
      window.addEventListener('devicemotion', (e) => {
        const acceleration = e.accelerationIncludingGravity;
        const threshold = 15;
        
        if (acceleration && 
            (Math.abs(acceleration.x) > threshold || 
             Math.abs(acceleration.y) > threshold || 
             Math.abs(acceleration.z) > threshold)) {
          
          if (!shakeDetected) {
            shakeDetected = true;
            setTimeout(() => { shakeDetected = false; }, 1000);
            toggleDashboard();
          }
        }
      });
    }
  }

  // Expose global functions
  function exposeGlobalFunctions() {
    window.NativeDashboard = {
      show: showDashboard,
      hide: hideDashboard,
      toggle: toggleDashboard,
      status: () => statusData,
      refresh: updateDashboardContent,
      isVisible: () => dashboardVisible
    };

    // Also add to PhotoShare namespace
    window.PhotoShare = window.PhotoShare || {};
    window.PhotoShare.NativeDashboard = window.NativeDashboard;
  }

  // Initialize everything
  function init() {
    console.log('🚀 Initializing native overlay dashboard...');
    
    // Create dashboard structure
    createOverlayDashboard();
    
    // Set up interaction
    setupTouchGestures();
    
    // Expose functions
    exposeGlobalFunctions();
    
    console.log('✅ Native overlay dashboard ready!');
    console.log('💡 Access: 3-finger tap, shake device, or NativeDashboard.show()');
  }

  // Initialize when DOM is ready or immediately if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500); // Small delay to ensure page is stable
  }

})();

console.log('✅ Native overlay dashboard script loaded');