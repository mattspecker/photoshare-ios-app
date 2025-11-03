import Foundation
import Photos
import Capacitor
import UIKit

@objc(NativeGalleryPlugin)
public class NativeGalleryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeGalleryPlugin"
    public let jsName = "NativeGallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openGallery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadPhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sharePhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportPhoto", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    
    // MARK: - Plugin Lifecycle
    override public func load() {
        super.load()
        NSLog("🖼️ NativeGalleryPlugin loaded successfully!")
        NSLog("🖼️ Available methods: isAvailable, openGallery, downloadPhoto, sharePhoto, reportPhoto")
    }
    
    // MARK: - Plugin Methods
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }
    
    @objc func openGallery(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: openGallery called")
        NSLog("🖼️ Call parameters: \(String(describing: call.options))")
        
        guard let photos = call.getArray("photos", JSObject.self) else {
            NSLog("❌ Photos array is missing or invalid")
            call.reject("Photos array is required")
            return
        }
        
        let startIndex = call.getInt("startIndex") ?? 0
        NSLog("🖼️ Received startIndex: \(startIndex)")
        
        // Get eventId from call parameters for context
        let eventId = call.getString("eventId") ?? "unknown"
        
        // Convert JSObject array to expected format for PhotoViewer
        var imageList: [[String: String]] = []
        
        for photo in photos {
            let photoDict = photo as [String: Any]
            
            // Use thumbnailUrl for gallery display, fallback to url for backward compatibility
            let thumbnailUrl = photoDict["thumbnailUrl"] as? String ?? photoDict["url"] as? String ?? ""
            let fullUrl = photoDict["fullUrl"] as? String ?? photoDict["url"] as? String ?? ""
            
            let title = photoDict["title"] as? String ?? ""
            let id = photoDict["id"] as? String ?? ""
            let uploadedBy = photoDict["uploadedBy"] as? String ?? "User"
            let uploadedAt = photoDict["uploadedAt"] as? String ?? ""
            let isOwn = photoDict["isOwn"] as? Bool ?? false
            
            imageList.append([
                "thumbnailUrl": thumbnailUrl,  // For gallery display
                "fullUrl": fullUrl,           // For download/share
                "title": title,
                "id": id,
                "uploadedBy": uploadedBy,
                "uploadedAt": uploadedAt,
                "isOwn": String(isOwn),
                "eventId": eventId
            ])
        }
        
        if imageList.isEmpty {
            call.reject("No valid photos found in array")
            return
        }
        
        NSLog("🖼️ Opening gallery with \(imageList.count) photos, starting at index \(startIndex)")
        
        DispatchQueue.main.async {
            // Use our custom ImageViewerViewController instead of PhotoViewer plugin
            self.presentCustomGallery(imageList: imageList, startIndex: startIndex, call: call)
        }
    }
    
    @objc func downloadPhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: downloadPhoto called")
        
        guard let url = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        // Check photo library permission
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            downloadImageFromUrl(url: url, call: call)
        case .denied, .restricted:
            call.reject("Photo library access denied")
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self.downloadImageFromUrl(url: url, call: call)
                    } else {
                        call.reject("Photo library access denied")
                    }
                }
            }
        @unknown default:
            call.reject("Unknown photo library authorization status")
        }
    }
    
    @objc func sharePhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: sharePhoto called")
        
        // Try to get fullUrl first, fallback to url for backward compatibility
        let fullUrl = call.getString("fullUrl")
        let url = fullUrl ?? call.getString("url")
        
        guard let finalUrl = url else {
            call.reject("URL is required")
            return
        }
        
        NSLog("🖼️ Using URL for share: \(finalUrl)")
        
        DispatchQueue.main.async {
            self.presentShareSheet(url: finalUrl, call: call)
        }
    }
    
    @objc func reportPhoto(_ call: CAPPluginCall) {
        NSLog("🖼️ NativeGallery: reportPhoto called")
        
        guard let photoId = call.getString("photoId") else {
            call.reject("Photo ID is required")
            return
        }
        
        // Send callback to web app
        self.notifyListeners("photoReported", data: ["photoId": photoId])
        
        call.resolve(["success": true, "photoId": photoId])
    }
    
    // MARK: - Private Helper Methods
    
    
    private func presentCustomGallery(imageList: [[String: String]], startIndex: Int, call: CAPPluginCall) {
        NSLog("🖼️ Opening custom ImageViewerViewController with \(imageList.count) photos")
        NSLog("🖼️ Start index: \(startIndex)")
        
        DispatchQueue.main.async {
            guard let topViewController = self.bridge?.viewController else {
                call.reject("Could not get view controller")
                return
            }
            
            // Convert imageList to GalleryPhotoItem array
            var galleryPhotos: [GalleryPhotoItem] = []
            
            for photo in imageList {
                print("📋 [PHOTO DEBUG] Raw photo data from web:")
                print("  - id: '\(photo["id"] ?? "nil")'")
                print("  - uploadedBy: '\(photo["uploadedBy"] ?? "nil")'")
                print("  - uploadedAt: '\(photo["uploadedAt"] ?? "nil")'")
                print("  - uploadDate: '\(photo["uploadDate"] ?? "nil")'")
                print("  - created_at: '\(photo["created_at"] ?? "nil")'")
                print("  - createdAt: '\(photo["createdAt"] ?? "nil")'")
                print("  - timestamp: '\(photo["timestamp"] ?? "nil")'")
                print("  - isOwn: '\(photo["isOwn"] ?? "nil")'")
                print("  - All keys: \(photo.keys.sorted())")
                
                // Try multiple date fields to find the correct one
                let dateFields = [
                    photo["created_at"] as? String,
                    photo["createdAt"] as? String, 
                    photo["uploadedAt"] as? String,
                    photo["uploadDate"] as? String,
                    photo["timestamp"] as? String
                ].compactMap { $0 }.filter { !$0.isEmpty }
                
                let uploadDate = dateFields.first ?? ""
                print("  - Selected date field: '\(uploadDate)' from \(dateFields.count) available")
                print("  - Creating GalleryPhotoItem with uploadDate: '\(uploadDate)'")
                
                let galleryPhoto = GalleryPhotoItem(
                    thumbnailUrl: photo["thumbnailUrl"] ?? "",
                    fullUrl: photo["fullUrl"] ?? "",
                    title: photo["title"] ?? "",
                    uploader: photo["uploadedBy"] ?? "Unknown",
                    uploadDate: uploadDate,
                    photoId: photo["id"] ?? "",
                    isOwn: photo["isOwn"]?.lowercased() == "true"
                )
                
                print("  - GalleryPhotoItem created with uploadDate: '\(galleryPhoto.getUploadDate())')")
                galleryPhotos.append(galleryPhoto)
            }
            
            // Create and configure the custom gallery
            let galleryVC = ImageViewerViewController()
            let reportCallback: (String) -> Void = { [weak self] photoId in
                NSLog("⚠️ Reporting photo: \(photoId)")
                self?.notifyListeners("photoReported", data: ["photoId": photoId])
            }
            galleryVC.configure(
                photos: galleryPhotos,
                initialIndex: startIndex,
                onReportPhoto: reportCallback
            )
            
            galleryVC.modalPresentationStyle = .fullScreen
            topViewController.present(galleryVC, animated: true)
            
            call.resolve(["success": true])
        }
    }
    
    private func convertImagesToJsonString(_ imageList: [[String: String]]) -> String {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: imageList, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
            return jsonString
        } catch {
            NSLog("❌ NativeGallery: Error converting images to JSON: \(error)")
            return "[]"
        }
    }
    
    private func convertToJSONString(_ object: Any) -> String {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: object, options: [])
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            return jsonString
        } catch {
            NSLog("❌ NativeGallery: Error converting object to JSON: \(error)")
            return "{}"
        }
    }
    
    
    
    private func downloadImageFromUrl(url: String, call: CAPPluginCall) {
        guard let imageUrl = URL(string: url) else {
            call.reject("Invalid URL")
            return
        }
        
        NSLog("🖼️ Downloading image from: \(url)")
        
        // Download image data
        URLSession.shared.dataTask(with: imageUrl) { data, response, error in
            if let error = error {
                DispatchQueue.main.async {
                    call.reject("Download failed: \(error.localizedDescription)")
                }
                return
            }
            
            guard let imageData = data, let image = UIImage(data: imageData) else {
                DispatchQueue.main.async {
                    call.reject("Failed to create image from downloaded data")
                }
                return
            }
            
            // Save to photo library
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        NSLog("🖼️ Image saved to photo library successfully")
                        call.resolve(["success": true, "message": "Photo saved to gallery"])
                    } else {
                        let errorMessage = error?.localizedDescription ?? "Unknown error"
                        NSLog("🖼️ Failed to save image: \(errorMessage)")
                        call.reject("Failed to save photo: \(errorMessage)")
                    }
                }
            }
        }.resume()
    }
    
    private func presentShareSheet(url: String, call: CAPPluginCall) {
        guard let imageUrl = URL(string: url) else {
            call.reject("Invalid URL")
            return
        }
        
        NSLog("🖼️ Preparing to share image: \(url)")
        
        // Download image for sharing
        URLSession.shared.dataTask(with: imageUrl) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject("Failed to load image for sharing: \(error.localizedDescription)")
                    return
                }
                
                guard let imageData = data, let image = UIImage(data: imageData) else {
                    call.reject("Failed to create image from data")
                    return
                }
                
                // Create activity view controller
                let activityItems: [Any] = [image, imageUrl]
                let activityViewController = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
                
                // Configure for iPad
                if let popover = activityViewController.popoverPresentationController {
                    popover.sourceView = self.bridge?.viewController?.view
                    popover.sourceRect = CGRect(x: self.bridge?.viewController?.view.bounds.midX ?? 0,
                                              y: self.bridge?.viewController?.view.bounds.midY ?? 0,
                                              width: 0, height: 0)
                    popover.permittedArrowDirections = []
                }
                
                // Present the share sheet
                self.bridge?.viewController?.present(activityViewController, animated: true) {
                    call.resolve(["success": true])
                }
            }
        }.resume()
    }
}

