// auth.js - Google OAuth authentication functions

// Store for auth token
let authToken = null;
let userEmail = null;

// Google OAuth settings
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/spreadsheets",
];
const REDIRECT_URL = chrome.identity.getRedirectURL();

/**
 * Get current auth token
 * @returns {string|null}
 */
function getAuthToken() {
  return authToken;
}

/**
 * Set auth token
 * @param {string|null} token
 */
function setAuthToken(token) {
  authToken = token;
}

/**
 * Get current user email
 * @returns {string|null}
 */
function getUserEmail() {
  return userEmail;
}

/**
 * Set user email
 * @param {string|null} email
 */
function setUserEmail(email) {
  userEmail = email;
}

/**
 * Verify token is still valid
 * @param {string} token
 * @returns {Promise<boolean>}
 */
async function verifyToken(token) {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + token
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Client ID from storage
 * @returns {Promise<string|null>}
 */
async function getClientId() {
  const stored = await chrome.storage.local.get(["googleClientId"]);
  return stored.googleClientId;
}

/**
 * Check if user is authenticated with Google Drive
 * @returns {Promise<Object>}
 */
async function checkDriveAuth() {
  try {
    // Try to get cached token
    const cached = await chrome.storage.local.get(["driveToken", "driveEmail"]);
    if (cached.driveToken) {
      // Verify token is still valid
      const valid = await verifyToken(cached.driveToken);
      if (valid) {
        authToken = cached.driveToken;
        userEmail = cached.driveEmail;
        return { connected: true, email: userEmail };
      } else {
        // Token expired, clear it
        await chrome.storage.local.remove(["driveToken", "driveEmail"]);
      }
    }
    return { connected: false };
  } catch (error) {
    console.error("Check auth error:", error);
    return { connected: false };
  }
}

/**
 * Connect to Google Drive via OAuth using launchWebAuthFlow
 * @returns {Promise<Object>}
 */
async function connectToDrive() {
  try {
    // Get Client ID from storage
    const clientId = await getClientId();
    if (!clientId) {
      throw new Error(
        "Client ID belum dikonfigurasi. Silakan masukkan Client ID di Pengaturan."
      );
    }

    // Build OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URL);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("prompt", "consent");

    console.log("Redirect URL:", REDIRECT_URL);
    console.log("Auth URL:", authUrl.toString());

    // Launch OAuth flow
    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true,
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!responseUrl) {
            reject(new Error("Autentikasi dibatalkan"));
          } else {
            resolve(responseUrl);
          }
        }
      );
    });

    // Extract access token from response URL
    const hashParams = new URLSearchParams(responseUrl.split("#")[1]);
    const token = hashParams.get("access_token");

    if (!token) {
      throw new Error("Gagal mendapatkan access token");
    }

    authToken = token;

    // Get user email
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      userEmail = userInfo.email;
    }

    // Cache token
    await chrome.storage.local.set({
      driveToken: token,
      driveEmail: userEmail,
    });

    return { success: true, email: userEmail };
  } catch (error) {
    console.error("Connect to Drive error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Disconnect from Google Drive
 * @returns {Promise<Object>}
 */
async function disconnectDrive() {
  try {
    if (authToken) {
      // Revoke token
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${authToken}`, {
          method: "POST",
        });
      } catch (e) {
        console.log("Token revoke failed (may already be expired)");
      }
    }
    authToken = null;
    userEmail = null;
    await chrome.storage.local.remove(["driveToken", "driveEmail"]);
    return { success: true };
  } catch (error) {
    console.error("Disconnect error:", error);
    return { success: false, error: error.message };
  }
}

// Export functions
self.BackgroundAuth = {
  getAuthToken,
  setAuthToken,
  getUserEmail,
  setUserEmail,
  verifyToken,
  getClientId,
  checkDriveAuth,
  connectToDrive,
  disconnectDrive,
};
