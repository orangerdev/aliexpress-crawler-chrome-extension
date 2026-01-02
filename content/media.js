// media.js - Media extraction and download functions

// Storage for extracted media
let mediaData = {
  images: [],
  videos: [],
};

/**
 * Extract media from the page
 * @returns {Object} - Object containing images and videos arrays
 */
function extractMedia() {
  const images = new Set();
  const videos = new Set();

  // Extract product images ONLY from the main product slider
  // AliExpress uses class pattern: slider--slider--[randomId]
  const sliderContainer = document.querySelector('[class*="slider--slider--"]');
  if (sliderContainer) {
    sliderContainer.querySelectorAll("img").forEach((img) => {
      let src = img.src || img.dataset.src || img.getAttribute("data-src");

      if (
        src &&
        src.startsWith("http") &&
        !src.includes("pixel") &&
        !src.includes("transparent")
      ) {
        // Clean URL: remove size parameters like _220x220q75 from the URL
        // Example: .jpg_220x220q75.jpg_.avif -> .jpg_.avif
        const cleanUrl = src.replace(
          /_([\d]+x[\d]+q?[\d]*)(\.[^_.]+)?(_\.[^.]+)$/i,
          "$3"
        );
        images.add(cleanUrl);
      }
    });
  }

  // Extract videos from the slider container
  if (sliderContainer) {
    sliderContainer.querySelectorAll("video source, video").forEach((video) => {
      let src = video.src || video.currentSrc;
      if (src && src.startsWith("http")) {
        videos.add(src);
      }
    });
  }

  // Extract videos from video elements with AliExpress video class pattern
  // Class pattern: video--video--[randomId]
  document.querySelectorAll('[class*="video--video--"]').forEach((video) => {
    // Get src from video element directly
    if (video.src && video.src.startsWith("http")) {
      videos.add(video.src);
    }
    if (video.currentSrc && video.currentSrc.startsWith("http")) {
      videos.add(video.currentSrc);
    }
    // Get src from source elements inside video
    video.querySelectorAll("source").forEach((source) => {
      if (source.src && source.src.startsWith("http")) {
        videos.add(source.src);
      }
    });
  });

  // Also search for any video elements in the page that might contain product videos
  // This catches videos that may be rendered differently
  document.querySelectorAll("video").forEach((video) => {
    // Check if it's a product-related video (not ads or other videos)
    const isProductVideo =
      video.closest('[class*="slider--"]') ||
      video.closest('[class*="video--"]') ||
      video.closest('[class*="product--"]') ||
      video.closest('[class*="gallery--"]') ||
      video.closest('[class*="media--"]');

    if (isProductVideo) {
      // Get src from video element directly
      if (video.src && video.src.startsWith("http")) {
        videos.add(video.src);
      }
      if (video.currentSrc && video.currentSrc.startsWith("http")) {
        videos.add(video.currentSrc);
      }
      // Get src from source elements inside video
      video.querySelectorAll("source").forEach((source) => {
        if (source.src && source.src.startsWith("http")) {
          videos.add(source.src);
        }
      });
    }
  });

  mediaData.images = Array.from(images);
  mediaData.videos = Array.from(videos);

  console.log("Extracted media:", mediaData);
  return mediaData;
}

/**
 * Get current media data
 * @returns {Object}
 */
function getMediaData() {
  return mediaData;
}

/**
 * Download media files as ZIP
 * @param {string} type - Type of media to download: 'images', 'videos', or 'all'
 * @returns {Promise<Object>}
 */
async function downloadMedia(type) {
  const zip = new JSZip();
  const { getProductName } = window.AliExpressProduct;
  const { fetchAsBlob, getExtensionFromUrl } = window.AliExpressUtils;

  let productName = getProductName();
  let errors = [];
  let totalFiles = 0;

  // Collect files to download
  const filesToProcess = [];

  if (type === "images" || type === "all") {
    mediaData.images.forEach((url, index) => {
      const ext = getExtensionFromUrl(url, "jpg");
      const filename = `${productName}_image_${index + 1}.${ext}`;
      filesToProcess.push({ url, filename, type: "image" });
    });
  }

  if (type === "videos" || type === "all") {
    mediaData.videos.forEach((url, index) => {
      const ext = getExtensionFromUrl(url, "mp4");
      const filename = `${productName}_video_${index + 1}.${ext}`;
      filesToProcess.push({ url, filename, type: "video" });
    });
  }

  totalFiles = filesToProcess.length;

  if (totalFiles === 0) {
    return {
      success: false,
      downloaded: 0,
      errors: ["No media found to download"],
    };
  }

  console.log(`Starting download of ${totalFiles} files...`);

  // Fetch all files and add to zip
  for (const file of filesToProcess) {
    try {
      console.log(`Fetching: ${file.filename}`);
      const blob = await fetchAsBlob(file.url);
      if (blob) {
        zip.file(file.filename, blob);
      } else {
        errors.push(file.filename);
      }
    } catch (error) {
      console.error(`Failed to process ${file.filename}:`, error);
      errors.push(file.filename);
    }
  }

  // Generate and download ZIP
  try {
    console.log("Generating ZIP file...");
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Create download link
    const zipFilename = `${productName}_media.zip`;
    const downloadUrl = URL.createObjectURL(zipBlob);

    // Send to background script for download
    chrome.runtime.sendMessage(
      { action: "downloadZip", url: downloadUrl, filename: zipFilename },
      (response) => {
        // Revoke the object URL after a delay to allow download to start
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }
    );

    console.log(`ZIP created: ${zipFilename}`);

    return {
      success: true,
      downloaded: totalFiles - errors.length,
      errors: errors,
    };
  } catch (error) {
    console.error("Failed to generate ZIP:", error);
    return {
      success: false,
      downloaded: 0,
      errors: ["Failed to generate ZIP file"],
    };
  }
}

// Export for use in other modules
window.AliExpressMedia = {
  extractMedia,
  getMediaData,
  downloadMedia,
};
