import UIKit
import Capacitor
import Photos

@objc(UploadStatusOverlayPlugin)
public class UploadStatusOverlay: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol Requirements
    public let identifier = "UploadStatusOverlay"
    public let jsName = "UploadStatusOverlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideOverlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addPhoto", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Overlay Modes
    enum OverlayMode {
        case uploading(index: Int, total: Int, fileName: String, thumbnailData: Data?)
        case scanning(eventName: String)
        case gettingEvent
        case complete(uploaded: Int, duplicates: Int, outsideDates: Int)
    }
    
    // MARK: - Properties
    private var overlayViewController: UploadOverlayViewController?
    private var currentMode: OverlayMode = .gettingEvent
    private var uploadStats = UploadStats()
    
    // Upload statistics tracking
    private struct UploadStats {
        var uploaded: Int = 0
        var duplicates: Int = 0
        var outsideDates: Int = 0
        var total: Int = 0
        var currentIndex: Int = 0
    }
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        print("🎯 UploadStatusOverlay loaded with new design!")
        UploadStatusOverlay.shared = self
    }
    
    // MARK: - Plugin Methods
    @objc func showOverlay(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "gettingEvent"
        let title = call.getString("title")
        let eventName = call.getString("eventName")
        
        print("🔧 showOverlay called with mode: '\(mode)', title: '\(title ?? "nil")', eventName: '\(eventName ?? "nil")'")
        
        // Check if auto-upload is enabled before showing overlay
        let autoUploadEnabled = UserDefaults.standard.bool(forKey: "userAutoUploadEnabled")
        print("🔍 Auto-upload enabled: \(autoUploadEnabled)")
        
        guard autoUploadEnabled else {
            print("⏸️ Auto-upload disabled - not showing overlay")
            call.resolve()
            return
        }
        
        DispatchQueue.main.async {
            switch mode {
            case "scanning":
                let event = eventName ?? "Event"
                print("🔧 Setting mode to scanning with event: \(event)")
                self.currentMode = .scanning(eventName: event)
            case "gettingEvent":
                print("🔧 Setting mode to gettingEvent")
                self.currentMode = .gettingEvent
            case "complete":
                print("🔧 Setting mode to complete")
                self.currentMode = .complete(
                    uploaded: self.uploadStats.uploaded,
                    duplicates: self.uploadStats.duplicates,
                    outsideDates: self.uploadStats.outsideDates
                )
            default:
                print("🔧 Unknown mode '\(mode)', defaulting to gettingEvent")
                self.currentMode = .gettingEvent
            }
            
            print("🔧 About to show native overlay with currentMode: \(self.currentMode)")
            self.showNativeOverlay()
            call.resolve()
        }
    }
    
    @objc func hideOverlay(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.hideNativeOverlay()
            self.resetStats()
            call.resolve()
        }
    }
    
    @objc func updateProgress(_ call: CAPPluginCall) {
        let completed = call.getInt("completed") ?? 0
        let total = call.getInt("total") ?? 0
        let fileName = call.getString("fileName") ?? ""
        let isDuplicate = call.getBool("isDuplicate") ?? false
        let isOutsideDate = call.getBool("isOutsideDate") ?? false
        let eventName = call.getString("eventName")
        
        DispatchQueue.main.async {
            self.uploadStats.currentIndex = completed
            self.uploadStats.total = total
            
            if isDuplicate {
                self.uploadStats.duplicates += 1
            } else if isOutsideDate {
                self.uploadStats.outsideDates += 1
            } else if completed > 0 {
                self.uploadStats.uploaded = completed - self.uploadStats.duplicates - self.uploadStats.outsideDates
            }
            
            // Update mode based on context
            if let eventName = eventName, eventName.contains("Scanning") {
                self.currentMode = .scanning(eventName: eventName)
            } else {
                self.currentMode = .uploading(
                    index: completed,
                    total: total,
                    fileName: fileName,
                    thumbnailData: nil
                )
            }
            
            self.overlayViewController?.updateMode(self.currentMode)
            self.overlayViewController?.updateProgress(Float(completed) / Float(max(total, 1)))
            
            call.resolve()
        }
    }
    
    @objc func setMode(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "uploading"
        let eventName = call.getString("eventName")
        
        // Check if auto-upload is enabled before changing overlay mode
        let autoUploadEnabled = UserDefaults.standard.bool(forKey: "userAutoUploadEnabled")
        print("🔍 setMode - Auto-upload enabled: \(autoUploadEnabled)")
        
        guard autoUploadEnabled else {
            print("⏸️ Auto-upload disabled - not setting overlay mode")
            call.resolve()
            return
        }
        
        DispatchQueue.main.async {
            switch mode {
            case "scanning":
                self.currentMode = .scanning(eventName: eventName ?? "Event")
            case "gettingEvent":
                self.currentMode = .gettingEvent
            case "complete":
                self.currentMode = .complete(
                    uploaded: self.uploadStats.uploaded,
                    duplicates: self.uploadStats.duplicates,
                    outsideDates: self.uploadStats.outsideDates
                )
            default:
                break
            }
            
            self.overlayViewController?.updateMode(self.currentMode)
            call.resolve()
        }
    }
    
    @objc func addPhoto(_ call: CAPPluginCall) {
        guard let base64String = call.getString("thumbnail") else {
            call.reject("Missing thumbnail data")
            return
        }
        
        let fileName = call.getString("fileName") ?? "photo.jpg"
        
        DispatchQueue.main.async {
            if let imageData = Data(base64Encoded: base64String) {
                if case .uploading(let index, let total, _, _) = self.currentMode {
                    self.currentMode = .uploading(
                        index: index,
                        total: total,
                        fileName: fileName,
                        thumbnailData: imageData
                    )
                    self.overlayViewController?.updateMode(self.currentMode)
                }
            }
            call.resolve()
        }
    }
    
    // MARK: - Native Overlay Management
    @objc public func showNativeOverlay() {
        print("🔧 showNativeOverlay called")
        guard let webView = self.bridge?.webView else { 
            print("❌ No webView available")
            return 
        }
        
        print("🔧 WebView found, removing existing overlay")
        // Remove existing overlay
        hideNativeOverlay()
        
        print("🔧 Creating new overlay with currentMode: \(currentMode)")
        // Create new overlay
        let overlay = UploadOverlayViewController()
        overlay.mode = currentMode
        overlay.onClose = { [weak self] in
            self?.hideNativeOverlay()
        }
        
        // Add as child view controller
        if let parentVC = webView.window?.rootViewController {
            print("🔧 Adding overlay as child view controller")
            parentVC.addChild(overlay)
            webView.addSubview(overlay.view)
            overlay.didMove(toParent: parentVC)
            
            // Setup constraints
            overlay.view.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                overlay.view.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
                overlay.view.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
                overlay.view.bottomAnchor.constraint(equalTo: webView.bottomAnchor),
                overlay.view.heightAnchor.constraint(greaterThanOrEqualToConstant: 88)
            ])
            
            self.overlayViewController = overlay
            print("✅ Overlay added successfully")
        } else {
            print("❌ No parent view controller found")
        }
    }
    
    @objc public func hideNativeOverlay() {
        overlayViewController?.willMove(toParent: nil)
        overlayViewController?.view.removeFromSuperview()
        overlayViewController?.removeFromParent()
        overlayViewController = nil
    }
    
    private func resetStats() {
        uploadStats = UploadStats()
    }
    
    // MARK: - Static Methods for Direct Native Usage
    static var shared: UploadStatusOverlay?
    
    @objc static func showForAutoUpload(eventName: String) {
        let autoUploadEnabled = UserDefaults.standard.bool(forKey: "userAutoUploadEnabled")
        print("🔍 Static showForAutoUpload - Auto-upload enabled: \(autoUploadEnabled)")
        
        guard autoUploadEnabled else {
            print("⏸️ Auto-upload disabled - not showing static overlay")
            return
        }
        
        shared?.currentMode = .scanning(eventName: eventName)
        shared?.showNativeOverlay()
    }
    
    @objc static func showForEventPhotoPicker(photos: [[String: Any]], eventId: String) {
        shared?.uploadStats.total = photos.count
        shared?.currentMode = .uploading(index: 0, total: photos.count, fileName: "", thumbnailData: nil)
        shared?.showNativeOverlay()
    }
    
    @objc static func updateUploadProgress(index: Int, total: Int, fileName: String, thumbnailData: Data?) {
        shared?.currentMode = .uploading(index: index, total: total, fileName: fileName, thumbnailData: thumbnailData)
        shared?.overlayViewController?.updateMode(shared!.currentMode)
        shared?.overlayViewController?.updateProgress(Float(index) / Float(max(total, 1)))
    }
    
    @objc static func markAsComplete() {
        if let shared = shared {
            shared.currentMode = .complete(
                uploaded: shared.uploadStats.uploaded,
                duplicates: shared.uploadStats.duplicates,
                outsideDates: shared.uploadStats.outsideDates
            )
            shared.overlayViewController?.updateMode(shared.currentMode)
        }
    }
}

