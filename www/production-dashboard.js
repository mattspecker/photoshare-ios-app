/**
 * Production Dashboard for PhotoShare Auto-Upload
 * Injects monitoring capabilities into the live photo-share.app website
 * Accessible via browser console when running in iOS app
 */

console.log('📊 Loading Production Dashboard...');

// Create production dashboard namespace
window.PhotoShareProductionDashboard = {
  version: '1.0.0',
  initialized: false,
  
  // Initialize dashboard
  async init() {
    if (this.initialized) return;
    
    console.log('🚀 Initializing Production Dashboard...');
    
    // Wait for auto-upload system to be ready
    await this.waitForAutoUploadSystem();
    
    // Create floating debug panel
    this.createDebugPanel();
    
    // Set up keyboard shortcut (Cmd+Shift+D on iOS)
    this.setupKeyboardShortcuts();
    
    // Create global debug functions
    this.exposeDebugFunctions();
    
    this.initialized = true;
    console.log('✅ Production Dashboard ready');
    console.log('💡 Access dashboard: window.Dashboard.show()');
    console.log('💡 Keyboard shortcut: Hold screen with 3 fingers for 2 seconds');
  },
  
  // Wait for auto-upload system to load
  async waitForAutoUploadSystem() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      
      const checkSystem = () => {
        attempts++;
        
        if (window.PhotoShareAutoUpload || window.getAutoUploadStatus || attempts >= maxAttempts) {
          resolve();
        } else {
          setTimeout(checkSystem, 1000);
        }
      };
      
      checkSystem();
    });
  },
  
  // Create floating debug panel
  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'production-dashboard';
    panel.style.cssText = `
      position: fixed;
      top: -300px;
      right: 20px;
      width: 350px;
      height: 280px;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      border-radius: 12px;
      padding: 15px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 12px;
      z-index: 999999;
      transition: top 0.3s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    `;
    
    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
        <h3 style="margin: 0; color: #00ff88;">📊 Auto-Upload Status</h3>
        <button onclick="window.Dashboard.hide()" style="background: #ff4444; border: none; color: white; border-radius: 4px; padding: 4px 8px; cursor: pointer;">×</button>
      </div>
      <div id="dashboard-content" style="overflow-y: auto; height: 220px;">
        <div id="status-loading">Loading status...</div>
      </div>
    `;
    
    document.body.appendChild(panel);
    this.updateDashboardContent();
    
    // Update every 5 seconds
    setInterval(() => this.updateDashboardContent(), 5000);
  },
  
  // Update dashboard content with current status
  async updateDashboardContent() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    
    try {
      const status = await this.gatherSystemStatus();
      content.innerHTML = this.formatStatusHTML(status);
    } catch (error) {
      content.innerHTML = `<div style="color: #ff4444;">Error: ${error.message}</div>`;
    }
  },
  
  // Gather comprehensive system status
  async gatherSystemStatus() {
    const status = {
      timestamp: new Date().toLocaleTimeString(),
      native: window.Capacitor?.isNativePlatform() || false,
      authenticated: false,
      autoUploadActive: false,
      services: {},
      stats: {},
      errors: []
    };
    
    // Check authentication
    try {
      const user = await window.PhotoShareAutoUpload?.getCurrentUser?.();
      status.authenticated = !!user;
      if (user) {
        status.userId = user.id;
        status.userEmail = user.email;
      }
    } catch (e) {
      status.errors.push(`Auth check: ${e.message}`);
    }
    
    // Check auto-upload status
    try {
      if (window.getAutoUploadStatus) {
        const autoStatus = window.getAutoUploadStatus();
        status.autoUploadActive = autoStatus?.isActive || false;
        status.monitoring = autoStatus?.isMonitoring || false;
      }
    } catch (e) {
      status.errors.push(`Auto-upload: ${e.message}`);
    }
    
    // Check services
    const services = ['reliableUploadService', 'websiteIntegration', 'autoUploadSettings'];
    services.forEach(serviceName => {
      try {
        const service = window[serviceName];
        status.services[serviceName] = {
          loaded: !!service,
          initialized: service?.isInitialized || false
        };
      } catch (e) {
        status.services[serviceName] = { loaded: false, error: e.message };
      }
    });
    
    // Get stats
    try {
      if (window.getAutoUploadStats) {
        status.stats = window.getAutoUploadStats();
      }
    } catch (e) {
      status.errors.push(`Stats: ${e.message}`);
    }
    
    return status;
  },
  
  // Format status as HTML
  formatStatusHTML(status) {
    const authIcon = status.authenticated ? '✅' : '❌';
    const activeIcon = status.autoUploadActive ? '🟢' : '⚪';
    
    return `
      <div style="margin-bottom: 12px;">
        <strong>🏃 System Status</strong> (${status.timestamp})
        <br/>📱 Native App: ${status.native ? '✅' : '❌'}
        <br/>${authIcon} Authenticated: ${status.authenticated}
        ${status.userEmail ? `<br/>👤 User: ${status.userEmail}` : ''}
        <br/>${activeIcon} Auto-Upload: ${status.autoUploadActive ? 'Active' : 'Inactive'}
      </div>
      
      <div style="margin-bottom: 12px;">
        <strong>🔧 Services</strong>
        ${Object.entries(status.services).map(([name, info]) => 
          `<br/>${info.loaded ? '✅' : '❌'} ${name.replace('Service', '')}: ${info.initialized ? 'Ready' : 'Not Ready'}`
        ).join('')}
      </div>
      
      ${Object.keys(status.stats).length > 0 ? `
        <div style="margin-bottom: 12px;">
          <strong>📊 Statistics</strong>
          <br/>Events: ${status.stats.enabledEvents || 0}
          <br/>Uploads: ${status.stats.totalUploads || 0}
          <br/>Success Rate: ${status.stats.successRate || 0}%
        </div>
      ` : ''}
      
      ${status.errors.length > 0 ? `
        <div style="margin-bottom: 12px; color: #ff8888;">
          <strong>⚠️ Issues</strong>
          ${status.errors.map(error => `<br/>• ${error}`).join('')}
        </div>
      ` : ''}
      
      <div style="margin-top: 15px; font-size: 10px; opacity: 0.7;">
        💡 Console: Dashboard.reinit(), Dashboard.test()
      </div>
    `;
  },
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts() {
    let touchCount = 0;
    let touchTimer = null;
    
    // Three-finger tap to show dashboard
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 3) {
        touchCount++;
        if (touchTimer) clearTimeout(touchTimer);
        
        touchTimer = setTimeout(() => {
          if (touchCount >= 1) {
            this.toggle();
          }
          touchCount = 0;
        }, 2000);
      }
    });
    
    // Keyboard shortcut for development
    document.addEventListener('keydown', (e) => {
      if (e.metaKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });
  },
  
  // Expose debug functions
  exposeDebugFunctions() {
    window.Dashboard = {
      show: () => this.show(),
      hide: () => this.hide(),
      toggle: () => this.toggle(),
      status: () => this.gatherSystemStatus(),
      reinit: () => this.reinitializeAutoUpload(),
      test: () => this.runDiagnostics(),
      logs: () => this.showRecentLogs()
    };
    
    // Also expose on PhotoShare namespace for consistency
    window.PhotoShare = window.PhotoShare || {};
    window.PhotoShare.Dashboard = window.Dashboard;
  },
  
  // Show dashboard
  show() {
    const panel = document.getElementById('production-dashboard');
    if (panel) {
      panel.style.top = '20px';
      this.updateDashboardContent();
    }
  },
  
  // Hide dashboard
  hide() {
    const panel = document.getElementById('production-dashboard');
    if (panel) {
      panel.style.top = '-300px';
    }
  },
  
  // Toggle dashboard visibility
  toggle() {
    const panel = document.getElementById('production-dashboard');
    if (panel) {
      const isVisible = panel.style.top === '20px';
      if (isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
  },
  
  // Reinitialize auto-upload system
  async reinitializeAutoUpload() {
    console.log('🔄 Reinitializing auto-upload system...');
    
    try {
      if (window.PhotoShareAutoUpload?.reinitialize) {
        await window.PhotoShareAutoUpload.reinitialize();
        console.log('✅ Auto-upload reinitialized');
      } else {
        console.log('❌ Auto-upload reinitialize function not available');
      }
    } catch (error) {
      console.error('❌ Reinitialize failed:', error);
    }
    
    this.updateDashboardContent();
  },
  
  // Run diagnostic tests
  async runDiagnostics() {
    console.log('🔍 Running auto-upload diagnostics...');
    
    const tests = [
      {
        name: 'Native Platform Check',
        test: () => window.Capacitor?.isNativePlatform(),
        expected: true
      },
      {
        name: 'Camera Plugin Available',
        test: () => !!window.Capacitor?.Plugins?.Camera,
        expected: true
      },
      {
        name: 'Auto-Upload Integration Loaded',
        test: () => !!window.PhotoShareAutoUpload,
        expected: true
      },
      {
        name: 'Reliable Upload Service',
        test: () => !!window.reliableUploadService,
        expected: true
      },
      {
        name: 'Website Integration',
        test: () => !!window.websiteIntegration,
        expected: true
      }
    ];
    
    const results = tests.map(test => {
      try {
        const result = test.test();
        return {
          name: test.name,
          passed: result === test.expected,
          result,
          expected: test.expected
        };
      } catch (error) {
        return {
          name: test.name,
          passed: false,
          result: `Error: ${error.message}`,
          expected: test.expected
        };
      }
    });
    
    console.table(results);
    return results;
  },
  
  // Show recent console logs
  showRecentLogs() {
    console.log('📋 Recent auto-upload related logs:');
    // This would require implementing log capture, for now just show available functions
    
    const availableFunctions = Object.keys(window)
      .filter(key => key.toLowerCase().includes('upload') || key.includes('PhotoShare'))
      .map(key => ({ name: key, type: typeof window[key] }));
    
    console.table(availableFunctions);
    return availableFunctions;
  }
};

// Auto-initialize when running in native app
if (window.Capacitor?.isNativePlatform()) {
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => window.PhotoShareProductionDashboard.init(), 2000);
    });
  } else {
    setTimeout(() => window.PhotoShareProductionDashboard.init(), 2000);
  }
}

console.log('✅ Production Dashboard script loaded');