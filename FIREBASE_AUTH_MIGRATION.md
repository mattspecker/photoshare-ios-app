# Firebase Auth Migration Guide

## ✅ Native Setup Complete!
The Firebase Authentication plugins are now installed and configured in your iOS app:
- `@capacitor-firebase/app@7.3.0` 
- `@capacitor-firebase/authentication@7.3.0`

## 🔄 Update Your Website Code

You need to update your website at `https://photo-share.app` to use Firebase Auth instead of the old Google Auth plugin.

### Old Code (Remove This):
```javascript
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'

// Old initialization
GoogleAuth.initialize({
  clientId: '1064591086523-ru8pn28k9hkqv0uo6nr9njig1t378pjs.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  grantOfflineAccess: true,
})

// Old sign-in
const result = await GoogleAuth.signIn();
```

### New Code (Use This):
```javascript
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

// Initialize Firebase Auth (one time, on app startup)
async function initializeFirebaseAuth() {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.initialize();
  }
}

// Google Sign-In with Firebase
async function signInWithGoogle() {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native Firebase Auth
      const result = await FirebaseAuthentication.signInWithGoogle();
      return {
        user: result.user,
        credential: result.credential,
        additionalUserInfo: result.additionalUserInfo
      };
    } else {
      // Web Firebase Auth (your existing web implementation)
      return await webFirebaseGoogleSignIn();
    }
  } catch (error) {
    console.error('Google Sign-In failed:', error);
    throw error;
  }
}

// Sign out
async function signOut() {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut();
  } else {
    // Web sign out
    await webFirebaseSignOut();
  }
}

// Get current user
async function getCurrentUser() {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.getCurrentUser();
    return result.user;
  } else {
    // Web get current user
    return webFirebaseGetCurrentUser();
  }
}
```

## 📋 Complete Migration Steps:

### 1. Update Your Website Dependencies
In your website project:
```bash
npm install @capacitor-firebase/authentication
```

### 2. Initialize Firebase (One Time)
Add this to your app startup code:
```javascript
// In your main.tsx or app initialization
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

if (Capacitor.isNativePlatform()) {
  await FirebaseAuthentication.initialize();
}
```

### 3. Update Google Sign-In Button Handler
Replace your existing Google sign-in code:
```javascript
// Replace your existing Google login function
async function handleGoogleSignIn() {
  try {
    console.log('🚀 GOOGLE LOGIN: Starting Firebase Auth...');
    
    if (Capacitor.isNativePlatform()) {
      // Native Firebase Auth
      const result = await FirebaseAuthentication.signInWithGoogle();
      console.log('✅ GOOGLE LOGIN: Success', result);
      
      // Extract user data
      const user = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      };
      
      return user;
    } else {
      // Your existing web Firebase implementation
      return await yourExistingWebGoogleSignIn();
    }
  } catch (error) {
    console.error('❌ GOOGLE LOGIN: Firebase Auth error:', error);
    throw error;
  }
}
```

## 🔧 Firebase Auth API Reference

### Available Methods:
- `FirebaseAuthentication.initialize()` - Initialize Firebase
- `FirebaseAuthentication.signInWithGoogle()` - Google Sign-In
- `FirebaseAuthentication.getCurrentUser()` - Get current user
- `FirebaseAuthentication.signOut()` - Sign out
- `FirebaseAuthentication.getIdToken()` - Get ID token

### Response Format:
```javascript
{
  user: {
    uid: "user-id",
    email: "user@example.com", 
    displayName: "User Name",
    photoURL: "profile-photo-url",
    emailVerified: true
  },
  credential: {
    providerId: "google.com",
    accessToken: "access-token",
    idToken: "id-token"
  }
}
```

## 🧪 Testing Steps:

1. **Update your website code** with the new Firebase Auth methods
2. **Deploy your website** with the changes
3. **Build and test the iOS app**
4. **Check for these success indicators:**
   - No UNIMPLEMENTED errors
   - Native Google sign-in dialog appears
   - User data returns correctly
   - Apple Sign-In still works (unchanged)

## 🎯 Expected Results:
- ✅ Google Sign-In: Native Firebase Auth dialog
- ✅ Apple Sign-In: Native Apple ID dialog (unchanged)
- ✅ No UNIMPLEMENTED errors
- ✅ Both authentication methods work smoothly

The Firebase Auth plugin is much more reliable and compatible with Capacitor 7.x than the old plugin!