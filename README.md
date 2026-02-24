# 🏋️ GYM PRO v5 — PWA

Ứng dụng quản lý học viên phòng gym với Firebase Realtime Database sync.

## 📁 Cấu trúc thư mục

```
huygym-pwa/
├── index.html       ← App chính (toàn bộ UI + logic)
├── manifest.json    ← PWA manifest (metadata, icons, display)
├── sw.js            ← Service Worker (offline cache, install)
├── icons/           ← PWA icons (72→512px)
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── README.md
```

## 🚀 Cách deploy

### Option 1: GitHub Pages (miễn phí)
1. Tạo repository mới trên GitHub
2. Upload toàn bộ folder này lên
3. Vào Settings → Pages → chọn branch main
4. App sẽ chạy tại `https://username.github.io/repo-name/`

### Option 2: Netlify (miễn phí, HTTPS tự động)
1. Kéo thả folder vào netlify.com/drop
2. App live ngay lập tức với HTTPS

### Option 3: Vercel
```bash
npx vercel --yes
```

### Option 4: Chạy local
```bash
# Cần HTTPS hoặc localhost để PWA hoạt động
npx serve .
# hoặc
python3 -m http.server 8080
```
M��: http://localhost:8080

## 📱 Cài đặt PWA

### Android (Chrome):
- Mở app trong Chrome → menu ⋮ → "Thêm vào màn hình chính"
- Hoặc chờ banner xuất hiện tự động

### iOS (Safari):
- Mở app trong Safari → nút chia sẻ → "Thêm vào màn hình chính"

### Desktop (Chrome/Edge):
- Nhấn icon cài đặt ở thanh địa chỉ

## ✨ Tính năng PWA

- ✅ Cài đặt như app native (Android, iOS, Desktop)
- ✅ Banner cài đặt tự động hiện khi truy cập
- ✅ Offline support — mở được khi không có mạng
- ✅ Firebase sync real-time khi có mạng
- ✅ localStorage backup khi offline
- ✅ Thông báo offline/online tự động

## ⚙️ Firebase Config

Dữ liệu được lưu tại:
- Project: `huygym-16f43`
- Database: Firebase Realtime Database
- Path: `/gym_members`

## 🎨 Tech Stack

- HTML + CSS + Vanilla JS (no framework)
- Firebase Realtime DB v11
- Service Worker API
- Web App Manifest
- Google Fonts: DM Sans + Plus Jakarta Sans
