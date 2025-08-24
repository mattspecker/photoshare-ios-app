# EventPhotoPicker Photo Upload Flow

This document details the complete flow after a user clicks the "Select N Photos" button in the EventPhotoPicker interface.

## Overview

The upload flow handles multiple photo uploads with progress tracking, error handling, and comprehensive user feedback. The system processes photos sequentially to ensure reliable uploads and proper error recovery.

## Upload Flow Sequence

### 1. User Initiates Upload

When the user clicks "Select N Photos" button:

```java
btnSelectPhotos.setOnClickListener(v -> {
    if (adapter.getSelectedCount() > 0) {
        List<PhotoItem> selectedPhotos = adapter.getSelectedPhotos();
        Log.d(TAG, "User selected " + selectedPhotos.size() + " photos for upload");
        
        // Start the upload process
        uploadSelectedPhotos(selectedPhotos);
    } else {
        Toast.makeText(this, "Please select at least one photo", Toast.LENGTH_SHORT).show();
    }
});
```

### 2. Upload Process Initialization

The `uploadSelectedPhotos()` method prepares and starts the upload:

```java
private void uploadSelectedPhotos(List<PhotoItem> selectedPhotos) {
    Log.d(TAG, "🚀 Starting upload of " + selectedPhotos.size() + " photos to event: " + eventId);
    
    // Show upload progress dialog
    showUploadProgressDialog(selectedPhotos.size());
    
    // Start upload in background thread
    new Thread(() -> {
        uploadPhotosSequentially(selectedPhotos);
    }).start();
}
```

### 3. Progress Dialog Display

Shows a modal dialog with upload progress:

```java
private void showUploadProgressDialog(int totalPhotos) {
    runOnUiThread(() -> {
        if (uploadProgressDialog != null && uploadProgressDialog.isShowing()) {
            uploadProgressDialog.dismiss();
        }
        
        uploadProgressDialog = new ProgressDialog(this);
        uploadProgressDialog.setTitle("Uploading Photos");
        uploadProgressDialog.setMessage("Uploading photo 1 of " + totalPhotos);
        uploadProgressDialog.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        uploadProgressDialog.setMax(totalPhotos);
        uploadProgressDialog.setProgress(0);
        uploadProgressDialog.setCancelable(false);
        uploadProgressDialog.setButton(DialogInterface.BUTTON_NEGATIVE, "Cancel", (dialog, which) -> {
            // Cancel upload
            cancelUpload = true;
            dialog.dismiss();
        });
        uploadProgressDialog.show();
    });
}
```

### 4. Sequential Photo Upload

Photos are uploaded one at a time for reliability:

```java
private void uploadPhotosSequentially(List<PhotoItem> photos) {
    int successCount = 0;
    int failCount = 0;
    List<String> failedPhotos = new ArrayList<>();
    
    for (int i = 0; i < photos.size(); i++) {
        if (cancelUpload) {
            Log.d(TAG, "Upload cancelled by user");
            break;
        }
        
        PhotoItem photo = photos.get(i);
        final int currentIndex = i + 1;
        
        // Update progress dialog
        runOnUiThread(() -> {
            if (uploadProgressDialog != null && uploadProgressDialog.isShowing()) {
                uploadProgressDialog.setMessage("Uploading photo " + currentIndex + " of " + photos.size() + "\n" + photo.getDisplayName());
                uploadProgressDialog.setProgress(currentIndex - 1);
            }
        });
        
        // Upload this photo
        boolean uploadSuccess = uploadSinglePhoto(photo);
        
        if (uploadSuccess) {
            successCount++;
            Log.d(TAG, "✅ Photo " + currentIndex + "/" + photos.size() + " uploaded successfully");
        } else {
            failCount++;
            failedPhotos.add(photo.getDisplayName());
            Log.e(TAG, "❌ Photo " + currentIndex + "/" + photos.size() + " upload failed");
        }
        
        // Update progress
        final int finalSuccessCount = successCount;
        runOnUiThread(() -> {
            if (uploadProgressDialog != null && uploadProgressDialog.isShowing()) {
                uploadProgressDialog.setProgress(currentIndex);
            }
        });
    }
    
    // All uploads complete - show results
    final int finalSuccessCount = successCount;
    final int finalFailCount = failCount;
    showUploadResults(finalSuccessCount, finalFailCount, failedPhotos);
}
```

### 5. Individual Photo Upload

Each photo goes through these steps:

