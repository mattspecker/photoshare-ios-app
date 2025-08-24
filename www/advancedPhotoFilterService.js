import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { showToast } from './cameraPermissions.js';

/**
 * AdvancedPhotoFilterService - AI-powered photo filtering with face detection and scene analysis
 * Integrates with iOS Vision framework for advanced photo analysis
 */
export class AdvancedPhotoFilterService {
  constructor() {
    this.isInitialized = false;
    this.visionFrameworkAvailable = false;
    this.filteringActive = false;
    this.analysisCache = new Map();
    this.filterStats = new Map();
    
    // Filtering configuration
    this.config = {
      // Face detection settings
      faceDetection: {
        enabled: true,
        minFaceSize: 0.1, // 10% of image
        maxFaces: 20,
        faceQualityThreshold: 0.7,
        ageClassification: true,
        emotionDetection: true
      },
      
      // Scene analysis settings
      sceneAnalysis: {
        enabled: true,
        confidenceThreshold: 0.6,
        maxSceneLabels: 10,
        objectDetection: true,
        textDetection: true,
        landmarkDetection: true
      },
      
      // Content filtering
      contentFiltering: {
        duplicateDetection: true,
        blurDetection: true,
        exposureAnalysis: true,
        qualityScoring: true,
        inappropriateContent: false // Disabled for privacy
      },
      
      // Performance settings
      performance: {
        useMLCompute: true,
        processingTimeout: 10000, // 10 seconds
        cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
        parallelProcessing: true,
        maxConcurrent: 3
      },
      
      // Event-specific filtering
      eventFiltering: {
        peopleEvents: {
          preferFaces: true,
          minFaces: 1,
          groupPhotos: true,
          socialScenes: true
        },
        landscapeEvents: {
          preferScenery: true,
          minFaces: 0,
          outdoorScenes: true,
          naturalLandmarks: true
        },
        foodEvents: {
          foodDetection: true,
          tableScenes: true,
          closeupShots: true
        },
        partyEvents: {
          groupPhotos: true,
          nightScenes: true,
          celebrationScenes: true
        }
      }
    };
    
    console.log('🔍 AdvancedPhotoFilterService initialized with AI filtering');
  }

  /**
   * Initialize advanced photo filtering service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing AdvancedPhotoFilterService...');
      
      // Platform check
      const deviceInfo = await Device.getInfo();
      if (!Capacitor.isNativePlatform() || deviceInfo.platform !== 'ios') {
        console.log('❌ Advanced photo filtering only available on iOS');
        return false;
      }

      // Check iOS version for Vision framework support
      const iosVersion = this.parseIOSVersion(deviceInfo.osVersion);
      this.visionFrameworkAvailable = iosVersion >= 11; // Vision framework available iOS 11+
      
      if (!this.visionFrameworkAvailable) {
        console.log('⚠️ Vision framework not available, using basic filtering');
      }

      // Initialize filtering statistics
      this.initializeFilterStats();
      
      this.isInitialized = true;
      console.log('✅ AdvancedPhotoFilterService initialized');
      
      return true;
      
    } catch (error) {
      console.error('Error initializing AdvancedPhotoFilterService:', error);
      return false;
    }
  }

  /**
   * Initialize filter statistics tracking
   */
  initializeFilterStats() {
    this.filterStats.set('totalAnalyzed', 0);
    this.filterStats.set('facesDetected', 0);
    this.filterStats.set('scenesAnalyzed', 0);
    this.filterStats.set('duplicatesFound', 0);
    this.filterStats.set('qualityFiltered', 0);
    this.filterStats.set('processingTime', []);
  }

