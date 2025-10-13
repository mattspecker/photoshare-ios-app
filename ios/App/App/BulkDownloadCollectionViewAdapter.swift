import UIKit

/**
 * Collection view adapter for bulk download photo display.
 * Displays photos in two sections: "Event Photos" (others' photos) and "My Photos" (user's own photos)
 * Supports independent selection tracking for each section with "Select All" buttons.
 * Matches Android BulkDownloadPhotoAdapter functionality.
 */
class BulkDownloadCollectionViewAdapter: NSObject {
    private static let TAG = "BulkDownloadAdapter"
    
    // MARK: - Data Structures
    
    private enum ItemType {
        case sectionHeader(SectionHeaderData)
        case photo(GalleryPhotoItem)
    }
    
    struct SectionHeaderData {
        let title: String
        let photoCount: Int
        let sectionType: String // "other" or "mine"
        let showSelectAll: Bool
    }
    
    // MARK: - Properties
    
    private var items: [ItemType] = []
    private var selectedOtherPhotos: Set<String> = []
    private var selectedMyPhotos: Set<String> = []
    
    // Photo data
    private var otherPhotos: [GalleryPhotoItem] = []
    private var myPhotos: [GalleryPhotoItem] = []
    
    // Callbacks
    var onSelectionChanged: ((Int, Int, Int) -> Void)?
    var onSelectAllOther: (() -> Void)?
    var onSelectAllMine: (() -> Void)?
    
    // MARK: - Public Methods
    
    /**
     * Set sectioned photo data for bulk download display
     */
    func setSectionedPhotos(otherPhotos: [GalleryPhotoItem], myPhotos: [GalleryPhotoItem]) {
        self.otherPhotos = otherPhotos
        self.myPhotos = myPhotos
        
        buildSectionedItems()
        
        NSLog("📋 Set sectioned photos: \(otherPhotos.count) other, \(myPhotos.count) mine")
    }
    
    /**
     * Select all photos in the "Event Photos" section
     */
    func selectAllOther() {
        selectedOtherPhotos.removeAll()
        for photo in otherPhotos {
            selectedOtherPhotos.insert(photo.getPhotoId())
        }
        notifySelectionChanged()
        NSLog("📋 Selected all other photos: \(selectedOtherPhotos.count)")
    }
    
    /**
     * Select all photos in the "My Photos" section
     */
    func selectAllMine() {
        selectedMyPhotos.removeAll()
        for photo in myPhotos {
            selectedMyPhotos.insert(photo.getPhotoId())
        }
        notifySelectionChanged()
        NSLog("📋 Selected all my photos: \(selectedMyPhotos.count)")
    }
    
    /**
     * Clear all selections
     */
    func clearSelection() {
        selectedOtherPhotos.removeAll()
        selectedMyPhotos.removeAll()
        notifySelectionChanged()
        NSLog("📋 Cleared all selections")
    }
    
    /**
     * Toggle selection for a specific photo
     */
    func togglePhotoSelection(_ photo: GalleryPhotoItem) {
        let photoId = photo.getPhotoId()
        
        if photo.getIsOwn() {
            // Toggle in "My Photos" section
            if selectedMyPhotos.contains(photoId) {
                selectedMyPhotos.remove(photoId)
            } else {
                selectedMyPhotos.insert(photoId)
            }
        } else {
            // Toggle in "Event Photos" section
            if selectedOtherPhotos.contains(photoId) {
                selectedOtherPhotos.remove(photoId)
            } else {
                selectedOtherPhotos.insert(photoId)
            }
        }
        
        notifySelectionChanged()
    }
    
    /**
     * Check if a photo is currently selected
     */
    func isPhotoSelected(_ photo: GalleryPhotoItem) -> Bool {
        let photoId = photo.getPhotoId()
        if photo.getIsOwn() {
            return selectedMyPhotos.contains(photoId)
        } else {
            return selectedOtherPhotos.contains(photoId)
        }
    }
    
    /**
     * Get all selected photos as a combined list
     */
    func getAllSelectedPhotos() -> [GalleryPhotoItem] {
        var selected: [GalleryPhotoItem] = []
        
        // Add selected other photos
        for photo in otherPhotos {
            if selectedOtherPhotos.contains(photo.getPhotoId()) {
                selected.append(photo)
            }
        }
        
        // Add selected my photos
        for photo in myPhotos {
            if selectedMyPhotos.contains(photo.getPhotoId()) {
                selected.append(photo)
            }
        }
        
        return selected
    }
    
