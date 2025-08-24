import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
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

    // Check current permission status using BarcodeScanner
    const status = await BarcodeScanner.checkPermission({ force: false });
    
    if (status.granted) {
      return true;
    }

    if (status.denied) {
      // If permission was previously denied, show alert and redirect to settings
      const shouldOpenSettings = confirm(
        'Camera permission is required for QR scanning. Please enable camera access in Settings.'
      );
      
      if (shouldOpenSettings) {
        // This will open the app settings on iOS/Android
        await BarcodeScanner.openAppSettings();
      }
      return false;
    }

    // Request permission if not determined
    const result = await BarcodeScanner.checkPermission({ force: true });
    return result.granted;
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
    const status = await BarcodeScanner.checkPermission({ force: true });
    
    if (status.granted) {
      console.log('Camera permission granted');
      return await startCamera();
    } else if (status.denied) {
      console.log('Camera permission denied');
      showToast('Camera permission denied. Please enable in Settings.', 'error');
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    showToast('Error requesting camera permission: ' + error.message, 'error');
    return false;
  }
}

export async function startCamera() {
  try {
    console.log('📷 Preparing barcode scanner...');
    
    // Check platform one more time
    const platformInfo = await isRunningInNativeApp();
    console.log('📱 Platform:', platformInfo.platform);
    
    // Check permission one more time before starting
    const status = await BarcodeScanner.checkPermission({ force: true });
    
    if (!status.granted) {
      console.log('❌ BarcodeScanner permission not granted');
      return false;
    }
    
    console.log('✅ BarcodeScanner permission verified, ready to scan');
    showToast('Barcode scanner ready', 'success');
    return true;
  } catch (error) {
    console.error('Error preparing barcode scanner:', error);
    showToast('Error preparing scanner: ' + error.message, 'error');
    return false;
  }
}

// ========================================
// CAMERA PLUGIN FUNCTIONS (for photos/videos)
// ========================================

export async function handleRegularCameraPermission() {
  try {
    // Check platform using our utility function
    const platformInfo = await isRunningInNativeApp();
    
    // Check if we're on a native platform
    if (!platformInfo.isNative) {
      console.log('Camera permissions not needed - running on web platform');
      return true;
    }
    
    console.log('Running on native platform, checking camera permissions...');

    // Check current permission status using Camera plugin
    const permissions = await Camera.checkPermissions();
    
    if (permissions.camera === 'granted') {
      return true;
    }

    if (permissions.camera === 'denied') {
      // If permission was previously denied, show alert
      const shouldOpenSettings = confirm(
        'Camera permission is required for taking photos. Please enable camera access in Settings.'
      );
      
      if (shouldOpenSettings) {
        // Request permissions (this may open settings on some platforms)
        await Camera.requestPermissions();
      }
      return false;
    }

    // Request permission if not determined
    const result = await Camera.requestPermissions();
    return result.camera === 'granted';
  } catch (error) {
    console.error('Error handling camera permission:', error);
    return false;
  }
}

export async function requestCameraPermissionAgain() {
  try {
    console.log('📸 Requesting camera permission again...');
    
    // Check platform using our utility function
    const platformInfo = await isRunningInNativeApp();
    
    // Check if we're on a native platform
    if (!platformInfo.isNative) {
      console.log('❌ Camera permissions not needed - running on web platform');
      return true;
    }
    
    console.log('✅ Running on native platform, checking current camera permission...');

    // First check current permission status
    const currentPermissions = await Camera.checkPermissions();
    console.log('Current camera permission status:', currentPermissions.camera);
    
    if (currentPermissions.camera === 'denied') {
      // iOS/Android won't show permission dialog again after denial
      // Must direct user to settings
      console.log('🚫 Camera permission previously denied - directing to settings');
      
      const shouldOpenSettings = confirm(
        'Camera access was previously denied. To use camera features, please:\n\n' +
        '1. Go to Settings\n' +
        '2. Find PhotoShare app\n' +
        '3. Enable Camera permission\n' +
        '4. Return to app\n\n' +
        'Open Settings now?'
      );
      
      if (shouldOpenSettings) {
        try {
          // This will open app settings on iOS/Android
          await Camera.requestPermissions();
          showToast('Please enable camera permission in Settings and return to app', 'info');
        } catch (settingsError) {
          console.error('Error opening settings:', settingsError);
          showToast('Please manually go to Settings > PhotoShare > Camera to enable permission', 'error');
        }
      }
      return false;
    }
    
    if (currentPermissions.camera === 'granted') {
      console.log('✅ Camera permission already granted');
      return await startCameraForPhotos();
    }
    
    // Permission is 'prompt' or 'prompt-with-rationale' - can show dialog
    console.log('📱 Showing native permission dialog...');
    const result = await Camera.requestPermissions();
    
    if (result.camera === 'granted') {
      console.log('✅ Camera permission granted');
      showToast('Camera permission granted!', 'success');
      return await startCameraForPhotos();
    } else {
      console.log('❌ Camera permission denied');
      showToast('Camera permission denied. Feature unavailable.', 'error');
      return false;
    }
    
  } catch (error) {
    console.error('Error requesting camera permission:', error);
    showToast('Error requesting camera permission: ' + error.message, 'error');
    return false;
  }
}

