# Upload Overlay - iOS Implementation Guide

## Overview

This guide provides complete specifications for implementing the upload overlay banner in native iOS. The overlay appears at the bottom of the screen during photo/video uploads and displays real-time progress with five distinct states.

---

## Typography Specifications

### Font Family
- **Primary Font**: San Francisco (system default)
  - **SF Pro Text** for body text and smaller sizes
  - **SF Pro Display** for larger titles
- **Web Equivalent**: "Outfit" (Google Font) - used in web version

### Text Styles

| Element | Style | Size | Weight | Color |
|---------|-------|------|--------|-------|
| Main upload text | `.headline` | 17pt | Semibold | `.label` |
| File name / Subtitle | `.caption1` | 12pt | Regular | `.secondaryLabel` |
| Summary text | `.footnote` | 13pt | Regular | `.tertiaryLabel` |
| Counter text | `.headline` | 17pt | Semibold | `.label` |

### Text Colors
- **Primary text**: `UIColor.label`
- **Secondary text**: `UIColor.secondaryLabel`
- **Muted text**: `UIColor.tertiaryLabel`

---

## Five Overlay States

### 1. Normal Upload (Web & App)
**When**: Uploading photos/videos normally
**UI Elements**:
- Photo thumbnail (64pt × 64pt, rounded 12pt)
- "Uploading n/N" counter
- Truncated filename
- Progress bar (0-100%)
- Close button (X)

**Behavior**: Auto-advances to next photo on success

---

### 2. Upload with Duplicates (Web & App)
**When**: Duplicate photo detected (file hash match)
**UI Elements**: Same as Normal Upload
**Behavior**: Progress completes automatically, auto-advances after 500ms

---

### 3. Upload with Outside Dates (Web & App)
**When**: Photo timestamp is outside event date range
**UI Elements**: Same as Normal Upload
**Behavior**: Progress completes automatically, auto-advances after 500ms

---

### 4. Scanning Events (App Only - Auto Upload)
**When**: App is scanning user's photo library for events
**UI Elements**:
- Search icon (magnifying glass) with pulse animation
- "Scanning [Event Name]..." with animated dots
- Subtitle: "Looking for matching events to auto-upload"
- Close button (X)

**Behavior**: 
- Cycles through event names (mock: "Birthday Party", "Team Meetup", "Weekend Trip")
- Animated dots: "." → ".." → "..." → cycle repeats
- No progress bar

---

### 5. Getting Event for Auto Upload (App Only)
**When**: Fetching event details after user selects an event
**UI Elements**:
- Download icon (arrow down circle) with pulse animation
- "Getting Event for Auto Upload..." with animated dots
- Subtitle: "Loading event details"
- Close button (X)

**Behavior**:
- Fixed 3-second duration
- Animated dots: "." → ".." → "..." → cycle repeats
- No progress bar
- Transitions to Normal Upload state after completion

---

### 6. Upload Complete (Web & App)
**When**: All uploads finished
**UI Elements**:
- Green checkmark icon (64pt × 64pt)
- "Upload Complete" text
- Summary: "n Uploaded, y Duplicates, z Outside event dates"
  - Only shows counts > 0
  - Example: "5 Uploaded, 2 Duplicates"
- Close button (X)

**Behavior**: User must manually dismiss, does not auto-dismiss

---

## Design Specifications

### Container
- **Width**: Full screen width
- **Height**: 88pt (content) + safe area insets
- **Position**: Fixed to bottom of screen
- **Background**: `UIColor.systemBackground`
- **Shadow**: 
  - Offset: (0, -2)
  - Radius: 8pt
  - Opacity: 0.1
  - Color: `UIColor.black`
- **Border**: 0.5pt top border
  - Color: `UIColor.separator`

### Corner Radius
- **Top corners**: 12pt
- **Bottom corners**: 0pt (flush with screen edge)

### Padding & Spacing
- **Container padding**: 16pt all sides
- **Horizontal spacing**: 16pt between thumbnail/icon and content
- **Vertical spacing**: 8pt between text elements
- **Bottom safe area**: Add `view.safeAreaInsets.bottom` or minimum 16pt

