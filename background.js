// background.js - Handles download requests, Google Drive OAuth and uploads

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

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel for all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Local download handlers
  if (request.action === "download") {
    chrome.downloads.download(
      {
        url: request.url,
        filename: request.filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Download error:", chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("Download started:", downloadId);
          sendResponse({ success: true, downloadId: downloadId });
        }
      }
    );
    return true;
  }

  if (request.action === "downloadZip") {
    chrome.downloads.download(
      {
        url: request.url,
        filename: request.filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("ZIP download error:", chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("ZIP download started:", downloadId);
          sendResponse({ success: true, downloadId: downloadId });
        }
      }
    );
    return true;
  }

  // Google Drive handlers
  if (request.action === "checkDriveAuth") {
    checkDriveAuth().then(sendResponse);
    return true;
  }

  if (request.action === "connectDrive") {
    connectToDrive().then(sendResponse);
    return true;
  }

  if (request.action === "disconnectDrive") {
    disconnectDrive().then(sendResponse);
    return true;
  }

  if (request.action === "uploadFileToDrive") {
    uploadFileToDrive(
      request.filename,
      request.mimeType,
      request.base64Data,
      request.folderPath
    ).then(sendResponse);
    return true;
  }

  if (request.action === "updateSpreadsheet") {
    updateSpreadsheet(
      request.productId,
      request.productName,
      request.videoLinks,
      request.imageLinks
    ).then(sendResponse);
    return true;
  }

  // Progress update forwarding to sidebar
  if (request.action === "uploadProgress") {
    // Forward to all extension pages (sidebar)
    chrome.runtime.sendMessage(request);
    return false;
  }
});

// Check if user is authenticated with Google Drive
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

// Verify token is still valid
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

// Get Client ID from storage
async function getClientId() {
  const stored = await chrome.storage.local.get(["googleClientId"]);
  return stored.googleClientId;
}

// Connect to Google Drive via OAuth using launchWebAuthFlow
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

// Disconnect from Google Drive
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

// Create folder in Google Drive (returns folder ID)
async function getOrCreateFolder(folderPath) {
  if (!folderPath) return "root";

  const folders = folderPath.split("/").filter((f) => f.trim());
  let parentId = "root";

  for (const folderName of folders) {
    // Search for existing folder
    const searchQuery = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      searchQuery
    )}&fields=files(id,name)`;

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!searchResponse.ok) {
      throw new Error("Failed to search for folder");
    }

    const searchResult = await searchResponse.json();

    if (searchResult.files && searchResult.files.length > 0) {
      // Folder exists
      parentId = searchResult.files[0].id;
    } else {
      // Create folder
      const createResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create folder");
      }

      const newFolder = await createResponse.json();
      parentId = newFolder.id;
    }
  }

  return parentId;
}

// Upload file to Google Drive
async function uploadFileToDrive(filename, mimeType, base64Data, folderPath) {
  try {
    if (!authToken) {
      const authCheck = await checkDriveAuth();
      if (!authCheck.connected) {
        throw new Error("Not authenticated with Google Drive");
      }
    }

    // Get or create target folder
    const folderId = await getOrCreateFolder(folderPath);

    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    // Create multipart upload
    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [folderId],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", blob);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: form,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(error.error?.message || "Upload failed");
    }

    const result = await uploadResponse.json();
    console.log("File uploaded:", result.name, result.id);

    return {
      success: true,
      fileId: result.id,
      fileName: result.name,
      webViewLink: result.webViewLink,
    };
  } catch (error) {
    console.error("Upload to Drive error:", error);
    return { success: false, error: error.message };
  }
}

// Get Spreadsheet ID from storage
async function getSpreadsheetId() {
  const stored = await chrome.storage.local.get(["googleSpreadsheetId"]);
  return stored.googleSpreadsheetId;
}

// Update Google Spreadsheet with product data
async function updateSpreadsheet(
  productId,
  productName,
  videoLinks,
  imageLinks
) {
  try {
    if (!authToken) {
      const authCheck = await checkDriveAuth();
      if (!authCheck.connected) {
        throw new Error("Not authenticated with Google");
      }
    }

    const spreadsheetId = await getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error("Spreadsheet ID belum dikonfigurasi");
    }

    // Format video links (single link or empty)
    const videoLink = videoLinks.length > 0 ? videoLinks[0] : "";

    // Format image links (multiple links separated by newline)
    const imageLinksText = imageLinks.join("\n");

    // Data row: [Product ID, Product Name, Affiliate Link (empty), Video Link, Image Links]
    const rowData = [
      productId || "",
      productName || "",
      "", // Affiliate link - kosongkan
      videoLink,
      imageLinksText,
    ];

    // Append row to spreadsheet
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

    const appendResponse = await fetch(appendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    });

    if (!appendResponse.ok) {
      const error = await appendResponse.json();
      throw new Error(error.error?.message || "Failed to update spreadsheet");
    }

    const result = await appendResponse.json();
    console.log("Spreadsheet updated:", result);

    return { success: true };
  } catch (error) {
    console.error("Update spreadsheet error:", error);
    return { success: false, error: error.message };
  }
}