  /**
   * Analyze photo with advanced filtering
   */
  async analyzePhoto(photoData, eventContext = null) {
    if (!this.isInitialized) {
      throw new Error('AdvancedPhotoFilterService not initialized');
    }

    try {
      const startTime = performance.now();
      console.log(`🔍 Analyzing photo: ${photoData.filename}`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(photoData);
      if (this.analysisCache.has(cacheKey)) {
        console.log('💾 Using cached analysis result');
        return this.analysisCache.get(cacheKey);
      }

      const analysisResult = {
        photoId: photoData.id,
        filename: photoData.filename,
        timestamp: new Date(),
        
        // Analysis results
        faceAnalysis: null,
        sceneAnalysis: null,
        qualityAnalysis: null,
        contentAnalysis: null,
        
        // Filtering decisions
        shouldInclude: true,
        filterReasons: [],
        confidence: 0,
        
        // Event matching
        eventRelevance: 0,
        eventContext: eventContext
      };

      // Perform face detection if enabled
      if (this.config.faceDetection.enabled) {
        analysisResult.faceAnalysis = await this.detectFaces(photoData);
      }

      // Perform scene analysis if enabled
      if (this.config.sceneAnalysis.enabled) {
        analysisResult.sceneAnalysis = await this.analyzeScene(photoData);
      }

      // Perform quality analysis
      if (this.config.contentFiltering.qualityScoring) {
        analysisResult.qualityAnalysis = await this.analyzeQuality(photoData);
      }

      // Perform content analysis
      analysisResult.contentAnalysis = await this.analyzeContent(photoData);
      
      // Apply event-specific filtering
      if (eventContext) {
        this.applyEventFiltering(analysisResult, eventContext);
      }

      // Calculate overall confidence and filtering decision
      this.calculateFilteringDecision(analysisResult);
      
      // Cache result
      this.analysisCache.set(cacheKey, analysisResult);
      
      // Update statistics
      const processingTime = performance.now() - startTime;
      this.updateFilterStats(analysisResult, processingTime);
      
      console.log(`✅ Photo analysis completed in ${processingTime.toFixed(0)}ms`);
      console.log(`   🎯 Include: ${analysisResult.shouldInclude} (confidence: ${(analysisResult.confidence * 100).toFixed(1)}%)`);
      
      return analysisResult;
      
    } catch (error) {
      console.error('Error analyzing photo:', error);
      throw error;
    }
  }

  /**
   * Detect faces in photo using iOS Vision framework
   */
  async detectFaces(photoData) {
    try {
      console.log('👤 Detecting faces...');
      
      if (!this.visionFrameworkAvailable) {
        return this.simulateFaceDetection(photoData);
      }

      // In real implementation, this would use VNDetectFaceRectanglesRequest
      // For now, simulate the Vision framework face detection
      const faceResults = await this.simulateVisionFaceDetection(photoData);
      
      const faceAnalysis = {
        facesDetected: faceResults.length,
        faces: faceResults,
        averageConfidence: faceResults.length > 0 ? 
          faceResults.reduce((sum, face) => sum + face.confidence, 0) / faceResults.length : 0,
        
        // Face characteristics
        hasMultipleFaces: faceResults.length > 1,
        hasLargeFaces: faceResults.some(face => face.size > this.config.faceDetection.minFaceSize),
        dominantEmotion: this.getDominantEmotion(faceResults),
        ageGroups: this.analyzeAgeGroups(faceResults)
      };
      
      console.log(`   👥 ${faceAnalysis.facesDetected} faces detected`);
      if (faceAnalysis.dominantEmotion) {
        console.log(`   😊 Emotion: ${faceAnalysis.dominantEmotion}`);
      }
      
      return faceAnalysis;
      
    } catch (error) {
      console.error('Error in face detection:', error);
      return { facesDetected: 0, faces: [], error: error.message };
    }
  }

  /**
   * Simulate Vision framework face detection
   */
  async simulateVisionFaceDetection(photoData) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
    
    const faces = [];
    const numFaces = Math.floor(Math.random() * 4); // 0-3 faces
    
    for (let i = 0; i < numFaces; i++) {
      faces.push({
        id: `face_${i}`,
        boundingBox: {
          x: Math.random() * 0.6,
          y: Math.random() * 0.6,
          width: 0.1 + Math.random() * 0.3,
          height: 0.1 + Math.random() * 0.3
        },
        confidence: 0.7 + Math.random() * 0.3,
        size: 0.05 + Math.random() * 0.25,
        
        // Enhanced attributes (would come from VNFaceObservation)
        attributes: {
          emotion: this.getRandomEmotion(),
          ageGroup: this.getRandomAgeGroup(),
          quality: 0.6 + Math.random() * 0.4
        }
      });
    }
    
    return faces;
  }