### Thumbnail/Icon Container
- **Size**: 64pt × 64pt
- **Corner radius**: 12pt
- **Background**: 
  - Normal upload: Photo image (aspect fill)
  - Scanning: `UIColor.systemBlue.withAlphaComponent(0.1)`
  - Getting event: `UIColor.systemBlue.withAlphaComponent(0.1)`
  - Complete: `UIColor.systemGreen.withAlphaComponent(0.1)`

### Close Button
- **Size**: 32pt × 32pt visible
- **Touch target**: Minimum 44pt × 44pt (add invisible padding)
- **Icon**: SF Symbol `xmark`
- **Icon size**: 14pt
- **Color**: `UIColor.secondaryLabel`
- **Alignment**: Top-right of content area

### Progress Bar
- **Height**: 8pt
- **Corner radius**: 4pt
- **Track color**: `UIColor.systemGray5`
- **Progress color**: `UIColor.systemBlue`
- **Style**: Use `UIProgressView` or custom `CAShapeLayer`

---

## SF Symbols Icon Mappings

| State | SF Symbol | Size | Color | Background |
|-------|-----------|------|-------|------------|
| Upload | `arrow.up.circle.fill` | 32pt | `.systemBlue` | Blue 10% alpha |
| Scanning | `magnifyingglass.circle.fill` | 32pt | `.systemBlue` | Blue 10% alpha |
| Getting Event | `arrow.down.circle.fill` | 32pt | `.systemBlue` | Blue 10% alpha |
| Complete | `checkmark.circle.fill` | 32pt | `.systemGreen` | Green 10% alpha |
| Close | `xmark` | 14pt | `.secondaryLabel` | None |

**How to use SF Symbols**:
```swift
let symbolConfig = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
let image = UIImage(systemName: "magnifyingglass.circle.fill", withConfiguration: symbolConfig)
```

---

## Animation Specifications

### Pulse Animation (Scanning & Getting Event icons)
```swift
// Scale animation
let scaleAnimation = CABasicAnimation(keyPath: "transform.scale")
scaleAnimation.fromValue = 1.0
scaleAnimation.toValue = 1.1
scaleAnimation.duration = 1.5
scaleAnimation.autoreverses = true
scaleAnimation.repeatCount = .infinity

// Opacity animation
let opacityAnimation = CABasicAnimation(keyPath: "opacity")
opacityAnimation.fromValue = 0.6
opacityAnimation.toValue = 1.0
opacityAnimation.duration = 1.5
opacityAnimation.autoreverses = true
opacityAnimation.repeatCount = .infinity

// Apply to layer
iconView.layer.add(scaleAnimation, forKey: "pulse-scale")
iconView.layer.add(opacityAnimation, forKey: "pulse-opacity")
```

### Animated Dots (Scanning & Getting Event text)
```swift
// Using Timer
var dotCount = 0
let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
    dotCount = (dotCount + 1) % 4 // 0, 1, 2, 3, repeat
    let dots = String(repeating: ".", count: dotCount)
    label.text = "Scanning Event Name\(dots)"
}
```

**Timing**: Append one dot every 500ms, reset to 0 dots after 3 dots

### Progress Bar Animation
```swift
// Smooth progress update
UIView.animate(withDuration: 0.1, delay: 0, options: .curveLinear) {
    progressView.setProgress(newProgress, animated: true)
}
```

**Update frequency**: Every 100ms
**Interpolation**: Linear

### Auto-Advance Delay
After detecting duplicate or outside-date photo:
```swift
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
    // Advance to next photo
    advanceToNextPhoto()
}
```

**Delay**: 500ms

---

## SwiftUI Implementation Example

