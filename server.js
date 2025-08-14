const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const archiver = require('archiver');
const sharp = require('sharp');
const cron = require('cron');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;

// Configuration
const config = {
  password: '123456789', // Change this to your desired password
  sessionSecret: 'your-secret-key-change-this',
  fileExpirationHours: 24, // Files auto-delete after 24 hours
  maxFileSize: 100 * 1024 * 1024, // 100MB max file size
  maxFiles: 20 // Max files per upload
};

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 uploads per windowMs
  message: 'Too many uploads, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Create necessary directories
const dirs = ['uploads', 'uploads/thumbnails', 'uploads/temp'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Configure multer for file uploads with better error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFiles
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types but log potentially dangerous ones
    const dangerousTypes = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (dangerousTypes.includes(ext)) {
      console.warn(`Potentially dangerous file uploaded: ${file.originalname}`);
    }
    
    cb(null, true);
  }
});

// File cleanup cron job - DISABLED
// const cleanupJob = new cron.CronJob('0 * * * *', () => {
//   console.log('Running file cleanup...');
//   cleanupExpiredFiles();
// }, null, true);

// Serve static files
app.use('/static', express.static('public'));
app.use('/thumbnails', express.static('uploads/thumbnails'));

// Authentication routes
app.post('/login', (req, res) => {
  const { password } = req.body;
  
  if (password === config.password) {
    req.session.authenticated = true;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

app.get('/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// Main page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// QR Code generation
app.get('/qr', requireAuth, async (req, res) => {
  try {
    const serverUrl = getServerUrl(req);
    const qrCodeDataUrl = await QRCode.toDataURL(serverUrl);
    res.json({ qrCode: qrCodeDataUrl, url: serverUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Upload endpoint with thumbnail generation
app.post('/upload', requireAuth, uploadLimiter, upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = [];
  
  for (const file of req.files) {
    const fileInfo = {
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      uploadTime: new Date().toISOString(),
      expiresAt: null, // Auto-delete disabled
      mimeType: file.mimetype,
      category: categorizeFile(file.originalname),
      hasThumb: false
    };

    // Generate thumbnail for images
    if (file.mimetype.startsWith('image/')) {
      try {
        await generateThumbnail(file.path, file.filename);
        fileInfo.hasThumb = true;
      } catch (error) {
        console.error('Thumbnail generation failed:', error);
      }
    }

    uploadedFiles.push(fileInfo);
  }

  res.json({ 
    message: 'Files uploaded successfully', 
    files: uploadedFiles 
  });
});

// Get list of uploaded files with enhanced metadata
app.get('/files', requireAuth, (req, res) => {
  const { search, category, sort } = req.query;
  
  fs.readdir('uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }

    let fileList = files
      .filter(filename => !filename.startsWith('.') && filename !== 'thumbnails' && filename !== 'temp')
      .map(filename => {
        const filePath = path.join('uploads', filename);
        const stats = fs.statSync(filePath);
        const originalName = filename.split('-').slice(1).join('-');
        
        return {
          filename: filename,
          originalName: originalName,
          size: stats.size,
          uploadTime: stats.mtime.toISOString(),
          expiresAt: null, // Auto-delete disabled
          category: categorizeFile(originalName),
          hasThumb: fs.existsSync(path.join('uploads', 'thumbnails', `thumb_${filename}.jpg`)),
          extension: path.extname(originalName).toLowerCase()
        };
      });

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      fileList = fileList.filter(file => 
        file.originalName.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (category && category !== 'all') {
      fileList = fileList.filter(file => file.category === category);
    }

    // Apply sorting
    if (sort) {
      switch (sort) {
        case 'name':
          fileList.sort((a, b) => a.originalName.localeCompare(b.originalName));
          break;
        case 'size':
          fileList.sort((a, b) => b.size - a.size);
          break;
        case 'date':
        default:
          fileList.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
          break;
      }
    }

    res.json(fileList);
  });
});

// Download endpoint with resume support
app.get('/download/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const originalName = filename.split('-').slice(1).join('-');

  if (range) {
    // Handle range requests for resume capability
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    
    const stream = fs.createReadStream(filePath, { start, end });
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${originalName}"`
    });
    
    stream.pipe(res);
  } else {
    // Regular download
    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  }
});

// Bulk download as ZIP
app.post('/download-zip', requireAuth, (req, res) => {
  const { files } = req.body;
  
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files specified' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  
  res.attachment('files.zip');
  archive.pipe(res);

  files.forEach(filename => {
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      const originalName = filename.split('-').slice(1).join('-');
      archive.file(filePath, { name: originalName });
    }
  });

  archive.finalize();
});

// Delete file endpoint
app.delete('/delete/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  const thumbPath = path.join(__dirname, 'uploads', 'thumbnails', `thumb_${filename}.jpg`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    
    // Delete thumbnail if exists
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Bulk delete endpoint
app.post('/delete-bulk', requireAuth, (req, res) => {
  const { files } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'No files specified' });
  }

  const results = [];
  
  files.forEach(filename => {
    const filePath = path.join(__dirname, 'uploads', filename);
    const thumbPath = path.join(__dirname, 'uploads', 'thumbnails', `thumb_${filename}.jpg`);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
        
        results.push({ filename, success: true });
      } else {
        results.push({ filename, success: false, error: 'File not found' });
      }
    } catch (error) {
      results.push({ filename, success: false, error: error.message });
    }
  });

  res.json({ message: 'Bulk delete completed', results });
});

