import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        print("📱 ViewController: capacitorDidLoad called")
        print("📱 Manually registering CustomCameraPlugin to override standard CameraPreview plugin...")
        
        // CRITICAL: Register our custom plugin AFTER super.capacitorDidLoad() 
        // so it overrides any automatically registered plugins
        
        // Standard Camera plugin will be auto-registered via packageClassList
        
        // Create and register AppPermissionPlugin instance  
        let appPermissionPlugin = AppPermissionPlugin()
        bridge?.registerPluginInstance(appPermissionPlugin)
        
        print("✅ AppPermissionPlugin registered manually in bridge")
        
        // Verify the standard Camera plugin is available
        if let registeredPlugin = bridge?.plugin(withName: "Camera") {
            print("✅ Camera plugin registered as: \(type(of: registeredPlugin))")
        } else {
            print("❌ Camera plugin not found after registration")
        }
    }
}