```swift
struct UploadOverlayView: View {
    @Binding var isVisible: Bool
    @State var mode: OverlayMode
    @State var currentIndex: Int
    @State var totalCount: Int
    @State var progress: Double
    @State var fileName: String
    @State var animatedDots: String = ""
    
    enum OverlayMode {
        case uploading
        case scanning(eventName: String)
        case gettingEvent
        case complete(uploaded: Int, duplicates: Int, outsideDates: Int)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Top border
            Divider()
            
            HStack(spacing: 16) {
                // Left: Thumbnail or Icon
                iconOrThumbnailView()
                    .frame(width: 64, height: 64)
                
                // Right: Content
                VStack(alignment: .leading, spacing: 8) {
                    // Header with close button
                    HStack {
                        Text(headerText)
                            .font(.headline)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        Button(action: { isVisible = false }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.secondary)
                                .frame(width: 32, height: 32)
                        }
                    }
                    
                    // Subtitle
                    if let subtitle = subtitleText {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    
                    // Progress bar (only for uploading mode)
                    if case .uploading = mode {
                        ProgressView(value: progress, total: 1.0)
                            .frame(height: 8)
                            .accentColor(.blue)
                    }
                }
            }
            .padding(16)
            .background(Color(.systemBackground))
        }
        .background(
            Color(.systemBackground)
                .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: -2)
        )
        .cornerRadius(12, corners: [.topLeft, .topRight])
        .edgesIgnoringSafeArea(.bottom)
        .onAppear {
            if case .scanning = mode {
                startDotAnimation()
            }
            if case .gettingEvent = mode {
                startDotAnimation()
            }
        }
    }
    
    @ViewBuilder
    private func iconOrThumbnailView() -> some View {
        switch mode {
        case .uploading:
            // Photo thumbnail
            AsyncImage(url: URL(string: thumbnailURL)) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.gray.opacity(0.2)
            }
            .frame(width: 64, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            
        case .scanning:
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.1))
                
                Image(systemName: "magnifyingglass.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.blue)
                    .modifier(PulseAnimation())
            }
            .frame(width: 64, height: 64)
            
        case .gettingEvent:
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.blue.opacity(0.1))
                
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.blue)
                    .modifier(PulseAnimation())
            }
            .frame(width: 64, height: 64)
            
        case .complete:
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.green.opacity(0.1))
                
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.green)
            }
            .frame(width: 64, height: 64)
        }
    }
    
    private var headerText: String {
        switch mode {
        case .uploading:
            return "Uploading \(currentIndex + 1)/\(totalCount)"
        case .scanning(let eventName):
            return "Scanning \(eventName)\(animatedDots)"
        case .gettingEvent:
            return "Getting Event for Auto Upload\(animatedDots)"
        case .complete:
            return "Upload Complete"
        }
    }
    
    private var subtitleText: String? {
        switch mode {
        case .uploading:
            return fileName
        case .scanning:
            return "Looking for matching events to auto-upload"
        case .gettingEvent:
            return "Loading event details"
        case .complete(let uploaded, let duplicates, let outsideDates):
            var parts: [String] = []
            if uploaded > 0 { parts.append("\(uploaded) Uploaded") }
            if duplicates > 0 { parts.append("\(duplicates) Duplicates") }
            if outsideDates > 0 { parts.append("\(outsideDates) Outside event dates") }
            return parts.joined(separator: ", ")
        }
    }
    
    private func startDotAnimation() {
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { timer in
            let count = animatedDots.count
            animatedDots = String(repeating: ".", count: (count + 1) % 4)
            
            // Stop timer if mode changes
            if case .uploading = mode { timer.invalidate() }
            if case .complete = mode { timer.invalidate() }
        }
    }
}

// Pulse animation modifier
struct PulseAnimation: ViewModifier {
    @State private var isPulsing = false
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.1 : 1.0)
            .opacity(isPulsing ? 1.0 : 0.6)
            .animation(
                Animation.easeInOut(duration: 1.5).repeatForever(autoreverses: true),
                value: isPulsing
            )
            .onAppear {
                isPulsing = true
            }
    }
}

// Custom corner radius extension
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
```

---

## UIKit Implementation Example

