/**
 * Firebase Cloud Messaging Service Worker
 * Required for web push notifications and background message handling
 */

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase with the same config as in AuthContext
firebase.initializeApp({
  apiKey: "AIzaSyD3s00zRVVv00R5cprrGCXLuHIQwpL_uuw",
  authDomain: "photoshare-a70ea.firebaseapp.com",
  projectId: "photoshare-a70ea",
  storageBucket: "photoshare-a70ea.firebasestorage.app",
  messagingSenderId: "1064591086523",
  appId: "1:1064591086523:web:8e96ca0af1939935f2aa9e",
  measurementId: "G-5RPTCKYBMF"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'PhotoShare';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: payload.notification?.icon || '/appicon1024x1024.png',
    image: payload.notification?.image,
    badge: '/appicon1024x1024.png',
    data: payload.data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  // Handle deep links
  const deepLink = event.notification.data?.deepLink;
  if (deepLink) {
    event.waitUntil(
      clients.openWindow(deepLink)
    );
  }
});
