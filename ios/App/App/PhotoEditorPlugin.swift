import Foundation
import Capacitor
import UIKit

/**
 * PhotoEditorPlugin - Custom Photo Editing Plugin for PhotoShare
 * Provides text/stickers/overlays for photos taken from Camera.getPhoto()
 */
@objc(PhotoEditorPlugin)
public class PhotoEditorPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "PhotoEditorPlugin"
    public let jsName = "PhotoEditorPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "editPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]
    
    override public func load() {
        super.load()
        print("🎨 PhotoEditorPlugin loaded successfully!")
        print("🎨 Plugin ID: \(self.pluginId)")
        print("🎨 Plugin available methods: editPhoto, isAvailable")
    }
    
    // MARK: - Plugin Methods
    
    @objc func editPhoto(_ call: CAPPluginCall) {
        print("🎨 ==================== PhotoEditorPlugin: editPhoto CALLED ====================")
        
        // Get the image path from the call
        let imagePath = call.getString("imagePath") ?? "No path provided"
        print("🎨 Image path received: \(imagePath)")
        
        DispatchQueue.main.async { [weak self] in
            self?.launchPhotoEditor(call: call, imagePath: imagePath)
        }
    }
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        print("🎨 PhotoEditorPlugin: isAvailable called")
        
        call.resolve([
            "available": true,
            "platform": "iOS",
            "version": "1.0.0",
            "features": [
                "text_overlay",
                "stickers", 
                "drawing",
                "filters"
            ]
        ])
    }
    
    // MARK: - UI Implementation
    
    
    private func launchPhotoEditor(call: CAPPluginCall, imagePath: String) {
        print("🎨 Launching photo editor interface...")
        
        // Extract file path from capacitor://localhost/_capacitor_file_/ URL
        let cleanPath = imagePath.replacingOccurrences(of: "capacitor://localhost/_capacitor_file_", with: "")
        print("🎨 Loading image from path: \(cleanPath)")
        
        // Load the image from file path
        guard let image = UIImage(contentsOfFile: cleanPath) else {
            print("❌ Failed to load image from path: \(cleanPath)")
            call.reject("Failed to load image from path")
            return
        }
        
        print("✅ Image loaded successfully: \(image.size)")
        
        // Get the view controller to present the editor
        guard let viewController = self.bridge?.viewController else {
            print("❌ No view controller available")
            call.reject("No view controller available")
            return
        }
        
        // Check if this is a crop mode request
        let mode = call.getString("mode") ?? "edit"
        let cropType = call.getString("cropType")
        
        if mode == "crop" && (cropType == "header" || cropType == "qr") {
            print("🎨 ✂️ Launching crop editor for \(cropType ?? "unknown") type")
            
            // Create and present the crop editor
            let cropVC = CropEditorViewController(image: image, cropType: cropType ?? "header")
            cropVC.completion = { result in
                DispatchQueue.main.async {
                    if let croppedImage = result.croppedImage {
                        // Save the cropped image
                        let timestamp = Int(Date().timeIntervalSince1970)
                        let filename = "\(cropType ?? "cropped")_\(timestamp).jpg"
                        let tempDir = FileManager.default.temporaryDirectory
                        let tempFile = tempDir.appendingPathComponent(filename)
                        
                        if let jpegData = croppedImage.jpegData(compressionQuality: 0.9) {
                            do {
                                try jpegData.write(to: tempFile)
                                let croppedPath = tempFile.path
                                
                                print("✅ Crop completed: \(croppedPath)")
                                call.resolve([
                                    "success": true,
                                    "message": "Image cropped successfully",
                                    "originalPath": imagePath,
                                    "editedPath": "file://\(croppedPath)",
                                    "cropType": cropType ?? "unknown",
                                    "wasCropped": true
                                ])
                            } catch {
                                print("❌ Failed to save cropped image: \(error)")
                                call.reject("Failed to save cropped image")
                            }
                        } else {
                            call.reject("Failed to convert cropped image to JPEG")
                        }
                    } else {
                        print("⚠️ Crop cancelled")
                        call.reject("Crop cancelled")
                    }
                }
            }
            
            // Present the crop editor
            cropVC.modalPresentationStyle = .fullScreen
            viewController.present(cropVC, animated: true) {
                print("✅ Crop editor presented")
            }
            
        } else {
            // Regular photo editor mode
            print("🎨 Launching full photo editor")
            
            // Create and present the photo editor
            let editorVC = PhotoEditorViewController(image: image, originalPath: cleanPath)
            editorVC.completion = { [weak self] result in
                DispatchQueue.main.async {
                    if let editedPath = result.editedPath {
                        print("✅ Photo editing completed: \(editedPath)")
                        call.resolve([
                            "success": true,
                            "message": "Photo edited successfully",
                            "originalPath": imagePath,
                            "editedPath": "file://\(editedPath)",
                            "changes": result.changes
                        ])
                    } else {
                        print("⚠️ Photo editing cancelled")
                        call.reject("Photo editing cancelled")
                    }
                }
            }
            
            // Present full-screen
            editorVC.modalPresentationStyle = .fullScreen
            viewController.present(editorVC, animated: true) {
                print("✅ Photo editor presented")
            }
        }
    }
}

// MARK: - Photo Editor View Controller

struct PhotoEditorResult {
    let editedPath: String?
    let changes: [String: Any]
}

class PhotoEditorViewController: UIViewController {
    
    private let originalImage: UIImage
    private let originalPath: String
    private var imageView: UIImageView!
    private var scrollView: UIScrollView!
    private var selectedTextLabel: EditableTextLabel?
    
    var completion: ((PhotoEditorResult) -> Void)?
    
    init(image: UIImage, originalPath: String) {
        self.originalImage = image
        self.originalPath = originalPath
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupGestures()
        print("🎨 PhotoEditorViewController loaded with image size: \(originalImage.size)")
    }
    
    private func setupUI() {
        view.backgroundColor = .black
        
        // Create scroll view for zooming
        scrollView = UIScrollView()
        scrollView.delegate = self
        scrollView.minimumZoomScale = 0.5
        scrollView.maximumZoomScale = 3.0
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        // Create image view
        imageView = UIImageView(image: originalImage)
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(imageView)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -80),
            