export async function startCameraForPhotos() {
  try {
    console.log('📸 Preparing camera for photos...');
    
    // Check platform one more time
    const platformInfo = await isRunningInNativeApp();
    console.log('📱 Platform:', platformInfo.platform);
    
    // Check permission one more time before starting
    const permissions = await Camera.checkPermissions();
    
    if (permissions.camera !== 'granted') {
      console.log('❌ Camera permission not granted');
      return false;
    }
    
    console.log('✅ Camera permission verified, ready for photos');
    showToast('Camera ready for photos', 'success');
    return true;
  } catch (error) {
    console.error('Error preparing camera for photos:', error);
    showToast('Error preparing camera: ' + error.message, 'error');
    return false;
  }
}

// ========================================
// PHOTO PICKER FUNCTIONS (select from gallery)
// ========================================

export async function pickSinglePhoto() {
  try {
    console.log('🖼️ Opening photo picker for single selection...');
    
    // Check platform and permissions first
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Photo picker not available on web platform');
      return null;
    }
    
    // Check photo library permissions
    const permissions = await Camera.checkPermissions();
    if (permissions.photos !== 'granted') {
      console.log('❌ Photo library permission not granted');
      showToast('Photo library access required', 'error');
      
      // Try to request permission
      const result = await Camera.requestPermissions();
      if (result.photos !== 'granted') {
        return null;
      }
    }
    
    // Pick single photo from gallery
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      presentationStyle: 'popover'
    });
    
    console.log('✅ Single photo selected:', {
      webPath: image.webPath,
      filePath: image.path,
      format: image.format
    });
    showToast('Photo selected successfully', 'success');
    
    return {
      // For displaying thumbnails in your remote website
      webPath: image.webPath,        // e.g. "capacitor://localhost/_capacitor_file_/var/mobile/..."
      
      // For uploading to CDN (native file path)
      filePath: image.path,          // e.g. "file:///var/mobile/Containers/Data/..."
      
      // Image format and metadata
      format: image.format,          // e.g. "jpeg", "png"
      
      // Additional useful data for uploads
      exif: image.exif || null,      // EXIF data if available
      saved: image.saved || false    // Whether image was saved to gallery
    };
    
  } catch (error) {
    console.error('Error picking single photo:', error);
    if (error.message && error.message.includes('cancelled')) {
      showToast('Photo selection cancelled', 'info');
    } else {
      showToast('Error selecting photo: ' + error.message, 'error');
    }
    return null;
  }
}

