# Custom Sticker System Architecture for PhotoShare

## Overview
This document outlines the complete architecture for implementing a custom sticker system in the PhotoShare app, including database schema, file storage, API design, and iOS integration.

## 1. Database Schema

### PostgreSQL/Supabase Schema

```sql
-- Sticker Packs Table
CREATE TABLE sticker_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(100), -- 'emoji', 'custom', 'seasonal', 'branded'
    is_premium BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual Stickers Table
CREATE TABLE stickers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID REFERENCES sticker_packs(id) ON DELETE CASCADE,
    name VARCHAR(255),
    image_url TEXT NOT NULL, -- CDN URL for the sticker
    thumbnail_url TEXT, -- Smaller version for picker
    file_type VARCHAR(10), -- 'png', 'svg', 'gif'
    width INTEGER,
    height INTEGER,
    tags TEXT[], -- Array of searchable tags
    sort_order INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0, -- Track popularity
    created_at TIMESTAMP DEFAULT NOW()
);

-- User's Sticker Access (if needed for premium)
CREATE TABLE user_sticker_packs (
    user_id UUID REFERENCES users(id),
    pack_id UUID REFERENCES sticker_packs(id),
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, pack_id)
);

-- Recently Used Stickers
CREATE TABLE user_recent_stickers (
    user_id UUID REFERENCES users(id),
    sticker_id UUID REFERENCES stickers(id),
    used_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, sticker_id)
);

-- Indexes for performance
CREATE INDEX idx_stickers_pack_id ON stickers(pack_id);
CREATE INDEX idx_stickers_usage_count ON stickers(usage_count DESC);
CREATE INDEX idx_user_recent_stickers_used_at ON user_recent_stickers(used_at DESC);
```

## 2. File Storage Structure

### CDN/Storage Bucket Organization

```
/stickers/
  /packs/
    /photoshare-branded/
      icon.png                    # Pack icon (200x200)
    /summer-2024/
      icon.png
    /wedding-pack/
      icon.png
  /images/
    /photoshare-branded/
      logo-watermark.png          # Original size
      logo-watermark-thumb.png    # Thumbnail (100x100)
      celebration-1.png
      celebration-1-thumb.png
    /summer-2024/
      sun-1.png
      sun-1-thumb.png
      beach-ball.png
      beach-ball-thumb.png
    /custom-uploads/
      {user-id}/
        custom-sticker-1.png
        custom-sticker-1-thumb.png
```

## 3. API Endpoints

### RESTful API Design

```typescript
// Get all available sticker packs for user
GET /api/stickers/packs
Response: {
  packs: [
    {
      id: "uuid",
      name: "PhotoShare Branded",
      icon_url: "https://cdn.../icon.png",
      category: "branded",
      sticker_count: 25,
      is_locked: false,
      preview_stickers: ["url1", "url2", "url3"] // First 3 stickers
    }
  ]
}

// Get stickers in a specific pack
GET /api/stickers/pack/{pack_id}
Response: {
  stickers: [
    {
      id: "uuid",
      name: "Celebration",
      image_url: "https://cdn.../celebration-1.png",
      thumbnail_url: "https://cdn.../celebration-1-thumb.png",
      width: 200,
      height: 200,
      tags: ["party", "celebration", "confetti"]
    }
  ]
}

// Get user's recently used stickers
GET /api/stickers/recent
Response: {
  stickers: [...] // Last 20 used stickers
}

// Search stickers by tags or name
GET /api/stickers/search?q={query}
Response: {
  stickers: [...]
}

// Upload custom sticker
POST /api/stickers/upload
Headers: {
  "Content-Type": "multipart/form-data",
  "Authorization": "Bearer {token}"
}
Body: FormData with image file
Response: {
  sticker: {
    id: "uuid",
    image_url: "https://cdn.../custom-sticker.png",
    thumbnail_url: "https://cdn.../custom-sticker-thumb.png"
  }
}

// Track sticker usage (for analytics/recent)
POST /api/stickers/{sticker_id}/use
Response: { success: true }

// Admin: Create new sticker pack
POST /api/admin/stickers/packs
Body: {
  name: "Summer 2024",
  description: "Summer themed stickers",
  category: "seasonal",
  icon: "base64_or_url"
}

// Admin: Add stickers to pack
POST /api/admin/stickers/pack/{pack_id}/stickers
Body: FormData with multiple image files
```

