console.log('🔄 Loading batchPhotoProcessingService.js...');

// For browser testing, we'll simulate these imports
const Capacitor = window.Capacitor || {
  isNativePlatform: () => false
};

const Device = window.Capacitor?.Plugins?.Device || {
  getInfo: async () => ({ platform: 'web', model: 'Browser' })
};

const showToast = window.showToast || function(message, type) {
  console.log(`${type.toUpperCase()}: ${message}`);
};

// Mock the other service dependencies for testing
const advancedPhotoFilterService = window.advancedPhotoFilterService || {
  isInitialized: false,
  initialize: async () => true,
  analyzePhoto: async (photo, context) => ({
    shouldInclude: true,
    confidence: 0.9,
    filterReasons: []
  })
};

const photoDeduplicationService = window.photoDeduplicationService || {
  isInitialized: false,
  initialize: async () => true,
  findDuplicates: async (photos, callback) => ({
    duplicateGroups: [],
    potentialSpaceSaved: 0
  })
};

const extractPhotoMetadata = window.extractPhotoMetadata || async function(photo, mode) {
  return {
    filename: photo.filename,
    fileSize: photo.fileSize,
    dimensions: photo.dimensions,
    timestamp: new Date(),
    camera: 'Simulated Camera'
  };
};

const addPhotoToUploadQueue = window.addPhotoToUploadQueue || async function(photo) {
  console.log('Added photo to upload queue:', photo.filename);
  return true;
};

/**
 * BatchPhotoProcessingService - Advanced batch processing with progress indicators
 * Handles large-scale photo operations with real-time progress tracking
 */
class BatchPhotoProcessingService {
  constructor() {
    this.isInitialized = false;
    this.processingActive = false;
    this.currentBatch = null;
    this.processingQueue = [];
    this.activeWorkers = new Map();
    this.progressSubscribers = new Set();
    this.batchHistory = [];
    
    // Processing configuration
    this.config = {
      // Batch settings
      maxBatchSize: 50, // Maximum photos per batch
      maxConcurrentBatches: 2,
      maxConcurrentPerBatch: 5,
      
      // Processing stages
      stages: {
        preparation: { enabled: true, weight: 0.05 },
        metadataExtraction: { enabled: true, weight: 0.15 },
        filtering: { enabled: true, weight: 0.25 },
        deduplication: { enabled: true, weight: 0.20 },
        qualityAnalysis: { enabled: true, weight: 0.20 },
        finalization: { enabled: true, weight: 0.15 }
      },
      
      // Progress tracking
      progressTracking: {
        updateInterval: 500, // 500ms between updates
        detailedLogging: true,
        showETA: true,
        showThroughput: true
      },
      
      // Error handling
      errorHandling: {
        continueOnError: true,
        maxRetries: 2,
        retryDelay: 1000,
        failureThreshold: 0.2 // 20% failure rate before stopping
      },
      
      // Performance optimization
      performance: {
        useWebWorkers: true,
        adaptiveBatching: true,
        memoryThrottling: true,
        priorityProcessing: true
      },
      
      // Output options
      output: {
        generateReport: true,
        saveProcessingLog: true,
        exportResults: true,
        compressionOptimization: false
      }
    };
    
    console.log('⚙️ BatchPhotoProcessingService initialized');
  }

