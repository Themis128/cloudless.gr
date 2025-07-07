// Debug Authentication Flow
// Paste this in browser console at http://192.168.0.23:3000/

console.log('🔍 Debugging Authentication State...');

// Check Supabase client
if (window.$nuxt) {
  console.log('✅ Nuxt app detected');
  
  // Check current route
  console.log('📍 Current route:', window.$nuxt.$route?.path);
  
  // Check Supabase session
  if (window.$nuxt.$supabase) {
    window.$nuxt.$supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔑 Supabase session:', { session, error });
      if (session) {
        console.log('✅ User authenticated:', session.user.email);
      } else {
        console.log('❌ No active session');
      }
    });
  } else {
    console.log('❌ Supabase client not found');
  }
} else {
  console.log('❌ Nuxt app not detected');
}

// Check localStorage
console.log('💾 LocalStorage keys:', Object.keys(localStorage));
console.log('💾 SessionStorage keys:', Object.keys(sessionStorage));

// Check cookies
console.log('🍪 Cookies:', document.cookie);

// Function to test redirection
window.testRedirect = () => {
  console.log('🧪 Testing manual redirect to /users');
  window.location.href = '/users';
};

console.log('💡 Run testRedirect() to test manual navigation');