## 4. Image Requirements & Specifications

### File Specifications

```yaml
Sticker Image Requirements:
  Supported Formats:
    - PNG (recommended for transparency)
    - SVG (for scalable graphics)
    - GIF (for animated stickers)
    - WebP (for web optimization)
    
  Size Requirements:
    Original:
      - Minimum: 200x200px
      - Maximum: 1024x1024px
      - File size: <500KB
      - Aspect ratio: Flexible (square preferred)
    
    Thumbnail:
      - Fixed size: 100x100px
      - File size: <50KB
      - Format: PNG or WebP
      
  Technical Requirements:
    - Transparency: Required (PNG alpha channel)
    - Background: Must be transparent
    - DPI: 72 for web, 144 for retina
    - Color space: sRGB
    
  Optimization Guidelines:
    - Use TinyPNG or ImageOptim for compression
    - Generate @2x and @3x versions for iOS
    - Consider WebP for 30% smaller file sizes
    - Maintain transparent backgrounds
    - Remove metadata for smaller files
```

## 5. iOS Implementation

### Swift Models and Network Layer

```swift
// MARK: - Data Models

struct StickerPack: Codable {
    let id: String
    let name: String
    let description: String?
    let iconUrl: String?
    let category: String
    let stickerCount: Int
    let isLocked: Bool
    let previewStickers: [String]
    var stickers: [CustomSticker]?
}

struct CustomSticker: Codable {
    let id: String
    let name: String
    let imageUrl: String
    let thumbnailUrl: String?
    let width: Int
    let height: Int
    let fileType: String
    let tags: [String]?
    let isAnimated: Bool
    
    var isGif: Bool {
        return fileType.lowercased() == "gif"
    }
}

// MARK: - Network Manager

class StickerNetworkManager {
    static let shared = StickerNetworkManager()
    private let cache = NSCache<NSString, UIImage>()
    private let baseURL = "https://api.photo-share.app"
    
    // Fetch all sticker packs
    func fetchStickerPacks(completion: @escaping ([StickerPack]?) -> Void) {
        guard let url = URL(string: "\(baseURL)/api/stickers/packs") else {
            completion(nil)
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, _, error in
            guard let data = data, error == nil else {
                completion(nil)
                return
            }
            
            do {
                let response = try JSONDecoder().decode(StickerPacksResponse.self, from: data)
                DispatchQueue.main.async {
                    completion(response.packs)
                }
            } catch {
                print("Error decoding sticker packs: \(error)")
                completion(nil)
            }
        }.resume()
    }
    
    // Fetch stickers for a specific pack
    func fetchStickers(packId: String, completion: @escaping ([CustomSticker]?) -> Void) {
        guard let url = URL(string: "\(baseURL)/api/stickers/pack/\(packId)") else {
            completion(nil)
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, _, error in
            guard let data = data, error == nil else {
                completion(nil)
                return
            }
            
            do {
                let response = try JSONDecoder().decode(StickersResponse.self, from: data)
                DispatchQueue.main.async {
                    completion(response.stickers)
                }
            } catch {
                print("Error decoding stickers: \(error)")
                completion(nil)
            }
        }.resume()
    }
    
    // Fetch and cache sticker images
    func fetchImage(from urlString: String, completion: @escaping (UIImage?) -> Void) {
        // Check cache first
        if let cachedImage = cache.object(forKey: urlString as NSString) {
            completion(cachedImage)
            return
        }
        
        guard let url = URL(string: urlString) else {
            completion(nil)
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data = data, let image = UIImage(data: data) else {
                DispatchQueue.main.async {
                    completion(nil)
                }
                return
            }
            
            // Cache image
            self?.cache.setObject(image, forKey: urlString as NSString)
            
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
    
    // Track sticker usage
    func trackStickerUse(stickerId: String) {
        guard let url = URL(string: "\(baseURL)/api/stickers/\(stickerId)/use") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        URLSession.shared.dataTask(with: request).resume()
    }
}

// MARK: - Response Models

struct StickerPacksResponse: Codable {
    let packs: [StickerPack]
}

struct StickersResponse: Codable {
    let stickers: [CustomSticker]
}
```

### Enhanced Sticker Picker UI