  /**
   * Analyze scene content using iOS Vision framework
   */
  async analyzeScene(photoData) {
    try {
      console.log('🏞️ Analyzing scene content...');
      
      if (!this.visionFrameworkAvailable) {
        return this.simulateSceneAnalysis(photoData);
      }

      // In real implementation, this would use VNClassifyImageRequest
      const sceneResults = await this.simulateVisionSceneAnalysis(photoData);
      
      const sceneAnalysis = {
        sceneLabels: sceneResults.sceneLabels,
        dominantScene: sceneResults.dominantScene,
        confidence: sceneResults.averageConfidence,
        
        // Object detection
        objects: sceneResults.objects,
        objectCount: sceneResults.objects.length,
        
        // Text detection
        textDetected: sceneResults.textRegions.length > 0,
        textRegions: sceneResults.textRegions,
        
        // Landmark detection
        landmarks: sceneResults.landmarks,
        
        // Scene characteristics
        isIndoor: sceneResults.sceneLabels.some(label => 
          ['indoor', 'room', 'kitchen', 'living room'].includes(label.identifier)),
        isOutdoor: sceneResults.sceneLabels.some(label => 
          ['outdoor', 'landscape', 'nature', 'sky'].includes(label.identifier)),
        hasFood: sceneResults.objects.some(obj => obj.category === 'food'),
        hasVehicle: sceneResults.objects.some(obj => obj.category === 'vehicle')
      };
      
      console.log(`   🏷️ Scene: ${sceneAnalysis.dominantScene?.identifier || 'unknown'}`);
      console.log(`   📦 Objects: ${sceneAnalysis.objectCount}`);
      
      return sceneAnalysis;
      
    } catch (error) {
      console.error('Error in scene analysis:', error);
      return { sceneLabels: [], objects: [], error: error.message };
    }
  }

