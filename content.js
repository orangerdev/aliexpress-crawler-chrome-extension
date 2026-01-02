// content.js - Extracts media from AliExpress product pages and handles downloads

(function() {
  'use strict';

  // Storage for extracted media
  let mediaData = {
    images: [],
    videos: []
  };

  // Extract media from the page
  function extractMedia() {
    const images = new Set();
    const videos = new Set();

    // Extract product images
    // AliExpress uses various selectors for product images
    const imageSelectors = [
      'img[class*="magnifier"]',
      'img[class*="product"]',
      'img[class*="gallery"]',
      '.images-view-item img',
      '.magnifier-image',
      '.product-image img',
      '.image-view img',
      '[class*="ImageView"] img',
      '[class*="imageView"] img'
    ];

    imageSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(img => {
        let src = img.src || img.dataset.src || img.getAttribute('data-src');
        
        // Also check for higher resolution versions
        const dataSrcBig = img.getAttribute('data-src-big');
        const bigSrc = img.getAttribute('bigsrc');
        
        if (dataSrcBig) src = dataSrcBig;
        if (bigSrc) src = bigSrc;

        if (src && src.startsWith('http') && !src.includes('pixel') && !src.includes('transparent')) {
          // Remove size parameters to get original image
          src = src.split('_')[0].replace(/\.(jpg|jpeg|png|webp).*$/, '.$1');
          images.add(src);
        }
      });
    });

    // Extract images from JSON-LD structured data
    try {
      const scriptTags = document.querySelectorAll('script[type="application/ld+json"]');
      scriptTags.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data.image) {
            if (Array.isArray(data.image)) {
              data.image.forEach(img => images.add(img));
            } else if (typeof data.image === 'string') {
              images.add(data.image);
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
    } catch (e) {
      console.log('Error parsing JSON-LD:', e);
    }

    // Extract images from window data
    try {
      // AliExpress stores product data in window.runParams
      if (window.runParams && window.runParams.data) {
        const data = window.runParams.data;
        
        // Extract images from imageModule
        if (data.imageModule && data.imageModule.imagePathList) {
          data.imageModule.imagePathList.forEach(img => {
            if (img && img.startsWith('http')) {
              images.add(img);
            }
          });
        }

        // Extract video URLs
        if (data.videoModule && data.videoModule.videoUid) {
          const videoUrl = `https://cloud.video.taobao.com/play/u/${data.videoModule.videoUid}/p/1/e/6/t/10301/${data.videoModule.videoUid}.mp4`;
          videos.add(videoUrl);
        }
      }
    } catch (e) {
      console.log('Error extracting from window data:', e);
    }

    // Extract videos from video tags
    document.querySelectorAll('video source, video').forEach(video => {
      let src = video.src || video.currentSrc;
      if (src && src.startsWith('http')) {
        videos.add(src);
      }
    });

    // Look for video URLs in data attributes
    document.querySelectorAll('[data-video], [data-video-url], [data-src*="video"]').forEach(el => {
      const videoUrl = el.getAttribute('data-video') || 
                       el.getAttribute('data-video-url') || 
                       el.getAttribute('data-src');
      if (videoUrl && videoUrl.startsWith('http')) {
        videos.add(videoUrl);
      }
    });

    // Extract high-quality images from thumbnails
    document.querySelectorAll('img[class*="thumb"]').forEach(img => {
      let src = img.src;
      if (src && src.startsWith('http')) {
        // Convert thumbnail to full size
        src = src.replace(/_\d+x\d+\./, '.');
        src = src.replace(/\.jpg_.*$/, '.jpg');
        src = src.replace(/\.png_.*$/, '.png');
        src = src.replace(/\.webp_.*$/, '.webp');
        images.add(src);
      }
    });

    mediaData.images = Array.from(images).filter(url => {
      // Filter out small icons and placeholder images
      return !url.includes('pixel') && 
             !url.includes('icon') && 
             !url.includes('logo') &&
             !url.includes('avatar') &&
             !url.includes('1x1');
    });

    mediaData.videos = Array.from(videos);

    console.log('Extracted media:', mediaData);
    return mediaData;
  }

  // Download a file
  async function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'download', url: url, filename: filename },
        (response) => {
          if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Download failed'));
          }
        }
      );
    });
  }

  // Download media files
  async function downloadMedia(type) {
    let filesToDownload = [];
    let productName = getProductName();

    if (type === 'images' || type === 'all') {
      mediaData.images.forEach((url, index) => {
        const ext = url.split('.').pop().split('?')[0].split('_')[0];
        const filename = `${productName}_image_${index + 1}.${ext}`;
        filesToDownload.push({ url, filename });
      });
    }

    if (type === 'videos' || type === 'all') {
      mediaData.videos.forEach((url, index) => {
        const ext = url.split('.').pop().split('?')[0];
        const filename = `${productName}_video_${index + 1}.${ext}`;
        filesToDownload.push({ url, filename });
      });
    }

    let downloaded = 0;
    let errors = [];

    for (const file of filesToDownload) {
      try {
        await downloadFile(file.url, file.filename);
        downloaded++;
        // Add small delay between downloads to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to download ${file.filename}:`, error);
        errors.push(file.filename);
      }
    }

    return {
      success: true,
      downloaded: downloaded,
      errors: errors
    };
  }

  // Get product name for filename
  function getProductName() {
    // Try to get product name from various selectors
    const titleSelectors = [
      'h1',
      '[class*="title"]',
      '[class*="Title"]',
      '[data-pl="product-title"]',
      '.product-title',
      '.title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return sanitizeFilename(element.textContent.trim());
      }
    }

    // Fallback to page title
    return sanitizeFilename(document.title.split('-')[0].trim());
  }

  // Sanitize filename
  function sanitizeFilename(name) {
    return name
      .replace(/[^a-z0-9\s\-\_]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getMediaData') {
      extractMedia();
      sendResponse({
        success: true,
        images: mediaData.images,
        videos: mediaData.videos
      });
      return true;
    }

    if (request.action === 'downloadMedia') {
      downloadMedia(request.type).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });
      return true; // Keep the message channel open for async response
    }
  });

  // Extract media on page load
  if (document.readyState === 'complete') {
    setTimeout(extractMedia, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(extractMedia, 1000);
    });
  }
})();
