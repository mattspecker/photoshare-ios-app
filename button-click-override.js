// Button Click Override - Intercept upload button clicks before camera.pickImages is created
(function() {
    console.log('🎯 Setting up upload button click override...');
    
    // Function to show our Event Photo Picker dialog
    async function showEventPhotoPickerDialog(originalEvent) {
        console.log('📸 Upload button intercepted - showing Event Photo Picker dialog');
        
        try {
            if (window.Capacitor?.Plugins?.Dialog) {
                console.log('✅ Using native Capacitor Dialog');
                
                const result = await window.Capacitor.Plugins.Dialog.confirm({
                    title: '📸 Event Photo Upload',
                    message: `🎯 Event Photo Picker Active!

This upload will use the Event Photo Picker to show only photos from this event's time period.

📱 Feature Status: Testing Mode
📍 Upload intercepted successfully!`,
                    okButtonTitle: 'Continue with Event Photos',
                    cancelButtonTitle: 'Cancel'
                });
                
                if (result.value) {
                    console.log('✅ User chose Event Photo Picker');
                    
                    // Show success message
                    await window.Capacitor.Plugins.Dialog.alert({
                        title: '✅ Success!',
                        message: 'Event Photo Picker integration working!\n\nIn full implementation, this would:\n• Open native Event Photo Picker\n• Show only photos from event dates\n• Allow multi-selection\n• Return selected photos for upload'
                    });
                } else {
                    console.log('❌ User cancelled Event Photo Picker');
                }
            } else {
                // Fallback to browser alert
                console.log('⚠️ Using browser alert fallback');
                const confirmed = confirm(`📸 Event Photo Upload

🎯 Event Photo Picker Active!

This upload will use the Event Photo Picker to show only photos from this event's time period.

📱 Feature Status: Testing Mode
📍 Upload intercepted successfully!

Click OK to continue or Cancel to abort.`);
                
                if (confirmed) {
                    alert('✅ Success!\n\nEvent Photo Picker integration working!\n\nUpload button click intercepted before camera.pickImages was created.');
                }
            }
        } catch (error) {
            console.error('❌ Error showing Event Photo Picker dialog:', error);
        }
    }
    
    // Method 1: Override addEventListener for click events
    const originalAddEventListener = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this.tagName === 'BUTTON') {
            // Check if this looks like an upload button
            const buttonText = this.textContent || this.innerText || '';
            const buttonClass = this.className || '';
            const buttonId = this.id || '';
            
            const isUploadButton = 
                buttonText.toLowerCase().includes('upload') ||
                buttonText.toLowerCase().includes('share') ||
                buttonText.toLowerCase().includes('photo') ||
                buttonClass.toLowerCase().includes('upload') ||
                buttonClass.toLowerCase().includes('share') ||
                buttonId.toLowerCase().includes('upload');
            
            if (isUploadButton) {
                console.log('🎯 Upload button detected during addEventListener:', {
                    text: buttonText,
                    class: buttonClass,
                    id: buttonId
                });
                
                // Wrap the original listener
                const wrappedListener = function(event) {
                    console.log('📤 Upload button clicked - intercepting!');
                    
                    // Prevent the original handler
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    
                    // Show our dialog instead
                    showEventPhotoPickerDialog(event);
                    
                    // Don't call the original listener
                    console.log('🚫 Original upload handler blocked');
                };
                
                return originalAddEventListener.call(this, type, wrappedListener, options);
            }
        }
        
        // Call original for non-upload buttons
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Method 2: Find and override existing upload buttons
    function findAndOverrideUploadButtons() {
        const selectors = [
            'button[class*="upload"]',
            'button[class*="share"]',
            'button[id*="upload"]',
            'button:contains("Upload")',
            'button:contains("Share")',
            'button:contains("Photo")',
            '[data-upload]',
            '[data-share]'
        ];
        
        // Also search by text content
        const allButtons = document.querySelectorAll('button');
        const uploadButtons = Array.from(allButtons).filter(button => {
            const text = (button.textContent || button.innerText || '').toLowerCase();
            const className = (button.className || '').toLowerCase();
            const id = (button.id || '').toLowerCase();
            
            return text.includes('upload') || 
                   text.includes('share') || 
                   text.includes('photo') ||
                   className.includes('upload') ||
                   className.includes('share') ||
                   id.includes('upload');
        });
        
        console.log(`📱 Found ${uploadButtons.length} potential upload buttons:`, uploadButtons);
        
        uploadButtons.forEach((button, index) => {
            console.log(`🔘 Button ${index + 1}:`, {
                text: button.textContent || button.innerText,
                class: button.className,
                id: button.id
            });
            
            // Remove existing listeners and add our own
            const newButton = button.cloneNode(true);
            
            newButton.addEventListener('click', function(event) {
                console.log('📤 Upload button clicked (direct override)!');
                
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                showEventPhotoPickerDialog(event);
            });
            
            button.parentNode?.replaceChild(newButton, button);
            console.log(`✅ Button ${index + 1} overridden`);
        });
        
        return uploadButtons.length;
    }
    
    // Method 3: Use MutationObserver to catch dynamically added buttons
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Check if the node itself is an upload button
                    if (node.tagName === 'BUTTON') {
                        const text = (node.textContent || '').toLowerCase();
                        if (text.includes('upload') || text.includes('share') || text.includes('photo')) {
                            console.log('📱 New upload button detected via MutationObserver');
                            overrideSingleButton(node);
                        }
                    }
                    
                    // Check for upload buttons within the added node
                    if (node.querySelectorAll) {
                        const buttons = node.querySelectorAll('button');
                        buttons.forEach(button => {
                            const text = (button.textContent || '').toLowerCase();
                            if (text.includes('upload') || text.includes('share') || text.includes('photo')) {
                                console.log('📱 New upload button found in added content');
                                overrideSingleButton(button);
                            }
                        });
                    }
                }
            });
        });
    });
    
    function overrideSingleButton(button) {
        const newButton = button.cloneNode(true);
        
        newButton.addEventListener('click', function(event) {
            console.log('📤 Upload button clicked (mutation observer override)!');
            
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            showEventPhotoPickerDialog(event);
        });
        
        button.parentNode?.replaceChild(newButton, button);
        console.log('✅ Button overridden via MutationObserver');
    }
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Method 4: Override common click handlers
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        if (target.tagName === 'BUTTON') {
            const text = (target.textContent || target.innerText || '').toLowerCase();
            const className = (target.className || '').toLowerCase();
            
            if (text.includes('upload') || text.includes('share') || 
                className.includes('upload') || className.includes('share')) {
                
                console.log('📤 Upload button click captured via document listener!');
                console.log('📋 Button details:', {
                    text: target.textContent,
                    class: target.className,
                    id: target.id
                });
                
                // Let this one through for now, but log it
                // We can uncomment these lines to block it:
                // event.preventDefault();
                // event.stopPropagation();
                // showEventPhotoPickerDialog(event);
            }
        }
    }, true); // Use capture phase
    
    // Initialize
    setTimeout(() => {
        const buttonCount = findAndOverrideUploadButtons();
        console.log(`✅ Upload button override system installed - found ${buttonCount} buttons`);
    }, 1000);
    
    // Expose test functions
    window.testUploadOverride = function() {
        console.log('🧪 Testing upload override...');
        showEventPhotoPickerDialog({ type: 'test' });
    };
    
    window.findUploadButtons = function() {
        return findAndOverrideUploadButtons();
    };
    
    window.checkUploadButtons = function() {
        const allButtons = document.querySelectorAll('button');
        console.log('📊 All buttons on page:', allButtons.length);
        
        Array.from(allButtons).forEach((button, index) => {
            const text = button.textContent || button.innerText || '';
            const className = button.className || '';
            console.log(`Button ${index + 1}:`, {
                text: text.substring(0, 50),
                class: className.substring(0, 50),
                id: button.id
            });
        });
    };
    
    console.log('✅ Upload button click override system installed');
    console.log('🧪 Test commands:');
    console.log('  - testUploadOverride() - Test the dialog');
    console.log('  - findUploadButtons() - Find and override upload buttons');
    console.log('  - checkUploadButtons() - List all buttons on page');
    
})();