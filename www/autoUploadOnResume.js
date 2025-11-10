// Auto-Upload on Resume - iOS timing
// This script automatically triggers getUserEvents when the app/page becomes active

console.log('🚀 AutoUpload on Resume script loaded');
console.log('🔍 DEBUG: window.supabase available:', !!window.supabase);
console.log('🔍 DEBUG: document.hidden status:', document.hidden);

let autoUploadInProgress = false;

async function triggerAutoUploadFlow() {
    if (autoUploadInProgress) {
        console.log('⏳ AutoUpload already in progress, skipping');
        return;
    }
    
    // CRITICAL FIX: Check permission gate before triggering auto-upload
    try {
        console.log('🚪 AUTO-TRIGGER: Checking permission gate before auto-upload...');
        
        // Wait for permission gate to complete its initial check
        const gate = await window.waitForPermissionGate(3000);
        
        if (gate.blocked) {
            console.log('🚫 AUTO-TRIGGER: Permission gate BLOCKED - auto-upload skipped');
            console.log('🚫 Reason:', gate.reason);
            console.log('🚫 Permissions:', gate.permissions);
            return; // Exit early - don't trigger auto-upload
        }
        
        console.log('✅ AUTO-TRIGGER: Permission gate CLEARED - proceeding with auto-upload');
        console.log('✅ Permissions:', gate.permissions);
        
    } catch (error) {
        console.warn('⚠️ AUTO-TRIGGER: Permission gate check failed, proceeding anyway:', error);
        // Continue with auto-upload on error to avoid blocking
    }
    
    autoUploadInProgress = true;
    
    try {
        console.log('🔧 ⏱️ AUTO-TRIGGER: Starting auto-upload flow...');
        console.log('🔧 ⏱️ Timestamp:', new Date().toISOString());
        
        // CRITICAL FIX: Check if user has events and auto-upload enabled BEFORE showing overlay
        console.log('🔍 PRE-CHECK: Verifying user has events with auto-upload enabled...');
        
        // Check if auto-upload is globally enabled (check multiple possible keys)
        let globalAutoUploadEnabled = false;
        
        // Check the key from React app settings
        const settingsString = localStorage.getItem('auto-upload-settings');
        if (settingsString) {
            try {
                const settings = JSON.parse(settingsString);
                globalAutoUploadEnabled = settings.autoUploadEnabled === true;
                console.log('🔍 Auto-upload enabled from settings:', globalAutoUploadEnabled);
            } catch (e) {
                console.warn('Failed to parse auto-upload-settings:', e);
            }
        }
        
        // Fallback to other keys if settings not found
        if (!globalAutoUploadEnabled) {
            globalAutoUploadEnabled = localStorage.getItem('globalAutoUploadEnabled') === 'true';
            console.log('🔍 Fallback global auto-upload check:', globalAutoUploadEnabled);
        }
        
        console.log('🔍 Final auto-upload enabled status:', globalAutoUploadEnabled);
        
        if (!globalAutoUploadEnabled) {
            console.log('❌ PRE-CHECK: Auto-upload disabled - skipping');
            autoUploadInProgress = false;
            return;
        }
        
        // Check if user has any events (using websiteIntegration if available)
        let hasEvents = false;
        try {
            if (window.WebsiteIntegration) {
                console.log('🔍 PRE-CHECK: Using WebsiteIntegration to check for active events...');
                const activeEvents = await window.WebsiteIntegration.getActiveAutoUploadEvents();
                hasEvents = activeEvents && activeEvents.length > 0;
                console.log('🔍 PRE-CHECK: Found', activeEvents?.length || 0, 'active auto-upload events');
            } else {
                console.log('🔍 PRE-CHECK: WebsiteIntegration not available, checking via Supabase...');
                // Fallback: Check via direct Supabase query
                if (window.supabase?.auth) {
                    const session = await window.supabase.auth.getSession();
                    if (session?.data?.session?.user) {
                        const { data: events } = await window.supabase
                            .from('event_participants')
                            .select('events!inner(*)')
                            .eq('user_id', session.data.session.user.id)
                            .eq('events.is_live', true)
                            .eq('auto_upload_enabled', true);
                        hasEvents = events && events.length > 0;
                        console.log('🔍 PRE-CHECK: Found', events?.length || 0, 'events with auto-upload enabled');
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ PRE-CHECK: Failed to check events, proceeding anyway:', error);
            hasEvents = true; // Be permissive on error to avoid blocking legitimate users
        }
        
        if (!hasEvents) {
            console.log('❌ PRE-CHECK: No events with auto-upload enabled - skipping overlay');
            autoUploadInProgress = false;
            return;
        }
        
        console.log('✅ PRE-CHECK: User has events with auto-upload enabled - proceeding');
        
        // Step 1: Get Supabase token (iOS-compatible approach)
        console.log('🔐 Getting Supabase session token...');
        console.log('🔍 DEBUG: window.supabase type:', typeof window.supabase);
        console.log('🔍 DEBUG: window.supabase.auth available:', !!window.supabase?.auth);
        
        if (!window.supabase) {
            console.error('❌ Supabase not available');
            return;
        }
        
        // Get current session using iOS-compatible method
        const { data: sessionData, error: sessionError } = await window.supabase.auth.getSession();
        
        if (sessionError) {
            console.error('❌ Error getting Supabase session:', sessionError);
            return;
        }
        
        if (!sessionData?.session?.access_token) {
            console.error('❌ No access token in session');
            return;
        }
        
        const accessToken = sessionData.session.access_token;
        const userId = sessionData.session.user?.id;
        
        console.log('✅ Supabase token obtained');
        console.log('👤 User ID:', userId);
        console.log('🔐 Token preview:', accessToken.substring(0, 20) + '...');
        
        // Step 2: Trigger auto-upload flow (JWT token will be handled by AppDelegate in AutoUploadPlugin)
        console.log('🚀 Starting auto-upload flow...');
        
        try {
            if (window.Capacitor?.Plugins?.AutoUpload) {
                const result = await window.Capacitor.Plugins.AutoUpload.startAutoUploadFlow({
                    supabaseToken: accessToken,
                    userId: userId
                });
                console.log('✅ Auto-upload flow completed:', result);
            } else {
                console.error('❌ AutoUpload plugin not available');
            }
        } catch (autoUploadError) {
            console.error('❌ Auto-upload flow failed:', autoUploadError);
        }
        
    } catch (error) {
        console.error('❌ AUTO-TRIGGER: Token retrieval failed:', error);
    } finally {
        autoUploadInProgress = false;
    }
}

// Trigger when page becomes visible (Android-style app resume)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('👁️ Page became visible - triggering auto-upload check');
        setTimeout(triggerAutoUploadFlow, 1000); // 1 second delay for stability
    }
});

// Trigger when page loads (if already visible)
if (!document.hidden) {
    console.log('👁️ Page loaded and visible - triggering auto-upload check');
    setTimeout(triggerAutoUploadFlow, 2000); // 2 second delay for full page load
}

// Expose manual trigger for debugging
window.triggerAutoUpload = triggerAutoUploadFlow;

console.log('🚀 AutoUpload on Resume script ready - will auto-trigger on visibility change');