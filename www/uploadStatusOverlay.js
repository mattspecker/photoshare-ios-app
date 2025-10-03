console.log('🔄 Loading uploadStatusOverlay.js...');

// Upload Status Overlay JavaScript Interface
class UploadStatusOverlayService {
  constructor() {
    this.isInitialized = false;
    this.plugin = null;
    
    console.log('📊 UploadStatusOverlayService created');
  }

  async initialize() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins) {
        this.plugin = window.Capacitor.Plugins.UploadStatusOverlay;
        
        if (this.plugin) {
          this.isInitialized = true;
          console.log('✅ UploadStatusOverlay plugin found');
          return true;
        }
      }
      
      console.log('❌ UploadStatusOverlay plugin not available');
      return false;
      
    } catch (error) {
      console.error('❌ Error initializing UploadStatusOverlay:', error);
      return false;
    }
  }

  async showOverlay() {
    if (!this.isInitialized || !this.plugin) {
      console.log('⚠️ UploadStatusOverlay not initialized');
      return false;
    }

    try {
      await this.plugin.showOverlay();
      console.log('✅ Upload overlay shown');
      return true;
    } catch (error) {
      console.error('❌ Error showing upload overlay:', error);
      return false;
    }
  }

  async hideOverlay() {
    if (!this.isInitialized || !this.plugin) {
      console.log('⚠️ UploadStatusOverlay not initialized');
      return false;
    }

    try {
      await this.plugin.hideOverlay();
      console.log('✅ Upload overlay hidden');
      return true;
    } catch (error) {
      console.error('❌ Error hiding upload overlay:', error);
      return false;
    }
  }

  // Test method to show overlay
  async testOverlay() {
    console.log('🧪 Testing upload overlay...');
    
    const shown = await this.showOverlay();
    if (shown) {
      // Hide after 5 seconds for testing
      setTimeout(async () => {
        await this.hideOverlay();
        console.log('🧪 Test complete - overlay hidden');
      }, 5000);
      
      return true;
    }
    
    return false;
  }
}

// Create global instance
console.log('Creating UploadStatusOverlayService...');
try {
  window.uploadStatusOverlayService = new UploadStatusOverlayService();
  console.log('UploadStatusOverlayService created successfully');
} catch (error) {
  console.error('Error creating UploadStatusOverlayService:', error);
  window.uploadStatusOverlayService = null;
}

// Export convenience functions to global window
window.initializeUploadStatusOverlay = async function() {
  return await window.uploadStatusOverlayService.initialize();
}

window.showUploadOverlay = async function() {
  return await window.uploadStatusOverlayService.showOverlay();
}

window.hideUploadOverlay = async function() {
  return await window.uploadStatusOverlayService.hideOverlay();
}

window.testUploadOverlay = async function() {
  return await window.uploadStatusOverlayService.testOverlay();
}