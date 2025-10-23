// Performance Metrics Auto-Collector for PhotoShare
// This script automatically collects and saves performance metrics to device storage

import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const PerformanceMonitor = registerPlugin('PerformanceMonitor');

// Auto-collect metrics after page load
window.addEventListener('load', () => {
    console.log('📊 Performance collector: Page loaded, waiting to collect metrics...');
    
    // Wait for everything to settle
    setTimeout(async () => {
        try {
            console.log('📊 Collecting performance metrics...');
            
            // Get metrics from plugin
            const metrics = await PerformanceMonitor.getMetrics();
            
            // Create readable report
            const report = {
                timestamp: new Date().toISOString(),
                platform: window.Capacitor?.getPlatform?.() || 'unknown',
                summary: {
                    coldStartTime: metrics.summary?.coldStartTime || 0,
                    timeToInteractive: metrics.summary?.timeToInteractive || 0,
                    totalLoadTime: metrics.summary?.totalLoadTime || 0,
                    timeToInteractiveSeconds: metrics.summary?.timeToInteractiveSeconds || 'N/A'
                },
                native: {
                    appColdStart: metrics.native?.appColdStart || 0,
                    nativeInitTime: metrics.native?.nativeInitTime || 0,
                    webViewInitTime: metrics.native?.webViewInitTime || 0,
                    pluginRegistrationTime: metrics.native?.pluginRegistrationTime || 0,
                    totalNativeInitTime: metrics.native?.totalNativeInitTime || 0
                },
                web: {
                    domContentLoaded: metrics.web?.timing?.domContentLoaded || 0,
                    loadComplete: metrics.web?.timing?.loadComplete || 0,
                    firstPaint: metrics.web?.paint?.[0]?.startTime || 0,
                    firstContentfulPaint: metrics.web?.paint?.[1]?.startTime || 0
                },
                fullMetrics: metrics
            };
            
            // Create HTML report
            const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhotoShare Performance Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        h1 { color: #4CAF50; font-size: 24px; }
        h2 { color: #666; font-size: 18px; margin-top: 20px; }
        .metric-box {
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { color: #666; }
        .metric-value { 
            font-weight: bold; 
            color: #4CAF50;
            font-family: monospace;
        }
        .summary-box {
            background: #4CAF50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .summary-value {
            font-size: 32px;
            font-weight: bold;
            margin: 5px 0;
        }
        .timestamp {
            color: #999;
            font-size: 12px;
            margin-bottom: 20px;
        }
        .warning { color: #ff9800; }
        .error { color: #f44336; }
        .success { color: #4CAF50; }
        pre {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>📊 PhotoShare Performance Report</h1>
    <div class="timestamp">Generated: ${report.timestamp}</div>
    <div class="timestamp">Platform: ${report.platform.toUpperCase()}</div>
    
    <div class="summary-box">
        <h2 style="color: white;">⚡ Time to Interactive</h2>
        <div class="summary-value">${report.summary.timeToInteractiveSeconds}</div>
        <div>App launch → User can interact</div>
    </div>
    
    <div class="metric-box">
        <h2>📱 Summary Metrics</h2>
        <div class="metric-row">
            <span class="metric-label">Cold Start Time:</span>
            <span class="metric-value">${(report.summary.coldStartTime / 1000).toFixed(2)}s</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Time to Interactive:</span>
            <span class="metric-value ${report.summary.timeToInteractive > 5000 ? 'warning' : ''}">${(report.summary.timeToInteractive / 1000).toFixed(2)}s</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Total Load Time:</span>
            <span class="metric-value ${report.summary.totalLoadTime > 10000 ? 'error' : ''}">${(report.summary.totalLoadTime / 1000).toFixed(2)}s</span>
        </div>
    </div>
    
    <div class="metric-box">
        <h2>🚀 Native Initialization</h2>
        <div class="metric-row">
            <span class="metric-label">App Cold Start:</span>
            <span class="metric-value">${report.native.appColdStart}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Native Init:</span>
            <span class="metric-value">${report.native.nativeInitTime}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">WebView Init:</span>
            <span class="metric-value">${report.native.webViewInitTime}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Plugin Registration:</span>
            <span class="metric-value">${report.native.pluginRegistrationTime}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Total Native Time:</span>
            <span class="metric-value">${(report.native.totalNativeInitTime / 1000).toFixed(2)}s</span>
        </div>
    </div>
    
    <div class="metric-box">
        <h2>🌐 Web Performance</h2>
        <div class="metric-row">
            <span class="metric-label">DOM Ready:</span>
            <span class="metric-value">${(report.web.domContentLoaded / 1000).toFixed(2)}s</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Page Load Complete:</span>
            <span class="metric-value">${(report.web.loadComplete / 1000).toFixed(2)}s</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">First Paint:</span>
            <span class="metric-value">${Math.round(report.web.firstPaint)}ms</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">First Contentful Paint:</span>
            <span class="metric-value">${Math.round(report.web.firstContentfulPaint)}ms</span>
        </div>
    </div>
    
    <div class="metric-box">
        <h2>⚡ Performance Analysis</h2>
        <div class="metric-row">
            <span class="metric-label">Native Overhead:</span>
            <span class="metric-value">${((report.native.totalNativeInitTime / report.summary.totalLoadTime) * 100).toFixed(1)}%</span>
        </div>
        <div class="metric-row">
            <span class="metric-label">Web Load Time:</span>
            <span class="metric-value">${((report.web.loadComplete / report.summary.totalLoadTime) * 100).toFixed(1)}%</span>
        </div>
    </div>
    
    <details>
        <summary style="cursor: pointer; padding: 10px 0; color: #666;">
            View Raw JSON Data
        </summary>
        <pre>${JSON.stringify(report.fullMetrics, null, 2)}</pre>
    </details>
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
        <p>💡 <strong>Tips for better performance:</strong></p>
        <ul>
            <li>Time to Interactive > 3s: Consider reducing bundle size</li>
            <li>Native Init > 2s: Defer non-critical plugin initialization</li>
            <li>DOM Ready > 5s: Optimize JavaScript bundle and lazy load</li>
        </ul>
    </div>
</body>
</html>`;

            // Generate filename with timestamp
            const platform = window.Capacitor?.getPlatform?.() || 'unknown';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `performance-report-${platform}-${timestamp}.html`;
            
            // Save to Documents directory (accessible via Files app on iOS)
            const result = await Filesystem.writeFile({
                path: filename,
                data: htmlReport,
                directory: Directory.Documents,
                encoding: 'utf8'
            });
            
            console.log('✅ Performance report saved:', result.uri);
            console.log('📁 File location:', filename);
            
            // Also save JSON version for data analysis
            const jsonFilename = `performance-data-${platform}-${timestamp}.json`;
            await Filesystem.writeFile({
                path: jsonFilename,
                data: JSON.stringify(report, null, 2),
                directory: Directory.Documents,
                encoding: 'utf8'
            });
            
            console.log('📊 JSON data saved:', jsonFilename);
            
            // Log summary to console
            console.group('📊 Performance Summary');
            console.log('Time to Interactive:', report.summary.timeToInteractiveSeconds);
            console.log('Total Load Time:', (report.summary.totalLoadTime / 1000).toFixed(2) + 's');
            console.log('Native Init:', (report.native.totalNativeInitTime / 1000).toFixed(2) + 's');
            console.log('Web Load:', (report.web.loadComplete / 1000).toFixed(2) + 's');
            console.groupEnd();
            
            // Show alert with file location
            if (window.Capacitor?.Plugins?.Dialog) {
                await window.Capacitor.Plugins.Dialog.alert({
                    title: 'Performance Report Saved',
                    message: `Report saved to Documents folder:\n${filename}\n\nTime to Interactive: ${report.summary.timeToInteractiveSeconds}`
                });
            }
            
        } catch (error) {
            console.error('❌ Error collecting performance metrics:', error);
            
            // Try to show error in dialog
            if (window.Capacitor?.Plugins?.Dialog) {
                await window.Capacitor.Plugins.Dialog.alert({
                    title: 'Performance Collection Error',
                    message: error.message
                });
            }
        }
    }, 3000); // Wait 3 seconds for everything to load
});

// Export for manual use
window.collectPerformanceReport = async function() {
    console.log('📊 Manual performance collection triggered...');
    const event = new Event('load');
    window.dispatchEvent(event);
};