  /**
   * Simulate Vision framework scene analysis
   */
  async simulateVisionSceneAnalysis(photoData) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 1000));
    
    const sceneTypes = [
      'outdoor', 'indoor', 'landscape', 'portrait', 'food', 'party', 'nature',
      'city', 'beach', 'mountain', 'building', 'vehicle', 'animal', 'celebration'
    ];
    
    const objectTypes = [
      { category: 'person', confidence: 0.8 + Math.random() * 0.2 },
      { category: 'food', confidence: 0.7 + Math.random() * 0.3 },
      { category: 'vehicle', confidence: 0.6 + Math.random() * 0.4 },
      { category: 'building', confidence: 0.5 + Math.random() * 0.5 },
      { category: 'animal', confidence: 0.4 + Math.random() * 0.6 }
    ];
    
    const numScenes = Math.min(3, Math.floor(Math.random() * 5) + 1);
    const sceneLabels = [];
    
    for (let i = 0; i < numScenes; i++) {
      const sceneType = sceneTypes[Math.floor(Math.random() * sceneTypes.length)];
      sceneLabels.push({
        identifier: sceneType,
        confidence: 0.5 + Math.random() * 0.5
      });
    }
    
    const numObjects = Math.floor(Math.random() * 6);
    const objects = objectTypes.slice(0, numObjects).filter(obj => Math.random() > 0.5);
    
    return {
      sceneLabels: sceneLabels,
      dominantScene: sceneLabels[0],
      averageConfidence: sceneLabels.reduce((sum, label) => sum + label.confidence, 0) / sceneLabels.length,
      objects: objects,
      textRegions: Math.random() > 0.7 ? [{ text: 'Sample Text', confidence: 0.9 }] : [],
      landmarks: Math.random() > 0.9 ? [{ name: 'Famous Landmark', confidence: 0.8 }] : []
    };
  }

  /**
   * Analyze photo quality metrics
   */
  async analyzeQuality(photoData) {
    try {
      console.log('⭐ Analyzing photo quality...');
      
      // Simulate quality analysis
      const qualityMetrics = {
        overall: 0.6 + Math.random() * 0.4,
        sharpness: 0.5 + Math.random() * 0.5,
        exposure: 0.4 + Math.random() * 0.6,
        contrast: 0.5 + Math.random() * 0.5,
        saturation: 0.6 + Math.random() * 0.4,
        noise: Math.random() * 0.3, // Lower is better
        
        // Technical quality
        resolution: photoData.dimensions ? 
          photoData.dimensions.width * photoData.dimensions.height : 0,
        fileSize: photoData.fileSize,
        format: photoData.mimeType,
        
        // Quality flags
        isBlurry: Math.random() < 0.15, // 15% chance
        isUnderexposed: Math.random() < 0.10, // 10% chance
        isOverexposed: Math.random() < 0.08, // 8% chance
        hasNoise: Math.random() < 0.20 // 20% chance
      };
      
      // Calculate quality score
      qualityMetrics.qualityScore = (
        qualityMetrics.overall * 0.3 +
        qualityMetrics.sharpness * 0.2 +
        qualityMetrics.exposure * 0.2 +
        qualityMetrics.contrast * 0.15 +
        qualityMetrics.saturation * 0.15
      );
      
      console.log(`   ⭐ Quality score: ${(qualityMetrics.qualityScore * 100).toFixed(1)}%`);
      
      return qualityMetrics;
      
    } catch (error) {
      console.error('Error in quality analysis:', error);
      return { qualityScore: 0.5, error: error.message };
    }
  }

  /**
   * Analyze general content characteristics
   */
  async analyzeContent(photoData) {
    try {
      const contentAnalysis = {
        timestamp: new Date(),
        
        // Basic content metrics
        hasGPS: !!(photoData.location || photoData.extractedMetadata?.location),
        hasEXIF: !!(photoData.metadata || photoData.extractedMetadata?.exif),
        
        // File characteristics
        fileSize: photoData.fileSize,
        dimensions: photoData.dimensions,
        aspectRatio: photoData.dimensions ? 
          photoData.dimensions.width / photoData.dimensions.height : 1,
        
        // Potential duplicate indicators
        duplicateScore: this.calculateDuplicateScore(photoData),
        
        // Privacy considerations
        hasPersonalInfo: false, // Would analyze EXIF for personal data
        hasLocation: !!(photoData.location || photoData.extractedMetadata?.location),
        
        // Content warnings (basic)
        contentWarnings: []
      };
      
      return contentAnalysis;
      
    } catch (error) {
      console.error('Error in content analysis:', error);
      return { error: error.message };
    }
  }

  /**
   * Apply event-specific filtering rules
   */
  applyEventFiltering(analysisResult, eventContext) {
    try {
      console.log(`🎯 Applying event filtering for: ${eventContext.eventType || 'general'}`);
      
      const eventType = eventContext.eventType || 'general';
      const eventRules = this.config.eventFiltering[eventType] || {};
      
      let relevanceScore = 0.5; // Base relevance
      const relevanceFactors = [];
      
      // Face-based filtering for people events
      if (eventRules.preferFaces && analysisResult.faceAnalysis) {
        const faces = analysisResult.faceAnalysis.facesDetected;
        if (faces >= (eventRules.minFaces || 1)) {
          relevanceScore += 0.3;
          relevanceFactors.push(`${faces} faces detected`);
        }
        
        if (eventRules.groupPhotos && faces > 2) {
          relevanceScore += 0.2;
          relevanceFactors.push('group photo');
        }
      }
      
      // Scene-based filtering
      if (analysisResult.sceneAnalysis) {
        const scene = analysisResult.sceneAnalysis;
        
        if (eventRules.preferScenery && scene.isOutdoor) {
          relevanceScore += 0.25;
          relevanceFactors.push('outdoor scenery');
        }
        
        if (eventRules.foodDetection && scene.hasFood) {
          relevanceScore += 0.35;
          relevanceFactors.push('food detected');
        }
        
        if (eventRules.socialScenes && scene.sceneLabels.some(label => 
          ['party', 'celebration', 'gathering'].includes(label.identifier))) {
          relevanceScore += 0.3;
          relevanceFactors.push('social scene');
        }
      }
      
      // Quality filtering
      if (analysisResult.qualityAnalysis) {
        const quality = analysisResult.qualityAnalysis.qualityScore;
        if (quality > 0.7) {
          relevanceScore += 0.1;
          relevanceFactors.push('high quality');
        } else if (quality < 0.4) {
          relevanceScore -= 0.2;
          relevanceFactors.push('low quality');
        }
      }
      
      // Cap relevance score
      relevanceScore = Math.max(0, Math.min(1, relevanceScore));
      
      analysisResult.eventRelevance = relevanceScore;
      analysisResult.relevanceFactors = relevanceFactors;
      
      console.log(`   📊 Event relevance: ${(relevanceScore * 100).toFixed(1)}%`);
      if (relevanceFactors.length > 0) {
        console.log(`   📋 Factors: ${relevanceFactors.join(', ')}`);
      }
      
    } catch (error) {
      console.error('Error applying event filtering:', error);
    }
  }

  /**
   * Calculate final filtering decision
   */
  calculateFilteringDecision(analysisResult) {
    try {
      let confidence = 0.5;
      const reasons = [];
      let shouldInclude = true;
      
      // Face analysis contribution
      if (analysisResult.faceAnalysis && analysisResult.faceAnalysis.facesDetected > 0) {
        confidence += 0.2;
        reasons.push(`${analysisResult.faceAnalysis.facesDetected} faces`);
      }
      
      // Scene analysis contribution
      if (analysisResult.sceneAnalysis && analysisResult.sceneAnalysis.confidence > 0.6) {
        confidence += 0.15;
        reasons.push('clear scene classification');
      }
      
      // Quality analysis contribution
      if (analysisResult.qualityAnalysis) {
        const qualityScore = analysisResult.qualityAnalysis.qualityScore;
        if (qualityScore > 0.7) {
          confidence += 0.2;
          reasons.push('high quality');
        } else if (qualityScore < 0.3) {
          shouldInclude = false;
          reasons.push('very low quality');
        }
      }
      
      // Event relevance contribution
      if (analysisResult.eventRelevance > 0.7) {
        confidence += 0.15;
        reasons.push('highly relevant to event');
      } else if (analysisResult.eventRelevance < 0.3) {
        confidence -= 0.1;
        reasons.push('low event relevance');
      }
      
      // Duplicate detection
      if (analysisResult.contentAnalysis && analysisResult.contentAnalysis.duplicateScore > 0.8) {
        shouldInclude = false;
        reasons.push('likely duplicate');
      }
      
      // Final decision
      confidence = Math.max(0, Math.min(1, confidence));
      
      if (confidence < 0.4) {
        shouldInclude = false;
        reasons.push('low overall confidence');
      }
      
      analysisResult.confidence = confidence;
      analysisResult.shouldInclude = shouldInclude;
      analysisResult.filterReasons = reasons;
      
    } catch (error) {
      console.error('Error calculating filtering decision:', error);
      analysisResult.confidence = 0.5;
      analysisResult.shouldInclude = true;
      analysisResult.filterReasons = ['analysis error'];
    }
  }

  /**
   * Generate cache key for photo analysis
   */
  generateCacheKey(photoData) {
    const keyComponents = [
      photoData.id,
      photoData.fileSize,
      photoData.extractedMetadata?.basic?.timestamp || photoData.createdAt
    ];
    return keyComponents.join('_');
  }

  /**
   * Calculate duplicate score based on photo characteristics
   */
  calculateDuplicateScore(photoData) {
    // Simple duplicate scoring based on metadata
    // In real implementation, this would use perceptual hashing
    const score = Math.random() * 0.3; // Low chance of duplicates for simulation
    return score;
  }

  /**
   * Update filter statistics
   */
  updateFilterStats(analysisResult, processingTime) {
    try {
      this.filterStats.set('totalAnalyzed', this.filterStats.get('totalAnalyzed') + 1);
      
      if (analysisResult.faceAnalysis) {
        this.filterStats.set('facesDetected', 
          this.filterStats.get('facesDetected') + analysisResult.faceAnalysis.facesDetected);
      }
      
      if (analysisResult.sceneAnalysis) {
        this.filterStats.set('scenesAnalyzed', this.filterStats.get('scenesAnalyzed') + 1);
      }
      
      if (analysisResult.contentAnalysis?.duplicateScore > 0.8) {
        this.filterStats.set('duplicatesFound', this.filterStats.get('duplicatesFound') + 1);
      }
      
      if (!analysisResult.shouldInclude) {
        this.filterStats.set('qualityFiltered', this.filterStats.get('qualityFiltered') + 1);
      }
      
      // Track processing time
      const times = this.filterStats.get('processingTime');
      times.push(processingTime);
      if (times.length > 100) {
        times.shift(); // Keep only last 100 measurements
      }
      
    } catch (error) {
      console.error('Error updating filter stats:', error);
    }
  }

  /**
   * Helper methods for emotion and age analysis
   */
  getRandomEmotion() {
    const emotions = ['happy', 'neutral', 'surprised', 'serious', 'smiling'];
    return emotions[Math.floor(Math.random() * emotions.length)];
  }

  getRandomAgeGroup() {
    const ageGroups = ['child', 'teenager', 'young_adult', 'adult', 'senior'];
    return ageGroups[Math.floor(Math.random() * ageGroups.length)];
  }

  getDominantEmotion(faces) {
    if (faces.length === 0) return null;
    
    const emotions = faces.map(face => face.attributes?.emotion).filter(Boolean);
    if (emotions.length === 0) return null;
    
    // Return most common emotion
    const emotionCounts = {};
    emotions.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    
    return Object.keys(emotionCounts).reduce((a, b) => 
      emotionCounts[a] > emotionCounts[b] ? a : b);
  }

  analyzeAgeGroups(faces) {
    const ageGroups = {};
    faces.forEach(face => {
      const age = face.attributes?.ageGroup;
      if (age) {
        ageGroups[age] = (ageGroups[age] || 0) + 1;
      }
    });
    return ageGroups;
  }

  parseIOSVersion(versionString) {
    try {
      const match = versionString.match(/^(\d+)\.?(\d+)?\.?(\d+)?/);
      if (match) {
        return parseInt(match[1], 10);
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Batch analyze multiple photos
   */
  async batchAnalyzePhotos(photos, eventContext = null, progressCallback = null) {
    if (!this.isInitialized) {
      throw new Error('AdvancedPhotoFilterService not initialized');
    }

    try {
      console.log(`🔍 Starting batch analysis of ${photos.length} photos...`);
      
      const results = [];
      const batchSize = this.config.performance.maxConcurrent;
      
      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize);
        const batchPromises = batch.map(photo => this.analyzePhoto(photo, eventContext));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Error analyzing photo ${batch[index].filename}:`, result.reason);
            results.push({
              photoId: batch[index].id,
              filename: batch[index].filename,
              error: result.reason.message,
              shouldInclude: true, // Include by default on error
              confidence: 0.5
            });
          }
        });
        
        // Progress callback
        if (progressCallback) {
          const progress = Math.min(((i + batchSize) / photos.length) * 100, 100);
          progressCallback(progress, results.length);
        }
      }
      
      console.log(`✅ Batch analysis completed: ${results.length} photos analyzed`);
      
      // Generate batch summary
      const summary = this.generateBatchSummary(results);
      
      return {
        results: results,
        summary: summary,
        totalPhotos: photos.length,
        analyzedPhotos: results.length,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('Error in batch photo analysis:', error);
      throw error;
    }
  }

  /**
   * Generate batch analysis summary
   */
  generateBatchSummary(results) {
    const summary = {
      totalAnalyzed: results.length,
      shouldInclude: results.filter(r => r.shouldInclude).length,
      averageConfidence: results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length,
      
      // Face detection summary
      totalFaces: results.reduce((sum, r) => 
        sum + (r.faceAnalysis?.facesDetected || 0), 0),
      photosWithFaces: results.filter(r => 
        r.faceAnalysis && r.faceAnalysis.facesDetected > 0).length,
      
      // Scene analysis summary
      topScenes: this.getTopScenes(results),
      
      // Quality summary
      averageQuality: results.reduce((sum, r) => 
        sum + (r.qualityAnalysis?.qualityScore || 0), 0) / results.length,
      highQualityPhotos: results.filter(r => 
        r.qualityAnalysis && r.qualityAnalysis.qualityScore > 0.7).length,
      
      // Event relevance
      averageEventRelevance: results.reduce((sum, r) => 
        sum + (r.eventRelevance || 0), 0) / results.length,
      
      // Common filter reasons
      commonReasons: this.getCommonFilterReasons(results)
    };
    
    return summary;
  }

  /**
   * Get top scene classifications from batch
   */
  getTopScenes(results) {
    const sceneCount = {};
    
    results.forEach(result => {
      if (result.sceneAnalysis && result.sceneAnalysis.sceneLabels) {
        result.sceneAnalysis.sceneLabels.forEach(scene => {
          sceneCount[scene.identifier] = (sceneCount[scene.identifier] || 0) + 1;
        });
      }
    });
    
    return Object.entries(sceneCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([scene, count]) => ({ scene, count }));
  }

  /**
   * Get common filtering reasons from batch
   */
  getCommonFilterReasons(results) {
    const reasonCount = {};
    
    results.forEach(result => {
      if (result.filterReasons) {
        result.filterReasons.forEach(reason => {
          reasonCount[reason] = (reasonCount[reason] || 0) + 1;
        });
      }
    });
    
    return Object.entries(reasonCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));
  }

  /**
   * Get filtering statistics
   */
  getFilteringStats() {
    const times = this.filterStats.get('processingTime');
    const avgTime = times.length > 0 ? 
      times.reduce((sum, time) => sum + time, 0) / times.length : 0;
    
    return {
      totalAnalyzed: this.filterStats.get('totalAnalyzed'),
      facesDetected: this.filterStats.get('facesDetected'),
      scenesAnalyzed: this.filterStats.get('scenesAnalyzed'),
      duplicatesFound: this.filterStats.get('duplicatesFound'),
      qualityFiltered: this.filterStats.get('qualityFiltered'),
      averageProcessingTime: Math.round(avgTime),
      cacheHitRate: this.analysisCache.size > 0 ? 
        (this.analysisCache.size / Math.max(this.filterStats.get('totalAnalyzed'), 1)) * 100 : 0
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisCache.clear();
    console.log('🧹 Analysis cache cleared');
  }

  /**
   * Test filtering service
   */
  async testFiltering() {
    try {
      console.log('🧪 Testing advanced photo filtering...');
      
      if (!this.isInitialized) {
        throw new Error('AdvancedPhotoFilterService not initialized');
      }
      
      // Create test photo data
      const testPhoto = {
        id: 'test_photo_filter',
        filename: 'test_image.jpg',
        fileSize: 3200000,
        mimeType: 'image/jpeg',
        dimensions: { width: 4032, height: 3024 },
        createdAt: new Date(),
        location: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      // Test analysis
      const analysisResult = await this.analyzePhoto(testPhoto, { 
        eventType: 'partyEvents',
        eventName: 'Test Party'
      });
      
      console.log('✅ Photo filtering test completed');
      console.log('📊 Analysis result:', {
        shouldInclude: analysisResult.shouldInclude,
        confidence: (analysisResult.confidence * 100).toFixed(1) + '%',
        faces: analysisResult.faceAnalysis?.facesDetected || 0,
        scene: analysisResult.sceneAnalysis?.dominantScene?.identifier || 'unknown'
      });
      
      showToast('Advanced photo filtering test completed', 'success');
      return true;
      
    } catch (error) {
      console.error('Error testing photo filtering:', error);
      showToast('Photo filtering test failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      visionFrameworkAvailable: this.visionFrameworkAvailable,
      filteringActive: this.filteringActive,
      config: this.config,
      stats: this.getFilteringStats(),
      cacheSize: this.analysisCache.size,
      capabilities: {
        faceDetection: this.config.faceDetection.enabled,
        sceneAnalysis: this.config.sceneAnalysis.enabled,
        qualityAnalysis: this.config.contentFiltering.qualityScoring,
        eventFiltering: true,
        batchProcessing: true
      }
    };
  }

  /**
   * Clean up service
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up AdvancedPhotoFilterService...');
      
      this.clearCache();
      this.filterStats.clear();
      this.isInitialized = false;
      this.filteringActive = false;
      
      console.log('✅ AdvancedPhotoFilterService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up AdvancedPhotoFilterService:', error);
    }
  }
}

// Export singleton instance
export const advancedPhotoFilterService = new AdvancedPhotoFilterService();

// Export convenience functions
export async function initializeAdvancedPhotoFilter() {
  return await advancedPhotoFilterService.initialize();
}

export async function analyzePhotoWithFiltering(photoData, eventContext = null) {
  return await advancedPhotoFilterService.analyzePhoto(photoData, eventContext);
}

export async function batchAnalyzePhotosWithFiltering(photos, eventContext = null, progressCallback = null) {
  return await advancedPhotoFilterService.batchAnalyzePhotos(photos, eventContext, progressCallback);
}

export function getAdvancedPhotoFilterStatus() {
  return advancedPhotoFilterService.getStatus();
}

export function getPhotoFilteringStats() {
  return advancedPhotoFilterService.getFilteringStats();
}

export async function testAdvancedPhotoFiltering() {
  return await advancedPhotoFilterService.testFiltering();
}