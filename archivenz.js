// Workaround untuk SSL certificate error
// Hapus environment variable jika ada sisa dari terminal/sesi sebelumnya
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
console.log('🔒 Security: TLS Verification Enabled (Warning suppressed)');

console.log('Memulai bot...');
const { Telegraf, Markup } = require('telegraf');
const cooldowns = {};
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, makeInMemoryStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const moment = require("moment-timezone");
const chalk = require('chalk');
const axios = require('axios');
const archiver = require('archiver');
const FormData = require('form-data');
const config = require('./config');
const path = require('path');
const { exec, execSync } = require('child_process');
const nodemailer = require('nodemailer');
const { createCanvas, loadImage } = require('canvas');
const Jimp = require('jimp');

//======================== ERROR HANDLING ====================

// Menangkap error yang tidak tertangani agar bot tidak mati total
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

//======================== DATABASE ====================

const OWNER_ID = config.ownerId.toString();
const TOKEN = config.telegramBotToken;
const OWNER = config.ownerId;
const USERNAME_OWNER = config.usernameOwner;
const VERSION = config.version;
const NAMA_BOT = config.namaBot;
const bot = new Telegraf(config.telegramBotToken);
const checkAccess = (level) => async (ctx, next) => {
    const userId = ctx.from.id;
    if (level === 'owner' && !isOwner(userId)) {
        return ctx.reply(config.message.owner, { parse_mode: 'Markdown' });
    }
    await next();
};

let botLaunched = false;

const CHANNEL_ID = config.channelId;
const GROUP_ID = config.groupId;
const REF_FILE = './database/referral.json';
const userDBPath = path.join(__dirname, 'database', 'users.json');
const dataFile = path.join(__dirname, "./database/roles.json");
let roleData = { owners: [], premiums: [] };

// Inisialisasi file jika belum ada
if (!fs.existsSync(REF_FILE)) fs.writeFileSync(REF_FILE, '{}');
if (!fs.existsSync(userDBPath)) {
  fs.writeFileSync(userDBPath, JSON.stringify([]));
}

//======================== FUNCTION ====================

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function showBanner() {
  console.clear();
  console.log(chalk.blue(`
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠛⢛⣛⣛⠛⠛⡛⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠉⣠⠶⢛⣋⣿⠿⠷⠒⠾⣿⣦⡈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⠀⣨⣴⠿⢛⣛⣭⡧⢚⣛⢿⣦⡙⢿⣷⡈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠁⠀⣠⣾⢛⣥⣾⠟⣩⣤⣄⣘⡛⢷⣌⠻⣮⢻⣷⡀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⡄⠀⣴⠟⣡⣾⡟⣱⣿⢩⡿⣿⡿⢻⢊⢻⣧⡙⡜⣿⡄⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⡔⢀⣼⠏⣰⣿⠌⢰⣿⠋⣾⣿⠇⠸⣦⢧⡀⢻⣷⣴⡘⣿⡄⠹⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡷⠁⣾⡏⣰⣿⠟⠀⠠⡅⠠⠥⠀⢠⣧⠙⠈⢷⠀⢻⡿⢡⠘⣧⠀⢿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇⢰⡿⢀⣿⡇⠀⠀⠀⠀⢀⠉⢀⣾⣿⣷⡀⠈⠀⠈⣋⠈⠂⠸⠀⡸⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠀⣿⠇⠸⡏⠀⡀⠁⠒⠀⣀⣴⡟⠯⢭⣿⣿⠆⠀⡼⣽⡇⠀⠀⠀⣱⠘⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠛⠀⠀⠀⢰⣿⣥⣶⣸⣿⣿⣦⡆⢀⢈⣙⢀⣦⡇⡟⠁⠀⠀⠀⠏⣰⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⠿⠀⠀⠰⠀⠘⠀⠸⣿⣿⣿⣿⣿⣿⣿⣿⣷⠟⣡⣿⠏⠉⠀⠀⢘⣠⣠⣾⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⣦⠠⡄⠀⠆⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⡀⠀⠁⠀⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠟⠛⠀⠀⠀⠀⢠⣦⡙⢿⣿⣿⣿⠿⢛⡡⡰⢠⡃⢀⠀⠸⢶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⢿⣿⣿⣿⢿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠙⢃⠀⣬⠉⣠⣴⠟⠠⠶⠿⠛⠀⠀⠀⠀⠉⠛⠿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣏⣭⣶⠊⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣷⣶⡜⢛⣵⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿
⣿⡿⠷⢨⣿⠏⠁⢀⡀⠀⠀⠀⠀⠀⠀⣀⣀⣀⠀⠀⠀⠈⠁⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿
⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠄⠉⠀⢀⠀⠀⡒⠒⠻⠹⣫⣓⡲⣶⡤⣤⣀⠀⠀⠀⠀⠀⢰⢿⣧⣀⢴⣦⡀⠀⢸⣿⣿
⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠈⠘⠃⠁⠀⢄⣀⣀⡒⠒⠁⠂⠀⣼⣿⢟⣠⡟⠀⠀⠀⣿⣿
⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠜⣡⣴⣯⣽⡒⠦⣤⣤⣀⠀⠀⠀⠀⠈⠉⠉⠙⠉⠁⠀⠀⠀⠉⠃⠾⠿⠃⠀⠀⠀⠸⣿
⣿⡀⠀⠀⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿⣿⣦⡈⠉⠛⠛⠛⣛⣓⣶⣶⡒⠢⢤⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿
⣿⡇⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣾⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿
⣿⣿⠀⠀⠀⠀⠀⠀⢸⣿⣀⣠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿
⣿⣿⣷⠀⠀⠀⠀⠀⠘⣿⡿⣿⣿⣿⣿⣿⣿⡿⣿⣿⢸⣿⣿⣿⣿⡇⠀⢸⣿⣿⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻
⣿⣿⣿⣧⡀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿⣿⠟⣱⣿⣿⡌⣿⣿⣿⣿⣷⣾⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸
⣿⣿⣿⣿⣿⣦⣄⣀⣀⣠⢵⣤⣉⣉⣩⣴⣾⣿⣿⣿⣷⡈⠻⣿⣿⣿⣿⣾⡿⠛⣰⡇⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣄⣉⣉⣉⣁⣶⣾⡿⢡⣾⣄⠀⠀⠀⠀⠀⠀⠀⠀⣰
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⢸⣿⣿⣦⡀⠀⠀⠀⠀⠀⣴⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠃⠹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢃⣾⣿⣿⣿⣿⣦⣤⣤⣴⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⡿⢋⢀⡎⣰⣜⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠁⡀⢈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⡿⢁⢀⣿⢸⠟⣨⡻⣶⣍⣙⣛⠿⠿⠿⠿⠿⠿⠿⢛⣉⣄⣴⡄⣿⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⡿⢡⠁⣸⠇⣾⣼⣿⣿⣶⡭⣙⣻⠿⠿⠿⣿⣿⠿⠿⠟⣋⣅⢿⣷⢸⣿⡄⢄⠻⣿⣿⣿⣿⣿⣿⣿⣿`));
  console.log(chalk.cyan.bold("==========================================="));
  console.log(chalk.greenBright.bold(`🤖 ${NAMA_BOT} 𝗩${VERSION}`));
  console.log(chalk.yellow(`📅 ${moment().tz('Asia/Jakarta').format('dddd, DD MMMM YYYY HH:mm:ss')}`));
  console.log(chalk.blueBright(`🧠 Developer: ${USERNAME_OWNER}`));
  console.log(chalk.white(`🧩 Node.js version: ${process.version}`));
  console.log(chalk.greenBright(`🚀 Status: Bot siap digunakan!`));
  console.log(chalk.cyan.bold("==========================================="));
}

//======================== FUNCTION AUTO BACKUP ====================

