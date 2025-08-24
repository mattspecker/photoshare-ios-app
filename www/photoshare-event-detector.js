/**
 * PhotoShare Event Detector & Toggle Manager
 * Detects events on photo-share.app and adds auto-upload controls
 * Fixes the "Enabled events shows 0" issue
 */

console.log('🎯 PhotoShare Event Detector loading...');

(function() {
    'use strict';

    class PhotoShareEventDetector {
        constructor() {
            this.detectedEvents = new Map();
            this.eventSelectors = [
                // Common event selectors to try
                '[data-event-id]',
                '[data-event]', 
                '.event-card',
                '.event-item',
                '.event',
                '[class*="event"]',
                '[id*="event"]',
                // URL-based detection
                'main', 'article', 'section'
            ];
            this.initialized = false;
        }

        async initialize() {
            if (this.initialized) return;
            
            console.log('🔧 Initializing Event Detector...');
            
            // Wait for auto-upload system to be ready
            await this.waitForAutoUpload();
            
            // Start event detection
            this.startEventDetection();
            
            // Set up observers for dynamic content
            this.setupObservers();
            
            this.initialized = true;
            console.log('✅ Event Detector ready');
        }

        async waitForAutoUpload() {
            let retries = 0;
            while (!window.PhotoShareAutoUpload?.initialized && retries < 20) {
                console.log(`⏳ Waiting for auto-upload system... (${retries + 1}/20)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }
        }

        startEventDetection() {
            console.log('🔍 Starting event detection...');
            
            // Method 1: Scan for existing event elements
            this.scanForEventElements();
            
            // Method 2: Check URL for event ID
            this.checkURLForEvent();
            
            // Method 3: Look for event data in page
            this.scanForEventData();
            
            // Method 4: Create manual toggle if no events found
            setTimeout(() => this.addManualToggle(), 2000);
        }

        scanForEventElements() {
            console.log('📋 Scanning for event elements...');
            
            this.eventSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                console.log(`Found ${elements.length} elements matching "${selector}"`);
                
                elements.forEach(element => {
                    const eventId = this.extractEventId(element);
                    if (eventId) {
                        console.log(`✅ Found event: ${eventId}`);
                        this.addToggleToElement(element, eventId);
                        this.detectedEvents.set(eventId, {
                            element,
                            source: 'element-scan',
                            selector
                        });
                    }
                });
            });
        }

        checkURLForEvent() {
            console.log('🌐 Checking URL for event ID...');
            
            const url = window.location.href;
            const pathname = window.location.pathname;
            
            // Common URL patterns for events
            const patterns = [
                /\/event\/([^\/\?]+)/i,
                /\/events\/([^\/\?]+)/i,
                /event[_-]?id[=:]([^&\?]+)/i,
                /eventId[=:]([^&\?]+)/i,
                /id[=:]([^&\?]+)/i
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern) || pathname.match(pattern);
                if (match) {
                    const eventId = match[1];
                    console.log(`✅ Found event in URL: ${eventId}`);
                    this.addURLBasedToggle(eventId);
                    this.detectedEvents.set(eventId, {
                        source: 'url-pattern',
                        pattern: pattern.toString()
                    });
                    return;
                }
            }
            
            console.log('ℹ️ No event found in URL');
        }

        scanForEventData() {
            console.log('📊 Scanning for event data in page...');
            
            // Look for JSON data containing event info
            const scripts = document.querySelectorAll('script[type="application/json"], script:not([src])');
            scripts.forEach(script => {
                try {
                    const content = script.textContent || script.innerHTML;
                    if (content.includes('event') || content.includes('Event')) {
                        const data = JSON.parse(content);
                        const eventId = this.findEventIdInData(data);
                        if (eventId) {
                            console.log(`✅ Found event in data: ${eventId}`);
                            this.addDataBasedToggle(eventId);
                            this.detectedEvents.set(eventId, {
                                source: 'json-data',
                                data
                            });
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            });
            
            // Look for window variables
            const globalVars = ['currentEvent', 'event', 'eventData', 'pageData'];
            globalVars.forEach(varName => {
                if (window[varName]) {
                    const eventId = this.findEventIdInData(window[varName]);
                    if (eventId) {
                        console.log(`✅ Found event in ${varName}: ${eventId}`);
                        this.addDataBasedToggle(eventId);
                        this.detectedEvents.set(eventId, {
                            source: 'global-variable',
                            variable: varName
                        });
                    }
                }
            });
        }

        extractEventId(element) {
            // Try various attributes
            const attributes = [
                'data-event-id',
                'data-event',
                'data-id',
                'id',
                'event-id',
                'eventid'
            ];
            
            for (const attr of attributes) {
                const value = element.getAttribute(attr);
                if (value && value.trim()) {
                    return value.trim();
                }
            }
            
            // Try text content for ID patterns
            const text = element.textContent || '';
            const idMatch = text.match(/(?:event|id)[:\s]*([a-zA-Z0-9-_]+)/i);
            if (idMatch) {
                return idMatch[1];
            }
            
            return null;
        }

        findEventIdInData(data) {
            if (!data || typeof data !== 'object') return null;
            
            // Common property names for event IDs
            const idProps = ['id', 'eventId', 'event_id', 'eventID', 'uuid', 'slug'];
            
            for (const prop of idProps) {
                if (data[prop]) {
                    return String(data[prop]);
                }
            }
            
            // Recursive search in nested objects
            for (const [key, value] of Object.entries(data)) {
                if (key.toLowerCase().includes('event') && typeof value === 'object') {
                    const nestedId = this.findEventIdInData(value);
                    if (nestedId) return nestedId;
                }
            }
            
            return null;
        }

        addToggleToElement(element, eventId) {
            // Don't add if already exists
            if (element.querySelector('.photoshare-auto-upload-toggle')) return;
            
            const toggle = this.createToggle(eventId);
            element.appendChild(toggle);
            console.log(`➕ Added toggle to element for event: ${eventId}`);
        }

        addURLBasedToggle(eventId) {
            // Add to main content area
            const contentSelectors = ['main', '.main-content', '.content', 'article', '.event-details'];
            
            for (const selector of contentSelectors) {
                const container = document.querySelector(selector);
                if (container && !container.querySelector('.photoshare-auto-upload-toggle')) {
                    const toggle = this.createToggle(eventId);
                    toggle.style.marginTop = '20px';
                    container.appendChild(toggle);
                    console.log(`➕ Added URL-based toggle for event: ${eventId}`);
                    return;
                }
            }
        }

        addDataBasedToggle(eventId) {
            this.addURLBasedToggle(eventId); // Same approach
        }

        addManualToggle() {
            // If no events detected, add a manual toggle
            if (this.detectedEvents.size === 0) {
                console.log('🔧 No events detected, adding manual toggle...');
                
                const manualId = `manual-${Date.now()}`;
                const toggle = this.createToggle(manualId, true);
                
                // Add to page
                const container = document.querySelector('main') || document.querySelector('.content') || document.body;
                if (container) {
                    container.appendChild(toggle);
                    console.log(`➕ Added manual toggle: ${manualId}`);
                }
            }
        }

        createToggle(eventId, isManual = false) {
            const toggle = document.createElement('div');
            toggle.className = 'photoshare-auto-upload-toggle';
            toggle.style.cssText = `
                margin: 15px 0;
                padding: 12px 16px;
                background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
                border-radius: 8px;
                border-left: 4px solid #2196f3;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;
            
            const isEnabled = window.PhotoShareAutoUpload?.settingsService?.isEnabledForEvent(eventId) || false;
            
            toggle.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; font-weight: 500; color: #1976d2;">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                               style="margin-right: 10px; transform: scale(1.2);"
                               onchange="window.PhotoShareEventToggle?.toggle('${eventId}', this.checked)">
                        <span>📤 Auto-upload photos from this event</span>
                    </label>
                    <div style="font-size: 12px; color: #666;">
                        ${isManual ? 'Manual Setup' : `Event: ${eventId}`}
                    </div>
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #666; line-height: 1.4;">
                    Photos taken during this event will be automatically uploaded when enabled
                </div>
            `;
            
            return toggle;
        }

        setupObservers() {
            // Watch for dynamic content changes
            const observer = new MutationObserver((mutations) => {
                let shouldRescan = false;
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if new content might contain events
                            if (node.querySelector && (
                                node.querySelector('[data-event-id]') ||
                                node.className?.includes('event') ||
                                node.textContent?.toLowerCase().includes('event')
                            )) {
                                shouldRescan = true;
                            }
                        }
                    });
                });
                
                if (shouldRescan) {
                    console.log('🔄 New content detected, rescanning for events...');
                    setTimeout(() => this.scanForEventElements(), 1000);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Debug functions
        getDetectedEvents() {
            return Array.from(this.detectedEvents.entries());
        }

        debugEventDetection() {
            console.log('🔍 Event Detection Debug:');
            console.log('- Detected events:', this.detectedEvents.size);
            console.log('- Event details:', this.getDetectedEvents());
            console.log('- URL:', window.location.href);
            console.log('- Available selectors tested:', this.eventSelectors);
            
            // Test each selector
            this.eventSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`- "${selector}": ${elements.length} elements found`);
                }
            });
        }
    }

    // Toggle management
    class PhotoShareEventToggle {
        static async toggle(eventId, enabled) {
            console.log(`🔄 Toggling auto-upload for event ${eventId}: ${enabled}`);
            
            if (!window.PhotoShareAutoUpload) {
                console.error('❌ PhotoShare Auto-Upload not available');
                return;
            }
            
            try {
                if (enabled) {
                    await window.PhotoShareAutoUpload.settingsService.enableAutoUploadForEvent(eventId);
                    console.log(`✅ Auto-upload enabled for event: ${eventId}`);
                } else {
                    await window.PhotoShareAutoUpload.settingsService.disableAutoUploadForEvent(eventId);
                    console.log(`❌ Auto-upload disabled for event: ${eventId}`);
                }
                
                // Update dashboard
                if (window.PhotoShareAutoUpload.uiIntegration) {
                    window.PhotoShareAutoUpload.uiIntegration.updateDashboardContent();
                }
                
                // Show notification
                this.showNotification(enabled ? 
                    `✅ Auto-upload enabled for event ${eventId}` : 
                    `❌ Auto-upload disabled for event ${eventId}`
                );
                
            } catch (error) {
                console.error('❌ Toggle failed:', error);
                this.showNotification('❌ Failed to update auto-upload setting');
            }
        }
        
        static showNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: #333;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 3000);
        }
    }

    // Initialize when auto-upload system is ready
    const eventDetector = new PhotoShareEventDetector();
    
    // Expose globally
    window.PhotoShareEventDetector = eventDetector;
    window.PhotoShareEventToggle = PhotoShareEventToggle;
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => eventDetector.initialize(), 2000);
        });
    } else {
        setTimeout(() => eventDetector.initialize(), 2000);
    }
    
    // Debug functions
    window.debugEventDetection = () => eventDetector.debugEventDetection();
    window.getDetectedEvents = () => eventDetector.getDetectedEvents();

    console.log('✅ PhotoShare Event Detector loaded');
})();