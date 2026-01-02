// popup.js - Handles the popup UI and communication with content script

document.addEventListener('DOMContentLoaded', async () => {
  const imageCountEl = document.getElementById('imageCount');
  const videoCountEl = document.getElementById('videoCount');
  const downloadImagesBtn = document.getElementById('downloadImages');
  const downloadVideosBtn = document.getElementById('downloadVideos');
  const downloadAllBtn = document.getElementById('downloadAll');
  const statusEl = document.getElementById('status');

  // Check if we're on an AliExpress product page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('aliexpress.com/item/') && !tab.url.includes('aliexpress.us/item/')) {
    showStatus('Silakan buka halaman produk AliExpress', 'error');
    disableButtons();
    return;
  }

  // Get media data from the page
  try {
    const results = await chrome.tabs.sendMessage(tab.id, { action: 'getMediaData' });
    
    if (results && results.success) {
      imageCountEl.textContent = results.images.length;
      videoCountEl.textContent = results.videos.length;

      if (results.images.length === 0 && results.videos.length === 0) {
        showStatus('Tidak ada media ditemukan di halaman ini', 'error');
        disableButtons();
      }
    } else {
      throw new Error('Failed to get media data');
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('Error: Tidak dapat mengakses halaman. Coba refresh halaman.', 'error');
    disableButtons();
    return;
  }

  // Download images
  downloadImagesBtn.addEventListener('click', async () => {
    await downloadMedia('images');
  });

  // Download videos
  downloadVideosBtn.addEventListener('click', async () => {
    await downloadMedia('videos');
  });

  // Download all
  downloadAllBtn.addEventListener('click', async () => {
    await downloadMedia('all');
  });

  async function downloadMedia(type) {
    showStatus('Mengunduh...', '');
    disableButtons();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const results = await chrome.tabs.sendMessage(tab.id, { 
        action: 'downloadMedia', 
        type: type 
      });

      if (results && results.success) {
        const totalDownloaded = results.downloaded;
        showStatus(`✓ Berhasil mengunduh ${totalDownloaded} file`, 'success');
        setTimeout(() => {
          enableButtons();
        }, 2000);
      } else {
        throw new Error(results.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      showStatus(`Error: ${error.message}`, 'error');
      enableButtons();
    }
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'show ' + type;
  }

  function disableButtons() {
    downloadImagesBtn.disabled = true;
    downloadVideosBtn.disabled = true;
    downloadAllBtn.disabled = true;
  }

  function enableButtons() {
    downloadImagesBtn.disabled = false;
    downloadVideosBtn.disabled = false;
    downloadAllBtn.disabled = false;
  }
});