async function autoBackup() {
  try {
    const backupDir = path.join(__dirname, 'backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    // Rate Limiting: Cek backup terakhir
    const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
        .sort().reverse(); // Terbaru di atas

    if (files.length > 0) {
        const lastBackupFile = files[0];
        const stats = fs.statSync(path.join(backupDir, lastBackupFile));
        const lastModified = stats.mtimeMs;
        const oneHour = 60 * 60 * 1000;

        if (Date.now() - lastModified < oneHour) {
             console.log(chalk.yellow(`⏳ Backup otomatis di-skip. Backup terakhir baru dibuat ${Math.floor((Date.now() - lastModified)/60000)} menit yang lalu.`));
             return;
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(backupDir, `backup-${timestamp}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    const foldersToBackup = [
      'database',
      'archivenz.js',
      'config.js',
      'package.json'
    ];

    for (const folder of foldersToBackup) {
      const folderPath = path.join(__dirname, folder);
      if (fs.existsSync(folderPath)) {
        const stats = fs.lstatSync(folderPath);
        if (stats.isDirectory()) {
          archive.directory(folderPath, folder);
        } else {
          archive.file(folderPath, { name: folder });
        }
      }
    }

    await archive.finalize();

    output.on('close', async () => {
      console.log(`✅ Backup selesai: ${zipPath} (${archive.pointer()} bytes)`);

      // Kumpulkan semua owner ID unik
      const allOwners = new Set([
        config.ownerId.toString(),
        ...roleData.owners
            .filter(o => !isExpired(o.expireAt))
            .map(o => o.id)
      ]);

      console.log(`📤 Mengirim backup ke ${allOwners.size} owner...`);

      for (const ownerId of allOwners) {
        try {
          await bot.telegram.sendDocument(
            ownerId,
            { source: zipPath },
            { caption: `📦 Backup otomatis berhasil dibuat pada ${new Date().toLocaleString('id-ID')}` }
          );
          console.log(`✅ Backup terkirim ke: ${ownerId}`);
        } catch (err) {
          console.error(`❌ Gagal kirim backup ke ${ownerId}:`, err.message);
        }
      }
    });
  } catch (err) {
    console.error('❌ Gagal membuat backup:', err.message);
  }
}

//======================== FUNGSI DATABASE LOKAL ====================

function loadRefs() {
  return JSON.parse(fs.readFileSync(REF_FILE));
}
function saveRefs(data) {
  fs.writeFileSync(REF_FILE, JSON.stringify(data, null, 2));
}

function loadUsers() {
  if (!fs.existsSync(userDBPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(userDBPath, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function saveUsers(data) {
  fs.writeFileSync(userDBPath, JSON.stringify(data, null, 2));
}

function loadRoles() {
  if (fs.existsSync(dataFile)) {
    try {
      roleData = JSON.parse(fs.readFileSync(dataFile));

      if (!Array.isArray(roleData.owners)) roleData.owners = [];
      if (!Array.isArray(roleData.premiums)) roleData.premiums = [];

      roleData.owners = roleData.owners.map(o =>
        typeof o === "string"
          ? { id: o, expireAt: "permanent", startAt: Date.now() }
          : o
      );
      roleData.premiums = roleData.premiums.map(p =>
        typeof p === "string"
          ? { id: p, expireAt: "permanent", startAt: Date.now() }
          : p
      );
    } catch (err) {
      console.error("⚠️ Gagal baca roles.json, reset data:", err);
      roleData = { owners: [], premiums: [] };
      saveRoles();
    }
  } else {
    roleData = { owners: [], premiums: [] };
    saveRoles();
  }
}

function saveRoles() {
  fs.writeFileSync(dataFile, JSON.stringify(roleData, null, 2));
}

loadRoles();

function isExpired(expireAt) {
  if (!expireAt) return true;
  if (expireAt === "permanent") return false;
  return Date.now() > expireAt;
}

function isOwner(id) {
  const uid = id.toString();
  if (uid === config.ownerId.toString()) return true;

  const owner = roleData.owners.find(o => o.id === uid);
  if (!owner) return false;
  return !isExpired(owner.expireAt);
}

function isPremium(id) {
  const uid = id.toString();
  if (isOwner(uid)) return true;

  const prem = roleData.premiums.find(p => p.id === uid);
  if (!prem) return false;
  return !isExpired(prem.expireAt);
}

function parseDuration(dur) {
  if (!dur) return null;
  const unit = dur.slice(-1).toLowerCase();
  const num = parseInt(dur);
  const now = Date.now();

  switch (unit) {
    case "d":
      return now + num * 24 * 60 * 60 * 1000;
    case "w":
      return now + num * 7 * 24 * 60 * 60 * 1000;
    case "m":
      return now + num * 30 * 24 * 60 * 60 * 1000;
    case "p":
      return "permanent";
    default:
      return null;
  }
}

function formatDuration(dur) {
  if (dur === "permanent") return "Permanen";
  const sisa = dur - Date.now();
  const hari = Math.max(1, Math.ceil(sisa / (24 * 60 * 60 * 1000)));
  return `${hari} hari`;
}

function formatDate(ts) {
  if (ts === "permanent") return "∞";
  const d = new Date(ts);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function getDurationText(expireAt, startAt) {
  if (expireAt === "permanent") return "Permanen";
  const diff = expireAt - startAt;
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (days % 30 === 0) return `${days / 30} bulan`;
  if (days % 7 === 0) return `${days / 7} minggu`;
  return `${days} hari`;
}

function generatePagedList(items, page = 1, type = "premium") {
  const perPage = 15;
  const totalPages = Math.ceil(items.length / perPage);
  const startIndex = (page - 1) * perPage;
  const pagedItems = items.slice(startIndex, startIndex + perPage);

  let text = type === "owner"
    ? "👑 Daftar Owner\n━━━━━━━━━━━━━━━━━━\n"
    : "📜 Daftar User Premium\n━━━━━━━━━━━━━━━━━━\n";

  for (const user of pagedItems) {
    const { id, expireAt, startAt } = user;
    if (isExpired(expireAt)) continue;

    const mulai = formatDate(startAt);
    const akhir = formatDate(expireAt);
    const durasi = getDurationText(expireAt, startAt);

    text += `👤 ID: ${id}\n⏱ Durasi: ${durasi}\n📅 Tanggal: ${mulai} - ${akhir}\n`;
  }

  text += `📄 Halaman ${page} / ${totalPages}`;

  const buttons = [];
  if (page > 1) buttons.push({ text: "◀️ Prev", callback_data: `${type}_page_${page - 1}` });
  if (page < totalPages) buttons.push({ text: "Next ▶️", callback_data: `${type}_page_${page + 1}` });

  return { text, buttons: buttons.length ? [buttons] : [] };
}

function generateUserList(users, page = 1) {
  const perPage = 20;
  const totalPages = Math.ceil(users.length / perPage);
  const startIndex = (page - 1) * perPage;
  const pageIds = users.slice(startIndex, startIndex + perPage);

  let text = `📊 Total ID Terdaftar\n━━━━━━━━━━━━━━━━━━\n`;

  pageIds.forEach((id, index) => {
    text += `${startIndex + index + 1}. ${id}\n`;
  });

  text += `📄 Halaman: ${page} / ${totalPages}\n👥 Total ID: ${users.length}`;

  const buttons = [];
  if (page > 1) buttons.push({ text: "◀️ Prev", callback_data: `users_page_${page - 1}` });
  if (page < totalPages) buttons.push({ text: "Next ▶️", callback_data: `users_page_${page + 1}` });

  return { text, buttons: buttons.length ? [buttons] : [] };
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function uploadToCatbox(fileBuffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fileBuffer, filename);

  const res = await axios.post('https://catbox.moe/user/api.php', form, {
    headers: form.getHeaders(),
    timeout: 60000 
  });

  const text = res.data;
  if (typeof text !== 'string' || text.startsWith('ERROR')) {
    throw new Error('Upload gagal: ' + text);
  }

  return text.trim();
}

function syncReferralBonuses() {
  const refData = loadRefs();
  let updated = 0;

  for (const userId in refData) {
    const user = refData[userId];
    const invitedCount = user.invited?.length || 0;

    if (user.bonusChecks === undefined) user.bonusChecks = 0;
    if (user.totalInvited === undefined) user.totalInvited = 0;

    const earnedBonuses = Math.floor(invitedCount / 5) * 5;

    if (earnedBonuses > user.totalInvited) {
      const newBonus = earnedBonuses - user.totalInvited;
      user.bonusChecks += newBonus;
      user.totalInvited = earnedBonuses;
      updated++;
    }
  }

  saveRefs(refData);
  console.log(`✅ Sinkronisasi referral selesai. ${updated} user diperbarui.`);
}

//======================== FUNCTION CONNECT WHATSAPP ====================

let waClient = null;
let waConnectionStatus = 'closed';
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let justPaired = false; // Flag untuk skip reconnect setelah pairing

// QR Code storage untuk pairing via Telegram
let currentQR = null;
let qrRequesterId = null; // User ID yang request QR

const store = makeInMemoryStore({ 
    logger: pino().child({ level: 'silent', stream: 'store' }) 
});

// Bersihkan store setiap 30 menit untuk mencegah memory leak
setInterval(() => {
  if (store.messages) {
    for (const chatId in store.messages) {
      const msgs = store.messages[chatId];
      if (msgs && msgs.length > 100) {
        store.messages[chatId] = msgs.slice(-50);
      }
    }
  }
}, 30 * 60 * 1000);

async function startWhatsAppClient() {
    // Cegah multiple reconnect bersamaan
    if (isReconnecting) {
        console.log("Sudah dalam proses reconnect, skip...");
        return;
    }
    
    isReconnecting = true; // Set flag bahwa sedang proses connect/reconnect
    
    // Cleanup client lama jika ada
    if (waClient) {
        try {
            waClient.ev.removeAllListeners();
            waClient.end ? waClient.end(undefined) : waClient.ws.close();
        } catch (e) {
            console.error('Gagal cleanup client lama:', e.message);
        }
        waClient = null;
    }
    
    console.log("Mencoba memulai koneksi WhatsApp...");

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 10000,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["CekBioBot", "Chrome", "1.0.0"],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        getMessage: async (key) => ({
            conversation: '',
        }),
    };

    waClient = makeWASocket(connectionOptions);

    waClient.ev.on('creds.update', saveCreds);
    store.bind(waClient.ev);

    waClient.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Handle QR Code
    if (qr) {
      currentQR = qr;
      justPaired = true; // Set flag bahwa sedang dalam proses pairing
      console.log('📱 QR Code tersedia untuk pairing');
      
      // Jika ada yang request QR, kirim ke Telegram
      if (qrRequesterId) {
        try {
          const QRCode = require('qrcode');
          let qrBuffer;
          
          // Coba PNG dulu (butuh canvas), jika gagal fallback ke SVG (untuk Termux)
          try {
            qrBuffer = await QRCode.toBuffer(qr, { 
              type: 'png', 
              width: 300,
              margin: 2 
            });
          } catch (canvasErr) {
            // Fallback ke SVG jika canvas tidak tersedia (Termux)
            console.log('⚠️ Canvas tidak tersedia, menggunakan SVG...');
            const svgString = await QRCode.toString(qr, { 
              type: 'svg',
              width: 300,
              margin: 2 
            });
            qrBuffer = Buffer.from(svgString);
          }
          
          // Kirim sebagai file (support PNG atau SVG)
          const isPNG = qrBuffer[0] === 0x89 && qrBuffer[1] === 0x50; // PNG magic bytes
          
          if (isPNG) {
            await bot.telegram.sendPhoto(qrRequesterId, { source: qrBuffer }, {
              caption: `📱 QR CODE WHATSAPP\n\nScan QR ini di WhatsApp:\nPengaturan → Perangkat Tertaut → Tautkan Perangkat\n\n⏳ QR berlaku 60 detik!`,
              parse_mode: 'HTML'
            });
          } else {
            // SVG: kirim sebagai document karena Telegram tidak support SVG sebagai photo
            await bot.telegram.sendDocument(qrRequesterId, 
              { source: qrBuffer, filename: 'qrcode.svg' }, 
              {
                caption: `📱 QR CODE WHATSAPP\n\nScan QR ini di WhatsApp:\nPengaturan → Perangkat Tertaut → Tautkan Perangkat\n\n⏳ QR berlaku 60 detik!\n\n💡 Buka file SVG ini untuk melihat QR code`,
                parse_mode: 'HTML'
              }
            );
          }
          
          console.log(`✅ QR Code dikirim ke ${qrRequesterId}`);
        } catch (err) {
          console.error('Gagal kirim QR:', err.message);
        }
      }
    }
    
    if (connection) {
        waConnectionStatus = connection;
        console.log('Status koneksi WA:', connection);
    }
    
    if (connection === 'open') {
        isReconnecting = false;
        reconnectAttempts = 0;
        console.log(chalk.green.bold("WhatsApp Connected"));
        
        // Jika baru saja pairing, tunggu credentials tersimpan
        if (justPaired) {
            console.log(chalk.yellow("⏳ Menyimpan credentials, tunggu sebentar..."));
            await delay(3000); // Tunggu 3 detik agar creds tersimpan
            justPaired = false;
            console.log(chalk.green("✅ Credentials tersimpan!"));
            
            // Notifikasi ke Telegram
            if (qrRequesterId) {
                try {
                    await bot.telegram.sendMessage(qrRequesterId, 
                        `✅ WHATSAPP TERHUBUNG!\n\nBot sekarang sudah terhubung ke WhatsApp dan siap digunakan.`,
                        { parse_mode: 'HTML' }
                    );
                } catch (e) {}
            }
        }
    }

    if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(chalk.red.bold("WhatsApp Disconnected"));
        console.log('Disconnect reason:', statusCode);
        
        // Reset flag reconnecting agar bisa attempt reconnect lagi
        // Kecuali kita sedang menunggu timeout retry di bawah (untuk 440/515)
        // Tapi kita akan handle reset flag di dalam logika retry masing-masing jika perlu
        // Atau biarkan false di sini dan set true saat startWhatsAppClient dipanggil lagi.
        isReconnecting = false; 
        
        // Jika baru saja pairing dan langsung disconnect, kemungkinan normal behavior
        if (justPaired) {
            console.log(chalk.yellow("⏳ Post-pairing disconnect, waiting for auto-reconnect..."));
            justPaired = false;
            await delay(5000); 
            startWhatsAppClient().catch(console.error);
            return;
        }
        
        // Khusus error 515 (Stream Error)
        if (statusCode === 515) {
            console.log(chalk.yellow("⚠️ Stream Error (515), waiting 10 seconds before reconnect..."));
            reconnectAttempts++;
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    startWhatsAppClient().catch(console.error);
                }, 10000);
            } else {
                console.log(chalk.red.bold("Max reconnect attempts reached for error 515"));
                waClient = null;
            }
            return;
        }

        // Khusus error 440 (Conflict) - Tunggu lebih lama
        if (statusCode === 440) {
            console.log(chalk.yellow("⚠️ Conflict Error (440), waiting 20 seconds before reconnect..."));
            reconnectAttempts++; 
             if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                setTimeout(() => {
                    startWhatsAppClient().catch(console.error);
                }, 20000);
            } else {
                console.log(chalk.red.bold("Max reconnect attempts reached for error 440. Resetting session recommended."));
                waClient = null;
            }
            return;
        }
        
        // Error 428 (Precondition Required / Connection Closed) biasanya butuh reconnect juga
        if (statusCode === 428) {
             console.log(chalk.yellow("⚠️ Connection Closed (428), reconnecting..."));
        }

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delayTime = Math.min(5000 * reconnectAttempts, 30000);
            console.log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delayTime/1000}s...`);
            setTimeout(() => {
                startWhatsAppClient().catch(console.error);
            }, delayTime);
        } else if (statusCode === DisconnectReason.loggedOut) {
            console.log(chalk.red.bold("Logged out dari WhatsApp. Session perlu di-reset."));
            waClient = null;
            const sessionPath = path.join(__dirname, config.sessionName);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log('🗑 Session dihapus karena logged out');
            }
        } else {
            console.log(chalk.red.bold("Tidak bisa menyambung ulang."));
            waClient = null;
        }
    }
    });
}

