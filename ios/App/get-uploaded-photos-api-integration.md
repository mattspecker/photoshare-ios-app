# get-uploaded-photos API Integration Guide

This document outlines how the iOS EventPhotoPicker integrates with the `get-uploaded-photos` API endpoint for duplicate detection.

## API Endpoint Configuration

### Base URL
```
https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos
```

### HTTP Method
```
GET
```

### Authentication
```
Authorization: Bearer {JWT_TOKEN}
```

## Request Parameters

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `event_id` | String | The event ID to fetch photos for | `"12345"` |

### Optional Parameters (Pagination)

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | Integer | 50 | 100 | Number of photos per page |
| `offset` | Integer | 0 | - | Number of photos to skip |

## iOS Implementation

### URL Construction
```swift
// Base URL
guard let url = URL(string: "https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos") else {
    print("❌ Invalid get-uploaded-photos URL")
    return
}

// Build URL with query parameters
var urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false)
urlComponents?.queryItems = [
    URLQueryItem(name: "event_id", value: eventId),
    URLQueryItem(name: "limit", value: "50"),        // Max efficiency
    URLQueryItem(name: "offset", value: String(offset))
]

guard let finalURL = urlComponents?.url else {
    print("❌ Failed to build URL with query parameters")
    return
}
```

### Example Final URLs
```
https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos?event_id=12345&limit=50&offset=0
https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos?event_id=12345&limit=50&offset=50
https://jgfcfdlfcnmaripgpepl.supabase.co/functions/v1/get-uploaded-photos?event_id=12345&limit=50&offset=100
```

### HTTP Request Setup
```swift
var request = URLRequest(url: finalURL)
request.httpMethod = "GET"
request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")

print("📡 Fetching uploaded photos for event: \(eventId)")
print("📡 Request URL: \(finalURL.absoluteString)")
print("📡 Authorization: Bearer \(jwtToken.prefix(20))...")
```

### Request Headers
```
GET /functions/v1/get-uploaded-photos?event_id=12345&limit=50&offset=0 HTTP/1.1
Host: jgfcfdlfcnmaripgpepl.supabase.co
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: */*
User-Agent: PhotoShare/1.0 (iOS)
```

## Expected API Response Format

### Successful Response (200 OK)
```json
{
  "photos": [
    {
      "id": 1,
      "event_id": "12345",
      "file_name": "IMG_2025_001.jpg",
      "file_hash": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
      "perceptual_hash": "1a2b3c4d5e6f7890",
      "file_size_bytes": 2851840,
      "image_width": 3024,
      "image_height": 4032,
      "original_timestamp": "2025-01-15T14:30:25.123Z",
      "upload_timestamp": "2025-01-15T14:31:10.456Z",
      "user_id": "user_abc123"
    },
    {
      "id": 2,
      "event_id": "12345",
      "file_name": "IMG_2025_002.jpg",
      "file_hash": "b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab",
      "perceptual_hash": "2b3c4d5e6f789012",
      "file_size_bytes": 3102720,
      "image_width": 4032,
      "image_height": 3024,
      "original_timestamp": "2025-01-15T14:32:15.789Z",
      "upload_timestamp": "2025-01-15T14:33:02.101Z",
      "user_id": "user_def456"
    }
  ],
  "has_more": false,
  "total_count": 2,
  "current_page": 0,
  "page_size": 50
}
```

### Pagination Response (has_more: true)
```json
{
  "photos": [
    // ... 50 photos
  ],
  "has_more": true,
  "total_count": 150,
  "current_page": 0,
  "page_size": 50
}
```

### Empty Response (No photos found)
```json
{
  "photos": [],
  "has_more": false,
  "total_count": 0,
  "current_page": 0,
  "page_size": 50
}
```

### Error Response (400/401/500)
```json
{
  "error": "Invalid event_id parameter",
  "message": "The event_id must be a valid string",
  "code": 400
}
```

## iOS Response Handling

### Success Case
```swift
URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
        print("❌ Error fetching uploaded photos: \(error.localizedDescription)")
        return
    }
    
    // Debug HTTP response
    if let httpResponse = response as? HTTPURLResponse {
        print("📡 get-uploaded-photos Response Status: \(httpResponse.statusCode)")
        print("📡 get-uploaded-photos Response Headers: \(httpResponse.allHeaderFields)")
    }
    
    guard let data = data else {
        print("❌ No data received from get-uploaded-photos")
        return
    }
    
    // Debug raw response
    if let responseString = String(data: data, encoding: .utf8) {
        let truncated = responseString.count > 500 ? String(responseString.prefix(500)) + "..." : responseString
        print("📡 get-uploaded-photos Raw Response: \(truncated)")
    }
    
    // Parse JSON
    do {
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let photos = json["photos"] as? [[String: Any]] {
                print("✅ Fetched \(photos.count) uploaded photos")
                
                // Handle pagination
                if let hasMore = json["has_more"] as? Bool, hasMore {
                    print("📄 More pages available, fetching next...")
                    // Fetch next page with offset + 50
                }
                
                // Process photos for duplicate detection
                processUploadedPhotos(photos)
            }
        }
    } catch {
        print("❌ JSON parsing error: \(error.localizedDescription)")
    }
}.resume()
```

