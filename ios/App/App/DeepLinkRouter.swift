import Capacitor
import UIKit

/**
 * DeepLinkRouter Plugin for PhotoShare iOS
 * Handles deep link navigation from push notifications and external sources
 */
@objc(DeepLinkRouter)
public class DeepLinkRouter: CAPPlugin {
    
    private var pendingDeepLink: String?
    
    override public func load() {
        NSLog("🔗 DeepLinkRouter plugin loaded successfully")
        print("🔗 DeepLinkRouter plugin loaded successfully")
        
        // Check if app was launched with a deep link
        checkLaunchDeepLink()
        
        // Register for URL notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleOpenURL(_:)),
            name: .capacitorOpenURL,
            object: nil
        )
        
        NSLog("🔗 DeepLinkRouter registered for capacitorOpenURL notifications")
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    /**
     * Handle incoming URL from notification
     */
    @objc private func handleOpenURL(_ notification: Notification) {
        NSLog("🔗 [DeepLinkRouter] handleOpenURL called with notification: \(notification)")
        
        // Check both object and userInfo for the URL
        var url: URL?
        if let directUrl = notification.object as? URL {
            url = directUrl
            NSLog("🔗 [DeepLinkRouter] Found URL in notification.object")
        } else if let userInfo = notification.userInfo, let userInfoUrl = userInfo["url"] as? URL {
            url = userInfoUrl  
            NSLog("🔗 [DeepLinkRouter] Found URL in notification.userInfo")
        }
        
        guard let finalUrl = url else { 
            NSLog("🔗 [DeepLinkRouter] No URL found in notification")
            return 
        }
        
        NSLog("🔗 [DeepLinkRouter] Received URL: \(finalUrl.absoluteString)")
        if finalUrl.scheme == "photoshare" {
            print("🔗 Received deep link URL: \(finalUrl)")
            NSLog("🔗 [DeepLinkRouter] Processing photoshare URL: \(finalUrl)")
            processDeepLink(url: finalUrl)
        } else {
            NSLog("🔗 [DeepLinkRouter] Ignoring non-photoshare URL: \(finalUrl)")
        }
    }
    
    /**
     * Handle deep link URL and route to appropriate native screen or action
     */
    @objc func handleDeepLink(_ call: CAPPluginCall) {
        guard let deepLink = call.getString("deepLink") else {
            print("❌ No deep link provided")
            call.reject("No deep link provided")
            return
        }
        
        print("🔗 Processing deep link: \(deepLink)")
        
        guard let url = URL(string: deepLink) else {
            call.reject("Invalid deep link URL")
            return
        }
        
        routeDeepLink(url: url, call: call)
    }
    
    /**
     * Get pending deep link from app launch
     */
    @objc func getPendingDeepLink(_ call: CAPPluginCall) {
        if let pending = pendingDeepLink {
            print("✅ Found pending deep link: \(pending)")
            
            if let url = URL(string: pending) {
                let result = parseDeepLink(url: url)
                pendingDeepLink = nil // Clear after retrieval
                call.resolve(result)
            } else {
                call.resolve(["hasPendingLink": false])
            }
        } else {
            call.resolve(["hasPendingLink": false])
        }
    }
    
    /**
     * Route deep link to native actions or web navigation
     */
    private func routeDeepLink(url: URL, call: CAPPluginCall) {
        guard url.scheme == "photoshare" else {
            call.reject("Invalid deep link scheme")
            return
        }
        
        let host = url.host ?? ""
        let path = url.path
        
        print("🔍 Routing deep link - Host: \(host), Path: \(path)")
        
        switch host {
        case "upload":
            handleUploadDeepLink(url: url, path: path, call: call)
            
        case "download":
            handleDownloadDeepLink(url: url, path: path, call: call)
            
        case "event", "join", "create", "home":
            handleWebDeepLink(url: url, call: call)
            
        default:
            print("⚠️ Unknown deep link action: \(host)")
            handleWebDeepLink(url: url, call: call)
        }
    }
    
    /**
     * Handle upload deep link with auto-upload logic
     */
    private func handleUploadDeepLink(url: URL, path: String, call: CAPPluginCall) {
        guard path.hasPrefix("/") else {
            call.reject("Invalid upload deep link format")
            return
        }
        
        let eventId = String(path.dropFirst())
        print("📤 Processing upload deep link for event: \(eventId)")
        
        // Check if AutoUploadPlugin is available and has auto-upload enabled
        DispatchQueue.main.async {
            // First, notify the web app about the deep link
            self.notifyWebOfDeepLink(url: url)
            
            // The web app will handle the logic to determine if auto-upload should be triggered
            // or if the manual photo picker should be opened
            let result: [String: Any] = [
                "action": "upload",
                "eventId": eventId,
                "handled": true,
                "requiresLogicCheck": true
            ]
            
            call.resolve(result)
            print("✅ Upload deep link processed, web app will handle upload logic")
        }
    }
    
    /**
     * Handle download deep link - trigger BulkDownload
     */
    private func handleDownloadDeepLink(url: URL, path: String, call: CAPPluginCall) {
        guard path.hasPrefix("/") else {
            call.reject("Invalid download deep link format")
            return
        }
        
        let eventId = String(path.dropFirst())
        print("📥 Processing download deep link for event: \(eventId)")
        
        DispatchQueue.main.async {
            // Notify web app to handle the download
            self.notifyWebOfDeepLink(url: url)
            
            let result: [String: Any] = [
                "action": "download",
                "eventId": eventId,
                "handled": true,
                "nativeAction": "bulkDownload"
            ]
            
            call.resolve(result)
            print("✅ Download deep link processed, web app will trigger BulkDownload")
        }
    }
    