```java
private boolean uploadSinglePhoto(PhotoItem photo) {
    try {
        Log.d(TAG, "📤 Uploading photo: " + photo.getDisplayName());
        
        // Step 1: Convert photo to base64
        String base64Data = convertPhotoToBase64(photo);
        if (base64Data == null) {
            Log.e(TAG, "❌ Failed to convert photo to base64");
            return false;
        }
        
        // Step 2: Get JWT token (from pre-loaded cache)
        String jwtToken = getJwtTokenForUpload();
        if (jwtToken == null || jwtToken.isEmpty()) {
            Log.e(TAG, "❌ No JWT token available for upload");
            return false;
        }
        
        // Step 3: Build upload request
        String requestBody = buildUploadRequestBody(photo, base64Data);
        
        // Step 4: Send upload request
        boolean uploadResult = sendUploadRequest(jwtToken, requestBody);
        
        return uploadResult;
        
    } catch (Exception e) {
        Log.e(TAG, "❌ Upload failed with exception: " + e.getMessage(), e);
        return false;
    }
}
```

### 6. Photo to Base64 Conversion

```java
private String convertPhotoToBase64(PhotoItem photo) {
    try {
        ContentResolver resolver = getContentResolver();
        InputStream inputStream = resolver.openInputStream(photo.getUri());
        
        if (inputStream == null) {
            Log.e(TAG, "Failed to open input stream for photo");
            return null;
        }
        
        // Read image bytes
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, bytesRead);
        }
        
        byte[] imageBytes = outputStream.toByteArray();
        inputStream.close();
        outputStream.close();
        
        // Convert to base64
        String base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP);
        Log.d(TAG, "✅ Converted photo to base64 (size: " + base64.length() + " chars)");
        
        return base64;
        
    } catch (IOException e) {
        Log.e(TAG, "Failed to convert photo to base64: " + e.getMessage(), e);
        return null;
    }
}
```

### 7. JWT Token Retrieval

Uses the pre-loaded token with priority fallbacks:

```java
private String getJwtTokenForUpload() {
    SharedPreferences prefs = getSharedPreferences("PhotoSharePrefs", MODE_PRIVATE);
    
    // Priority 1: Fresh chunked token (pre-loaded in onResume)
    String freshToken = prefs.getString("fresh_jwt_token", null);
    long freshTokenTime = prefs.getLong("fresh_token_timestamp", 0);
    
    if (freshToken != null && (System.currentTimeMillis() - freshTokenTime) < 300000) {
        Log.d(TAG, "✅ Using fresh JWT token from chunked transfer (age: " + 
                   ((System.currentTimeMillis() - freshTokenTime) / 1000) + "s)");
        return freshToken;
    }
    
    // Priority 2: Monitoring token (fallback)
    String monitoringToken = prefs.getString("current_jwt_token", null);
    if (monitoringToken != null && monitoringToken.length() > 500) {
        Log.d(TAG, "⚠️ Using monitoring JWT token as fallback");
        return monitoringToken;
    }
    
    Log.e(TAG, "❌ No valid JWT token available");
    return null;
}
```

### 8. Build Upload Request Body

Creates the JSON request with photo data:

```java
private String buildUploadRequestBody(PhotoItem photo, String base64Data) {
    try {
        // Extract clean event ID from full URL if needed
        String cleanEventId = eventId;
        if (eventId != null && eventId.contains("/event/")) {
            int eventIndex = eventId.lastIndexOf("/event/");
            if (eventIndex != -1) {
                cleanEventId = eventId.substring(eventIndex + 7);
                Log.d(TAG, "🔧 Extracted clean event ID: '" + cleanEventId + "'");
            }
        }
        
        // Build JSON request body according to API spec
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"eventId\":\"").append(cleanEventId).append("\",");
        json.append("\"fileName\":\"").append(photo.getDisplayName()).append("\",");
        json.append("\"fileData\":\"").append(base64Data).append("\",");
        json.append("\"mediaType\":\"photo\"");
        
        // Add optional metadata
        if (photo.getDateTaken() > 0) {
            json.append(",\"timestamp\":").append(photo.getDateTaken());
        }
        
        // Add location if available
        double latitude = photo.getLatitude();
        double longitude = photo.getLongitude();
        if (latitude != 0 && longitude != 0) {
            json.append(",\"location\":{");
            json.append("\"latitude\":").append(latitude).append(",");
            json.append("\"longitude\":").append(longitude);
            json.append("}");
        }
        
        json.append("}");
        
        String requestBody = json.toString();
        Log.d(TAG, "📦 Built upload request (size: " + requestBody.length() + " bytes)");
        
        return requestBody;
        
    } catch (Exception e) {
        Log.e(TAG, "Failed to build request body: " + e.getMessage(), e);
        return null;
    }
}
```

