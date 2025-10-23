import Foundation
import Capacitor
import UIKit

/**
 * CustomCameraPlugin - Extends standard Camera plugin to integrate PhotoEditor
 * Intercepts camera photo results and launches PhotoEditor directly
 */
@objc(CustomCameraPlugin)
public class CustomCameraPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "Camera"  // Override standard Camera plugin
    public let jsName = "Camera"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "limitedLibraryTimeout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise)
    ]
    
    private var originalCall: CAPPluginCall?
    private var cameraImplementation: CameraImplementation?
    private var loadingViewController: UIViewController?
    private var currentCropType: String?
    
    public override func load() {
        super.load()
        
        print("🎥 🚀 CustomCameraPlugin.load() called!")
        print("🎥 Plugin ID: \(self.identifier)")
        print("🎥 JS Name: \(self.jsName)")
        
        // Create our camera implementation
        cameraImplementation = CameraImplementation(plugin: self, config: CameraConfig())
        
        print("🎥 ✅ CustomCameraPlugin loaded - Camera → PhotoEditor integration active")
    }
    
    // MARK: - Camera Plugin Methods
    
    @objc public func getPhoto(_ call: CAPPluginCall) {
        print("🚨 ==================== CustomCameraPlugin.getPhoto CALLED ====================")
        print("🎥 Raw call.options: \(call.options)")
        
        // Log all possible parameter keys we're looking for
        let allKeys = call.options.keys.compactMap { "\($0)" }.sorted()
        print("🔍 ALL PARAMETER KEYS: \(allKeys)")
        
        // Store the original call to complete later
        originalCall = call
        
        // Get camera configuration from the call
        let config = CameraConfig(call)
        print("🎥 Parsed CameraConfig:")
        print("   - Source: \(config.source)")
        print("   - Quality: \(config.quality)")
        
        // Check ALL possible crop-related parameters with detailed logging
        let cropType = call.getString("cropType")
        let usePhotoCropper = call.getBool("usePhotoCropper")
        let purpose = call.getString("purpose")
        let allowEditing = call.getBool("allowEditing")
        let maxWidth = call.getInt("maxWidth")
        let maxHeight = call.getInt("maxHeight")
        
        print("🔍 CROP PARAMETERS:")
        print("   - cropType: '\(cropType ?? "nil")'")
        print("   - usePhotoCropper: \(usePhotoCropper ?? false)")
        print("   - purpose: '\(purpose ?? "nil")'")
        print("   - allowEditing: \(allowEditing ?? false)")
        print("   - maxWidth: \(maxWidth ?? -1)")
        print("   - maxHeight: \(maxHeight ?? -1)")
        
        // Check source detection
        print("🔍 SOURCE DETECTION:")
        print("   - config.source == CameraSource.photos: \(config.source == CameraSource.photos)")
        print("   - config.source raw value: \(config.source.rawValue)")
        print("   - CameraSource.photos raw value: \(CameraSource.photos.rawValue)")
        
        // Route based on purpose parameter from web app
        if config.source == CameraSource.photos {
            print("✅ Photo library source detected!")
            
            if let purposeValue = purpose, !purposeValue.isEmpty {
                print("✅ Purpose parameter found: '\(purposeValue)'")
                
                if purposeValue == "header" {
                    print("🎯 ROUTING TO HEADER CROP EDITOR")
                    performPhotoPickerWithCropper(call, cropType: "header")
                    return
                } else if purposeValue == "qr" {
                    print("🎯 ROUTING TO QR CROP EDITOR")
                    performPhotoPickerWithCropper(call, cropType: "qr")
                    return
                } else {
                    print("⚠️ Unknown purpose value: '\(purposeValue)'")
                }
            } else {
                print("❌ No purpose parameter found or it's empty")
                
                // Try to detect crop type from prompt labels (fallback)
                let promptLabelHeader = call.getString("promptLabelHeader") ?? ""
                let promptLabelPhoto = call.getString("promptLabelPhoto") ?? ""
                let promptLabelPicture = call.getString("promptLabelPicture") ?? ""
                
                print("🔍 FALLBACK: Checking prompt labels for crop hints:")
                print("   - promptLabelHeader: '\(promptLabelHeader)'")
                print("   - promptLabelPhoto: '\(promptLabelPhoto)'") 
                print("   - promptLabelPicture: '\(promptLabelPicture)'")
                
                var detectedCropType: String?
                
                // Look for header/banner indicators
                if promptLabelHeader.lowercased().contains("header") ||
                   promptLabelPhoto.lowercased().contains("header") ||
                   promptLabelPicture.lowercased().contains("header") ||
                   promptLabelHeader.lowercased().contains("banner") {
                    detectedCropType = "header"
                }
                // Look for QR code indicators  
                else if promptLabelHeader.lowercased().contains("qr") ||
                        promptLabelPhoto.lowercased().contains("qr") ||
                        promptLabelPicture.lowercased().contains("qr") ||
                        promptLabelHeader.lowercased().contains("code") {
                    detectedCropType = "qr"
                }
                
                if let cropTypeFromPrompts = detectedCropType {
                    print("🎯 FALLBACK: Detected crop type from prompts: '\(cropTypeFromPrompts)'")
                    performPhotoPickerWithCropper(call, cropType: cropTypeFromPrompts)
                    return
                } else {
                    print("❌ FALLBACK: No crop type detected from prompts")
                }
            }
            
            // Fallback to original crop parameters
            if let usePhotoCropperValue = usePhotoCropper, usePhotoCropperValue,
               let cropTypeValue = cropType, !cropTypeValue.isEmpty {
                print("🎯 FALLBACK: Using legacy crop parameters for: \(cropTypeValue)")
                performPhotoPickerWithCropper(call, cropType: cropTypeValue)
                return
            } else {
                print("❌ No legacy crop parameters found")
            }
        } else {
            print("❌ NOT photo library source - config.source: \(config.source)")
        }
        
        // Check if we should use photo editing (could add option to disable)
        let usePhotoEditor = call.getBool("usePhotoEditor", true) // Default to true
        print("🎥 Use photo editor: \(usePhotoEditor)")
        
        if !usePhotoEditor {
            // If photo editor is disabled, use standard camera behavior
            print("🎯 ROUTING TO STANDARD CAMERA (no photo editor)")
            performStandardCamera(call, config: config)
            return
        }
        
        // Use our custom implementation with PhotoEditor integration
        print("🎯 ROUTING TO PHOTO EDITOR (stickers/text)")
        performCameraWithPhotoEditor(call, config: config)
    }
    
    @objc public func pickImages(_ call: CAPPluginCall) {
        print("🎥 CustomCameraPlugin: pickImages called - checking for crop requirements")
        print("🎥 Call options: \(call.options)")
        
        // Check if this is a crop-specific request
        let cropType = call.getString("cropType") ?? ""
        let usePhotoCropper = call.getBool("usePhotoCropper", false)
        
        if usePhotoCropper && !cropType.isEmpty {
            print("🎥 Using photo cropper for type: \(cropType)")
            performPhotoPickerWithCropper(call, cropType: cropType)
        } else {
            // Standard implementation for regular photo picking
            print("🎥 Using standard photo picker (no cropper)")
            cameraImplementation?.pickImages(call)
        }
    }
    
    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        // Basic permission implementation
        call.resolve(["camera": "granted", "photos": "granted"])
    }
    
    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        // Basic permission check
        call.resolve(["camera": "granted", "photos": "granted"])
    }
    
    @objc public func limitedLibraryTimeout(_ call: CAPPluginCall) {
        call.resolve()
    }
    
    // MARK: - Custom Implementation
    
    private func performStandardCamera(_ call: CAPPluginCall, config: CameraConfig) {
        // Standard camera behavior without PhotoEditor
        cameraImplementation?.getPhoto(call)
    }
    
    private func performCameraWithPhotoEditor(_ call: CAPPluginCall, config: CameraConfig) {
        print("🎥 Launching camera with PhotoEditor integration...")
        print("🎥 Config - Source: \(config.source), Quality: \(config.quality)")
        
        DispatchQueue.main.async { [weak self] in
            print("🎥 On main thread, presenting camera...")
            self?.presentCameraWithPhotoEditorFlow(call, config: config)
        }
    }
    
    private func presentCameraWithPhotoEditorFlow(_ call: CAPPluginCall, config: CameraConfig) {
        print("🎥 presentCameraWithPhotoEditorFlow called")
        
        guard let viewController = bridge?.viewController else {
            print("❌ No view controller available")
            call.reject("No view controller available")
            return
        }
        print("✅ View controller available")
        
        let imagePickerController = UIImagePickerController()
        imagePickerController.delegate = self
        print("✅ Image picker controller created")
        
        // Configure image picker based on source
        let source = CameraSource(rawValue: config.source.rawValue) ?? CameraSource.camera
        print("🎥 Using source: \(source)")
        
        switch source {
        case .camera:
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                imagePickerController.sourceType = .camera
                imagePickerController.cameraCaptureMode = .photo
                print("✅ Camera source configured")
            } else {
                print("❌ Camera not available on this device")
                call.reject("Camera not available")
                return
            }
        case .photos:
            imagePickerController.sourceType = .photoLibrary
            print("✅ Photo library source configured")
        }
        
        // Set quality and other options
        imagePickerController.allowsEditing = false // We'll do editing in PhotoEditor
        
        if #available(iOS 11.0, *) {
            imagePickerController.imageExportPreset = .compatible
        }
        
        print("🎥 Presenting camera/photo picker...")
        viewController.present(imagePickerController, animated: true)
    }
    
    private func performPhotoPickerWithCropper(_ call: CAPPluginCall, cropType: String) {
        print("🚨 ==================== performPhotoPickerWithCropper CALLED ====================")
        print("🎥 Crop type: '\(cropType)'")
        print("🎥 Call options: \(call.options)")
        
        DispatchQueue.main.async { [weak self] in
            print("🎥 On main thread, presenting crop editor...")
            self?.presentPhotoPickerWithCropEditor(call, cropType: cropType)
        }
    }
    
    private func presentPhotoPickerWithCropEditor(_ call: CAPPluginCall, cropType: String) {
        print("🎥 presentPhotoPickerWithCropEditor called for: \(cropType)")
        
        guard let viewController = bridge?.viewController else {
            print("❌ No view controller available")
            call.reject("No view controller available")
            return
        }
        print("✅ View controller available")
        
        let imagePickerController = UIImagePickerController()
        imagePickerController.delegate = self
        imagePickerController.sourceType = .photoLibrary
        imagePickerController.allowsEditing = false // We'll do custom cropping
        
        // Store crop type and call for later use
        currentCropType = cropType
        originalCall = call
        
        print("🎥 Presenting photo picker for cropping...")
        viewController.present(imagePickerController, animated: true)
    }
}