            imageView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            imageView.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
            imageView.widthAnchor.constraint(equalTo: view.widthAnchor),
            imageView.heightAnchor.constraint(lessThanOrEqualTo: view.heightAnchor, constant: -160)
        ])
        
        setupCloseButton()
        setupToolbar()
    }
    
    private func setupCloseButton() {
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .medium)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        closeButton.layer.cornerRadius = 20
        closeButton.frame = CGRect(x: 0, y: 0, width: 40, height: 40)
        closeButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(closeButton)
        
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 40),
            closeButton.heightAnchor.constraint(equalToConstant: 40)
        ])
    }
    
    private func setupToolbar() {
        // Create toolbar background with black styling to match web
        let toolbarView = UIView()
        toolbarView.backgroundColor = UIColor.black.withAlphaComponent(0.9)
        toolbarView.layer.cornerRadius = 12
        toolbarView.layer.shadowColor = UIColor.black.cgColor
        toolbarView.layer.shadowOffset = CGSize(width: 0, height: 1)
        toolbarView.layer.shadowRadius = 4
        toolbarView.layer.shadowOpacity = 0.3
        toolbarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbarView)
        
        // Create buttons with web-style outline styling (switched order: Sticker first, then Text)
        let addStickerButton = createWebStyleButton(title: "Add Sticker")
        addStickerButton.addTarget(self, action: #selector(addStickerTapped), for: .touchUpInside)
        
        let addTextButton = createWebStyleButton(title: "Add Text")
        addTextButton.addTarget(self, action: #selector(addTextTapped), for: .touchUpInside)
        
        let textOptionsButton = createWebStyleButton(title: "Text Style")
        textOptionsButton.addTarget(self, action: #selector(textOptionsTapped), for: .touchUpInside)
        
        let saveButton = createWebStyleButton(title: "Save Photo")
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        
        // Create horizontal scroll view for buttons
        let scrollView = UIScrollView()
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        toolbarView.addSubview(scrollView)
        
        // Create stack view (order: Sticker, Text, Style, Save)
        let stackView = UIStackView(arrangedSubviews: [addStickerButton, addTextButton, textOptionsButton, saveButton])
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = 12
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stackView)
        
        // Set button widths to ensure no text is cut off - using wider buttons for full text
        let buttonWidth: CGFloat = 120 // Increased from 110 to accommodate longer text
        addStickerButton.widthAnchor.constraint(equalToConstant: buttonWidth).isActive = true
        addTextButton.widthAnchor.constraint(equalToConstant: buttonWidth).isActive = true
        textOptionsButton.widthAnchor.constraint(equalToConstant: buttonWidth).isActive = true
        saveButton.widthAnchor.constraint(equalToConstant: buttonWidth).isActive = true
        
        // Ensure buttons maintain their height (h-12 = 48pt)
        addStickerButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        addTextButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        textOptionsButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        saveButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        
        // Setup toolbar constraints
        NSLayoutConstraint.activate([
            toolbarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            toolbarView.heightAnchor.constraint(equalToConstant: 80),
            
            // Scroll view constraints
            scrollView.leadingAnchor.constraint(equalTo: toolbarView.leadingAnchor, constant: 16),
            scrollView.trailingAnchor.constraint(equalTo: toolbarView.trailingAnchor, constant: -16),
            scrollView.topAnchor.constraint(equalTo: toolbarView.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: toolbarView.bottomAnchor),
            
            // Stack view constraints
            stackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: scrollView.topAnchor, constant: 12),
            stackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor, constant: -12),
            stackView.heightAnchor.constraint(equalTo: scrollView.heightAnchor, constant: -24)
        ])
    }
    
    enum PhotoShareButtonStyle {
        case primary
        case secondary  
        case accent
        case success
    }
    
    private func createPhotoShareButton(title: String, style: PhotoShareButtonStyle) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        button.layer.cornerRadius = 8 // 0.5rem from design system
        button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        
        // PhotoShare design system colors
        switch style {
        case .primary:
            // --primary: 218 70% 35% (Deep blue)
            button.backgroundColor = UIColor(hue: 218/360, saturation: 0.70, brightness: 0.65, alpha: 1.0)
            button.setTitleColor(.white, for: .normal)
            
        case .secondary:
            // --secondary: 210 40% 98% (Light gray background)
            button.backgroundColor = UIColor(hue: 210/360, saturation: 0.40, brightness: 0.98, alpha: 1.0)
            button.setTitleColor(UIColor(hue: 218/360, saturation: 0.70, brightness: 0.35, alpha: 1.0), for: .normal)
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor(hue: 214.3/360, saturation: 0.318, brightness: 0.914, alpha: 1.0).cgColor
            
        case .accent:
            // Orange accent from status colors
            button.backgroundColor = UIColor(red: 249/255, green: 115/255, blue: 22/255, alpha: 1.0)
            button.setTitleColor(.white, for: .normal)
            
        case .success:
            // Green from status colors
            button.backgroundColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0)
            button.setTitleColor(.white, for: .normal)
        }
        
        // Subtle shadow like design system
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 2
        button.layer.shadowOpacity = 0.05
        
        return button
    }
    
    private func createWebStyleButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        
        // Web-style outline button configuration
        button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .medium) // 0.875rem
        button.layer.cornerRadius = 6 // calc(var(--radius) - 2px)
        button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        
        // Outline variant styles - black background with white text and border
        button.backgroundColor = UIColor.black // hsl(var(--background))
        button.setTitleColor(.white, for: .normal) // White text for contrast
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor // Subtle white border
        
        // Hover/pressed state colors
        button.setTitleColor(UIColor.white.withAlphaComponent(0.8), for: .highlighted)
        
        // Focus ring setup (approximated with shadow)
        button.layer.shadowColor = UIColor.white.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 0)
        button.layer.shadowRadius = 0
        button.layer.shadowOpacity = 0
        
        // Add target for hover effect simulation
        button.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        
        return button
    }
    
    @objc private func buttonTouchDown(_ button: UIButton) {
        // Simulate hover:background-color: hsl(var(--accent))
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.white.withAlphaComponent(0.1) // Subtle highlight
        }
    }
    
    @objc private func buttonTouchUp(_ button: UIButton) {
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.black // Return to original
        }
    }
    
    private func setupGestures() {
        // Add tap gesture to image view for placing text
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(imageTapped(_:)))
        imageView.isUserInteractionEnabled = true
        imageView.addGestureRecognizer(tapGesture)
    }
    
    @objc private func imageTapped(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: imageView)
        print("🎨 Image tapped at point: \(point)")
        // This will be used for text placement later
    }
    
    @objc private func cancelTapped() {
        print("🎨 Photo editing cancelled")
        dismiss(animated: true) { [weak self] in
            self?.completion?(PhotoEditorResult(editedPath: nil, changes: [:]))
        }
    }
    
    @objc private func addTextTapped() {
        print("🎨 Add Text button tapped")
        
        let alert = UIAlertController(title: "Add Text", message: "Enter text to add to the photo", preferredStyle: .alert)
        
        alert.addTextField { textField in
            textField.placeholder = "Enter text here..."
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Add", style: .default) { [weak self] _ in
            if let text = alert.textFields?.first?.text, !text.isEmpty {
                self?.addTextToImage(text)
            }
        })
        
        present(alert, animated: true)
    }
    
    @objc private func addStickerTapped() {
        print("🎨 Add Sticker button tapped")
        presentStickerPicker()
    }
    
    @objc private func textOptionsTapped() {
        guard let selectedLabel = selectedTextLabel else {
            showAlert(title: "No Text Selected", message: "Please tap on a text element first to edit its style.")
            return
        }
        
        presentTextOptionsPanel(for: selectedLabel)
    }
    
    private func addTextToImage(_ text: String) {
        print("🎨 Adding text to image: \(text)")
        
        // Create an editable text label
        let label = EditableTextLabel()
        label.text = text
        label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        label.textColor = .white
        label.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        label.textAlignment = .center
        label.layer.cornerRadius = 8
        label.clipsToBounds = true
        label.isUserInteractionEnabled = true
        label.numberOfLines = 0
        
        // Properly size the label with a maximum width
        let maxWidth: CGFloat = 300
        let size = label.sizeThatFits(CGSize(width: maxWidth, height: .greatestFiniteMagnitude))
        label.frame.size = size
        
        // Position in center of image
        label.center = CGPoint(x: imageView.bounds.midX, y: imageView.bounds.midY)
        
        // Add gestures
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(textLabelPanned(_:)))
        label.addGestureRecognizer(panGesture)
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(textLabelTapped(_:)))
        label.addGestureRecognizer(tapGesture)
        
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(textLabelPinched(_:)))
        label.addGestureRecognizer(pinchGesture)
        
        // Add to image view
        imageView.addSubview(label)
        
        // Select this label
        selectTextLabel(label)
        
        print("✅ Text label added to image")
    }
    
    private func addStickerToImage(_ sticker: StickerItem) {
        print("🎨 Adding sticker to image: \(sticker.content)")
        
        let stickerView = EditableStickerView(sticker: sticker)
        stickerView.isUserInteractionEnabled = true
        
        // Position in center of image
        stickerView.center = CGPoint(x: imageView.bounds.midX, y: imageView.bounds.midY)
        
        // Add gestures
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(stickerPanned(_:)))
        stickerView.addGestureRecognizer(panGesture)
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(stickerTapped(_:)))
        stickerView.addGestureRecognizer(tapGesture)
        
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(stickerPinched(_:)))
        stickerView.addGestureRecognizer(pinchGesture)
        
        // Add to image view
        imageView.addSubview(stickerView)
        
        print("✅ Sticker added to image")
    }
    
    @objc private func textLabelPanned(_ gesture: UIPanGestureRecognizer) {
        guard let label = gesture.view as? EditableTextLabel else { return }
        
        let translation = gesture.translation(in: imageView)
        label.center = CGPoint(x: label.center.x + translation.x, y: label.center.y + translation.y)
        gesture.setTranslation(.zero, in: imageView)
        
        // Keep label within image bounds
        let labelFrame = label.frame
        let imageFrame = imageView.bounds
        
        if labelFrame.minX < imageFrame.minX {
            label.frame.origin.x = imageFrame.minX
        }
        if labelFrame.maxX > imageFrame.maxX {
            label.frame.origin.x = imageFrame.maxX - labelFrame.width
        }
        if labelFrame.minY < imageFrame.minY {
            label.frame.origin.y = imageFrame.minY
        }
        if labelFrame.maxY > imageFrame.maxY {
            label.frame.origin.y = imageFrame.maxY - labelFrame.height
        }
        
        // Select this label when moved
        selectTextLabel(label)
    }
    
    @objc private func textLabelTapped(_ gesture: UITapGestureRecognizer) {
        guard let label = gesture.view as? EditableTextLabel else { return }
        selectTextLabel(label)
        print("🎨 Text label selected: \(label.text ?? "")")
    }
    
    @objc private func textLabelPinched(_ gesture: UIPinchGestureRecognizer) {
        guard let label = gesture.view as? EditableTextLabel else { return }
        
        if gesture.state == .began || gesture.state == .changed {
            let scale = gesture.scale
            label.transform = label.transform.scaledBy(x: scale, y: scale)
            gesture.scale = 1.0
            
            // Select this label when resized
            selectTextLabel(label)
        }
    }
    
    @objc private func stickerPanned(_ gesture: UIPanGestureRecognizer) {
        guard let stickerView = gesture.view as? EditableStickerView else { return }
        
        let translation = gesture.translation(in: imageView)
        stickerView.center = CGPoint(x: stickerView.center.x + translation.x, y: stickerView.center.y + translation.y)
        gesture.setTranslation(.zero, in: imageView)
        
        // Keep sticker within image bounds
        let stickerFrame = stickerView.frame
        let imageFrame = imageView.bounds
        
        if stickerFrame.minX < imageFrame.minX {
            stickerView.frame.origin.x = imageFrame.minX
        }
        if stickerFrame.maxX > imageFrame.maxX {
            stickerView.frame.origin.x = imageFrame.maxX - stickerFrame.width
        }
        if stickerFrame.minY < imageFrame.minY {
            stickerView.frame.origin.y = imageFrame.minY
        }
        if stickerFrame.maxY > imageFrame.maxY {
            stickerView.frame.origin.y = imageFrame.maxY - stickerFrame.height
        }
    }
    
    @objc private func stickerTapped(_ gesture: UITapGestureRecognizer) {
        guard let stickerView = gesture.view as? EditableStickerView else { return }
        print("🎨 Sticker tapped: \(stickerView.sticker.content)")
        // Could add selection logic here later
    }
    
    @objc private func stickerPinched(_ gesture: UIPinchGestureRecognizer) {
        guard let stickerView = gesture.view as? EditableStickerView else { return }
        
        if gesture.state == .began || gesture.state == .changed {
            let scale = gesture.scale
            stickerView.transform = stickerView.transform.scaledBy(x: scale, y: scale)
            gesture.scale = 1.0
        }
    }
    
    private func selectTextLabel(_ label: EditableTextLabel) {
        // Deselect previous label
        selectedTextLabel?.isSelected = false
        
        // Select new label
        selectedTextLabel = label
        label.isSelected = true
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    private func presentStickerPicker() {
        let stickerVC = StickerPickerViewController()
        stickerVC.modalPresentationStyle = .pageSheet
        stickerVC.onStickerSelected = { [weak self] sticker in
            self?.addStickerToImage(sticker)
        }
        
        if #available(iOS 15.0, *) {
            if let sheet = stickerVC.sheetPresentationController {
                sheet.detents = [.medium(), .large()]
                sheet.prefersGrabberVisible = true
            }
        }
        
        present(stickerVC, animated: true)
    }
    
    private func presentTextOptionsPanel(for label: EditableTextLabel) {
        let optionsVC = TextOptionsViewController(textLabel: label)
        optionsVC.modalPresentationStyle = .pageSheet
        
        if #available(iOS 15.0, *) {
            if let sheet = optionsVC.sheetPresentationController {
                sheet.detents = [.medium()]
                sheet.prefersGrabberVisible = true
            }
        }
        
        present(optionsVC, animated: true)
    }
    
    @objc private func saveTapped() {
        print("🎨 Save button tapped - creating edited image")
        
        // Create edited image by rendering the image view with overlays
        let editedImage = createEditedImage()
        
        // Save the edited image
        guard let editedPath = saveEditedImage(editedImage) else {
            print("❌ Failed to save edited image")
            let alert = UIAlertController(title: "Error", message: "Failed to save edited image", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
            return
        }
        
        print("✅ Edited image saved to: \(editedPath)")
        
        // Check what changes were made
        let hasTextLabels = imageView.subviews.contains { $0 is EditableTextLabel }
        let hasStickers = imageView.subviews.contains { $0 is EditableStickerView }
        
        let changes: [String: Any] = [
            "text_added": hasTextLabels,
            "stickers_added": hasStickers,
            "drawn_on": false
        ]
        
        dismiss(animated: true) { [weak self] in
            self?.completion?(PhotoEditorResult(editedPath: editedPath, changes: changes))
        }
    }
    
    private func createEditedImage() -> UIImage {
        // Render the image view (including overlays) to an image
        let renderer = UIGraphicsImageRenderer(size: imageView.bounds.size)
        return renderer.image { context in
            imageView.layer.render(in: context.cgContext)
        }
    }
    
    private func saveEditedImage(_ image: UIImage) -> String? {
        // Create unique filename
        let timestamp = Int(Date().timeIntervalSince1970)
        let filename = "edited_photo_\(timestamp).jpg"
        
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
            print("✅ Image saved to: \(fileURL.path)")
            return fileURL.path
        } catch {
            print("❌ Failed to write image to file: \(error)")
            return nil
        }
    }
}

