'use client';

import { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import dynamic from 'next/dynamic';

interface PDFFile {
  id: string;
  file: File;
  name: string;
  pageCount: number;
  thumbnail: string | null;
}

export default function Home() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PDFFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDF.js only on client side
  useEffect(() => {
    const loadPdfJs = async () => {
      const pdfjs = await import('pdfjs-dist');
      // Use local worker file from public directory (most reliable for Next.js)
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      setPdfjsLib(pdfjs);
    };
    
    loadPdfJs();
  }, []);

  // Generate thumbnail for PDF using PDF.js
  const generateThumbnail = async (file: File): Promise<{ thumbnail: string; pageCount: number }> => {
    if (!pdfjsLib) {
      // If PDF.js not loaded yet, return without thumbnail
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      return { thumbnail: null, pageCount: pdfDoc.getPageCount() };
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Load with pdf-lib to get page count
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      
      // Load with PDF.js to render thumbnail
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1); // Get first page
      
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        return { thumbnail: null, pageCount };
      }
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      const thumbnail = canvas.toDataURL('image/png');
      
      return { thumbnail, pageCount };
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      return { thumbnail: null, pageCount: pdfDoc.getPageCount() };
    }
  };

  // Generate all pages preview
  const generateAllPages = async (file: File): Promise<string[]> => {
    if (!pdfjsLib) return [];

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const pages: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) continue;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
        
        pages.push(canvas.toDataURL('image/png'));
      }
      
      return pages;
    } catch (error) {
      console.error('Error generating preview pages:', error);
      return [];
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    
    const pdfFilesArray = Array.from(files).filter(file => file.type === 'application/pdf');
    
    // Show loading state
    setIsProcessing(true);
    
    const newFilesPromises = pdfFilesArray.map(async (file) => {
      const { thumbnail, pageCount } = await generateThumbnail(file);
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        pageCount,
        thumbnail,
      };
    });

    const newFiles = await Promise.all(newFilesPromises);
    setPdfFiles(prev => [...prev, ...newFiles]);
    setIsProcessing(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    setPdfFiles(prev => prev.filter(file => file.id !== id));
  };

  const duplicateFile = async (pdfFile: PDFFile) => {
    const duplicated: PDFFile = {
      id: Math.random().toString(36).substr(2, 9),
      file: pdfFile.file,
      name: pdfFile.name,
      pageCount: pdfFile.pageCount,
      thumbnail: pdfFile.thumbnail,
    };
    setPdfFiles(prev => [...prev, duplicated]);
  };

  const previewPdf = async (pdfFile: PDFFile) => {
    setSelectedPdf(pdfFile);
    setShowPreview(true);
    setLoadingPreview(true);
    setPreviewPages([]);
    
    const pages = await generateAllPages(pdfFile.file);
    setPreviewPages(pages);
    setLoadingPreview(false);
  };

  // Drag and drop reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedItem === null || draggedItem === index) return;
    
    const newFiles = [...pdfFiles];
    const draggedFile = newFiles[draggedItem];
    
    newFiles.splice(draggedItem, 1);
    newFiles.splice(index, 0, draggedFile);
    
    setPdfFiles(newFiles);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      alert('Please upload at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of pdfFiles) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `merged_${Date.now()}.pdf`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('Failed to merge PDFs. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Random colors for PDF cards
  const colors = [
    'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    'bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
    'bg-cyan-100 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
    'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Preview Modal */}
      {showPreview && selectedPdf && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowPreview(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-4xl w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white dark:bg-gray-800 z-10 pb-4 border-b dark:border-gray-700">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedPdf.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {selectedPdf.pageCount} {selectedPdf.pageCount === 1 ? 'page' : 'pages'}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingPreview ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg
                  className="animate-spin h-12 w-12 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 mt-4">Loading preview...</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                {previewPages.length > 0 ? (
                  previewPages.map((page, index) => (
                    <div key={index} className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-lg">
                      <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {index + 1}
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-4 flex justify-center">
                        <img 
                          src={page} 
                          alt={`Page ${index + 1}`}
                          className="max-w-full h-auto shadow-xl"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>Unable to load preview</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3">
            PDF Merger
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Combine multiple PDF files into one document
          </p>
        </div>

        {/* AdMob Placeholder - Top Banner */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              📱 AdMob Banner Placeholder (728x90)
            </p>
          </div>
        </div>

        {/* Upload Area */}
        <div className="max-w-6xl mx-auto mb-8">
          <div
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf"
              onChange={handleChange}
              className="hidden"
            />
            
            <div className="space-y-3">
              <div className="flex justify-center">
                <svg
                  className="w-16 h-16 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing && pdfFiles.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing && pdfFiles.length === 0 ? 'Processing...' : 'Add PDF Files'}
                </button>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  or drag and drop PDF files here
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Grid */}
        {pdfFiles.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Your PDFs ({pdfFiles.length})
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setPdfFiles([])}
                  className="px-4 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium border border-red-600 dark:border-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={mergePDFs}
                  disabled={isProcessing || pdfFiles.length < 2}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Merging...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Merge & Download</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Drag & Drop Instructions */}
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                💡 <strong>Tip:</strong> Drag and drop cards to reorder them before merging
              </p>
            </div>

            {/* Grid Layout with Drag & Drop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {pdfFiles.map((pdfFile, index) => (
                <div
                  key={pdfFile.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative group rounded-xl border-2 overflow-hidden shadow-md hover:shadow-xl transition-all cursor-move ${
                    colors[index % colors.length]
                  } ${draggedItem === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
                >
                  {/* PDF Preview Card */}
                  <div className="aspect-[3/4] bg-white dark:bg-gray-700 p-2 flex items-center justify-center relative">
                    {/* Thumbnail */}
                    {pdfFile.thumbnail ? (
                      <img 
                        src={pdfFile.thumbnail} 
                        alt={pdfFile.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center w-full h-full flex flex-col items-center justify-center">
                        <svg
                          className="w-16 h-16 text-red-500 mb-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          PDF
                        </p>
                      </div>
                    )}

                    {/* Action buttons overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          previewPdf(pdfFile);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Preview"
                      >
                        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateFile(pdfFile);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Duplicate"
                      >
                        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(pdfFile.id);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Order badge */}
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                      {index + 1}
                    </div>

                    {/* Drag indicator */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <svg className="w-12 h-12 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </div>
                  </div>

                  {/* PDF Info */}
                  <div className="p-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={pdfFile.name}>
                      {pdfFile.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {pdfFile.pageCount} {pdfFile.pageCount === 1 ? 'page' : 'pages'}
                    </p>
                  </div>
                </div>
              ))}

              {/* Add more button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="aspect-[3/4] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex flex-col items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Add PDF
                </p>
              </button>
            </div>

            {/* AdMob Placeholder - Middle Banner */}
            <div className="mb-8">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  📱 AdMob Banner Placeholder (728x90)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* How to use */}
        {pdfFiles.length === 0 && (
          <div className="max-w-4xl mx-auto mt-12">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
                How to Use PDF Merger
              </h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    1
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Upload PDFs</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click to browse or drag & drop PDF files
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    2
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Reorder</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag cards to rearrange the merge order
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    3
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Preview</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click preview icon to view all pages
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                    4
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Merge</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Click merge button to download result
                  </p>
                </div>
              </div>
            </div>

            {/* AdMob Placeholder - Bottom Banner */}
            <div className="mt-8">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  📱 AdMob Banner Placeholder (728x90)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