async function checkMetaBusiness(jid) {
  try {
    const businessProfile = await waClient.getBusinessProfile(jid);
    if (businessProfile) {
      return { isBusiness: true, businessData: businessProfile };
    }
    return { isBusiness: false, businessData: null };
  } catch (error) {
    return { isBusiness: false, businessData: null };
  }
}

function getJamPercentage(bio, setAt, metaBusiness) {
  let base = 50;

  if (bio && bio.length > 0) {
    if (bio.length > 100) base -= 20;
    else if (bio.length > 50) base -= 15;
    else if (bio.length > 20) base -= 10;
    else base -= 5;
  } else base += 15;

  if (setAt) {
    const now = new Date();
    const bioDate = new Date(setAt);
    const diffDays = Math.ceil(Math.abs(now - bioDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 30) base -= 20;
    else if (diffDays < 90) base -= 10;
    else if (diffDays > 365) base += 15;
    else if (diffDays > 730) base += 25;
  } else base += 10;

  if (metaBusiness) base -= 25;
  base = Math.max(10, Math.min(90, base));

  return Math.round(base / 10) * 10;
}

async function handleBioCheck(ctx, numbersToCheck) {
  // Cek koneksi WA lebih akurat: waClient harus ada DAN (status 'open' ATAU user sudah login)
  const isConnected = waClient && (waConnectionStatus === 'open' || waClient.user);
  if (!isConnected) {
    return ctx.reply(config.message.waNotConnected, { parse_mode: 'Markdown' });
  }

  if (!numbersToCheck || numbersToCheck.length === 0) {
    return ctx.reply(`Mana nomor yang mau dicek?`, { parse_mode: 'HTML' });
  }

  await ctx.reply(
    `⏳ Tunggu sebentar, bot sedang mengecek ${numbersToCheck.length} nomor...`,
    { parse_mode: 'HTML' }
  );

  let results = [];
  const jids = numbersToCheck.map(num => num.trim() + '@s.whatsapp.net');
  const existenceResults = await waClient.onWhatsApp(...jids);

  const registered = [];
  const notRegistered = [];

  existenceResults.forEach(res => {
    if (res.exists) registered.push(res.jid);
    else notRegistered.push(res.jid.split('@')[0]);
  });

  if (registered.length > 0) {
    const batchSize = 15;
    for (let i = 0; i < registered.length; i += batchSize) {
      const batch = registered.slice(i, i + batchSize);
      const promises = batch.map(async (jid) => {
        const number = jid.split('@')[0];
        try {
          const status = await waClient.fetchStatus(jid);
          const data = Array.isArray(status) ? status[0] : status;
          const bio = data?.status?.text || data?.status || null;
          const setAt = data?.setAt || null;

          const meta = await checkMetaBusiness(jid);
          const metaBusiness = meta.isBusiness;
          const jamPercentage = getJamPercentage(bio, setAt, metaBusiness);

          results.push({
            number,
            registered: true,
            bio,
            setAt,
            metaBusiness,
            jamPercentage
          });
        } catch (err) {
          results.push({ number, registered: false });
        }
      });

      await Promise.allSettled(promises);
      await delay(800);
    }
  }

  const timestamp = Date.now();
  const filename = `hasil_cekbio_${timestamp}.txt`;

  const withBio = results.filter(r => r.registered && r.bio);
  const noBio = results.filter(r => r.registered && !r.bio);
  const notReg = notRegistered;

  let fileContent = `📊 HASIL CEK BIO WHATSAPP\n`;
  fileContent += `===========================\n\n`;
  fileContent += `Total Nomor Dicek : ${numbersToCheck.length}\n`;
  fileContent += `Dengan Bio        : ${withBio.length}\n`;
  fileContent += `Tanpa Bio         : ${noBio.length}\n`;
  fileContent += `Tidak Terdaftar   : ${notReg.length}\n`;
  fileContent += `Tanggal Cek       : ${new Date().toLocaleString('id-ID')}\n`;
  fileContent += `===========================\n\n`;

  if (withBio.length > 0) {
    fileContent += `✅ NOMOR DENGAN BIO (${withBio.length})\n\n`;
    const groupedByYear = {};

    withBio.forEach(r => {
      const year = r.setAt ? new Date(r.setAt).getFullYear() : 'Tidak Diketahui';
      if (!groupedByYear[year]) groupedByYear[year] = [];
      groupedByYear[year].push(r);
    });

    Object.keys(groupedByYear)
      .sort()
      .forEach(year => {
        fileContent += `Tahun ${year}\n`;
        groupedByYear[year].forEach(r => {
          const dateStr = r.setAt
            ? new Date(r.setAt).toLocaleString('id-ID')
            : 'Tanggal tidak diketahui';
          fileContent += `\n📞 ${r.number}\n`;
          fileContent += `📝 ${r.bio}\n`;
          fileContent += `📅 ${dateStr}\n`;
          fileContent += `${r.metaBusiness ? '🏢 Meta Business\n' : '🚫 Bukan Business\n'}`;
          fileContent += `📮 ${r.jamPercentage}% Tidak Ngejam\n`;
        });
        fileContent += '\n';
      });

    fileContent += '----------------------------------------\n\n';
  }

  if (noBio.length > 0) {
    fileContent += `📵 NOMOR TANPA BIO (${noBio.length})\n\n`;
    noBio.forEach(r => {
      fileContent += `📞 ${r.number}\n`;
      fileContent += `${r.metaBusiness ? '🏢 Meta Business\n' : '🚫 Bukan Business\n'}`;
      fileContent += `📮 ${r.jamPercentage}% Tidak Ngejam\n\n`;
    });
  }

  if (notReg.length > 0) {
    fileContent += `🚫 NOMOR TIDAK TERDAFTAR (${notReg.length})\n\n`;
    notReg.forEach(num => {
      fileContent += `❌ ${num}\n`;
    });
  }

  fs.writeFileSync(filename, fileContent, 'utf8');

  await ctx.replyWithDocument(
    { source: filename },
    { caption: `📁 Nih hasil cek bio kamu (${numbersToCheck.length} nomor)`, parse_mode: 'HTML' }
  );

  fs.unlinkSync(filename);
}

const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

// ========================= AUTO SAVE USER PRIVATE =========================

bot.use(async (ctx, next) => {
  try {
    if (ctx.chat?.type === 'private') {
      const userId = ctx.from.id.toString();
      const userDBPath = path.join(__dirname, 'database', 'users.json');
      let users = [];

      try {
        if (fs.existsSync(userDBPath)) {
          users = JSON.parse(fs.readFileSync(userDBPath, 'utf8') || '[]');
        } else {
          fs.writeFileSync(userDBPath, JSON.stringify([]));
        }
      } catch (e) {
        console.error('⚠️ users.json rusak, dibuat ulang:', e.message);
        users = [];
        fs.writeFileSync(userDBPath, JSON.stringify([]));
      }

      if (!users.includes(userId)) {
        users.push(userId);
        fs.writeFileSync(userDBPath, JSON.stringify(users, null, 2));
        console.log(`✅ User baru disimpan otomatis: ${userId}`);
      }
    }
  } catch (err) {
    console.error('❌ Gagal auto-save user:', err.message);
  }

  await next();
});

//======================== FUNCTION START BOT ====================

async function startBot() {
  try {
    console.log(chalk.green("🚀 Memulai bot tanpa verifikasi token..."));

    if (typeof startWhatsAppClient === "function") {
      await startWhatsAppClient();
    }

    if (botLaunched) {
      console.log(chalk.yellow("⚠️ Bot Telegram sudah berjalan, skip launch ulang."));
      return;
    }

    if (bot && typeof bot.launch === "function") {
      await bot.launch();
      botLaunched = true;
      console.log(chalk.green("✅ Bot Telegram berhasil dijalankan!"));
      
      /*
      // Daftarkan commands ke Telegram agar muncul di menu "/"
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🏠 Menu utama bot' },
        { command: 'cekbio', description: '📱 Cek bio WhatsApp' },
        { command: 'info', description: '📊 Info akun & referral' },
        { command: 'cekid', description: '🆔 Cek ID Telegram' },
        { command: 'tourl', description: '🔗 Konversi media ke URL' },
        { command: 'fixred', description: '⚡ Banding WA (Premium)' },
      ]);
      
      // Commands khusus owner (private scope)
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🏠 Menu utama bot' },
        { command: 'cekbio', description: '📱 Cek bio WhatsApp' },
        { command: 'info', description: '📊 Info akun & referral' },
        { command: 'cekid', description: '🆔 Cek ID Telegram' },
        { command: 'tourl', description: '🔗 Konversi media ke URL' },
        { command: 'fixred', description: '⚡ Banding WA (Premium)' },
        { command: 'testemail', description: '📧 Test email config' },
        { command: 'pairing', description: '⚙️ Hubungkan WhatsApp' },
        { command: 'clearsesi', description: '🗑️ Reset session WA' },
        { command: 'broadcast', description: '📢 Broadcast ke semua user' },
        { command: 'totaluser', description: '👥 Total pengguna bot' },
        { command: 'listid', description: '📋 Daftar ID user' },
        { command: 'addprem', description: '➕ Tambah user premium' },
        { command: 'delprem', description: '➖ Hapus user premium' },
        { command: 'listprem', description: '📜 Daftar user premium' },
        { command: 'addowner', description: '👑 Tambah owner' },
        { command: 'delowner', description: '❌ Hapus owner' },
        { command: 'listowner', description: '👑 Daftar owner' },
      ], { scope: { type: 'chat', chat_id: config.ownerId } });
      */
      
      console.log(chalk.green("✅ Commands berhasil didaftarkan ke Telegram!"));
    }

    process.once("SIGINT", () => {
      console.log("⛔ SIGINT diterima, bot dimatikan...");
      bot.stop("SIGINT");
      botLaunched = false;
    });

    process.once("SIGTERM", () => {
      console.log("⛔ SIGTERM diterima, bot dimatikan...");
      bot.stop("SIGTERM");
      botLaunched = false;
    });

  } catch (e) {
    console.error("⚠️ Gagal menjalankan bot:", e.message || e);
  }
}

// ======================= INLINE MODE =======================

bot.on('inline_query', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const botUsername = ctx.botInfo.username;
  
  try {
    const results = [
      {
        type: 'article',
        id: 'share_bot',
        title: '🤖 Share Bot Ini',
        description: 'Ajak teman pakai bot keren ini',
        input_message_content: {
          message_text: `🤖 CEK BIO META BOT\n\n� Bot keren untuk:\n• Cek bio WhatsApp\n• Buat ID Card Telegram\n• Fix Merah WhatsApp\n• Upload file ke URL\n\n🔗 Coba sekarang: @${botUsername}\n\nby ffek`,
          parse_mode: 'HTML'
        }
      },
      {
        type: 'article',
        id: 'referral',
        title: '� Share Link Referral',
        description: 'Undang teman & dapat bonus!',
        input_message_content: {
          message_text: `🎁 Gabung Bot Keren Ini!\n\n📱 Fitur unggulan:\n• Cek bio WhatsApp massal\n• Generate ID Card Telegram\n• Fix akun WhatsApp banned\n• Dan masih banyak lagi!\n\n� Join sekarang:\nhttps://t.me/${botUsername}?start=ref_${userId}\n\nDiundang oleh ${userName}`,
          parse_mode: 'HTML'
        }
      }
    ];
    
    await ctx.answerInlineQuery(results, { cache_time: 10 });
    
  } catch (err) {
    console.error('Error inline query:', err);
  }
});
//======================== EMAIL SYSTEM (FIXRED/APPEAL) ====================

