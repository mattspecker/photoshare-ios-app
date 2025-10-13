// Native Gallery PhotoViewer Integration
// Handles the bridge between NativeGalleryPlugin and PhotoViewer plugin for smooth iOS gallery experience

(function() {
    'use strict';
    
    console.log('🖼️ Native Gallery PhotoViewer integration loading...');

    // Check if Capacitor is available
    if (!window.Capacitor) {
        console.warn('⚠️ Capacitor not available, native gallery integration disabled');
        return;
    }

    const { Capacitor } = window;
    const { NativeGallery } = Capacitor.Plugins;

    // Import PhotoViewer plugin
    let PhotoViewer;
    try {
        PhotoViewer = Capacitor.Plugins.PhotoViewer;
        if (!PhotoViewer) {
            console.warn('⚠️ PhotoViewer plugin not found');
            return;
        }
    } catch (error) {
        console.error('❌ Error loading PhotoViewer plugin:', error);
        return;
    }

    // Listen for showPhotoViewer events from NativeGalleryPlugin
    if (NativeGallery && NativeGallery.addListener) {
        NativeGallery.addListener('showPhotoViewer', async (data) => {
            console.log('🖼️ Received showPhotoViewer event:', data);
            
            try {
                const { images, startIndex } = data;
                
                if (!images || !Array.isArray(images) || images.length === 0) {
                    console.error('❌ Invalid images data received');
                    return;
                }

                // Format images for PhotoViewer
                const formattedImages = images.map(img => ({
                    url: img.url,
                    title: img.title || '',
                    subtitle: img.subtitle || ''
                }));

                console.log(`🖼️ Opening PhotoViewer with ${formattedImages.length} images, starting at index ${startIndex}`);

                // Call PhotoViewer.show with the formatted data
                await PhotoViewer.show({
                    images: formattedImages,
                    mode: 'gallery',
                    startIndex: startIndex || 0,
                    options: {
                        share: true,
                        title: true
                    }
                });

                console.log('✅ PhotoViewer opened successfully');

            } catch (error) {
                console.error('❌ Error opening PhotoViewer:', error);
            }
        });

        console.log('✅ Native Gallery PhotoViewer listener registered');
    } else {
        console.warn('⚠️ NativeGallery plugin not available or addListener method missing');
    }

    // Add download functionality integration
    // This will be called from the PhotoViewer when download is requested
    window.downloadPhotoFromGallery = async function(photoUrl) {
        console.log('📥 Download requested for photo:', photoUrl);
        
        try {
            if (NativeGallery && NativeGallery.downloadPhoto) {
                const result = await NativeGallery.downloadPhoto({
                    url: photoUrl
                });
                console.log('✅ Photo download successful:', result);
                return result;
            } else {
                throw new Error('NativeGallery downloadPhoto method not available');
            }
        } catch (error) {
            console.error('❌ Error downloading photo:', error);
            throw error;
        }
    };

    // Add share functionality integration  
    window.sharePhotoFromGallery = async function(photoUrl) {
        console.log('📤 Share requested for photo:', photoUrl);
        
        try {
            if (NativeGallery && NativeGallery.sharePhoto) {
                const result = await NativeGallery.sharePhoto({
                    url: photoUrl
                });
                console.log('✅ Photo share successful:', result);
                return result;
            } else {
                throw new Error('NativeGallery sharePhoto method not available');
            }
        } catch (error) {
            console.error('❌ Error sharing photo:', error);
            throw error;
        }
    };

    console.log('🎉 Native Gallery PhotoViewer integration loaded successfully');

})();