/**
 * Native Gallery Integration for PhotoShare
 * Automatically detects native app environment and enhances photo galleries
 */

class NativeGalleryIntegration {
    constructor() {
        this.isNative = window.Capacitor?.isNativePlatform?.() || false;
        this.nativeGallery = window.Capacitor?.Plugins?.NativeGallery;
        
        if (this.isNative && this.nativeGallery) {
            console.log('🖼️ Native gallery integration enabled');
            this.init();
        } else {
            console.log('🌐 Using web gallery (not in native app)');
        }
    }
    
    init() {
        // Set up gallery click handlers
        this.setupGalleryHandlers();
        
        // Listen for photo report events from native gallery
        this.setupReportListener();
    }
    
    setupGalleryHandlers() {
        // Use event delegation to handle dynamically added galleries
        document.addEventListener('click', async (e) => {
            // FIRST: Check if we're inside a gallery container
            const gallery = e.target.closest(
                '.live-gallery, [data-gallery], .photo-gallery, .event-gallery, .gallery-grid, .image-grid'
            );
            if (!gallery) return;
            
            // IMMEDIATELY prevent any other handlers from running (including React)
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Find the clicked photo (could be img, button, or card)
            let img = e.target.closest('img');
            if (!img) {
                // If we didn't click the image directly, find it in the parent card
                const card = e.target.closest('.group');
                if (card) {
                    img = card.querySelector('img[data-photo-id]');
                }
            }
            
            if (!img) {
                console.log('No image found in gallery click');
                return;
            }
            
            console.log('📸 Opening native gallery for image:', img.alt || img.src);
            
            // Collect all gallery images
            const images = gallery.querySelectorAll('img[data-photo-id]');
            const photos = Array.from(images).map((img, index) => ({
                url: img.src || img.dataset.src || img.currentSrc,
                title: img.alt || img.title || `Photo ${index + 1}`,
                id: img.dataset.photoId || img.dataset.id || `${Date.now()}-${index}`,
                uploadedBy: img.dataset.uploadedBy || 'Unknown',
                uploadedAt: img.dataset.uploadedAt || '',
                isOwn: img.dataset.isOwn === 'true',
                thumbnailUrl: img.dataset.thumbnailUrl || img.src, // Aspect-ratio-preserving thumbnail
                fullUrl: img.dataset.fullUrl || img.src // Original full-resolution URL
            })).filter(photo => photo.url); // Only include images with valid URLs
            
            const clickedIndex = Array.from(images).indexOf(img);
            
            try {
                await this.nativeGallery.openGallery({
                    photos: photos,
                    startIndex: Math.max(0, clickedIndex),
                    eventId: gallery.dataset.eventId || null
                });
            } catch (error) {
                console.error('❌ Failed to open native gallery:', error);
                // Fallback: let the web handle it normally
                // Don't open in new window, let web gallery handle it
                console.log('Falling back to web gallery');
            }
        }, { capture: true, passive: false }); // Use capture phase with passive: false to allow preventDefault
    }
    
    setupReportListener() {
        if (this.nativeGallery?.addListener) {
            this.nativeGallery.addListener('photoReported', (data) => {
                console.log('🚩 Photo reported from native gallery:', data.photoId);
                
                // Call your app's report handler
                this.handlePhotoReport(data.photoId);
            });
        }
    }
    
    handlePhotoReport(photoId) {
        // Trigger custom event for React components to handle
        const event = new CustomEvent('photoReported', {
            detail: { photoId }
        });
        document.dispatchEvent(event);
        
        // Also set global function if available
        if (window.reportPhoto) {
            window.reportPhoto(photoId);
        }
        
        console.log(`Photo ${photoId} reported - event dispatched`);
    }
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.nativeGalleryIntegration = new NativeGalleryIntegration();
    });
} else {
    window.nativeGalleryIntegration = new NativeGalleryIntegration();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NativeGalleryIntegration;
}