```swift
// MARK: - Enhanced Sticker Picker

class EnhancedStickerPickerViewController: UIViewController {
    private var collectionView: UICollectionView!
    private var segmentedControl: UISegmentedControl!
    private var searchBar: UISearchBar!
    
    private var stickerPacks: [StickerPack] = []
    private var currentStickers: [CustomSticker] = []
    private var recentStickers: [CustomSticker] = []
    private var selectedPackIndex = 0
    
    var completion: ((CustomSticker) -> Void)?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadStickerPacks()
    }
    
    private func setupUI() {
        view.backgroundColor = .black
        
        // Search bar
        searchBar = UISearchBar()
        searchBar.placeholder = "Search stickers..."
        searchBar.searchBarStyle = .minimal
        searchBar.delegate = self
        
        // Segmented control for packs
        segmentedControl = UISegmentedControl()
        segmentedControl.addTarget(self, action: #selector(packChanged), for: .valueChanged)
        
        // Collection view setup
        let layout = UICollectionViewFlowLayout()
        layout.itemSize = CGSize(width: 80, height: 80)
        layout.minimumInteritemSpacing = 10
        layout.minimumLineSpacing = 10
        
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.register(CustomStickerCell.self, forCellWithReuseIdentifier: "CustomStickerCell")
        
        // Layout constraints
        // ... setup constraints
    }
    
    private func loadStickerPacks() {
        StickerNetworkManager.shared.fetchStickerPacks { [weak self] packs in
            guard let packs = packs else { return }
            
            self?.stickerPacks = packs
            self?.updateSegmentedControl()
            
            // Load first pack
            if let firstPack = packs.first {
                self?.loadStickersForPack(firstPack)
            }
        }
    }
    
    private func loadStickersForPack(_ pack: StickerPack) {
        StickerNetworkManager.shared.fetchStickers(packId: pack.id) { [weak self] stickers in
            guard let stickers = stickers else { return }
            
            self?.currentStickers = stickers
            self?.collectionView.reloadData()
        }
    }
    
    @objc private func packChanged() {
        let index = segmentedControl.selectedSegmentIndex
        guard index < stickerPacks.count else { return }
        
        selectedPackIndex = index
        loadStickersForPack(stickerPacks[index])
    }
}

// MARK: - Custom Sticker Cell

class CustomStickerCell: UICollectionViewCell {
    private let imageView = UIImageView()
    private let loadingIndicator = UIActivityIndicatorView(style: .white)
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCell()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupCell() {
        contentView.backgroundColor = UIColor.white.withAlphaComponent(0.1)
        contentView.layer.cornerRadius = 8
        
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(imageView)
        
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(loadingIndicator)
        
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -8),
            imageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: contentView.centerYAnchor)
        ])
    }
    
    func configure(with sticker: CustomSticker) {
        imageView.image = nil
        loadingIndicator.startAnimating()
        
        let urlToLoad = sticker.thumbnailUrl ?? sticker.imageUrl
        
        StickerNetworkManager.shared.fetchImage(from: urlToLoad) { [weak self] image in
            self?.loadingIndicator.stopAnimating()
            self?.imageView.image = image
            
            // Add animation for GIFs if needed
            if sticker.isGif {
                // Handle animated GIFs
                self?.loadGifAnimation(from: sticker.imageUrl)
            }
        }
    }
    
    private func loadGifAnimation(from url: String) {
        // Implementation for GIF animation
        // You can use libraries like SDWebImage or Kingfisher for GIF support
    }
}
```

## 6. Web Admin Interface

### Admin Panel for Sticker Management

