// Dynamic Camera Override - Catches camera object when it's created
(function() {
    console.log('🎯 Setting up dynamic camera override...');
    
    // Method 1: Object.defineProperty to catch when camera is assigned
    let originalCamera = window.camera;
    Object.defineProperty(window, 'camera', {
        get: function() {
            return originalCamera;
        },
        set: function(newCamera) {
            console.log('📸 Camera object being set!', newCamera);
            
            if (newCamera && typeof newCamera.pickImages === 'function') {
                console.log('🎯 Found pickImages method - installing override');
                
                // Store original
                const originalPickImages = newCamera.pickImages.bind(newCamera);
                
                // Override it
                newCamera.pickImages = function(args) {
                    console.log('🎯🎯🎯 INTERCEPTED camera.pickImages!', args);
                    
                    // Show dialog instead
                    if (window.Capacitor?.Plugins?.Dialog) {
                        window.Capacitor.Plugins.Dialog.confirm({
                            title: '📸 Event Photo Upload',
                            message: 'Event Photo Picker Active!\n\nThis would normally open the Event Photo Picker showing only photos from the event time period.\n\n📱 Testing Mode',
                            okButtonTitle: 'Continue',
                            cancelButtonTitle: 'Cancel'
                        }).then(result => {
                            if (result.value) {
                                alert('✅ Success! Event Photo Picker integration working!');
                            }
                        });
                    } else {
                        alert('📸 Event Photo Picker Activated!\n\nCamera picker blocked successfully.\n\nIn full implementation, this would open the Event Photo Picker.');
                    }
                    
                    // Don't call original - we're replacing it
                    console.log('🚫 Original camera picker blocked');
                };
                
                console.log('✅ Camera.pickImages successfully overridden!');
            }
            
            originalCamera = newCamera;
        },
        configurable: true
    });
    
    // Method 2: MutationObserver to watch for script changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
                        // Script added - check for camera object in 100ms
                        setTimeout(() => {
                            if (window.camera && window.camera.pickImages) {
                                console.log('📸 Camera object detected via MutationObserver');
                                // Install override if not already done
                                if (!window.camera.pickImages.toString().includes('INTERCEPTED')) {
                                    installCameraOverride();
                                }
                            }
                        }, 100);
                    }
                });
            }
        });
    });
    
    observer.observe(document.head, { childList: true });
    observer.observe(document.body, { childList: true });
    
    // Method 3: Periodic checking
    let checkCount = 0;
    const checkInterval = setInterval(() => {
        checkCount++;
        
        if (window.camera && window.camera.pickImages) {
            console.log('📸 Camera object found via periodic check');
            
            // Install override if not already done
            if (!window.camera.pickImages.toString().includes('INTERCEPTED')) {
                installCameraOverride();
            }
            
            clearInterval(checkInterval);
        } else if (checkCount >= 60) { // Stop after 30 seconds
            console.log('⏰ Stopped checking for camera object after 30 seconds');
            clearInterval(checkInterval);
        }
    }, 500);
    
    // Method 4: Override common Capacitor plugin loading
    if (window.Capacitor && window.Capacitor.Plugins) {
        const originalPlugins = window.Capacitor.Plugins;
        
        // Watch for Camera plugin specifically
        Object.defineProperty(window.Capacitor, 'Plugins', {
            get: function() {
                return originalPlugins;
            },
            set: function(newPlugins) {
                console.log('🔌 Capacitor.Plugins being updated', newPlugins);
                
                if (newPlugins.Camera && newPlugins.Camera.pickImages) {
                    console.log('📸 Capacitor Camera plugin detected');
                    
                    const originalPickImages = newPlugins.Camera.pickImages.bind(newPlugins.Camera);
                    newPlugins.Camera.pickImages = function(args) {
                        console.log('🎯🎯🎯 INTERCEPTED Capacitor.Plugins.Camera.pickImages!', args);
                        
                        if (window.Capacitor?.Plugins?.Dialog) {
                            return window.Capacitor.Plugins.Dialog.confirm({
                                title: '📸 Event Photo Upload',
                                message: 'Event Photo Picker Active!\n\nCapacitor camera override working!',
                                okButtonTitle: 'Continue',
                                cancelButtonTitle: 'Cancel'
                            });
                        } else {
                            alert('📸 Capacitor Camera Override Working!');
                            return Promise.resolve({ value: true });
                        }
                    };
                }
                
                originalPlugins = newPlugins;
            },
            configurable: true
        });
    }
    
    function installCameraOverride() {
        if (window.camera && window.camera.pickImages) {
            console.log('🎯 Installing camera override on existing object');
            
            const originalPickImages = window.camera.pickImages.bind(window.camera);
            
            window.camera.pickImages = function(args) {
                console.log('🎯🎯🎯 INTERCEPTED camera.pickImages!', args);
                
                if (window.Capacitor?.Plugins?.Dialog) {
                    window.Capacitor.Plugins.Dialog.confirm({
                        title: '📸 Event Photo Upload',
                        message: 'Event Photo Picker Active!\n\nDynamic override successful!',
                        okButtonTitle: 'Continue',
                        cancelButtonTitle: 'Cancel'
                    });
                } else {
                    alert('📸 Dynamic Camera Override Working!');
                }
                
                console.log('🚫 Original camera picker blocked');
            };
            
            console.log('✅ Dynamic camera override installed!');
            return true;
        }
        return false;
    }
    
    // Expose test functions
    window.checkCameraStatus = function() {
        console.log('📊 Camera Status:');
        console.log('  window.camera exists:', !!window.camera);
        console.log('  window.camera.pickImages exists:', !!(window.camera && window.camera.pickImages));
        console.log('  Capacitor.Plugins.Camera exists:', !!(window.Capacitor?.Plugins?.Camera));
        console.log('  Dialog plugin exists:', !!(window.Capacitor?.Plugins?.Dialog));
        
        if (window.camera) {
            console.log('  camera methods:', Object.keys(window.camera));
        }
    };
    
    window.forceInstallOverride = function() {
        return installCameraOverride();
    };
    
    console.log('✅ Dynamic camera override system installed');
    console.log('🧪 Test commands:');
    console.log('  - checkCameraStatus() - Check current state');
    console.log('  - forceInstallOverride() - Force install if camera exists');
    
})();