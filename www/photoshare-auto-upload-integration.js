/**
 * PhotoShare Auto-Upload Integration
 * This file adds auto-upload capabilities to the live photo-share.app website
 * when running in the iOS Capacitor app
 */

console.log('📱 PhotoShare Auto-Upload Integration loading...');

// Check if we're running in the native iOS app
const isNativeApp = window.Capacitor && window.Capacitor.isNativePlatform();

if (isNativeApp) {
  console.log('✅ Running in native iOS app - initializing auto-upload system');
  
  // Wait for the page to be ready
  document.addEventListener('DOMContentLoaded', initializePhotoShareAutoUpload);
  
  // Also initialize if DOM is already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePhotoShareAutoUpload);
  } else {
    initializePhotoShareAutoUpload();
  }
} else {
  console.log('🌐 Running in web browser - auto-upload not available');
}

async function initializePhotoShareAutoUpload() {
  try {
    console.log('🚀 Initializing PhotoShare auto-upload system...');
    
    // Wait a bit for the main website to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we have the necessary permissions
    const hasPermissions = await checkNativePermissions();
    if (!hasPermissions) {
      console.log('❌ Required permissions not available');
      return;
    }
    
    // Get current user from the website
    const currentUser = await getCurrentUserFromWebsite();
    if (!currentUser) {
      console.log('⚠️ User not logged in - auto-upload will initialize when user logs in');
      setupAuthListener();
      return;
    }
    
    // Get Supabase client from the website
    const supabaseClient = getSupabaseClientFromWebsite();
    if (!supabaseClient) {
      console.log('❌ Could not get Supabase client from website');
      return;
    }
    
    // Initialize the auto-upload system
    await initializeAutoUploadSystem(supabaseClient, currentUser);
    
    // Add auto-upload UI to the website
    addAutoUploadUIToWebsite();
    
    console.log('✅ PhotoShare auto-upload system initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize auto-upload system:', error);
  }
}