export async function pickMultiplePhotos() {
  try {
    console.log('🖼️ Opening photo picker for multiple selection...');
    
    // Check platform and permissions first
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Photo picker not available on web platform');
      return [];
    }
    
    // Check photo library permissions
    const permissions = await Camera.checkPermissions();
    if (permissions.photos !== 'granted') {
      console.log('❌ Photo library permission not granted');
      showToast('Photo library access required', 'error');
      
      // Try to request permission
      const result = await Camera.requestPermissions();
      if (result.photos !== 'granted') {
        return [];
      }
    }
    
    // Use pickImages for multiple selection (iOS 14+, Android API 19+)
    const images = await Camera.pickImages({
      quality: 90,
      limit: 10  // Maximum 10 photos
    });
    
    console.log(`✅ ${images.photos.length} photos selected`);
    showToast(`${images.photos.length} photos selected`, 'success');
    
    // Return formatted photo data
    return images.photos.map(photo => ({
      // For displaying thumbnails in your remote website
      webPath: photo.webPath,        // e.g. "capacitor://localhost/_capacitor_file_/var/mobile/..."
      
      // For uploading to CDN (native file path)
      filePath: photo.path,          // e.g. "file:///var/mobile/Containers/Data/..."
      
      // Image format and metadata
      format: photo.format,          // e.g. "jpeg", "png"
      
      // Additional useful data for uploads
      exif: photo.exif || null,      // EXIF data if available
      saved: photo.saved || false    // Whether image was saved to gallery
    }));
    
  } catch (error) {
    console.error('Error picking multiple photos:', error);
    if (error.message && error.message.includes('cancelled')) {
      showToast('Photo selection cancelled', 'info');
    } else {
      showToast('Error selecting photos: ' + error.message, 'error');
    }
    return [];
  }
}

export async function requestPhotoLibraryPermission() {
  try {
    console.log('📚 Requesting photo library permission...');
    
    // Check platform first
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Photo library permissions not needed on web platform');
      return true;
    }
    
    // Check current permission status
    const currentPermissions = await Camera.checkPermissions();
    console.log('Current photo library permission status:', currentPermissions.photos);
    
    if (currentPermissions.photos === 'denied') {
      // iOS/Android won't show permission dialog again after denial
      console.log('🚫 Photo library permission previously denied - directing to settings');
      
      const shouldOpenSettings = confirm(
        'Photo library access was previously denied. To select photos, please:\n\n' +
        '1. Go to Settings\n' +
        '2. Find PhotoShare app\n' +
        '3. Enable Photos permission\n' +
        '4. Return to app\n\n' +
        'Open Settings now?'
      );
      
      if (shouldOpenSettings) {
        try {
          await Camera.requestPermissions();
          showToast('Please enable photo library permission in Settings and return to app', 'info');
        } catch (settingsError) {
          console.error('Error opening settings:', settingsError);
          showToast('Please manually go to Settings > PhotoShare > Photos to enable permission', 'error');
        }
      }
      return false;
    }
    
    if (currentPermissions.photos === 'granted') {
      console.log('✅ Photo library permission already granted');
      return true;
    }
    
    // Request permission
    console.log('📱 Showing native photo library permission dialog...');
    const result = await Camera.requestPermissions();
    
    if (result.photos === 'granted') {
      console.log('✅ Photo library permission granted');
      showToast('Photo library access granted!', 'success');
      return true;
    } else {
      console.log('❌ Photo library permission denied');
      showToast('Photo library permission denied. Feature unavailable.', 'error');
      return false;
    }
    
  } catch (error) {
    console.error('Error requesting photo library permission:', error);
    showToast('Error requesting photo library permission: ' + error.message, 'error');
    return false;
  }
}

// ========================================
// HELPER FUNCTIONS FOR CDN UPLOADS
// ========================================

export async function getImageDataForUpload(photo) {
  try {
    console.log('🔄 Converting image for CDN upload...');
    
    // Check platform
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Image conversion not available on web platform');
      return null;
    }
    
    // Get image as base64 data for uploading
    const imageData = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,  // Base64 data
      source: CameraSource.Photos,
      presentationStyle: 'popover'
    });
    
    console.log('✅ Image converted to base64 for upload');
    
    return {
      // Base64 data for CDN upload (ready to send)
      dataUrl: imageData.dataUrl,       // e.g. "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
      base64String: imageData.dataUrl.split(',')[1], // Just the base64 part without data:image/jpeg;base64,
      
      // File info
      format: imageData.format,
      
      // Original paths for reference
      webPath: photo.webPath,
      filePath: photo.filePath
    };
    
  } catch (error) {
    console.error('Error converting image for upload:', error);
    showToast('Error preparing image for upload: ' + error.message, 'error');
    return null;
  }
}

