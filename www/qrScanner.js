import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import QrScanner from 'qr-scanner';
import { handleCameraPermission, showToast, requestPermissionAgain, startCamera } from './cameraPermissions.js';

export class QRScannerComponent {
  constructor() {
    this.isScanning = false;
    this.scanner = null;
    this.videoElement = null;
    this.onScanResult = null;
    this.onError = null;
  }

  async startScanning(videoElement, onResult, onError) {
    try {
      this.videoElement = videoElement;
      this.onScanResult = onResult;
      this.onError = onError;

      // Check camera permissions first
      const hasPermission = await handleCameraPermission();
      if (!hasPermission) {
        if (this.onError) {
          this.onError(new Error('Camera permission denied'));
        }
        return false;
      }

      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Camera for native platforms
        return await this.startNativeScanning();
      } else {
        // Use web-based QR scanner for web platform
        return await this.startWebScanning();
      }
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      if (this.onError) {
        this.onError(error);
      }
      return false;
    }
  }

  async startNativeScanning() {
    try {
      showToast('Starting barcode scanner...', 'info');
      
      // Start the barcode scanner
      const result = await BarcodeScanner.startScan();
      
      if (result.hasContent) {
        this.handleScanResult(result.content);
        return true;
      } else {
        showToast('No barcode detected', 'info');
        return false;
      }
    } catch (error) {
      console.error('Barcode scanner error:', error);
      if (error.message && error.message.includes('cancelled')) {
        showToast('Scanner cancelled', 'info');
      } else {
        showToast('Scanner error: ' + error.message, 'error');
      }
      throw error;
    }
  }

  async startWebScanning() {
    try {
      if (!this.videoElement) {
        throw new Error('Video element not provided for web scanning');
      }

      // Initialize QR Scanner for web
      this.scanner = new QrScanner(
        this.videoElement,
        (result) => {
          this.handleScanResult(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          returnDetailedScanResult: true
        }
      );

      await this.scanner.start();
      this.isScanning = true;
      showToast('QR Scanner ready - point camera at QR code', 'info');
      return true;
    } catch (error) {
      console.error('Web scanner error:', error);
      throw error;
    }
  }

  async processImageForQR(dataUrl) {
    try {
      // Create an image element to process
      const img = new Image();
      
      return new Promise((resolve, reject) => {
        img.onload = async () => {
          try {
            // Create canvas to process the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Use QrScanner to scan the canvas
            const result = await QrScanner.scanImage(canvas, {
              returnDetailedScanResult: true
            });
            
            this.handleScanResult(result.data);
            resolve(true);
          } catch (scanError) {
            console.error('QR scan error:', scanError);
            showToast('No QR code found in image', 'error');
            reject(scanError);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load captured image'));
        };
        
        img.src = dataUrl;
      });
    } catch (error) {
      console.error('Error processing image for QR:', error);
      throw error;
    }
  }

  handleScanResult(data) {
    if (!data) {
      showToast('No QR code data found', 'error');
      return;
    }

    console.log('QR Code scanned:', data);
    showToast('QR Code scanned successfully!', 'success');
    
    if (this.onScanResult) {
      this.onScanResult(data);
    }
    
    // Stop scanning after successful scan
    this.stopScanning();
  }

  stopScanning() {
    try {
      if (Capacitor.isNativePlatform()) {
        // Stop barcode scanner on native platforms
        BarcodeScanner.stopScan();
      } else {
        // Stop web scanner
        if (this.scanner && this.isScanning) {
          this.scanner.stop();
          this.scanner.destroy();
          this.scanner = null;
        }
        
        if (this.videoElement && this.videoElement.srcObject) {
          const tracks = this.videoElement.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          this.videoElement.srcObject = null;
        }
      }
      
      this.isScanning = false;
      console.log('Scanner stopped');
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
  }

  // Static method to create and use scanner quickly
  static async scanOnce(onResult, onError) {
    const scanner = new QRScannerComponent();
    
    if (Capacitor.isNativePlatform()) {
      // For native, we don't need a video element
      return await scanner.startScanning(null, onResult, onError);
    } else {
      // For web, create a temporary video element
      const video = document.createElement('video');
      video.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 9999;
      `;
      document.body.appendChild(video);
      
      const cleanup = () => {
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
        scanner.stopScanning();
      };
      
      // Add escape key listener
      const escapeHandler = (event) => {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', escapeHandler);
          cleanup();
          if (onError) {
            onError(new Error('Scanning cancelled by user'));
          }
        }
      };
      document.addEventListener('keydown', escapeHandler);
      
      try {
        const result = await scanner.startScanning(
          video,
          (data) => {
            document.removeEventListener('keydown', escapeHandler);
            cleanup();
            if (onResult) onResult(data);
          },
          (error) => {
            document.removeEventListener('keydown', escapeHandler);
            cleanup();
            if (onError) onError(error);
          }
        );
        
        if (!result) {
          cleanup();
        }
        
        return result;
      } catch (error) {
        document.removeEventListener('keydown', escapeHandler);
        cleanup();
        throw error;
      }
    }
  }
}