async function checkNativePermissions() {
  try {
    if (!window.Capacitor?.Plugins?.Camera) {
      return false;
    }
    
    const permissions = await window.Capacitor.Plugins.Camera.checkPermissions();
    return permissions.photos === 'granted';
    
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

async function getCurrentUserFromWebsite() {
  try {
    // Try to get user from common website patterns
    
    // Method 1: Check if website exposes current user
    if (window.currentUser) {
      return window.currentUser;
    }
    
    // Method 2: Check Supabase auth state
    if (window.supabase) {
      const { data: { user } } = await window.supabase.auth.getUser();
      return user;
    }
    
    // Method 3: Check other common patterns
    if (window.user || window.authUser) {
      return window.user || window.authUser;
    }
    
    // Method 4: Check React/Vue app state (if available)
    if (window.__INITIAL_STATE__?.user) {
      return window.__INITIAL_STATE__.user;
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

function getSupabaseClientFromWebsite() {
  try {
    // Try to get Supabase client from the website
    if (window.supabase) {
      return window.supabase;
    }
    
    if (window.supabaseClient) {
      return window.supabaseClient;
    }
    
    // Try to create our own client using website's config
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      return window.supabase?.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting Supabase client:', error);
    return null;
  }
}

function setupAuthListener() {
  // Monitor for user login
  const checkForUser = setInterval(async () => {
    const user = await getCurrentUserFromWebsite();
    if (user) {
      clearInterval(checkForUser);
      console.log('✅ User logged in - initializing auto-upload');
      
      const supabaseClient = getSupabaseClientFromWebsite();
      if (supabaseClient) {
        await initializeAutoUploadSystem(supabaseClient, user);
        addAutoUploadUIToWebsite();
      }
    }
  }, 2000); // Check every 2 seconds
  
  // Stop checking after 60 seconds
  setTimeout(() => clearInterval(checkForUser), 60000);
}

async function initializeAutoUploadSystem(supabaseClient, currentUser) {
  try {
    console.log('🔧 Initializing auto-upload components...');
    
    // Initialize website integration first
    if (window.initializeWebsiteIntegration) {
      await window.initializeWebsiteIntegration();
    }
    
    // Initialize auto-upload settings
    if (window.initializeAutoUploadSettings) {
      await window.initializeAutoUploadSettings(supabaseClient, currentUser);
    }
    
    // Initialize auto-upload integration
    if (window.initializeAutoUploadIntegration) {
      await window.initializeAutoUploadIntegration(supabaseClient, currentUser);
    }
    
    // Check if user has any events with auto-upload enabled
    if (window.getAutoUploadStats) {
      const stats = window.getAutoUploadStats();
      console.log(`📊 Auto-upload stats: ${stats.enabledEvents} enabled events`);
      
      if (stats.enabledEvents > 0) {
        // Start auto-upload monitoring
        if (window.startAutoUpload) {
          await window.startAutoUpload();
          console.log('✅ Auto-upload monitoring started');
        }
      }
    }
    
    // Show success notification
    showAutoUploadNotification('✅ Auto-upload ready! Photos will be automatically uploaded during events.', 'success');
    
  } catch (error) {
    console.error('Error initializing auto-upload system:', error);
    showAutoUploadNotification('❌ Auto-upload setup failed. Some features may not work.', 'error');
  }
}

function addAutoUploadUIToWebsite() {
  try {
    console.log('🎨 Adding auto-upload UI to website...');
    
    // Add auto-upload settings button to navigation or settings area
    addAutoUploadSettingsButton();
    
    // Add auto-upload status indicator
    addAutoUploadStatusIndicator();
    
    // Add auto-upload controls to event pages
    addAutoUploadControlsToEvents();
    
  } catch (error) {
    console.error('Error adding auto-upload UI:', error);
  }
}

function addAutoUploadSettingsButton() {
  // Try to find common navigation areas
  const navSelectors = [
    'nav', '.nav', '.navigation', '.navbar', 
    '.header', '.menu', '.sidebar',
    '[data-testid="navigation"]', '[data-testid="menu"]'
  ];
  
  let targetNav = null;
  for (const selector of navSelectors) {
    targetNav = document.querySelector(selector);
    if (targetNav) break;
  }
  
  if (targetNav) {
    const autoUploadBtn = document.createElement('button');
    autoUploadBtn.innerHTML = '📱 Auto-Upload Settings';
    autoUploadBtn.className = 'auto-upload-settings-btn';
    autoUploadBtn.style.cssText = `
      background: linear-gradient(45deg, #28a745, #20c997);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      margin: 5px;
    `;
    
    autoUploadBtn.addEventListener('click', openAutoUploadSettings);
    targetNav.appendChild(autoUploadBtn);
    
    console.log('✅ Auto-upload settings button added to navigation');
  }
}

function addAutoUploadStatusIndicator() {
  // Add a floating status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'auto-upload-status-indicator';
  statusIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 12px;
    display: none;
  `;
  
  document.body.appendChild(statusIndicator);
  
  // Update status periodically
  setInterval(updateAutoUploadStatusIndicator, 10000); // Every 10 seconds
}

function updateAutoUploadStatusIndicator() {
  const indicator = document.getElementById('auto-upload-status-indicator');
  if (!indicator || !window.getAutoUploadStatus) return;
  
  try {
    const status = window.getAutoUploadStatus();
    
    if (status.isActive && status.isMonitoring) {
      indicator.innerHTML = '📤 Auto-upload active';
      indicator.style.display = 'block';
      indicator.style.background = 'rgba(40, 167, 69, 0.9)'; // Green
    } else if (status.isInitialized) {
      indicator.innerHTML = '📱 Auto-upload ready';
      indicator.style.display = 'block';
      indicator.style.background = 'rgba(108, 117, 125, 0.9)'; // Gray
    } else {
      indicator.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating status indicator:', error);
  }
}

function addAutoUploadControlsToEvents() {
  // Look for event pages and add auto-upload toggles
  const eventSelectors = [
    '.event-card', '.event-item', '.event',
    '[data-testid="event"]', '[data-testid="event-card"]'
  ];
  
  eventSelectors.forEach(selector => {
    const eventElements = document.querySelectorAll(selector);
    eventElements.forEach(addAutoUploadToggleToEvent);
  });
}

function addAutoUploadToggleToEvent(eventElement) {
  // Don't add if already exists
  if (eventElement.querySelector('.auto-upload-toggle')) return;
  
  const toggle = document.createElement('div');
  toggle.className = 'auto-upload-toggle';
  toggle.style.cssText = `
    margin-top: 10px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #007bff;
  `;
  
  toggle.innerHTML = `
    <label style="display: flex; align-items: center; cursor: pointer;">
      <input type="checkbox" class="auto-upload-checkbox" style="margin-right: 8px;">
      <span>📤 Auto-upload photos from this event</span>
    </label>
  `;
  
  // Add event listener
  const checkbox = toggle.querySelector('.auto-upload-checkbox');
  checkbox.addEventListener('change', (e) => {
    const eventId = getEventIdFromElement(eventElement);
    if (eventId) {
      handleAutoUploadToggle(eventId, e.target.checked);
    }
  });
  
  eventElement.appendChild(toggle);
}

function getEventIdFromElement(eventElement) {
  // Try to extract event ID from various attributes
  return eventElement.dataset.eventId || 
         eventElement.dataset.id || 
         eventElement.id || 
         eventElement.getAttribute('data-event-id');
}

async function handleAutoUploadToggle(eventId, enabled) {
  try {
    if (enabled) {
      await window.enableAutoUploadForEvent?.(eventId);
      showAutoUploadNotification('✅ Auto-upload enabled for this event', 'success');
    } else {
      await window.disableAutoUploadForEvent?.(eventId);
      showAutoUploadNotification('❌ Auto-upload disabled for this event', 'info');
    }
  } catch (error) {
    console.error('Error toggling auto-upload:', error);
    showAutoUploadNotification('❌ Failed to update auto-upload setting', 'error');
  }
}

function openAutoUploadSettings() {
  // Create a modal or popup for settings
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  const iframe = document.createElement('iframe');
  iframe.src = './settings-ui.html';
  iframe.style.cssText = `
    width: 90%;
    max-width: 800px;
    height: 80%;
    border: none;
    border-radius: 10px;
    background: white;
  `;
  
  modal.appendChild(iframe);
  
  // Close on click outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  document.body.appendChild(modal);
}

function showAutoUploadNotification(message, type = 'info') {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    max-width: 400px;
    text-align: center;
  `;
  
  // Set color based on type
  switch (type) {
    case 'success':
      notification.style.background = '#28a745';
      break;
    case 'error':
      notification.style.background = '#dc3545';
      break;
    case 'info':
    default:
      notification.style.background = '#007bff';
      break;
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 5000);
}

// Export for debugging
window.PhotoShareAutoUpload = {
  getCurrentUser: getCurrentUserFromWebsite,
  getSupabaseClient: getSupabaseClientFromWebsite,
  reinitialize: initializePhotoShareAutoUpload,
  isNative: isNativeApp,
  showDashboard: () => window.Dashboard?.show(),
  getStatus: () => window.Dashboard?.status()
};

console.log('✅ PhotoShare Auto-Upload Integration ready');