// MARK: - UIImagePickerControllerDelegate

extension CustomCameraPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
        picker.dismiss(animated: true) { [weak self] in
            self?.handleImagePickerResult(info: info)
        }
    }
    
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true) { [weak self] in
            self?.originalCall?.reject("User cancelled camera")
            self?.originalCall = nil
        }
    }
    
    private func handleImagePickerResult(info: [UIImagePickerController.InfoKey : Any]) {
        guard let originalCall = self.originalCall else {
            print("❌ No original call available")
            return
        }
        
        guard let image = info[.originalImage] as? UIImage else {
            originalCall.reject("Failed to get image from camera")
            self.originalCall = nil
            return
        }
        
        print("🎥 ✅ Image selected successfully")
        
        // Check if this is a crop flow
        if let cropType = currentCropType {
            print("🎨 Launching Crop Editor for: \(cropType)")
            launchCropEditorDirectly(image: image, cropType: cropType, originalCall: originalCall)
            currentCropType = nil // Clear after use
        } else {
            print("🎨 Showing loading screen before PhotoEditor...")
            
            // Show loading screen immediately after camera capture
            showLoadingScreen()
            
            // Save the image temporarily so PhotoEditor can access it
            let tempImagePath = saveImageTemporarily(image)
            
            if let imagePath = tempImagePath {
                // Launch PhotoEditor directly with the captured image after brief delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    self?.launchPhotoEditorDirectly(imagePath: imagePath, originalCall: originalCall)
                }
            } else {
                // Fallback: hide loading and return original image if PhotoEditor fails
                hideLoadingScreen()
                returnImageResult(image: image, call: originalCall)
            }
        }
    }
    
    private func saveImageTemporarily(_ image: UIImage) -> String? {
        // Create unique filename
        let timestamp = Int(Date().timeIntervalSince1970)
        let filename = "camera_capture_\(timestamp).jpg"
        
        // Get temporary directory
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename)
        
        // Convert to JPEG data
        guard let imageData = image.jpegData(compressionQuality: 0.9) else {
            print("❌ Failed to convert image to JPEG data")
            return nil
        }
        
        // Write to file
        do {
            try imageData.write(to: fileURL)
            print("✅ Camera image saved temporarily: \(fileURL.path)")
            return fileURL.path
        } catch {
            print("❌ Failed to write camera image to file: \(error)")
            return nil
        }
    }
    
    private func launchPhotoEditorDirectly(imagePath: String, originalCall: CAPPluginCall) {
        guard let viewController = bridge?.viewController else {
            print("❌ No view controller for PhotoEditor")
            returnOriginalImage(imagePath: imagePath, call: originalCall)
            return
        }
        
        // Load the image
        guard let image = UIImage(contentsOfFile: imagePath) else {
            print("❌ Failed to load image for PhotoEditor")
            originalCall.reject("Failed to load captured image")
            self.originalCall = nil
            return
        }
        
        print("🎨 Creating PhotoEditor with captured image...")
        
        // Create PhotoEditor directly
        let editorVC = PhotoEditorViewController(image: image, originalPath: imagePath)
        editorVC.completion = { [weak self] result in
            DispatchQueue.main.async {
                if let editedPath = result.editedPath {
                    print("✅ PhotoEditor completed with edited image: \(editedPath)")
                    self?.returnEditedImageResult(editedPath: editedPath, call: originalCall)
                } else {
                    print("⚠️ PhotoEditor cancelled - returning original image")
                    self?.returnOriginalImage(imagePath: imagePath, call: originalCall)
                }
                self?.originalCall = nil
            }
        }
        
        // Hide loading screen and present PhotoEditor full-screen
        hideLoadingScreen()
        editorVC.modalPresentationStyle = .fullScreen
        viewController.present(editorVC, animated: true) {
            print("✅ PhotoEditor presented successfully")
        }
    }
    
    private func returnEditedImageResult(editedPath: String, call: CAPPluginCall) {
        // Return the edited image as if it came directly from camera
        let webPath = "file://\(editedPath)"
        
        let result: [String: Any] = [
            "webPath": webPath,
            "format": "jpeg",
            "saved": true,
            "path": editedPath,
            "edited": true,  // Custom flag to indicate photo was edited
            "dataUrl": createDataUrl(from: editedPath) ?? ""
        ]
        
        print("🎥 ✅ Returning edited photo result to web layer")
        call.resolve(result)
    }
    
    private func returnOriginalImage(imagePath: String, call: CAPPluginCall) {
        guard let image = UIImage(contentsOfFile: imagePath) else {
            call.reject("Failed to load original image")
            return
        }
        
        returnImageResult(image: image, call: call)
    }
    
    private func returnImageResult(image: UIImage, call: CAPPluginCall) {
        // Save the image if needed and return standard camera result
        let timestamp = Int(Date().timeIntervalSince1970)
        let filename = "camera_result_\(timestamp).jpg"
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename)
        
        guard let imageData = image.jpegData(compressionQuality: 0.9) else {
            call.reject("Failed to process image")
            return
        }
        
        do {
            try imageData.write(to: fileURL)
            
            let webPath = "file://\(fileURL.path)"
            let result: [String: Any] = [
                "webPath": webPath,
                "format": "jpeg",
                "saved": true,
                "path": fileURL.path,
                "edited": false,
                "dataUrl": createDataUrl(from: fileURL.path) ?? ""
            ]
            
            print("🎥 ✅ Returning original photo result to web layer")
            call.resolve(result)
        } catch {
            call.reject("Failed to save image: \(error.localizedDescription)")
        }
    }
    
    private func launchCropEditorDirectly(image: UIImage, cropType: String, originalCall: CAPPluginCall) {
        guard let viewController = bridge?.viewController else {
            print("❌ No view controller for CropEditor")
            originalCall.reject("No view controller available")
            return
        }
        
        print("🎨 Creating CropEditor for type: \(cropType)")
        
        // Create CropEditor with specific dimensions
        let cropEditor = CropEditorViewController(image: image, cropType: cropType)
        cropEditor.completion = { [weak self] result in
            DispatchQueue.main.async {
                if let croppedImage = result.croppedImage {
                    print("✅ CropEditor completed with cropped image")
                    self?.returnCroppedImageResult(image: croppedImage, cropType: cropType, call: originalCall)
                } else {
                    print("⚠️ CropEditor cancelled")
                    originalCall.reject("User cancelled crop editor")
                }
                self?.originalCall = nil
            }
        }
        
        // Present CropEditor full-screen
        cropEditor.modalPresentationStyle = .fullScreen
        viewController.present(cropEditor, animated: true) {
            print("✅ CropEditor presented successfully")
        }
    }
    
    private func returnCroppedImageResult(image: UIImage, cropType: String, call: CAPPluginCall) {
        // Save cropped image
        let timestamp = Int(Date().timeIntervalSince1970)
        let filename = "cropped_\(cropType)_\(timestamp).jpg"
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename)
        
        guard let imageData = image.jpegData(compressionQuality: 0.9) else {
            call.reject("Failed to process cropped image")
            return
        }
        
        do {
            try imageData.write(to: fileURL)
            
            let webPath = "file://\(fileURL.path)"
            let dataUrl = createDataUrl(from: fileURL.path) ?? ""
            
            // Get original image dimensions (from call parameters if available)
            let originalWidth = call.getInt("originalWidth") ?? Int(image.size.width)
            let originalHeight = call.getInt("originalHeight") ?? Int(image.size.height)
            
            // Determine final dimensions based on crop type
            let finalDimensions = getFinalDimensions(for: cropType)
            
            // Create result with web app expected format
            let result: [String: Any] = [
                "success": true,
                "dataUrl": dataUrl,
                "format": "jpeg", 
                "webPath": webPath,
                "path": fileURL.path,
                "saved": true,
                "metadata": [
                    "purpose": cropType,
                    "wasEdited": true,
                    "originalDimensions": [
                        "width": originalWidth,
                        "height": originalHeight
                    ],
                    "editedDimensions": [
                        "width": finalDimensions.width,
                        "height": finalDimensions.height
                    ]
                ]
            ]
            
            print("🎨 ✅ Returning cropped image result with metadata to web layer")
            call.resolve(result)
        } catch {
            call.reject("Failed to save cropped image: \(error.localizedDescription)")
        }
    }
    
    private func getFinalDimensions(for cropType: String) -> (width: Int, height: Int) {
        switch cropType {
        case "header":
            return (width: 1920, height: 480)
        case "qr":
            return (width: 512, height: 512)
        default:
            return (width: 1024, height: 1024)
        }
    }
    
    private func createDataUrl(from path: String) -> String? {
        guard let imageData = NSData(contentsOfFile: path) else { return nil }
        let base64String = imageData.base64EncodedString()
        return "data:image/jpeg;base64,\(base64String)"
    }
    
    // MARK: - Loading Screen
    
    private func showLoadingScreen() {
        guard let viewController = bridge?.viewController else {
            print("❌ No view controller for loading screen")
            return
        }
        
        // Create loading view controller
        let loadingVC = UIViewController()
        loadingVC.view.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        loadingVC.modalPresentationStyle = .overFullScreen
        
        // Create loading indicator
        let activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.color = .white
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.startAnimating()
        
        // Create loading label
        let loadingLabel = UILabel()
        loadingLabel.text = "Loading Editor..."
        loadingLabel.textColor = .white
        loadingLabel.font = UIFont.outfitFont(ofSize: 18, weight: .medium)
        loadingLabel.textAlignment = .center
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // Add views
        loadingVC.view.addSubview(activityIndicator)
        loadingVC.view.addSubview(loadingLabel)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: loadingVC.view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: loadingVC.view.centerYAnchor, constant: -20),
            
            loadingLabel.centerXAnchor.constraint(equalTo: loadingVC.view.centerXAnchor),
            loadingLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16)
        ])
        
        // Store reference and present
        self.loadingViewController = loadingVC
        viewController.present(loadingVC, animated: false) {
            print("✅ Loading screen displayed")
        }
    }
    
    private func hideLoadingScreen() {
        guard let loadingVC = self.loadingViewController else {
            print("ℹ️ No loading screen to hide")
            return
        }
        
        loadingVC.dismiss(animated: false) {
            print("✅ Loading screen dismissed")
        }
        
        self.loadingViewController = nil
    }
}

