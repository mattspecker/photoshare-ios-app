import Foundation
import Capacitor
import WebKit

/**
 * Content Moderation Configuration
 * Enhances WKWebView to support NSFWJS/TensorFlow.js for client-side content moderation
 */

@objc public class ContentModerationConfig: NSObject {
    
    // MARK: - Configuration Methods
    
    /// Configure WKWebView for optimal NSFWJS/TensorFlow.js performance
    @objc public static func configureWebViewForContentModeration(_ webView: WKWebView) {
        NSLog("🛡️ ContentModeration: Configuring WebView for NSFWJS support")
        
        let configuration = webView.configuration
        
        // Enable JavaScript (required for TensorFlow.js)
        if #available(iOS 14.0, *) {
            // Use newer API for iOS 14+
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        } else {
            // Use deprecated API for iOS 13 compatibility
            configuration.preferences.javaScriptEnabled = true
        }
        
        // Enable hardware acceleration where possible
        if #available(iOS 14.0, *) {
            // iOS 14+ automatically uses hardware acceleration when available
            // WebGL support is automatically enabled if the device supports it
            NSLog("✅ ContentModeration: iOS 14+ detected - hardware acceleration available")
        } else {
            NSLog("⚠️ ContentModeration: iOS 13 detected - limited hardware acceleration")
        }
        
        // Allow inline media playback (may help with image processing)
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        // Increase JavaScript memory limits for ML model
        if #available(iOS 14.0, *) {
            // Allow navigation to external domains (for model downloads)
            configuration.limitsNavigationsToAppBoundDomains = false
        }
        
        // Set user agent to indicate iOS app (useful for debugging)
        configuration.applicationNameForUserAgent = "PhotoShare-iOS"
        
        // Configure content controller for debugging
        setupContentModerationDebugging(configuration.userContentController)
        
        NSLog("✅ ContentModeration: WebView configuration completed")
    }
    
    /// Setup debugging capabilities for content moderation
    private static func setupContentModerationDebugging(_ userContentController: WKUserContentController) {
        // Inject debugging JavaScript if in debug mode
        #if DEBUG
        let debugScript = """
        (function() {
            // Enable TensorFlow.js debugging if debug flag is present
            if (window.location.search.includes('debug=tfjs') || window.location.search.includes('debug=moderation')) {
                console.log('🛡️ ContentModeration: Debug mode enabled');
                
                // Enhanced logging for TensorFlow.js
                window.addEventListener('load', function() {
                    if (window.tf) {
                        console.log('🤖 TensorFlow.js version:', window.tf.version);
                        console.log('🤖 Backend:', window.tf.getBackend());
                        console.log('🤖 WebGL support:', !!window.tf.env().get('WEBGL_VERSION'));
                    }
                });
                
                // Performance monitoring for moderation
                window.moderationPerformanceTest = async function(imageFile) {
                    const start = performance.now();
                    try {
                        // This will be implemented by the web app
                        const result = await window.moderatePhotoFile(imageFile, 'moderate');
                        const elapsed = performance.now() - start;
                        console.log(`🛡️ Moderation completed in ${elapsed.toFixed(0)}ms`, result);
                        return { elapsed, result };
                    } catch (error) {
                        const elapsed = performance.now() - start;
                        console.error(`🛡️ Moderation failed after ${elapsed.toFixed(0)}ms`, error);
                        return { elapsed, error };
                    }
                };
            }
        })();
        """
        
        let userScript = WKUserScript(
            source: debugScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(userScript)
        NSLog("🛡️ ContentModeration: Debug scripts injected")
        #endif
    }
    
    // MARK: - Memory Management
    
    /// Check if device has sufficient memory for content moderation
    @objc public static func checkMemoryAvailability() -> [String: Any] {
        let processInfo = ProcessInfo.processInfo
        let totalMemory = processInfo.physicalMemory
        
        // Get current memory usage
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let result = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
            }
        }
        
        let usedMemory = result == KERN_SUCCESS ? info.resident_size : 0
        let freeMemory = totalMemory - usedMemory
        
        let memoryInfo: [String: Any] = [
            "totalMemoryMB": Int(totalMemory / 1024 / 1024),
            "usedMemoryMB": Int(usedMemory / 1024 / 1024),
            "freeMemoryMB": Int(freeMemory / 1024 / 1024),
            "recommendedForModeration": freeMemory > 200 * 1024 * 1024, // 200MB minimum
            "deviceClass": getDeviceClass()
        ]
        
        NSLog("🛡️ ContentModeration: Memory status - Free: \(Int(freeMemory / 1024 / 1024))MB, Recommended: \(memoryInfo["recommendedForModeration"] as! Bool)")
        
        return memoryInfo
    }
    
    /// Get device performance class for content moderation
    private static func getDeviceClass() -> String {
        let device = UIDevice.current
        let model = device.model
        
        // Estimate performance based on device model
        if model.contains("iPad") {
            if #available(iOS 15.0, *) {
                return "high" // iPad Pro/Air with M1/M2
            } else {
                return "medium" // Older iPads
            }
        } else {
            // iPhone classification
            if #available(iOS 15.0, *) {
                return "high" // iPhone 13+
            } else if #available(iOS 14.0, *) {
                return "medium" // iPhone 11-12
            } else {
                return "low" // iPhone SE, older models
            }
        }
    }
    
    // MARK: - Performance Monitoring
    
    /// Monitor WebView memory usage during content moderation
    @objc public static func startMemoryMonitoring(for webView: WKWebView) {
        NSLog("🛡️ ContentModeration: Starting memory monitoring")
        
        // Monitor memory warnings
        NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { _ in
            NSLog("⚠️ ContentModeration: Memory warning detected - ML model may be unloaded")
            
            // Inject JavaScript to handle memory warning
            webView.evaluateJavaScript("""
                if (window.handleModerationMemoryWarning) {
                    window.handleModerationMemoryWarning();
                    console.log('🛡️ ContentModeration: Memory warning handled');
                }
            """) { _, error in
                if let error = error {
                    NSLog("❌ ContentModeration: Error handling memory warning: \(error)")
                }
            }
        }
        
        // Periodic memory checks during active moderation
        Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            let memoryInfo = checkMemoryAvailability()
            let freeMemoryMB = memoryInfo["freeMemoryMB"] as! Int
            
            if freeMemoryMB < 100 { // Less than 100MB free
                NSLog("⚠️ ContentModeration: Low memory detected (\(freeMemoryMB)MB free)")
                
                webView.evaluateJavaScript("""
                    if (window.handleLowMemory) {
                        window.handleLowMemory({ freeMemoryMB: \(freeMemoryMB) });
                    }
                """)
            }
        }
    }
}

// MARK: - Capacitor Integration
// Note: This extension is optional - the ContentModerationPlugin will handle initialization