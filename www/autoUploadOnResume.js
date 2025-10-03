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
    
    autoUploadInProgress = true;
    
    try {
        console.log('🔧 ⏱️ AUTO-TRIGGER: Starting auto-upload flow...');
        console.log('🔧 ⏱️ Timestamp:', new Date().toISOString());
        
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