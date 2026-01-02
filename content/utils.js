// utils.js - Utility functions for the AliExpress extension

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Fetch a URL and return as blob
 * @param {string} url - URL to fetch
 * @returns {Promise<Blob|null>}
 */
async function fetchAsBlob(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Convert blob to base64 string
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<string>}
 */
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

/**
 * Get file extension from URL
 * @param {string} url - URL to parse
 * @param {string} defaultExt - Default extension if none found
 * @returns {string}
 */
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

/**
 * Get MIME type from filename
 * @param {string} filename - Filename to check
 * @returns {string}
 */
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

/**
 * Create slug for folder name (lowercase, hyphens, URL-safe)
 * @param {string} name - Name to slugify
 * @returns {string}
 */
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

/**
 * Sanitize filename (for file naming, shorter)
 * @param {string} name - Name to sanitize
 * @returns {string}
 */
function sanitizeFilename(name) {
  return (
    name
      .replace(/[^a-z0-9\s\-\_]/gi, "")
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .substring(0, 80) || "aliexpress_product"
  );
}

/**
 * Escape CSV field for proper CSV formatting
 * @param {*} field - Field value to escape
 * @returns {string}
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  // If the field contains comma, newline, or quote, wrap in quotes and escape existing quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Clean review image URL to get full-size version
 * @param {string} url - URL to clean
 * @returns {string}
 */
function cleanReviewImageUrl(url) {
  if (!url) return url;

  // Remove size suffix like _220x220.png_.avif or _220x220.jpg_.avif
  // Keep the original format without size restrictions
  let cleanUrl = url.replace(/_\d+x\d+\.([a-z]+)_\.(avif|webp)/i, ".$1");

  // Also try to get higher resolution version
  cleanUrl = cleanUrl.replace(/_\d+x\d+q?\d*/, "");

  // Fix duplicate extensions like .png.png or .jpg.jpg
  cleanUrl = cleanUrl.replace(/\.([a-z]{3,4})\.\1$/i, ".$1");
  
  // Also fix cases like .png.jpg or other mixed double extensions
  cleanUrl = cleanUrl.replace(/\.(png|jpg|jpeg|gif|webp|avif)\.(png|jpg|jpeg|gif|webp|avif)$/i, ".$1");

  // Ensure HTTPS
  if (cleanUrl.startsWith("//")) {
    cleanUrl = "https:" + cleanUrl;
  } else if (cleanUrl.startsWith("http://")) {
    cleanUrl = cleanUrl.replace("http://", "https://");
  }

  return cleanUrl;
}

// Export for use in other modules
window.AliExpressUtils = {
  waitForElement,
  fetchAsBlob,
  blobToBase64,
  getExtensionFromUrl,
  getMimeType,
  slugify,
  sanitizeFilename,
  escapeCsvField,
  cleanReviewImageUrl,
};