    /**
     * Handle web-based deep links by navigating in WebView
     */
    private func handleWebDeepLink(url: URL, call: CAPPluginCall) {
        print("🌐 Processing web deep link: \(url)")
        
        // Parse the deep link data for web app
        let result = parseDeepLink(url: url)
        
        // Notify web app about the deep link
        notifyWebOfDeepLink(url: url)
        call.resolve(result)
        print("✅ Web deep link handled: \(result)")
    }
    
    /**
     * Check if app was launched with deep link
     */
    private func checkLaunchDeepLink() {
        // This will be called when the plugin loads
        // Check if there's a pending deep link from app launch
        // The actual URL will be passed via handleOpenURL notification
        print("🔍 Checking for launch deep link...")
    }
    
    /**
     * Process deep link from URL
     */
    private func processDeepLink(url: URL) {
        print("🔗 Processing deep link: \(url)")
        
        // Store as pending if web app not ready
        pendingDeepLink = url.absoluteString
        
        // Notify web app
        notifyWebOfDeepLink(url: url)
    }
    
    /**
     * Parse deep link URI into structured data
     */
    private func parseDeepLink(url: URL) -> [String: Any] {
        guard url.scheme == "photoshare" else {
            return ["hasPendingLink": false]
        }
        
        let host = url.host ?? ""
        let path = url.path
        
        var result: [String: Any] = [
            "scheme": url.scheme ?? "",
            "action": host,
            "fullUrl": url.absoluteString,
            "hasPendingLink": true
        ]
        
        print("🔍 Parsing deep link - Host: \(host), Path: \(path)")
        
        switch host {
        case "event":
            if path.hasPrefix("/") {
                let eventId = String(path.dropFirst())
                result["eventId"] = eventId
                result["screen"] = "event_details"
                result["deepLinkType"] = "event"
                print("📅 Event deep link - ID: \(eventId)")
            }
            
        case "upload":
            if path.hasPrefix("/") {
                let eventId = String(path.dropFirst())
                result["eventId"] = eventId
                result["screen"] = "upload_flow"
                result["deepLinkType"] = "upload"
                result["requiresUploadLogic"] = true
                print("📤 Upload deep link - ID: \(eventId)")
            }
            
        case "download":
            if path.hasPrefix("/") {
                let eventId = String(path.dropFirst())
                result["eventId"] = eventId
                result["screen"] = "bulk_download"
                result["deepLinkType"] = "download"
                print("📥 Download deep link - ID: \(eventId)")
            }
            
        case "join":
            if path.hasPrefix("/") {
                let pathComponents = String(path.dropFirst()).split(separator: "/")
                if pathComponents.count >= 1 {
                    result["eventCode"] = String(pathComponents[0])
                    result["screen"] = "join_event"
                    result["deepLinkType"] = "join"
                    
                    if pathComponents.count >= 2 {
                        result["eventPass"] = String(pathComponents[1])
                    }
                    
                    print("🤝 Join deep link - Code: \(pathComponents[0])")
                }
            }
            
        case "create":
            result["screen"] = "create_event"
            result["deepLinkType"] = "create"
            print("➕ Create event deep link")
            
        case "home":
            result["screen"] = "home"
            result["deepLinkType"] = "home"
            print("🏠 Home deep link")
            
        default:
            print("⚠️ Unknown deep link action: \(host)")
            result["screen"] = "home"
            result["fallback"] = true
        }
        
        return result
    }
    
    /**
     * Notify web app of deep link via JavaScript
     */
    private func notifyWebOfDeepLink(url: URL) {
        let deepLinkData = parseDeepLink(url: url)
        let jsonData = try? JSONSerialization.data(withJSONObject: deepLinkData, options: [])
        let jsonString = jsonData != nil ? String(data: jsonData!, encoding: .utf8) ?? "{}" : "{}"
        
        let script = """
            if (window.handlePhotoShareDeepLink) {
                console.log('🔗 [iOS] Processing launch deep link:', \(jsonString));
                window.handlePhotoShareDeepLink('\(url.absoluteString)');
            } else {
                console.log('🔗 [iOS] Storing deep link for later processing:', \(jsonString));
                window._pendingDeepLink = \(jsonString);
            }
        """
        
        DispatchQueue.main.async {
            self.bridge?.webView?.evaluateJavaScript(script) { _, error in
                if let error = error {
                    print("❌ Error notifying web of deep link: \(error)")
                } else {
                    print("✅ Web app notified of deep link")
                }
            }
        }
    }
    
    /**
     * Parse upload link and determine if auto-upload should be triggered
     */
    @objc func parseUploadLink(_ call: CAPPluginCall) {
        let deepLink = call.getString("deepLink")
        guard let eventId = call.getString("eventId") else {
            call.reject("No event ID provided")
            return
        }
        
        print("🔗 Parsing upload link for event: \(eventId)")
        
        let result: [String: Any] = [
            "action": "upload",
            "eventId": eventId,
            "deepLink": deepLink ?? "",
            "requiresLogicCheck": true
        ]
        
        call.resolve(result)
    }
    
    /**
     * Reset debounce state (for compatibility with Android)
     */
    @objc func resetDebounce(_ call: CAPPluginCall) {
        // iOS doesn't need debounce for BulkDownload since it's handled differently
        print("✅ Debounce reset (no-op on iOS)")
        call.resolve(["success": true])
    }
}