let emailTransporter = null;
let emailConfigured = false;
const appealCooldowns = new Map();

function initializeEmail() {
    if (!config.email || !config.email.user || !config.email.pass) {
        console.log('⚠️ Email belum dikonfigurasi di config.js');
        emailConfigured = false;
        return false;
    }
    try {
        emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.email.user,
                pass: config.email.pass
            }
        });
        emailConfigured = true;
        console.log('✅ Email system initialized');
        return true;
    } catch (error) {
        console.log('❌ Email initialization failed:', error.message);
        emailConfigured = false;
        return false;
    }
}

// Initialize email saat startup
initializeEmail();

async function sendAppealEmail(phoneNumber) {
    if (!emailConfigured) {
        console.log('❌ Email not configured');
        return false;
    }
    try {
        const mailOptions = {
            from: config.email.user,
            to: config.email.supportEmail || 'support@whatsapp.com',
            subject: '',
            text: phoneNumber
        };
        await emailTransporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('❌ ERROR KIRIM EMAIL:', error.message);
        return false;
    }
}

function checkAppealCooldown(userId) {
    const cooldown = appealCooldowns.get(userId);
    if (cooldown && Date.now() < cooldown) {
        return { onCooldown: true, timeLeft: cooldown - Date.now() };
    }
    return { onCooldown: false, timeLeft: 0 };
}

function setAppealCooldown(userId) {
    const cooldownTime = config.email?.cooldownTime || 60000;
    appealCooldowns.set(userId, Date.now() + cooldownTime);
}

// Command /fixred untuk banding WA
bot.command('fixred', async (ctx) => {
    const userId = ctx.from.id.toString();
    const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
    
    // Cek premium atau owner
    if (!isPremium(userId) && !isOwner(userId)) {
        return ctx.reply(
            `❌ Akses Ditolak!\n\nFitur /fixred hanya untuk user premium.\nHubungi owner untuk upgrade!`,
            { parse_mode: 'HTML' }
        );
    }
    
    // Cek email configured
    if (!emailConfigured) {
        return ctx.reply(
            `❌ Email Belum Dikonfigurasi!\n\nOwner bot belum mengkonfigurasi email.\nHubungi: ${USERNAME_OWNER}`,
            { parse_mode: 'HTML' }
        );
    }
    
    // Cek cooldown
    const cooldown = checkAppealCooldown(userId);
    if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.timeLeft / 1000);
        return ctx.reply(
            `⏰ Cooldown!\n\nTunggu ${seconds} detik lagi sebelum menggunakan fitur ini.`,
            { parse_mode: 'HTML' }
        );
    }
    
    // Cek format nomor
    if (!args) {
        return ctx.reply(
            `📝 Format Penggunaan:\n\n/fixred +628123456789\n\nMasukkan nomor WA dengan format internasional (+62...)`,
            { parse_mode: 'HTML' }
        );
    }
    
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(args)) {
        return ctx.reply(
            `❌ Format Nomor Salah!\n\nContoh: /fixred +628123456789`,
            { parse_mode: 'HTML' }
        );
    }
    
    // Kirim email
    const loadingMsg = await ctx.reply(`⏳ Mengirim banding untuk ${args}...`, { parse_mode: 'HTML' });
    
    try {
        const success = await sendAppealEmail(args);
        
        if (success) {
            setAppealCooldown(userId);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMsg.message_id,
                null,
                `✅ Banding Terkirim!\n\n📞 Nomor: ${args}\n⏳ Tunggu 1-2 menit untuk proses.\n\nby ffek APPEAL`,
                { parse_mode: 'HTML' }
            );
        } else {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMsg.message_id,
                null,
                `❌ Gagal Mengirim!\n\nSilakan coba lagi nanti atau hubungi owner.`,
                { parse_mode: 'HTML' }
            );
        }
    } catch (error) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            null,
            `❌ Error System!\n\nTerjadi kesalahan. Coba lagi nanti.`,
            { parse_mode: 'HTML' }
        );
    }
});

