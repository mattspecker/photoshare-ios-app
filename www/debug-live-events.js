/**
 * Debug Live Events - App-Side Troubleshooting Tool
 * Checks for live events and diagnoses why enabled events shows 0
 */

console.log('🔍 Debug Live Events tool loading...');

(function() {
    'use strict';

    class DebugLiveEvents {
        constructor() {
            this.results = {};
        }

        async runFullDiagnostic() {
            console.log('🚀 Starting comprehensive live events diagnostic...');
            
            this.results = {
                timestamp: new Date().toISOString(),
                checks: {},
                recommendations: []
            };

            // Check 1: Authentication
            await this.checkAuthentication();
            
            // Check 2: Mobile Settings Service
            await this.checkMobileSettings();
            
            // Check 3: Local Storage
            await this.checkLocalStorage();
            
            // Check 4: Backend Connection  
            await this.checkBackendData();
            
            // Check 5: Real-time Sync
            await this.checkRealTimeSync();
            
            // Check 6: Event Detection
            await this.checkEventDetection();
            
            // Generate recommendations
            this.generateRecommendations();
            
            // Display results
            this.displayResults();
            
            return this.results;
        }

        async checkAuthentication() {
            console.log('🔐 Checking authentication...');
            
            const check = { name: 'Authentication', status: 'unknown', details: {} };
            
            try {
                const authService = window.PhotoShareAutoUpload?.authService;
                const currentUser = authService?.getCurrentUser();
                const supabaseClient = authService?.getSupabaseClient();
                
                check.details = {
                    authServiceExists: !!authService,
                    currentUser: currentUser ? {
                        id: currentUser.id,
                        email: currentUser.email
                    } : null,
                    supabaseClientExists: !!supabaseClient,
                    isAuthenticated: authService?.isAuthenticated() || false
                };
                
                if (currentUser && supabaseClient) {
                    check.status = 'success';
                } else {
                    check.status = 'error';
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.authentication = check;
            console.log('🔐 Auth check result:', check);
        }

        async checkMobileSettings() {
            console.log('⚙️ Checking mobile settings service...');
            
            const check = { name: 'Mobile Settings', status: 'unknown', details: {} };
            
            try {
                const settingsService = window.PhotoShareAutoUpload?.settingsService;
                
                if (settingsService) {
                    const enabledEvents = settingsService.getEnabledEvents() || [];
                    const allSettings = Array.from(settingsService.eventSettings?.entries() || []);
                    
                    check.details = {
                        serviceExists: true,
                        enabledEventsCount: enabledEvents.length,
                        enabledEvents: enabledEvents,
                        allStoredSettings: allSettings.map(([eventId, settings]) => ({
                            eventId,
                            enabled: settings.enabled,
                            enabledAt: settings.enabledAt,
                            options: settings.options
                        }))
                    };
                    
                    check.status = enabledEvents.length > 0 ? 'success' : 'warning';
                } else {
                    check.status = 'error';
                    check.details.serviceExists = false;
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.mobileSettings = check;
            console.log('⚙️ Mobile settings result:', check);
        }

        async checkLocalStorage() {
            console.log('💾 Checking local storage...');
            
            const check = { name: 'Local Storage', status: 'unknown', details: {} };
            
            try {
                const savedSettings = localStorage.getItem('photoshare_auto_upload_settings');
                
                check.details = {
                    hasData: !!savedSettings,
                    rawData: savedSettings
                };
                
                if (savedSettings) {
                    try {
                        const parsed = JSON.parse(savedSettings);
                        check.details.parsedData = parsed;
                        check.details.eventSettingsCount = parsed.eventSettings?.length || 0;
                        check.status = 'success';
                    } catch (parseError) {
                        check.status = 'error';
                        check.details.parseError = parseError.message;
                    }
                } else {
                    check.status = 'warning';
                    check.details.message = 'No local storage data found';
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.localStorage = check;
            console.log('💾 Local storage result:', check);
        }

        async checkBackendData() {
            console.log('🌐 Checking backend data...');
            
            const check = { name: 'Backend Data', status: 'unknown', details: {} };
            
            try {
                const authService = window.PhotoShareAutoUpload?.authService;
                const supabaseClient = authService?.getSupabaseClient();
                const currentUser = authService?.getCurrentUser();
                
                if (!supabaseClient || !currentUser) {
                    check.status = 'error';
                    check.details.message = 'No Supabase client or user available';
                    this.results.checks.backendData = check;
                    return;
                }
                
                // Query event_participants table
                const { data: participants, error: participantsError } = await supabaseClient
                    .from('event_participants')
                    .select('event_id, auto_upload_enabled, auto_upload_start_time, auto_upload_end_time')
                    .eq('user_id', currentUser.id);
                
                if (participantsError) {
                    check.status = 'error';
                    check.error = participantsError.message;
                } else {
                    const autoUploadEnabled = participants.filter(p => p.auto_upload_enabled);
                    
                    check.details = {
                        totalParticipations: participants.length,
                        autoUploadEnabledCount: autoUploadEnabled.length,
                        participations: participants,
                        autoUploadEnabled: autoUploadEnabled
                    };
                    
                    check.status = autoUploadEnabled.length > 0 ? 'success' : 'warning';
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.backendData = check;
            console.log('🌐 Backend data result:', check);
        }

        async checkRealTimeSync() {
            console.log('🔄 Checking real-time sync...');
            
            const check = { name: 'Real-time Sync', status: 'unknown', details: {} };
            
            try {
                const realTimeSync = window.PhotoShareRealTimeSync;
                
                if (realTimeSync) {
                    const status = realTimeSync.getStatus();
                    check.details = status;
                    check.status = status.initialized ? 'success' : 'warning';
                } else {
                    check.status = 'error';
                    check.details.message = 'Real-time sync not available';
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.realTimeSync = check;
            console.log('🔄 Real-time sync result:', check);
        }

        async checkEventDetection() {
            console.log('🎯 Checking event detection...');
            
            const check = { name: 'Event Detection', status: 'unknown', details: {} };
            
            try {
                const eventDetector = window.PhotoShareEventDetector;
                
                if (eventDetector) {
                    const detectedEvents = eventDetector.getDetectedEvents();
                    
                    check.details = {
                        detectorExists: true,
                        detectedEventsCount: detectedEvents.length,
                        detectedEvents: detectedEvents,
                        currentURL: window.location.href,
                        currentPathname: window.location.pathname
                    };
                    
                    check.status = detectedEvents.length > 0 ? 'success' : 'warning';
                } else {
                    check.status = 'error';
                    check.details.detectorExists = false;
                }
                
            } catch (error) {
                check.status = 'error';
                check.error = error.message;
            }
            
            this.results.checks.eventDetection = check;
            console.log('🎯 Event detection result:', check);
        }

        generateRecommendations() {
            console.log('💡 Generating recommendations...');
            
            const { checks } = this.results;
            
            // Check for auth issues
            if (checks.authentication?.status === 'error') {
                this.results.recommendations.push({
                    priority: 'high',
                    issue: 'Authentication failed',
                    action: 'Ensure user is logged in to photo-share.app and refresh the page'
                });
            }
            
            // Check for backend vs mobile mismatch
            const backendCount = checks.backendData?.details?.autoUploadEnabledCount || 0;
            const mobileCount = checks.mobileSettings?.details?.enabledEventsCount || 0;
            
            if (backendCount > 0 && mobileCount === 0) {
                this.results.recommendations.push({
                    priority: 'high',
                    issue: 'Backend has auto-upload enabled but mobile shows 0',
                    action: 'Run: window.PhotoShareRealTimeSync.syncAllEventsToBackend() or force reinitialize'
                });
            }
            
            if (backendCount === 0 && mobileCount > 0) {
                this.results.recommendations.push({
                    priority: 'high',
                    issue: 'Mobile has settings but backend shows none',
                    action: 'Real-time sync may not be working. Check network connection.'
                });
            }
            
            // Check for event detection issues
            if (checks.eventDetection?.details?.detectedEventsCount === 0) {
                this.results.recommendations.push({
                    priority: 'medium',
                    issue: 'No events detected on current page',
                    action: 'Navigate to a specific event page or manually add event ID'
                });
            }
            
            // Check for real-time sync issues
            if (checks.realTimeSync?.status !== 'success') {
                this.results.recommendations.push({
                    priority: 'medium',
                    issue: 'Real-time sync not working properly',
                    action: 'Refresh page or run: window.PhotoShareRealTimeSync.initialize()'
                });
            }
        }

        displayResults() {
            console.log('\n📊 === LIVE EVENTS DIAGNOSTIC RESULTS ===');
            console.log('🕐 Timestamp:', this.results.timestamp);
            console.log('\n📋 Check Results:');
            
            Object.values(this.results.checks).forEach(check => {
                const icon = check.status === 'success' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
                console.log(`${icon} ${check.name}: ${check.status.toUpperCase()}`);
                
                if (check.details) {
                    console.log('   Details:', check.details);
                }
                
                if (check.error) {
                    console.log('   Error:', check.error);
                }
            });
            
            if (this.results.recommendations.length > 0) {
                console.log('\n💡 Recommendations:');
                this.results.recommendations.forEach((rec, index) => {
                    console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
                    console.log(`   Action: ${rec.action}`);
                });
            }
            
            console.log('\n🔧 Quick Fix Commands:');
            console.log('• Force sync all: syncAllEvents()');
            console.log('• Reinitialize: window.PhotoShareAutoUpload.reinitialize()');
            console.log('• Manual toggle: window.PhotoShareEventToggle.toggle("EVENT_ID", true)');
            console.log('• Show dashboard: showDashboard()');
        }

        // Quick fix methods
        async quickFixBackendSync() {
            console.log('🔧 Running quick fix: Backend sync...');
            
            try {
                if (window.PhotoShareRealTimeSync) {
                    const result = await window.PhotoShareRealTimeSync.syncAllEventsToBackend();
                    console.log(`✅ Synced ${result} events to backend`);
                    return result;
                } else {
                    console.log('❌ Real-time sync not available');
                    return false;
                }
            } catch (error) {
                console.error('❌ Quick fix failed:', error);
                return false;
            }
        }

        async quickFixReinitialize() {
            console.log('🔧 Running quick fix: Full reinitialize...');
            
            try {
                await window.PhotoShareAutoUpload?.reinitialize();
                console.log('✅ System reinitialized');
                return true;
            } catch (error) {
                console.error('❌ Reinitialize failed:', error);
                return false;
            }
        }

        manualEventToggle(eventId, enabled = true) {
            console.log(`🔧 Manual toggle: Event ${eventId} = ${enabled}`);
            
            try {
                window.PhotoShareEventToggle?.toggle(eventId, enabled);
                console.log(`✅ Toggled event ${eventId}`);
                return true;
            } catch (error) {
                console.error('❌ Manual toggle failed:', error);
                return false;
            }
        }
    }

    // Create global instance
    const debugTool = new DebugLiveEvents();

    // Expose globally
    window.DebugLiveEvents = debugTool;
    
    // Expose quick commands
    window.diagnoseLiveEvents = () => debugTool.runFullDiagnostic();
    window.quickFixSync = () => debugTool.quickFixBackendSync();
    window.quickFixReinit = () => debugTool.quickFixReinitialize();
    window.manualToggle = (eventId, enabled) => debugTool.manualEventToggle(eventId, enabled);

    console.log('✅ Debug Live Events tool ready');
    console.log('💡 Run: diagnoseLiveEvents() to start diagnostic');

})();