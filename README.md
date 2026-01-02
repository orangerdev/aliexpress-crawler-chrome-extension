# AliExpress Media Downloader Chrome Extension

Chrome extension untuk mengunduh gambar dan video produk dari halaman produk AliExpress.

![Extension UI](https://github.com/user-attachments/assets/c126f372-7168-4632-8a89-8a7a31bdebbc)

## Fitur

- 📷 Download semua gambar produk dari halaman AliExpress
- 🎥 Download video produk (jika tersedia)
- 📦 Download semua media sekaligus (gambar + video)
- 🎨 Interface yang menarik dan mudah digunakan
- ⚡ Cepat dan efisien

## Instalasi

1. Download atau clone repository ini:
   ```bash
   git clone https://github.com/orangerdev/aliexpress-crawler-chrome-extension.git
   ```

2. Buka Chrome dan akses `chrome://extensions/`

3. Aktifkan "Developer mode" di pojok kanan atas

4. Klik "Load unpacked" dan pilih folder repository ini

5. Extension akan muncul di toolbar Chrome Anda

## Cara Penggunaan

1. Buka halaman produk AliExpress (misalnya: https://www.aliexpress.com/item/...)

2. Klik icon extension di toolbar Chrome

3. Extension akan menampilkan jumlah gambar dan video yang ditemukan

4. Pilih opsi download:
   - **Download Gambar**: Download semua gambar produk
   - **Download Video**: Download semua video produk
   - **Download Semua**: Download semua media (gambar + video)

5. File akan otomatis tersimpan di folder Downloads browser Anda

## Struktur File

```
aliexpress-crawler-chrome-extension/
├── manifest.json        # Konfigurasi extension
├── popup.html          # Interface popup extension
├── popup.js            # Logic untuk popup
├── content.js          # Script untuk extract media dari halaman
├── background.js       # Service worker untuk handle downloads
├── icons/              # Icon extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Teknologi yang Digunakan

- Chrome Extension Manifest V3
- Vanilla JavaScript (no framework)
- Chrome Downloads API
- Chrome Tabs API
- Chrome Scripting API

## Catatan

- Extension ini hanya bekerja pada halaman produk AliExpress (URL yang mengandung `/item/`)
- Pastikan browser Anda mengizinkan download multiple files
- Beberapa gambar atau video mungkin memerlukan waktu untuk diunduh tergantung ukuran file dan kecepatan internet

## Lisensi

MIT License

## Kontribusi

Pull requests dan issues are welcome!
