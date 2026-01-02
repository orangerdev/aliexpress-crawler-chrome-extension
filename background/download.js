// download.js - Local download functions

/**
 * Download a file
 * @param {string} url - URL of the file to download
 * @param {string} filename - Name to save the file as
 * @returns {Promise<Object>}
 */
function downloadFile(url, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Download error:", chrome.runtime.lastError);
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("Download started:", downloadId);
          resolve({ success: true, downloadId: downloadId });
        }
      }
    );
  });
}

/**
 * Download a ZIP file with save dialog
 * @param {string} url - URL of the ZIP file
 * @param {string} filename - Name to save the file as
 * @returns {Promise<Object>}
 */
function downloadZip(url, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("ZIP download error:", chrome.runtime.lastError);
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          console.log("ZIP download started:", downloadId);
          resolve({ success: true, downloadId: downloadId });
        }
      }
    );
  });
}

// Export functions
self.BackgroundDownload = {
  downloadFile,
  downloadZip,
};