```swift
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
    
    // MARK: - State
    enum OverlayMode {
        case uploading(index: Int, total: Int, fileName: String)
        case scanning(eventName: String)
        case gettingEvent
        case complete(uploaded: Int, duplicates: Int, outsideDates: Int)
    }
    
    var mode: OverlayMode = .uploading(index: 0, total: 1, fileName: "") {
        didSet { updateUI() }
    }
    
    var progress: Float = 0 {
        didSet { updateProgress() }
    }
    
    private var dotAnimationTimer: Timer?
    private var currentDotCount = 0
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupViews()
        setupConstraints()
        updateUI()
    }
    
    // MARK: - Setup
    private func setupViews() {
        // Container
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 12
        containerView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: -2)
        containerView.layer.shadowRadius = 8
        containerView.layer.shadowOpacity = 0.1
        
        // Top border
        let topBorder = CALayer()
        topBorder.backgroundColor = UIColor.separator.cgColor
        topBorder.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 0.5)
        containerView.layer.addSublayer(topBorder)
        
        // Thumbnail
        thumbnailImageView.contentMode = .scaleAspectFill
        thumbnailImageView.clipsToBounds = true
        thumbnailImageView.layer.cornerRadius = 12
        
        // Icon background
        iconBackgroundView.layer.cornerRadius = 12
        
        // Icon
        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 32, weight: .medium)
        iconImageView.preferredSymbolConfiguration = symbolConfig
        iconImageView.contentMode = .center
        
        // Header label
        headerLabel.font = .preferredFont(forTextStyle: .headline)
        headerLabel.textColor = .label
        
        // Subtitle label
        subtitleLabel.font = .preferredFont(forTextStyle: .caption1)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.numberOfLines = 1
        
        // Progress view
        progressView.progressTintColor = .systemBlue
        progressView.trackTintColor = .systemGray5
        progressView.layer.cornerRadius = 4
        progressView.clipsToBounds = true
        
        // Close button
        let closeSymbolConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let closeImage = UIImage(systemName: "xmark", withConfiguration: closeSymbolConfig)
        closeButton.setImage(closeImage, for: .normal)
        closeButton.tintColor = .secondaryLabel
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
            // Container
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            containerView.heightAnchor.constraint(equalToConstant: 88 + view.safeAreaInsets.bottom),
            
            // Thumbnail (overlaps with iconBackgroundView position)
            thumbnailImageView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            thumbnailImageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            thumbnailImageView.widthAnchor.constraint(equalToConstant: 64),
            thumbnailImageView.heightAnchor.constraint(equalToConstant: 64),
            
            // Icon background (overlaps with thumbnail position)
            iconBackgroundView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            iconBackgroundView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            iconBackgroundView.widthAnchor.constraint(equalToConstant: 64),
            iconBackgroundView.heightAnchor.constraint(equalToConstant: 64),
            
            // Icon
            iconImageView.centerXAnchor.constraint(equalTo: iconBackgroundView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: iconBackgroundView.centerYAnchor),
            
            // Header label
            headerLabel.leadingAnchor.constraint(equalTo: thumbnailImageView.trailingAnchor, constant: 16),
            headerLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            headerLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -8),
            
            // Close button
            closeButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            closeButton.centerYAnchor.constraint(equalTo: headerLabel.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 32),
            closeButton.heightAnchor.constraint(equalToConstant: 32),
            
            // Subtitle label
            subtitleLabel.leadingAnchor.constraint(equalTo: headerLabel.leadingAnchor),
            subtitleLabel.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 8),
            subtitleLabel.trailingAnchor.constraint(equalTo: closeButton.trailingAnchor),
            
            // Progress view
            progressView.leadingAnchor.constraint(equalTo: headerLabel.leadingAnchor),
            progressView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 8),
            progressView.trailingAnchor.constraint(equalTo: closeButton.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 8)
        ])
    }
    
    // MARK: - UI Updates
    private func updateUI() {
        dotAnimationTimer?.invalidate()
        
        switch mode {
        case .uploading(let index, let total, let fileName):
            thumbnailImageView.isHidden = false
            iconBackgroundView.isHidden = true
            progressView.isHidden = false
            
            headerLabel.text = "Uploading \(index + 1)/\(total)"
            subtitleLabel.text = fileName
            
        case .scanning(let eventName):
            thumbnailImageView.isHidden = true
            iconBackgroundView.isHidden = false
            progressView.isHidden = true
            
            iconBackgroundView.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.1)
            iconImageView.image = UIImage(systemName: "magnifyingglass.circle.fill")
            iconImageView.tintColor = .systemBlue
            
            startDotAnimation(baseText: "Scanning \(eventName)")
            subtitleLabel.text = "Looking for matching events to auto-upload"
            startPulseAnimation()
            
        case .gettingEvent:
            thumbnailImageView.isHidden = true
            iconBackgroundView.isHidden = false
            progressView.isHidden = true
            
            iconBackgroundView.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.1)
            iconImageView.image = UIImage(systemName: "arrow.down.circle.fill")
            iconImageView.tintColor = .systemBlue
            
            startDotAnimation(baseText: "Getting Event for Auto Upload")
            subtitleLabel.text = "Loading event details"
            startPulseAnimation()
            
        case .complete(let uploaded, let duplicates, let outsideDates):
            thumbnailImageView.isHidden = true
            iconBackgroundView.isHidden = false
            progressView.isHidden = true
            
            iconBackgroundView.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.1)
            iconImageView.image = UIImage(systemName: "checkmark.circle.fill")
            iconImageView.tintColor = .systemGreen
            
            headerLabel.text = "Upload Complete"
            
            var summaryParts: [String] = []
            if uploaded > 0 { summaryParts.append("\(uploaded) Uploaded") }
            if duplicates > 0 { summaryParts.append("\(duplicates) Duplicates") }
            if outsideDates > 0 { summaryParts.append("\(outsideDates) Outside event dates") }
            subtitleLabel.text = summaryParts.joined(separator: ", ")
        }
    }
    
    private func updateProgress() {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveLinear) {
            self.progressView.setProgress(self.progress, animated: true)
        }
    }
    
    private func startDotAnimation(baseText: String) {
        currentDotCount = 0
        dotAnimationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.currentDotCount = (self.currentDotCount + 1) % 4
            let dots = String(repeating: ".", count: self.currentDotCount)
            self.headerLabel.text = baseText + dots
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
    
    // MARK: - Actions
    @objc private func closeTapped() {
        dismiss(animated: true)
    }
}
```