// MARK: - UIScrollViewDelegate

extension PhotoEditorViewController: UIScrollViewDelegate {
    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return imageView
    }
}

// MARK: - EditableTextLabel

class EditableTextLabel: UILabel {
    
    var isSelected: Bool = false {
        didSet {
            updateSelectionAppearance()
        }
    }
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupLabel()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLabel()
    }
    
    private func setupLabel() {
        layer.borderWidth = 0
        layer.borderColor = UIColor.systemBlue.cgColor
    }
    
    private func updateSelectionAppearance() {
        if isSelected {
            layer.borderWidth = 2.0
            layer.borderColor = UIColor.systemBlue.cgColor
        } else {
            layer.borderWidth = 0
        }
    }
    
    override func drawText(in rect: CGRect) {
        let insets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        super.drawText(in: rect.inset(by: insets))
    }
    
    override func sizeThatFits(_ size: CGSize) -> CGSize {
        let insets = UIEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        let textSize = super.sizeThatFits(CGSize(width: size.width - insets.left - insets.right, 
                                               height: size.height - insets.top - insets.bottom))
        return CGSize(width: textSize.width + insets.left + insets.right,
                     height: textSize.height + insets.top + insets.bottom)
    }
}

// MARK: - TextOptionsViewController

class TextOptionsViewController: UIViewController {
    