// Owner command: Set email
bot.command('setemail', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) {
        return ctx.reply('❌ Khusus Owner!');
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply(
            `📧 Set Email Config\n\nFormat:\n/setemail email@gmail.com app_password\n\nApp password bisa didapat dari Google Account Settings`,
            { parse_mode: 'HTML' }
        );
    }
    
    const [email, ...passParts] = args;
    const password = passParts.join(' ');
    
    // Update config (note: perlu restart bot untuk apply)
    ctx.reply(
        `⚠️ Untuk mengubah email config:\n\nEdit file config.js:\n\nemail: {\n  user: "${email}",\n  pass: "${password}"\n}\n\nLalu restart bot.`,
        { parse_mode: 'HTML' }
    );
});

bot.command('addgmail', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply('❌ Khusus Owner!');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ Format: `/addgmail email@gmail.com`', { parse_mode: 'Markdown' });

    const newEmail = args[1];

    try {
        const configPath = path.join(__dirname, 'config.js');
        let content = fs.readFileSync(configPath, 'utf8');

        // Regex targeting the specific structure inside config.js
        // Matches: user: "..."
        // We assume 'user' property is unique or we rely on the first match which is likely the email user
        if (content.includes('user: "')) {
            content = content.replace(/(user:\s*")([^"]+)(")/, `$1${newEmail}$3`);
            fs.writeFileSync(configPath, content, 'utf8');
            
            // Update runtime memory
            if (config.email) config.email.user = newEmail;
            
            // Re-initialize email transporter
            initializeEmail();
            
            ctx.reply(`✅ **Email Updated**\nUser: \`${newEmail}\`\nStatus: ${emailConfigured ? '🟢 Connected' : '🔴 Error'}`, { parse_mode: 'Markdown' });
        } else {
            ctx.reply('❌ Could not find "user" field in config.js');
        }
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Request failed: ' + err.message);
    }
});

bot.command('addapp', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply('❌ Khusus Owner!');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ Format: `/addapp app_password`', { parse_mode: 'Markdown' });

    // Ambil semua argumen, gabungkan tanpa spasi (karena app password tidak boleh ada spasi di config)
    const newPass = args.slice(1).join('');

    try {
        const configPath = path.join(__dirname, 'config.js');
        let content = fs.readFileSync(configPath, 'utf8');

        // Regex match for pass: "..."
        if (content.includes('pass: "')) {
            content = content.replace(/(pass:\s*")([^"]+)(")/, `$1${newPass}$3`);
            fs.writeFileSync(configPath, content, 'utf8');
            
            // Update runtime memory
            if (config.email) config.email.pass = newPass;

            // Re-initialize email transporter
            initializeEmail();

            ctx.reply(`✅ **App Password Updated**\nPass: \`${newPass}\`\nStatus: ${emailConfigured ? '🟢 Connected' : '🔴 Error'}`, { parse_mode: 'Markdown' });
        } else {
            ctx.reply('❌ Could not find "pass" field in config.js');
        }
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Request failed: ' + err.message);
    }
});

// Test email command
bot.command('testemail', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) {
        return ctx.reply('❌ Khusus Owner!');
    }
    
    if (!emailConfigured) {
        return ctx.reply(
            `❌ Email Belum Dikonfigurasi!\n\nEdit email config di config.js`,
            { parse_mode: 'HTML' }
        );
    }
    
    try {
        await emailTransporter.verify();
        ctx.reply(
            `✅ Email Test Berhasil!\n\n📧 Email: ${config.email.user}\n🔑 Status: 🟢 Terhubung`,
            { parse_mode: 'HTML' }
        );
    } catch (error) {
        ctx.reply(
            `❌ Email Test Gagal!\n\n📧 Email: ${config.email.user}\n🔴 Error: ${error.message}`,
            { parse_mode: 'HTML' }
        );
    }
});

//======================== COMMAND FITUR ====================

bot.command('start', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const wakturun = getUptime();
  const refData = loadRefs();
  const CHANNEL_ID = config.channelId;
  const GROUP_ID = config.groupId;
  
  const startPayload = ctx.message.text.split(' ')[1];
  if (startPayload && startPayload.startsWith('ref_')) {
    const referrerId = startPayload.replace('ref_', '');
    if (referrerId !== userId) {
      if (!refData[referrerId]) refData[referrerId] = { invited: [], bonusChecks: 0, totalInvited: 0 };

      if (!refData[referrerId].invited.includes(userId)) {
        refData[referrerId].invited.push(userId);
        saveRefs(refData);
        console.log(`✅ ${userId} berhasil jadi referral untuk ${referrerId}`);

        try {
          await ctx.telegram.sendMessage(
            referrerId,
            `📢 Kabar Baik!\n👤 ${userName} baru saja join menggunakan link referral kamu 🎉`,
            { parse_mode: 'HTML' }
          );
        } catch (err) {
          console.warn(`⚠️ Gagal kirim notif ke ${referrerId}:`, err.message);
        }
      }
    }
  }
  
  // Skip member check - langsung tampilkan menu
  const caption = `━━━━━━━━━━━━━━━━━━━━━
        ✦ ${config.settings.namabot.toUpperCase()} ✦
━━━━━━━━━━━━━━━━━━━━━

Hai, ${userName}!

Bot untuk cek bio WhatsApp dengan
cepat, akurat, dan mudah digunakan.

┌─────────────────────
│ User Info
├─────────────────────
│ ◈ ID: ${userId}
│ ◈ Uptime: ${wakturun}
│ ◈ Version: v${VERSION}
└─────────────────────

${config.settings.footer}`;

  try {
    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            { text: '⚙️ Admin Panel', callback_data: 'owner' },
            { text: '📱 WhatsApp', callback_data: 'whatsapp' }
          ],
          [
            { text: '📦 Lainnya', callback_data: 'more' },
            { text: '💬 Developer', url: `https://t.me/${USERNAME_OWNER.replace('@', '')}` }
          ],
          [
            { text: '📢 Channel', url: `https://t.me/${config.channelId.replace('@', '')}` }
          ]
        ])
      }
    );
    await ctx.replyWithAudio(
      { source: './database/notif.mp3' },
    {
      title: 'Welcome',
      performer: config.settings.namabot,
      caption: '🎵 Welcome Music',
      }
    );
  } catch (err) {
    console.error('Error menampilkan menu:', err);
    ctx.reply('⚠️ Terjadi kesalahan.');
  }
});

bot.action('owner', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption: `━━━━━━━━━━━━━━━━━━━━━
        ⚙️ ADMIN PANEL ⚙️
━━━━━━━━━━━━━━━━━━━━━

◈ Connection
├ /pairing → Hubungkan WhatsApp
└ /clearsesi → Reset session

◈ Broadcast
├ /broadcast → Kirim ke semua user
├ /totaluser → Lihat total pengguna
└ /listid → Daftar semua ID

◈ Premium Management
├ /addprem → Tambah premium
├ /delprem → Hapus premium
└ /listprem → Daftar premium

◈ Owner Management
├ /addowner → Tambah owner
├ /delowner → Hapus owner
└ /listowner → Daftar owner

${config.settings.footer}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [{ text: '◀️ Kembali ke Menu', callback_data: 'back_to_start' }]
        ])
      }
    );
  } catch (err) {
    console.error('Error di owner menu:', err);
  }
});

bot.action('whatsapp', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption: `━━━━━━━━━━━━━━━━━━━━━
       📱 WHATSAPP TOOLS 📱
━━━━━━━━━━━━━━━━━━━━━

◈ Fitur Utama
├ /cekbio 628xxx
│   → Cek bio nomor WhatsApp
│
├ /info
│   → Informasi tentang cek bio
│
└ /fixred
    → Banding WA (Premium)

◈ Tips
Kirim file .txt berisi daftar nomor
untuk cek bio secara massal.

${config.settings.footer}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [{ text: '◀️ Kembali ke Menu', callback_data: 'back_to_start' }]
        ])
      }
    );
  } catch (err) {
    console.error('Error di whatsapp menu:', err);
  }
});