    /**
     * Get selection counts
     */
    func getSelectedOtherCount() -> Int { return selectedOtherPhotos.count }
    func getSelectedMyCount() -> Int { return selectedMyPhotos.count }
    func getTotalSelectedCount() -> Int { return selectedOtherPhotos.count + selectedMyPhotos.count }
    
    // MARK: - Private Methods
    
    /**
     * Build mixed items list with section headers and photos
     */
    private func buildSectionedItems() {
        items.removeAll()
        
        // Add "Event Photos" section (others' photos)
        if !otherPhotos.isEmpty {
            let header = SectionHeaderData(
                title: "Event Photos",
                photoCount: otherPhotos.count,
                sectionType: "other",
                showSelectAll: true
            )
            items.append(.sectionHeader(header))
            
            for photo in otherPhotos {
                items.append(.photo(photo))
            }
        }
        
        // Add "My Photos" section (user's own photos)
        if !myPhotos.isEmpty {
            let header = SectionHeaderData(
                title: "My Photos",
                photoCount: myPhotos.count,
                sectionType: "mine",
                showSelectAll: true
            )
            items.append(.sectionHeader(header))
            
            for photo in myPhotos {
                items.append(.photo(photo))
            }
        }
        
        NSLog("📋 Built \(items.count) items (\(getSectionCount()) sections + \(otherPhotos.count + myPhotos.count) photos)")
    }
    
    private func getSectionCount() -> Int {
        var count = 0
        if !otherPhotos.isEmpty { count += 1 }
        if !myPhotos.isEmpty { count += 1 }
        return count
    }
    
    private func notifySelectionChanged() {
        onSelectionChanged?(getSelectedOtherCount(), getSelectedMyCount(), getTotalSelectedCount())
    }
}

// MARK: - UICollectionViewDataSource

extension BulkDownloadCollectionViewAdapter: UICollectionViewDataSource {
    
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return items.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let item = items[indexPath.item]
        
        switch item {
        case .sectionHeader(let headerData):
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "BulkDownloadSectionHeaderCell", for: indexPath) as! BulkDownloadSectionHeaderCell
            cell.configure(with: headerData) { [weak self] sectionType in
                if sectionType == "other" {
                    self?.selectAllOther()
                    self?.onSelectAllOther?()
                } else if sectionType == "mine" {
                    self?.selectAllMine()
                    self?.onSelectAllMine?()
                }
                collectionView.reloadData()
            }
            return cell
            
        case .photo(let photo):
            let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "BulkDownloadPhotoCell", for: indexPath) as! BulkDownloadPhotoCell
            let isSelected = isPhotoSelected(photo)
            cell.configure(with: photo, isSelected: isSelected)
            return cell
        }
    }
}

// MARK: - UICollectionViewDelegate

extension BulkDownloadCollectionViewAdapter: UICollectionViewDelegate {
    
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let item = items[indexPath.item]
        
        if case .photo(let photo) = item {
            togglePhotoSelection(photo)
            collectionView.reloadItems(at: [indexPath])
        }
    }
}

// MARK: - UICollectionViewDelegateFlowLayout

extension BulkDownloadCollectionViewAdapter: UICollectionViewDelegateFlowLayout {
    
    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        let item = items[indexPath.item]
        
        switch item {
        case .sectionHeader:
            // Full width for section headers
            return CGSize(width: collectionView.bounds.width - 20, height: 60)
            
        case .photo:
            // 3 columns for photos
            let totalSpacing: CGFloat = 2 * 2 + 10 * 2 // minimumInteritemSpacing + sectionInset
            let itemWidth = (collectionView.bounds.width - totalSpacing) / 3
            return CGSize(width: itemWidth, height: itemWidth)
        }
    }
}

// MARK: - Section Header Cell

class BulkDownloadSectionHeaderCell: UICollectionViewCell {
    private var titleLabel: UILabel!
    private var selectAllButton: UIButton!
    
    private var selectAllCallback: ((String) -> Void)?
    private var sectionType: String = ""
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        backgroundColor = .systemGray6
        layer.cornerRadius = 8
        
        titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .boldSystemFont(ofSize: 18)
        titleLabel.textColor = .label
        contentView.addSubview(titleLabel)
        
