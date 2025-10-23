import Foundation
import Capacitor
import WebKit

@objc(PerformanceMonitorPlugin)
public class PerformanceMonitorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PerformanceMonitorPlugin"
    public let jsName = "PerformanceMonitor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getMetrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mark", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearMetrics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startMonitoring", returnType: CAPPluginReturnPromise)
    ]
    
    // Static timestamps that can be set from AppDelegate
    @objc public static var APP_START_TIME: TimeInterval = 0
    @objc public static var APP_DELEGATE_INIT_START: TimeInterval = 0
    @objc public static var APP_DELEGATE_INIT_END: TimeInterval = 0
    @objc public static var WEBVIEW_INIT_START: TimeInterval = 0
    @objc public static var WEBVIEW_INIT_END: TimeInterval = 0
    @objc public static var PLUGINS_REGISTERED: TimeInterval = 0
    
    // Runtime metrics
    private var customMarks: [String: TimeInterval] = [:]
    private var navigationStartTime: TimeInterval = 0
    
    // Set app start time as early as possible
    override public func load() {
        print("📊 PerformanceMonitor plugin loaded")
        
        // Inject performance monitoring JavaScript
        injectPerformanceMonitoring()
    }
    
    @objc func getMetrics(_ call: CAPPluginCall) {
        var metrics: [String: Any] = [:]
        
        // Debug log all static values
        print("📊 [getMetrics] APP_START_TIME: \(PerformanceMonitorPlugin.APP_START_TIME)")
        print("📊 [getMetrics] APP_DELEGATE_INIT_START: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_START)")
        print("📊 [getMetrics] APP_DELEGATE_INIT_END: \(PerformanceMonitorPlugin.APP_DELEGATE_INIT_END)")
        print("📊 [getMetrics] PLUGINS_REGISTERED: \(PerformanceMonitorPlugin.PLUGINS_REGISTERED)")
        
        // Native initialization metrics (in milliseconds)
        var nativeMetrics: [String: Any] = [:]
        
        // Use APP_DELEGATE_INIT_START as the base if APP_START_TIME is 0
        let baseTime = PerformanceMonitorPlugin.APP_START_TIME > 0 ? PerformanceMonitorPlugin.APP_START_TIME : PerformanceMonitorPlugin.APP_DELEGATE_INIT_START
        
        if baseTime > 0 {
            // For iOS, we're using systemUptime which is already in seconds, multiply by 1000 for ms
            nativeMetrics["appColdStart"] = baseTime * 1000
            
            if PerformanceMonitorPlugin.APP_DELEGATE_INIT_START > 0 {
                let nativeInitMs = (PerformanceMonitorPlugin.APP_DELEGATE_INIT_START - baseTime) * 1000
                nativeMetrics["nativeInitTime"] = nativeInitMs
            }
            
            if PerformanceMonitorPlugin.APP_DELEGATE_INIT_END > 0 && PerformanceMonitorPlugin.APP_DELEGATE_INIT_START > 0 {
                let appDelegateMs = (PerformanceMonitorPlugin.APP_DELEGATE_INIT_END - PerformanceMonitorPlugin.APP_DELEGATE_INIT_START) * 1000
                nativeMetrics["appDelegateInitTime"] = appDelegateMs
            }
            
            if PerformanceMonitorPlugin.WEBVIEW_INIT_END > 0 && PerformanceMonitorPlugin.WEBVIEW_INIT_START > 0 {
                let webViewMs = (PerformanceMonitorPlugin.WEBVIEW_INIT_END - PerformanceMonitorPlugin.WEBVIEW_INIT_START) * 1000
                nativeMetrics["webViewInitTime"] = webViewMs
            }
            
            if PerformanceMonitorPlugin.PLUGINS_REGISTERED > 0 && PerformanceMonitorPlugin.APP_DELEGATE_INIT_START > 0 {
                let pluginMs = (PerformanceMonitorPlugin.PLUGINS_REGISTERED - PerformanceMonitorPlugin.APP_DELEGATE_INIT_START) * 1000
                nativeMetrics["pluginRegistrationTime"] = pluginMs
            }
            
            // Total time from app start to end of AppDelegate (since we don't have WebView timing yet)
            if PerformanceMonitorPlugin.APP_DELEGATE_INIT_END > 0 {
                let totalMs = (PerformanceMonitorPlugin.APP_DELEGATE_INIT_END - baseTime) * 1000
                nativeMetrics["totalNativeInitTime"] = totalMs
            }
        }
        
        metrics["native"] = nativeMetrics
        
        // Get web performance metrics via JavaScript
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript("""
                JSON.stringify({
                    navigation: performance.getEntriesByType('navigation')[0] || {},
                    paint: performance.getEntriesByType('paint'),
                    marks: performance.getEntriesByType('mark'),
                    measures: performance.getEntriesByType('measure'),
                    resources: performance.getEntriesByType('resource').slice(0, 10).map(r => ({
                        name: r.name.substring(r.name.lastIndexOf('/') + 1),
                        duration: Math.round(r.duration),
                        size: r.transferSize
                    })),
                    memory: performance.memory || {},
                    timing: {
                        domContentLoaded: performance.timing ? performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart : 0,
                        loadComplete: performance.timing ? performance.timing.loadEventEnd - performance.timing.navigationStart : 0
                    }
                })
            """) { result, error in
                if let result = result as? String,
                   let data = result.data(using: .utf8),
                   let webMetrics = try? JSONSerialization.jsonObject(with: data, options: []) {
                    metrics["web"] = webMetrics
                }
                
                // Add custom marks
                if let marks = self?.customMarks, !marks.isEmpty {
                    metrics["customMarks"] = marks
                }
                
                // Calculate summary metrics
                if let summary = self?.calculateSummaryMetrics(nativeMetrics: nativeMetrics, webMetrics: metrics["web"] as? [String: Any]) {
                    metrics["summary"] = summary
                }
                
                print("📊 Performance metrics collected: \(metrics)")
                call.resolve(metrics)
            }
        }
    }
    
    @objc func mark(_ call: CAPPluginCall) {
        guard let name = call.getString("name") else {
            call.reject("Mark name is required")
            return
        }
        
        let timestamp = ProcessInfo.processInfo.systemUptime
        customMarks[name] = timestamp
        
        print("📊 Performance mark: \(name) at \(timestamp)")
        
        call.resolve([
            "name": name,
            "timestamp": timestamp * 1000 // Convert to milliseconds
        ])
    }
    
    @objc func clearMetrics(_ call: CAPPluginCall) {
        customMarks.removeAll()
        navigationStartTime = 0
        
        // Clear web performance data
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript(
                "performance.clearMarks(); performance.clearMeasures(); performance.clearResourceTimings();",
                completionHandler: nil
            )
        }
        
        print("📊 Performance metrics cleared")
        call.resolve()
    }
    
    @objc func startMonitoring(_ call: CAPPluginCall) {
        navigationStartTime = ProcessInfo.processInfo.systemUptime
        print("📊 Performance monitoring started at \(navigationStartTime)")
        call.resolve()
    }
    
    private func injectPerformanceMonitoring() {
        DispatchQueue.main.async { [weak self] in
            let script = """
            (function() {
                if (window.__performanceMonitorInjected) return;
                window.__performanceMonitorInjected = true;
                
                // Mark key events
                const originalAddEventListener = window.addEventListener;
                window.addEventListener = function(type, listener, options) {
                    if (type === 'DOMContentLoaded') {
                        const wrappedListener = function(e) {
                            performance.mark('DOMContentLoaded');
                            console.log('📊 Performance mark: DOMContentLoaded');
                            listener.call(this, e);
                        };
                        return originalAddEventListener.call(this, type, wrappedListener, options);
                    }
                    if (type === 'load') {
                        const wrappedListener = function(e) {
                            performance.mark('WindowLoad');
                            console.log('📊 Performance mark: WindowLoad');
                            listener.call(this, e);
                        };
                        return originalAddEventListener.call(this, type, wrappedListener, options);
                    }
                    return originalAddEventListener.call(this, type, listener, options);
                };
                
                // Auto-mark when Capacitor is ready
                if (window.Capacitor) {
                    performance.mark('CapacitorReady');
                    console.log('📊 Performance mark: CapacitorReady');
                }
                
                console.log('📊 Performance monitoring injected');
            })();
            """
            
            self?.bridge?.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }
    
    private func calculateSummaryMetrics(nativeMetrics: [String: Any], webMetrics: [String: Any]?) -> [String: Any] {
        var summary: [String: Any] = [:]
        
        // Time to interactive (native init + DOM ready)
        if let totalNativeTime = nativeMetrics["totalNativeInitTime"] as? Double {
            summary["coldStartTime"] = totalNativeTime
            
            if let webMetrics = webMetrics,
               let timing = webMetrics["timing"] as? [String: Any],
               let domReady = timing["domContentLoaded"] as? Double,
               let pageLoad = timing["loadComplete"] as? Double {
                
                summary["timeToInteractive"] = totalNativeTime + domReady
                summary["totalLoadTime"] = totalNativeTime + pageLoad
                summary["webLoadTime"] = pageLoad
            }
            
            // Add readable summary
            if let tti = summary["timeToInteractive"] as? Double {
                summary["timeToInteractiveSeconds"] = String(format: "%.1fs", tti / 1000.0)
            }
        }
        
        return summary
    }
}

// Extension to capture app launch time as early as possible
extension UIApplication {
    private static let performanceMonitorInit: Void = {
        // Capture app start time when UIApplication class is loaded
        PerformanceMonitorPlugin.APP_START_TIME = ProcessInfo.processInfo.systemUptime
        print("📊 App start time captured: \(PerformanceMonitorPlugin.APP_START_TIME)")
    }()
    
    open override var next: UIResponder? {
        // Force initialization
        _ = UIApplication.performanceMonitorInit
        return super.next
    }
}