## Key Data Fields Used for Duplicate Detection

### Primary Detection (SHA-256 Hash)
```swift
if let uploadedHash = uploadedPhoto["file_hash"] as? String {
    let deviceHash = SHA256.hash(data: imageData).compactMap { String(format: "%02x", $0) }.joined()
    if deviceHash == uploadedHash {
        return true  // Exact match found
    }
}
```

### Secondary Detection (Perceptual Hash)
```swift
if let uploadedPerceptualHash = uploadedPhoto["perceptual_hash"] as? String {
    if let devicePerceptualHash = generatePerceptualHash(for: asset) {
        let similarity = comparePerceptualHashes(devicePerceptualHash, uploadedPerceptualHash)
        if similarity >= 0.90 {  // 90% threshold
            return true  // Visual similarity match
        }
    }
}
```

### Fallback Detection (Metadata)
```swift
let timestampString = uploadedPhoto["original_timestamp"] as? String
let sizeBytes = uploadedPhoto["file_size_bytes"] as? Int
let uploadedWidth = uploadedPhoto["image_width"] as? Int
let uploadedHeight = uploadedPhoto["image_height"] as? Int

// Parse timestamp
let formatter = ISO8601DateFormatter()
formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
let uploadedTimestamp = formatter.date(from: timestampString)

// Compare metadata
let timestampDiff = abs(deviceTimestamp.timeIntervalSince(uploadedTimestamp))
let timestampWithin60Seconds = timestampDiff <= 60.0  // HEIF conversion tolerance
let dimensionsMatch = (deviceWidth == uploadedWidth && deviceHeight == uploadedHeight)
let sizeSimilar = abs(deviceSize - sizeBytes) <= 1_000_000  // 1MB tolerance

if timestampWithin60Seconds && sizeSimilar && dimensionsMatch {
    return true  // Metadata match (fallback for HEIF→JPEG cases)
}
```

## Debugging Tips for Android Team

### 1. Verify Request URL
Ensure the final URL includes all parameters:
```
✅ Correct: https://...get-uploaded-photos?event_id=12345&limit=50&offset=0
❌ Missing: https://...get-uploaded-photos?limit=50&offset=0
❌ Wrong: https://...get-uploaded-photos/12345?limit=50&offset=0
```

### 2. Check Authorization Header
```
✅ Correct: Authorization: Bearer eyJhbGciOiJIUzI1NiI...
❌ Missing: No Authorization header
❌ Wrong: Authorization: eyJhbGciOiJIUzI1NiI... (missing "Bearer ")
```

### 3. Validate Event ID Format
The event ID should be passed as received from the event creation API:
```
✅ Correct: "12345" (string)
❌ Wrong: 12345 (number)
❌ Wrong: null or undefined
```

### 4. Handle HTTP Status Codes
```
200: Success - parse photos array
400: Bad request - check parameters
401: Unauthorized - refresh JWT token
404: Not found - verify endpoint URL
500: Server error - retry after delay
```

### 5. Expected Data Types
```
photos: Array of objects
has_more: Boolean
total_count: Number
file_hash: String (64 chars hex)
perceptual_hash: String (16 chars hex)
original_timestamp: String (ISO8601 with fractional seconds)
file_size_bytes: Number
image_width: Number
image_height: Number
```

## Common Issues

### Empty Response
- Verify event_id exists and has uploaded photos
- Check JWT token is valid and not expired
- Ensure user has permission to view event photos

### Pagination Not Working
- Increment offset by limit size (50) for each page
- Continue fetching while has_more is true
- Track total fetched vs total_count

### Hash Comparison Failing
- Ensure file_hash is SHA-256 of original file content
- Check perceptual_hash format matches expected 16-char hex
- Verify timestamp format includes fractional seconds

## Testing Checklist

- [ ] API returns 200 status code
- [ ] Response contains "photos" array
- [ ] Each photo has required fields (file_hash, perceptual_hash, etc.)
- [ ] Pagination works correctly (has_more, offset)
- [ ] JWT token authentication works
- [ ] Empty results handled gracefully
- [ ] Error responses parsed correctly
- [ ] Network timeouts handled appropriately