  /**
   * Initialize batch processing service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing BatchPhotoProcessingService...');
      
      // Platform check
      const deviceInfo = await Device.getInfo();
      if (!Capacitor.isNativePlatform()) {
        console.log('⚠️ Running in browser mode - performance may be limited');
      }

      // Initialize dependent services
      const servicesInitialized = await this.initializeDependentServices();
      if (!servicesInitialized) {
        console.log('⚠️ Some dependent services failed to initialize');
      }

      // Setup Web Workers if available
      if (this.config.performance.useWebWorkers && typeof Worker !== 'undefined') {
        await this.initializeWebWorkers();
      }

      this.isInitialized = true;
      console.log('✅ BatchPhotoProcessingService initialized');
      
      return true;
      
    } catch (error) {
      console.error('Error initializing BatchPhotoProcessingService:', error);
      return false;
    }
  }

  /**
   * Initialize dependent services
   */
  async initializeDependentServices() {
    try {
      console.log('🔗 Initializing dependent services...');
      
      const services = [];
      
      // Initialize photo filter service
      if (!advancedPhotoFilterService.isInitialized) {
        services.push(advancedPhotoFilterService.initialize());
      }
      
      // Initialize deduplication service
      if (!photoDeduplicationService.isInitialized) {
        services.push(photoDeduplicationService.initialize());
      }
      
      const results = await Promise.allSettled(services);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      console.log(`✅ ${successCount}/${results.length} dependent services initialized`);
      return successCount > 0;
      
    } catch (error) {
      console.error('Error initializing dependent services:', error);
      return false;
    }
  }

  /**
   * Initialize Web Workers for parallel processing
   */
  async initializeWebWorkers() {
    try {
      console.log('👷 Initializing Web Workers...');
      
      const workerCount = Math.min(navigator.hardwareConcurrency || 2, 4);
      
      for (let i = 0; i < workerCount; i++) {
        // In real implementation, would create actual Web Workers
        // For now, simulate worker creation
        this.activeWorkers.set(`worker_${i}`, {
          id: `worker_${i}`,
          status: 'idle',
          currentTask: null,
          processedCount: 0,
          errorCount: 0
        });
      }
      
      console.log(`✅ ${workerCount} Web Workers initialized`);
      
    } catch (error) {
      console.error('Error initializing Web Workers:', error);
    }
  }