    private let textLabel: EditableTextLabel
    private var fontSizeSlider: UISlider!
    private var colorButtons: [UIButton] = []
    private var fontButtons: [UIButton] = []
    
    private let availableFonts = [
        ("System", UIFont.systemFont(ofSize: 24)),
        ("Bold", UIFont.boldSystemFont(ofSize: 24)),
        ("Italic", UIFont.italicSystemFont(ofSize: 24)),
        ("Helvetica", UIFont(name: "Helvetica", size: 24) ?? UIFont.systemFont(ofSize: 24)),
        ("Times", UIFont(name: "Times New Roman", size: 24) ?? UIFont.systemFont(ofSize: 24)),
        ("Courier", UIFont(name: "Courier", size: 24) ?? UIFont.systemFont(ofSize: 24))
    ]
    
    private let availableColors: [UIColor] = [
        .white, .black, .red, .blue, .green, .yellow, .orange, .purple, .cyan, .magenta
    ]
    
    init(textLabel: EditableTextLabel) {
        self.textLabel = textLabel
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        // Black background to match web editor
        view.backgroundColor = UIColor.black
        
        let scrollView = UIScrollView()
        scrollView.backgroundColor = .clear
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        let contentView = UIView()
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        // Title
        let titleLabel = UILabel()
        titleLabel.text = "Text Options"
        titleLabel.font = UIFont.boldSystemFont(ofSize: 20)
        titleLabel.textColor = .white // White text on black background
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(titleLabel)
        
        // Font Size Section
        let fontSizeLabel = UILabel()
        fontSizeLabel.text = "Font Size"
        fontSizeLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        fontSizeLabel.textColor = .white // White text on black background
        fontSizeLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fontSizeLabel)
        
        fontSizeSlider = UISlider()
        fontSizeSlider.minimumValue = 12
        fontSizeSlider.maximumValue = 72
        fontSizeSlider.value = Float(textLabel.font?.pointSize ?? 24)
        fontSizeSlider.addTarget(self, action: #selector(fontSizeChanged), for: .valueChanged)
        fontSizeSlider.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fontSizeSlider)
        
        let fontSizeValueLabel = UILabel()
        fontSizeValueLabel.text = "\(Int(fontSizeSlider.value))pt"
        fontSizeValueLabel.font = UIFont.systemFont(ofSize: 14)
        fontSizeValueLabel.textColor = .lightGray // Light gray on black background
        fontSizeValueLabel.translatesAutoresizingMaskIntoConstraints = false
        fontSizeValueLabel.tag = 100 // Tag for updating
        contentView.addSubview(fontSizeValueLabel)
        
        // Font Family Section
        let fontLabel = UILabel()
        fontLabel.text = "Font Style"
        fontLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        fontLabel.textColor = .white // White text on black background
        fontLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fontLabel)
        
        let fontScrollView = createScrollableFontButtons()
        fontScrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fontScrollView)
        
        // Color Section
        let colorLabel = UILabel()
        colorLabel.text = "Text Color"
        colorLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        colorLabel.textColor = .white // White text on black background
        colorLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(colorLabel)
        
        let colorStackView = createColorButtons()
        colorStackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(colorStackView)
        
        // Background Options
        let backgroundLabel = UILabel()
        backgroundLabel.text = "Background"
        backgroundLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        backgroundLabel.textColor = .white // White text on black background
        backgroundLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(backgroundLabel)
        
        let backgroundStackView = createBackgroundButtons()
        backgroundStackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(backgroundStackView)
        
        // Done Button with web-style outline styling
        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.backgroundColor = UIColor.black // Black background
        doneButton.setTitleColor(.white, for: .normal) // White text
        doneButton.layer.cornerRadius = 6
        doneButton.layer.borderWidth = 1
        doneButton.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        doneButton.layer.shadowColor = UIColor.black.cgColor
        doneButton.layer.shadowOffset = CGSize(width: 0, height: 1)
        doneButton.layer.shadowRadius = 2
        doneButton.layer.shadowOpacity = 0.05
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .medium) // Smaller font to match web
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(doneButton)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            titleLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            fontSizeLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 30),
            fontSizeLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            
            fontSizeSlider.topAnchor.constraint(equalTo: fontSizeLabel.bottomAnchor, constant: 10),
            fontSizeSlider.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            fontSizeSlider.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -80),
            
            fontSizeValueLabel.centerYAnchor.constraint(equalTo: fontSizeSlider.centerYAnchor),
            fontSizeValueLabel.leadingAnchor.constraint(equalTo: fontSizeSlider.trailingAnchor, constant: 10),
            fontSizeValueLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            fontLabel.topAnchor.constraint(equalTo: fontSizeSlider.bottomAnchor, constant: 30),
            fontLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            
            fontScrollView.topAnchor.constraint(equalTo: fontLabel.bottomAnchor, constant: 10),
            fontScrollView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            fontScrollView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            fontScrollView.heightAnchor.constraint(equalToConstant: 40),
            
            colorLabel.topAnchor.constraint(equalTo: fontScrollView.bottomAnchor, constant: 30),
            colorLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            
            colorStackView.topAnchor.constraint(equalTo: colorLabel.bottomAnchor, constant: 10),
            colorStackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            colorStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            backgroundLabel.topAnchor.constraint(equalTo: colorStackView.bottomAnchor, constant: 30),
            backgroundLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            
            backgroundStackView.topAnchor.constraint(equalTo: backgroundLabel.bottomAnchor, constant: 10),
            backgroundStackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            backgroundStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            doneButton.topAnchor.constraint(equalTo: backgroundStackView.bottomAnchor, constant: 40),
            doneButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            doneButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            doneButton.heightAnchor.constraint(equalToConstant: 50),
            doneButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20)
        ])
    }
    
    private func createScrollableFontButtons() -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fill // Changed from fillEqually to allow custom widths
        stackView.spacing = 12
        stackView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stackView)
        
        for (index, (fontName, font)) in availableFonts.enumerated() {
            let button = createWebStyleFontButton(title: fontName, font: font)
            button.tag = index
            button.addTarget(self, action: #selector(fontButtonTapped(_:)), for: .touchUpInside)
            
            // Set button width based on text size to show full font name
            let textWidth = fontName.size(withAttributes: [.font: UIFont.systemFont(ofSize: 14, weight: .medium)]).width
            let buttonWidth = max(textWidth + 32, 80) // Minimum 80pt, plus padding
            button.widthAnchor.constraint(equalToConstant: buttonWidth).isActive = true
            button.heightAnchor.constraint(equalToConstant: 40).isActive = true
            
            fontButtons.append(button)
            stackView.addArrangedSubview(button)
        }
        
        // Setup constraints
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            stackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            stackView.heightAnchor.constraint(equalTo: scrollView.heightAnchor)
        ])
        
        return scrollView
    }
    
    private func createWebStyleFontButton(title: String, font: UIFont) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = font.withSize(14) // Show font in its own style at 14pt
        
        // Web-style outline button styling
        button.backgroundColor = UIColor.black
        button.setTitleColor(.white, for: .normal)
        button.setTitleColor(.white.withAlphaComponent(0.8), for: .highlighted)
        button.layer.cornerRadius = 6
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        
        // Add touch effects
        button.addTarget(self, action: #selector(fontButtonTouchDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(fontButtonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        
        return button
    }
    
    @objc private func fontButtonTouchDown(_ button: UIButton) {
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.white.withAlphaComponent(0.1)
        }
    }
    
    @objc private func fontButtonTouchUp(_ button: UIButton) {
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.black
        }
    }
    
    private func createColorButtons() -> UIStackView {
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = 8
        
        for (index, color) in availableColors.enumerated() {
            let button = UIButton(type: .system)
            button.backgroundColor = color
            button.layer.cornerRadius = 20
            button.layer.borderWidth = 2
            button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor // Web-style border
            button.tag = index
            button.addTarget(self, action: #selector(colorButtonTapped(_:)), for: .touchUpInside)
            
            NSLayoutConstraint.activate([
                button.widthAnchor.constraint(equalToConstant: 40),
                button.heightAnchor.constraint(equalToConstant: 40)
            ])
            
            colorButtons.append(button)
            stackView.addArrangedSubview(button)
        }
        
        return stackView
    }
    
    private func createBackgroundButtons() -> UIStackView {
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = 12
        
        let transparentButton = createWebStyleBackgroundButton(title: "None", tag: 0)
        stackView.addArrangedSubview(transparentButton)
        
        let semiTransparentButton = createWebStyleBackgroundButton(title: "Semi", tag: 1)
        stackView.addArrangedSubview(semiTransparentButton)
        
        let solidButton = createWebStyleBackgroundButton(title: "Solid", tag: 2)
        stackView.addArrangedSubview(solidButton)
        
        return stackView
    }
    
    private func createWebStyleBackgroundButton(title: String, tag: Int) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        
        // Web-style outline button styling
        button.backgroundColor = UIColor.black
        button.setTitleColor(.white, for: .normal)
        button.setTitleColor(.white.withAlphaComponent(0.8), for: .highlighted)
        button.layer.cornerRadius = 6
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        
        button.tag = tag
        button.addTarget(self, action: #selector(backgroundButtonTapped(_:)), for: .touchUpInside)
        
        // Add touch effects
        button.addTarget(self, action: #selector(backgroundButtonTouchDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(backgroundButtonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        
        return button
    }
    
    @objc private func backgroundButtonTouchDown(_ button: UIButton) {
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.white.withAlphaComponent(0.1)
        }
    }
    
    @objc private func backgroundButtonTouchUp(_ button: UIButton) {
        UIView.animate(withDuration: 0.15) {
            button.backgroundColor = UIColor.black
        }
    }
    
    @objc private func fontSizeChanged(_ slider: UISlider) {
        let fontSize = CGFloat(slider.value)
        let currentFont = textLabel.font ?? UIFont.systemFont(ofSize: 24)
        textLabel.font = currentFont.withSize(fontSize)
        
        // Properly resize the label by recalculating its size
        let maxWidth: CGFloat = 300 // Maximum width before wrapping
        let size = textLabel.sizeThatFits(CGSize(width: maxWidth, height: .greatestFiniteMagnitude))
        textLabel.frame.size = size
        
        // Update value label
        if let valueLabel = view.viewWithTag(100) as? UILabel {
            valueLabel.text = "\(Int(fontSize))pt"
        }
    }
    
    @objc private func fontButtonTapped(_ sender: UIButton) {
        let (_, font) = availableFonts[sender.tag]
        let currentSize = textLabel.font?.pointSize ?? 24
        textLabel.font = font.withSize(currentSize)
        
        // Properly resize the label by recalculating its size
        let maxWidth: CGFloat = 300 // Maximum width before wrapping
        let size = textLabel.sizeThatFits(CGSize(width: maxWidth, height: .greatestFiniteMagnitude))
        textLabel.frame.size = size
        
        // Update button selection
        fontButtons.forEach { $0.backgroundColor = .systemGray6 }
        sender.backgroundColor = .systemBlue
    }
    
    @objc private func colorButtonTapped(_ sender: UIButton) {
        let color = availableColors[sender.tag]
        textLabel.textColor = color
        
        // Update button selection
        colorButtons.forEach { $0.layer.borderColor = UIColor.systemGray3.cgColor }
        sender.layer.borderColor = UIColor.systemBlue.cgColor
    }
    
    @objc private func backgroundButtonTapped(_ sender: UIButton) {
        switch sender.tag {
        case 0: // Transparent
            textLabel.backgroundColor = .clear
        case 1: // Semi-transparent
            textLabel.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        case 2: // Solid
            textLabel.backgroundColor = .black
        default:
            break
        }
    }
    
    @objc private func doneTapped() {
        dismiss(animated: true)
    }
}