```typescript
// TypeScript/React Admin Interface

interface StickerManager {
  // Upload new sticker pack
  async createPack(pack: {
    name: string;
    description: string;
    icon: File;
    category: string;
  }): Promise<StickerPack>;
  
  // Add stickers to pack
  async addStickers(packId: string, stickers: File[]): Promise<void>;
  
  // Process uploaded images
  async processSticker(file: File): Promise<{
    original: string;  // CDN URL
    thumbnail: string; // CDN URL
    dimensions: { width: number; height: number };
  }>;
  
  // Delete sticker
  async deleteSticker(stickerId: string): Promise<void>;
  
  // Update sticker metadata
  async updateSticker(stickerId: string, updates: {
    name?: string;
    tags?: string[];
    sort_order?: number;
  }): Promise<void>;
}

// Image processing pipeline
async function processUploadedSticker(file: File) {
  // 1. Validate file
  if (!['image/png', 'image/svg+xml', 'image/gif'].includes(file.type)) {
    throw new Error('Invalid file type. Supported: PNG, SVG, GIF');
  }
  
  if (file.size > 500 * 1024) { // 500KB limit
    throw new Error('File too large. Maximum size: 500KB');
  }
  
  // 2. Read image dimensions
  const dimensions = await getImageDimensions(file);
  
  if (dimensions.width < 200 || dimensions.height < 200) {
    throw new Error('Image too small. Minimum size: 200x200px');
  }
  
  // 3. Create thumbnail
  const thumbnail = await resizeImage(file, 100, 100);
  
  // 4. Optimize both images
  const optimizedOriginal = await optimizeImage(file);
  const optimizedThumbnail = await optimizeImage(thumbnail);
  
  // 5. Upload to CDN/Storage
  const [originalUrl, thumbnailUrl] = await Promise.all([
    uploadToCDN(optimizedOriginal, 'stickers/images/'),
    uploadToCDN(optimizedThumbnail, 'stickers/thumbnails/')
  ]);
  
  return { 
    originalUrl, 
    thumbnailUrl,
    dimensions 
  };
}

// React Component for Admin UI
const StickerPackManager: React.FC = () => {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const handleCreatePack = async (packData: CreatePackData) => {
    try {
      const newPack = await api.createStickerPack(packData);
      setPacks([...packs, newPack]);
      toast.success('Sticker pack created successfully');
    } catch (error) {
      toast.error('Failed to create sticker pack');
    }
  };
  
  const handleUploadStickers = async (files: FileList) => {
    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const processed = await processUploadedSticker(file);
        return api.addStickerToPack(selectedPack!, {
          name: file.name.replace(/\.[^/.]+$/, ''),
          ...processed
        });
      });
      
      await Promise.all(uploadPromises);
      toast.success(`${files.length} stickers uploaded successfully`);
    } catch (error) {
      toast.error('Failed to upload stickers');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="sticker-manager">
      <h2>Sticker Pack Management</h2>
      
      <div className="pack-list">
        {packs.map(pack => (
          <div key={pack.id} className="pack-card">
            <img src={pack.iconUrl} alt={pack.name} />
            <h3>{pack.name}</h3>
            <p>{pack.stickerCount} stickers</p>
            <button onClick={() => setSelectedPack(pack.id)}>
              Manage Stickers
            </button>
          </div>
        ))}
      </div>
      
      {selectedPack && (
        <div className="sticker-upload">
          <h3>Upload Stickers</h3>
          <DropZone 
            accept="image/png,image/svg+xml,image/gif"
            multiple
            onDrop={handleUploadStickers}
            disabled={uploading}
          />
        </div>
      )}
    </div>
  );
};
```

## 7. Supabase Integration

### Storage Bucket Setup

```typescript
// Supabase Storage Configuration

// 1. Create storage buckets
const { data, error } = await supabase.storage.createBucket('stickers', {
  public: true,
  fileSizeLimit: 524288, // 500KB
  allowedMimeTypes: ['image/png', 'image/svg+xml', 'image/gif']
});

// 2. Storage policies
const policies = {
  // Public read access
  "SELECT": `bucket_id = 'stickers'`,
  
  // Admin write access
  "INSERT": `bucket_id = 'stickers' AND auth.jwt() ->> 'role' = 'admin'`,
  "UPDATE": `bucket_id = 'stickers' AND auth.jwt() ->> 'role' = 'admin'`,
  "DELETE": `bucket_id = 'stickers' AND auth.jwt() ->> 'role' = 'admin'`
};

// 3. Helper functions for Supabase
export async function uploadStickerToSupabase(
  file: File,
  packId: string
): Promise<{ url: string; thumbnailUrl: string }> {
  const fileName = `${packId}/${Date.now()}-${file.name}`;
  const thumbnailName = `${packId}/thumb-${Date.now()}-${file.name}`;
  
  // Upload original
  const { data: originalData, error: originalError } = await supabase.storage
    .from('stickers')
    .upload(`images/${fileName}`, file);
    
  if (originalError) throw originalError;
  
  // Create and upload thumbnail
  const thumbnail = await createThumbnail(file);
  const { data: thumbData, error: thumbError } = await supabase.storage
    .from('stickers')
    .upload(`thumbnails/${thumbnailName}`, thumbnail);
    
  if (thumbError) throw thumbError;
  
  // Get public URLs
  const { data: { publicUrl: originalUrl } } = supabase.storage
    .from('stickers')
    .getPublicUrl(`images/${fileName}`);
    
  const { data: { publicUrl: thumbnailUrl } } = supabase.storage
    .from('stickers')
    .getPublicUrl(`thumbnails/${thumbnailName}`);
  
  return { url: originalUrl, thumbnailUrl };
}

// 4. Database functions
export async function createStickerPack(pack: CreatePackInput) {
  const { data, error } = await supabase
    .from('sticker_packs')
    .insert(pack)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function addStickerToPack(
  packId: string,
  sticker: CreateStickerInput
) {
  const { data, error } = await supabase
    .from('stickers')
    .insert({
      pack_id: packId,
      ...sticker
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}
```

