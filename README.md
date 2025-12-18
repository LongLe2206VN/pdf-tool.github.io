# PDF Merger

A beautiful, modern single-page web application for merging multiple PDF files into one document.

## Features

- 🎯 **Simple Drag & Drop** - Drag and drop PDF files or click to browse
- 📑 **Multiple Files** - Upload and merge as many PDFs as you need
- ↕️ **Reorder Files** - Arrange files in any order before merging
- 🎨 **Modern UI** - Beautiful gradient design with dark mode support
- ⚡ **Client-Side Processing** - All PDF processing happens in your browser (no server upload needed)
- 💾 **Instant Download** - Merged PDF downloads automatically

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Modern, responsive styling
- **pdf-lib** - Client-side PDF manipulation

## Getting Started

### Prerequisites

- Node.js 18.17 or later

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## How to Use

1. **Upload PDFs** - Click "Choose PDF Files" or drag and drop PDF files onto the upload area
2. **Reorder** - Use the up/down arrows to arrange files in the desired order
3. **Merge** - Click "Merge PDFs & Download" to combine all files and download the result
4. **Remove** - Click the X button to remove individual files if needed

## Features in Detail

### Client-Side Processing
All PDF merging happens entirely in your browser using the pdf-lib library. No files are uploaded to any server, ensuring complete privacy and security.

### Drag and Drop Support
Simply drag PDF files from your file explorer directly onto the page for quick uploading.

### File Management
- View all uploaded files with their names
- Reorder files using intuitive up/down controls
- Remove individual files or clear all at once
- Visual feedback during the merge process

### Responsive Design
Works seamlessly on desktop, tablet, and mobile devices with a beautiful gradient background and smooth animations.

## License

MIT
