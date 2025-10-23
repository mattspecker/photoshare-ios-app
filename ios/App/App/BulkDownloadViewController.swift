import UIKit
import Photos

/**
 * View controller for bulk photo selection and download.
 * Displays photos in two sections: "Event Photos" (others) and "My Photos" (own).
 * Supports individual and "Select All" selection with download functionality.
 * Matches Android BulkDownloadActivity functionality.
 */
class BulkDownloadViewController: UIViewController {
    private static let TAG = "BulkDownloadViewController"
    
    // MARK: - UI Components
    private var collectionView: UICollectionView!
    private var selectionControlsView: UIView!
    private var selectionCountLabel: UILabel!
    private var downloadButton: UIButton!
    private var clearButton: UIButton!
    
    // MARK: - Properties
    private var eventId: String = ""
    private var eventName: String = ""
    private var otherPhotos: [GalleryPhotoItem] = []
    private var myPhotos: [GalleryPhotoItem] = []
    
    // Collection view adapter
    private var adapter: BulkDownloadCollectionViewAdapter!
    
    // Selection state
    private var hasSelections = false
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        setupNavigationBar()
        setupCollectionView()
        setupSelectionControls()
        loadPhotos()
        
        NSLog("📱 BulkDownloadViewController created for event: \(eventName) (\(eventId))")
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Create collection view
        let layout = UICollectionViewFlowLayout()
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        collectionView.backgroundColor = .clear
        view.addSubview(collectionView)
        
        // Create selection controls view
        selectionControlsView = UIView()
        selectionControlsView.translatesAutoresizingMaskIntoConstraints = false
        selectionControlsView.backgroundColor = .systemBackground
        selectionControlsView.layer.borderWidth = 1
        selectionControlsView.layer.borderColor = UIColor.systemGray4.cgColor
        view.addSubview(selectionControlsView)
        
        // Create selection count label
        selectionCountLabel = UILabel()
        selectionCountLabel.translatesAutoresizingMaskIntoConstraints = false
        selectionCountLabel.font = UIFont(name: "Outfit-Medium", size: 16) ?? UIFont.systemFont(ofSize: 16, weight: .medium)
        selectionCountLabel.textColor = .label
        selectionControlsView.addSubview(selectionCountLabel)
        
        // Create download button
        downloadButton = UIButton(type: .system)
        downloadButton.translatesAutoresizingMaskIntoConstraints = false
        downloadButton.setTitle("Download", for: .normal)
        downloadButton.titleLabel?.font = UIFont(name: "Outfit-Bold", size: 16) ?? UIFont.boldSystemFont(ofSize: 16)
        selectionControlsView.addSubview(downloadButton)
        
        // Create clear button
        clearButton = UIButton(type: .system)
        clearButton.translatesAutoresizingMaskIntoConstraints = false
        clearButton.setTitle("Clear", for: .normal)
        clearButton.titleLabel?.font = UIFont(name: "Outfit-Regular", size: 16) ?? UIFont.systemFont(ofSize: 16)
        selectionControlsView.addSubview(clearButton)
        
        // Layout constraints
        NSLayoutConstraint.activate([
            // Collection view
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: selectionControlsView.topAnchor),
            
            // Selection controls view
            selectionControlsView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            selectionControlsView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            selectionControlsView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            selectionControlsView.heightAnchor.constraint(equalToConstant: 80),
            
            // Selection count label
            selectionCountLabel.topAnchor.constraint(equalTo: selectionControlsView.topAnchor, constant: 10),
            selectionCountLabel.leadingAnchor.constraint(equalTo: selectionControlsView.leadingAnchor, constant: 16),
            selectionCountLabel.trailingAnchor.constraint(equalTo: selectionControlsView.trailingAnchor, constant: -16),
            
            // Buttons stack
            downloadButton.topAnchor.constraint(equalTo: selectionCountLabel.bottomAnchor, constant: 10),
            downloadButton.leadingAnchor.constraint(equalTo: selectionControlsView.leadingAnchor, constant: 16),
            downloadButton.bottomAnchor.constraint(equalTo: selectionControlsView.bottomAnchor, constant: -10),
            downloadButton.heightAnchor.constraint(equalToConstant: 44),
            
            clearButton.topAnchor.constraint(equalTo: downloadButton.topAnchor),
            clearButton.leadingAnchor.constraint(equalTo: downloadButton.trailingAnchor, constant: 16),
            clearButton.trailingAnchor.constraint(equalTo: selectionControlsView.trailingAnchor, constant: -16),
            clearButton.bottomAnchor.constraint(equalTo: downloadButton.bottomAnchor),
            clearButton.widthAnchor.constraint(equalTo: downloadButton.widthAnchor),
            clearButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }
    