// MARK: - Sticker System

struct StickerItem {
    let content: String
    let type: StickerType
    let size: CGSize
}

enum StickerType {
    case emoji
    case sfSymbol
    case image(UIImage)
}

// MARK: - EditableStickerView

class EditableStickerView: UIView {
    
    let sticker: StickerItem
    private var contentView: UIView!
    
    init(sticker: StickerItem) {
        self.sticker = sticker
        super.init(frame: CGRect(origin: .zero, size: sticker.size))
        setupStickerView()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupStickerView() {
        switch sticker.type {
        case .emoji:
            let label = UILabel()
            label.text = sticker.content
            label.font = UIFont.systemFont(ofSize: 40)
            label.textAlignment = .center
            label.frame = bounds
            contentView = label
            addSubview(label)
            
        case .sfSymbol:
            if #available(iOS 13.0, *) {
                let imageView = UIImageView()
                let config = UIImage.SymbolConfiguration(pointSize: 40, weight: .regular)
                imageView.image = UIImage(systemName: sticker.content, withConfiguration: config)
                imageView.contentMode = .scaleAspectFit
                imageView.frame = bounds
                imageView.tintColor = .white
                contentView = imageView
                addSubview(imageView)
            }
            
        case .image(let image):
            let imageView = UIImageView(image: image)
            imageView.contentMode = .scaleAspectFit
            imageView.frame = bounds
            contentView = imageView
            addSubview(imageView)
        }
    }
}

// MARK: - StickerPickerViewController

class StickerPickerViewController: UIViewController {
    
    var onStickerSelected: ((StickerItem) -> Void)?
    
    private let emojiCategories = [
        ("😀", "Faces", ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩"]),
        ("❤️", "Hearts", ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"]),
        ("🌟", "Objects", ["⭐", "🌟", "💫", "⚡", "🔥", "💥", "💢", "💨", "💦", "💧", "🌈", "☀️", "🌙", "⚽", "🏀", "🎵", "🎶", "🎉", "🎊", "🎈"]),
        ("🍎", "Food", ["🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥝", "🍍", "🥭", "🍯", "🍰", "🎂", "🧁", "🍭", "🍬", "🍫", "🍿"])
    ]
    
    private let sfSymbols = [
        "heart.fill", "star.fill", "bolt.fill", "flame.fill", "crown.fill",
        "sparkles", "moon.stars.fill", "sun.max.fill", "cloud.fill", "rainbow",
        "camera.fill", "music.note", "headphones", "gamecontroller.fill", "gift.fill",
        "balloon.fill", "party.popper.fill", "sportscourt.fill", "airplane", "car.fill"
    ]
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        // Black background to match web editor
        view.backgroundColor = UIColor.black
        
        // Title with white text styling
        let titleLabel = UILabel()
        titleLabel.text = "Choose Sticker"
        titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .semibold)
        titleLabel.textColor = .white // White text on black background
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        
        // Tab control with dark theme styling
        let segmentedControl = UISegmentedControl(items: ["Emoji", "Symbols"])
        segmentedControl.selectedSegmentIndex = 0
        segmentedControl.backgroundColor = UIColor.black
        segmentedControl.selectedSegmentTintColor = UIColor.white.withAlphaComponent(0.2)
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .normal)
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .selected)
        segmentedControl.layer.cornerRadius = 8
        segmentedControl.layer.borderWidth = 1
        segmentedControl.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        segmentedControl.addTarget(self, action: #selector(segmentChanged(_:)), for: .valueChanged)
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(segmentedControl)
        
        // Collection view for stickers
        let layout = UICollectionViewFlowLayout()
        layout.itemSize = CGSize(width: 50, height: 50)
        layout.minimumInteritemSpacing = 10
        layout.minimumLineSpacing = 10
        layout.sectionInset = UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.backgroundColor = .clear
        collectionView.register(StickerCell.self, forCellWithReuseIdentifier: "StickerCell")
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.tag = 0 // 0 for emoji, 1 for symbols
        view.addSubview(collectionView)
        
        // Done button with web-style outline styling
        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.backgroundColor = UIColor.black // Black background
        doneButton.setTitleColor(.white, for: .normal) // White text
        doneButton.layer.cornerRadius = 6
        doneButton.layer.borderWidth = 1
        doneButton.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        doneButton.layer.shadowColor = UIColor.black.cgColor
        doneButton.layer.shadowOffset = CGSize(width: 0, height: 1)
        doneButton.layer.shadowRadius = 2
        doneButton.layer.shadowOpacity = 0.05
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(doneButton)
        
        // Constraints
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            segmentedControl.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 20),
            segmentedControl.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            segmentedControl.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            collectionView.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 20),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: doneButton.topAnchor, constant: -20),
            
            doneButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            doneButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            doneButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            doneButton.heightAnchor.constraint(equalToConstant: 50)
        ])
    }
    
    @objc private func segmentChanged(_ sender: UISegmentedControl) {
        if let collectionView = view.subviews.first(where: { $0 is UICollectionView }) as? UICollectionView {
            collectionView.tag = sender.selectedSegmentIndex
            collectionView.reloadData()
        }
    }
    
    @objc private func doneTapped() {
        dismiss(animated: true)
    }
}

