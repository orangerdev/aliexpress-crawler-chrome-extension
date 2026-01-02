// content.js - Extracts media from AliExpress product pages and handles downloads

(function () {
  "use strict";

  // Storage for extracted media
  let mediaData = {
    images: [],
    videos: [],
  };

  // Extract media from the page
  function extractMedia() {
    const images = new Set();
    const videos = new Set();

    // Extract product images ONLY from the main product slider
    // AliExpress uses class pattern: slider--slider--[randomId]
    const sliderContainer = document.querySelector(
      '[class*="slider--slider--"]'
    );
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
      sliderContainer
        .querySelectorAll("video source, video")
        .forEach((video) => {
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

  // Download a file as blob
  async function fetchAsBlob(url) {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.blob();
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  // Get file extension from URL
  function getExtensionFromUrl(url, defaultExt) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Handle .avif and other extensions
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      if (match) {
        return match[1].toLowerCase();
      }
    } catch (e) {
      console.warn("Failed to parse URL:", url);
    }
    return defaultExt;
  }

  // Download media files as ZIP
  async function downloadMedia(type) {
    const zip = new JSZip();
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

  // Get product ID from URL
  function getProductId() {
    try {
      const pathname = window.location.pathname;
      // Match /item/1234567890.html or /item/1234567890
      const match = pathname.match(/\/item\/(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error("Error extracting product ID:", error);
      return null;
    }
  }

  // Get raw product name (full, unsanitized)
  function getRawProductName() {
    // Priority: Use the specific AliExpress product title element
    const productTitle = document.querySelector('[data-pl="product-title"]');
    if (productTitle && productTitle.textContent.trim()) {
      return productTitle.textContent.trim();
    }

    // Fallback: Try other selectors
    const titleSelectors = [
      'h1[data-pl="product-title"]',
      '[class*="title--wrap--"] h1',
      "h1",
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback to page title
    return document.title.split("-")[0].trim();
  }

  // Get product name for filename (sanitized, truncated for file naming)
  function getProductName() {
    const rawName = getRawProductName();
    return sanitizeFilename(rawName);
  }

  // Create slug for folder name (lowercase, hyphens, URL-safe)
  function slugify(name) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s\-]/gi, "")
        .replace(/\s+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 100) || "product"
    );
  }

  // Sanitize filename (for file naming, shorter)
  function sanitizeFilename(name) {
    return (
      name
        .replace(/[^a-z0-9\s\-\_]/gi, "")
        .replace(/\s+/g, "_")
        .replace(/_{2,}/g, "_")
        .substring(0, 80) || "aliexpress_product"
    );
  }

  // Get folder name combining product ID and name
  function getProductFolderName() {
    const productId = getProductId();
    const rawName = getRawProductName();
    const slug = slugify(rawName);

    if (productId) {
      return `${productId}-${slug}`;
    }
    return slug;
  }

  // Listen for messages from popup/sidebar
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMediaData") {
      extractMedia();
      sendResponse({
        success: true,
        images: mediaData.images,
        videos: mediaData.videos,
        productName: getProductName(),
        productId: getProductId(),
        rawProductName: getRawProductName(),
        productFolderName: getProductFolderName(),
      });
      return true;
    }

    if (request.action === "downloadMedia") {
      downloadMedia(request.type)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true;
    }

    if (request.action === "uploadToDrive") {
      uploadToDrive(request.type, request.folderPath)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
          });
        });
      return true;
    }
  });

  // Upload media files to Google Drive
  async function uploadToDrive(type, baseFolderPath) {
    let productName = getProductName();
    let errors = [];
    let uploaded = 0;
    let imageLinks = [];
    let videoLinks = [];

    // Auto-generate product folder path
    const productFolderName = getProductFolderName();
    const folderPath = baseFolderPath
      ? `${baseFolderPath.replace(/\/$/, "")}/${productFolderName}`
      : productFolderName;

    // Collect files to upload
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

    const totalFiles = filesToProcess.length;

    if (totalFiles === 0) {
      return {
        success: false,
        uploaded: 0,
        errors: ["No media found to upload"],
        imageLinks: [],
        videoLinks: [],
      };
    }

    console.log(`Starting upload of ${totalFiles} files to Google Drive...`);

    // Upload each file
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      try {
        console.log(`Uploading: ${file.filename}`);

        // Update progress
        const percent = Math.round(((i + 0.5) / totalFiles) * 100);
        chrome.runtime.sendMessage({
          action: "uploadProgress",
          percent: percent,
          message: `Mengupload ${file.filename}...`,
        });

        // Fetch file as blob
        const blob = await fetchAsBlob(file.url);
        if (!blob) {
          errors.push(file.filename);
          continue;
        }

        // Convert blob to base64
        const base64 = await blobToBase64(blob);

        // Send to background for upload
        const result = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "uploadFileToDrive",
              filename: file.filename,
              mimeType: blob.type || getMimeType(file.filename),
              base64Data: base64,
              folderPath: folderPath,
            },
            (response) => {
              if (response && response.success) {
                resolve(response);
              } else {
                reject(new Error(response?.error || "Upload failed"));
              }
            }
          );
        });

        if (result.success) {
          uploaded++;
          // Store the webViewLink based on file type
          if (result.webViewLink) {
            if (file.type === "image") {
              imageLinks.push(result.webViewLink);
            } else if (file.type === "video") {
              videoLinks.push(result.webViewLink);
            }
          }
        }

        // Update progress
        const completePercent = Math.round(((i + 1) / totalFiles) * 100);
        chrome.runtime.sendMessage({
          action: "uploadProgress",
          percent: completePercent,
          message: `Berhasil upload ${uploaded}/${totalFiles} file`,
        });
      } catch (error) {
        console.error(`Failed to upload ${file.filename}:`, error);
        errors.push(file.filename);
      }
    }

    return {
      success: true,
      uploaded: uploaded,
      total: totalFiles,
      errors: errors,
      imageLinks: imageLinks,
      videoLinks: videoLinks,
    };
  }

  // Convert blob to base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Get MIME type from filename
  function getMimeType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      avif: "image/avif",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  // Extract media on page load
  if (document.readyState === "complete") {
    setTimeout(extractMedia, 1000);
  } else {
    window.addEventListener("load", () => {
      setTimeout(extractMedia, 1000);
    });
  }
})();
