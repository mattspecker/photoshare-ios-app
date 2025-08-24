import Foundation
import Capacitor
import AVFoundation

/**
 * QRScanner plugin for scanning QR codes using native iOS camera
 */
@objc(QRScanner)
public class QRScanner: CAPPlugin, CAPBridgedPlugin {
    // Required properties for CAPBridgedPlugin
    public let identifier = "QRScanner"
    public let jsName = "QRScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scanQRCode", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopQRScan", returnType: CAPPluginReturnPromise)
    ]
    
    private var scannerViewController: QRScannerViewController?
    
    override public func load() {
        super.load()
        print("🎯 QRScanner plugin loaded successfully!")
        print("🎯 Plugin ID: \(self.pluginId)")
        print("🎯 Plugin available methods: scanQRCode, stopQRScan")
    }
    
    @objc func scanQRCode(_ call: CAPPluginCall) {
        print("🔍 QRScanner: scanQRCode called")
        
        DispatchQueue.main.async {
            // Check camera permission first
            let authStatus = AVCaptureDevice.authorizationStatus(for: .video)
            
            switch authStatus {
            case .authorized:
                self.startQRScanning(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.startQRScanning(call)
                        } else {
                            call.reject("Camera permission denied")
                        }
                    }
                }
            case .denied, .restricted:
                call.reject("Camera permission denied. Please enable camera access in Settings.")
            @unknown default:
                call.reject("Unknown camera permission status")
            }
        }
    }
    
    private func startQRScanning(_ call: CAPPluginCall) {
        print("🔍 QRScanner: Starting QR scanning")
        
        guard let viewController = bridge?.viewController else {
            call.reject("Unable to get view controller")
            return
        }
        
        let scanner = QRScannerViewController()
        scanner.completion = { [weak self] result in
            DispatchQueue.main.async {
                scanner.dismiss(animated: true) {
                    if let qrCode = result {
                        print("✅ QRScanner: QR code scanned: \(qrCode)")
                        call.resolve(["value": qrCode])
                    } else {
                        print("❌ QRScanner: No QR code detected")
                        call.resolve(["value": nil])
                    }
                }
            }
        }
        
        scanner.cancelCompletion = { [weak self] in
            DispatchQueue.main.async {
                scanner.dismiss(animated: true) {
                    print("⚠️ QRScanner: Scanning cancelled")
                    call.reject("QR scanning cancelled")
                }
            }
        }
        
        self.scannerViewController = scanner
        viewController.present(scanner, animated: true)
    }
    
    @objc func stopQRScan(_ call: CAPPluginCall) {
        print("🛑 QRScanner: stopQRScan called")
        
        DispatchQueue.main.async {
            if let scanner = self.scannerViewController {
                scanner.dismiss(animated: true) {
                    print("✅ QRScanner: Scanner dismissed")
                    self.scannerViewController = nil
                    call.resolve()
                }
            } else {
                print("⚠️ QRScanner: No active scanner to stop")
                call.resolve()
            }
        }
    }
}

// MARK: - QR Scanner View Controller

import UIKit

class QRScannerViewController: UIViewController {
    var completion: ((String?) -> Void)?
    var cancelCompletion: (() -> Void)?
    
