import Foundation

/**
 * Data model for photo information used in bulk download functionality.
 * Matches the Android GalleryPhotoItem.java structure for cross-platform compatibility.
 */
@objc public class GalleryPhotoItem: NSObject, Codable {
    public let url: String
    public let thumbnailUrl: String
    public let fullUrl: String
    public let title: String
    public let uploader: String
    public let uploadDate: String
    public let photoId: String
    public let isOwn: Bool
    
    // Primary constructor with separate thumbnail and full URLs
    public init(thumbnailUrl: String, fullUrl: String, title: String, uploader: String, uploadDate: String, photoId: String, isOwn: Bool) {
        self.url = thumbnailUrl // For backward compatibility
        self.thumbnailUrl = thumbnailUrl
        self.fullUrl = fullUrl
        self.title = title
        self.uploader = uploader
        self.uploadDate = uploadDate
        self.photoId = photoId
        self.isOwn = isOwn
        super.init()
    }
    
    // Convenience constructor for backward compatibility
    public convenience init(url: String, title: String, uploader: String, uploadDate: String, photoId: String) {
        self.init(thumbnailUrl: url, fullUrl: url, title: title, uploader: uploader, uploadDate: uploadDate, photoId: photoId, isOwn: false)
    }
    
    // Create from dictionary (JavaScript interface)
    public static func fromDictionary(_ dict: [String: Any]) -> GalleryPhotoItem? {
        guard let thumbnailUrl = dict["thumbnailUrl"] as? String ?? dict["url"] as? String,
              let fullUrl = dict["fullUrl"] as? String ?? dict["url"] as? String else {
            return nil
        }
        
        let title = dict["title"] as? String ?? "Photo"
        let uploader = dict["uploadedBy"] as? String ?? dict["uploader"] as? String ?? "Unknown"
        let uploadDate = dict["uploadedAt"] as? String ?? dict["uploadDate"] as? String ?? ""
        let photoId = dict["id"] as? String ?? dict["photoId"] as? String ?? ""
        let isOwn = dict["isOwn"] as? Bool ?? false
        
        return GalleryPhotoItem(
            thumbnailUrl: thumbnailUrl,
            fullUrl: fullUrl,
            title: title,
            uploader: uploader,
            uploadDate: uploadDate,
            photoId: photoId,
            isOwn: isOwn
        )
    }
    
    // Convert to dictionary (for passing back to JavaScript)
    public func toDictionary() -> [String: Any] {
        return [
            "url": url,
            "thumbnailUrl": thumbnailUrl,
            "fullUrl": fullUrl,
            "title": title,
            "uploader": uploader,
            "uploadedBy": uploader, // alias for web compatibility
            "uploadDate": uploadDate,
            "uploadedAt": uploadDate, // alias for web compatibility
            "photoId": photoId,
            "id": photoId, // alias for web compatibility
            "isOwn": isOwn
        ]
    }
    
    // Getter methods for Objective-C compatibility
    @objc public func getUrl() -> String { return url }
    @objc public func getThumbnailUrl() -> String { return thumbnailUrl }
    @objc public func getFullUrl() -> String { return fullUrl }
    @objc public func getTitle() -> String { return title }
    @objc public func getUploader() -> String { return uploader }
    @objc public func getUploadDate() -> String { return uploadDate }
    @objc public func getPhotoId() -> String { return photoId }
    @objc public func getIsOwn() -> Bool { return isOwn }
    
    // Debug description
    override public var description: String {
        return "GalleryPhotoItem(id: \(photoId), title: '\(title)', uploader: '\(uploader)', isOwn: \(isOwn))"
    }
}