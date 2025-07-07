/**
 * Simple auth state management for handling post-login navigation
 */

let recentlyLoggedIn = false;
let loginTimestamp = 0;

export const setRecentLogin = () => {
  recentlyLoggedIn = true;
  loginTimestamp = Date.now();
  
  // Clear the flag after 10 seconds
  setTimeout(() => {
    recentlyLoggedIn = false;
    loginTimestamp = 0;
  }, 10000);
};

export const isRecentlyLoggedIn = () => {
  // Consider as recently logged in if within the last 10 seconds
  return recentlyLoggedIn && (Date.now() - loginTimestamp) < 10000;
};

export const clearRecentLogin = () => {
  recentlyLoggedIn = false;
  loginTimestamp = 0;
};
