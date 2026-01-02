// sidebar.js - Handles the sidebar UI and communication with content script & Google Drive

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const mainContent = document.getElementById("mainContent");
  const notProductPage = document.getElementById("notProductPage");
  const settingsToggle = document.getElementById("settingsToggle");
  const settingsContent = document.getElementById("settingsContent");
  const settingsArrow = document.getElementById("settingsArrow");
  const clientIdInput = document.getElementById("clientIdInput");
  const clientIdStatus = document.getElementById("clientIdStatus");
  const saveClientIdBtn = document.getElementById("saveClientId");
  const driveStatus = document.getElementById("driveStatus");
  const statusDot = document.getElementById("statusDot");
  const driveStatusText = document.getElementById("driveStatusText");
  const driveEmail = document.getElementById("driveEmail");
  const connectDriveBtn = document.getElementById("connectDrive");
  const disconnectDriveBtn = document.getElementById("disconnectDrive");
  const folderSection = document.getElementById("folderSection");
  const folderPathInput = document.getElementById("folderPath");
  const productInfoSection = document.getElementById("productInfoSection");
  const productIdEl = document.getElementById("productId");
  const productNameEl = document.getElementById("productName");
  const productFolderEl = document.getElementById("productFolder");
  const imageCountEl = document.getElementById("imageCount");
  const videoCountEl = document.getElementById("videoCount");
  const uploadAllBtn = document.getElementById("uploadAll");
  const statusEl = document.getElementById("status");
  const progressContainer = document.getElementById("progressContainer");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const spreadsheetIdInput = document.getElementById("spreadsheetIdInput");
  const spreadsheetIdStatus = document.getElementById("spreadsheetIdStatus");
  const saveSpreadsheetIdBtn = document.getElementById("saveSpreadsheetId");
  const productSheetInput = document.getElementById("productSheetInput");
  const reviewSheetInput = document.getElementById("reviewSheetInput");
  const saveSheetNamesBtn = document.getElementById("saveSheetNames");

  // Review elements
  const reviewCountEl = document.getElementById("reviewCount");
  const reviewPhotoCountEl = document.getElementById("reviewPhotoCount");
  const reviewSummary = document.getElementById("reviewSummary");
  const averageRatingEl = document.getElementById("averageRating");
  const totalReviewsEl = document.getElementById("totalReviews");
  const extractReviewsBtn = document.getElementById("extractReviews");
  const uploadReviewsBtn = document.getElementById("uploadReviews");
  const reviewProgressContainer = document.getElementById(
    "reviewProgressContainer"
  );
  const reviewProgressFill = document.getElementById("reviewProgressFill");
  const reviewProgressText = document.getElementById("reviewProgressText");
  const reviewStatusEl = document.getElementById("reviewStatus");
  const minWordsInput = document.getElementById("minWordsInput");
  const maxReviewsInput = document.getElementById("maxReviewsInput");

  let isConnected = false;
  let hasClientId = false;
  let hasSpreadsheetId = false;
  let currentTab = null;
  let currentProductFolderName = null; // Store current product folder name
  let currentProductId = null;
  let currentRawProductName = null;

  // Initialize
  await init();

  async function init() {
    // Load saved client ID
    await loadClientIdStatus();

    // Load saved spreadsheet ID
    await loadSpreadsheetIdStatus();

    // Load saved sheet names
    await loadSheetNames();

    // Check Google Drive connection status
    await checkDriveConnection();

    // Load saved folder path or set default
    const saved = await chrome.storage.local.get(["driveFolderPath"]);
    if (saved.driveFolderPath) {
      folderPathInput.value = saved.driveFolderPath;
    } else {
      // Set default folder path
      folderPathInput.value = "AliExpressMedia";
      await chrome.storage.local.set({ driveFolderPath: "AliExpressMedia" });
    }

    // Check current tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    currentTab = tab;

    if (!isAliExpressProductPage(tab.url)) {
      mainContent.style.display = "none";
      notProductPage.style.display = "block";
      return;
    }

    // Get media data
    await refreshMediaData();

    // Listen for tab changes
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      currentTab = tab;
      if (isAliExpressProductPage(tab.url)) {
        mainContent.style.display = "block";
        notProductPage.style.display = "none";
        await refreshMediaData();
      } else {
        mainContent.style.display = "none";
        notProductPage.style.display = "block";
      }
    });

    // Listen for tab URL changes
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (
        changeInfo.status === "complete" &&
        currentTab &&
        tabId === currentTab.id
      ) {
        currentTab = tab;
        if (isAliExpressProductPage(tab.url)) {
          mainContent.style.display = "block";
          notProductPage.style.display = "none";
          await refreshMediaData();
        } else {
          mainContent.style.display = "none";
          notProductPage.style.display = "block";
        }
      }
    });
  }

  // Settings toggle
  settingsToggle.addEventListener("click", () => {
    const isOpen = settingsContent.classList.contains("show");
    if (isOpen) {
      settingsContent.classList.remove("show");
      settingsArrow.textContent = "▼";
    } else {
      settingsContent.classList.add("show");
      settingsArrow.textContent = "▲";
    }
  });

  // Load and display client ID status
  async function loadClientIdStatus() {
    const saved = await chrome.storage.local.get(["googleClientId"]);
    if (saved.googleClientId) {
      clientIdInput.value = saved.googleClientId;
      setClientIdConfigured(true);
    } else {
      setClientIdConfigured(false);
    }
  }

  function setClientIdConfigured(configured) {
    hasClientId = configured;
    if (configured) {
      clientIdStatus.className = "client-id-status configured";
      clientIdStatus.innerHTML = "<span>✓</span> Client ID sudah dikonfigurasi";
      connectDriveBtn.disabled = false;
    } else {
      clientIdStatus.className = "client-id-status not-configured";
      clientIdStatus.innerHTML =
        "<span>⚠️</span> Client ID belum dikonfigurasi";
      connectDriveBtn.disabled = true;
    }
  }

  // Save Client ID
  saveClientIdBtn.addEventListener("click", async () => {
    const clientId = clientIdInput.value.trim();
    if (!clientId) {
      showStatus("Masukkan Client ID terlebih dahulu", "error");
      return;
    }

    // Basic validation - Client ID should end with .apps.googleusercontent.com
    if (!clientId.includes(".apps.googleusercontent.com")) {
      showStatus("Format Client ID tidak valid", "error");
      return;
    }

    await chrome.storage.local.set({ googleClientId: clientId });
    setClientIdConfigured(true);
    showStatus("Client ID berhasil disimpan!", "success");

    // Close settings panel
    settingsContent.classList.remove("show");
    settingsArrow.textContent = "▼";
  });

  // Load and display spreadsheet ID status
  async function loadSpreadsheetIdStatus() {
    const saved = await chrome.storage.local.get(["googleSpreadsheetId"]);
    if (saved.googleSpreadsheetId) {
      spreadsheetIdInput.value = saved.googleSpreadsheetId;
      setSpreadsheetIdConfigured(true);
    } else {
      setSpreadsheetIdConfigured(false);
    }
  }

  function setSpreadsheetIdConfigured(configured) {
    hasSpreadsheetId = configured;
    if (configured) {
      spreadsheetIdStatus.className = "client-id-status configured";
      spreadsheetIdStatus.innerHTML =
        "<span>✓</span> Spreadsheet ID sudah dikonfigurasi";
    } else {
      spreadsheetIdStatus.className = "client-id-status not-configured";
      spreadsheetIdStatus.innerHTML =
        "<span>⚠️</span> Spreadsheet ID belum dikonfigurasi";
    }
  }

  // Save Spreadsheet ID
  saveSpreadsheetIdBtn.addEventListener("click", async () => {
    const spreadsheetId = spreadsheetIdInput.value.trim();
    if (!spreadsheetId) {
      showStatus("Masukkan Spreadsheet ID terlebih dahulu", "error");
      return;
    }

    await chrome.storage.local.set({ googleSpreadsheetId: spreadsheetId });
    setSpreadsheetIdConfigured(true);
    showStatus("Spreadsheet ID berhasil disimpan!", "success");
  });

  // Load sheet names
  async function loadSheetNames() {
    const saved = await chrome.storage.local.get([
      "productSheetName",
      "reviewSheetName",
    ]);
    if (saved.productSheetName) {
      productSheetInput.value = saved.productSheetName;
    } else {
      productSheetInput.value = "PRODUCT";
    }
    if (saved.reviewSheetName) {
      reviewSheetInput.value = saved.reviewSheetName;
    } else {
      reviewSheetInput.value = "REVIEW";
    }
  }

  // Save Sheet Names
  saveSheetNamesBtn.addEventListener("click", async () => {
    const productSheet = productSheetInput.value.trim() || "PRODUCT";
    const reviewSheet = reviewSheetInput.value.trim() || "REVIEW";

    await chrome.storage.local.set({
      productSheetName: productSheet,
      reviewSheetName: reviewSheet,
    });
    showStatus("Nama sheet berhasil disimpan!", "success");
  });

  function isAliExpressProductPage(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const isAliExpress =
        hostname === "aliexpress.com" ||
        hostname === "www.aliexpress.com" ||
        hostname.endsWith(".aliexpress.com") ||
        hostname === "aliexpress.us" ||
        hostname === "www.aliexpress.us" ||
        hostname.endsWith(".aliexpress.us");
      const isProductPage = urlObj.pathname.includes("/item/");
      return isAliExpress && isProductPage;
    } catch {
      return false;
    }
  }

  async function checkDriveConnection() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkDriveAuth",
      });
      if (response && response.connected) {
        setConnected(true, response.email);
      } else {
        setConnected(false);
      }
    } catch (error) {
      console.error("Error checking drive connection:", error);
      setConnected(false);
    }
  }

  function setConnected(connected, email = "") {
    isConnected = connected;
    if (connected) {
      driveStatus.className = "drive-status connected";
      statusDot.className = "status-dot connected";
      driveStatusText.textContent = "Terhubung";
      driveEmail.textContent = email;
      connectDriveBtn.style.display = "none";
      disconnectDriveBtn.style.display = "block";
      folderSection.style.display = "block";
      updateUploadButtons();
      // Update review upload button if reviews are extracted
      const reviewCount = parseInt(reviewCountEl.textContent) || 0;
      uploadReviewsBtn.disabled = reviewCount === 0;
    } else {
      driveStatus.className = "drive-status disconnected";
      statusDot.className = "status-dot";
      driveStatusText.textContent = "Tidak terhubung";
      driveEmail.textContent = "";
      connectDriveBtn.style.display = "block";
      connectDriveBtn.disabled = !hasClientId;
      disconnectDriveBtn.style.display = "none";
      folderSection.style.display = "none";
      disableUploadButtons();
      uploadReviewsBtn.disabled = true;
    }
  }

  async function refreshMediaData() {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        // Check if content script is ready by sending a ping first
        const results = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: "getMediaData" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 3000)
          ),
        ]);

        if (results && results.success) {
          imageCountEl.textContent = results.images.length;
          videoCountEl.textContent = results.videos.length;

          // Display product info
          if (results.productId || results.rawProductName) {
            productInfoSection.style.display = "block";

            // Product ID
            if (results.productId) {
              productIdEl.textContent = results.productId;
            } else {
              productIdEl.textContent = "Tidak ditemukan";
            }

            // Product Name (full)
            if (results.rawProductName) {
              productNameEl.textContent = results.rawProductName;
            }

            // Folder path preview - store and display
            if (results.productFolderName) {
              currentProductFolderName = results.productFolderName;
              currentProductId = results.productId;
              currentRawProductName = results.rawProductName;
              const basePath =
                folderPathInput.value.trim() || "AliExpressMedia";
              productFolderEl.textContent = `${basePath}/${results.productFolderName}`;
            }
          }

          updateUploadButtons();

          if (results.images.length === 0 && results.videos.length === 0) {
            showStatus("Tidak ada media ditemukan di halaman ini", "error");
          } else {
            // Clear any previous error status
            statusEl.className = "";
          }
          return; // Success, exit the retry loop
        }
      } catch (error) {
        console.log(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries) {
          // Wait before retrying
          showStatus(
            `Menghubungkan ke halaman... (${attempt}/${maxRetries})`,
            "loading"
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          // All retries failed
          console.error("Error getting media data after all retries:", error);
          showStatus(
            "Error: Tidak dapat mengakses halaman. Coba refresh halaman.",
            "error"
          );
        }
      }
    }
  }

  function updateUploadButtons() {
    const imageCount = parseInt(imageCountEl.textContent) || 0;
    const videoCount = parseInt(videoCountEl.textContent) || 0;

    uploadAllBtn.disabled =
      !isConnected || (imageCount === 0 && videoCount === 0);
  }

  function disableUploadButtons() {
    uploadAllBtn.disabled = true;
  }

  function enableUploadButtons() {
    updateUploadButtons();
  }

  // Event Listeners
  connectDriveBtn.addEventListener("click", async () => {
    if (!hasClientId) {
      showStatus(
        "Konfigurasi Client ID terlebih dahulu di Pengaturan",
        "error"
      );
      settingsContent.classList.add("show");
      settingsArrow.textContent = "▲";
      return;
    }

    showStatus("Menghubungkan ke Google Drive...", "loading");
    try {
      const response = await chrome.runtime.sendMessage({
        action: "connectDrive",
      });
      if (response && response.success) {
        setConnected(true, response.email);
        showStatus("Berhasil terhubung ke Google Drive!", "success");
      } else {
        throw new Error(response?.error || "Gagal terhubung");
      }
    } catch (error) {
      console.error("Connect error:", error);
      showStatus(`Error: ${error.message}`, "error");
    }
  });

  disconnectDriveBtn.addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({ action: "disconnectDrive" });
      setConnected(false);
      showStatus("Koneksi Google Drive diputuskan", "");
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  });

  folderPathInput.addEventListener("change", async () => {
    const path = folderPathInput.value.trim();
    await chrome.storage.local.set({ driveFolderPath: path });
    // Update folder preview
    updateFolderPreview();
  });

  // Also update on input (real-time)
  folderPathInput.addEventListener("input", () => {
    updateFolderPreview();
  });

  function updateFolderPreview() {
    if (currentProductFolderName) {
      const basePath = folderPathInput.value.trim() || "AliExpressMedia";
      productFolderEl.textContent = `${basePath}/${currentProductFolderName}`;
    }
  }

  uploadAllBtn.addEventListener("click", () => uploadMedia("all"));

  async function uploadMedia(type) {
    const folderPath = folderPathInput.value.trim().replace(/\/$/, "");

    // Check if spreadsheet ID is configured
    if (!hasSpreadsheetId) {
      showStatus(
        "Spreadsheet ID belum dikonfigurasi. Buka Pengaturan.",
        "error"
      );
      settingsContent.classList.add("show");
      settingsArrow.textContent = "▲";
      return;
    }

    showStatus("Mempersiapkan upload...", "loading");
    showProgress(0);
    disableUploadButtons();

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Tell content script to prepare and upload
      const results = await chrome.tabs.sendMessage(tab.id, {
        action: "uploadToDrive",
        type: type,
        folderPath: folderPath,
      });

      if (results && results.success) {
        showProgress(80);
        showStatus("Mengupdate spreadsheet...", "loading");

        // Get sheet name from storage
        const sheetConfig = await chrome.storage.local.get([
          "productSheetName",
        ]);
        const sheetName = sheetConfig.productSheetName || "PRODUCT";

        // Update spreadsheet with the results
        const spreadsheetResult = await chrome.runtime.sendMessage({
          action: "updateSpreadsheet",
          sheetName: sheetName,
          productId: currentProductId,
          productName: currentRawProductName,
          videoLinks: results.videoLinks || [],
          imageLinks: results.imageLinks || [],
        });

        if (spreadsheetResult && spreadsheetResult.success) {
          showProgress(100);
          showStatus(
            `✓ Berhasil upload ${results.uploaded} file dan update spreadsheet`,
            "success"
          );
        } else {
          showProgress(100);
          showStatus(
            `✓ Upload berhasil (${
              results.uploaded
            } file), tapi gagal update spreadsheet: ${
              spreadsheetResult?.error || "Unknown error"
            }`,
            "error"
          );
        }
      } else {
        throw new Error(results?.error || "Upload gagal");
      }
    } catch (error) {
      console.error("Upload error:", error);
      showStatus(`Error: ${error.message}`, "error");
    } finally {
      setTimeout(() => {
        hideProgress();
        enableUploadButtons();
      }, 2000);
    }
  }

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = "show " + type;
  }

  function showProgress(percent) {
    progressContainer.classList.add("show");
    progressFill.style.width = percent + "%";
    progressText.textContent = Math.round(percent) + "%";
  }

  function hideProgress() {
    progressContainer.classList.remove("show");
  }

  // Listen for progress updates from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "uploadProgress") {
      showProgress(request.percent);
      if (request.message) {
        showStatus(request.message, "loading");
      }
    }
    if (request.action === "reviewScrollProgress") {
      showReviewStatus(request.message, "loading");
      if (request.count) {
        reviewCountEl.textContent = request.count;
      }
    }
  });

  // Review extraction handlers
  extractReviewsBtn.addEventListener("click", async () => {
    // Get filter values from inputs
    const minWords = parseInt(minWordsInput.value) || 20;
    const maxReviews = parseInt(maxReviewsInput.value) || 20;

    showReviewStatus(
      `Membuka popup review (min ${minWords} kata, maks ${maxReviews} review)...`,
      "loading"
    );
    extractReviewsBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const results = await chrome.tabs.sendMessage(tab.id, {
        action: "extractReviews",
        openPopup: true,
        maxScrolls: 30,
        autoClose: false,
        minWords: minWords,
        maxReviews: maxReviews,
      });

      if (results && results.success) {
        reviewCountEl.textContent = results.reviews.length;
        reviewPhotoCountEl.textContent = results.reviewPhotos.length;

        // Show summary
        if (results.reviews.length > 0) {
          reviewSummary.style.display = "block";
          averageRatingEl.textContent = `⭐ ${results.averageRating.toFixed(
            1
          )}`;
          totalReviewsEl.textContent = `${results.totalCount} total ratings`;

          // Enable buttons
          uploadReviewsBtn.disabled = !isConnected;
        }

        showReviewStatus(
          `✓ Berhasil ekstrak ${results.reviews.length} review dengan ${results.reviewPhotos.length} foto`,
          "success"
        );
      } else {
        throw new Error(results?.error || "Gagal mengekstrak review");
      }
    } catch (error) {
      console.error("Extract reviews error:", error);
      showReviewStatus(`Error: ${error.message}`, "error");
    } finally {
      extractReviewsBtn.disabled = false;
    }
  });

  uploadReviewsBtn.addEventListener("click", async () => {
    if (!isConnected) {
      showReviewStatus("Hubungkan ke Google Drive terlebih dahulu", "error");
      return;
    }

    const folderPath = folderPathInput.value.trim().replace(/\/$/, "");

    // Get sheet name from storage
    const sheetConfig = await chrome.storage.local.get(["reviewSheetName"]);
    const reviewSheetName = sheetConfig.reviewSheetName || "REVIEW";

    showReviewStatus("Mempersiapkan upload review...", "loading");
    showReviewProgress(0);
    uploadReviewsBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      const results = await chrome.tabs.sendMessage(tab.id, {
        action: "uploadReviewsToDrive",
        folderPath: folderPath,
        includePhotos: true,
        reviewSheetName: reviewSheetName,
      });

      if (results && results.success) {
        showReviewProgress(100);
        showReviewStatus(
          `✓ Berhasil upload ${results.uploaded} file review ke Drive`,
          "success"
        );
      } else {
        throw new Error(results?.error || "Upload gagal");
      }
    } catch (error) {
      console.error("Upload reviews error:", error);
      showReviewStatus(`Error: ${error.message}`, "error");
    } finally {
      setTimeout(() => {
        hideReviewProgress();
        uploadReviewsBtn.disabled =
          !isConnected || parseInt(reviewCountEl.textContent) === 0;
      }, 2000);
    }
  });

  function showReviewStatus(message, type) {
    reviewStatusEl.textContent = message;
    reviewStatusEl.className = "show " + type;
  }

  function showReviewProgress(percent) {
    reviewProgressContainer.classList.add("show");
    reviewProgressFill.style.width = percent + "%";
    reviewProgressText.textContent = Math.round(percent) + "%";
  }

  function hideReviewProgress() {
    reviewProgressContainer.classList.remove("show");
  }
});
