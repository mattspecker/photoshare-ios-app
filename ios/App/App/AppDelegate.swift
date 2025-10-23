import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import GoogleSignIn
import WebKit
import UserNotifications

// Explicitly import plugin classes (force compilation)
// These should be automatically available since they're in the same module
// but we'll reference them to ensure they compile

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Capture AppDelegate init start time
        PerformanceMonitorPlugin.APP_DELEGATE_INIT_START = ProcessInfo.processInfo.systemUptime
        print("📊 [PERF] APP_DELEGATE_INIT_START: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_START)")
        
        // Override point for customization after application launch.
        FirebaseApp.configure()
        
        // Configure Firebase Messaging for FCM tokens
        print("🔔 [FCM] Configuring Firebase Messaging...")
        
        // Configure notification center for rich notifications
        UNUserNotificationCenter.current().delegate = self
        print("✅ UNUserNotificationCenter delegate configured for rich notifications")
        
        // Configure messaging delegate (will be set by FCMTokenPlugin)
        print("🔔 [FCM] Firebase Messaging will be configured by FCMTokenPlugin")
        
        // Debug plugin registration
        print("🔍 AppDelegate: App launching with custom plugins")
        
        // Ensure custom plugin classes are loaded for packageClassList auto-registration
        print("🔧 Loading custom plugin classes for auto-registration...")
        _ = EventPhotoPicker.self
        _ = UploadManager.self
        _ = PhotoLibraryMonitor.self
        _ = QRScanner.self
        _ = AppPermissions.self
        _ = PhotoEditorPlugin.self
        _ = AutoUploadPlugin.self
        _ = UploadStatusOverlay.self
        _ = CustomCameraPlugin.self
        _ = NativeGalleryPlugin.self
        _ = BulkDownloadPlugin.self // TODO: Add to Xcode project
        _ = FCMTokenPlugin.self
        _ = PerformanceMonitorPlugin.self
        print("✅ Custom plugin classes loaded for packageClassList discovery")
        
        // Mark plugins registered
        PerformanceMonitorPlugin.PLUGINS_REGISTERED = ProcessInfo.processInfo.systemUptime
        print("📊 [PERF] PLUGINS_REGISTERED: \(PerformanceMonitorPlugin.PLUGINS_REGISTERED)")
        
        // Debug Firebase configuration
        if let defaultApp = FirebaseApp.app() {
            print("✅ Firebase app configured successfully")
            print("✅ Firebase options client ID: \(defaultApp.options.clientID ?? "nil")")
            print("✅ Firebase app name: \(defaultApp.name)")
        } else {
            print("❌ Firebase app not configured")
        }
        
        // Configure Google Sign-In
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") {
            print("✅ GoogleService-Info.plist found at path: \(path)")
            if let plist = NSDictionary(contentsOfFile: path) {
                print("✅ GoogleService-Info.plist loaded successfully")
                if let clientId = plist["CLIENT_ID"] as? String {
                    print("✅ CLIENT_ID found: \(clientId)")
                    GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientId)
                    print("✅ Google Sign-In configured successfully")
                } else {
                    print("❌ CLIENT_ID not found in GoogleService-Info.plist")
                    print("Plist contents: \(plist)")
                }
            } else {
                print("❌ Failed to load GoogleService-Info.plist")
            }
        } else {
            print("❌ GoogleService-Info.plist not found in bundle")
            print("Bundle path: \(Bundle.main.bundlePath)")
            if let resourcePath = Bundle.main.resourcePath {
                print("Resource path: \(resourcePath)")
            }
        }
        
        // Mark AppDelegate init end
        PerformanceMonitorPlugin.APP_DELEGATE_INIT_END = ProcessInfo.processInfo.systemUptime
        print("📊 [PERF] APP_DELEGATE_INIT_END: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_END)")
        
        // Log all timing values
        print("📊 [PERF] === TIMING SUMMARY ===")
        print("📊 [PERF] APP_START_TIME: \(PerformanceMonitorPlugin.APP_START_TIME)")
        print("📊 [PERF] APP_DELEGATE_INIT_START: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_START)")
        print("📊 [PERF] APP_DELEGATE_INIT_END: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_END)")
        print("📊 [PERF] PLUGINS_REGISTERED: \(PerformanceMonitorPlugin.PLUGINS_REGISTERED)")
        
        return true
    }
    
    
    // MARK: - JWT Token Management for Native Plugins
    private var currentJwtToken: String?
    private var jwtTokenExpiration: Date?
    private var jwtRefreshCompletion: ((String?) -> Void)?
    
    private func retrieveJwtTokenForNativePlugins(completion: @escaping (String?) -> Void = { _ in }) {
        print("🔐 ==================== JWT TOKEN RETRIEVAL START ====================")
        print("🔐 Starting JWT token retrieval...")
        print("🔐 Current time: \(Date())")
        
        // Store completion handler for when token is retrieved
        self.jwtRefreshCompletion = completion
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            print("❌ Could not find window scene")
            return
        }
        print("✅ Found window scene: \(windowScene)")
        
        guard let window = windowScene.windows.first else {
            print("❌ Could not find window")
            return
        }
        print("✅ Found window: \(window)")
        
        guard let bridgeVC = window.rootViewController as? CAPBridgeViewController else {
            print("❌ Root view controller is not CAPBridgeViewController: \(type(of: window.rootViewController))")
            return
        }
        print("✅ Found CAPBridgeViewController: \(bridgeVC)")
        
        guard let webView = bridgeVC.webView else {
            print("❌ WebView not available on bridge")
            return
        }
        print("✅ WebView found: \(webView)")
        print("✅ WebView URL: \(webView.url?.absoluteString ?? "nil")")
        
        print("🔐 Proceeding to JWT token retrieval...")
        self.testPhotoShareAuth(webView: webView)
    }
    
    private func testPhotoShareAuth(webView: WKWebView) {
        // Skip readiness check since you're logged in - call JWT function directly
        print("✅ PhotoShareJWT: Skipping auth readiness check, calling JWT function directly...")
        self.getJwtToken(webView: webView)
    }
    
    private func getJwtToken(webView: WKWebView) {
        print("🔐 ==================== GETTING JWT TOKEN ====================")
        print("🔐 Getting JWT token...")
        print("🔐 WebView URL: \(webView.url?.absoluteString ?? "nil")")
        
        let promiseJS = """
        (function() {
            try {
                console.log('🔐 PROMISE JWT RETRIEVAL STARTING...');
                console.log('🔐 Current URL:', window.location.href);
                
                if (typeof window.getPhotoShareJwtToken !== 'function') {
                    console.log('❌ getPhotoShareJwtToken function not found');
                    return 'FUNCTION_NOT_FOUND';
                }
                
                console.log('🔐 Calling getPhotoShareJwtToken()...');
                const tokenPromise = window.getPhotoShareJwtToken();
                
                if (tokenPromise && typeof tokenPromise.then === 'function') {
                    console.log('🔐 Promise detected, setting up handlers...');
                    
                    // Set up Promise handlers and store result in global variable
                    tokenPromise.then(function(token) {
                        console.log('🔐 ✅ Promise resolved with token:', typeof token);
                        console.log('🔐 Token length:', token ? token.length : 'null');
                        console.log('🔐 Token preview:', token ? token.substring(0, 30) + '...' : 'null');
                        
                        // Store in global for iOS to read later
                        window._iOSJwtResult = {
                            success: true,
                            token: token,
                            timestamp: new Date().toISOString(),
                            length: token ? token.length : 0
                        };
                        
                        console.log('🔐 Token stored in window._iOSJwtResult');
                        
                    }).catch(function(error) {
                        console.error('🔐 ❌ Promise rejected:', error);
                        
                        window._iOSJwtResult = {
                            success: false,
                            error: error.message || 'Promise rejected',
                            timestamp: new Date().toISOString()
                        };
                    });
                    
                    // Clear any previous result
                    window._iOSJwtResult = null;
                    
                    return 'PROMISE_SETUP_COMPLETE';
                } else {
                    console.log('🔐 Direct result (not a promise):', typeof tokenPromise);
                    return typeof tokenPromise === 'string' ? tokenPromise : 'NOT_A_PROMISE';
                }
                
            } catch (error) {
                console.error('🔐 Error:', error);
                return 'ERROR_' + error.message;
            }
        })();
        """
        
        print("🔐 Executing JavaScript...")
        webView.evaluateJavaScript(promiseJS) { result, error in
            DispatchQueue.main.async {
                print("🔐 ==================== JavaScript RESULT ====================")
                print("🔐 JavaScript execution completed")
                print("🔐 Error: \(error?.localizedDescription ?? "none")")
                print("🔐 Result type: \(type(of: result))")
                print("🔐 Result value: \(String(describing: result))")
                
                if let error = error {
                    print("❌ JWT token retrieval failed: \(error)")
                    return
                }
                
                if let resultString = result as? String, resultString == "PROMISE_SETUP_COMPLETE" {
                    print("✅ Promise setup complete, starting polling for result...")
                    self.pollForJwtResult(webView: webView, attempts: 0)
                } else if let token = result as? String, token.hasPrefix("eyJ") {
                    // Direct token result (unlikely but handle it)
                    print("✅ Direct token result: \(token.prefix(20))...")
                    self.storeJwtToken(token: token)
                } else {
                    print("❌ Unexpected result format: \(String(describing: result))")
                }
                
                print("🔐 ==================== JWT RETRIEVAL END ====================")
            }
        }
    }
    
    // Poll for Promise result stored in window._iOSJwtResult
    private func pollForJwtResult(webView: WKWebView, attempts: Int) {
        let maxAttempts = 20  // 20 attempts * 0.5s = 10 seconds total
        
        if attempts >= maxAttempts {
            print("❌ JWT polling timeout after \(maxAttempts) attempts")
            // Call completion handler with nil on timeout
            if let completion = jwtRefreshCompletion {
                print("❌ Calling JWT refresh completion handler with timeout error")
                completion(nil)
                jwtRefreshCompletion = nil
            }
            return
        }
        
        print("🔄 Polling for JWT result (attempt \(attempts + 1)/\(maxAttempts))...")
        
        let checkJS = "window._iOSJwtResult ? JSON.stringify(window._iOSJwtResult) : null;"
        
        webView.evaluateJavaScript(checkJS) { result, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ Error polling for JWT result: \(error)")
                    return
                }
                
                if let resultString = result as? String {
                    print("✅ JWT Promise resolved! Result: \(resultString)")
                    
                    // Parse the JSON result
                    if let data = resultString.data(using: .utf8),
                       let resultDict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                        
                        if let token = resultDict["token"] as? String, !token.isEmpty {
                            print("✅ Valid JWT token received from Promise: \(token.prefix(20))...")
                            print("🔐 Token length: \(token.count) characters")
                            self.storeJwtToken(token: token)
                        } else if let errorMsg = resultDict["error"] as? String {
                            print("❌ JWT error from Promise: \(errorMsg)")
                        } else {
                            print("❌ Invalid JWT result structure: \(resultDict)")
                        }
                    } else {
                        print("❌ Could not parse JWT result JSON")
                    }
                } else {
                    // No result yet, continue polling
                    print("⏳ No JWT result yet, retrying in 0.5 seconds...")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        self.pollForJwtResult(webView: webView, attempts: attempts + 1)
                    }
                }
            }
        }
    }
    
    // Helper to store JWT token with proper formatting
    private func storeJwtToken(token: String) {
        // Parse JWT to get expiration
        let expiresAt = parseJwtExpiration(token: token)
        let tokenData: [String: Any] = [
            "token": token,
            "expiresAt": expiresAt?.timeIntervalSince1970 ?? 0,
            "retrievedAt": Date().timeIntervalSince1970
        ]
        
        // Store in UserDefaults for EventPhotoPicker access
        UserDefaults.standard.set(tokenData, forKey: "photoshare_jwt_data")
        UserDefaults.standard.set(token, forKey: "photoshare_jwt_token")
        
        print("🔐 JWT stored with expiration: \(expiresAt?.description ?? "unknown")")
        
        // Call completion handler if one is waiting
        if let completion = jwtRefreshCompletion {
            print("✅ Calling JWT refresh completion handler with fresh token")
            completion(token)
            jwtRefreshCompletion = nil
        }
        
        processJwtToken(token: token)
    }
    
    // MARK: - JWT Token Response Handler (Chunked)
    private func handleJwtTokenResponse(result: Any?, error: Error?, webView: WKWebView) {
        if let error = error {
            print("❌ JWT JavaScript execution error: \(error)")
            let debugInfo = """
            JavaScript Execution Error:
            \(error.localizedDescription)
            
            Error Domain: \(error._domain)  
            Error Code: \(error._code)
            
            This likely means:
            - Auth bridge not ready yet (try waiting longer)
            - JavaScript returning unsupported type
            - Network/timing issue
            
            Tap 'Retry' to try again with longer delay
            """
            return
        }
        
        guard let resultDict = result as? [String: Any] else {
            print("❌ JWT response not a dictionary: \(String(describing: result))")
            return
        }
        
        guard let success = resultDict["success"] as? Bool, success else {
            let errorMsg = resultDict["error"] as? String ?? "Unknown error"
            print("❌ JWT retrieval failed: \(errorMsg)")
            return
        }
        
        // Check if response is chunked
        if let chunked = resultDict["chunked"] as? Bool, chunked {
            print("🔐 Large token detected, retrieving chunks...")
            let totalChunks = resultDict["totalChunks"] as? Int ?? 0
            let totalLength = resultDict["totalLength"] as? Int ?? 0
            let chunkSize = resultDict["chunkSize"] as? Int ?? 500
            
            print("🔐 Token info: \(totalLength) chars, \(totalChunks) chunks of \(chunkSize) chars each")
            
            self.retrieveChunkedToken(webView: webView, totalChunks: totalChunks, totalLength: totalLength)
        } else {
            // Small token returned directly
            if let token = resultDict["token"] as? String {
                print("✅ Small JWT token retrieved directly: \(token.count) chars")
                self.storeJwtToken(token: token)
            } else {
                print("❌ No token in direct response")
            }
        }
    }
    
    private func retrieveChunkedToken(webView: WKWebView, totalChunks: Int, totalLength: Int) {
        var tokenChunks: [String] = Array(repeating: "", count: totalChunks)
        var chunksReceived = 0
        
        for chunkIndex in 0..<totalChunks {
            let chunkJS = """
                (function() {
                    if (!window._tempJwtToken) {
                        return null;
                    }
                    var chunkSize = 500;
                    var start = \(chunkIndex) * chunkSize;
                    var end = start + chunkSize;
                    var chunk = window._tempJwtToken.substring(start, end);
                    console.log('🔐 Chunk \(chunkIndex + 1)/\(totalChunks) length:', chunk.length);
                    return chunk;
                })();
            """
            
            webView.evaluateJavaScript(chunkJS) { (chunkResult, chunkError) in
                DispatchQueue.main.async {
                    if let chunk = chunkResult as? String {
                        tokenChunks[chunkIndex] = chunk
                        chunksReceived += 1
                        print("🔐 Received chunk \(chunkIndex + 1)/\(totalChunks): \(chunk.count) chars")
                        
                        // Check if all chunks received
                        if chunksReceived == totalChunks {
                            let fullToken = tokenChunks.joined()
                            print("✅ All chunks received, full token: \(fullToken.count) chars")
                            
                            // Clean up temp token
                            webView.evaluateJavaScript("delete window._tempJwtToken;") { _, _ in }
                            
                            // Store token properly in UserDefaults AND process it
                            self.storeJwtToken(token: fullToken)
                        }
                    } else {
                        print("❌ Failed to retrieve chunk \(chunkIndex): \(String(describing: chunkError))")
                    }
                }
            }
        }
    }
    
    // MARK: - JWT Token Parsing
    private func parseJwtExpiration(token: String) -> Date? {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else {
            print("❌ Invalid JWT token format")
            return nil
        }
        
        // Decode the payload (second part)
        var payload = parts[1]
        
        // Add padding if needed for base64 decoding
        while payload.count % 4 != 0 {
            payload += "="
        }
        
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else {
            print("❌ Could not parse JWT expiration")
            return nil
        }
        
        let expirationDate = Date(timeIntervalSince1970: exp)
        print("🔐 JWT Token expires: \(expirationDate)")
        return expirationDate
    }
    
    // MARK: - Static JWT Access for Plugins
    @objc static func getStoredJwtToken() -> String? {
        return UserDefaults.standard.string(forKey: "photoshare_jwt_token")
    }
    
    @objc static func getStoredJwtData() -> [String: Any]? {
        return UserDefaults.standard.dictionary(forKey: "photoshare_jwt_data")
    }
    
    @objc static func isJwtTokenValid() -> Bool {
        guard let tokenData = getStoredJwtData(),
              let expiresAt = tokenData["expiresAt"] as? TimeInterval,
              expiresAt > 0 else {
            print("🔍 JWT validation failed - no token data or expiration")
            return false
        }
        
        let expirationDate = Date(timeIntervalSince1970: expiresAt)
        let now = Date()
        let timeUntilExpiry = expirationDate.timeIntervalSince(now)
        
        print("🔍 JWT validation - expires: \(expirationDate), time until expiry: \(timeUntilExpiry) seconds")
        
        // Consider token valid if it expires more than 5 minutes from now
        let isValid = timeUntilExpiry > 300
        print("🔍 JWT is valid: \(isValid)")
        return isValid
    }
    
    // Method to trigger JWT retrieval on-demand
    @objc static func refreshJwtTokenIfNeeded() {
        refreshJwtTokenIfNeeded { _ in }
    }
    
    // Method to trigger JWT retrieval with completion handler
    static func refreshJwtTokenIfNeeded(completion: @escaping (String?) -> Void) {
        // Ensure UI operations happen on main thread to avoid Main Thread Checker warnings
        DispatchQueue.main.async {
            guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
                print("❌ Could not access AppDelegate for JWT refresh")
                completion(nil)
                return
            }
            
            if !isJwtTokenValid() {
                print("🔄 JWT token invalid, triggering refresh...")
                appDelegate.retrieveJwtTokenForNativePlugins(completion: completion)
            } else {
                print("✅ JWT token still valid, no refresh needed")
                completion(getStoredJwtToken())
            }
        }
    }
    
    // Force JWT retrieval regardless of current status
    @objc func forceJwtRetrieval() {
        print("🔄 FORCE: JWT retrieval requested from EventPhotoPicker")
        retrieveJwtTokenForNativePlugins()
    }
    
    private func processJwtToken(token: String) {
        self.currentJwtToken = token
        
        print("✅ JWT Token processed successfully!")
        print("🔐 Token length: \(token.count) characters")
        print("🔐 Token prefix: \(String(token.prefix(50)))...")
        print("🔐 Token suffix: ...\(String(token.suffix(20)))")
        
        // Parse JWT token to get expiration
        self.parseJwtTokenExpiration(token: token)
        
        // Show green debug button with success info
        let successMessage = """
        ✅ JWT Token Retrieved (Chunked)!
        
        Length: \(token.count) characters
        Expires: \(self.formatExpirationDate())
        Retrieved: \(Date())
        
        Token Preview:
        \(String(token.prefix(60)))...
        """
    }
    
    private func handleJwtTokenResult(result: Any?, error: Error?) {
        if let error = error {
            print("❌ JWT JavaScript execution error: \(error)")
            let debugInfo = """
            JavaScript Execution Error:
            \(error.localizedDescription)
            
            Error Domain: \(error._domain)  
            Error Code: \(error._code)
            
            This likely means:
            - Auth bridge not ready yet (try waiting longer)
            - JavaScript returning unsupported type
            - Network/timing issue
            
            Tap 'Retry' to try again with longer delay
            """
            return
        }
        
        // Handle direct string result (JWT token) or null
        if let token = result as? String, !token.isEmpty {
            // Success - we got a JWT token string
            self.currentJwtToken = token
            
            print("✅ JWT Token retrieved successfully!")
            print("🔐 Token length: \(token.count) characters")
            print("🔐 Token prefix: \(String(token.prefix(50)))...")
            print("🔐 Token suffix: ...\(String(token.suffix(20)))")
            
            // Parse JWT token to get expiration
            self.parseJwtTokenExpiration(token: token)
            
            // Show green debug button with success info
            let successMessage = """
            ✅ JWT Token Retrieved!
            
            Length: \(token.count) characters
            Expires: \(self.formatExpirationDate())
            Retrieved: \(Date())
            
            Token Preview:
            \(String(token.prefix(60)))...
            """
                
        } else {
            // Failed - no token or null result
            let debugInfo = """
            ❌ JWT Token Not Retrieved
            
            Result Type: \(type(of: result))
            Result Value: \(String(describing: result))
            
            This means:
            - No JWT functions found on website
            - Functions exist but returned null/empty
            - User not logged in
            - Network/timing issue
            
            Check browser console for 🔐 messages
            to see which functions are available.
            """
            
            print("❌ JWT token retrieval failed")
            print("🔐 Result type: \(type(of: result))")
            print("🔐 Result value: \(String(describing: result))")
            
        }
    }
    
    private func parseJwtTokenExpiration(token: String) {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else {
            print("❌ Invalid JWT token format")
            return
        }
        
        // Decode the payload (second part)
        var payload = parts[1]
        
        // Add padding if needed for base64 decoding
        while payload.count % 4 != 0 {
            payload += "="
        }
        
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval else {
            print("❌ Could not parse JWT expiration")
            return
        }
        
        self.jwtTokenExpiration = Date(timeIntervalSince1970: exp)
        print("🔐 JWT Token expires: \(self.formatExpirationDate())")
    }
    
    private func formatExpirationDate() -> String {
        guard let expiration = jwtTokenExpiration else { return "Unknown" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: expiration)
    }
    
    // MARK: - Custom Plugin Registration (Capacitor 7)
    // Custom plugins are registered via packageClassList in capacitor.config.json

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
        
        // Clear app badge when app enters foreground
        print("🔔 [BADGE] Clearing app badge on enter foreground")
        application.applicationIconBadgeNumber = 0
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        
        // Clear app badge when app becomes active
        print("🔔 [BADGE] Clearing app badge on app become active")
        application.applicationIconBadgeNumber = 0
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        
        // Ensure GoogleSignIn has the right presenting view controller when app becomes active
        DispatchQueue.main.async {
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let window = windowScene.windows.first(where: \.isKeyWindow),
               let rootViewController = window.rootViewController {
                print("✅ Setting GoogleSignIn presenting view controller: \(rootViewController)")
            }
        }
        
        // Pre-load fresh JWT token every time app becomes active (Android pattern)
        print("🔄 App became active - checking for fresh JWT token...")
        self.preloadFreshJwtToken()
    }
    
    // MARK: - JWT Pre-loading (Android Pattern)
    private func preloadFreshJwtToken() {
        print("🔄 ==================== JWT PRELOAD START ====================")
        print("🔄 PRE-LOADING fresh JWT token...")
        print("🔄 Current time: \(Date())")
        
        // Check if we already have a fresh token (less than 5 minutes old)
        let tokenData = AppDelegate.getStoredJwtData()
        print("🔄 Stored token data: \(tokenData != nil ? "exists" : "nil")")
        
        if let tokenData = tokenData,
           let retrievedAt = tokenData["retrievedAt"] as? TimeInterval {
            let tokenAge = Date().timeIntervalSince1970 - retrievedAt
            let retrieveDate = Date(timeIntervalSince1970: retrievedAt)
            
            print("🔄 Token retrieved at: \(retrieveDate)")
            print("🔄 Token age: \(Int(tokenAge)) seconds")
            
            if tokenAge < 300 { // 5 minutes = 300 seconds
                print("🔄 Fresh token already available (age: \(Int(tokenAge))s) - no need to pre-load")
                print("🔄 ==================== JWT PRELOAD END (CACHED) ====================")
                return
            } else {
                print("🔄 Token is expired (age: \(Int(tokenAge))s > 300s)")
            }
        } else {
            print("🔄 No stored token data found")
        }
        
        print("🔄 No fresh token available or expired - pre-loading now...")
        print("🔄 Setting 1-second delay timer...")
        
        // Request fresh token via Capacitor WebView bridge (with minimal delay)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            print("🔄 ==================== 1 SECOND DELAY COMPLETED ====================")
            print("🔄 1 second delay completed - requesting fresh JWT token...")
            self.retrieveJwtTokenForNativePlugins()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle photoshare:// deep links
        if url.scheme == "photoshare" {
            print("🔗 [AppDelegate] Handling PhotoShare deep link: \(url)")
            
            // Notify Capacitor plugins about the URL
            NotificationCenter.default.post(name: .capacitorOpenURL, object: url)
            
            // Also let Capacitor handle it normally
            return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
        }
        
        // Handle Google Sign-In callback
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }
    
    // MARK: - Remote Notifications for FCM
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        print("🔔 [FCM] Device registered for remote notifications")
        print("🔔 [FCM] Device token: \(deviceToken.map { String(format: "%02.2hhx", $0) }.joined())")
        
        // Set APNS token for Firebase Messaging
        Messaging.messaging().apnsToken = deviceToken
        print("🔔 [FCM] APNS token set in Firebase Messaging")
        
        // Force FCM token generation after APNS token is set
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            print("🔔 [FCM] Requesting FCM token after APNS registration...")
            Messaging.messaging().token { token, error in
                if let error = error {
                    print("❌ [FCM] Error getting FCM token: \(error.localizedDescription)")
                } else if let token = token {
                    print("✅ [FCM] FCM token received after APNS: \(token.prefix(20))...")
                    print("🔔 [FCM] Token length: \(token.count) characters")
                    
                    // Notify FCMTokenPlugin about the token
                    NotificationCenter.default.post(
                        name: Notification.Name("FCMTokenReceived"),
                        object: nil,
                        userInfo: ["token": token]
                    )
                } else {
                    print("❌ [FCM] No FCM token received after APNS")
                }
            }
        }
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ [FCM] Failed to register for remote notifications: \(error.localizedDescription)")
    }
    
    // MARK: - Push Notification Deep Link Handling
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("📱 [PUSH] Received remote notification")
        
        // Process deep links using the updated helper method
        processPushNotificationDeepLink(userInfo)
        
        // Let Firebase handle it
        Messaging.messaging().appDidReceiveMessage(userInfo)
        
        completionHandler(.newData)
    }
    
    private func handleDeepLinkFromNotification(_ deepLink: String) {
        print("🔗 [PUSH] Processing deep link from notification:", deepLink)
        NSLog("🔗 [AppDelegate] handleDeepLinkFromNotification called with: \(deepLink)")
        
        // Create URL from deep link string
        if let url = URL(string: deepLink) {
            NSLog("🔗 [AppDelegate] Valid URL created: \(url)")
            
            // Use the existing application:open:options: handler which already works
            // This method at line 704 already handles photoshare:// URLs correctly
            DispatchQueue.main.async {
                // Call the existing URL handler that's already working for deep links
                _ = self.application(UIApplication.shared, open: url, options: [:])
                NSLog("🔗 [AppDelegate] Called existing application:open:options: handler")
            }
        } else {
            NSLog("🔗 [AppDelegate] Failed to create valid URL from: \(deepLink)")
        }
    }
    
    private func notifyWebViewOfDeepLink(_ url: URL) {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let bridgeVC = window.rootViewController as? CAPBridgeViewController,
              let webView = bridgeVC.webView else {
            print("❌ [PUSH] WebView not available to handle deep link")
            return
        }
        
        let script = """
            console.log('🔗 [iOS Push] Received deep link: \(url.absoluteString)');
            if (window.handlePhotoShareDeepLink) {
                window.handlePhotoShareDeepLink('\(url.absoluteString)');
            } else {
                console.log('⏳ [iOS Push] handlePhotoShareDeepLink not found, storing for later');
                window._pendingDeepLink = '\(url.absoluteString)';
            }
        """
        
        webView.evaluateJavaScript(script) { result, error in
            if let error = error {
                print("❌ [PUSH] Error notifying web of deep link:", error)
            } else {
                print("✅ [PUSH] Web notified of deep link")
            }
        }
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // MARK: - Simple JavaScript Test
    private func testSimpleJavaScript() {
        print("🧪 Testing simple JavaScript execution...")
        
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first,
              let bridgeVC = window.rootViewController as? CAPBridgeViewController,
              let webView = bridgeVC.webView else {
            print("❌ WebView not available for simple JS test")
            return
        }
        
        let simpleJS = """
            (function() {
                console.log('🧪 =================================');
                console.log('🧪 Simple JS test starting...');
                console.log('🧪 Current URL:', window.location.href);
                console.log('🧪 Page title:', document.title);
                
                // Check all PhotoShare related properties
                console.log('🧪 Scanning ALL window properties for PhotoShare/auth/jwt...');
                var allProps = [];
                for (var prop in window) {
                    var propLower = prop.toLowerCase();
                    if (propLower.includes('photoshare') || propLower.includes('auth') || propLower.includes('jwt') || propLower.includes('supabase')) {
                        allProps.push(prop + ': ' + typeof window[prop]);
                    }
                }
                console.log('🧪 Found relevant properties:', allProps);
                
                // Check specific functions
                console.log('🧪 Specific function checks:');
                console.log('  window.isPhotoShareAuthReady:', typeof window.isPhotoShareAuthReady);
                console.log('  window.getPhotoShareJwtToken:', typeof window.getPhotoShareJwtToken);
                console.log('  window.getJwtTokenForNativePlugin:', typeof window.getJwtTokenForNativePlugin);
                console.log('  window.supabase:', !!window.supabase);
                console.log('  window.PhotoShareAuthState:', !!window.PhotoShareAuthState);
                
                // Try different ways to check auth state
                console.log('🧪 PhotoShareAuthState check:', !!window.PhotoShareAuthState);
                if (window.PhotoShareAuthState) {
                    console.log('🧪 PhotoShareAuthState contents:', window.PhotoShareAuthState);
                }
                
                // Try calling isPhotoShareAuthReady if it exists
                if (typeof window.isPhotoShareAuthReady === 'function') {
                    try {
                        var ready = window.isPhotoShareAuthReady();
                        console.log('🧪 isPhotoShareAuthReady() result:', ready);
                        return 'AUTH_READY_' + ready;
                    } catch (error) {
                        console.log('🧪 Error calling isPhotoShareAuthReady:', error);
                        return 'AUTH_ERROR';
                    }
                } else {
                    console.log('🧪 isPhotoShareAuthReady function not found');
                    
                    // Try calling getPhotoShareJwtToken directly since we know it works
                    if (typeof window.getPhotoShareJwtToken === 'function') {
                        console.log('🧪 Found getPhotoShareJwtToken, testing direct call...');
                        return 'JWT_FUNCTION_AVAILABLE';
                    }
                    
                    return 'NO_AUTH_FUNCTION';
                }
            })();
        """
        
        webView.evaluateJavaScript(simpleJS) { (result, error) in
            DispatchQueue.main.async {
                if let error = error {
                    print("🧪 Simple JS test error: \(error)")
                } else if let result = result as? String {
                    print("🧪 Simple JS test result: \(result)")
                } else {
                    print("🧪 Simple JS test result type: \(type(of: result)), value: \(String(describing: result))")
                }
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate for Rich Notifications

extension AppDelegate {
    
    // Handle notifications when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, 
                              willPresent notification: UNNotification, 
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        
        print("🔔 Received notification in foreground: \(notification.request.content.title)")
        print("🔔 Notification body: \(notification.request.content.body)")
        print("🔔 Notification attachments: \(notification.request.content.attachments.count)")
        
        // DEBUG: Log the complete notification payload
        print("🐛 [NOTIFICATION DEBUG] Complete userInfo payload:")
        for (key, value) in notification.request.content.userInfo {
            print("🐛   \(key): \(value)")
        }
        
        // Log attachment details
        for (index, attachment) in notification.request.content.attachments.enumerated() {
            print("🖼️ Attachment \(index): \(attachment.identifier) - \(attachment.url.lastPathComponent)")
        }
        
        // Show notification even when app is in foreground (important for rich notifications)
        completionHandler([.banner, .badge, .sound])
    }
    
    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter, 
                              didReceive response: UNNotificationResponse, 
                              withCompletionHandler completionHandler: @escaping () -> Void) {
        
        print("👆 User tapped notification: \(response.notification.request.content.title)")
        print("👆 Notification attachments tapped: \(response.notification.request.content.attachments.count)")
        
        // Handle notification tap (navigate to specific screen, etc.)
        let userInfo = response.notification.request.content.userInfo
        
        // Process deep links from push notifications
        processPushNotificationDeepLink(userInfo)
        
        // Extract event_id or other data for navigation
        if let eventId = userInfo["event_id"] as? String {
            print("📱 Notification contains event_id: \(eventId)")
            // TODO: Navigate to specific event screen
        }
        
        // Forward to Capacitor/JavaScript if needed
        NotificationCenter.default.post(name: .capacitorDidReceiveNotificationResponse, object: userInfo)
        
        completionHandler()
    }
    
    // MARK: - Additional Deep Link Handling
    
    // Helper method to process deep links from push notifications
    private func processPushNotificationDeepLink(_ userInfo: [AnyHashable: Any]) {
        print("📱 [PUSH] Processing push notification data")
        print("📱 [PUSH] Full userInfo:", userInfo)
        
        // Check for deep link in various locations based on FCM payload structure
        
        // 1. Check "deepLink" (without underscore) at root level - YOUR CURRENT FORMAT
        if let deepLink = userInfo["deepLink"] as? String {
            print("🔗 [PUSH] Found deepLink at root level:", deepLink)
            
            // Log additional context if available
            if let eventId = userInfo["eventId"] as? String {
                print("📱 [PUSH] Event ID:", eventId)
            }
            if let action = userInfo["action"] as? String {
                print("📱 [PUSH] Action:", action)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.handleDeepLinkFromNotification(deepLink)
            }
            return
        }
        
        // 2. Check "deep_link" (with underscore) for backwards compatibility
        if let deepLink = userInfo["deep_link"] as? String {
            print("🔗 [PUSH] Found deep_link at root level:", deepLink)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.handleDeepLinkFromNotification(deepLink)
            }
            return
        }
        
        // 2. Check in sentPayload (your current structure)
        if let sentPayload = userInfo["sentPayload"] as? [String: Any] {
            print("📱 [PUSH] Found sentPayload:", sentPayload)
            
            if let deepLink = sentPayload["deepLink"] as? String {
                print("🔗 [PUSH] Found deepLink in sentPayload:", deepLink)
                
                // Also log additional context if available
                if let eventId = sentPayload["eventId"] as? String {
                    print("📱 [PUSH] Event ID:", eventId)
                }
                if let eventName = sentPayload["eventName"] as? String {
                    print("📱 [PUSH] Event Name:", eventName)
                }
                if let deepLinkType = sentPayload["deepLinkType"] as? String {
                    print("📱 [PUSH] Deep Link Type:", deepLinkType)
                }
                
                // Process the deep link
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    self.handleDeepLinkFromNotification(deepLink)
                }
                return
            }
        }
        
        // 3. Check FCM data fields (Firebase standard locations)
        if let aps = userInfo["aps"] as? [String: Any] {
            print("📱 [PUSH] APS data:", aps)
        }
        
        if let fcmOptions = userInfo["fcm_options"] as? [String: Any] {
            print("📱 [PUSH] FCM options:", fcmOptions)
            if let link = fcmOptions["link"] as? String {
                print("🔗 [PUSH] Found link in fcm_options:", link)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    self.handleDeepLinkFromNotification(link)
                }
                return
            }
        }
        
        // 4. Check for gcm.notification.deep_link (Firebase format)
        if let gcmDeepLink = userInfo["gcm.notification.deep_link"] as? String {
            print("🔗 [PUSH] Found gcm.notification.deep_link:", gcmDeepLink)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.handleDeepLinkFromNotification(gcmDeepLink)
            }
            return
        }
        
        // 5. Check clickAction field (HTTPS URL format)
        if let clickAction = userInfo["clickAction"] as? String {
            print("🔗 [PUSH] Found clickAction URL:", clickAction)
            
            // Convert HTTPS URL to photoshare:// deep link
            if let url = URL(string: clickAction) {
                let pathComponents = url.pathComponents.filter { $0 != "/" }
                
                if pathComponents.contains("event"), 
                   let eventIndex = pathComponents.firstIndex(of: "event"),
                   eventIndex < pathComponents.count - 1 {
                    let eventId = pathComponents[eventIndex + 1]
                    let deepLink = "photoshare://event/\(eventId)"
                    print("🔗 [PUSH] Converted clickAction to deep link:", deepLink)
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        self.handleDeepLinkFromNotification(deepLink)
                    }
                    return
                }
            }
        }
        
        // 6. If no deep link found but we have event info, construct one
        if let eventId = userInfo["eventId"] as? String {
            print("📱 [PUSH] No explicit deep link, but found eventId - constructing link")
            
            let action = userInfo["action"] as? String ?? "view_event"
            var constructedLink = "photoshare://"
            
            switch action {
                case "view_event":
                    constructedLink += "event/\(eventId)"
                case "create":
                    constructedLink += "create?eventId=\(eventId)"
                default:
                    constructedLink += "event/\(eventId)"
            }
            
            print("🔗 [PUSH] Constructed deep link:", constructedLink)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.handleDeepLinkFromNotification(constructedLink)
            }
            return
        }
        
        // Also check sentPayload for eventId fallback
        if let sentPayload = userInfo["sentPayload"] as? [String: Any],
           let eventId = sentPayload["eventId"] as? String,
           let deepLinkType = sentPayload["deepLinkType"] as? String {
            
            print("📱 [PUSH] No explicit deep link, constructing from sentPayload event data")
            var constructedLink = "photoshare://"
            
            switch deepLinkType {
                case "event":
                    constructedLink += "event/\(eventId)"
                case "create":
                    constructedLink += "create?eventId=\(eventId)"
                default:
                    constructedLink += "event/\(eventId)"
            }
            
            print("🔗 [PUSH] Constructed deep link:", constructedLink)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.handleDeepLinkFromNotification(constructedLink)
            }
            return
        }
        
        print("❌ [PUSH] No deep link found in notification payload")
    }
}

// MARK: - Notification Name Extension

extension Notification.Name {
    static let capacitorDidReceiveNotificationResponse = Notification.Name("capacitorDidReceiveNotificationResponse")
    static let capacitorOpenURL = Notification.Name("capacitorOpenURL")
}
