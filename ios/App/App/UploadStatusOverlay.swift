import UIKit
import Capacitor

@objc(UploadStatusOverlay)
public class UploadStatusOverlay: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol Requirements
    public let identifier = "UploadStatusOverlay"
    public let jsName = "UploadStatusOverlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addPhoto", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    private var overlayView: UIView?
    private var headerLabel: UILabel?
    private var progressView: UIProgressView?
    private var currentThumbnailView: UIImageView?
    private var completedCount = 0
    private var totalCount = 0
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        print("🎯 UploadStatusOverlay loaded successfully!")
    }
    
    // MARK: - Plugin Methods
    @objc func showOverlay(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Uploading Photos"
        DispatchQueue.main.async {
            self.showUploadOverlay(title: title)
            call.resolve()
        }
    }
    
    @objc func hideOverlay(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.hideUploadOverlay()
            call.resolve()
        }
    }
    
    @objc func updateProgress(_ call: CAPPluginCall) {
        let completed = call.getInt("completed") ?? 0
        let total = call.getInt("total") ?? 0
        let title = call.getString("title") ?? "Uploading Photos"
        
        DispatchQueue.main.async {
            self.updateOverlayProgress(completed: completed, total: total, title: title)
            call.resolve()
        }
    }
    
    @objc func addPhoto(_ call: CAPPluginCall) {
        guard let base64String = call.getString("thumbnail") else {
            call.reject("Missing thumbnail data")
            return
        }
        
        DispatchQueue.main.async {
            if let imageData = Data(base64Encoded: base64String),
               let image = UIImage(data: imageData) {
                self.setCurrentThumbnail(image: image)
            }
            call.resolve()
        }
    }
    
    // MARK: - Native Overlay Management
    private func showUploadOverlay(title: String = "Uploading Photos") {
        guard let webView = self.bridge?.webView else {
            print("❌ No webView available for overlay")
            return
        }
        
        // Remove existing overlay if any
        hideUploadOverlay()
        
        // Create overlay container with dark theme
        let overlay = UIView()
        overlay.backgroundColor = UIColor(red: 0.2, green: 0.2, blue: 0.2, alpha: 1.0) // #333333
        overlay.layer.cornerRadius = 12
        overlay.layer.shadowColor = UIColor.black.cgColor
        overlay.layer.shadowOffset = CGSize(width: 0, height: 2)
        overlay.layer.shadowOpacity = 0.3
        overlay.layer.shadowRadius = 8
        overlay.translatesAutoresizingMaskIntoConstraints = false
        
        // Create header label with white text
        let headerLabel = UILabel()
        headerLabel.text = title
        headerLabel.font = UIFont.boldSystemFont(ofSize: 16)
        headerLabel.textColor = .white
        headerLabel.textAlignment = .center
        headerLabel.translatesAutoresizingMaskIntoConstraints = false
        
        // Create progress bar
        let progressView = UIProgressView(progressViewStyle: .default)
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .systemGray4
        progressView.progress = 0.0 // Start at 0%
        progressView.translatesAutoresizingMaskIntoConstraints = false
        
        // Store references
        self.headerLabel = headerLabel
        self.progressView = progressView
        
        // Create current thumbnail view (larger, on left side)
        let thumbnailView = UIImageView()
        thumbnailView.contentMode = .scaleAspectFill
        thumbnailView.clipsToBounds = true
        thumbnailView.layer.cornerRadius = 6
        thumbnailView.layer.borderWidth = 1
        thumbnailView.layer.borderColor = UIColor.systemGray4.cgColor
        thumbnailView.backgroundColor = UIColor.systemGray5
        thumbnailView.translatesAutoresizingMaskIntoConstraints = false
        
        // Create close button with white text
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("×", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .bold)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        
        // Store thumbnail reference
        self.currentThumbnailView = thumbnailView
        
        // Add subviews
        overlay.addSubview(headerLabel)
        overlay.addSubview(progressView)
        overlay.addSubview(thumbnailView)
        overlay.addSubview(closeButton)
        
        // Add overlay to webView
        webView.addSubview(overlay)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            // Position overlay at top of webView, below status bar
            overlay.topAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.topAnchor, constant: 10),
            overlay.leadingAnchor.constraint(equalTo: webView.leadingAnchor, constant: 16),
            overlay.trailingAnchor.constraint(equalTo: webView.trailingAnchor, constant: -16),
            overlay.heightAnchor.constraint(equalToConstant: 80),
            
            // Close button
            closeButton.topAnchor.constraint(equalTo: overlay.topAnchor, constant: 8),
            closeButton.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -12),
            closeButton.widthAnchor.constraint(equalToConstant: 30),
            closeButton.heightAnchor.constraint(equalToConstant: 30),
            
            // Header label
            headerLabel.topAnchor.constraint(equalTo: overlay.topAnchor, constant: 12),
            headerLabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 16),
            headerLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
            
            // Current thumbnail (on left side) - centered to full overlay height
            thumbnailView.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            thumbnailView.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 16),
            thumbnailView.widthAnchor.constraint(equalToConstant: 40),
            thumbnailView.heightAnchor.constraint(equalToConstant: 40),
            
            // Progress view (next to thumbnail)
            progressView.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 25),
            progressView.leadingAnchor.constraint(equalTo: thumbnailView.trailingAnchor, constant: 12),
            progressView.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
            progressView.heightAnchor.constraint(equalToConstant: 6)
        ])
        
        // Store reference
        self.overlayView = overlay
        
        print("✅ Upload status overlay shown")
    }
    
    private func hideUploadOverlay() {
        overlayView?.removeFromSuperview()
        overlayView = nil
        headerLabel = nil
        progressView = nil
        currentThumbnailView = nil
        completedCount = 0
        totalCount = 0
        print("✅ Upload status overlay hidden")
    }
    
    private func updateOverlayProgress(completed: Int, total: Int, title: String = "Uploading Photos") {
        completedCount = completed
        totalCount = total
        
        // Update header text with custom title
        if total > 0 {
            headerLabel?.text = "\(title) (\(completed)/\(total))"
        } else {
            headerLabel?.text = title
        }
        
        // Update progress bar
        let progress = total > 0 ? Float(completed) / Float(total) : 0.0
        progressView?.progress = progress
        
        print("📊 Overlay progress updated: \(title) \(completed)/\(total) (\(Int(progress * 100))%)")
    }
    
    private func setCurrentThumbnail(image: UIImage) {
        guard let thumbnailView = currentThumbnailView else { return }
        
        thumbnailView.image = image
        thumbnailView.layer.borderColor = UIColor.systemBlue.cgColor
        thumbnailView.layer.borderWidth = 2
        
        print("📸 Set current thumbnail in overlay")
    }
    
    private func markThumbnailCompleted() {
        guard let thumbnailView = currentThumbnailView else { return }
        
        thumbnailView.layer.borderColor = UIColor.systemGreen.cgColor
        thumbnailView.layer.borderWidth = 2
        
        print("✅ Marked current thumbnail as completed")
    }
    
    @objc private func closeButtonTapped() {
        hideUploadOverlay()
    }
    
    // MARK: - Static Methods for Direct Usage
    @objc static func showOverlayWithUploads() {
        DispatchQueue.main.async {
            print("🎯 Showing overlay (static method)")
            // This can be called directly from EventPhotoPicker
        }
    }
}