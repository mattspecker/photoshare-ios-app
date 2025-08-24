// Camera permissions using Capacitor Camera plugin
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

// Utility function to detect if we're running in a native app context
export async function isRunningInNativeApp() {
  try {
    const deviceInfo = await Device.getInfo();
    const isCapacitorNative = Capacitor.isNativePlatform();
    
    const result = {
      isNative: isCapacitorNative && deviceInfo.platform !== 'web',
      platform: deviceInfo.platform,
      model: deviceInfo.model,
      capacitorNative: isCapacitorNative
    };
    
    console.log('Platform detection result:', result);
    return result;
  } catch (error) {
    console.error('Error detecting platform:', error);
    // Fallback to basic Capacitor detection
    return {
      isNative: Capacitor.isNativePlatform(),
      platform: 'unknown',
      model: 'unknown',
      capacitorNative: Capacitor.isNativePlatform()
    };
  }
}

export async function handleCameraPermission() {
  try {
    // Check platform using our utility function
    const platformInfo = await isRunningInNativeApp();
    
    // Check if we're on a native platform
    if (!platformInfo.isNative) {
      console.log('Camera permissions not needed - running on web platform');
      return true;
    }
    
    console.log('Running on native platform, checking camera permissions...');

    // Check current permission status using Camera
    const permissions = await Camera.checkPermissions();
    
    if (permissions.camera === 'granted') {
      return true;
    }

    if (permissions.camera === 'denied') {
      // If permission was previously denied, show alert
      showToast('Camera permission is required for scanning. Please enable camera access in Settings.', 'warning');
      return false;
    }

    // Request permission if not determined
    const result = await Camera.requestPermissions({ permissions: ['camera'] });
    return result.camera === 'granted';
  } catch (error) {
    console.error('Error handling camera permission:', error);
    return false;
  }
}

export async function requestPermissionAgain() {
  try {
    console.log('🔄 Requesting camera permission again...');
    
    // Check platform using our utility function
    const platformInfo = await isRunningInNativeApp();
    
    // Check if we're on a native platform
    if (!platformInfo.isNative) {
      console.log('❌ Camera permissions not needed - running on web platform');
      return true;
    }
    
    console.log('✅ Running on native platform, requesting camera permission...');

    // Force permission request - this will show system dialog
    const result = await Camera.requestPermissions({ permissions: ['camera'] });
    
    if (result.camera === 'granted') {
      console.log('Camera permission granted');
      showToast('Camera permission granted!', 'success');
      return true;
    } else {
      console.log('Camera permission denied');
      showToast('Camera permission denied', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    showToast('Error requesting camera permission', 'error');
    return false;
  }
}

export async function startCamera() {
  try {
    console.log('📷 Preparing camera...');
    
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Camera not available on web platform');
      showToast('Camera not available on web', 'error');
      return false;
    }

    const permissions = await Camera.checkPermissions();
    
    if (permissions.camera !== 'granted') {
      console.log('❌ Camera permission not granted');
      return false;
    }

    console.log('✅ Camera permission verified, ready to use');
    showToast('Camera ready', 'success');
    return true;

  } catch (error) {
    console.error('Error preparing camera:', error);
    showToast('Error preparing camera: ' + error.message, 'error');
    return false;
  }
}

// Simple toast notification function
export function showToast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#007bff'};
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 10000;
    font-size: 14px;
    max-width: 300px;
    text-align: center;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}