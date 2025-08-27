import Foundation
import Capacitor
import UserNotifications
import Photos
import AVFoundation

@objc(AppPermissionPlugin)
public class AppPermissionPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol Requirements
    public let identifier = "AppPermissionPlugin"
    public let jsName = "AppPermissionPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isFirstLaunch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestCameraPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPhotoPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "markOnboardingComplete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isOnboardingComplete", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Constants
    private let ONBOARDING_COMPLETE_KEY = "PhotoShare_OnboardingComplete"
    private let FIRST_LAUNCH_KEY = "PhotoShare_FirstLaunchComplete"
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        print("🎯 AppPermissionPlugin loaded successfully!")
    }
    
    // MARK: - First Launch Check
    @objc func isFirstLaunch(_ call: CAPPluginCall) {
        print("📱 AppPermissionPlugin: Checking if first launch...")
        
        // Check UserDefaults for first launch flag
        let hasLaunchedBefore = UserDefaults.standard.bool(forKey: FIRST_LAUNCH_KEY)
        let isFirstLaunch = !hasLaunchedBefore
        
        print("📱 AppPermissionPlugin: Is first launch? \(isFirstLaunch)")
        
        // Return boolean directly as the web expects
        call.resolve([
            "value": isFirstLaunch
        ])
    }
    
    // MARK: - Notification Permission
    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        print("🔔 AppPermissionPlugin: Requesting notification permission...")
        
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ AppPermissionPlugin: Notification permission error: \(error.localizedDescription)")
                    call.resolve([
                        "granted": false,
                        "error": error.localizedDescription
                    ])
                } else {
                    print("✅ AppPermissionPlugin: Notification permission granted: \(granted)")
                    
                    // Register for remote notifications if granted
                    if granted {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                    
                    call.resolve([
                        "granted": granted
                    ])
                }
            }
        }
    }
    
    // MARK: - Camera Permission
    @objc func requestCameraPermission(_ call: CAPPluginCall) {
        print("📷 AppPermissionPlugin: Requesting camera permission...")
        
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch status {
        case .authorized:
            print("✅ AppPermissionPlugin: Camera already authorized")
            call.resolve([
                "granted": true
            ])
            
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    print("📷 AppPermissionPlugin: Camera permission result: \(granted)")
                    if granted {
                        call.resolve([
                            "granted": true
                        ])
                    } else {
                        call.resolve([
                            "granted": false,
                            "error": "User denied camera access"
                        ])
                    }
                }
            }
            
        case .denied, .restricted:
            print("❌ AppPermissionPlugin: Camera access denied or restricted")
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
    
    // MARK: - Photo Library Permission
    @objc func requestPhotoPermission(_ call: CAPPluginCall) {
        print("🖼️ AppPermissionPlugin: Requesting photo library permission...")
        
        if #available(iOS 14, *) {
            let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            
            switch status {
            case .authorized, .limited:
                print("✅ AppPermissionPlugin: Photos already authorized")
                call.resolve([
                    "granted": true
                ])
                
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
                    DispatchQueue.main.async {
                        let granted = (newStatus == .authorized || newStatus == .limited)
                        print("🖼️ AppPermissionPlugin: Photo permission result: \(granted)")
                        
                        if granted {
                            call.resolve([
                                "granted": true
                            ])
                        } else {
                            call.resolve([
                                "granted": false,
                                "error": "User denied photo library access"
                            ])
                        }
                    }
                }
                
            case .denied, .restricted:
                print("❌ AppPermissionPlugin: Photo access denied or restricted")
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
                print("✅ AppPermissionPlugin: Photos already authorized (iOS 13)")
                call.resolve([
                    "granted": true
                ])
                
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization { newStatus in
                    DispatchQueue.main.async {
                        let granted = (newStatus == .authorized)
                        print("🖼️ AppPermissionPlugin: Photo permission result (iOS 13): \(granted)")
                        
                        if granted {
                            call.resolve([
                                "granted": true
                            ])
                        } else {
                            call.resolve([
                                "granted": false,
                                "error": "User denied photo library access"
                            ])
                        }
                    }
                }
                
            default:
                print("❌ AppPermissionPlugin: Photo access denied or restricted (iOS 13)")
                call.resolve([
                    "granted": false,
                    "error": "Photo library access denied or restricted"
                ])
            }
        }
    }
    
    // MARK: - Mark Onboarding Complete
    @objc func markOnboardingComplete(_ call: CAPPluginCall) {
        print("✅ AppPermissionPlugin: Marking onboarding as complete...")
        
        // Save to UserDefaults
        UserDefaults.standard.set(true, forKey: ONBOARDING_COMPLETE_KEY)
        UserDefaults.standard.set(true, forKey: FIRST_LAUNCH_KEY)
        UserDefaults.standard.synchronize()
        
        print("✅ AppPermissionPlugin: Onboarding marked complete and saved")
        
        // No return value needed
        call.resolve()
    }
    
    // MARK: - Helper method to check onboarding status
    @objc func isOnboardingComplete(_ call: CAPPluginCall) {
        let isComplete = UserDefaults.standard.bool(forKey: ONBOARDING_COMPLETE_KEY)
        print("📱 AppPermissionPlugin: Is onboarding complete? \(isComplete)")
        
        call.resolve([
            "value": isComplete
        ])
    }
}