// Get server info
app.get('/info', (req, res) => {
  const serverUrl = getServerUrl(req);
  
  res.json({
    serverIP: getLocalIP(),
    port: PORT,
    serverUrl: serverUrl,
    config: {
      fileExpirationHours: config.fileExpirationHours,
      maxFileSize: config.maxFileSize,
      maxFiles: config.maxFiles
    }
  });
});

// File categories endpoint
app.get('/categories', requireAuth, (req, res) => {
  const categories = ['all', 'images', 'documents', 'videos', 'audio', 'archives', 'other'];
  res.json(categories);
});

// Utility functions
function getLocalIP() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function getServerUrl(req) {
  const host = req.get('host') || `${getLocalIP()}:${PORT}`;
  const protocol = req.secure ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function categorizeFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const categories = {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'],
    documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
    videos: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
    audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
    archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']
  };
  
  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }
  
  return 'other';
}

async function generateThumbnail(filePath, filename) {
  const thumbnailPath = path.join('uploads', 'thumbnails', `thumb_${filename}.jpg`);
  
  await sharp(filePath)
    .resize(200, 200, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);
}

function cleanupExpiredFiles() {
  const uploadsDir = 'uploads';
  const now = new Date();
  
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;
    
    files.forEach(filename => {
      if (filename === 'thumbnails' || filename === 'temp') return;
      
      const filePath = path.join(uploadsDir, filename);
      
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        const fileAge = now - stats.mtime;
        const maxAge = config.fileExpirationHours * 60 * 60 * 1000;
        
        if (fileAge > maxAge) {
          fs.unlink(filePath, (err) => {
            if (!err) {
              console.log(`Deleted expired file: ${filename}`);
              
              // Delete thumbnail too
              const thumbPath = path.join(uploadsDir, 'thumbnails', `thumb_${filename}.jpg`);
              fs.unlink(thumbPath, () => {}); // Ignore errors
            }
          });
        }
      });
    });
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  
  console.log(`🚀 Enhanced Home File Server running!`);
  console.log(`📱 Open on any device: http://${localIP}:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
  console.log(`🔐 Default password: ${config.password}`);
  console.log(`📁 Files stored in: ./uploads/`);
  console.log(`⏰ Auto-delete: DISABLED (files kept permanently)`);
  console.log(`📊 Max file size: ${Math.round(config.maxFileSize / 1024 / 1024)}MB`);
});