import UIKit
import Capacitor
import FirebaseCore
import GoogleSignIn
import WebKit

// Explicitly import plugin classes (force compilation)
// These should be automatically available since they're in the same module
// but we'll reference them to ensure they compile

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        FirebaseApp.configure()
        
        // Debug plugin registration
        print("🔍 AppDelegate: App launching with custom plugins")
        
        // Ensure custom plugin classes are loaded for packageClassList auto-registration
        print("🔧 Loading custom plugin classes for auto-registration...")
        _ = EventPhotoPicker.self
        _ = UploadManager.self
        _ = PhotoLibraryMonitor.self
        _ = QRScanner.self
        print("✅ Custom plugin classes loaded for packageClassList discovery")
        
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
        
        return true
    }
    
    // MARK: - JWT Token Management for Native Plugins
    private var currentJwtToken: String?
    private var jwtTokenExpiration: Date?
    
    private func retrieveJwtTokenForNativePlugins() {
        print("🔐 ==================== JWT TOKEN RETRIEVAL START ====================")
        print("🔐 Starting JWT token retrieval...")
        print("🔐 Current time: \(Date())")
        
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
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
            print("❌ Could not access AppDelegate for JWT refresh")
            return
        }
        
        if !isJwtTokenValid() {
            print("🔄 JWT token invalid, triggering refresh...")
            appDelegate.retrieveJwtTokenForNativePlugins()
        } else {
            print("✅ JWT token still valid, no refresh needed")
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
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        
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
        
        // Request fresh token via Capacitor WebView bridge (with 1 second delay like Android)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("🔄 ==================== 1 SECOND DELAY COMPLETED ====================")
            print("🔄 1 second delay completed - requesting fresh JWT token...")
            self.retrieveJwtTokenForNativePlugins()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Handle Google Sign-In callback
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
        
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
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