## 8. Quick Start Implementation

### Option 1: Start with Bundled Stickers (No Backend)

```swift
// Immediate implementation without backend

struct BundledStickerPacks {
    static let packs = [
        StickerPack(
            id: "emoji",
            name: "Emoji",
            description: "Popular emoji stickers",
            iconUrl: nil,
            category: "emoji",
            stickerCount: 50,
            isLocked: false,
            previewStickers: [],
            stickers: [
                CustomSticker(
                    id: "1",
                    name: "Camera",
                    imageUrl: "📸", // Using emoji directly
                    thumbnailUrl: nil,
                    width: 100,
                    height: 100,
                    fileType: "emoji",
                    tags: ["camera", "photo"],
                    isAnimated: false
                ),
                // Add more emoji...
            ]
        ),
        StickerPack(
            id: "photoshare",
            name: "PhotoShare",
            description: "Official PhotoShare stickers",
            iconUrl: "logo",
            category: "branded",
            stickerCount: 10,
            isLocked: false,
            previewStickers: [],
            stickers: [
                CustomSticker(
                    id: "ps1",
                    name: "Logo",
                    imageUrl: "photoshare_logo", // Bundle resource name
                    thumbnailUrl: nil,
                    width: 200,
                    height: 200,
                    fileType: "png",
                    tags: ["logo", "brand"],
                    isAnimated: false
                ),
                // Add bundled images...
            ]
        )
    ]
}

// Load bundled image
func loadBundledSticker(named: String) -> UIImage? {
    if named.count == 1 {
        // It's an emoji
        return emojiToImage(named)
    } else {
        // It's a bundled image
        return UIImage(named: named)
    }
}

func emojiToImage(_ emoji: String) -> UIImage? {
    let label = UILabel()
    label.text = emoji
    label.font = UIFont.systemFont(ofSize: 60)
    label.sizeToFit()
    
    UIGraphicsBeginImageContextWithOptions(
        CGSize(width: 80, height: 80),
        false,
        UIScreen.main.scale
    )
    
    label.center = CGPoint(x: 40, y: 40)
    label.layer.render(in: UIGraphicsGetCurrentContext()!)
    
    let image = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    
    return image
}
```

### Option 2: Hybrid Approach (Bundled + API)

```swift
class HybridStickerManager {
    private var bundledPacks = BundledStickerPacks.packs
    private var remotePacks: [StickerPack] = []
    
    func getAllPacks() -> [StickerPack] {
        // Combine bundled and remote packs
        return bundledPacks + remotePacks
    }
    
    func loadRemotePacks() {
        StickerNetworkManager.shared.fetchStickerPacks { [weak self] packs in
            self?.remotePacks = packs ?? []
        }
    }
}
```

## 9. Implementation Checklist

### Phase 1: MVP (1-2 days)
- [ ] Add bundled emoji stickers to iOS app
- [ ] Update StickerPickerViewController to support tabs
- [ ] Implement basic sticker selection and placement
- [ ] Test with PhotoEditor integration

### Phase 2: Backend Setup (2-3 days)
- [ ] Create Supabase tables
- [ ] Set up storage buckets
- [ ] Implement API endpoints
- [ ] Create admin upload interface