export async function convertMultipleImagesForUpload(photos) {
  try {
    console.log(`🔄 Converting ${photos.length} images for CDN upload...`);
    
    const uploadData = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      console.log(`Converting image ${i + 1}/${photos.length}...`);
      
      // For multiple images, we'll use the file path to read each one
      // This is more efficient than re-selecting each image
      try {
        // Read the image file and convert to base64
        const response = await fetch(photo.filePath);
        const blob = await response.blob();
        
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        
        uploadData.push({
          // Base64 data for CDN upload
          dataUrl: base64,
          base64String: base64.split(',')[1],
          
          // File info
          format: photo.format,
          
          // Original paths for reference
          webPath: photo.webPath,
          filePath: photo.filePath,
          index: i
        });
        
      } catch (fileError) {
        console.error(`Error converting image ${i + 1}:`, fileError);
        // Continue with other images
      }
    }
    
    console.log(`✅ ${uploadData.length}/${photos.length} images converted for upload`);
    showToast(`${uploadData.length} images ready for upload`, 'success');
    
    return uploadData;
    
  } catch (error) {
    console.error('Error converting multiple images for upload:', error);
    showToast('Error preparing images for upload: ' + error.message, 'error');
    return [];
  }
}

// ========================================
// APPLE AUTHENTICATION WITH NONCE (Firebase)
// ========================================

export function generateRandomNonce(length = 32) {
  // Characters to use for nonce generation
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  
  // Generate cryptographically secure random values
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  
  // Convert random bytes to character set
  randomValues.forEach((value) => {
    result += charset[value % charset.length];
  });
  
  console.log('✅ Generated random nonce:', result.substring(0, 8) + '...');
  return result;
}

export async function sha256(input) {
  try {
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    // Generate SHA256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert ArrayBuffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('✅ Generated SHA256 hash:', hashHex.substring(0, 16) + '...');
    return hashHex;
  } catch (error) {
    console.error('Error generating SHA256 hash:', error);
    throw error;
  }
}

export async function initiateAppleSignInWithNonce() {
  try {
    console.log('🍎 Starting Apple Sign In with nonce...');
    
    // Check platform
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      console.log('❌ Apple Sign In only available on native platforms');
      showToast('Apple Sign In only available on native platforms', 'error');
      return null;
    }
    
    // Step 1: Generate cryptographically secure random nonce
    const rawNonce = generateRandomNonce();
    
    // Step 2: Hash the nonce using SHA256
    const hashedNonce = await sha256(rawNonce);
    
    // Step 3: Prepare the authentication data
    const appleAuthData = {
      // Raw nonce to verify response (keep this for Firebase)
      rawNonce: rawNonce,
      
      // Hashed nonce to send with Apple request (security requirement)
      hashedNonce: hashedNonce,
      
      // Request configuration
      requestedScopes: ['email', 'name'],
      
      // Timestamp for tracking
      timestamp: Date.now()
    };
    
    console.log('🔐 Apple authentication data prepared:', {
      rawNonceLength: rawNonce.length,
      hashedNonceLength: hashedNonce.length,
      timestamp: appleAuthData.timestamp
    });
    
    showToast('Apple authentication prepared - ready for sign in', 'success');
    
    // Return the prepared data for use with Apple Sign In
    return appleAuthData;
    
  } catch (error) {
    console.error('Error preparing Apple Sign In:', error);
    showToast('Error preparing Apple authentication: ' + error.message, 'error');
    return null;
  }
}

export async function processAppleAuthResponse(appleAuthData, appleResponse) {
  try {
    console.log('🔄 Processing Apple authentication response...');
    
    if (!appleAuthData || !appleResponse) {
      throw new Error('Missing authentication data or response');
    }
    
    // Verify the nonce in the response matches what we sent
    if (appleResponse.nonce && appleResponse.nonce !== appleAuthData.hashedNonce) {
      throw new Error('Nonce verification failed - possible replay attack');
    }
    
    // Prepare Firebase authentication credential data
    const firebaseAuthData = {
      // Apple ID token for Firebase
      idToken: appleResponse.identityToken,
      
      // Original raw nonce for Firebase verification
      rawNonce: appleAuthData.rawNonce,
      
      // User information (if available)
      email: appleResponse.email,
      name: appleResponse.fullName,
      
      // Apple authorization code
      authorizationCode: appleResponse.authorizationCode,
      
      // Processing timestamp
      processedAt: Date.now()
    };
    
    console.log('✅ Apple auth response processed for Firebase:', {
      hasIdToken: !!firebaseAuthData.idToken,
      hasRawNonce: !!firebaseAuthData.rawNonce,
      hasEmail: !!firebaseAuthData.email,
      processedAt: firebaseAuthData.processedAt
    });
    
    showToast('Apple authentication successful!', 'success');
    
    return firebaseAuthData;
    
  } catch (error) {
    console.error('Error processing Apple auth response:', error);
    showToast('Error processing Apple authentication: ' + error.message, 'error');
    return null;
  }
}

