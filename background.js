// background.js - Handles download requests from content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    return true; // Keep message channel open for async response
  }

  if (request.action === "downloadZip") {
    chrome.downloads.download(
      {
        url: request.url,
        filename: request.filename,
        saveAs: true, // Let user choose where to save the ZIP
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
});