---

## State Machine & Behavior

### Upload Flow
```
pending → uploading → check status → success/duplicate/outside-date → auto-advance
```

### State Transitions
1. **Normal Upload**: 
   - Start: User selects photos
   - Progress: 0% → 100%
   - End: Auto-advance after 500ms

2. **Duplicate Detected**:
   - Overlay shows progress completing
   - Auto-advance after 500ms
   - Increment duplicate counter

3. **Outside Event Dates**:
   - Overlay shows progress completing
   - Auto-advance after 500ms
   - Increment outside-dates counter

4. **Scanning Events** (App only):
   - Start: App launches auto-upload scan
   - Cycle through event names
   - End: User selects event or cancel

5. **Getting Event** (App only):
   - Start: User selects event from scan
   - Fixed 3-second duration
   - End: Transition to uploading state

6. **Upload Complete**:
   - Show summary statistics
   - User must manually dismiss
   - Does not auto-dismiss

### Auto-Advance Logic
```swift
func handleUploadComplete(status: UploadStatus) {
    switch status {
    case .success, .duplicate, .outsideDate:
        // Wait 500ms before advancing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if hasMorePhotos {
                advanceToNextPhoto()
            } else {
                showCompleteState()
            }
        }
    case .failed:
        // Show error, don't auto-advance
        showErrorState()
    }
}
```

---

## Accessibility (VoiceOver)

### Labels & Hints

| Element | Accessibility Label | Hint |
|---------|-------------------|------|
| Overlay container | "Upload progress" | - |
| Close button | "Close" | "Dismisses upload overlay" |
| Progress state | "Uploading photo {n} of {total}, {progress}% complete" | - |
| Scanning state | "Scanning {event name} for auto upload" | - |
| Getting event state | "Loading event details for auto upload" | - |
| Complete state | "{n} photos uploaded, {y} duplicates found, {z} outside event dates" | - |