// Complete Apple Sign In using @capacitor-community/apple-sign-in
export async function signInWithApple() {
  try {
    console.log('🚀 Starting Apple Sign In with @capacitor-community/apple-sign-in...');
    
    // Check platform
    const platformInfo = await isRunningInNativeApp();
    if (!platformInfo.isNative) {
      showToast('Apple Sign In only available on native platforms', 'error');
      return null;
    }
    
    // Step 1: Prepare nonce and auth data
    const appleAuthData = await initiateAppleSignInWithNonce();
    if (!appleAuthData) {
      throw new Error('Failed to prepare Apple authentication');
    }
    
    // Step 2: Import and use the Apple Sign In plugin
    // Note: This requires the plugin to be properly imported in your remote website
    console.log('📱 Calling Apple Sign In with nonce:', appleAuthData.hashedNonce.substring(0, 16) + '...');
    
    // For now, we'll show the configuration needed for your remote website
    const appleSignInConfig = {
      // Required configuration for @capacitor-community/apple-sign-in
      clientId: 'com.photoshare.photo-share', // Your app's bundle ID
      redirectURI: 'https://photo-share.app/auth/callback',
      scopes: 'email name',
      state: appleAuthData.hashedNonce,  // Use hashed nonce as state
      nonce: appleAuthData.hashedNonce   // Pass hashed nonce for security
    };
    
    console.log('🔐 Apple Sign In configuration prepared:', {
      clientId: appleSignInConfig.clientId,
      hasNonce: !!appleSignInConfig.nonce,
      nonceLength: appleSignInConfig.nonce.length,
      scopes: appleSignInConfig.scopes
    });
    
    showToast('Apple Sign In ready - use with @capacitor-community/apple-sign-in', 'success');
    
    // Return both the auth data and the configuration
    return {
      appleAuthData: appleAuthData,
      appleSignInConfig: appleSignInConfig,
      
      // Instructions for remote website implementation
      implementation: {
        step1: 'Import: import { SignInWithApple } from "@capacitor-community/apple-sign-in";',
        step2: 'Call: const result = await SignInWithApple.authorize(appleSignInConfig);',
        step3: 'Process: const firebaseData = await processAppleAuthResponse(appleAuthData, result);',
        step4: 'Use firebaseData for Firebase authentication (manual credential creation)'
      }
    };
    
  } catch (error) {
    console.error('Error in Apple Sign In flow:', error);
    showToast('Apple Sign In failed: ' + error.message, 'error');
    return null;
  }
}

// Helper function to demonstrate the complete integration
export async function demonstrateAppleSignInIntegration() {
  try {
    console.log('📖 Demonstrating Apple Sign In integration...');
    
    const signInData = await signInWithApple();
    if (!signInData) {
      return null;
    }
    
    console.log('🔧 Integration Code Example:');
    console.log(`
// 1. In your remote website, import the plugin:
import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { signInWithApple, processAppleAuthResponse } from './cameraPermissions.js';

// 2. Button click handler:
async function handleAppleSignIn() {
  try {
    // Get prepared auth data
    const signInData = await signInWithApple();
    
    // Call Apple Sign In with the configuration
    const appleResponse = await SignInWithApple.authorize(signInData.appleSignInConfig);
    
    // Process response for Firebase
    const firebaseAuthData = await processAppleAuthResponse(
      signInData.appleAuthData, 
      appleResponse
    );
    
    // Use firebaseAuthData with Firebase manually (since we removed apple.com from Firebase auth)
    // You'll need to create a custom token or use Firebase Admin SDK
    console.log('Firebase auth data ready:', firebaseAuthData);
    
  } catch (error) {
    console.error('Apple Sign In error:', error);
  }
}
`);
    
    showToast('Check console for integration code example', 'info');
    
    return signInData;
    
  } catch (error) {
    console.error('Error demonstrating Apple Sign In integration:', error);
    return null;
  }
}

export function showToast(message, type = 'info') {
  // Simple toast implementation
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add toast styles
  toast.style.cssText = `
    position: fixed;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}