### Phase 3: Full Integration (2-3 days)
- [ ] Add network layer to iOS app
- [ ] Implement image caching
- [ ] Add loading states and error handling
- [ ] Support animated GIFs

### Phase 4: Enhancement (1-2 days)
- [ ] Add sticker search functionality
- [ ] Implement recent stickers
- [ ] Add usage analytics
- [ ] Support premium packs

## 10. Sample API Implementation Request

When ready to implement, provide:

```markdown
## Implementation Request

### Sticker Pack: "PhotoShare Branded"
- **Category**: branded
- **Description**: Official PhotoShare stickers and watermarks

### Stickers to Include:
1. **Logo Watermark**
   - File: logo-watermark.png (300x100)
   - Tags: [logo, watermark, brand]
   
2. **Shared Badge**
   - File: shared-badge.png (200x200)
   - Text: "Shared with ❤️"
   - Tags: [badge, love, shared]
   
3. **Event Frame**
   - File: event-frame.png (400x400)
   - Transparent center for photo
   - Tags: [frame, event, border]
   
4. **Celebration Confetti**
   - File: confetti.gif (300x300)
   - Animated falling confetti
   - Tags: [celebration, party, animated]

### Database Details:
- **Platform**: Supabase
- **Project URL**: https://[project-id].supabase.co
- **Storage Bucket**: stickers
- **Tables**: Use schema from section 1

### Design Specifications:
- **Brand Colors**: 
  - Primary: #3B82F6
  - Success: #10B981
  - Accent: #F97316
- **All stickers must have transparent backgrounds**
- **Support @2x and @3x for retina displays**
```

## 11. Testing Scenarios

### Unit Tests
```swift
class StickerTests: XCTestCase {
    func testStickerLoading() {
        // Test loading bundled stickers
        let bundled = BundledStickerPacks.packs.first
        XCTAssertNotNil(bundled)
        XCTAssertGreaterThan(bundled!.stickers!.count, 0)
    }
    
    func testNetworkFetch() {
        // Test API fetch
        let expectation = self.expectation(description: "Fetch stickers")
        
        StickerNetworkManager.shared.fetchStickerPacks { packs in
            XCTAssertNotNil(packs)
            expectation.fulfill()
        }
        
        waitForExpectations(timeout: 5)
    }
    
    func testImageCaching() {
        // Test cache functionality
        let cache = NSCache<NSString, UIImage>()
        let testImage = UIImage()
        cache.setObject(testImage, forKey: "test")
        
        XCTAssertNotNil(cache.object(forKey: "test"))
    }
}
```

### Integration Tests
1. Load sticker picker from camera flow
2. Select and place multiple stickers
3. Test sticker rotation and scaling
4. Verify saved image includes stickers
5. Test network failure scenarios
6. Verify cache performance

## 12. Performance Considerations

### Optimization Strategies
1. **Image Loading**
   - Use thumbnail URLs in picker
   - Load full-size only when selected
   - Implement progressive loading for large GIFs

2. **Caching**
   - Cache thumbnails aggressively
   - Limit cache size to 50MB
   - Clear old cached items after 7 days

3. **Network**
   - Batch API requests when possible
   - Implement retry logic with exponential backoff
   - Use HTTP/2 for parallel downloads

4. **Memory Management**
   - Release unused images from memory
   - Downscale images for display
   - Use weak references in closures

## 13. Future Enhancements

### Roadmap
1. **Version 1.1**
   - User-uploaded custom stickers
   - Sticker favorites
   - Sticker pack sharing

2. **Version 1.2**
   - AI-powered sticker suggestions
   - Animated sticker creation tool
   - Sticker marketplace

3. **Version 2.0**
   - AR stickers
   - Face-tracking stickers
   - Custom sticker packs for events

## Conclusion

This architecture provides a scalable, performant custom sticker system for PhotoShare. Start with Phase 1 (bundled stickers) for immediate functionality, then progressively enhance with backend integration and advanced features.

Key benefits:
- **Scalable**: Supports unlimited sticker packs
- **Performant**: Optimized loading and caching
- **Flexible**: Works offline with bundled stickers
- **Extensible**: Easy to add new sticker types
- **User-friendly**: Intuitive picker interface

Ready to implement when you are!