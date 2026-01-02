// background.js - Handles download requests from content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('Download started:', downloadId);
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true; // Keep message channel open for async response
  }
});