### Implementation
```swift
// VoiceOver announcement for progress changes
func updateProgressAccessibility() {
    let announcement = "Uploading photo \(currentIndex + 1) of \(totalCount), \(Int(progress * 100))% complete"
    UIAccessibility.post(notification: .announcement, argument: announcement)
}

// Close button
closeButton.accessibilityLabel = "Close"
closeButton.accessibilityHint = "Dismisses upload overlay"

// Minimum touch target size
closeButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 44)
closeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
```

### Dynamic Type Support
```swift
// Use dynamic type text styles
headerLabel.font = .preferredFont(forTextStyle: .headline)
headerLabel.adjustsFontForContentSizeCategory = true

subtitleLabel.font = .preferredFont(forTextStyle: .caption1)
subtitleLabel.adjustsFontForContentSizeCategory = true
```

---

## Color Specifications

### Semantic Colors (iOS System)
| Element | Light Mode | Dark Mode | iOS Color |
|---------|-----------|-----------|-----------|
| Background | White | Dark Gray | `.systemBackground` |
| Text primary | Black | White | `.label` |
| Text secondary | Gray | Light Gray | `.secondaryLabel` |
| Text muted | Light Gray | Medium Gray | `.tertiaryLabel` |
| Border | Light Gray | Dark Gray | `.separator` |
| Progress track | Light Gray | Dark Gray | `.systemGray5` |

### Brand Colors
| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Primary Blue | `#2B8FFF` | rgb(43, 143, 255) | Progress bar, scanning icon |
| Success Green | `#22C55E` | rgb(34, 197, 94) | Complete checkmark |

### UIColor Extensions
```swift
extension UIColor {
    static let brandBlue = UIColor(red: 43/255, green: 143/255, blue: 255/255, alpha: 1.0)
    static let successGreen = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0)
}
```

---

## Edge Cases & Error Handling

### 1. Long Filenames
**Problem**: Filename exceeds container width
**Solution**: 
```swift
subtitleLabel.lineBreakMode = .byTruncatingMiddle
subtitleLabel.numberOfLines = 1
// Example: "IMG_very_long_filename_that_is_too_long_to_display.jpg"
// Displays as: "IMG_very_long_fi...play.jpg"
```

### 2. Long Event Names
**Problem**: Event name exceeds container width
**Solution**:
```swift
headerLabel.lineBreakMode = .byTruncatingTail
headerLabel.numberOfLines = 1
// Example: "My Super Long Birthday Party Event Name..."
// Displays as: "Scanning My Super Long Birthd..."
```

### 3. No Summary Counts
**Problem**: Upload complete with 0 duplicates and 0 outside dates
**Solution**:
```swift
// Only show counts > 0
var summaryParts: [String] = []
if uploaded > 0 { summaryParts.append("\(uploaded) Uploaded") }
if duplicates > 0 { summaryParts.append("\(duplicates) Duplicates") }
if outsideDates > 0 { summaryParts.append("\(outsideDates) Outside event dates") }

if summaryParts.isEmpty {
    subtitleLabel.text = "No photos uploaded"
} else {
    subtitleLabel.text = summaryParts.joined(separator: ", ")
}
```

### 4. Rapid State Changes
**Problem**: Multiple photos upload quickly, UI updates lag
**Solution**:
```swift
// Debounce UI updates
private var updateWorkItem: DispatchWorkItem?

func updateState(newState: OverlayMode) {
    updateWorkItem?.cancel()
    
    let workItem = DispatchWorkItem { [weak self] in
        self?.mode = newState
    }
    updateWorkItem = workItem
    
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: workItem)
}
```

### 5. Orientation Changes
**Problem**: Layout breaks on rotation
**Solution**:
```swift
override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
    super.viewWillTransition(to: size, with: coordinator)
    
    coordinator.animate { _ in
        // Update constraints if needed
        self.view.layoutIfNeeded()
    }
}
```

### 6. Background/Foreground
**Problem**: Upload continues in background, state lost on return
**Solution**:
```swift
// Save state to UserDefaults or persist with Core Data
NotificationCenter.default.addObserver(
    self,
    selector: #selector(appDidEnterBackground),
    name: UIApplication.didEnterBackgroundNotification,
    object: nil
)

@objc func appDidEnterBackground() {
    // Persist upload state
    saveUploadState()
}

@objc func appWillEnterForeground() {
    // Restore upload state
    restoreUploadState()
}
```

