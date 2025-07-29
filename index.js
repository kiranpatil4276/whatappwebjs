const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const PORT = 3000;

// const fs = require('fs');
// const uploadsPath = path.join(__dirname, 'uploads');

const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}


app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

let qrCodeImage = '';
let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', qr => {
  qrcode.toDataURL(qr, (err, url) => {
    qrCodeImage = url;
  });
});

client.on('ready', () => {
  console.log('WhatsApp  s ready!');
  isReady = true;
});

client.initialize();

// Serve QR
app.get('/qr', (req, res) => {
  if (isReady) {
    return res.send({ status: 'authenticated' });
  } else if (qrCodeImage) {
    return res.send({ qr: qrCodeImage });
  } else {
    return res.send({ status: 'loading' });
  }
});

// Send file
app.post('/send-file', async (req, res) => {
  if (!isReady) return res.status(503).send({ error: 'WhatsApp not ready. Scan QR code.' });
  if (!req.files || !req.files.file) return res.status(400).send({ error: 'No file uploaded' });

  const { number } = req.body;
  const file = req.files.file;
  const filePath = path.join(__dirname, 'uploads', file.name);

  try {
    await file.mv(filePath);

    const media = new MessageMedia(file.mimetype, fs.readFileSync(filePath, { encoding: 'base64' }), file.name);
    await client.sendMessage(`${number}@c.us`, media);

    res.send({ status: 'File sent' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