bot.action('more', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption: `━━━━━━━━━━━━━━━━━━━━━
       📦 FITUR LAINNYA 📦
━━━━━━━━━━━━━━━━━━━━━

◈ Utilities
├ /cekid
│   → Cek ID Telegram kamu
│
├ /tourl
│   → Konversi media ke URL
│
└ /myinfo
    → Lihat info akun kamu

◈ Referral
├ /referral
│   → Dapatkan link referral
│
└ /mystats
    → Statistik referral kamu

${config.settings.footer}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [{ text: '◀️ Kembali ke Menu', callback_data: 'back_to_start' }]
        ])
      }
    );
  } catch (err) {
    console.error('Error di more menu:', err);
  }
});

bot.action('back_to_start', async (ctx) => {
  try {
    await ctx.deleteMessage();
    const userId = ctx.from.id.toString();
    const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const wakturun = getUptime();

    const caption = `━━━━━━━━━━━━━━━━━━━━━
        ✦ ${config.settings.namabot.toUpperCase()} ✦
━━━━━━━━━━━━━━━━━━━━━

Hai, ${userName}!

Bot untuk cek bio WhatsApp dengan
cepat, akurat, dan mudah digunakan.

┌─────────────────────
│ User Info
├─────────────────────
│ ◈ ID: ${userId}
│ ◈ Uptime: ${wakturun}
│ ◈ Version: v${VERSION}
└─────────────────────

${config.settings.footer}`;

    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            { text: '⚙️ Admin Panel', callback_data: 'owner' },
            { text: '📱 WhatsApp', callback_data: 'whatsapp' }
          ],
          [
            { text: '📦 Lainnya', callback_data: 'more' },
            { text: '💬 Developer', url: `https://t.me/${USERNAME_OWNER.replace('@', '')}` }
          ],
          [
            { text: '📢 Channel', url: `https://t.me/${config.channelId.replace('@', '')}` }
          ]
        ])
      }
    );
  } catch (err) {
    console.error('Error di back_to_start:', err);
  }
});

// ======================= 𝙼𝙴𝙽𝚄 𝙾𝚆𝙽𝙴𝚁 =======================

bot.command('pairing', checkAccess('owner'), async (ctx) => {
    const phoneNumber = ctx.message.text.split(' ')[1]?.replace(/[^0-9]/g, '');
    if (!phoneNumber) return ctx.reply(`Formatnya Salah Idiot.\nContoh: /pairing 628×××...`, {
      parse_mode: "HTML"
    });
    
    if (!waClient) return ctx.reply(`Koneksi WA lagi down, sabar bentar.`, {
      parse_mode: "HTML"
    });
    
    try {
        await ctx.reply(`Menunggu kode pairing...`, {
          parse_mode: "HTML"
        });
        
        const code = await waClient.requestPairingCode(phoneNumber);
        await ctx.reply(`📲 Kode Pairing: ${code}\nMasukin di WA lu:\nTautkan Perangkat ═⪼ Tautkan dengan nomor telepon`, {
          parse_mode: 'HTML'
        });
    } catch (e) {
        console.error("Gagal pairing:", e);
        await ctx.reply(`Gagal minta pairing code, Coba lagi ntar.`, {
          parse_mode: "HTML"
        });
    }
});

bot.command('pairingqr', checkAccess('owner'), async (ctx) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id; // Bisa private atau group
  const phoneNumber = ctx.message.text.split(' ')[1]?.replace(/[^0-9]/g, '');
  
  if (!phoneNumber) {
    return ctx.reply(`⚠️ Format salah!\n\nContoh: /pairingqr 628xxxxxxxxxx`, {
      parse_mode: "HTML"
    });
  }
  
  try {
    // Clear session dulu untuk generate QR baru
    const sessionDir = path.join(__dirname, 'session');
    
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('🗑️ Session dihapus untuk generate QR baru');
    }
    
    // Set requester - simpan chat ID (bukan user ID) supaya bisa kirim ke grup juga
    qrRequesterId = chatId;
    currentQR = null;
    
    await ctx.reply(`⏳ Memulai proses pairing QR...\n\n📱 Nomor: ${phoneNumber}\n\nSession lama dihapus. QR code akan dikirim dalam beberapa detik.\n\n� Siapkan WhatsApp kamu:\nPengaturan → Perangkat Tertaut → Tautkan Perangkat`, {
      parse_mode: 'HTML'
    });
    
    // Restart WhatsApp client untuk generate QR
    if (waClient) {
      try {
        waClient.ev.removeAllListeners();
        waClient.ws.close();
      } catch (e) {}
      waClient = null;
    }
    
    isReconnecting = false;
    reconnectAttempts = 0;
    
    // Start ulang untuk generate QR
    await startWhatsAppClient();
    
    // Timeout untuk reset requester
    setTimeout(() => {
      if (qrRequesterId === chatId) {
        qrRequesterId = null;
        console.log('⏱️ QR request timeout, reset requester');
      }
    }, 120000); // 2 menit timeout
    
  } catch (err) {
    console.error('Error pairingqr:', err);
    await ctx.reply(`❌ Gagal generate QR: ${err.message}`, {
      parse_mode: 'HTML'
    });
  }
});

bot.command('clearsesi', async (ctx) => {
  const userId = ctx.from.id.toString();
  const sessionDir = path.join(__dirname, 'session');

  if (!isOwner(userId)) {
    return ctx.reply(`🚫 Hanya owner yang bisa menjalankan perintah ini.`, {
      parse_mode: "HTML"
    });
  }

  try {
    // Backup roles.json sebelum restart untuk mencegah data hilang
    const rolesBackupPath = path.join(__dirname, 'database', 'roles_backup.json');
    if (fs.existsSync(dataFile)) {
      fs.copyFileSync(dataFile, rolesBackupPath);
      console.log('✅ Backup roles.json dibuat sebelum clear session');
    }

    // Hapus folder session jika ada, lalu buat ulang (tidak perlu error jika tidak ada)
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });

    await ctx.reply(
      `🧹 Semua file di folder session sudah dihapus.\n\n` +
      `🔄 Bot akan restart otomatis dalam 3 detik...`,
      { parse_mode: 'HTML' }
    );

    setTimeout(() => {
      console.log('🔁 Restarting bot by owner command...');
      try {
        exec('pm2 restart all || npm restart || node .', (err, stdout, stderr) => {
          if (err) {
            console.error('❌ Gagal restart bot:', err.message);
          } else {
            console.log('✅ Bot berhasil direstart oleh owner.');
          }
        });
      } catch (err) {
        console.error('⚠️ Gagal menjalankan perintah restart:', err.message);
      }
    }, 3000);

  } catch (err) {
    console.error('⚠️ Error saat hapus session:', err);
    ctx.reply('⚠️ Terjadi kesalahan saat menghapus file session.');
  }
});

bot.command('broadcast', async (ctx) => {
  const userId = ctx.from.id.toString();

  if (!isOwner(userId)) {
    return ctx.reply(`🚫 Hanya owner yang bisa menjalankan perintah ini.`, {
      parse_mode: "HTML"
    });
  }

  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text) {
    return ctx.reply(`⚠️ Gunakan format:\n\n/broadcast pesan yang ingin dikirim`, {
      parse_mode: 'HTML'
    });
  }

  const users = loadUsers();
  if (users.length === 0) {
    return ctx.reply(`📭 Belum ada user private yang tercatat.`, {
      parse_mode: "HTML"
    });
  }

  await ctx.reply(`📢 Mengirim broadcast ke ${users.length} user...\nTunggu sebentar ⏳`, {
    parse_mode: 'HTML'
  });

  let success = 0;
  let failed = 0;

  for (const id of users) {
    try {
      await ctx.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
      success++;
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      failed++;
      console.log(`Gagal kirim ke ${id}:`, err.message);
    }
  }

  return ctx.reply(
    `✅ Broadcast selesai!\n\n📨 Terkirim: ${success}\n❌ Gagal: ${failed}`,
    { parse_mode: 'HTML' }
  );
});

