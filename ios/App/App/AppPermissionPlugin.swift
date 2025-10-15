import Foundation
import Capacitor
import UserNotifications
import Photos
import AVFoundation

@objc(AppPermissions)
public class AppPermissions: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol Requirements
    public let identifier = "AppPermissions"
    public let jsName = "AppPermissions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkCameraPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPhotoPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCameraPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPhotoPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasCompletedOnboarding", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "markOnboardingComplete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isFirstLaunch", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Constants
    private let ONBOARDING_COMPLETE_KEY = "photo_share_onboarding_complete"
    private let FIRST_LAUNCH_KEY = "has_launched_before"
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        print("🎯 AppPermissions plugin loaded successfully!")
    }
    
    // MARK: - Check Permission Methods
    
    @objc func checkNotificationPermission(_ call: CAPPluginCall) {
        print("🔔 AppPermissions: Checking notification permission status...")
        
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let status: String
                switch settings.authorizationStatus {
                case .authorized:
                    status = "granted"
                case .denied:
                    status = "denied"
                case .notDetermined:
                    status = "prompt"
                case .provisional:
                    status = "granted"
                case .ephemeral:
                    status = "granted"
                @unknown default:
                    status = "prompt"
                }
                
                print("🔔 AppPermissions: Notification permission status: \(status)")
                call.resolve(["status": status])
            }
        }
    }
    
    @objc func checkCameraPermission(_ call: CAPPluginCall) {
        print("📷 AppPermissions: Checking camera permission status...")
        
        let status: String
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            status = "granted"
        case .denied, .restricted:
            status = "denied"
        case .notDetermined:
            status = "prompt"
        @unknown default:
            status = "prompt"
        }
        
        print("📷 AppPermissions: Camera permission status: \(status)")
        call.resolve(["status": status])
    }
    
    @objc func checkPhotoPermission(_ call: CAPPluginCall) {
        print("🖼️ AppPermissions: Checking photo permission status...")
        
        let status: String
        if #available(iOS 14, *) {
            switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
            case .authorized, .limited:
                status = "granted"
            case .denied, .restricted:
                status = "denied"
            case .notDetermined:
                status = "prompt"
            @unknown default:
                status = "prompt"
            }
        } else {
            switch PHPhotoLibrary.authorizationStatus() {
            case .authorized:
                status = "granted"
            case .denied, .restricted:
                status = "denied"
            case .notDetermined:
                status = "prompt"
            @unknown default:
                status = "prompt"
            }
        }
        
        print("🖼️ AppPermissions: Photo permission status: \(status)")
        call.resolve(["status": status])
    }
    
    // MARK: - Onboarding Methods
    
    @objc func isFirstLaunch(_ call: CAPPluginCall) {
        print("📱 AppPermissions: Checking if first launch...")
        
        // Check UserDefaults for first launch flag
        let hasLaunchedBefore = UserDefaults.standard.bool(forKey: FIRST_LAUNCH_KEY)
        let isFirstLaunch = !hasLaunchedBefore
        
        print("📱 AppPermissions: Is first launch? \(isFirstLaunch)")
        
        call.resolve([
            "isFirstLaunch": isFirstLaunch
        ])
    }
    
    @objc func hasCompletedOnboarding(_ call: CAPPluginCall) {
        print("📱 AppPermissions: Checking if onboarding completed...")
        
        let completed = UserDefaults.standard.bool(forKey: ONBOARDING_COMPLETE_KEY)
        
        print("📱 AppPermissions: Onboarding completed? \(completed)")
        
        call.resolve([
            "completed": completed
        ])
    }
    
    @objc func markOnboardingComplete(_ call: CAPPluginCall) {
        print("✅ AppPermissions: Marking onboarding as complete...")
        
        // Save to UserDefaults using web team's keys
        UserDefaults.standard.set(true, forKey: ONBOARDING_COMPLETE_KEY)
        UserDefaults.standard.set(true, forKey: FIRST_LAUNCH_KEY)
        UserDefaults.standard.synchronize()
        
        print("✅ AppPermissions: Onboarding marked complete and saved")
        
        call.resolve()
    }
    
    // MARK: - Request Permission Methods
    
    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        print("🔔 AppPermissions: Requesting notification permission...")
        
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ AppPermissions: Notification permission error: \(error.localizedDescription)")
                    call.resolve([
                        "granted": false,
                        "error": error.localizedDescription
                    ])
                } else {
                    print("✅ AppPermissions: Notification permission granted: \(granted)")
                    
                    // Register for remote notifications if granted
                    if granted {
                        UIApplication.shared.registerForRemoteNotifications()
                        
                        // Notify FCM plugin that permissions are now granted
                        print("🔔 AppPermissions: Triggering FCM token initialization after permission grant...")
                        self.triggerFCMTokenInitialization()
                    }
                    
                    call.resolve([
                        "granted": granted,
                        "error": granted ? NSNull() : "Notification permission denied"
                    ])
                }
            }
        }
    }
    
    // MARK: - Helper method to trigger FCM token initialization
    private func triggerFCMTokenInitialization() {
        // Post notification that FCM can now initialize
        NotificationCenter.default.post(name: .notificationPermissionGranted, object: nil)
        
        // Also trigger via JavaScript bridge to web team's FCM handler
        guard let webView = bridge?.webView else {
            print("❌ AppPermissions: WebView not available for FCM trigger")
            return
        }
        
        let fcmTriggerJS = """
        (function() {
            try {
                console.log('🔔 [AppPermissions] Notification permission granted - triggering FCM initialization...');
                
                // Trigger FCM plugin if available
                if (window.Capacitor?.Plugins?.FCMTokenPlugin) {
                    console.log('🔔 [AppPermissions] Calling FCMTokenPlugin.initializeFCM()...');
                    window.Capacitor.Plugins.FCMTokenPlugin.initializeFCM()
                        .then(result => {
                            console.log('✅ [AppPermissions] FCM initialization result:', result);
                        })
                        .catch(error => {
                            console.error('❌ [AppPermissions] FCM initialization error:', error);
                        });
                }
                
                return 'FCM_TRIGGER_SENT';
            } catch (error) {
                console.error('❌ [AppPermissions] Error triggering FCM:', error);
                return 'FCM_TRIGGER_ERROR';
            }
        })();
        """
        
        webView.evaluateJavaScript(fcmTriggerJS) { result, error in
            if let error = error {
                print("❌ AppPermissions: Error triggering FCM via JavaScript: \(error.localizedDescription)")
            } else {
                print("✅ AppPermissions: FCM trigger sent via JavaScript: \(String(describing: result))")
            }
        }
    }
    
    @objc func requestCameraPermission(_ call: CAPPluginCall) {
        print("📷 AppPermissions: Requesting camera permission...")
        
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch status {
        case .authorized:
            print("✅ AppPermissions: Camera already authorized")
            call.resolve([
                "granted": true,
                "error": NSNull()
            ])
            
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    print("📷 AppPermissions: Camera permission result: \(granted)")
                    call.resolve([
                        "granted": granted,
                        "error": granted ? NSNull() : "Camera permission denied"
                    ])
                }
            }
            
        case .denied, .restricted:
            print("❌ AppPermissions: Camera access denied or restricted")
            call.resolve([
                "granted": false,
                "error": status == .denied ? "Camera access denied" : "Camera access restricted"
            ])
            
        @unknown default:
            call.resolve([
                "granted": false,
                "error": "Unknown camera permission status"
            ])
        }
    }
    
    @objc func requestPhotoPermission(_ call: CAPPluginCall) {
        print("🖼️ AppPermissions: Requesting photo library permission...")
        
        if #available(iOS 14, *) {
            let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            
            switch status {
            case .authorized, .limited:
                print("✅ AppPermissions: Photos already authorized")
                call.resolve([
                    "granted": true,
                    "error": NSNull()
                ])
                
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                    DispatchQueue.main.async {
                        let granted = (newStatus == .authorized || newStatus == .limited)
                        print("🖼️ AppPermissions: Photo permission result: \(granted)")
                        
                        call.resolve([
                            "granted": granted,
                            "error": granted ? NSNull() : "Photo library permission denied"
                        ])
                    }
                }
                
            case .denied, .restricted:
                print("❌ AppPermissions: Photo access denied or restricted")
                call.resolve([
                    "granted": false,
                    "error": status == .denied ? "Photo library access denied" : "Photo library access restricted"
                ])
                
            @unknown default:
                call.resolve([
                    "granted": false,
                    "error": "Unknown photo permission status"
                ])
            }
        } else {
            // iOS 13 and below
            let status = PHPhotoLibrary.authorizationStatus()
            
            switch status {
            case .authorized:
                print("✅ AppPermissions: Photos already authorized (iOS 13)")
                call.resolve([
                    "granted": true,
                    "error": NSNull()
                ])
                
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization { newStatus in
                    DispatchQueue.main.async {
                        let granted = (newStatus == .authorized)
                        print("🖼️ AppPermissions: Photo permission result (iOS 13): \(granted)")
                        
                        call.resolve([
                            "granted": granted,
                            "error": granted ? NSNull() : "Photo library permission denied"
                        ])
                    }
                }
                
            default:
                print("❌ AppPermissions: Photo access denied or restricted (iOS 13)")
                call.resolve([
                    "granted": false,
                    "error": "Photo library access denied or restricted"
                ])
            }
        }
    }
}

// MARK: - Notification Name Extension
extension Notification.Name {
    static let notificationPermissionGranted = Notification.Name("notificationPermissionGranted")
}