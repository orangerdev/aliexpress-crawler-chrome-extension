# Testing Guide

## Manual Testing Steps

### 1. Load the Extension

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Verify the extension icon appears in the toolbar

### 2. Test on AliExpress Product Page

1. Go to any AliExpress product page, for example:
   - https://www.aliexpress.com/item/1005001234567890.html
   - Or search for any product on aliexpress.com and open a product page

2. Click the extension icon in the toolbar

3. Verify the popup displays:
   - Extension title
   - Number of images found
   - Number of videos found
   - Three download buttons

### 3. Test Image Download

1. Click "📷 Download Gambar" button
2. Check Chrome's Downloads folder
3. Verify images are downloaded with proper filenames (productname_image_1.jpg, etc.)

### 4. Test Video Download

1. Click "🎥 Download Video" button (if videos are available)
2. Check Chrome's Downloads folder
3. Verify videos are downloaded with proper filenames (productname_video_1.mp4, etc.)

### 5. Test Download All

1. Click "📦 Download Semua" button
2. Check Chrome's Downloads folder
3. Verify both images and videos are downloaded

### 6. Test Error Handling

1. Try opening the extension on a non-AliExpress page
2. Verify it shows an error message: "Silakan buka halaman produk AliExpress"

### 7. Test on Different AliExpress Domains

Test on both:
- aliexpress.com
- aliexpress.us

## Expected Results

- ✅ Extension loads without errors
- ✅ Media count is displayed correctly
- ✅ Images download successfully
- ✅ Videos download successfully (when available)
- ✅ Files are named properly
- ✅ Error messages display on non-AliExpress pages
- ✅ UI is responsive and visually appealing

## Common Issues & Solutions

### Issue: "Cannot access page" error
**Solution:** Refresh the AliExpress product page and try again

### Issue: No images found
**Solution:** The page might still be loading. Wait a moment and click the extension icon again

### Issue: Downloads blocked
**Solution:** Check Chrome settings to allow multiple downloads from the extension

## Technical Validation

### Files Created
- ✅ manifest.json (Chrome Extension configuration)
- ✅ popup.html (UI interface)
- ✅ popup.js (UI logic)
- ✅ content.js (Media extraction)
- ✅ background.js (Download handler)
- ✅ icons/ (Extension icons)

### Permissions Used
- ✅ activeTab (access current tab)
- ✅ downloads (download files)
- ✅ scripting (inject content script)
- ✅ host_permissions (access AliExpress domains)

### Features Implemented
- ✅ Extract product images from multiple sources
- ✅ Extract product videos
- ✅ Download with custom filenames
- ✅ Beautiful, user-friendly interface
- ✅ Error handling
- ✅ Status messages
- ✅ Multiple domain support (aliexpress.com, aliexpress.us)
