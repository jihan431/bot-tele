# Panduan Setup VPS untuk Bot Telegram/WhatsApp

Berikut adalah panduan lengkap untuk mengatur VPS (Virtual Private Server) dari nol hingga bot Anda berjalan online 24 jam. Panduan ini menggunakan sistem operasi **Ubuntu 20.04/22.04 LTS** (paling umum digunakan).

## 1. Login ke VPS

Setelah membeli VPS (dari DigitalOcean, Linode, Vultr, atau provider lokal seperti di screenshot), Anda akan mendapatkan **IP Address** dan **Password** untuk user `root`.

Buka terminal (PC) atau aplikasi seperti Termius/JuiceSSH (HP), lalu login:

```bash
ssh root@IP_VPS_ANDA
# Contoh: ssh root@139.59.247.205
```
*Masukkan password saat diminta (password tidak akan muncul di layar saat diketik).*

---

## 2. Update System

Langkah pertama yang wajib dilakukan agar sistem aman dan stabil.

```bash
apt update && apt upgrade -y
```

---

## 3. Install Node.js

Bot Anda menggunakan Node.js. Kita akan menginstall versi LTS (Long Term Support) yang stabil.

```bash
# Download setup script untuk Node.js v20 (versi stabil saat ini)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
apt install -y nodejs

# Cek apakah berhasil
node -v
npm -v
```

---

## 4. Install Dependencies Bot (Wajib!)

Bot Anda menggunakan `canvas` dan mungkin `ffmpeg` untuk media. Ini membutuhkan library tambahan di sistem VPS.

```bash
# Install FFmpeg (untuk video/audio/sticker)
apt install -y ffmpeg

# Install dependencies untuk 'canvas' dan 'puppeteer' (jika ada)
apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

---

## 5. Upload/Clone Bot Anda

Ada dua cara untuk memasukkan file bot ke VPS:

### Opsi A: Menggunakan Git (Paling Mudah)
Jika bot Anda ada di GitHub/GitLab:

```bash
# Install git
apt install -y git

# Clone repo (ganti link dengan link repo anda)
git clone https://github.com/username/repo-bot-anda.git

# Masuk ke folder bot
cd repo-bot-anda
```

### Opsi B: Upload Manual (ZIP)
Jika file ada di komputer lokal atau HP:
1. Zip folder bot Anda.
2. Upload menggunakan SFTP (bisa pakai FileZilla di PC atau fitur SFTP di Termius).
3. Upload ke folder `/root/`.
4. Di terminal VPS, unzip file tersebut:
   ```bash
   apt install -y unzip
   unzip nama_file_bot.zip
   cd nama_folder_bot
   ```

---

## 6. Install Module (node_modules)

Setelah masuk ke folder bot, install semua library yang dibutuhkan.

```bash
npm install
```

---

## 7. Test Jalan Bot (Sementara)

Coba jalankan bot sebentar untuk memastikan tidak ada error.

```bash
node server.js
# atau
npm start
```
*Jika bot jalan lancar (muncul QR code atau pesan Connected), tekan `CTRL + C` untuk mematikannya. Kita akan menyalakannya secara permanen di langkah berikutnya.*

---

## 8. Jalankan Bot 24 Jam dengan PM2

Agar bot tetap jalan meskipun Anda menutup terminal, gunakan **PM2**.

```bash
# Install PM2 secara global
npm install -g pm2

# Jalankan bot
pm2 start server.js --name "bot-saya"

# Cek status bot
pm2 status

# Cek log (untuk melihat QR code atau error)
pm2 logs "bot-saya"
# Tekan CTRL + C untuk keluar dari log (bot tidak akan mati)
```

### Perintah PM2 Berguna Lainnya:
- `pm2 restart bot-saya` : Restart bot
- `pm2 stop bot-saya` : Matikan bot
- `pm2 monit` : Monitor penggunaan RAM/CPU

---

## 9. Setup Domain/Subdomain (Opsional)

Jika Anda ingin menggunakan domain seperti `node-mytoolsflex.my.id`, Anda perlu:
1. Beli domain atau gunakan subdomain gratis.
2. Masuk ke panel DNS provider domain Anda (Cloudflare, dll).
3. Buat **A Record**:
   - **Name**: `subdomain` (misal: `bot`)
   - **IPv4 Address**: IP VPS Anda (misal `139.59.247.205`)
   - **Proxy Status**: Off (DNS Only) untuk awal, agar SSH langsung tembus.

Selesai! Bot Anda sekarang berjalan di VPS. 🚀