// MARK: - Supporting Types

enum CameraSource: Int {
    case camera = 1
    case photos = 0
}

// Minimal camera config
struct CameraConfig {
    let source: CameraSource
    let quality: Int
    
    init(_ call: CAPPluginCall? = nil) {
        // Force camera source for direct camera access
        let sourceValue = call?.getString("source") ?? "CAMERA"
        self.source = sourceValue == "CAMERA" ? .camera : .photos
        self.quality = call?.getInt("quality") ?? 90
    }
}

// Placeholder for camera implementation (you could use the actual Capacitor implementation)
class CameraImplementation {
    weak var plugin: CAPPlugin?
    let config: CameraConfig
    
    init(plugin: CAPPlugin, config: CameraConfig) {
        self.plugin = plugin
        self.config = config
    }
    
    func getPhoto(_ call: CAPPluginCall) {
        // Standard camera implementation would go here
        call.unimplemented("Standard camera not implemented in custom plugin")
    }
    
    func pickImages(_ call: CAPPluginCall) {
        call.unimplemented("Pick images not implemented")
    }
    
    func requestPermissions(_ call: CAPPluginCall) {
        // Basic permission implementation
        call.resolve(["camera": "granted", "photos": "granted"])
    }
    
    func checkPermissions(_ call: CAPPluginCall) {
        // Basic permission check
        call.resolve(["camera": "granted", "photos": "granted"])
    }
    
    func limitedLibraryTimeout(_ call: CAPPluginCall) {
        call.resolve()
    }
}