// MARK: - StickerPickerViewController Collection View

extension StickerPickerViewController: UICollectionViewDataSource, UICollectionViewDelegate {
    
    func numberOfSections(in collectionView: UICollectionView) -> Int {
        return collectionView.tag == 0 ? emojiCategories.count : 1
    }
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        if collectionView.tag == 0 {
            return emojiCategories[section].2.count
        } else {
            return sfSymbols.count
        }
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "StickerCell", for: indexPath) as! StickerCell
        
        if collectionView.tag == 0 {
            // Emoji
            let emoji = emojiCategories[indexPath.section].2[indexPath.item]
            cell.configure(with: emoji, isEmoji: true)
        } else {
            // SF Symbol
            let symbol = sfSymbols[indexPath.item]
            cell.configure(with: symbol, isEmoji: false)
        }
        
        return cell
    }
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        var sticker: StickerItem
        
        if collectionView.tag == 0 {
            // Emoji selected
            let emoji = emojiCategories[indexPath.section].2[indexPath.item]
            sticker = StickerItem(
                content: emoji,
                type: .emoji,
                size: CGSize(width: 60, height: 60)
            )
        } else {
            // SF Symbol selected
            let symbol = sfSymbols[indexPath.item]
            sticker = StickerItem(
                content: symbol,
                type: .sfSymbol,
                size: CGSize(width: 60, height: 60)
            )
        }
        
        onStickerSelected?(sticker)
        dismiss(animated: true)
    }
    
    func collectionView(_ collectionView: UICollectionView, viewForSupplementaryElementOfKind kind: String, at indexPath: IndexPath) -> UICollectionReusableView {
        // Could add section headers for emoji categories here
        return UICollectionReusableView()
    }
}

// MARK: - StickerCell

class StickerCell: UICollectionViewCell {
    
    private let contentLabel = UILabel()
    private let contentImageView = UIImageView()
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCell()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupCell()
    }
    
    private func setupCell() {
        // PhotoShare card styling
        backgroundColor = UIColor.white
        layer.cornerRadius = 8
        layer.borderWidth = 1
        layer.borderColor = UIColor(hue: 214.3/360, saturation: 0.318, brightness: 0.914, alpha: 1.0).cgColor
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 1)
        layer.shadowRadius = 2
        layer.shadowOpacity = 0.05
        
        contentLabel.textAlignment = .center
        contentLabel.font = UIFont.systemFont(ofSize: 30)
        contentLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(contentLabel)
        
        contentImageView.contentMode = .scaleAspectFit
        contentImageView.tintColor = .label
        contentImageView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(contentImageView)
        
        NSLayoutConstraint.activate([
            contentLabel.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            contentLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            
            contentImageView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            contentImageView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            contentImageView.widthAnchor.constraint(equalToConstant: 30),
            contentImageView.heightAnchor.constraint(equalToConstant: 30)
        ])
    }
    
    func configure(with content: String, isEmoji: Bool) {
        if isEmoji {
            contentLabel.text = content
            contentLabel.isHidden = false
            contentImageView.isHidden = true
        } else {
            if #available(iOS 13.0, *) {
                let config = UIImage.SymbolConfiguration(pointSize: 24, weight: .regular)
                contentImageView.image = UIImage(systemName: content, withConfiguration: config)
            }
            contentLabel.isHidden = true
            contentImageView.isHidden = false
        }
    }
    
    override var isSelected: Bool {
        didSet {
            if isSelected {
                backgroundColor = UIColor(hue: 218/360, saturation: 0.70, brightness: 0.65, alpha: 0.1)
                layer.borderColor = UIColor(hue: 218/360, saturation: 0.70, brightness: 0.65, alpha: 1.0).cgColor
                layer.borderWidth = 2
            } else {
                backgroundColor = UIColor.white
                layer.borderColor = UIColor(hue: 214.3/360, saturation: 0.318, brightness: 0.914, alpha: 1.0).cgColor
                layer.borderWidth = 1
            }
        }
    }
}

// MARK: - CropEditorViewController

struct CropResult {
    let croppedImage: UIImage?
    let cancelled: Bool
}

class CropEditorViewController: UIViewController {
    
    private let originalImage: UIImage
    private let cropType: String
    private let cropRatio: CGFloat
    private var imageView: UIImageView!
    private var cropBoxView: CropBoxView!
    
    var completion: ((CropResult) -> Void)?
    
    init(image: UIImage, cropType: String) {
        self.originalImage = image
        self.cropType = cropType
        // Set crop ratio based on type
        switch cropType {
        case "header":
            self.cropRatio = 4.0 / 1.0  // 4:1 ratio for headers
        case "qr":
            self.cropRatio = 1.0 / 1.0  // 1:1 ratio for QR codes
        default:
            self.cropRatio = 1.0
        }
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupUI()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Setup image and crop box after layout is complete
        if imageView == nil {
            setupImageAndCropBox()
        }
    }
    
    private func setupUI() {
        // Title
        let titleLabel = UILabel()
        titleLabel.text = getTitleForCropType()
        titleLabel.textColor = .white
        titleLabel.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        
        // Close button
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.6)
        closeButton.layer.cornerRadius = 22
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(closeButton)
        