        selectAllButton = UIButton(type: .system)
        selectAllButton.translatesAutoresizingMaskIntoConstraints = false
        selectAllButton.setTitle("Select All", for: .normal)
        selectAllButton.titleLabel?.font = .systemFont(ofSize: 16)
        selectAllButton.addTarget(self, action: #selector(selectAllButtonTapped), for: .touchUpInside)
        contentView.addSubview(selectAllButton)
        
        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            titleLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            
            selectAllButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            selectAllButton.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            selectAllButton.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 16)
        ])
    }
    
    func configure(with data: BulkDownloadCollectionViewAdapter.SectionHeaderData, selectAllCallback: @escaping (String) -> Void) {
        titleLabel.text = "\(data.title) (\(data.photoCount))"
        self.sectionType = data.sectionType
        self.selectAllCallback = selectAllCallback
        
        selectAllButton.isHidden = !data.showSelectAll
    }
    
    @objc private func selectAllButtonTapped() {
        selectAllCallback?(sectionType)
    }
}

// MARK: - Photo Cell

class BulkDownloadPhotoCell: UICollectionViewCell {
    private var photoImageView: UIImageView!
    private var selectionCheckbox: UIButton!
    private var selectionOverlay: UIView!
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        // Photo image view
        photoImageView = UIImageView()
        photoImageView.translatesAutoresizingMaskIntoConstraints = false
        photoImageView.contentMode = .scaleAspectFill
        photoImageView.clipsToBounds = true
        photoImageView.layer.cornerRadius = 8
        contentView.addSubview(photoImageView)
        
        // Selection overlay
        selectionOverlay = UIView()
        selectionOverlay.translatesAutoresizingMaskIntoConstraints = false
        selectionOverlay.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.3)
        selectionOverlay.layer.cornerRadius = 8
        selectionOverlay.isHidden = true
        contentView.addSubview(selectionOverlay)
        
        // Selection checkbox
        selectionCheckbox = UIButton(type: .system)
        selectionCheckbox.translatesAutoresizingMaskIntoConstraints = false
        selectionCheckbox.setImage(UIImage(systemName: "circle"), for: .normal)
        selectionCheckbox.setImage(UIImage(systemName: "checkmark.circle.fill"), for: .selected)
        selectionCheckbox.tintColor = .systemBlue
        selectionCheckbox.backgroundColor = UIColor.white.withAlphaComponent(0.8)
        selectionCheckbox.layer.cornerRadius = 12
        selectionCheckbox.isUserInteractionEnabled = false // Let cell handle taps
        contentView.addSubview(selectionCheckbox)
        
        // Layout constraints
        NSLayoutConstraint.activate([
            // Photo image view fills the cell
            photoImageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            photoImageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            photoImageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            photoImageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            // Selection overlay matches photo image view
            selectionOverlay.topAnchor.constraint(equalTo: photoImageView.topAnchor),
            selectionOverlay.leadingAnchor.constraint(equalTo: photoImageView.leadingAnchor),
            selectionOverlay.trailingAnchor.constraint(equalTo: photoImageView.trailingAnchor),
            selectionOverlay.bottomAnchor.constraint(equalTo: photoImageView.bottomAnchor),
            
            // Checkbox in top right corner
            selectionCheckbox.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            selectionCheckbox.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -4),
            selectionCheckbox.widthAnchor.constraint(equalToConstant: 24),
            selectionCheckbox.heightAnchor.constraint(equalToConstant: 24)
        ])
    }
    
    func configure(with photo: GalleryPhotoItem, isSelected: Bool) {
        // Load photo thumbnail using URLSession (since we don't have SDWebImage dependency)
        if let url = URL(string: photo.getThumbnailUrl()) {
            loadImage(from: url)
        } else {
            photoImageView.image = UIImage(systemName: "photo")
        }
        
        // Set selection state
        selectionCheckbox.isSelected = isSelected
        selectionOverlay.isHidden = !isSelected
    }
    
    private func loadImage(from url: URL) {
        // Simple image loading without external dependencies
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data, let image = UIImage(data: data) else {
                DispatchQueue.main.async {
                    self?.photoImageView.image = UIImage(systemName: "photo")
                }
                return
            }
            
            DispatchQueue.main.async {
                self?.photoImageView.image = image
            }
        }.resume()
    }
}