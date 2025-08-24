// Plugin Diagnostic Script - Step by step debugging
(function() {
    console.log('🔧 Plugin diagnostic script loading...');
    
    // Step 1: Basic Capacitor and Platform Detection
    function checkBasicRequirements() {
        console.log('\n📋 STEP 1: Basic Requirements Check');
        console.log('==================================');
        
        const checks = {
            capacitor: !!window.Capacitor,
            isNative: window.Capacitor?.isNativePlatform?.(),
            plugins: !!window.Capacitor?.Plugins,
            pluginCount: window.Capacitor?.Plugins ? Object.keys(window.Capacitor.Plugins).length : 0
        };
        
        console.log('✅ Capacitor available:', checks.capacitor);
        console.log('✅ Native platform:', checks.isNative);
        console.log('✅ Plugins object:', checks.plugins);
        console.log('✅ Plugin count:', checks.pluginCount);
        
        if (checks.pluginCount > 0) {
            console.log('📋 Available plugins:', Object.keys(window.Capacitor.Plugins));
        }
        
        return checks.capacitor && checks.isNative && checks.plugins;
    }
    
    // Step 2: EventPhotoPicker Plugin Detection
    function checkEventPhotoPickerPlugin() {
        console.log('\n📋 STEP 2: EventPhotoPicker Plugin Detection');
        console.log('=============================================');
        
        const hasPlugin = !!window.Capacitor?.Plugins?.EventPhotoPicker;
        console.log('✅ EventPhotoPicker plugin found:', hasPlugin);
        
        if (hasPlugin) {
            const plugin = window.Capacitor.Plugins.EventPhotoPicker;
            console.log('📋 Plugin object:', plugin);
            console.log('📋 Plugin methods:', Object.getOwnPropertyNames(plugin));
            
            // Check specific methods
            const methods = ['getEventPhotosMetadata', 'openEventPhotoPicker', 'showEventInfo'];
            methods.forEach(method => {
                console.log(`📋 ${method}:`, typeof plugin[method]);
            });
        }
        
        return hasPlugin;
    }
    
    // Step 3: Test Method Availability (without calling)
    function checkMethodAvailability() {
        console.log('\n📋 STEP 3: Method Availability Test');
        console.log('===================================');
        
        if (!window.Capacitor?.Plugins?.EventPhotoPicker) {
            console.log('❌ Plugin not available for method testing');
            return false;
        }
        
        const plugin = window.Capacitor.Plugins.EventPhotoPicker;
        const testMethods = [
            'getEventPhotosMetadata',
            'openEventPhotoPicker', 
            'showEventInfo'
        ];
        
        const results = {};
        testMethods.forEach(methodName => {
            try {
                const method = plugin[methodName];
                results[methodName] = {
                    exists: typeof method === 'function',
                    type: typeof method,
                    callable: !!method
                };
                console.log(`✅ ${methodName}:`, results[methodName]);
            } catch (error) {
                results[methodName] = { error: error.message };
                console.log(`❌ ${methodName}: Error -`, error.message);
            }
        });
        
        return results;
    }
    
    // Step 4: Simple Method Call Test (safest method first)
    async function testSimpleMethodCall() {
        console.log('\n📋 STEP 4: Simple Method Call Test');
        console.log('==================================');
        
        if (!window.Capacitor?.Plugins?.EventPhotoPicker) {
            console.log('❌ Plugin not available for method call testing');
            return false;
        }
        
        try {
            // Test the showEventInfo method first as it's simplest
            console.log('🧪 Testing showEventInfo method...');
            const result = await window.Capacitor.Plugins.EventPhotoPicker.showEventInfo({
                eventName: 'Test Event',
                startDate: '2025-08-17T10:00:00Z',
                endDate: '2025-08-17T18:00:00Z',
                timezone: 'America/New_York'
            });
            
            console.log('✅ showEventInfo SUCCESS!', result);
            return true;
            
        } catch (error) {
            console.log('❌ showEventInfo FAILED:', error.message);
            console.log('❌ Error details:', error);
            
            // Check if it's a specific iOS implementation error
            if (error.message.includes('not implemented on ios')) {
                console.log('🔍 This is an iOS implementation registration issue');
                console.log('🔍 Plugin appears in list but native bridge is not working');
            }
            
            return false;
        }
    }
    
    // Step 5: Advanced Method Test (getEventPhotosMetadata)
    async function testAdvancedMethodCall() {
        console.log('\n📋 STEP 5: Advanced Method Call Test');
        console.log('====================================');
        
        if (!window.Capacitor?.Plugins?.EventPhotoPicker) {
            console.log('❌ Plugin not available for advanced testing');
            return false;
        }
        
        try {
            console.log('🧪 Testing getEventPhotosMetadata method...');
            const result = await window.Capacitor.Plugins.EventPhotoPicker.getEventPhotosMetadata({
                startDate: '2025-08-17T10:00:00Z',
                endDate: '2025-08-17T18:00:00Z',
                uploadedPhotoIds: [],
                timezone: 'America/New_York'
            });
            
            console.log('✅ getEventPhotosMetadata SUCCESS!', result);
            return true;
            
        } catch (error) {
            console.log('❌ getEventPhotosMetadata FAILED:', error.message);
            console.log('❌ Error details:', error);
            return false;
        }
    }
    
    // Run Full Diagnostic
    async function runFullDiagnostic() {
        console.log('🚀 Starting EventPhotoPicker Plugin Diagnostic');
        console.log('==============================================\n');
        
        const results = {
            basicRequirements: false,
            pluginDetection: false,
            methodAvailability: false,
            simpleMethodCall: false,
            advancedMethodCall: false
        };
        
        // Step 1: Basic requirements
        results.basicRequirements = checkBasicRequirements();
        
        if (!results.basicRequirements) {
            console.log('\n🛑 DIAGNOSTIC STOPPED: Basic requirements not met');
            return results;
        }
        
        // Step 2: Plugin detection
        results.pluginDetection = checkEventPhotoPickerPlugin();
        
        if (!results.pluginDetection) {
            console.log('\n🛑 DIAGNOSTIC STOPPED: EventPhotoPicker plugin not found');
            return results;
        }
        
        // Step 3: Method availability
        results.methodAvailability = checkMethodAvailability();
        
        // Step 4: Simple method call
        results.simpleMethodCall = await testSimpleMethodCall();
        
        // Step 5: Advanced method call (only if simple worked)
        if (results.simpleMethodCall) {
            results.advancedMethodCall = await testAdvancedMethodCall();
        }
        
        // Summary
        console.log('\n📊 DIAGNOSTIC SUMMARY');
        console.log('=====================');
        console.log('✅ Basic Requirements:', results.basicRequirements);
        console.log('✅ Plugin Detection:', results.pluginDetection);
        console.log('✅ Method Availability:', !!results.methodAvailability);
        console.log('✅ Simple Method Call:', results.simpleMethodCall);
        console.log('✅ Advanced Method Call:', results.advancedMethodCall);
        
        if (results.simpleMethodCall && results.advancedMethodCall) {
            console.log('\n🎉 ALL TESTS PASSED! Plugin is fully functional!');
        } else if (results.pluginDetection && !results.simpleMethodCall) {
            console.log('\n⚠️ PLUGIN REGISTRATION ISSUE: Plugin detected but methods fail');
            console.log('💡 This suggests the native iOS implementation is not properly bridged');
        } else {
            console.log('\n❌ PLUGIN NOT WORKING: See individual test results above');
        }
        
        return results;
    }
    
    // Override upload buttons with diagnostic version
    function overrideUploadButtonsWithDiagnostic() {
        const buttons = document.querySelectorAll('button');
        let found = 0;
        
        buttons.forEach(button => {
            const text = (button.textContent || '').toLowerCase();
            
            if (text.includes('upload') || text.includes('share') || text.includes('photo')) {
                console.log('📤 Found upload button:', text.substring(0, 30));
                
                // Clone button to remove existing listeners
                const newButton = button.cloneNode(true);
                
                // Add our click handler
                newButton.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📸 Upload button intercepted! Running diagnostic...');
                    runFullDiagnostic();
                    return false;
                };
                
                // Replace the button
                button.parentNode.replaceChild(newButton, button);
                found++;
            }
        });
        
        console.log(`✅ Overrode ${found} upload buttons (diagnostic mode)`);
        return found;
    }
    
    // Run after page loads
    setTimeout(overrideUploadButtonsWithDiagnostic, 1000);
    
    // Expose diagnostic functions
    window.runPluginDiagnostic = runFullDiagnostic;
    window.checkEventPhotoPickerPlugin = checkEventPhotoPickerPlugin;
    window.testSimpleMethodCall = testSimpleMethodCall;
    window.testAdvancedMethodCall = testAdvancedMethodCall;
    
    console.log('✅ Plugin diagnostic script ready');
    console.log('🧪 Run diagnostic: runPluginDiagnostic()');
    
})();