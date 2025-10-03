// AutoUpload Test Script - Runs after redirect to photo-share.app
// This script will be injected into photo-share.app to test AutoUpload with real Supabase session

console.log('🚀 ==================== POST-REDIRECT AUTO UPLOAD TEST ====================');
console.log('🚀 AutoUpload test starting on photo-share.app with full Supabase session...');

// Wait for page to be fully loaded and Supabase to be ready
function waitForSupabaseAndTest() {
  console.log('⏳ Waiting for Supabase and AutoUpload plugin to be ready...');
  
  // Check if we have everything we need
  if (!window.Capacitor?.Plugins?.AutoUpload) {
    console.log('❌ AutoUpload plugin not available yet, retrying in 1 second...');
    setTimeout(waitForSupabaseAndTest, 1000);
    return;
  }
  
  if (!window.supabase?.auth) {
    console.log('❌ Supabase not available yet, retrying in 1 second...');
    setTimeout(waitForSupabaseAndTest, 1000);
    return;
  }
  
  console.log('✅ Both AutoUpload and Supabase are available!');
  runAutoUploadTest();
}

async function runAutoUploadTest() {
  try {
    console.log('🧪 ==================== COMPREHENSIVE AUTO UPLOAD TEST ====================');
    
    // First, check what Supabase session info we have
    console.log('🔍 Checking current Supabase session state...');
    
    try {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      if (session) {
        console.log('✅ Supabase session found!');
        console.log('👤 User ID:', session.user?.id);
        console.log('📧 User email:', session.user?.email);
        console.log('🔐 Access token available:', !!session.access_token);
        console.log('🔐 Access token preview:', session.access_token?.substring(0, 20) + '...');
      } else if (error) {
        console.error('❌ Supabase session error:', error);
      } else {
        console.log('⚠️ No Supabase session found');
      }
    } catch (err) {
      console.error('❌ Error checking Supabase session:', err);
    }
    
    // Now test the AutoUpload plugin
    console.log('🔧 Testing AutoUpload.getUserEvents...');
    
    const startTime = Date.now();
    const result = await window.Capacitor.Plugins.AutoUpload.getUserEvents({});
    const endTime = Date.now();
    
    console.log(`⏱️ getUserEvents completed in ${endTime - startTime}ms`);
    console.log('📊 Full Result:', result);
    
    // Analyze the result
    if (result.success === false) {
      console.error('❌ getUserEvents failed:', result.error || result.message);
      console.log('🔍 Error code:', result.code);
    } else if (result.events) {
      console.log(`✅ SUCCESS! Found ${result.events.length} user events`);
      
      if (result.events.length > 0) {
        console.log('📋 Event Details:');
        result.events.forEach((event, index) => {
          console.log(`  📅 Event ${index + 1}:`);
          console.log(`     Name: ${event.name || 'Unnamed'}`);
          console.log(`     ID: ${event.id || 'No ID'}`);
          console.log(`     Date: ${event.event_date || 'No Date'}`);
          console.log(`     Photo Count: ${event.photo_count || 0}`);
        });
      } else {
        console.log('📋 User has no events yet');
      }
      
      console.log('🎉 AutoUpload getUserEvents test PASSED!');
    } else {
      console.log('⚠️ Unexpected result format:', result);
    }
    
    console.log('🧪 ==================== AUTO UPLOAD TEST COMPLETE ====================');
    
  } catch (error) {
    console.error('❌ AutoUpload test failed with error:', error);
    console.log('🧪 ==================== AUTO UPLOAD TEST FAILED ====================');
  }
}

// Start the test after a short delay to ensure page is fully loaded
setTimeout(waitForSupabaseAndTest, 2000);