    private var captureSession: AVCaptureSession!
    private var previewLayer: AVCaptureVideoPreviewLayer!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
        setupUI()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        if !captureSession.isRunning {
            DispatchQueue.global(qos: .background).async {
                self.captureSession.startRunning()
            }
        }
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        
        if captureSession.isRunning {
            captureSession.stopRunning()
        }
    }
    
    private func setupCamera() {
        captureSession = AVCaptureSession()
        
        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            print("❌ QRScanner: No camera device available")
            return
        }
        
        let videoInput: AVCaptureDeviceInput
        
        do {
            videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)
        } catch {
            print("❌ QRScanner: Error creating camera input: \(error)")
            return
        }
        
        if captureSession.canAddInput(videoInput) {
            captureSession.addInput(videoInput)
        } else {
            print("❌ QRScanner: Cannot add video input")
            return
        }
        
        let metadataOutput = AVCaptureMetadataOutput()
        
        if captureSession.canAddOutput(metadataOutput) {
            captureSession.addOutput(metadataOutput)
            
            metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            metadataOutput.metadataObjectTypes = [.qr]
        } else {
            print("❌ QRScanner: Cannot add metadata output")
            return
        }
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.layer.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.black
        
        // Add cancel button
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        cancelButton.layer.cornerRadius = 8
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancelButton)
        
        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            cancelButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            cancelButton.widthAnchor.constraint(equalToConstant: 80),
            cancelButton.heightAnchor.constraint(equalToConstant: 40)
        ])
        
        // Add instruction label
        let instructionLabel = UILabel()
        instructionLabel.text = "Point camera at QR code"
        instructionLabel.textColor = .white
        instructionLabel.textAlignment = .center
        instructionLabel.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        instructionLabel.layer.cornerRadius = 8
        instructionLabel.layer.masksToBounds = true
        
        instructionLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(instructionLabel)
        
        NSLayoutConstraint.activate([
            instructionLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
            instructionLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            instructionLabel.widthAnchor.constraint(equalToConstant: 200),
            instructionLabel.heightAnchor.constraint(equalToConstant: 40)
        ])
        
        // Add QR code scanning frame/viewfinder
        setupScanningFrame()
    }
    
    private func setupScanningFrame() {
        // Create main scanning frame container
        let frameContainer = UIView()
        frameContainer.backgroundColor = UIColor.clear
        frameContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(frameContainer)
        
        // Frame dimensions (square QR scanning area)
        let frameSize: CGFloat = 250
        
        NSLayoutConstraint.activate([
            frameContainer.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            frameContainer.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            frameContainer.widthAnchor.constraint(equalToConstant: frameSize),
            frameContainer.heightAnchor.constraint(equalToConstant: frameSize)
        ])
        
        // Create corner indicators
        let cornerLength: CGFloat = 25
        let cornerWidth: CGFloat = 4
        let cornerColor = UIColor.systemGreen
        
        // Top-left corner
        let topLeftVertical = createCornerLine(width: cornerWidth, height: cornerLength)
        topLeftVertical.backgroundColor = cornerColor
        frameContainer.addSubview(topLeftVertical)
        
        let topLeftHorizontal = createCornerLine(width: cornerLength, height: cornerWidth)
        topLeftHorizontal.backgroundColor = cornerColor
        frameContainer.addSubview(topLeftHorizontal)
        
        NSLayoutConstraint.activate([
            topLeftVertical.topAnchor.constraint(equalTo: frameContainer.topAnchor),
            topLeftVertical.leadingAnchor.constraint(equalTo: frameContainer.leadingAnchor),
            topLeftHorizontal.topAnchor.constraint(equalTo: frameContainer.topAnchor),
            topLeftHorizontal.leadingAnchor.constraint(equalTo: frameContainer.leadingAnchor)
        ])
        
        // Top-right corner
        let topRightVertical = createCornerLine(width: cornerWidth, height: cornerLength)
        topRightVertical.backgroundColor = cornerColor
        frameContainer.addSubview(topRightVertical)
        
        let topRightHorizontal = createCornerLine(width: cornerLength, height: cornerWidth)
        topRightHorizontal.backgroundColor = cornerColor
        frameContainer.addSubview(topRightHorizontal)
        
        NSLayoutConstraint.activate([
            topRightVertical.topAnchor.constraint(equalTo: frameContainer.topAnchor),
            topRightVertical.trailingAnchor.constraint(equalTo: frameContainer.trailingAnchor),
            topRightHorizontal.topAnchor.constraint(equalTo: frameContainer.topAnchor),
            topRightHorizontal.trailingAnchor.constraint(equalTo: frameContainer.trailingAnchor)
        ])
        
        // Bottom-left corner
        let bottomLeftVertical = createCornerLine(width: cornerWidth, height: cornerLength)
        bottomLeftVertical.backgroundColor = cornerColor
        frameContainer.addSubview(bottomLeftVertical)
        
        let bottomLeftHorizontal = createCornerLine(width: cornerLength, height: cornerWidth)
        bottomLeftHorizontal.backgroundColor = cornerColor
        frameContainer.addSubview(bottomLeftHorizontal)
        
        NSLayoutConstraint.activate([
            bottomLeftVertical.bottomAnchor.constraint(equalTo: frameContainer.bottomAnchor),
            bottomLeftVertical.leadingAnchor.constraint(equalTo: frameContainer.leadingAnchor),
            bottomLeftHorizontal.bottomAnchor.constraint(equalTo: frameContainer.bottomAnchor),
            bottomLeftHorizontal.leadingAnchor.constraint(equalTo: frameContainer.leadingAnchor)
        ])
        
        // Bottom-right corner
        let bottomRightVertical = createCornerLine(width: cornerWidth, height: cornerLength)
        bottomRightVertical.backgroundColor = cornerColor
        frameContainer.addSubview(bottomRightVertical)
        
        let bottomRightHorizontal = createCornerLine(width: cornerLength, height: cornerWidth)
        bottomRightHorizontal.backgroundColor = cornerColor
        frameContainer.addSubview(bottomRightHorizontal)
        
        NSLayoutConstraint.activate([
            bottomRightVertical.bottomAnchor.constraint(equalTo: frameContainer.bottomAnchor),
            bottomRightVertical.trailingAnchor.constraint(equalTo: frameContainer.trailingAnchor),
            bottomRightHorizontal.bottomAnchor.constraint(equalTo: frameContainer.bottomAnchor),
            bottomRightHorizontal.trailingAnchor.constraint(equalTo: frameContainer.trailingAnchor)
        ])
        
        // Add subtle center dot
        let centerDot = UIView()
        centerDot.backgroundColor = cornerColor.withAlphaComponent(0.8)
        centerDot.layer.cornerRadius = 3
        centerDot.translatesAutoresizingMaskIntoConstraints = false
        frameContainer.addSubview(centerDot)
        
        NSLayoutConstraint.activate([
            centerDot.centerXAnchor.constraint(equalTo: frameContainer.centerXAnchor),
            centerDot.centerYAnchor.constraint(equalTo: frameContainer.centerYAnchor),
            centerDot.widthAnchor.constraint(equalToConstant: 6),
            centerDot.heightAnchor.constraint(equalToConstant: 6)
        ])
        
        // Add subtle pulsing animation to the frame
        addPulsingAnimation(to: frameContainer)
    }
    
    private func createCornerLine(width: CGFloat, height: CGFloat) -> UIView {
        let line = UIView()
        line.layer.cornerRadius = 2
        line.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            line.widthAnchor.constraint(equalToConstant: width),
            line.heightAnchor.constraint(equalToConstant: height)
        ])
        
        return line
    }
    
    private func addPulsingAnimation(to view: UIView) {
        let pulseAnimation = CABasicAnimation(keyPath: "opacity")
        pulseAnimation.fromValue = 0.6
        pulseAnimation.toValue = 1.0
        pulseAnimation.duration = 1.5
        pulseAnimation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        pulseAnimation.autoreverses = true
        pulseAnimation.repeatCount = .infinity
        
        view.layer.add(pulseAnimation, forKey: "pulseAnimation")
    }
    
    @objc private func cancelTapped() {
        cancelCompletion?()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.layer.bounds
    }
}

// MARK: - AVCaptureMetadataOutputObjectsDelegate

extension QRScannerViewController: AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        
        if let metadataObject = metadataObjects.first {
            guard let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject else { return }
            guard let stringValue = readableObject.stringValue else { return }
            
            // Stop the session to prevent multiple scans
            captureSession.stopRunning()
            
            // Provide haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            
            print("🎯 QRScanner: QR code detected: \(stringValue)")
            completion?(stringValue)
        }
    }
}