// MARK: - Upload Overlay View Controller
class UploadOverlayViewController: UIViewController {
    
    // MARK: - UI Components
    private let containerView = UIView()
    private let thumbnailImageView = UIImageView()
    private let iconBackgroundView = UIView()
    private let iconImageView = UIImageView()
    private let headerLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let progressView = UIProgressView(progressViewStyle: .default)
    private let closeButton = UIButton(type: .system)
    
    // MARK: - Properties
    var mode: UploadStatusOverlay.OverlayMode = .uploading(index: 0, total: 0, fileName: "", thumbnailData: nil) {
        didSet { 
            print("🔧 UploadOverlayViewController mode set to: \(mode)")
            updateUI() 
        }
    }
    
    var onClose: (() -> Void)?
    
    // MARK: - Theme Support
    private var isDarkMode: Bool {
        if #available(iOS 13.0, *) {
            return traitCollection.userInterfaceStyle == .dark
        } else {
            return false
        }
    }
    
    private func textColor() -> UIColor {
        return isDarkMode ? .white : UIColor(red: 0.129, green: 0.129, blue: 0.129, alpha: 1.0)
    }
    
    private func borderColor() -> UIColor {
        return isDarkMode ? UIColor(red: 0.2, green: 0.23, blue: 0.33, alpha: 1.0) : UIColor(red: 0.886, green: 0.910, blue: 0.941, alpha: 1.0)
    }
    
    private var dotAnimationTimer: Timer?
    private var currentDotCount = 0
    private var eventNames = ["Birthday Party", "Team Meetup", "Weekend Trip", "Family Gathering", "Conference 2024"]
    private var currentEventIndex = 0
    private var realEventName: String = ""
    
    // MARK: - Custom Fonts
    private func outfitFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let fontName: String
        switch weight {
        case .light, .ultraLight, .thin:
            fontName = "Outfit-Light"
        case .regular:
            fontName = "Outfit-Regular"
        case .medium:
            fontName = "Outfit-Medium"
        case .semibold:
            fontName = "Outfit-SemiBold"
        case .bold, .heavy, .black:
            fontName = "Outfit-Bold"
        default:
            fontName = "Outfit-Regular"
        }
        
        return UIFont(name: fontName, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
    }
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        print("🔧 UploadOverlayViewController viewDidLoad called with mode: \(mode)")
        setupViews()
        setupConstraints()
        updateUI()
        print("🔧 UploadOverlayViewController viewDidLoad completed")
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        // Animate in from bottom
        containerView.transform = CGAffineTransform(translationX: 0, y: 200)
        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            self.containerView.transform = .identity
        }
    }
    
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if #available(iOS 13.0, *) {
            if traitCollection.userInterfaceStyle != previousTraitCollection?.userInterfaceStyle {
                // Theme changed, update colors
                updateThemeColors()
            }
        }
    }
    
    private func updateThemeColors() {
        // Update all text colors
        headerLabel.textColor = textColor()
        closeButton.tintColor = textColor()
        
        // Update border color
        view.subviews.forEach { subview in
            if let containerView = subview as? UIView {
                containerView.subviews.forEach { containerSubview in
                    if containerSubview.tag == 999 { // We'll tag the border view
                        containerSubview.backgroundColor = borderColor()
                    }
                }
            }
        }
        
        // Update icon colors based on current mode
        updateUI()
    }
    
    // MARK: - Setup
    private func setupViews() {
        // Make background transparent
        view.backgroundColor = .clear
        
        // Container with bottom positioning and rounded top corners
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 12
        containerView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: -2)
        containerView.layer.shadowRadius = 8
        containerView.layer.shadowOpacity = 0.1
        
        // Top border with theme-aware color
        let topBorder = UIView()
        topBorder.backgroundColor = borderColor() // Dynamic border color
        topBorder.tag = 999 // Tag for theme updates
        topBorder.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(topBorder)
        
        // Thumbnail for photos
        thumbnailImageView.contentMode = .scaleAspectFill
        thumbnailImageView.clipsToBounds = true
        thumbnailImageView.layer.cornerRadius = 12
        thumbnailImageView.backgroundColor = .systemGray5
        
        // Icon background for states
        iconBackgroundView.layer.cornerRadius = 12
        iconBackgroundView.clipsToBounds = true
        
        // Icon with SF Symbols
        iconImageView.contentMode = .center
        iconImageView.tintColor = .systemBlue
        
        // Header with Outfit font (16sp semibold) - dynamic color for dark mode
        headerLabel.font = outfitFont(size: 16, weight: .semibold)
        headerLabel.textColor = textColor() // Dynamic color based on theme
        headerLabel.numberOfLines = 0  // Allow multiple lines in case text is long
        headerLabel.adjustsFontSizeToFitWidth = true
        headerLabel.minimumScaleFactor = 0.8
        headerLabel.backgroundColor = UIColor.clear
        
        // Subtitle with Outfit font (12sp regular, #64748b)
        subtitleLabel.font = outfitFont(size: 12, weight: .regular)
        subtitleLabel.textColor = UIColor(red: 0.392, green: 0.455, blue: 0.545, alpha: 1.0) // #64748b
        subtitleLabel.numberOfLines = 1
        subtitleLabel.lineBreakMode = .byTruncatingMiddle
        
        // Progress bar
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .systemGray5
        progressView.layer.cornerRadius = 4
        progressView.clipsToBounds = true
        
        // Close button with SF Symbol (16px, 32x32px touch area) - dynamic color
        let closeConfig = UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        let closeImage = UIImage(systemName: "xmark", withConfiguration: closeConfig)
        closeButton.setImage(closeImage, for: .normal)
        closeButton.tintColor = textColor() // Dynamic color for close button
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        
        // Add subviews
        view.addSubview(containerView)
        containerView.addSubview(thumbnailImageView)
        containerView.addSubview(iconBackgroundView)
        iconBackgroundView.addSubview(iconImageView)
        containerView.addSubview(headerLabel)
        containerView.addSubview(subtitleLabel)
        containerView.addSubview(progressView)
        containerView.addSubview(closeButton)
        
        // Setup top border constraints
        NSLayoutConstraint.activate([
            topBorder.topAnchor.constraint(equalTo: containerView.topAnchor),
            topBorder.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            topBorder.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            topBorder.heightAnchor.constraint(equalToConstant: 0.5)
        ])
    }
    
    private func setupConstraints() {
        containerView.translatesAutoresizingMaskIntoConstraints = false
        thumbnailImageView.translatesAutoresizingMaskIntoConstraints = false
        iconBackgroundView.translatesAutoresizingMaskIntoConstraints = false
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        headerLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        progressView.translatesAutoresizingMaskIntoConstraints = false
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        
        let safeArea = view.safeAreaLayoutGuide
        
        NSLayoutConstraint.activate([
            // Container at bottom
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            containerView.heightAnchor.constraint(equalToConstant: 88 + view.safeAreaInsets.bottom),
            
            // Thumbnail/Icon container (64x64, left side)
            thumbnailImageView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            thumbnailImageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            thumbnailImageView.widthAnchor.constraint(equalToConstant: 64),
            thumbnailImageView.heightAnchor.constraint(equalToConstant: 64),
            
            iconBackgroundView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            iconBackgroundView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            iconBackgroundView.widthAnchor.constraint(equalToConstant: 64),
            iconBackgroundView.heightAnchor.constraint(equalToConstant: 64),
            
            iconImageView.centerXAnchor.constraint(equalTo: iconBackgroundView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: iconBackgroundView.centerYAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 32),
            iconImageView.heightAnchor.constraint(equalToConstant: 32),
            
            // Close button (top right, 32x32 touch target)
            closeButton.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            closeButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            closeButton.widthAnchor.constraint(equalToConstant: 32),
            closeButton.heightAnchor.constraint(equalToConstant: 32),
            
            // Header label (positioned after thumbnail/icon area)
            headerLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            headerLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 96), // 16 + 64 + 16
            headerLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
            
            // Subtitle label
            subtitleLabel.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: headerLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: headerLabel.trailingAnchor),
            
            // Progress view
            progressView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 8),
            progressView.leadingAnchor.constraint(equalTo: headerLabel.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: headerLabel.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 8)
        ])
    }
    
    // MARK: - UI Updates
    func updateMode(_ newMode: UploadStatusOverlay.OverlayMode) {
        mode = newMode
    }
    
    func updateProgress(_ progress: Float) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveLinear) {
            self.progressView.setProgress(progress, animated: true)
        }
    }
    
    private func updateUI() {
        print("🔧 UploadOverlay updateUI called with mode: \(mode)")
        
        dotAnimationTimer?.invalidate()
        stopPulseAnimation()
        
        switch mode {
        case .uploading(let index, let total, let fileName, let thumbnailData):
            print("🔧 Setting up uploading mode: \(index)/\(total)")
            setupUploadingMode(index: index, total: total, fileName: fileName, thumbnailData: thumbnailData)
            
        case .scanning(let eventName):
            print("🔧 Setting up scanning mode for: \(eventName)")
            setupScanningMode(eventName: eventName)
            
        case .gettingEvent:
            print("🔧 Setting up getting event mode")
            setupGettingEventMode()
            
        case .complete(let uploaded, let duplicates, let outsideDates):
            print("🔧 Setting up complete mode")
            setupCompleteMode(uploaded: uploaded, duplicates: duplicates, outsideDates: outsideDates)
        }
    }
    
    private func setupUploadingMode(index: Int, total: Int, fileName: String, thumbnailData: Data?) {
        thumbnailImageView.isHidden = false
        iconBackgroundView.isHidden = true
        progressView.isHidden = false
        
        headerLabel.text = "Uploading \(index)/\(total)"
        subtitleLabel.text = fileName.isEmpty ? "photo.jpg" : fileName
        
        if let data = thumbnailData, let image = UIImage(data: data) {
            thumbnailImageView.image = image
        } else {
            // Show upload icon as placeholder
            thumbnailImageView.isHidden = true
            iconBackgroundView.isHidden = false
            iconBackgroundView.backgroundColor = UIColor.clear
            
            let symbolConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
            iconImageView.image = UIImage(systemName: "photo", withConfiguration: symbolConfig)
            iconImageView.tintColor = textColor() // Dynamic color for photo icon
        }
    }
    
    private func setupScanningMode(eventName: String) {
        print("🔧 setupScanningMode called with eventName: '\(eventName)'")
        thumbnailImageView.isHidden = true
        iconBackgroundView.isHidden = false
        progressView.isHidden = true
        
        iconBackgroundView.backgroundColor = UIColor.clear
        
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        iconImageView.image = UIImage(systemName: "magnifyingglass.circle.fill", withConfiguration: symbolConfig)
        iconImageView.tintColor = textColor() // Dynamic color for scanning icon
        
        // Store real event name and use it
        realEventName = eventName
        let scanningText = "Scanning \(eventName)"
        print("🔧 About to start dot animation with text: '\(scanningText)'")
        print("🔧 headerLabel before animation: '\(headerLabel.text ?? "nil")'")
        startDotAnimation(baseText: scanningText)
        subtitleLabel.text = "Looking for photos to auto-upload"
        print("🔧 subtitleLabel set to: '\(subtitleLabel.text ?? "nil")'")
        startPulseAnimation()
        
        // Use real event name instead of cycling through mock names
        if !eventName.isEmpty && eventName != "Event" {
            // If we have a real event name, don't cycle
        } else {
            // Only cycle through mock names if no real event name provided
            startEventNameCycling()
        }
    }
    
    private func setupGettingEventMode() {
        thumbnailImageView.isHidden = true
        iconBackgroundView.isHidden = false
        progressView.isHidden = true
        
        iconBackgroundView.backgroundColor = UIColor.clear
        
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 24, weight: .medium)
        iconImageView.image = UIImage(systemName: "arrow.down.circle.fill", withConfiguration: symbolConfig)
        iconImageView.tintColor = textColor() // Dynamic color for getting events icon
        
        // Set header text immediately first
        headerLabel.text = "Getting Events for Auto Upload"
        subtitleLabel.text = "Loading event details"
        
        // Then start the dot animation
        startDotAnimation(baseText: "Getting Events for Auto Upload")
        startPulseAnimation()
        
        print("🔧 Getting Events mode setup - header: '\(headerLabel.text ?? "nil")', subtitle: '\(subtitleLabel.text ?? "nil")'")
        
        // Auto-transition after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            // Transition to upload mode would happen here
        }
    }
    
    private func setupCompleteMode(uploaded: Int, duplicates: Int, outsideDates: Int) {
        thumbnailImageView.isHidden = true
        iconBackgroundView.isHidden = false
        progressView.isHidden = true
        
        iconBackgroundView.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.1)
        
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
        iconImageView.image = UIImage(systemName: "checkmark.circle.fill", withConfiguration: symbolConfig)
        iconImageView.tintColor = .systemGreen
        
        headerLabel.text = "Upload Complete"
        
        var summaryParts: [String] = []
        if uploaded > 0 { summaryParts.append("\(uploaded) Uploaded") }
        if duplicates > 0 { summaryParts.append("\(duplicates) Duplicates") }
        if outsideDates > 0 { summaryParts.append("\(outsideDates) Outside event dates") }
        
        subtitleLabel.text = summaryParts.isEmpty ? "No photos uploaded" : summaryParts.joined(separator: ", ")
    }
    
    // MARK: - Animations
    private func startDotAnimation(baseText: String) {
        print("🔧 startDotAnimation called with baseText: '\(baseText)'")
        print("🔧 headerLabel exists: \(headerLabel != nil)")
        print("🔧 headerLabel isHidden: \(headerLabel.isHidden)")
        print("🔧 headerLabel superview: \(headerLabel.superview != nil)")
        
        // Stop any existing timer
        dotAnimationTimer?.invalidate()
        dotAnimationTimer = nil
        
        currentDotCount = 0
        
        // Set initial text immediately
        headerLabel.text = baseText
        print("🔧 Set initial headerLabel.text to: '\(baseText)'")
        
        dotAnimationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.currentDotCount = (self.currentDotCount + 1) % 4
            let dots = String(repeating: ".", count: self.currentDotCount)
            let newText = baseText + dots
            self.headerLabel.text = newText
            print("🔧 Dot animation tick - setting headerLabel.text to: '\(newText)'")
        }
    }
    
    private func startEventNameCycling() {
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            
            if case .scanning(_) = self.mode {
                self.currentEventIndex = (self.currentEventIndex + 1) % self.eventNames.count
                let eventName = self.eventNames[self.currentEventIndex]
                self.startDotAnimation(baseText: "Scanning \(eventName)")
            } else {
                timer.invalidate()
            }
        }
    }
    
    private func startPulseAnimation() {
        let scaleAnimation = CABasicAnimation(keyPath: "transform.scale")
        scaleAnimation.fromValue = 1.0
        scaleAnimation.toValue = 1.1
        scaleAnimation.duration = 1.5
        scaleAnimation.autoreverses = true
        scaleAnimation.repeatCount = .infinity
        
        let opacityAnimation = CABasicAnimation(keyPath: "opacity")
        opacityAnimation.fromValue = 0.6
        opacityAnimation.toValue = 1.0
        opacityAnimation.duration = 1.5
        opacityAnimation.autoreverses = true
        opacityAnimation.repeatCount = .infinity
        
        iconImageView.layer.add(scaleAnimation, forKey: "pulse-scale")
        iconImageView.layer.add(opacityAnimation, forKey: "pulse-opacity")
    }
    
    private func stopPulseAnimation() {
        iconImageView.layer.removeAnimation(forKey: "pulse-scale")
        iconImageView.layer.removeAnimation(forKey: "pulse-opacity")
    }
    
    // MARK: - Actions
    @objc private func closeTapped() {
        dotAnimationTimer?.invalidate()
        
        UIView.animate(withDuration: 0.3, animations: {
            self.containerView.transform = CGAffineTransform(translationX: 0, y: 200)
        }) { _ in
            self.onClose?()
        }
    }
}