    // MARK: - Configuration
    
    func configure(eventId: String, eventName: String, photos: [GalleryPhotoItem]) {
        self.eventId = eventId
        self.eventName = eventName
        
        // Section photos by ownership
        sectionPhotos(photos: photos)
        
        NSLog("📊 Loaded \(photos.count) total photos, sectioned into \(otherPhotos.count) other + \(myPhotos.count) mine for event \(eventId)")
    }
    
    // MARK: - Setup Methods
    
    private func setupNavigationBar() {
        title = eventName
        
        // Add close button
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Close",
            style: .plain,
            target: self,
            action: #selector(closeButtonTapped)
        )
    }
    
    private func setupCollectionView() {
        // Create adapter
        adapter = BulkDownloadCollectionViewAdapter()
        
        // Set up collection view layout
        let layout = UICollectionViewFlowLayout()
        layout.minimumInteritemSpacing = 2
        layout.minimumLineSpacing = 2
        layout.sectionInset = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        
        // Calculate item size for 3 columns
        let totalSpacing = layout.minimumInteritemSpacing * 2 + layout.sectionInset.left + layout.sectionInset.right
        let itemWidth = (view.bounds.width - totalSpacing) / 3
        layout.itemSize = CGSize(width: itemWidth, height: itemWidth)
        
        collectionView.collectionViewLayout = layout
        collectionView.dataSource = adapter
        collectionView.delegate = adapter
        
        // Register cells
        collectionView.register(
            BulkDownloadSectionHeaderCell.self,
            forCellWithReuseIdentifier: "BulkDownloadSectionHeaderCell"
        )
        collectionView.register(
            BulkDownloadPhotoCell.self,
            forCellWithReuseIdentifier: "BulkDownloadPhotoCell"
        )
        
        // Set selection change listener
        adapter.onSelectionChanged = { [weak self] selectedOtherCount, selectedMyCount, totalSelected in
            self?.updateSelectionUI(selectedOtherCount: selectedOtherCount, selectedMyCount: selectedMyCount, totalSelected: totalSelected)
        }
    }
    
    private func setupSelectionControls() {
        // Initially hide selection controls
        selectionControlsView.isHidden = true
        
        // Configure buttons
        downloadButton.addTarget(self, action: #selector(downloadButtonTapped), for: .touchUpInside)
        clearButton.addTarget(self, action: #selector(clearButtonTapped), for: .touchUpInside)
        
        // Style buttons
        downloadButton.backgroundColor = .systemBlue
        downloadButton.setTitleColor(.white, for: .normal)
        downloadButton.layer.cornerRadius = 8
        
        clearButton.backgroundColor = .systemGray
        clearButton.setTitleColor(.white, for: .normal)
        clearButton.layer.cornerRadius = 8
    }
    
    private func loadPhotos() {
        // Load photos into adapter
        adapter.setSectionedPhotos(otherPhotos: otherPhotos, myPhotos: myPhotos)
        
        // Update title to show total photo count
        title = "\(eventName) (\(otherPhotos.count + myPhotos.count) photos)"
        
        // Reload collection view
        collectionView.reloadData()
    }
    
    // MARK: - Photo Sectioning
    
    /**
     * Section photos into "other photos" and "my photos" based on ownership
     */
    private func sectionPhotos(photos: [GalleryPhotoItem]) {
        otherPhotos = []
        myPhotos = []
        
        for photo in photos {
            if photo.isOwn {
                myPhotos.append(photo)
            } else {
                otherPhotos.append(photo)
            }
        }
        
        NSLog("📊 Sectioned \(photos.count) photos: \(otherPhotos.count) others, \(myPhotos.count) mine")
    }
    
    // MARK: - Selection Management
    
    private func updateSelectionUI(selectedOtherCount: Int, selectedMyCount: Int, totalSelected: Int) {
        hasSelections = totalSelected > 0
        
        if hasSelections {
            // Show selection controls
            selectionControlsView.isHidden = false
            
            // Update selection count text
            let countText: String
            if selectedOtherCount > 0 && selectedMyCount > 0 {
                countText = "\(totalSelected) photos selected (\(selectedOtherCount) event, \(selectedMyCount) mine)"
            } else if selectedOtherCount > 0 {
                countText = "\(selectedOtherCount) event photos selected"
            } else {
                countText = "\(selectedMyCount) of my photos selected"
            }
            selectionCountLabel.text = countText
            
            // Enable download button
            downloadButton.isEnabled = true
            downloadButton.setTitle("Download Selected (\(totalSelected))", for: .normal)
            
        } else {
            // Hide selection controls when nothing selected
            selectionControlsView.isHidden = true
        }
        
        NSLog("📊 Selection updated: \(selectedOtherCount) other, \(selectedMyCount) mine, \(totalSelected) total")
    }
    
    // MARK: - Actions
    
    @objc private func closeButtonTapped() {
        if hasSelections {
            // Ask user if they want to leave without downloading
            let alert = UIAlertController(
                title: "Leave Without Downloading?",
                message: "You have photos selected. Are you sure you want to leave without downloading them?",
                preferredStyle: .alert
            )
            
            alert.addAction(UIAlertAction(title: "Leave", style: .destructive) { _ in
                self.dismiss(animated: true)
            })
            
            alert.addAction(UIAlertAction(title: "Stay", style: .cancel))
            
            present(alert, animated: true)
        } else {
            dismiss(animated: true)
        }
    }
    
    @objc private func downloadButtonTapped() {
        let selectedPhotos = adapter.getAllSelectedPhotos()
        
        guard !selectedPhotos.isEmpty else {
            showToast(message: "No photos selected")
            return
        }
        
        NSLog("📥 Starting bulk download of \(selectedPhotos.count) photos")
        
        // Check WiFi preference first
        if !canDownloadNow(photoCount: selectedPhotos.count) {
            showWifiRestrictionDialog(photoCount: selectedPhotos.count)
            return
        }
        
        // Show download confirmation
        showDownloadConfirmation(selectedPhotos: selectedPhotos)
    }
    
    @objc private func clearButtonTapped() {
        adapter.clearSelection()
        collectionView.reloadData()
    }
    
    // MARK: - Download Logic
    
    private func canDownloadNow(photoCount: Int) -> Bool {
        // Check WiFi-only preference from UserDefaults
        let wifiOnlyEnabled = UserDefaults.standard.bool(forKey: "wifiOnlyUpload")
        
        if !wifiOnlyEnabled {
            // WiFi-only not enabled, allow downloads on any connection
            NSLog("📶 WiFi-only disabled - allowing download on any connection")
            return true
        }
        
        // WiFi-only is enabled, check current network type
        // TODO: Implement proper network type detection for iOS
        // For now, allow downloads (can be enhanced later)
        NSLog("📶 WiFi-only enabled - network check not implemented yet, allowing download")
        return true
    }
    
    private func showWifiRestrictionDialog(photoCount: Int) {
        let alert = UIAlertController(
            title: "WiFi-Only Downloads Enabled",
            message: "You have \(photoCount) photos selected for download, but you're currently on cellular data.\n\nYou can either:\n• Update your settings to allow downloads on cellular\n• Wait until you're connected to WiFi",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Update Settings", style: .default) { _ in
            self.showToast(message: "Settings integration coming soon")
        })
        
        alert.addAction(UIAlertAction(title: "Wait for WiFi", style: .default) { _ in
            self.showToast(message: "Download will start when WiFi is available")
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        present(alert, animated: true)
    }
    
    private func showDownloadConfirmation(selectedPhotos: [GalleryPhotoItem]) {
        let alert = UIAlertController(
            title: "Download Photos",
            message: "Download \(selectedPhotos.count) photos to your device?\n\nPhotos will be saved to your device gallery.",
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "Download", style: .default) { _ in
            self.executeDownload(selectedPhotos: selectedPhotos)
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        present(alert, animated: true)
    }
    
    private func executeDownload(selectedPhotos: [GalleryPhotoItem]) {
        NSLog("📥 Executing download of \(selectedPhotos.count) photos")
        
        // Remove initial "Starting..." toast to avoid stacking with progress toasts
        
        // Check photo library permission
        let status = PHPhotoLibrary.authorizationStatus()
        
        switch status {
        case .authorized, .limited:
            performBulkDownload(photos: selectedPhotos)
        case .denied, .restricted:
            showToast(message: "Photo library access denied")
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization { newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self.performBulkDownload(photos: selectedPhotos)
                    } else {
                        self.showToast(message: "Photo library access denied")
                    }
                }
            }
        @unknown default:
            showToast(message: "Unknown photo library authorization status")
        }
    }
    
    private func performBulkDownload(photos: [GalleryPhotoItem]) {
        // Use background queue for downloads
        DispatchQueue.global(qos: .userInitiated).async {
            var successCount = 0
            var failCount = 0
            
            for (index, photo) in photos.enumerated() {
                let currentIndex = index + 1
                
                // Update UI on main thread with progress
                DispatchQueue.main.async {
                    self.showToast(message: "Downloading \(currentIndex) of \(photos.count)...")
                }
                
                // Download and save the photo
                let imageUrl = !photo.getFullUrl().isEmpty ? photo.getFullUrl() : photo.getThumbnailUrl()
                if self.downloadAndSavePhoto(url: imageUrl, photo: photo, index: currentIndex) {
                    successCount += 1
                    NSLog("✅ Successfully downloaded photo \(currentIndex): \(photo.getTitle())")
                } else {
                    failCount += 1
                    NSLog("❌ Failed to download photo \(currentIndex): \(photo.getTitle())")
                }
            }
            
            // Update UI on main thread with results
            DispatchQueue.main.async {
                let message: String
                if failCount == 0 {
                    message = "✅ Successfully downloaded all \(successCount) photos!"
                } else if successCount == 0 {
                    message = "❌ Failed to download all \(failCount) photos"
                } else {
                    message = "Downloaded \(successCount) photos successfully, \(failCount) failed"
                }
                
                self.showToast(message: message)
                
                // Close view controller after download without triggering grid reload
                if successCount > 0 {
                    // Close view controller immediately after brief delay - no grid operations
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        // Clean up memory just before dismissing to avoid any UI updates
                        self.otherPhotos.removeAll()
                        self.myPhotos.removeAll()
                        
                        self.dismiss(animated: true) {
                            // View controller dismissed after successful downloads
                            NSLog("✅ Bulk download completed successfully - \(successCount) photos downloaded")
                        }
                    }
                } else {
                    // If all downloads failed, don't close automatically
                    NSLog("❌ All downloads failed - view controller remains open")
                }
            }
        }
    }
    
    private func downloadAndSavePhoto(url: String, photo: GalleryPhotoItem, index: Int) -> Bool {
        guard let imageUrl = URL(string: url) else {
            NSLog("❌ Invalid URL: \(url)")
            return false
        }
        
        let semaphore = DispatchSemaphore(value: 0)
        var success = false
        
        // Download image data
        URLSession.shared.dataTask(with: imageUrl) { data, response, error in
            defer { semaphore.signal() }
            
            if let error = error {
                NSLog("❌ Download error for \(url): \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                NSLog("❌ HTTP error downloading \(url): \((response as? HTTPURLResponse)?.statusCode ?? -1)")
                return
            }
            
            guard let imageData = data, let image = UIImage(data: imageData) else {
                NSLog("❌ Failed to create image from downloaded data")
                return
            }
            
            // Save to photo library
            success = self.saveBitmapToGallery(image: image, photo: photo, index: index)
        }.resume()
        
        semaphore.wait()
        return success
    }
    
    private func saveBitmapToGallery(image: UIImage, photo: GalleryPhotoItem, index: Int) -> Bool {
        let semaphore = DispatchSemaphore(value: 0)
        var success = false
        
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetChangeRequest.creationRequestForAsset(from: image)
            
            // Try to add to PhotoShare album if it exists
            if let albumRequest = self.getPhotoShareAlbumRequest() {
                if let placeholder = request.placeholderForCreatedAsset {
                    albumRequest.addAssets([placeholder] as NSArray)
                }
            }
        }) { (completed, error) in
            defer { semaphore.signal() }
            
            if completed {
                NSLog("✅ Image saved to photo library successfully: \(photo.getTitle())")
                success = true
            } else {
                let errorMessage = error?.localizedDescription ?? "Unknown error"
                NSLog("❌ Failed to save image: \(errorMessage)")
                success = false
            }
        }
        
        semaphore.wait()
        return success
    }
    
    private func getPhotoShareAlbumRequest() -> PHAssetCollectionChangeRequest? {
        // Try to find existing PhotoShare album
        let fetchOptions = PHFetchOptions()
        fetchOptions.predicate = NSPredicate(format: "title = %@", "PhotoShare")
        let albums = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: fetchOptions)
        
        if let album = albums.firstObject {
            return PHAssetCollectionChangeRequest(for: album)
        } else {
            // Create PhotoShare album
            return PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: "PhotoShare")
        }
    }
    
    // MARK: - Utility Methods
    
    private func showToast(message: String) {
        // Create toast label
        let toastLabel = UILabel()
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.8)
        toastLabel.textColor = UIColor.white
        toastLabel.textAlignment = .center
        toastLabel.font = UIFont(name: "Outfit-Regular", size: 16) ?? UIFont.systemFont(ofSize: 16)
        toastLabel.text = "    \(message)    "  // Add more padding spaces around text
        toastLabel.alpha = 1.0
        toastLabel.layer.cornerRadius = 20
        toastLabel.clipsToBounds = true
        toastLabel.numberOfLines = 0
        
        view.addSubview(toastLabel)
        
        // Auto layout
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            toastLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toastLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 100),
            toastLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            toastLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
            toastLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 40)
        ])
        
        // Animate toast
        UIView.animate(withDuration: 2.0, delay: 1.0, options: .curveEaseOut, animations: {
            toastLabel.alpha = 0.0
        }, completion: { _ in
            toastLabel.removeFromSuperview()
        })
    }
}