bot.command('totaluser', async (ctx) => {
  const userId = ctx.from.id.toString();

  if (!isOwner(userId)) {
    return ctx.reply(`🚫 Hanya owner yang bisa menjalankan perintah ini.`, {
      parse_mode: "HTML"
    });
  }

  try {
    const userDBPath = path.join(__dirname, 'database', 'users.json');
    if (!fs.existsSync(userDBPath)) {
      fs.writeFileSync(userDBPath, JSON.stringify([]));
    }

    const users = JSON.parse(fs.readFileSync(userDBPath, 'utf8') || '[]');
    const total = users.length;

    return ctx.reply(
      `📊 Total Pengguna Bot\n\n👤 Jumlah User: ${total}`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Gagal ambil total user:', err);
    return ctx.reply('⚠️ Terjadi kesalahan saat menghitung total user.');
  }
});

bot.command("listid", async (ctx) => {
  const fromId = ctx.from.id.toString();
  if (!isOwner(fromId))
    return ctx.reply("🚫 Hanya owner yang bisa melihat total ID!", { parse_mode: "HTML" });

  const users = loadUsers();

  if (users.length === 0)
    return ctx.reply("📭 Belum ada user terdaftar.", { parse_mode: "HTML" });

  const { text, buttons } = generateUserList(users, 1);

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.command("addprem", async (ctx) => {
  const fromId = ctx.from.id.toString();
  if (!isOwner(fromId)) return ctx.reply("🚫 Hanya owner yang bisa menjalankan perintah ini.!", {
    parse_mode: "HTML"
  });

  const args = ctx.message.text.split(" ").slice(1);
  const targetId = args[0];
  const durasi = args[1];

  if (!targetId || !durasi)
    return ctx.reply(
      "⚠️ Gunakan format:\n/addprem user_id durasi\n\n🧩 Contoh:\n/addprem 12345678 7d\n/addprem 12345678 1m\n/addprem 12345678 p",
      { parse_mode: "HTML" }
    );

  const expireAt = parseDuration(durasi);
  if (!expireAt) return ctx.reply(`⚠️ Durasi tidak valid! Gunakan d/w/m/p.`, {
    parse_mode: "HTML"
  });

  roleData.premiums = roleData.premiums.filter(p => p.id !== targetId);

  roleData.premiums.push({ id: targetId, expireAt, startAt: Date.now() });
  saveRoles();

  const waktu = formatDuration(expireAt);

  await ctx.reply(`✨ User ${targetId} sekarang Premium selama ${waktu}!`, { parse_mode: "HTML" });

  try {
    await ctx.telegram.sendMessage(
      targetId,
      `🎉 Selamat!\nAnda telah menjadi Premium User!\n\n🕒 Waktu aktif: ${waktu}\n\nSelamat menggunakan layanan bot kami 🚀`,
      { parse_mode: "HTML" }
    );
  } catch {
    ctx.reply("⚠️ Tidak bisa kirim pesan ke user (mungkin belum start bot).");
  }
});

bot.command("delprem", async (ctx) => {
  const fromId = ctx.from.id.toString();
  if (!isOwner(fromId)) return ctx.reply(`🚫 Hanya owner yang bisa menghapus user premium.`, {
    parse_mode: "HTML"
  });

  const args = ctx.message.text.split(" ").slice(1);
  const targetId = args[0];

  if (!targetId)
    return ctx.reply(
      "⚠️ Gunakan format:\n/delprem user_id\n\n🧩 Contoh:\n/delprem 12345678",
      { parse_mode: "HTML" }
    );

  const before = roleData.premiums.length;
  roleData.premiums = roleData.premiums.filter(p => p.id !== targetId);
  saveRoles();

  if (roleData.premiums.length === before)
    return ctx.reply(`❌ User ${targetId} tidak ditemukan di daftar premium.`, { parse_mode: "HTML" });

  ctx.reply(`✅ User ${targetId} telah dihapus dari daftar Premium.`, { parse_mode: "HTML" });
});

bot.command("listprem", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId))
    return ctx.reply("🚫 Hanya owner yang bisa melihat daftar Premium!", { parse_mode: "HTML" });

  const data = roleData.premiums.filter(p => !isExpired(p.expireAt));
  if (data.length === 0)
    return ctx.reply("📭 Belum ada user Premium aktif.", { parse_mode: "HTML" });

  const { text, buttons } = generatePagedList(data, 1, "premium");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.command("addowner", async (ctx) => {
  const fromId = ctx.from.id.toString();

  if (!isOwner(fromId)) return ctx.reply("🚫 Hanya owner yang bisa menjalankan perintah ini!", {
    parse_mode: "HTML"
  });

  const args = ctx.message.text.split(/\s+/).slice(1);
  const targetId = args[0];
  const durasi = args[1];

  if (!targetId || !durasi)
    return ctx.reply(
      "⚠️ Gunakan format:\n/addowner user_id durasi\n\n🧩 Contoh:\n/addowner 12345678 7d\n/addowner 12345678 1m\n/addowner 12345678 p",
      { parse_mode: "HTML" }
    );
  
  // Validasi ID harus angka
  if (!/^\d+$/.test(targetId)) {
      return ctx.reply("⚠️ ID tidak valid!\nHarus berupa angka (User ID), bukan username.\n\nMinta user ketik /cekid untuk melihat ID mereka.", { parse_mode: "HTML" });
  }

  const expireAt = parseDuration(durasi);
  if (!expireAt) return ctx.reply("⚠️ Durasi tidak valid! Gunakan d/w/m/p.");

  roleData.owners = roleData.owners.filter(o => o.id !== targetId);
  roleData.owners.push({ id: targetId, expireAt, startAt: Date.now() });
  saveRoles();

  const waktu = formatDuration(expireAt);

  await ctx.reply(`✅ User ${targetId} berhasil jadi *Owner* selama ${waktu}!`, { parse_mode: "HTML" });

  try {
    await ctx.telegram.sendMessage(
      targetId,
      `👑 Selamat!\nAnda telah menjadi Owner Bot!\n\n🕒 Waktu aktif: ${waktu}\n\nSelamat menikmati fitur eksklusif kami 🙌`,
      { parse_mode: "HTML" }
    );
  } catch {
    ctx.reply("⚠️ Tidak bisa kirim pesan ke user (mungkin belum start bot).", {
      parse_mode: "HTML"
    });
  }
});

bot.command("delowner", async (ctx) => {
  const fromId = ctx.from.id.toString();

  if (!isOwner(fromId))
    return ctx.reply("🚫 Hanya owner yang bisa menjalankan perintah ini!", {
    parse_mode: "HTML"
  });

  const args = ctx.message.text.split(" ").slice(1);
  const targetId = args[0];

  if (!targetId)
    return ctx.reply(
      "⚠️ Gunakan format:\n/delowner user_id\n\n🧩 Contoh:\n/delowner 12345678",
      { parse_mode: "HTML" }
    );

  const before = roleData.owners.length;
  roleData.owners = roleData.owners.filter(o => o.id !== targetId);
  saveRoles();

  if (roleData.owners.length === before)
    return ctx.reply(`❌ User ${targetId} tidak ditemukan di daftar owner.`, { parse_mode: "HTML" });

  ctx.reply(`✅ User ${targetId} telah dihapus dari daftar Owner.`, { parse_mode: "HTML" });
});

bot.command("listowner", async (ctx) => {
  const userId = ctx.from.id.toString();

  if (!isOwner(userId))
    return ctx.reply("🚫 Hanya owner yang bisa melihat daftar Owner!", { parse_mode: "HTML" });

  const data = roleData.owners.filter(o => !isExpired(o.expireAt));
  if (data.length === 0)
    return ctx.reply("📭 Belum ada owner tambahan aktif.", { parse_mode: "HTML" });

  const { text, buttons } = generatePagedList(data, 1, "owner");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
});

// ======================= 𝙼𝙴𝙽𝚄 𝚆𝙷𝙰𝚃𝚂𝙰𝙿𝙿 =======================

bot.command('info', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
  const refData = loadRefs();

  if (!refData[userId]) {
    refData[userId] = { invited: [], bonusChecks: 0, totalInvited: 0 };
    saveRefs(refData);
  }

  const ownerData = roleData.owners.find(o => o.id === userId && !isExpired(o.expireAt));
  const premiumData = roleData.premiums.find(p => p.id === userId && !isExpired(p.expireAt));

  const ownerStatus = ownerData ? getDurationText(ownerData.expireAt, ownerData.startAt) : "NON OWNER";
  const premiumStatus = premiumData ? getDurationText(premiumData.expireAt, premiumData.startAt) : "NON PREMIUM";

  const userRef = refData[userId];
  const referralLink = `https://t.me/${ctx.botInfo.username}?start=ref_${userId}`;

  const sisaBonus = userRef.bonusChecks;
  const jumlahUndangan = userRef.invited.length;
  const totalKlaim = userRef.totalInvited;

  const caption = `━━━━━━━━━━━━━━━━━━━━━
    📊 INFORMASI AKUN 📊
━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────
│ Profile
├─────────────────────
│ ◈ Nama: ${userName}
│ ◈ ID: ${userId}
│ ◈ Premium: ${premiumStatus}
│ ◈ Owner: ${ownerStatus}
└─────────────────────

┌─────────────────────
│ Referral Stats
├─────────────────────
│ ◈ Bonus Tersisa: ${sisaBonus}x
│ ◈ Total Undangan: ${jumlahUndangan}
│ ◈ Bonus Diklaim: ${totalKlaim}
└─────────────────────

Link Referral:
${referralLink}

Undang 5 teman = 5x cek 150 nomor!

${config.settings.footer}`;

  try {
    await ctx.replyWithPhoto(
      { source: './database/levinz.jpg' },
      {
        caption,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📤 Share Referral', switch_inline_query: referralLink }
            ],
            [
              { text: '💬 Hubungi Developer', url: `https://t.me/${config.usernameOwner.replace('@', '')}` }
            ]
          ]
        }
      }
    );
  } catch (err) {
    console.error('Error kirim info:', err);
    ctx.reply(
      `⚠️ Terjadi kesalahan saat menampilkan info akunmu.`,
      { parse_mode: 'HTML' }
    );
  }
});

