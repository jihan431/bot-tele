const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const config = require('./config');

module.exports = async (ctx) => {
  try {
    console.log('[DEBUG] Executing Jimp-based /cekid handler...');
    const msg = ctx.message;
    const reply = msg.reply_to_message;
    let targetUser = reply ? reply.from : msg.from;

    const userId = targetUser.id.toString();
    const name = targetUser.first_name || '-';
    // Gunakan username jika ada, jika tidak '-' 
    const username = targetUser.username ? `@${targetUser.username}` : '-';
    const tanggal = new Date().toISOString().split('T')[0];

    await ctx.replyWithChatAction('upload_photo');

    // JIMP IMPLEMENTATION
    const width = 800;
    const height = 450;
    
    // 1. Create Background (Dark Navy)
    // Use explicit Int hex: 0xRRGGBBAA to ensure no transparency
    // 0x0a1a2fff
    const image = new Jimp(width, height, 0x0a1a2fff);
    
    // 2. Create White Card
    const cardWidth = width - 80;
    const cardHeight = height - 120;
    // 0xffffffff (White fully opaque)
    const whiteCard = new Jimp(cardWidth, cardHeight, 0xffffffff);
    
    image.composite(whiteCard, 40, 60);

    // 3. Load Fonts
    const fontHeader = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK); 
    const fontInfoBold = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    const fontDetails = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    const fontFooter = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

    // Header Text
    image.print(
        fontHeader, 
        0, 
        80, 
        { text: 'ID CARD TELEGRAM', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_TOP }, 
        width, 
        height
    );

    // 4. Avatar
    let avatar;
    try {
        const photos = await ctx.telegram.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count > 0) {
            const file = photos.photos[0][0];
            const url = (await ctx.telegram.getFileLink(file.file_id)).href;
            avatar = await Jimp.read(url);
        }
    } catch (e) { 
        console.warn('Jimp avatar fail:', e); 
    }

    if (!avatar) {
        avatar = new Jimp(140, 140, '#667eea');
        const fontInitial = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        avatar.print(
            fontInitial, 
            0, 
            0, 
            { text: initial, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 
            140, 
            140
        );
    }

    avatar.resize(140, 140);
    avatar.circle(); 

    image.composite(avatar, 90, 170);

    // 5. User Info Text
    const startX = 270;
    const printRow = (label, value, y) => {
        image.print(fontDetails, startX, y, `${label} ${value}`);
    };

    image.print(fontInfoBold, startX, 175, 'Informasi Pengguna:');
    printRow('Nama:', name, 220);
    printRow('User ID:', userId, 260);
    printRow('Username:', username, 300);
    printRow('Tanggal:', tanggal, 340);

    // 6. Footer
    image.print(
        fontFooter, 
        0, 
        425, 
        { text: `ID Card By ${config.settings.footer}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_TOP }, 
        width, 
        height
    );

    const outPath = path.join(__dirname, `idcard_${userId}.png`);
    await image.writeAsync(outPath);
    
    // DEBUG: Check file size
    const stats = fs.statSync(outPath);
    console.log(`[DEBUG] Jimp Image Size: ${stats.size} bytes`);
    
    await ctx.replyWithPhoto(
      { source: outPath },
      {
        caption: `━━━━━━━━━━━━━━━━━━━━━
      👤 USER INFORMATION 👤
━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────
│ ◈ Nama: ${name}
│ ◈ Username: ${username}
│ ◈ ID: ${userId}
│ ◈ Lang: id
└─────────────────────

🔗 Profil: https://t.me/${username.replace('@', '')}

${config.settings.footer}`,
        
      }
    );

    if (fs.existsSync(outPath)) {
      setTimeout(() => { try { fs.unlinkSync(outPath); } catch(e) {} }, 5000); 
    }
  } catch (err) {
    console.error(err);
    ctx.reply('⚠️ Terjadi kesalahan saat membuat ID Card (Jimp): ' + err.message);
  }
};
