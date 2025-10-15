import Foundation
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@objc(FCMTokenPlugin)
public class FCMTokenPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol Requirements
    public let identifier = "FCMTokenPlugin"
    public let jsName = "FCMTokenPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initializeFCM", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFCMToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerFCMTokenWithAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStoredToken", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Constants
    private let FCM_TOKEN_KEY = "capacitor_push_token"
    private let FCM_TOKEN_TIMESTAMP_KEY = "capacitor_push_token_timestamp"
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        print("🔔 [FCM TOKEN] FCMTokenPlugin loaded successfully!")
        
        // Set up Firebase Messaging delegate only (no permission requests)
        setupFirebaseMessaging()
        
        // Listen for FCM token notifications from AppDelegate
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleFCMTokenNotification(_:)),
            name: Notification.Name("FCMTokenReceived"),
            object: nil
        )
    }
    
    @objc private func handleFCMTokenNotification(_ notification: Notification) {
        if let token = notification.userInfo?["token"] as? String {
            print("🔔 [FCM TOKEN] Received FCM token via notification: \(token.prefix(20))...")
            storeToken(token)
        }
    }
    
    // MARK: - Firebase Messaging Setup
    private func setupFirebaseMessaging() {
        print("🔔 [FCM TOKEN] Setting up Firebase Messaging...")
        
        // Set Firebase Messaging delegate
        Messaging.messaging().delegate = self
        
        // DO NOT request permissions here - let AppPermissions handle it during onboarding
        print("🔔 [FCM TOKEN] Firebase Messaging delegate set, waiting for permission grant from AppPermissions")
        
        // Check if we already have an FCM token
        Messaging.messaging().token { token, error in
            if let error = error {
                print("❌ [FCM TOKEN] Error checking initial token: \(error.localizedDescription)")
            } else if let token = token {
                print("🔔 [FCM TOKEN] Existing FCM token found on setup: \(token.prefix(20))...")
                self.storeToken(token)
            } else {
                print("🔔 [FCM TOKEN] No FCM token available yet")
            }
        }
    }
    
    // MARK: - Initialize FCM (matches Android initializeFCM alias)
    @objc func initializeFCM(_ call: CAPPluginCall) {
        print("🔔 [FCM TOKEN] initializeFCM called - triggering FCM token registration...")
        
        // This mirrors Android's initializeFCM which is an alias for registerFCMTokenWithAuthCheck
        registerFCMTokenWithAuth(call)
    }
    
    // MARK: - Get FCM Token
    @objc func getFCMToken(_ call: CAPPluginCall) {
        print("🔔 [FCM TOKEN] Getting FCM token...")
        
        // First check if notification permissions are granted
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                if settings.authorizationStatus == .authorized {
                    print("✅ [FCM TOKEN] Notification permissions already granted, getting token...")
                    
                    // Ensure we're registered for remote notifications
                    UIApplication.shared.registerForRemoteNotifications()
                    
                    Messaging.messaging().token { token, error in
                        DispatchQueue.main.async {
                            if let error = error {
                                print("❌ [FCM TOKEN] Error getting token: \(error.localizedDescription)")
                                call.reject("Failed to get FCM token", "FCM_TOKEN_ERROR", error)
                            } else if let token = token {
                                print("✅ [FCM TOKEN] FCM token retrieved: \(token.prefix(20))...")
                                print("🔔 [FCM TOKEN] Token length: \(token.count) characters")
                                
                                // Store token for future use
                                self.storeToken(token)
                                
                                call.resolve([
                                    "token": token,
                                    "length": token.count,
                                    "timestamp": Date().timeIntervalSince1970
                                ])
                            } else {
                                print("❌ [FCM TOKEN] No token received")
                                call.reject("No FCM token received", "NO_TOKEN")
                            }
                        }
                    }
                } else {
                    print("❌ [FCM TOKEN] Notification permissions not granted (status: \(settings.authorizationStatus.rawValue))")
                    call.reject("Notification permissions required", "PERMISSION_DENIED")
                }
            }
        }
    }
    
    // MARK: - Register FCM Token with Authentication Retry (Main Method)
    @objc func registerFCMTokenWithAuth(_ call: CAPPluginCall) {
        print("🔔 [FCM TOKEN] Starting FCM token registration - simplified for web integration...")
        
        // Check if notification permissions are granted
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                if settings.authorizationStatus == .authorized {
                    print("✅ [FCM TOKEN] Getting FCM token for web registration...")
                    
                    Messaging.messaging().token { token, error in
                        DispatchQueue.main.async {
                            if let error = error {
                                print("❌ [FCM TOKEN] Failed to get FCM token: \(error.localizedDescription)")
                                call.reject("Failed to get FCM token", "FCM_TOKEN_ERROR", error)
                                return
                            }
                            
                            guard let token = token else {
                                print("❌ [FCM TOKEN] No FCM token received")
                                call.reject("No FCM token received", "NO_TOKEN")
                                return
                            }
                            
                            print("✅ [FCM TOKEN] Got FCM token: \(token.prefix(20))... (length: \(token.count))")
                            
                            // Store token in both UserDefaults and localStorage
                            self.storeToken(token)
                            
                            // Let web handle authentication and retry - just resolve with token
                            print("🔔 [FCM TOKEN] Token stored, letting web handle authentication retry")
                            call.resolve([
                                "success": true,
                                "token": token,
                                "timestamp": Date().timeIntervalSince1970,
                                "message": "Token stored in localStorage for web authentication retry"
                            ])
                        }
                    }
                } else {
                    print("❌ [FCM TOKEN] Cannot get token - notification permissions not granted")
                    call.reject("Notification permissions required", "PERMISSION_DENIED")
                }
            }
        }
    }
    
    // MARK: - Removed Authentication Retry Logic
    // Web team handles authentication retry via onAuthStateChange listener
    // iOS plugin now focuses on token generation and localStorage storage
    
    // MARK: - Get Stored Token
    @objc func getStoredToken(_ call: CAPPluginCall) {
        let token = UserDefaults.standard.string(forKey: FCM_TOKEN_KEY)
        let timestamp = UserDefaults.standard.double(forKey: FCM_TOKEN_TIMESTAMP_KEY)
        
        if let token = token {
            print("📱 [FCM TOKEN] Retrieved stored token: \(token.prefix(20))... (stored: \(Date(timeIntervalSince1970: timestamp)))")
            call.resolve([
                "token": token,
                "timestamp": timestamp,
                "length": token.count
            ])
        } else {
            print("📱 [FCM TOKEN] No stored token found")
            call.resolve([
                "token": NSNull(),
                "timestamp": 0
            ])
        }
    }
    
    // MARK: - Helper Methods
    private func storeToken(_ token: String) {
        // Store in UserDefaults for iOS internal use
        UserDefaults.standard.set(token, forKey: FCM_TOKEN_KEY)
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: FCM_TOKEN_TIMESTAMP_KEY)
        UserDefaults.standard.synchronize()
        
        // CRITICAL: Also store in localStorage for web integration
        storeTokenInLocalStorage(token)
        
        print("💾 [FCM TOKEN] Token stored in UserDefaults: \(token.prefix(20))...")
    }
    
    private func storeTokenInLocalStorage(_ token: String) {
        guard let webView = bridge?.webView else {
            print("❌ [FCM TOKEN] WebView not available for localStorage storage")
            return
        }
        
        let storeJS = """
        (function() {
            try {
                // Store token in localStorage for web access
                localStorage.setItem('capacitor_push_token', '\(token)');
                console.log('✅ iOS: FCM token stored in localStorage:', '\(token.prefix(20))...');
                
                // Trigger web authentication retry if user is authenticated
                if (window.CapacitorPushNotifications?.triggerTokenRegistration) {
                    console.log('🔄 iOS: Triggering web authentication retry...');
                    window.CapacitorPushNotifications.triggerTokenRegistration();
                } else {
                    console.log('📝 iOS: Token stored, web will handle registration on auth state change');
                }
                
                return 'STORED_IN_LOCALSTORAGE';
            } catch (error) {
                console.error('❌ iOS: Failed to store token in localStorage:', error);
                return 'STORAGE_ERROR';
            }
        })();
        """
        
        webView.evaluateJavaScript(storeJS) { result, error in
            if let error = error {
                print("❌ [FCM TOKEN] Error storing token in localStorage: \(error.localizedDescription)")
            } else {
                print("✅ [FCM TOKEN] Token stored in localStorage and web retry triggered")
            }
        }
    }
}

// MARK: - MessagingDelegate
extension FCMTokenPlugin: MessagingDelegate {
    public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🔔 [FCM TOKEN] Firebase Messaging didReceiveRegistrationToken called")
        
        if let token = fcmToken {
            print("🔔 [FCM TOKEN] New FCM token received: \(token.prefix(20))... (length: \(token.count))")
            storeToken(token)
            
            // Notify JavaScript about new token
            notifyListeners("tokenReceived", data: [
                "token": token,
                "timestamp": Date().timeIntervalSince1970
            ])
        } else {
            print("❌ [FCM TOKEN] Received nil FCM token")
        }
    }
}