bot.command('cekbio', async (ctx) => {
  const userId = ctx.from.id.toString();
  const refData = loadRefs();

  if (!refData[userId]) {
    refData[userId] = { invited: [], bonusChecks: 0, totalInvited: 0 };
  }

  const isOwn = isOwner(userId);
  const isPrem = isPremium(userId);
  const now = Date.now();
  const cooldownTime = 5 * 60 * 1000;

  try {

    if (!isOwn && !isPrem) {
      if (cooldowns[userId] && now - cooldowns[userId] < cooldownTime) {
        const remaining = cooldownTime - (now - cooldowns[userId]);
        const minutes = Math.ceil(remaining / 60000);
        return ctx.reply(
          `⏳ Tunggu ${minutes} menit sebelum pakai /cekbio lagi.`,
          { parse_mode: "HTML" }
        );
      }
    }

    if (!isOwn && !isPrem) {
      let notJoined = [];

      if (CHANNEL_ID) {
        try {
          const channelMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
          if (['left', 'kicked'].includes(channelMember.status)) {
            notJoined.push({ name: 'Channel', url: `https://t.me/${CHANNEL_ID.replace('@', '')}` });
          }
        } catch (e) {
            // Ignore error if bot isn't admin or channel invalid
        }
      }

      if (GROUP_ID) {
        try {
          const groupMember = await ctx.telegram.getChatMember(GROUP_ID, userId);
          if (['left', 'kicked'].includes(groupMember.status)) {
            notJoined.push({ name: 'Group', url: `https://t.me/${GROUP_ID.replace('@', '')}` });
          }
        } catch (e) {
            // Ignore error
        }
      }

      if (notJoined.length > 0) {
        const buttons = notJoined.map(i => ({ text: `Join ${i.name}`, url: i.url }));
        let msg = `🚫 Kamu belum join semua tempat wajib!\n`;
        notJoined.forEach(i => {
           msg += `👉 ${i.name}\n`; 
        });
        msg += ``;
        
        return ctx.reply(msg, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [buttons] }
        });
      }
    }

    if (!isOwn && !isPrem) {
      const invitedCount = refData[userId]?.invited?.length || 0;
      const usedBonuses = refData[userId].totalInvited;

      if (invitedCount >= usedBonuses + 5) {
        refData[userId].bonusChecks += 5;
        refData[userId].totalInvited += 5;
        saveRefs(refData);

        await ctx.reply(
          `🎉 Selamat! Kamu telah mengundang ${invitedCount} orang.
🎁 Dapat 5x kesempatan cek 150 nomor!`,
          { parse_mode: "HTML" }
        );
      }

      if (invitedCount < 5 && refData[userId].bonusChecks <= 0) {
        const referralLink = `https://t.me/${ctx.botInfo.username}?start=ref_${userId}`;
        return ctx.reply(
          `🚫 Kamu baru mengundang ${invitedCount} orang.
Untuk memakai fitur ini, undang minimal 5 orang dulu.
🔗 Link Undanganmu: ${referralLink}`,
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      }
    }

    let textSource = ctx.message.text;
    
    // Support reply message
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
        textSource += " " + ctx.message.reply_to_message.text;
    }
    
    const numbersToCheck = textSource.match(/\d+/g)?.map(n => n.toString()) || [];
    
    // Filter command part manually if needed, but regex \d+ is usually fine 
    // (except if command contains numbers, e.g. /cek123)
    // cleaning command from first match if it starts with slash
    if (ctx.message.text.startsWith('/')) {
        const commandParams = ctx.message.text.split(' ').slice(1).join(' ');
        const replyText = ctx.message.reply_to_message?.text || "";
        const combined = commandParams + " " + replyText;
        const validNumbers = combined.match(/\d+/g) || [];
        
        // Use filtered numbers
        // NOTE: We need to update the variable
        numbersToCheck.length = 0; // Clear array
        validNumbers.forEach(n => numbersToCheck.push(n));
    }

    console.log(`DEBUG: User ${userId} checking ${numbersToCheck.length} numbers:`, numbersToCheck.slice(0, 5));
    const jumlahNomor = numbersToCheck.length;

    if (jumlahNomor === 0) {
      return ctx.reply(`⚠️ Masukkan nomor yang ingin dicek.`, { parse_mode: "HTML" });
    }

    let maxNumbers = 80;
    let pakaiBonus = false;

    if (isOwn || isPrem) {
      maxNumbers = 9999;
    } else if (refData[userId].bonusChecks > 0) {
      maxNumbers = 150;
    }

    if (jumlahNomor > maxNumbers) {
      return ctx.reply(
        `⚠️ Maksimal ${maxNumbers} nomor yang bisa dicek.`,
        { parse_mode: "HTML" }
      );
    }

    if (!isOwn && !isPrem) cooldowns[userId] = now;

    const result = await handleBioCheck(ctx, numbersToCheck);

    if (!isOwn && !isPrem && jumlahNomor > 80 && refData[userId].bonusChecks > 0) {
      refData[userId].bonusChecks -= 1;
      saveRefs(refData);
      pakaiBonus = true;
    }

    const msg = pakaiBonus
      ? `✅ Cek ${jumlahNomor} nomor selesai!\n📊 Sisa bonus cek 150 nomor: ${refData[userId].bonusChecks}`
      : `✅ Cek ${jumlahNomor} nomor selesai!`;

    await ctx.reply(msg, { parse_mode: "HTML" });

    if (!isOwn && !isPrem) setTimeout(() => delete cooldowns[userId], cooldownTime);

  } catch (err) {
    console.error('Error cekbio:', err);
    return ctx.reply(
      `⚠️ Terjadi kesalahan saat memeriksa nomor.\n🔁 Bonus kamu tidak berkurang.`,
      { parse_mode: "HTML" }
    );
  }
});



// ======================= 𝙼𝙴𝙽𝚄 𝙼𝙾𝚁𝙴 =======================

const cekidHandler = require('./cekid_handler');
bot.command('cekid', cekidHandler);

bot.command('tourl', async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    if (['left', 'kicked'].includes(member.status)) {
      return ctx.reply(
        `🚫 Kamu harus join channel official dulu supaya bisa pakai fitur ini.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [{ text: '📢 Channel Official', url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }]
          ])
        }
      );
    }

    const reply = ctx.message.reply_to_message;
    if (!reply)
      return ctx.reply(`❌ Balas pesan yang berisi file/audio/video dengan perintah /tourl.`, { parse_mode: 'HTML' });

    let fileId, filename;
    if (reply.document) {
      fileId = reply.document.file_id;
      filename = reply.document.file_name;
    } else if (reply.photo) {
      fileId = reply.photo[reply.photo.length - 1].file_id;
      filename = 'photo.jpg';
    } else if (reply.video) {
      fileId = reply.video.file_id;
      filename = reply.video.file_name || 'video.mp4';
    } else if (reply.audio) {
      fileId = reply.audio.file_id;
      filename = reply.audio.file_name || 'audio.mp3';
    } else if (reply.voice) {
      fileId = reply.voice.file_id;
      filename = 'voice.ogg';
    } else {
      return ctx.reply(`❌ Pesan yang kamu balas tidak mengandung file/audio/video yang bisa diupload.`, { parse_mode: 'HTML' });
    }

    const link = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(link.href);
    const fileBuffer = Buffer.from(await res.arrayBuffer());

    const catboxUrl = await uploadToCatbox(fileBuffer, filename);

    await ctx.reply(
      `✅ File berhasil diupload ke Catbox:\n${catboxUrl}`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error(err);
    ctx.reply(`❌ Gagal upload file: ${err.message}`, { parse_mode: 'HTML' });
  }
});

// ======================= CALLBACK =======================

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data) return;

  const menuPrefixes = [
    "owner", "whatsapp", "more", "back_to_start"
  ];
  if (menuPrefixes.some(p => data.startsWith(p))) return;

  try {

    if (data.startsWith("users_")) {
      const match = data.match(/users_page_(\d+)/);
      if (!match) return;
      const page = parseInt(match[1]);
      const users = loadUsers();
      const { text, buttons } = generateUserList(users, page);

      return await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    }
 
    if (data.startsWith("premium_")) {
      const match = data.match(/premium_page_(\d+)/);
      if (!match) return;
      const page = parseInt(match[1]);
      const list = roleData.premiums.filter(p => !isExpired(p.expireAt));
      const { text, buttons } = generatePagedList(list, page, "premium");

      return await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    }
 
    if (data.startsWith("owner_")) {
      const match = data.match(/owner_page_(\d+)/);
      if (!match) return;
      const page = parseInt(match[1]);
      const list = roleData.owners.filter(o => !isExpired(o.expireAt));
      const { text, buttons } = generatePagedList(list, page, "owner");

      return await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    }

  } catch (err) {
    console.error("❌ Error callback:", err);
  }

  await ctx.answerCbQuery();
});

// ======================= SCHEDULED TASKS =======================

setInterval(() => {
  console.log('🕐 Menjalankan auto-backup rutin...');
  autoBackup();
}, 1000 * 60 * 60 * 6);

// ======================= MAIN START =======================

(async () => {
    showBanner();
    // autoBackup();
    await startBot();
    await syncReferralBonuses();
    
    // Daftarkan semua command ke Telegram supaya muncul di autocomplete
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: '🏠 Menu utama bot' },
        { command: 'info', description: '📊 Info akun & referral' },
        { command: 'cekbio', description: '📱 Cek bio WhatsApp nomor' },
        { command: 'fixred', description: '⚡ Banding WA (Premium)' },

        { command: 'cekid', description: '🪪 Buat ID Card Telegram' },
        { command: 'tourl', description: '🔗 Upload file ke URL' },
        { command: 'testemail', description: '📧 Test email config (Owner)' },
        { command: 'addgmail', description: '📧 Set email user config (Owner)' },
        { command: 'addapp', description: '🔑 Set app password config (Owner)' },
        { command: 'pairing', description: '🔌 Pairing WA dengan kode (Owner)' },
      { command: 'pairingqr', description: '📱 Pairing WA dengan QR (Owner)' },
      { command: 'clearsesi', description: '🗑️ Hapus sesi WA (Owner)' },
      
      // Owner - Broadcast
      { command: 'broadcast', description: '📢 Broadcast ke semua user (Owner)' },
      { command: 'totaluser', description: '👥 Total user terdaftar (Owner)' },
      { command: 'listid', description: '📋 Daftar semua user ID (Owner)' },
      
      // Owner - Premium
      { command: 'addprem', description: '⭐ Tambah user premium (Owner)' },
      { command: 'delprem', description: '❌ Hapus user premium (Owner)' },
      { command: 'listprem', description: '📜 Lihat list premium (Owner)' },
      
      // Owner - Management
      { command: 'addowner', description: '👑 Tambah owner (Owner)' },
      { command: 'delowner', description: '🚫 Hapus owner (Owner)' },
      { command: 'listowner', description: '📝 Lihat list owner (Owner)' },
      ]);
    } catch (err) {
      console.error('⚠️ Gagal register commands:', err.message);
    }
    
    console.log('✅ Bot Telegram siap digunakan!');
    console.log('📋 Semua command sudah terdaftar di Telegram!');
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));