// MARK: - ImageViewerViewController

class ImageViewerViewController: UIViewController {
    private var pageViewController: UIPageViewController!
    private var photos: [GalleryPhotoItem] = []
    private var currentIndex: Int = 0
    private var onReportPhoto: ((String) -> Void)?
    
    // UI Components
    private let topBarContainer = UIView()
    private let bottomBarContainer = UIView()
    private let shareButton = UIButton(type: .system)
    private let closeButton = UIButton(type: .system)
    private let downloadButton = UIButton(type: .system)
    private let reportButton = UIButton(type: .system)
    private let photoByLabel = UILabel()
    private let uploadedOnLabel = UILabel()
    private let photoCounterLabel = UILabel()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupPageViewController()
        updateUI()
    }
    
    func configure(photos: [GalleryPhotoItem], initialIndex: Int, onReportPhoto: @escaping (String) -> Void) {
        self.photos = photos
        self.currentIndex = initialIndex
        self.onReportPhoto = onReportPhoto
    }
    
    private func setupUI() {
        view.backgroundColor = .black
        
        setupTopBar()
        setupBottomBar()
        setupConstraints()
    }
    
    private func setupTopBar() {
        topBarContainer.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        
        // Close button (top right)
        closeButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        closeButton.tintColor = .white
        closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        
        // Share button (top left)
        shareButton.setImage(UIImage(systemName: "square.and.arrow.up"), for: .normal)
        shareButton.tintColor = .white
        shareButton.addTarget(self, action: #selector(shareButtonTapped), for: .touchUpInside)
        
        // Photo counter label (centered between share and close)
        photoCounterLabel.textColor = .white
        photoCounterLabel.font = UIFont.boldSystemFont(ofSize: 16)
        photoCounterLabel.textAlignment = .center
        
        topBarContainer.addSubview(closeButton)
        topBarContainer.addSubview(shareButton)
        topBarContainer.addSubview(photoCounterLabel)
        view.addSubview(topBarContainer)
    }
    
    private func setupBottomBar() {
        bottomBarContainer.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        
        // Download button
        downloadButton.setImage(UIImage(systemName: "arrow.down.to.line"), for: .normal)
        downloadButton.tintColor = .white
        downloadButton.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        downloadButton.layer.cornerRadius = 24
        downloadButton.addTarget(self, action: #selector(downloadButtonTapped), for: .touchUpInside)
        
        // Report button with red flag
        reportButton.setImage(UIImage(systemName: "flag.fill"), for: .normal)
        reportButton.tintColor = .red
        reportButton.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        reportButton.layer.cornerRadius = 24
        reportButton.addTarget(self, action: #selector(reportButtonTapped), for: .touchUpInside)
        
        // Photo by label (first line, bold, larger)
        photoByLabel.textColor = .white
        photoByLabel.font = UIFont.boldSystemFont(ofSize: 18) // 1.25x larger than 14.4, rounded to 18
        photoByLabel.textAlignment = .left
        
        // Uploaded on label (second line, regular, smaller)
        uploadedOnLabel.textColor = .white
        uploadedOnLabel.font = UIFont.systemFont(ofSize: 14)
        uploadedOnLabel.textAlignment = .left
        
        bottomBarContainer.addSubview(downloadButton)
        bottomBarContainer.addSubview(reportButton)
        bottomBarContainer.addSubview(photoByLabel)
        bottomBarContainer.addSubview(uploadedOnLabel)
        view.addSubview(bottomBarContainer)
    }
    
    private func setupConstraints() {
        topBarContainer.translatesAutoresizingMaskIntoConstraints = false
        bottomBarContainer.translatesAutoresizingMaskIntoConstraints = false
        shareButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        downloadButton.translatesAutoresizingMaskIntoConstraints = false
        reportButton.translatesAutoresizingMaskIntoConstraints = false
        photoByLabel.translatesAutoresizingMaskIntoConstraints = false
        uploadedOnLabel.translatesAutoresizingMaskIntoConstraints = false
        photoCounterLabel.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            // Top bar constraints
            topBarContainer.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topBarContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBarContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBarContainer.heightAnchor.constraint(equalToConstant: 60),
            
            // Share button (top left)
            shareButton.leadingAnchor.constraint(equalTo: topBarContainer.leadingAnchor, constant: 20),
            shareButton.centerYAnchor.constraint(equalTo: topBarContainer.centerYAnchor),
            shareButton.widthAnchor.constraint(equalToConstant: 44),
            shareButton.heightAnchor.constraint(equalToConstant: 44),
            
            // Photo counter (centered between share and close)
            photoCounterLabel.centerXAnchor.constraint(equalTo: topBarContainer.centerXAnchor),
            photoCounterLabel.centerYAnchor.constraint(equalTo: topBarContainer.centerYAnchor),
            
            // Close button (top right)
            closeButton.trailingAnchor.constraint(equalTo: topBarContainer.trailingAnchor, constant: -20),
            closeButton.centerYAnchor.constraint(equalTo: topBarContainer.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 44),
            closeButton.heightAnchor.constraint(equalToConstant: 44),
            
            // Bottom bar constraints
            bottomBarContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bottomBarContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBarContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBarContainer.heightAnchor.constraint(equalToConstant: 80),
            
            // Photo by label (first line, left aligned)
            photoByLabel.topAnchor.constraint(equalTo: bottomBarContainer.topAnchor, constant: 12),
            photoByLabel.leadingAnchor.constraint(equalTo: bottomBarContainer.leadingAnchor, constant: 20),
            photoByLabel.trailingAnchor.constraint(lessThanOrEqualTo: downloadButton.leadingAnchor, constant: -20),
            
            // Uploaded on label (second line, left aligned)
            uploadedOnLabel.topAnchor.constraint(equalTo: photoByLabel.bottomAnchor, constant: 2),
            uploadedOnLabel.leadingAnchor.constraint(equalTo: bottomBarContainer.leadingAnchor, constant: 20),
            uploadedOnLabel.trailingAnchor.constraint(lessThanOrEqualTo: downloadButton.leadingAnchor, constant: -20),
            
            // Download button (bottom right, left of report button)
            downloadButton.trailingAnchor.constraint(equalTo: reportButton.leadingAnchor, constant: -12),
            downloadButton.centerYAnchor.constraint(equalTo: bottomBarContainer.centerYAnchor),
            downloadButton.widthAnchor.constraint(equalToConstant: 48),
            downloadButton.heightAnchor.constraint(equalToConstant: 48),
            
            // Report button (bottom right, rightmost)
            reportButton.trailingAnchor.constraint(equalTo: bottomBarContainer.trailingAnchor, constant: -20),
            reportButton.centerYAnchor.constraint(equalTo: bottomBarContainer.centerYAnchor),
            reportButton.widthAnchor.constraint(equalToConstant: 48),
            reportButton.heightAnchor.constraint(equalToConstant: 48)
        ])
    }
    
    private func setupPageViewController() {
        pageViewController = UIPageViewController(
            transitionStyle: .scroll,
            navigationOrientation: .horizontal,
            options: nil
        )
        
        pageViewController.delegate = self
        pageViewController.dataSource = self
        
        addChild(pageViewController)
        view.insertSubview(pageViewController.view, at: 0)
        pageViewController.didMove(toParent: self)
        
        // Setup page view controller constraints
        pageViewController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            pageViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            pageViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            pageViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Set initial view controller
        if !photos.isEmpty {
            let initialViewController = createPhotoViewController(at: currentIndex)
            pageViewController.setViewControllers([initialViewController], direction: .forward, animated: false)
        }
    }
    
    private func createPhotoViewController(at index: Int) -> PhotoPageViewController {
        let photoVC = PhotoPageViewController()
        photoVC.configure(photo: photos[index], index: index)
        return photoVC
    }
    
    private func updateUI() {
        guard currentIndex < photos.count else { return }
        
        let currentPhoto = photos[currentIndex]
        
        // Update photo counter (n/N)
        photoCounterLabel.text = "\(currentIndex + 1)/\(photos.count)"
        
        // Update photo by label (first line, bold)
        let photoBy = currentPhoto.getUploader()
        photoByLabel.text = photoBy.isEmpty ? "Photo by Unknown" : "Photo by \(photoBy)"
        
        // Update uploaded on label (second line, regular)
        let uploadDate = currentPhoto.getUploadDate()
        print("🗓️ [UI DEBUG] Photo \(currentIndex): id='\(currentPhoto.getPhotoId())', uploadDate='\(uploadDate)'")
        if !uploadDate.isEmpty {
            uploadedOnLabel.text = "Uploaded on \(formatDate(uploadDate))"
        } else {
            uploadedOnLabel.text = "Uploaded on Unknown date"
        }
        
        // Hide report button if user owns the photo
        reportButton.isHidden = currentPhoto.getIsOwn()
    }
    
    private func formatDate(_ dateString: String) -> String {
        print("🗓️ [DATE DEBUG] Raw upload date from GalleryPhotoItem: '\(dateString)'")
        
        // Try to parse and format the date string
        let inputFormatter = DateFormatter()
        inputFormatter.timeZone = TimeZone(identifier: "UTC")
        
        // Try common ISO formats including timezone offset
        let formats = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSS+00:00",  // 2025-10-24T13:59:22.585283+00:00
            "yyyy-MM-dd'T'HH:mm:ss.SSSSS+00:00",   // 5 microseconds
            "yyyy-MM-dd'T'HH:mm:ss.SSSS+00:00",    // 4 microseconds
            "yyyy-MM-dd'T'HH:mm:ss.SSS+00:00",     // 3 microseconds
            "yyyy-MM-dd'T'HH:mm:ss+00:00",         // No microseconds
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'",     // Z format
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd"
        ]
        
        for format in formats {
            inputFormatter.dateFormat = format
            if let date = inputFormatter.date(from: dateString) {
                let outputFormatter = DateFormatter()
                outputFormatter.dateFormat = "MMM d, yyyy" // Explicit format: Nov 2, 2024
                outputFormatter.timeZone = TimeZone.current
                let formattedDate = outputFormatter.string(from: date)
                print("🗓️ [DATE DEBUG] Parsed '\(dateString)' as '\(formattedDate)' using format '\(format)'")
                return formattedDate
            }
        }
        
        // If parsing fails, return the original string for debugging
        print("⚠️ [DATE DEBUG] Failed to parse date: '\(dateString)'")
        return dateString
    }
    
    @objc private func closeButtonTapped() {
        dismiss(animated: true)
    }
    
    @objc private func shareButtonTapped() {
        guard currentIndex < photos.count else { return }
        
        let currentPhoto = photos[currentIndex]
        let imageUrl = currentPhoto.getFullUrl().isEmpty ? currentPhoto.getThumbnailUrl() : currentPhoto.getFullUrl()
        
        guard let url = URL(string: imageUrl) else { return }
        
        // Download image and share
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data, let image = UIImage(data: data) else { return }
            
            DispatchQueue.main.async {
                let activityVC = UIActivityViewController(activityItems: [image], applicationActivities: nil)
                activityVC.popoverPresentationController?.sourceView = self?.shareButton
                self?.present(activityVC, animated: true)
            }
        }.resume()
    }
    
    @objc private func downloadButtonTapped() {
        guard currentIndex < photos.count else { return }
        
        let currentPhoto = photos[currentIndex]
        downloadPhotoFromUrl(url: currentPhoto.getFullUrl().isEmpty ? currentPhoto.getThumbnailUrl() : currentPhoto.getFullUrl(), photoId: currentPhoto.getPhotoId())
    }
    
    @objc private func reportButtonTapped() {
        guard currentIndex < photos.count else { return }
        
        let currentPhoto = photos[currentIndex]
        let photoBy = currentPhoto.getUploader()
        
        let alert = UIAlertController(
            title: "Report Photo", 
            message: "Are you sure you want to report this photo by \(photoBy)? This action will notify the event organizer.",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Report", style: .destructive) { _ in
            self.onReportPhoto?(currentPhoto.getPhotoId())
            self.showAlert(title: "Photo Reported", message: "Thank you for reporting this photo. The event organizer has been notified.")
        })
        
        present(alert, animated: true)
    }
    
    private func downloadPhotoFromUrl(url: String, photoId: String) {
        guard let imageUrl = URL(string: url) else {
            print("❌ [DOWNLOAD] Invalid URL: \(url)")
            return
        }
        
        print("🔽 [DOWNLOAD] Starting download for photo: \(photoId)")
        
        URLSession.shared.dataTask(with: imageUrl) { [weak self] data, response, error in
            if let error = error {
                print("❌ [DOWNLOAD] Network error: \(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                print("❌ [DOWNLOAD] No data received")
                return
            }
            
            guard let image = UIImage(data: data) else {
                print("❌ [DOWNLOAD] Failed to create image from data")
                return
            }
            
            DispatchQueue.main.async {
                UIImageWriteToSavedPhotosAlbum(image, self, #selector(self?.image(_:didFinishSavingWithError:contextInfo:)), nil)
            }
        }.resume()
    }
    
    @objc private func image(_ image: UIImage, didFinishSavingWithError error: Error?, contextInfo: UnsafeRawPointer) {
        if let error = error {
            print("❌ [DOWNLOAD] Failed to save image: \(error.localizedDescription)")
            showAlert(title: "Download Failed", message: "Failed to save photo to camera roll")
        } else {
            print("✅ [DOWNLOAD] Image saved successfully")
            showAlert(title: "Download Complete", message: "Photo saved to camera roll")
        }
    }
    
    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

// MARK: - UIPageViewControllerDataSource
extension ImageViewerViewController: UIPageViewControllerDataSource {
    func pageViewController(_ pageViewController: UIPageViewController, viewControllerBefore viewController: UIViewController) -> UIViewController? {
        guard let photoVC = viewController as? PhotoPageViewController,
              photoVC.index > 0 else { return nil }
        
        return createPhotoViewController(at: photoVC.index - 1)
    }
    
    func pageViewController(_ pageViewController: UIPageViewController, viewControllerAfter viewController: UIViewController) -> UIViewController? {
        guard let photoVC = viewController as? PhotoPageViewController,
              photoVC.index < photos.count - 1 else { return nil }
        
        return createPhotoViewController(at: photoVC.index + 1)
    }
}

// MARK: - UIPageViewControllerDelegate
extension ImageViewerViewController: UIPageViewControllerDelegate {
    func pageViewController(_ pageViewController: UIPageViewController, didFinishAnimating finished: Bool, previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
        
        guard completed,
              let currentViewController = pageViewController.viewControllers?.first as? PhotoPageViewController else { return }
        
        currentIndex = currentViewController.index
        updateUI()
        
        print("📱 [GALLERY] Swiped to photo \(currentIndex + 1)/\(photos.count)")
    }
}

// MARK: - PhotoPageViewController
class PhotoPageViewController: UIViewController {
    private let imageView = UIImageView()
    private let scrollView = UIScrollView()
    var index: Int = 0
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupScrollView()
        setupImageView()
    }
    
    func configure(photo: GalleryPhotoItem, index: Int) {
        self.index = index
        loadImage(from: photo)
    }
    
    private func setupScrollView() {
        scrollView.delegate = self
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 3.0
        scrollView.showsVerticalScrollIndicator = false
        scrollView.showsHorizontalScrollIndicator = false
        
        view.addSubview(scrollView)
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupImageView() {
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        
        scrollView.addSubview(imageView)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            imageView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            imageView.heightAnchor.constraint(equalTo: scrollView.heightAnchor)
        ])
    }
    
    private func loadImage(from photo: GalleryPhotoItem) {
        let imageUrl = photo.getFullUrl().isEmpty ? photo.getThumbnailUrl() : photo.getFullUrl()
        
        guard let url = URL(string: imageUrl) else {
            print("❌ [IMAGE] Invalid URL: \(imageUrl)")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data, let image = UIImage(data: data) else {
                print("❌ [IMAGE] Failed to load image from: \(imageUrl)")
                return
            }
            
            DispatchQueue.main.async {
                self?.imageView.image = image
            }
        }.resume()
    }
}

// MARK: - UIScrollViewDelegate
extension PhotoPageViewController: UIScrollViewDelegate {
    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return imageView
    }
}