        // Toolbar at bottom
        let toolbarView = UIView()
        toolbarView.backgroundColor = UIColor.black.withAlphaComponent(0.9)
        toolbarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbarView)
        
        // Reset and Crop buttons
        let resetButton = createWebStyleButton(title: "Reset")
        resetButton.addTarget(self, action: #selector(resetTapped), for: .touchUpInside)
        
        let cropButton = createWebStyleButton(title: "Crop & Save")
        cropButton.addTarget(self, action: #selector(cropTapped), for: .touchUpInside)
        
        let buttonStack = UIStackView(arrangedSubviews: [resetButton, cropButton])
        buttonStack.axis = .horizontal
        buttonStack.distribution = .fillEqually
        buttonStack.spacing = 16
        buttonStack.translatesAutoresizingMaskIntoConstraints = false
        toolbarView.addSubview(buttonStack)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            // Title
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            
            // Close button
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),
            
            
            // Toolbar
            toolbarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            toolbarView.heightAnchor.constraint(equalToConstant: 80),
            
            // Button stack
            buttonStack.centerXAnchor.constraint(equalTo: toolbarView.centerXAnchor),
            buttonStack.centerYAnchor.constraint(equalTo: toolbarView.centerYAnchor),
            buttonStack.leadingAnchor.constraint(greaterThanOrEqualTo: toolbarView.leadingAnchor, constant: 20),
            buttonStack.trailingAnchor.constraint(lessThanOrEqualTo: toolbarView.trailingAnchor, constant: -20)
        ])
    }
    
    private func setupImageAndCropBox() {
        // Calculate available area
        let titleHeight: CGFloat = 44
        let toolbarHeight: CGFloat = 80
        let safeAreaTop = view.safeAreaInsets.top
        let safeAreaBottom = view.safeAreaInsets.bottom
        
        let availableHeight = view.frame.height - safeAreaTop - safeAreaBottom - titleHeight - toolbarHeight
        let availableFrame = CGRect(x: 16, y: titleHeight + safeAreaTop, width: view.frame.width - 32, height: availableHeight)
        
        print("🎨 Available frame for image: \(availableFrame)")
        
        // Setup static image view
        imageView = UIImageView(image: originalImage)
        imageView.contentMode = .scaleAspectFit
        imageView.frame = availableFrame
        imageView.backgroundColor = .black
        imageView.isUserInteractionEnabled = false
        view.addSubview(imageView)
        
        // Calculate initial crop box size
        let imageSize = calculateDisplayedImageSize()
        let imageRect = calculateDisplayedImageRect(imageSize: imageSize, containerFrame: availableFrame)
        
        // Initial crop box - centered and sized to fit within image
        let initialCropSize = calculateInitialCropSize(imageRect: imageRect)
        let cropX = imageRect.midX - initialCropSize.width / 2
        let cropY = imageRect.midY - initialCropSize.height / 2
        let initialCropFrame = CGRect(x: cropX, y: cropY, width: initialCropSize.width, height: initialCropSize.height)
        
        // Create movable/resizable crop box
        cropBoxView = CropBoxView(frame: initialCropFrame, aspectRatio: cropRatio, imageFrame: imageRect)
        cropBoxView.minSize = CGSize(width: 100, height: 100 / cropRatio)
        view.addSubview(cropBoxView)
        
        print("🎨 Image rect: \(imageRect)")
        print("🎨 Initial crop frame: \(initialCropFrame)")
    }
    
    private func calculateDisplayedImageSize() -> CGSize {
        let imageSize = originalImage.size
        let viewSize = imageView.frame.size
        
        let hRatio = viewSize.width / imageSize.width
        let vRatio = viewSize.height / imageSize.height
        let ratio = min(hRatio, vRatio)
        
        return CGSize(width: imageSize.width * ratio, height: imageSize.height * ratio)
    }
    
    private func calculateDisplayedImageRect(imageSize: CGSize, containerFrame: CGRect) -> CGRect {
        let x = containerFrame.minX + (containerFrame.width - imageSize.width) / 2
        let y = containerFrame.minY + (containerFrame.height - imageSize.height) / 2
        return CGRect(x: x, y: y, width: imageSize.width, height: imageSize.height)
    }
    
    private func calculateInitialCropSize(imageRect: CGRect) -> CGSize {
        // Start with 80% of the smallest dimension
        let maxWidth = imageRect.width * 0.8
        let maxHeight = imageRect.height * 0.8
        
        // Calculate size maintaining aspect ratio
        if maxWidth / cropRatio <= maxHeight {
            return CGSize(width: maxWidth, height: maxWidth / cropRatio)
        } else {
            return CGSize(width: maxHeight * cropRatio, height: maxHeight)
        }
    }
    
    
    private func getTitleForCropType() -> String {
        switch cropType {
        case "header":
            return "Crop Header Image (4:1 Ratio)"
        case "qr":
            return "Crop QR Code Image (1:1 Ratio)"
        default:
            return "Crop Image"
        }
    }
    
    private func createWebStyleButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        
        // Web-style outline button styling
        button.backgroundColor = UIColor.black
        button.setTitleColor(.white, for: .normal)
        button.setTitleColor(.white.withAlphaComponent(0.8), for: .highlighted)
        button.layer.cornerRadius = 8
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.3).cgColor
        button.contentEdgeInsets = UIEdgeInsets(top: 12, left: 20, bottom: 12, right: 20)
        
        return button
    }
    
    @objc private func closeTapped() {
        print("🎨 ❌ Close button tapped")
        dismiss(animated: true) {
            self.completion?(CropResult(croppedImage: nil, cancelled: true))
        }
    }
    
    @objc private func resetTapped() {
        print("🎨 🔄 Reset button tapped")
        
        // Reset crop box to initial size and position
        let imageSize = calculateDisplayedImageSize()
        let containerFrame = imageView.frame
        let imageRect = calculateDisplayedImageRect(imageSize: imageSize, containerFrame: containerFrame)
        let initialCropSize = calculateInitialCropSize(imageRect: imageRect)
        
        let cropX = imageRect.midX - initialCropSize.width / 2
        let cropY = imageRect.midY - initialCropSize.height / 2
        
        UIView.animate(withDuration: 0.3) {
            self.cropBoxView.frame = CGRect(x: cropX, y: cropY, width: initialCropSize.width, height: initialCropSize.height)
        }
    }
    
    @objc private func cropTapped() {
        print("🎨 ✂️ Crop button tapped")
        
        guard let croppedImage = performCrop() else {
            print("❌ Crop failed")
            // Show error alert
            let alert = UIAlertController(title: "Crop Error", message: "Unable to crop image. Please try again.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
            return
        }
        
        print("✅ Crop successful, dismissing...")
        dismiss(animated: true) {
            self.completion?(CropResult(croppedImage: croppedImage, cancelled: false))
        }
    }
    
    
    // Cropping function: returns UIImage for crop box area
    private func performCrop() -> UIImage? {
        // First, normalize the image orientation to avoid coordinate system confusion
        let normalizedImage = normalizeImageOrientation(originalImage)
        
        // Get the actual displayed image frame within the UIImageView
        let displayedImageSize = calculateDisplayedImageSize()
        let displayedImageFrame = calculateDisplayedImageRect(imageSize: displayedImageSize, containerFrame: imageView.frame)
        
        // Get crop box frame in view coordinates
        let cropFrame = cropBoxView.frame
        
        print("🎨 Debug crop calculation for \(cropType):")
        print("🎨 Original image size: \(originalImage.size)")
        print("🎨 Original image orientation: \(originalImage.imageOrientation.rawValue)")
        print("🎨 Normalized image size: \(normalizedImage.size)")
        print("🎨 Displayed image frame: \(displayedImageFrame)")
        print("🎨 Displayed image size: \(displayedImageSize)")
        print("🎨 Crop box frame: \(cropFrame)")
        print("🎨 Crop ratio: \(cropRatio)")
        
        // Calculate the scale factors from displayed image to normalized image
        let scaleX = normalizedImage.size.width / displayedImageSize.width
        let scaleY = normalizedImage.size.height / displayedImageSize.height
        
        print("🎨 Scale factors - X: \(scaleX), Y: \(scaleY)")
        
        // Convert crop box coordinates from view space to displayed image space
        let cropInImageSpace = CGRect(
            x: cropFrame.minX - displayedImageFrame.minX,
            y: cropFrame.minY - displayedImageFrame.minY,
            width: cropFrame.width,
            height: cropFrame.height
        )
        
        print("🎨 Crop in image space: \(cropInImageSpace)")
        
        // Scale up to normalized image coordinates
        let finalCropRect = CGRect(
            x: cropInImageSpace.minX * scaleX,
            y: cropInImageSpace.minY * scaleY,
            width: cropInImageSpace.width * scaleX,
            height: cropInImageSpace.height * scaleY
        )
        
        print("🎨 Final crop rect: \(finalCropRect)")
        
        // Ensure crop rect is within image bounds
        let clampedCropRect = CGRect(
            x: max(0, min(finalCropRect.minX, normalizedImage.size.width - 1)),
            y: max(0, min(finalCropRect.minY, normalizedImage.size.height - 1)),
            width: min(finalCropRect.width, normalizedImage.size.width - finalCropRect.minX),
            height: min(finalCropRect.height, normalizedImage.size.height - finalCropRect.minY)
        )
        
        print("🎨 Clamped crop rect: \(clampedCropRect)")
        
        // Crop the normalized image
        guard let cgImage = normalizedImage.cgImage?.cropping(to: clampedCropRect) else {
            print("❌ Failed to crop image")
            return nil
        }
        
        let croppedImage = UIImage(cgImage: cgImage)
        print("✅ Crop successful, resizing to target dimensions...")
        
        // Resize to target dimensions
        return resizeToTargetDimensions(croppedImage)
    }
    
    private func normalizeImageOrientation(_ image: UIImage) -> UIImage {
        // If already up orientation, return as-is
        if image.imageOrientation == .up {
            return image
        }
        
        // Create a graphics context to redraw the image with correct orientation
        UIGraphicsBeginImageContextWithOptions(image.size, false, image.scale)
        image.draw(at: .zero)
        let normalizedImage = UIGraphicsGetImageFromCurrentImageContext() ?? image
        UIGraphicsEndImageContext()
        
        return normalizedImage
    }
    
    private func resizeToTargetDimensions(_ image: UIImage) -> UIImage {
        let targetSize: CGSize
        
        switch cropType {
        case "header":
            targetSize = CGSize(width: 1920, height: 480)
        case "qr":
            targetSize = CGSize(width: 512, height: 512)
        default:
            return image // Return original if unknown type
        }
        
        UIGraphicsBeginImageContextWithOptions(targetSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: targetSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        
        return resizedImage ?? image
    }   
}

// MARK: - CropBoxView

class CropBoxView: UIView {
    
    private let aspectRatio: CGFloat
    private var imageFrame: CGRect
    var minSize: CGSize = CGSize(width: 50, height: 50)
    
    // Corner handles
    private var cornerHandles: [UIView] = []
    private var isDragging = false
    private var isResizing = false
    private var activeHandle: UIView?
    private var lastPanPoint: CGPoint = .zero
    private var initialFrame: CGRect = .zero
    
    init(frame: CGRect, aspectRatio: CGFloat, imageFrame: CGRect) {
        self.aspectRatio = aspectRatio
        self.imageFrame = imageFrame
        super.init(frame: frame)
        setupView()
        setupGestureRecognizers()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupView() {
        backgroundColor = UIColor.clear
        layer.borderColor = UIColor(red: 0x1E/255.0, green: 0x7F/255.0, blue: 0xFF/255.0, alpha: 1.0).cgColor
        layer.borderWidth = 2.0
        
        // Create corner handles
        for i in 0..<4 {
            let handle = UIView()
            handle.backgroundColor = UIColor(red: 0x1E/255.0, green: 0x7F/255.0, blue: 0xFF/255.0, alpha: 1.0)
            handle.layer.cornerRadius = 6
            handle.frame = CGRect(x: 0, y: 0, width: 12, height: 12)
            handle.tag = i
            addSubview(handle)
            cornerHandles.append(handle)
        }
        
        updateHandlePositions()
    }
    
    private func setupGestureRecognizers() {
        // Pan for moving the entire crop box
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(panGesture)
        
        // Pinch for resizing with aspect ratio lock
        let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        addGestureRecognizer(pinchGesture)
    }
    
    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: superview)
        
        switch gesture.state {
        case .began:
            isDragging = true
            initialFrame = frame
            
        case .changed:
            var newFrame = initialFrame
            newFrame.origin.x += translation.x
            newFrame.origin.y += translation.y
            
            // Keep within image bounds
            newFrame = constrainToImageBounds(newFrame)
            frame = newFrame
            
        case .ended, .cancelled:
            isDragging = false
            
        default:
            break
        }
    }
    
    @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        switch gesture.state {
        case .began:
            isResizing = true
            initialFrame = frame
            
        case .changed:
            let scale = gesture.scale
            var newWidth = initialFrame.width * scale
            var newHeight = newWidth / aspectRatio
            
            // Apply minimum size constraints
            if newWidth < minSize.width {
                newWidth = minSize.width
                newHeight = newWidth / aspectRatio
            }
            
            // Keep within screen bounds
            let maxWidth = min(imageFrame.width, superview?.bounds.width ?? imageFrame.width)
            let maxHeight = min(imageFrame.height, superview?.bounds.height ?? imageFrame.height)
            
            if newWidth > maxWidth {
                newWidth = maxWidth
                newHeight = newWidth / aspectRatio
            }
            
            if newHeight > maxHeight {
                newHeight = maxHeight
                newWidth = newHeight * aspectRatio
            }
            
            // Center the resize
            let centerX = initialFrame.midX
            let centerY = initialFrame.midY
            
            var newFrame = CGRect(
                x: centerX - newWidth / 2,
                y: centerY - newHeight / 2,
                width: newWidth,
                height: newHeight
            )
            
            // Keep within image bounds
            newFrame = constrainToImageBounds(newFrame)
            frame = newFrame
            updateHandlePositions()
            
        case .ended, .cancelled:
            isResizing = false
            
        default:
            break
        }
    }
    
    private func constrainToImageBounds(_ rect: CGRect) -> CGRect {
        var newRect = rect
        
        // Keep within image bounds
        if newRect.minX < imageFrame.minX {
            newRect.origin.x = imageFrame.minX
        }
        if newRect.minY < imageFrame.minY {
            newRect.origin.y = imageFrame.minY
        }
        if newRect.maxX > imageFrame.maxX {
            newRect.origin.x = imageFrame.maxX - newRect.width
        }
        if newRect.maxY > imageFrame.maxY {
            newRect.origin.y = imageFrame.maxY - newRect.height
        }
        
        return newRect
    }
    
    private func updateHandlePositions() {
        guard cornerHandles.count == 4 else { return }
        
        let handleSize: CGFloat = 12
        let offset = handleSize / 2
        
        // Top-left
        cornerHandles[0].center = CGPoint(x: -offset, y: -offset)
        // Top-right
        cornerHandles[1].center = CGPoint(x: bounds.width + offset, y: -offset)
        // Bottom-right
        cornerHandles[2].center = CGPoint(x: bounds.width + offset, y: bounds.height + offset)
        // Bottom-left
        cornerHandles[3].center = CGPoint(x: -offset, y: bounds.height + offset)
    }
    
    func updateImageFrame(_ newImageFrame: CGRect) {
        imageFrame = newImageFrame
        frame = constrainToImageBounds(frame)
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        updateHandlePositions()
    }
    
    override func draw(_ rect: CGRect) {
        super.draw(rect)
        
        guard let context = UIGraphicsGetCurrentContext() else { return }
        
        // Draw grid lines
        context.setStrokeColor(UIColor(red: 0x1E/255.0, green: 0x7F/255.0, blue: 0xFF/255.0, alpha: 0.5).cgColor)
        context.setLineWidth(1.0)
        
        // Vertical grid lines
        let gridSpacing = bounds.width / 3
        for i in 1..<3 {
            let x = CGFloat(i) * gridSpacing
            context.move(to: CGPoint(x: x, y: 0))
            context.addLine(to: CGPoint(x: x, y: bounds.height))
        }
        
        // Horizontal grid lines
        let gridSpacingY = bounds.height / 3
        for i in 1..<3 {
            let y = CGFloat(i) * gridSpacingY
            context.move(to: CGPoint(x: 0, y: y))
            context.addLine(to: CGPoint(x: bounds.width, y: y))
        }
        
        context.strokePath()
    }
}

