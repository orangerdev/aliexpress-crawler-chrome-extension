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
  };
}

// Export for use in other modules
window.AliExpressProduct = {
  getProductId,
  getRawProductName,
  getProductName,
  getProductFolderName,
  getProductInfo,
};
