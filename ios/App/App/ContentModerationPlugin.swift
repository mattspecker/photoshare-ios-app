import Foundation
import Capacitor
import UIKit

/**
 * Content Moderation Plugin
 * Provides iOS-specific functionality for client-side content moderation
 */

@objc(ContentModerationPlugin)
public class ContentModerationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ContentModerationPlugin"
    public let jsName = "ContentModeration"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getDeviceCapabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkMemoryStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "optimizeForModeration", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPerformanceProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "handleMemoryWarning", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "preloadModel", returnType: CAPPluginReturnPromise)
    ]
    
    private var isOptimized = false
    private var memoryMonitorTimer: Timer?
    
    override public func load() {
        super.load()
        NSLog("🛡️ ContentModerationPlugin loaded successfully!")
        
        // Configure WebView for content moderation
        if let webView = bridge?.webView {
            ContentModerationConfig.configureWebViewForContentModeration(webView)
        }
        
        setupMemoryMonitoring()
    }
    
    // MARK: - Device Capabilities
    
    @objc func getDeviceCapabilities(_ call: CAPPluginCall) {
        NSLog("🛡️ ContentModeration: Getting device capabilities")
        
        let processInfo = ProcessInfo.processInfo
        
        // Determine WebGL support
        let supportsWebGL = checkWebGLSupport()
        
        // Get iOS version details
        let iOSVersion = processInfo.operatingSystemVersion
        let iOSVersionString = "\(iOSVersion.majorVersion).\(iOSVersion.minorVersion).\(iOSVersion.patchVersion)"
        
        // Performance estimation
        let performanceClass = estimatePerformanceClass()
        let expectedModerationTime = estimatedModerationTime(for: performanceClass)
        
        let capabilities: [String: Any] = [
            "deviceModel": getDeviceModel(),
            "iOSVersion": iOSVersionString,
            "supportsWebGL": supportsWebGL,
            "supportsMetalAcceleration": supportsWebGL && iOSVersion.majorVersion >= 14,
            "performanceClass": performanceClass,
            "estimatedModerationTimeMs": expectedModerationTime,
            "recommendedConcurrency": getRecommendedConcurrency(for: performanceClass),
            "memoryInfo": ContentModerationConfig.checkMemoryAvailability(),
            "tensorFlowJSCompatible": iOSVersion.majorVersion >= 13,
            "optimalExperience": iOSVersion.majorVersion >= 14
        ]
        
        NSLog("🛡️ ContentModeration: Device class: \(performanceClass), WebGL: \(supportsWebGL)")
        call.resolve(capabilities)
    }
    
    // MARK: - Memory Management
    
    @objc func checkMemoryStatus(_ call: CAPPluginCall) {
        let memoryInfo = ContentModerationConfig.checkMemoryAvailability()
        call.resolve(memoryInfo)
    }
    
    @objc func handleMemoryWarning(_ call: CAPPluginCall) {
        NSLog("⚠️ ContentModeration: Handling memory warning from JavaScript")
        
        // Clear any cached data
        URLCache.shared.removeAllCachedResponses()
        
        // Suggest garbage collection to JavaScript
        bridge?.webView?.evaluateJavaScript("""
            if (window.gc) {
                window.gc();
            }
            if (window.tf && window.tf.disposeVariables) {
                window.tf.disposeVariables();
            }
        """)
        
        call.resolve([
            "handled": true,
            "timestamp": Date().timeIntervalSince1970,
            "availableMemory": ContentModerationConfig.checkMemoryAvailability()["freeMemoryMB"] as Any
        ])
    }
    
    // MARK: - Performance Optimization
    
    @objc func optimizeForModeration(_ call: CAPPluginCall) {
        NSLog("🛡️ ContentModeration: Optimizing device for content moderation")
        
        guard !isOptimized else {
            call.resolve(["alreadyOptimized": true])
            return
        }
        
        // Disable unnecessary background processes
        if #available(iOS 13.0, *) {
            // Request high performance mode
            ProcessInfo.processInfo.performActivity(options: .userInitiated, reason: "Content Moderation") { 
                // Activity block for high performance
            }
        }
        
        // Clear memory
        URLCache.shared.removeAllCachedResponses()
        
        isOptimized = true
        
        call.resolve([
            "optimized": true,
            "timestamp": Date().timeIntervalSince1970,
            "performanceMode": "high"
        ])
    }
    
    @objc func getPerformanceProfile(_ call: CAPPluginCall) {
        let performanceClass = estimatePerformanceClass()
        let memoryInfo = ContentModerationConfig.checkMemoryAvailability()
        
        let profile: [String: Any] = [
            "deviceClass": performanceClass,
            "concurrentModerationLimit": getRecommendedConcurrency(for: performanceClass),
            "estimatedTimePerImageMs": estimatedModerationTime(for: performanceClass),
            "recommendedBatchSize": getRecommendedBatchSize(for: performanceClass),
            "memoryStatus": memoryInfo["recommendedForModeration"] as! Bool ? "adequate" : "limited",
            "optimizationSuggestions": getOptimizationSuggestions(for: performanceClass)
        ]
        
        call.resolve(profile)
    }
    
    // MARK: - Model Preloading
    
    @objc func preloadModel(_ call: CAPPluginCall) {
        NSLog("🛡️ ContentModeration: Preloading NSFWJS model")
        
        let modelUrl = call.getString("modelUrl") ?? "https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/model/"
        
        bridge?.webView?.evaluateJavaScript("""
            (async function() {
                try {
                    console.log('🛡️ Starting model preload...');
                    
                    if (!window.tf) {
                        await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');
                    }
                    
                    if (!window.nsfwjs) {
                        await import('https://cdn.jsdelivr.net/npm/nsfwjs@2.4.2/dist/nsfwjs.min.js');
                    }
                    
                    const model = await nsfwjs.load('\(modelUrl)');
                    window._nsfwModel = model;
                    
                    console.log('✅ NSFWJS model preloaded successfully');
                    console.log('🤖 TensorFlow.js backend:', tf.getBackend());
                    
                    return {
                        success: true,
                        backend: tf.getBackend(),
                        modelLoaded: true,
                        loadTime: Date.now()
                    };
                } catch (error) {
                    console.error('❌ Model preload failed:', error);
                    return {
                        success: false,
                        error: error.message
                    };
                }
            })();
        """) { result, error in
            if let error = error {
                NSLog("❌ ContentModeration: Model preload failed: \(error)")
                call.reject("Model preload failed", "MODEL_LOAD_ERROR", error)
            } else if let resultDict = result as? [String: Any] {
                NSLog("✅ ContentModeration: Model preload completed")
                call.resolve(resultDict)
            } else {
                call.resolve(["success": false, "error": "Unknown result"])
            }
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func setupMemoryMonitoring() {
        // Monitor memory warnings
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleSystemMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        
        // Periodic memory monitoring
        memoryMonitorTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            self?.checkAndReportMemoryStatus()
        }
    }
    
    @objc private func handleSystemMemoryWarning() {
        NSLog("⚠️ ContentModeration: System memory warning received")
        
        // Notify JavaScript about memory warning
        notifyListeners("memoryWarning", data: [
            "timestamp": Date().timeIntervalSince1970,
            "availableMemory": ContentModerationConfig.checkMemoryAvailability()
        ])
    }
    
    private func checkAndReportMemoryStatus() {
        let memoryInfo = ContentModerationConfig.checkMemoryAvailability()
        let freeMemoryMB = memoryInfo["freeMemoryMB"] as! Int
        
        if freeMemoryMB < 150 { // Less than 150MB
            notifyListeners("lowMemory", data: memoryInfo)
        }
    }
    
    private func checkWebGLSupport() -> Bool {
        // WebGL support in WKWebView is device and iOS version dependent
        let iOSVersion = ProcessInfo.processInfo.operatingSystemVersion
        
        if #available(iOS 14.0, *) {
            // iOS 14+ has better WebGL support, but not guaranteed on all devices
            return true
        } else if #available(iOS 13.0, *) {
            // iOS 13 has limited WebGL support
            return false
        } else {
            // iOS 12 and below - no reliable WebGL support
            return false
        }
    }
    
    private func getDeviceModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)) ?? UnicodeScalar(63)!) // 63 = '?'
        }
        return identifier
    }
    
    private func estimatePerformanceClass() -> String {
        let device = UIDevice.current.model
        let iOSVersion = ProcessInfo.processInfo.operatingSystemVersion
        
        if device.contains("iPad") {
            if iOSVersion.majorVersion >= 15 {
                return "high" // iPad Pro/Air with M1/M2
            } else {
                return "medium"
            }
        } else {
            // iPhone
            if iOSVersion.majorVersion >= 15 {
                return "high" // iPhone 13+
            } else if iOSVersion.majorVersion >= 14 {
                return "medium" // iPhone 11-12
            } else {
                return "low" // iPhone SE, older models
            }
        }
    }
    
    private func estimatedModerationTime(for performanceClass: String) -> Int {
        switch performanceClass {
        case "high":
            return 650 // ~650ms for high-end devices
        case "medium":
            return 1000 // ~1000ms for mid-range devices
        case "low":
            return 1750 // ~1750ms for older devices
        default:
            return 1200
        }
    }
    
    private func getRecommendedConcurrency(for performanceClass: String) -> Int {
        switch performanceClass {
        case "high":
            return 2 // Can handle 2 concurrent moderations
        case "medium":
            return 1 // Stick to 1 at a time
        case "low":
            return 1 // Definitely 1 at a time
        default:
            return 1
        }
    }
    
    private func getRecommendedBatchSize(for performanceClass: String) -> Int {
        switch performanceClass {
        case "high":
            return 5
        case "medium":
            return 3
        case "low":
            return 1
        default:
            return 2
        }
    }
    
    private func getOptimizationSuggestions(for performanceClass: String) -> [String] {
        var suggestions: [String] = []
        
        if performanceClass == "low" {
            suggestions.append("Consider showing progress indicators for moderation")
            suggestions.append("Process images one at a time")
            suggestions.append("Allow background processing cancellation")
        }
        
        if performanceClass == "medium" {
            suggestions.append("Use batch processing for multiple photos")
            suggestions.append("Preload model when entering event")
        }
        
        if performanceClass == "high" {
            suggestions.append("Enable concurrent moderation")
            suggestions.append("Consider background processing")
        }
        
        return suggestions
    }
    
    deinit {
        memoryMonitorTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}