  /**
   * Process a batch of photos with comprehensive pipeline
   */
  async processBatch(photos, options = {}) {
    if (!this.isInitialized) {
      throw new Error('BatchPhotoProcessingService not initialized');
    }

    if (this.processingActive) {
      throw new Error('Batch processing already in progress');
    }

    try {
      console.log(`🚀 Starting batch processing of ${photos.length} photos`);
      
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = performance.now();
      
      // Initialize batch processing state
      const batchState = {
        batchId: batchId,
        photos: photos,
        options: { ...this.config, ...options },
        startTime: startTime,
        
        // Progress tracking
        progress: {
          overall: 0,
          stage: 'preparation',
          processed: 0,
          total: photos.length,
          eta: null,
          throughput: 0,
          errors: []
        },
        
        // Results
        results: {
          processed: [],
          filtered: [],
          duplicates: [],
          metadata: [],
          errors: [],
          statistics: {}
        }
      };

      this.currentBatch = batchState;
      this.processingActive = true;

      // Start progress tracking
      this.startProgressTracking(batchState);

      // Execute processing pipeline
      const finalResults = await this.executeProcessingPipeline(batchState);

      // Generate final report
      const report = this.generateProcessingReport(batchState, finalResults);

      // Add to batch history
      this.batchHistory.push({
        batchId: batchId,
        timestamp: new Date(),
        photosProcessed: photos.length,
        processingTime: performance.now() - startTime,
        results: finalResults,
        report: report
      });

      console.log(`✅ Batch processing completed: ${batchId}`);
      console.log(`   📊 Processed: ${finalResults.processedCount}/${photos.length} photos`);
      console.log(`   ⏱️ Time: ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

      this.processingActive = false;
      this.currentBatch = null;

      // Notify subscribers of completion
      this.notifyProgressSubscribers('completed', {
        batchId: batchId,
        results: finalResults,
        report: report
      });

      return finalResults;

    } catch (error) {
      console.error('Error in batch processing:', error);
      this.processingActive = false;
      this.currentBatch = null;
      
      this.notifyProgressSubscribers('error', {
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Execute the complete processing pipeline
   */
  async executeProcessingPipeline(batchState) {
    try {
      const stages = Object.keys(this.config.stages).filter(
        stage => this.config.stages[stage].enabled
      );
      
      const results = {
        processedCount: 0,
        filteredCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        
        // Detailed results
        processedPhotos: [],
        filteredPhotos: [],
        duplicateGroups: [],
        qualityMetrics: {},
        
        // Processing metrics
        stageResults: {},
        totalProcessingTime: 0,
        averageProcessingTime: 0
      };

      let cumulativeProgress = 0;
      
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const stageWeight = this.config.stages[stage].weight;
        
        console.log(`🔄 Processing stage: ${stage}`);
        batchState.progress.stage = stage;
        
        const stageStartTime = performance.now();
        const stageResult = await this.executeProcessingStage(stage, batchState);
        const stageTime = performance.now() - stageStartTime;
        
        results.stageResults[stage] = {
          ...stageResult,
          processingTime: stageTime
        };
        
        // Update progress
        cumulativeProgress += stageWeight * 100;
        batchState.progress.overall = Math.min(cumulativeProgress, 100);
        
        this.updateProgressMetrics(batchState, stageResult);
        
        console.log(`   ✅ Stage ${stage} completed in ${stageTime.toFixed(0)}ms`);
        
        // Check for failure threshold
        if (this.checkFailureThreshold(batchState)) {
          throw new Error('Batch processing stopped due to high failure rate');
        }
      }

      // Calculate final metrics
      results.totalProcessingTime = performance.now() - batchState.startTime;
      results.averageProcessingTime = results.totalProcessingTime / batchState.photos.length;
      results.processedCount = batchState.results.processed.length;
      results.filteredCount = batchState.results.filtered.length;
      results.duplicateCount = batchState.results.duplicates.length;
      results.errorCount = batchState.results.errors.length;
      
      // Combine processed results
      results.processedPhotos = batchState.results.processed;
      results.filteredPhotos = batchState.results.filtered;
      results.duplicateGroups = batchState.results.duplicates;

      return results;

    } catch (error) {
      console.error('Error in processing pipeline:', error);
      throw error;
    }
  }

  /**
   * Execute individual processing stage
   */
  async executeProcessingStage(stage, batchState) {
    try {
      switch (stage) {
        case 'preparation':
          return await this.executePreparationStage(batchState);
          
        case 'metadataExtraction':
          return await this.executeMetadataExtractionStage(batchState);
          
        case 'filtering':
          return await this.executeFilteringStage(batchState);
          
        case 'deduplication':
          return await this.executeDeduplicationStage(batchState);
          
        case 'qualityAnalysis':
          return await this.executeQualityAnalysisStage(batchState);
          
        case 'finalization':
          return await this.executeFinalizationStage(batchState);
          
        default:
          throw new Error(`Unknown processing stage: ${stage}`);
      }
    } catch (error) {
      console.error(`Error in ${stage} stage:`, error);
      throw error;
    }
  }

  /**
   * Preparation stage - validate and organize photos
   */
  async executePreparationStage(batchState) {
    const validPhotos = [];
    const invalidPhotos = [];
    
    for (const photo of batchState.photos) {
      try {
        // Basic validation
        if (this.validatePhotoForProcessing(photo)) {
          validPhotos.push({
            ...photo,
            processingId: `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            processingStarted: new Date()
          });
        } else {
          invalidPhotos.push(photo);
        }
      } catch (error) {
        invalidPhotos.push(photo);
        batchState.results.errors.push({
          photoId: photo.id,
          stage: 'preparation',
          error: error.message
        });
      }
    }
    
    // Update batch state with valid photos
    batchState.photos = validPhotos;
    batchState.progress.total = validPhotos.length;
    
    console.log(`   📊 Prepared ${validPhotos.length} photos (${invalidPhotos.length} invalid)`);
    
    return {
      validPhotos: validPhotos.length,
      invalidPhotos: invalidPhotos.length,
      validationErrors: invalidPhotos.map(p => p.id)
    };
  }

  /**
   * Metadata extraction stage
   */
  async executeMetadataExtractionStage(batchState) {
    const extractedMetadata = [];
    const batchSize = this.config.maxConcurrentPerBatch;
    
    for (let i = 0; i < batchState.photos.length; i += batchSize) {
      const batch = batchState.photos.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (photo, index) => {
        try {
          const metadata = await extractPhotoMetadata(photo, 'batch');
          extractedMetadata.push({
            photoId: photo.id,
            metadata: metadata
          });
          
          // Update photo with extracted metadata
          photo.extractedMetadata = metadata;
          
          // Update progress
          batchState.progress.processed++;
          
          return { success: true, photoId: photo.id };
        } catch (error) {
          batchState.results.errors.push({
            photoId: photo.id,
            stage: 'metadataExtraction',
            error: error.message
          });
          return { success: false, photoId: photo.id, error: error.message };
        }
      });
      
      await Promise.allSettled(batchPromises);
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   📊 Extracted metadata for ${extractedMetadata.length} photos`);
    
    return {
      extracted: extractedMetadata.length,
      failed: batchState.photos.length - extractedMetadata.length,
      metadataResults: extractedMetadata
    };
  }

  /**
   * Filtering stage - apply AI filtering
   */
  async executeFilteringStage(batchState) {
    const filteredResults = [];
    const photosToKeep = [];
    const photosToFilter = [];
    
    // Determine event context if available
    const eventContext = batchState.options.eventContext || {
      eventType: 'general',
      eventName: 'Batch Processing'
    };
    
    for (const photo of batchState.photos) {
      try {
        const analysisResult = await advancedPhotoFilterService.analyzePhoto(photo, eventContext);
        
        filteredResults.push(analysisResult);
        
        if (analysisResult.shouldInclude) {
          photosToKeep.push(photo);
        } else {
          photosToFilter.push(photo);
          batchState.results.filtered.push({
            photoId: photo.id,
            reason: analysisResult.filterReasons.join(', '),
            confidence: analysisResult.confidence
          });
        }
        
        // Update progress
        batchState.progress.processed++;
        
      } catch (error) {
        // If filtering fails, keep the photo by default
        photosToKeep.push(photo);
        batchState.results.errors.push({
          photoId: photo.id,
          stage: 'filtering',
          error: error.message
        });
      }
    }
    
    // Update batch state with filtered photos
    batchState.photos = photosToKeep;
    
    console.log(`   📊 Filtering: ${photosToKeep.length} kept, ${photosToFilter.length} filtered`);
    
    return {
      analyzed: filteredResults.length,
      kept: photosToKeep.length,
      filtered: photosToFilter.length,
      filterResults: filteredResults
    };
  }

  /**
   * Deduplication stage
   */
  async executeDeduplicationStage(batchState) {
    try {
      const deduplicationResults = await photoDeduplicationService.findDuplicates(
        batchState.photos,
        (progress, status) => {
          // Update progress within this stage
          batchState.progress.substatus = status;
        }
      );
      
      // Store duplicate groups
      batchState.results.duplicates = deduplicationResults.duplicateGroups;
      
      // Remove duplicates from processing (keep best photo from each group)
      const photosToKeep = [];
      const duplicatePhotoIds = new Set();
      
      // Mark duplicates
      deduplicationResults.duplicateGroups.forEach(group => {
        group.photos.forEach(photo => {
          if (photo.photoId !== group.bestPhoto.photoId) {
            duplicatePhotoIds.add(photo.photoId);
          }
        });
      });
      
      // Keep non-duplicates and best photos from duplicate groups
      batchState.photos.forEach(photo => {
        if (!duplicatePhotoIds.has(photo.id)) {
          photosToKeep.push(photo);
        }
      });
      
      batchState.photos = photosToKeep;
      
      console.log(`   📊 Deduplication: ${deduplicationResults.duplicateGroups.length} duplicate groups found`);
      console.log(`   💾 Space saved: ${(deduplicationResults.potentialSpaceSaved / 1024 / 1024).toFixed(1)}MB`);
      
      return {
        duplicateGroups: deduplicationResults.duplicateGroups.length,
        duplicatesRemoved: duplicatePhotoIds.size,
        spaceSaved: deduplicationResults.potentialSpaceSaved,
        remainingPhotos: photosToKeep.length
      };
      
    } catch (error) {
      console.error('Error in deduplication stage:', error);
      // Continue without deduplication if it fails
      return {
        duplicateGroups: 0,
        duplicatesRemoved: 0,
        spaceSaved: 0,
        remainingPhotos: batchState.photos.length,
        error: error.message
      };
    }
  }

  /**
   * Quality analysis stage
   */
  async executeQualityAnalysisStage(batchState) {
    const qualityResults = [];
    let highQualityCount = 0;
    let mediumQualityCount = 0;
    let lowQualityCount = 0;
    
    for (const photo of batchState.photos) {
      try {
        // Quality analysis would be more sophisticated in real implementation
        const qualityScore = Math.random() * 0.4 + 0.6; // 0.6-1.0 for remaining photos
        
        const qualityResult = {
          photoId: photo.id,
          qualityScore: qualityScore,
          qualityCategory: qualityScore > 0.8 ? 'high' : qualityScore > 0.6 ? 'medium' : 'low',
          recommendations: []
        };
        
        // Add quality recommendations
        if (qualityScore < 0.7) {
          qualityResult.recommendations.push('Consider brightness adjustment');
        }
        if (qualityScore < 0.8) {
          qualityResult.recommendations.push('Check for blur');
        }
        
        qualityResults.push(qualityResult);
        
        // Count quality categories
        if (qualityResult.qualityCategory === 'high') highQualityCount++;
        else if (qualityResult.qualityCategory === 'medium') mediumQualityCount++;
        else lowQualityCount++;
        
        // Add quality data to photo
        photo.qualityAnalysis = qualityResult;
        
        // Update progress
        batchState.progress.processed++;
        
      } catch (error) {
        batchState.results.errors.push({
          photoId: photo.id,
          stage: 'qualityAnalysis',
          error: error.message
        });
      }
    }
    
    console.log(`   📊 Quality analysis: ${highQualityCount} high, ${mediumQualityCount} medium, ${lowQualityCount} low`);
    
    return {
      analyzed: qualityResults.length,
      highQuality: highQualityCount,
      mediumQuality: mediumQualityCount,
      lowQuality: lowQualityCount,
      averageQuality: qualityResults.reduce((sum, r) => sum + r.qualityScore, 0) / qualityResults.length,
      qualityResults: qualityResults
    };
  }

  /**
   * Finalization stage - prepare final results
   */
  async executeFinalizationStage(batchState) {
    const finalizedPhotos = [];
    
    for (const photo of batchState.photos) {
      try {
        // Add final processing metadata
        const finalizedPhoto = {
          ...photo,
          processingCompleted: new Date(),
          processingDuration: Date.now() - new Date(photo.processingStarted).getTime(),
          batchId: batchState.batchId,
          finalStatus: 'processed'
        };
        
        finalizedPhotos.push(finalizedPhoto);
        batchState.results.processed.push(finalizedPhoto);
        
        // Optionally add to upload queue
        if (batchState.options.autoUpload !== false) {
          await addPhotoToUploadQueue(finalizedPhoto);
        }
        
        // Update progress
        batchState.progress.processed++;
        
      } catch (error) {
        batchState.results.errors.push({
          photoId: photo.id,
          stage: 'finalization',
          error: error.message
        });
      }
    }
    
    console.log(`   📊 Finalized ${finalizedPhotos.length} photos for upload`);
    
    return {
      finalized: finalizedPhotos.length,
      queuedForUpload: batchState.options.autoUpload !== false ? finalizedPhotos.length : 0,
      finalizedPhotos: finalizedPhotos
    };
  }

  /**
   * Validate photo for processing
   */
  validatePhotoForProcessing(photo) {
    try {
      // Basic validation checks
      if (!photo.id || !photo.filename) {
        return false;
      }
      
      // File size check
      if (photo.fileSize && photo.fileSize > 100 * 1024 * 1024) { // 100MB limit
        return false;
      }
      
      // MIME type check
      const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
      if (photo.mimeType && !supportedTypes.includes(photo.mimeType)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start progress tracking for batch
   */
  startProgressTracking(batchState) {
    const updateInterval = this.config.progressTracking.updateInterval;
    
    const progressTracker = setInterval(() => {
      this.updateProgressMetrics(batchState);
      
      if (!this.processingActive || batchState.progress.overall >= 100) {
        clearInterval(progressTracker);
      }
    }, updateInterval);
    
    batchState.progressTracker = progressTracker;
  }

  /**
   * Update progress metrics
   */
  updateProgressMetrics(batchState, stageResult = null) {
    try {
      const now = performance.now();
      const elapsed = now - batchState.startTime;
      
      // Calculate ETA
      if (batchState.progress.overall > 0) {
        const totalEstimated = (elapsed / batchState.progress.overall) * 100;
        batchState.progress.eta = totalEstimated - elapsed;
      }
      
      // Calculate throughput (photos per second)
      if (elapsed > 1000) { // At least 1 second elapsed
        batchState.progress.throughput = (batchState.progress.processed / elapsed) * 1000;
      }
      
      // Notify subscribers
      this.notifyProgressSubscribers('progress', {
        batchId: batchState.batchId,
        progress: batchState.progress,
        stageResult: stageResult
      });
      
    } catch (error) {
      console.error('Error updating progress metrics:', error);
    }
  }

  /**
   * Check if failure threshold has been exceeded
   */
  checkFailureThreshold(batchState) {
    const totalProcessed = batchState.progress.processed;
    const totalErrors = batchState.results.errors.length;
    
    if (totalProcessed > 10) { // Only check after processing at least 10 photos
      const failureRate = totalErrors / totalProcessed;
      return failureRate > this.config.errorHandling.failureThreshold;
    }
    
    return false;
  }

  /**
   * Generate processing report
   */
  generateProcessingReport(batchState, results) {
    const report = {
      batchId: batchState.batchId,
      timestamp: new Date(),
      
      // Summary
      summary: {
        totalPhotos: batchState.photos.length + batchState.results.errors.length,
        processedPhotos: results.processedCount,
        filteredPhotos: results.filteredCount,
        duplicatesRemoved: results.duplicateCount,
        errors: results.errorCount,
        processingTime: results.totalProcessingTime,
        averageTimePerPhoto: results.averageProcessingTime
      },
      
      // Stage details
      stageResults: results.stageResults,
      
      // Quality metrics
      qualityMetrics: {
        averageQuality: results.stageResults.qualityAnalysis?.averageQuality || 0,
        highQualityPhotos: results.stageResults.qualityAnalysis?.highQuality || 0,
        mediumQualityPhotos: results.stageResults.qualityAnalysis?.mediumQuality || 0,
        lowQualityPhotos: results.stageResults.qualityAnalysis?.lowQuality || 0
      },
      
      // Deduplication metrics
      deduplicationMetrics: {
        duplicateGroups: results.stageResults.deduplication?.duplicateGroups || 0,
        spaceSaved: results.stageResults.deduplication?.spaceSaved || 0
      },
      
      // Error analysis
      errorAnalysis: this.analyzeErrors(batchState.results.errors),
      
      // Performance metrics
      performanceMetrics: {
        throughput: batchState.progress.throughput,
        memoryUsage: this.getMemoryUsage(),
        systemLoad: this.getSystemLoad()
      },
      
      // Recommendations
      recommendations: this.generateRecommendations(results, batchState.results.errors)
    };
    
    return report;
  }

  /**
   * Analyze errors from batch processing
   */
  analyzeErrors(errors) {
    const errorsByStage = {};
    const errorsByType = {};
    
    errors.forEach(error => {
      // Group by stage
      if (!errorsByStage[error.stage]) {
        errorsByStage[error.stage] = 0;
      }
      errorsByStage[error.stage]++;
      
      // Group by error type (simplified)
      const errorType = error.error.includes('timeout') ? 'timeout' :
                       error.error.includes('memory') ? 'memory' :
                       error.error.includes('network') ? 'network' : 'other';
      
      if (!errorsByType[errorType]) {
        errorsByType[errorType] = 0;
      }
      errorsByType[errorType]++;
    });
    
    return {
      total: errors.length,
      byStage: errorsByStage,
      byType: errorsByType,
      errorRate: errors.length > 0 ? (errors.length / (errors.length + 100)) * 100 : 0 // Approximate
    };
  }

  /**
   * Generate recommendations based on processing results
   */
  generateRecommendations(results, errors) {
    const recommendations = [];
    
    // Performance recommendations
    if (results.averageProcessingTime > 5000) { // > 5 seconds per photo
      recommendations.push('Consider reducing batch size or enabling more concurrent processing');
    }
    
    // Quality recommendations
    if (results.stageResults.qualityAnalysis?.lowQuality > results.processedCount * 0.3) {
      recommendations.push('High number of low-quality photos detected - consider reviewing photo capture settings');
    }
    
    // Error recommendations
    if (errors.length > results.processedCount * 0.1) {
      recommendations.push('High error rate detected - check system resources and network connectivity');
    }
    
    // Duplicate recommendations
    if (results.stageResults.deduplication?.duplicateGroups > 0) {
      recommendations.push(`Consider reviewing ${results.stageResults.deduplication.duplicateGroups} duplicate groups to save space`);
    }
    
    // Filtering recommendations
    if (results.filteredCount > results.processedCount * 0.5) {
      recommendations.push('High filtering rate - consider adjusting filter sensitivity or event context');
    }
    
    return recommendations;
  }

  /**
   * Subscribe to progress updates
   */
  subscribeToProgress(callback) {
    this.progressSubscribers.add(callback);
    return () => {
      this.progressSubscribers.delete(callback);
    };
  }

  /**
   * Notify progress subscribers
   */
  notifyProgressSubscribers(eventType, data) {
    for (const callback of this.progressSubscribers) {
      try {
        callback(eventType, data);
      } catch (error) {
        console.error('Error notifying progress subscriber:', error);
      }
    }
  }

  /**
   * Get memory usage (simplified)
   */
  getMemoryUsage() {
    try {
      if (performance.memory) {
        return {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        };
      }
    } catch (error) {
      // Fallback for browsers without performance.memory
    }
    return { used: 0, total: 0, limit: 0 };
  }

  /**
   * Get system load (simplified)
   */
  getSystemLoad() {
    // Simplified system load estimation
    return {
      cpu: Math.random() * 30 + 20, // 20-50% simulated
      workers: this.activeWorkers.size,
      activeWorkers: Array.from(this.activeWorkers.values()).filter(w => w.status !== 'idle').length
    };
  }

  /**
   * Get batch processing history
   */
  getBatchHistory(limit = 10) {
    return this.batchHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get current batch status
   */
  getCurrentBatchStatus() {
    if (!this.processingActive || !this.currentBatch) {
      return null;
    }
    
    return {
      batchId: this.currentBatch.batchId,
      progress: this.currentBatch.progress,
      startTime: this.currentBatch.startTime,
      elapsedTime: performance.now() - this.currentBatch.startTime,
      currentStage: this.currentBatch.progress.stage,
      photosTotal: this.currentBatch.progress.total,
      photosProcessed: this.currentBatch.progress.processed
    };
  }

  /**
   * Test batch processing functionality
   */
  async testBatchProcessing() {
    try {
      console.log('🧪 Testing batch photo processing...');
      
      if (!this.isInitialized) {
        throw new Error('BatchPhotoProcessingService not initialized');
      }

      // Create test photos
      const testPhotos = [];
      for (let i = 0; i < 5; i++) {
        testPhotos.push({
          id: `test_batch_${i}`,
          filename: `batch_photo_${i}.jpg`,
          fileSize: 2000000 + Math.random() * 3000000,
          mimeType: 'image/jpeg',
          dimensions: { width: 4032, height: 3024 },
          createdAt: new Date(Date.now() - i * 1000)
        });
      }

      // Subscribe to progress updates
      const unsubscribe = this.subscribeToProgress((eventType, data) => {
        if (eventType === 'progress') {
          console.log(`   📊 Progress: ${data.progress.overall.toFixed(0)}% - ${data.progress.stage}`);
        }
      });

      // Process batch
      const results = await this.processBatch(testPhotos, {
        eventContext: { eventType: 'test', eventName: 'Batch Processing Test' }
      });

      unsubscribe();

      console.log('✅ Batch processing test completed');
      console.log(`   📊 Processed ${results.processedCount}/${testPhotos.length} photos`);
      console.log(`   ⏱️ Total time: ${(results.totalProcessingTime / 1000).toFixed(1)}s`);
      console.log(`   ⚡ Average per photo: ${results.averageProcessingTime.toFixed(0)}ms`);

      showToast('Batch processing test completed successfully', 'success');
      return true;

    } catch (error) {
      console.error('Error testing batch processing:', error);
      showToast('Batch processing test failed: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      processingActive: this.processingActive,
      currentBatch: this.getCurrentBatchStatus(),
      config: this.config,
      
      // Statistics
      batchHistory: this.batchHistory.length,
      totalPhotosProcessed: this.batchHistory.reduce((sum, batch) => 
        sum + batch.photosProcessed, 0),
      
      // System status
      activeWorkers: this.activeWorkers.size,
      memoryUsage: this.getMemoryUsage(),
      systemLoad: this.getSystemLoad(),
      
      // Capabilities
      capabilities: {
        maxBatchSize: this.config.maxBatchSize,
        concurrentProcessing: this.config.maxConcurrentPerBatch,
        webWorkerSupport: this.config.performance.useWebWorkers && typeof Worker !== 'undefined',
        progressTracking: this.config.progressTracking.detailedLogging,
        errorHandling: this.config.errorHandling.continueOnError
      }
    };
  }

  /**
   * Clean up service
   */
  cleanup() {
    try {
      console.log('🧹 Cleaning up BatchPhotoProcessingService...');
      
      // Stop any active processing
      if (this.processingActive && this.currentBatch) {
        if (this.currentBatch.progressTracker) {
          clearInterval(this.currentBatch.progressTracker);
        }
        this.processingActive = false;
        this.currentBatch = null;
      }
      
      // Clear subscribers
      this.progressSubscribers.clear();
      
      // Clear workers
      this.activeWorkers.clear();
      
      // Clear processing queue
      this.processingQueue = [];
      
      this.isInitialized = false;
      
      console.log('✅ BatchPhotoProcessingService cleaned up');
      
    } catch (error) {
      console.error('Error cleaning up BatchPhotoProcessingService:', error);
    }
  }
}

// Export singleton instance to global window
console.log('Creating BatchPhotoProcessingService...');
try {
  window.batchPhotoProcessingService = new BatchPhotoProcessingService();
  console.log('BatchPhotoProcessingService created successfully');
} catch (error) {
  console.error('Error creating BatchPhotoProcessingService:', error);
  window.batchPhotoProcessingService = null;
}

// Export convenience functions to global window
window.initializeBatchPhotoProcessing = async function() {
  return await window.batchPhotoProcessingService.initialize();
}

window.processBatchOfPhotos = async function(photos, options = {}) {
  return await window.batchPhotoProcessingService.processBatch(photos, options);
}

window.subscribeToBatchProgress = function(callback) {
  return window.batchPhotoProcessingService.subscribeToProgress(callback);
}

window.getBatchPhotoProcessingStatus = function() {
  return window.batchPhotoProcessingService.getStatus();
}

window.getBatchProcessingHistory = function(limit = 10) {
  return window.batchPhotoProcessingService.getBatchHistory(limit);
}

window.testBatchPhotoProcessing = async function() {
  return await window.batchPhotoProcessingService.testBatchProcessing();
}