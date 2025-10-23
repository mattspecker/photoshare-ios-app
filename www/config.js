/**
 * Configuration for PhotoShare Auto-Upload System
 * Update these values with your actual website credentials for end-to-end testing
 */

console.log('📋 Loading PhotoShare configuration...');

window.PHOTOSHARE_CONFIG = {
  // Website Configuration
  website: {
    url: 'https://photoshare.ai',
    apiEndpoint: '/functions/v1/mobile-upload',
    // Set to true when you have actual credentials
    useRealWebsite: true  // ← Changed to true for live testing
  },
  
  // Supabase Configuration  
  // ✅ LIVE CREDENTIALS FOR PHOTO-SHARE.APP
  supabase: {
    url: 'https://jgfcfdlfcnmaripgpepl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnZmNmZGxmY25tYXJpcGdwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1NDM2MjgsImV4cCI6MjA2ODExOTYyOH0.OmkqPDJM8-BKLDo5WxsL8Nop03XxAaygNaToOMKkzGY',
    // Set to true when you have actual credentials
    useRealSupabase: true  // ← Changed to true for live testing
  },
  
  // Upload Configuration (from auto-upload.md)
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    rateLimit: {
      maxUploads: 50,
      windowMinutes: 60
    },
    // Upload quality settings
    quality: {
      wifi: 0.95,
      cellular: 0.80,
      lowBandwidth: 0.65
    }
  },
  
  // Auto-Upload Settings
  autoUpload: {
    // Photo monitoring interval
    scanInterval: 30000, // 30 seconds
    maxPhotosPerScan: 50,
    // Retry configuration
    maxRetryAttempts: 3,
    retryDelayMs: 5000,
    uploadTimeoutMs: 60000,
    // Batch processing
    maxConcurrentUploads: 3,
    batchSize: 5
  },
  
  // Test Configuration
  test: {
    // Mock user for testing
    mockUser: {
      id: 'test_user_photoshare',
      email: 'test@photo-share.app',
      name: 'Test User'
    },
    // Mock event for testing
    mockEvent: {
      id: 'test_event_photoshare',
      name: 'PhotoShare Auto-Upload Test Event',
      isLive: true,
      autoUploadEnabled: true,
      // Upload window: 1 hour ago to 2 hours from now
      uploadWindow: {
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }
    },
    // Enable debug logging
    debugMode: true,
    // Simulate network conditions
    networkSimulation: {
      enabled: true,
      connectionType: 'wifi', // 'wifi', 'cellular', 'slow'
      latency: 100, // ms
      bandwidth: 'high' // 'high', 'medium', 'low'
    }
  },
  
  // Error Handling
  errorHandling: {
    // Expected error codes from mobile-upload endpoint
    expectedErrorCodes: {
      401: 'Missing/invalid authorization header or token',
      400: 'Missing required fields or invalid base64 data',
      403: 'Upload permissions denied or auto-upload not active',
      500: 'Storage upload failed, database insert failed, or internal server error',
      429: 'Rate limit exceeded',
      413: 'Storage quota exceeded',
      200: 'Success (includes duplicate file detection)'
    },
    // Retry strategy
    retryStrategy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    }
  },
  
  // Feature Flags
  features: {
    enableReliableUpload: true,
    enableStatusSharing: true,
    enableBatchProcessing: true,
    enableWebsiteIntegration: true,
    enableBackgroundProcessing: true,
    enableRealTimeUpdates: true
  }
};

// Helper functions for configuration
window.PHOTOSHARE_CONFIG.isProductionReady = function() {
  return this.website.useRealWebsite && this.supabase.useRealSupabase;
};

window.PHOTOSHARE_CONFIG.getSupabaseConfig = function() {
  if (this.supabase.useRealSupabase) {
    return {
      url: this.supabase.url,
      anonKey: this.supabase.anonKey
    };
  } else {
    console.log('⚠️ Using mock Supabase configuration for testing');
    return null;
  }
};

window.PHOTOSHARE_CONFIG.getWebsiteUrl = function() {
  return this.website.url;
};

window.PHOTOSHARE_CONFIG.getApiEndpoint = function() {
  return this.website.url + this.website.apiEndpoint;
};

// Configuration validation
window.PHOTOSHARE_CONFIG.validate = function() {
  const issues = [];
  
  if (this.website.useRealWebsite) {
    if (!this.website.url || this.website.url.includes('YOUR_')) {
      issues.push('Website URL not configured');
    }
  }
  
  if (this.supabase.useRealSupabase) {
    if (!this.supabase.url || this.supabase.url.includes('YOUR_')) {
      issues.push('Supabase URL not configured');
    }
    if (!this.supabase.anonKey || this.supabase.anonKey.includes('YOUR_')) {
      issues.push('Supabase anon key not configured');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues
  };
};

// Log configuration status
console.log('📋 PhotoShare Configuration Loaded');
console.log(`🌐 Website Integration: ${window.PHOTOSHARE_CONFIG.website.useRealWebsite ? '🔴 Real' : '🧪 Mock'}`);
console.log(`🗄️ Supabase Integration: ${window.PHOTOSHARE_CONFIG.supabase.useRealSupabase ? '🔴 Real' : '🧪 Mock'}`);
console.log(`🚀 Production Ready: ${window.PHOTOSHARE_CONFIG.isProductionReady() ? '✅ Yes' : '⚠️ No'}`);

// Validation check
const validation = window.PHOTOSHARE_CONFIG.validate();
if (!validation.isValid) {
  console.log('⚠️ Configuration Issues:');
  validation.issues.forEach(issue => console.log(`   • ${issue}`));
}

console.log('✅ Configuration ready for auto-upload system');