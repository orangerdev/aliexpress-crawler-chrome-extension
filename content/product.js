// product.js - Product information extraction functions

/**
 * Get product ID from URL
 * @returns {string|null}
 */
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

/**
 * Get raw product name (full, unsanitized)
 * @returns {string}
 */
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

/**
 * Get product name for filename (sanitized, truncated for file naming)
 * @returns {string}
 */
function getProductName() {
  const rawName = getRawProductName();
  return window.AliExpressUtils.sanitizeFilename(rawName);
}

/**
 * Get folder name combining product ID and name
 * @returns {string}
 */
function getProductFolderName() {
  const productId = getProductId();
  const rawName = getRawProductName();
  const slug = window.AliExpressUtils.slugify(rawName);

  if (productId) {
    return `${productId}-${slug}`;
  }
  return slug;
}

/**
 * Get all product information
 * @returns {Object}
 */
function getProductInfo() {
  return {
    productId: getProductId(),
    productName: getProductName(),
    rawProductName: getRawProductName(),
    productFolderName: getProductFolderName(),
    productDescription: getProductDescription(),
  };
}

/**
 * Get product description from the product-description class
 * Cleans all HTML elements except text and preserves newlines
 * Removes all images
 * @returns {string}
 */
function getProductDescription() {
  try {
    // Step 1: Find element with class starting with "description--product-description--"
    const descriptionWrapper = document.querySelector(
      '[class*="description--product-description--"]'
    );

    if (!descriptionWrapper) {
      return "";
    }

    // Step 2: Find the element that contains shadow root
    let descriptionEl = null;

    // Look for shadow root in child elements
    const childElements = descriptionWrapper.querySelectorAll("*");

    for (const child of childElements) {
      if (child.shadowRoot) {
        // Find product-description inside shadow root
        descriptionEl = child.shadowRoot.querySelector(".product-description");
        if (descriptionEl) {
          break;
        }
      }
    }

    // Fallback: try direct querySelector if no shadow root found
    if (!descriptionEl) {
      descriptionEl = descriptionWrapper.querySelector(".product-description");
    }

    if (!descriptionEl) {
      return "";
    }

    // Clone the element to avoid modifying the original
    const clone = descriptionEl.cloneNode(true);

    // Remove all images
    const images = clone.querySelectorAll("img");
    images.forEach((img) => img.remove());

    // Remove all video containers
    const videos = clone.querySelectorAll(
      'video, .video-container, [class*="video"]'
    );
    videos.forEach((video) => video.remove());

    // Function to extract text with newlines preserved
    function extractTextWithNewlines(element) {
      let result = "";

      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          // Text node - add the text content
          const text = node.textContent.trim();
          if (text) {
            result += text + " ";
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();

          // Skip empty elements and images
          if (
            tagName === "img" ||
            tagName === "video" ||
            tagName === "script" ||
            tagName === "style"
          ) {
            continue;
          }

          // Block elements that should create newlines
          const blockElements = [
            "p",
            "div",
            "br",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "li",
            "tr",
          ];

          if (tagName === "br") {
            result += "\n";
          } else if (blockElements.includes(tagName)) {
            const innerText = extractTextWithNewlines(node);
            if (innerText.trim()) {
              result += innerText.trim() + "\n";
            }
          } else {
            // Inline elements - just extract text
            result += extractTextWithNewlines(node);
          }
        }
      }

      return result;
    }

    let text = extractTextWithNewlines(clone);

    // Clean up the text
    // Remove multiple consecutive newlines (keep max 2)
    text = text.replace(/\n{3,}/g, "\n\n");
    // Remove multiple consecutive spaces
    text = text.replace(/ {2,}/g, " ");
    // Trim each line
    text = text
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    // Remove empty lines at start and end
    text = text.trim();

    return text;
  } catch (error) {
    return "";
  }
}

// Export for use in other modules
window.AliExpressProduct = {
  getProductId,
  getRawProductName,
  getProductName,
  getProductFolderName,
  getProductInfo,
  getProductDescription,
};