### 7. Network Loss During Upload
**Problem**: Upload fails mid-progress
**Solution**:
```swift
// Show error state with retry option
func handleNetworkError() {
    let alert = UIAlertController(
        title: "Upload Failed",
        message: "Check your internet connection and try again.",
        preferredStyle: .alert
    )
    
    alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in
        self.retryUpload()
    })
    
    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
        self.cancelUpload()
    })
    
    present(alert, animated: true)
}
```

---

## Testing Checklist

### Visual Testing
- [ ] All 5 overlay states render correctly
- [ ] Thumbnail displays for normal uploads
- [ ] Icons display for scanning/getting event/complete states
- [ ] Progress bar fills smoothly (0% → 100%)
- [ ] Close button (X) is visible and properly sized
- [ ] Text does not overflow or wrap unexpectedly
- [ ] Corner radius applied only to top corners
- [ ] Shadow renders correctly at top edge
- [ ] Colors match design specifications (light & dark mode)

### Animation Testing
- [ ] Pulse animation runs smoothly on icon (scale + opacity)
- [ ] Animated dots cycle correctly: "." → ".." → "..." → ""
- [ ] Progress bar updates every 100ms without jank
- [ ] Auto-advance delay works (500ms after completion)
- [ ] Animations stop when switching states

### Behavior Testing
- [ ] Normal upload: Auto-advances after success
- [ ] Duplicate detected: Auto-advances after 500ms
- [ ] Outside dates: Auto-advances after 500ms
- [ ] Scanning: Cycles through event names
- [ ] Getting event: Fixed 3-second duration
- [ ] Complete: Summary shows correct counts
- [ ] Close button dismisses overlay immediately

### Accessibility Testing
- [ ] VoiceOver announces progress changes
- [ ] VoiceOver announces state changes
- [ ] Close button has proper accessibility label and hint
- [ ] Minimum touch target size (44pt × 44pt) for close button
- [ ] Dynamic Type scales text properly
- [ ] High contrast mode renders correctly

### Edge Case Testing
- [ ] Long filename truncates properly (middle truncation)
- [ ] Long event name truncates properly (tail truncation)
- [ ] No duplicates/outside dates: Summary omits zero counts
- [ ] Rapid photo changes: UI updates smoothly
- [ ] Orientation change: Layout remains correct
- [ ] App backgrounded: State persists on return
- [ ] Network loss: Error handling works

### Platform Testing
- [ ] iPhone SE (small screen)
- [ ] iPhone 14/15 Pro (standard screen)
- [ ] iPhone 14/15 Pro Max (large screen)
- [ ] iPad (tablet layout)
- [ ] Safe area insets respected (notches, home indicator)
- [ ] iOS 15+ compatibility

---

## Notes for Developers

### Best Practices
1. **Use semantic colors** (`.systemBackground`, `.label`) for automatic dark mode support
2. **Use SF Symbols** for consistent iconography
3. **Respect safe area insets** for devices with notches
4. **Support Dynamic Type** for accessibility
5. **Test on multiple device sizes** to ensure responsive layout
6. **Implement proper state management** (MVVM or similar)
7. **Handle network errors gracefully** with retry logic

### Performance Considerations
- Use `UIImage` caching for thumbnails to avoid repeated decoding
- Debounce rapid state updates to prevent UI jank
- Stop animations when view is not visible
- Clean up timers in `deinit` or `viewWillDisappear`

### Integration Points
- Hook into existing upload manager for progress updates
- Use existing photo picker for thumbnail images
- Integrate with existing event selection flow for auto-upload
- Connect to existing analytics for upload tracking

---

## Support & Questions

For implementation questions or clarifications, refer to:
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- SF Symbols Browser: https://developer.apple.com/sf-symbols/
- UIKit Documentation: https://developer.apple.com/documentation/uikit
- SwiftUI Documentation: https://developer.apple.com/documentation/swiftui