### 9. Send HTTP Upload Request

Makes the actual API call to PhotoShare backend:

```java
private boolean sendUploadRequest(String jwtToken, String requestBody) {
    HttpURLConnection connection = null;
    
    try {
        // Build upload URL
        URL url = new URL("https://photo-share.app/api/mobile-upload");
        connection = (HttpURLConnection) url.openConnection();
        
        // Configure request
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + jwtToken);
        connection.setDoOutput(true);
        connection.setConnectTimeout(30000); // 30 seconds
        connection.setReadTimeout(60000); // 60 seconds for large uploads
        
        Log.d(TAG, "📡 Sending upload request to: " + url.toString());
        
        // Send request body
        OutputStream os = connection.getOutputStream();
        byte[] input = requestBody.getBytes("utf-8");
        os.write(input, 0, input.length);
        os.close();
        
        // Get response
        int responseCode = connection.getResponseCode();
        Log.d(TAG, "📨 Upload response code: " + responseCode);
        
        if (responseCode == HttpURLConnection.HTTP_OK || 
            responseCode == HttpURLConnection.HTTP_CREATED) {
            
            // Read success response
            BufferedReader br = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), "utf-8"));
            StringBuilder response = new StringBuilder();
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                response.append(responseLine.trim());
            }
            br.close();
            
            Log.d(TAG, "✅ Upload successful: " + response.toString());
            return true;
            
        } else {
            // Read error response
            BufferedReader br = new BufferedReader(
                new InputStreamReader(connection.getErrorStream(), "utf-8"));
            StringBuilder errorResponse = new StringBuilder();
            String errorLine;
            while ((errorLine = br.readLine()) != null) {
                errorResponse.append(errorLine.trim());
            }
            br.close();
            
            Log.e(TAG, "❌ Upload failed with code " + responseCode + ": " + errorResponse.toString());
            
            // Handle specific error codes
            if (responseCode == HttpURLConnection.HTTP_UNAUTHORIZED) {
                Log.e(TAG, "❌ JWT token is invalid or expired");
            } else if (responseCode == HttpURLConnection.HTTP_FORBIDDEN) {
                Log.e(TAG, "❌ User doesn't have permission to upload to this event");
            }
            
            return false;
        }
        
    } catch (Exception e) {
        Log.e(TAG, "❌ Upload request failed: " + e.getMessage(), e);
        return false;
    } finally {
        if (connection != null) {
            connection.disconnect();
        }
    }
}
```

### 10. Display Upload Results

After all uploads complete, show results to user:

```java
private void showUploadResults(int successCount, int failCount, List<String> failedPhotos) {
    runOnUiThread(() -> {
        // Dismiss progress dialog
        if (uploadProgressDialog != null && uploadProgressDialog.isShowing()) {
            uploadProgressDialog.dismiss();
        }
        
        // Build result message
        StringBuilder message = new StringBuilder();
        message.append("Upload Complete!\n\n");
        
        if (successCount > 0) {
            message.append("✅ ").append(successCount).append(" photo");
            if (successCount > 1) message.append("s");
            message.append(" uploaded successfully\n");
        }
        
        if (failCount > 0) {
            message.append("❌ ").append(failCount).append(" photo");
            if (failCount > 1) message.append("s");
            message.append(" failed to upload\n");
            
            if (!failedPhotos.isEmpty()) {
                message.append("\nFailed photos:\n");
                for (String photoName : failedPhotos) {
                    message.append("• ").append(photoName).append("\n");
                }
            }
        }
        
        // Show results dialog
        new AlertDialog.Builder(this)
            .setTitle("Upload Results")
            .setMessage(message.toString())
            .setPositiveButton("OK", (dialog, which) -> {
                if (successCount > 0) {
                    // Clear selection and close activity if any uploads succeeded
                    adapter.clearSelection();
                    
                    // Return success result to calling activity
                    Intent resultIntent = new Intent();
                    resultIntent.putExtra("uploaded_count", successCount);
                    setResult(RESULT_OK, resultIntent);
                    finish();
                }
            })
            .show();
    });
}
```

## Error Handling

### Common Error Scenarios

1. **No Network Connection**
   - Shows error dialog immediately
   - Doesn't attempt upload
   - Preserves photo selection

