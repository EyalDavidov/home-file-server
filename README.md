# 🏠 Home File Server (שרת קבצים ביתי)

A powerful, feature-rich local file sharing server for your home network. Upload files from any device and download them from any other device with a beautiful Hebrew interface.

![Hebrew Interface](https://img.shields.io/badge/Language-Hebrew%20(עברית)-blue)
![Node.js](https://img.shields.io/badge/Node.js-green)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🔐 **Security & Authentication**
- Password protection with session management
- Rate limiting (50 uploads per 15 minutes)
- Secure file handling with dangerous file warnings

### 🎨 **Modern Interface**
- **Complete Hebrew interface** with RTL support
- **Dark/Light mode toggle**
- Beautiful responsive design optimized for mobile
- Toast notifications and smooth animations

### 📱 **Easy Access**
- **QR code generation** for easy URL sharing
- Auto-detected local IP address
- Works on all devices (phones, tablets, computers)

### 📁 **Advanced File Management**
- **Image thumbnails** (auto-generated with Sharp)
- **File categories** (תמונות, מסמכים, סרטונים, שמע, ארכיונים)
- **Search & filter** functionality
- **Sort by** name, date, or size
- **Bulk operations** (select all, download as ZIP, bulk delete)

### 📤 **Smart Upload Features**
- **Camera/photo upload** directly from mobile devices
- **Drag & drop** multiple files with visual feedback
- **Upload progress tracking** with real-time percentage
- **Resume interrupted downloads** support
- File size and count limits (configurable)

### 🏠 **Perfect for Home Use**
- **No auto-delete** - files kept permanently
- Auto-refresh every 60 seconds
- File statistics and categorization
- Cross-platform compatibility

## 🚀 Quick Start

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/home-file-server.git
   cd home-file-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access from any device:**
   - The server will display the URL (like `http://192.168.1.100:3000`)
   - Open this URL on any device on your home network
   - Default password: `123456789` (change this in `server.js`)

## 📱 Usage Example

1. **On your phone:** Open server URL → Upload photos/documents
2. **On your PC:** Open same URL → Download the files
3. **Generate QR code** to easily share the URL with family members
4. **Use dark mode** for comfortable evening browsing

## ⚙️ Configuration

Edit the configuration in `server.js`:

```javascript
const config = {
  password: '0545773062',           // Change this password!
  sessionSecret: 'your-secret-key', // Change this secret!
  maxFileSize: 100 * 1024 * 1024,  // 100MB max file size
  maxFiles: 20                      // Max files per upload
};
```

## 🔧 Development

```bash
npm run dev    # Start with auto-restart (requires nodemon)
```

## 📁 Project Structure

```
home-file-server/
├── server.js              # Main server file
├── public/
│   └── index.html         # Hebrew web interface
├── uploads/               # File storage (auto-created)
│   └── thumbnails/        # Generated thumbnails
├── package.json
└── README.md
```

## 🛡️ Security Considerations

### ⚠️ **Important Security Notes:**

This server is designed for **home network use only**. Before using:

1. **Change the default password** in `server.js`
2. **Use only on trusted home WiFi networks**
3. **Never expose to the internet** without additional security measures

### Current Security Features:
- ✅ Password authentication
- ✅ Session management
- ✅ Rate limiting
- ✅ File size limits
- ✅ Dangerous file type warnings

### For Enhanced Security:
- Add HTTPS (use reverse proxy)
- Hash passwords with bcrypt
- Implement IP whitelisting
- Add file type restrictions
- Use stronger session secrets

## 🌐 Supported File Types

### 📸 Images (with thumbnails)
- JPG, PNG, GIF, BMP, WebP, SVG

### 📄 Documents
- PDF, DOC, DOCX, TXT, XLS, XLSX, PPT, PPTX

### 🎥 Videos
- MP4, AVI, MKV, MOV, WMV, WebM

### 🎵 Audio
- MP3, WAV, FLAC, AAC, OGG

### 📦 Archives
- ZIP, RAR, 7Z, TAR, GZ

## 🎯 Perfect For

- **Family photo sharing** between devices
- **Quick document transfers** from phone to computer
- **Temporary file storage** during projects
- **Guest file sharing** on home network
- **Mobile photography workflows**

## 📋 Requirements

- Node.js 14+
- All devices on the same local network
- Modern web browser with JavaScript enabled

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Express.js, Multer, and Sharp
- Hebrew interface with RTL support
- Responsive design for all screen sizes
- QR code generation with qrcode library

---

**Made with ❤️ for easy home file sharing**