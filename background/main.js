// main.js - Background service worker entry point & message handlers

// Import all modules (service workers use importScripts)
try {
  importScripts("auth.js", "download.js", "drive.js", "spreadsheet.js");
  console.log("All background modules loaded successfully");
} catch (e) {
  console.error("Failed to load background modules:", e);
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel for all URLs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { downloadFile, downloadZip } = self.BackgroundDownload;
  const { checkDriveAuth, connectToDrive, disconnectDrive } =
    self.BackgroundAuth;
  const { uploadFileToDrive } = self.BackgroundDrive;
  const { updateSpreadsheet, updateReviewSpreadsheet } =
    self.BackgroundSpreadsheet;

  // Local download handlers
  if (request.action === "download") {
    downloadFile(request.url, request.filename).then(sendResponse);
    return true;
  }

  if (request.action === "downloadZip") {
    downloadZip(request.url, request.filename).then(sendResponse);
    return true;
  }

  // Google Drive auth handlers
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

  // Google Drive upload handler
  if (request.action === "uploadFileToDrive") {
    uploadFileToDrive(
      request.filename,
      request.mimeType,
      request.base64Data,
      request.folderPath
    ).then(sendResponse);
    return true;
  }

  // Google Sheets handlers
  if (request.action === "updateSpreadsheet") {
    updateSpreadsheet(
      request.sheetName,
      request.productId,
      request.productName,
      request.videoLinks,
      request.imageLinks,
      request.productDescription
    ).then(sendResponse);
    return true;
  }

  if (request.action === "updateReviewSpreadsheet") {
    updateReviewSpreadsheet(
      request.sheetName,
      request.productId,
      request.productName,
      request.reviews
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

console.log("AliExpress Media Downloader background service initialized");