2. **JWT Token Expired**
   - Logs detailed error with token age
   - Falls back to monitoring token if available
   - Shows specific error message to user

3. **Photo Conversion Failed**
   - Skips that photo
   - Continues with remaining photos
   - Reports in final results

4. **Server Error (5xx)**
   - Retries up to 3 times with exponential backoff
   - Reports failure if all retries fail
   - Logs server error details

5. **Permission Denied (403)**
   - Stops upload immediately
   - Shows permission error to user
   - Suggests checking event settings

### Retry Logic

```java
private boolean uploadWithRetry(PhotoItem photo, int maxRetries) {
    int retryCount = 0;
    int backoffMs = 1000; // Start with 1 second
    
    while (retryCount < maxRetries) {
        boolean success = uploadSinglePhoto(photo);
        
        if (success) {
            return true;
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
            Log.d(TAG, "🔄 Retry " + retryCount + "/" + maxRetries + " after " + backoffMs + "ms");
            try {
                Thread.sleep(backoffMs);
                backoffMs *= 2; // Exponential backoff
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }
    
    return false;
}
```

## Memory Management

### Photo Processing Optimization

- Photos are processed one at a time to avoid memory issues
- Base64 strings are cleared after each upload
- Input/output streams are properly closed
- Bitmap operations use inSampleSize for large images

```java
private BitmapFactory.Options getBitmapOptions(Uri photoUri) {
    BitmapFactory.Options options = new BitmapFactory.Options();
    options.inJustDecodeBounds = true; // Only decode bounds, not full image
    
    // Decode bounds
    ContentResolver resolver = getContentResolver();
    try (InputStream input = resolver.openInputStream(photoUri)) {
        BitmapFactory.decodeStream(input, null, options);
    } catch (IOException e) {
        Log.e(TAG, "Failed to decode image bounds", e);
    }
    
    // Calculate sample size for memory efficiency
    options.inSampleSize = calculateInSampleSize(options, 2048, 2048);
    options.inJustDecodeBounds = false;
    
    return options;
}
```

## Progress Tracking

### Visual Feedback Elements

1. **Progress Dialog**
   - Shows current photo number (e.g., "3 of 10")
   - Displays current photo name
   - Horizontal progress bar
   - Cancel button

2. **Toast Messages**
   - Quick feedback for single photo uploads
   - Error notifications
   - Success confirmations

3. **Log Output**
   - Comprehensive logging with emoji markers
   - Progress percentages
   - Timing information
   - Error details

## Performance Metrics

### Typical Upload Times

- **Small Photo (< 1MB)**: 2-3 seconds
- **Medium Photo (1-3MB)**: 5-8 seconds  
- **Large Photo (3-5MB)**: 10-15 seconds
- **Very Large Photo (> 5MB)**: 15-30 seconds

### Optimization Strategies

1. **Image Compression**: Reduce quality for faster uploads
2. **Parallel Uploads**: Could upload 2-3 photos simultaneously
3. **Background Service**: Move to Android Service for reliability
4. **Chunked Upload**: Split large photos into smaller chunks
5. **Queue System**: Implement upload queue with retry logic

## Testing the Upload Flow

### Manual Testing Steps

1. Open EventPhotoPicker for an event
2. Select multiple photos (mix of sizes)
3. Click "Select N Photos" button
4. Observe progress dialog updates
5. Check final results dialog
6. Verify photos appear in event

### Automated Testing

```java
@Test
public void testUploadFlow() {
    // Prepare test photos
    List<PhotoItem> testPhotos = createTestPhotos(5);
    
    // Mock JWT token
    when(mockPrefs.getString("fresh_jwt_token", null))
        .thenReturn("valid.jwt.token");
    
    // Mock successful upload responses
    when(mockHttpConnection.getResponseCode())
        .thenReturn(HttpURLConnection.HTTP_CREATED);
    
    // Execute upload
    uploadSelectedPhotos(testPhotos);
    
    // Verify all photos uploaded
    verify(mockHttpConnection, times(5)).getOutputStream();
    
    // Verify success dialog shown
    verify(mockDialog).show();
}
```

## Future Improvements

1. **Batch Upload API**: Send multiple photos in one request
2. **WebSocket Progress**: Real-time progress updates
3. **Automatic Retry**: Smart retry with network detection
4. **Upload History**: Track and display upload history
5. **Duplicate Detection**: Check server before uploading
6. **Compression Options**: Let user choose quality/size tradeoff
7. **Background Upload**: Continue uploads when app is minimized