#!/usr/bin/env node
/**
 * OpenShorts + Postiz Video-to-Social Pipeline
 * 
 * Orchestrates a complete video generation and social publishing workflow:
 * 1. Trigger OpenShorts render job
 * 2. Poll for completion
 * 3. Download rendered video
 * 4. Upload to Postiz
 * 5. Schedule posts across social platforms
 * 
 * Usage: node openshorts_postiz_pipeline.js
 * 
 * Requires: POSTIZ_API_KEY environment variable
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const OPENSHORTS_API_URL = 'http://192.168.1.1:3000';
const POSTIZ_API_URL = 'http://192.168.1.128:30500';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY;

// Pipeline phases tracking
const phases = [
  { name: 'Trigger Render', status: 'pending', startTime: null, endTime: null },
  { name: 'Poll Completion', status: 'pending', startTime: null, endTime: null },
  { name: 'Download Video', status: 'pending', startTime: null, endTime: null },
  { name: 'Upload to Postiz', status: 'pending', startTime: null, endTime: null },
  { name: 'Schedule Posts', status: 'pending', startTime: null, endTime: null }
];

// Helper functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function logPhase(phaseIndex, status, message = '') {
  const phase = phases[phaseIndex];
  phase.status = status;
  if (status === 'running') {
    phase.startTime = new Date();
    log(`Phase ${phaseIndex + 1}: ${phase.name} - STARTED`);
  } else if (status === 'completed') {
    phase.endTime = new Date();
    const duration = ((phase.endTime - phase.startTime) / 1000).toFixed(2);
    log(`Phase ${phaseIndex + 1}: ${phase.name} - COMPLETED (${duration}s) ${message}`);
  } else if (status === 'failed') {
    phase.endTime = new Date();
    log(`Phase ${phaseIndex + 1}: ${phase.name} - FAILED ${message}`, 'ERROR');
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Phase 1: Trigger OpenShorts Render
async function triggerRender() {
  logPhase(0, 'running');
  
  try {
    // Check OpenShorts health first
    const health = await makeRequest(`${OPENSHORTS_API_URL}/health`, { timeout: 5000 });
    if (health.status !== 200) {
      throw new Error(`OpenShorts health check failed: ${health.status}`);
    }
    log('OpenShorts health check passed');
    
    // Trigger a render job - adjust endpoint based on OpenShorts API
    const renderPayload = {
      template: 'default',
      data: {
        title: 'Cloudless.gr - Cloud Consulting',
        subtitle: 'AWS to Cloudflare Migration Experts',
        cta: 'Get Started'
      },
      format: 'mp4',
      quality: 'high'
    };
    
    const response = await makeRequest(`${OPENSHORTS_API_URL}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(renderPayload),
      timeout: 30000
    });
    
    if (response.status !== 200 && response.status !== 201 && response.status !== 202) {
      throw new Error(`Render trigger failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    
    const jobId = response.data.jobId || response.data.id;
    if (!jobId) {
      throw new Error('No job ID returned from render trigger');
    }
    
    logPhase(0, 'completed', `- Job ID: ${jobId}`);
    return jobId;
  } catch (error) {
    logPhase(0, 'failed', `- ${error.message}`);
    throw error;
  }
}

// Phase 2: Poll for Completion
async function pollCompletion(jobId, maxAttempts = 60, intervalMs = 5000) {
  logPhase(1, 'running');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await makeRequest(`${OPENSHORTS_API_URL}/api/render/${jobId}/status`, {
        timeout: 10000
      });
      
      if (response.status !== 200) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const status = response.data.status || response.data.state;
      const progress = response.data.progress || 0;
      
      log(`Poll attempt ${attempt}/${maxAttempts} - Status: ${status} (${progress}%)`);
      
      if (status === 'completed' || status === 'done' || status === 'success') {
        const videoUrl = response.data.videoUrl || response.data.outputUrl || response.data.downloadUrl;
        if (!videoUrl) {
          throw new Error('Render completed but no video URL provided');
        }
        logPhase(1, 'completed', `- Video URL: ${videoUrl}`);
        return videoUrl;
      }
      
      if (status === 'failed' || status === 'error') {
        const errorMsg = response.data.error || response.data.message || 'Unknown error';
        throw new Error(`Render failed: ${errorMsg}`);
      }
      
      // Still processing, wait and retry
      await sleep(intervalMs);
    } catch (error) {
      if (attempt === maxAttempts) {
        logPhase(1, 'failed', `- ${error.message}`);
        throw error;
      }
      log(`Poll error (attempt ${attempt}): ${error.message}, retrying...`);
      await sleep(intervalMs);
    }
  }
  
  throw new Error('Max polling attempts reached');
}

// Phase 3: Download Video
async function downloadVideo(videoUrl, outputPath = './temp/video.mp4') {
  logPhase(2, 'running');
  
  try {
    // Ensure temp directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Use curl for reliable download with progress
    const cmd = `curl -L -o "${outputPath}" "${videoUrl}" --progress-bar --max-time 300`;
    log(`Downloading video to ${outputPath}...`);
    execSync(cmd, { stdio: 'inherit', timeout: 300000 });
    
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    logPhase(2, 'completed', `- Size: ${sizeMB} MB`);
    return outputPath;
  } catch (error) {
    logPhase(2, 'failed', `- ${error.message}`);
    throw error;
  }
}

// Phase 4: Upload to Postiz
async function uploadToPostiz(videoPath) {
  logPhase(3, 'running');
  
  if (!POSTIZ_API_KEY) {
    throw new Error('POSTIZ_API_KEY environment variable not set');
  }
  
  try {
    // Use Postiz MCP or direct API to upload
    // First, let's try using the Postiz CLI if available, or direct API
    
    // Check if Postiz is accessible
    const health = await makeRequest(`${POSTIZ_API_URL}/health`, { timeout: 5000 });
    if (health.status !== 200) {
      log('Postiz health check returned non-200, trying anyway...');
    }
    
    // Upload video to Postiz media library
    // Using multipart/form-data via curl
    const fileName = path.basename(videoPath);
    const cmd = `curl -X POST "${POSTIZ_API_URL}/api/media/upload" \
      -H "Authorization: Bearer ${POSTIZ_API_KEY}" \
      -F "file=@${videoPath}" \
      -F "type=video" \
      --max-time 300`;
    
    log(`Uploading ${fileName} to Postiz...`);
    const result = execSync(cmd, { encoding: 'utf8', timeout: 300000 });
    
    let uploadResponse;
    try {
      uploadResponse = JSON.parse(result);
    } catch (e) {
      throw new Error(`Invalid JSON response from upload: ${result}`);
    }
    
    const mediaId = uploadResponse.id || uploadResponse.mediaId || uploadResponse.id;
    if (!mediaId) {
      throw new Error(`Upload succeeded but no media ID returned: ${JSON.stringify(uploadResponse)}`);
    }
    
    logPhase(3, 'completed', `- Media ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    logPhase(3, 'failed', `- ${error.message}`);
    throw error;
  }
}

// Phase 5: Schedule Posts
async function schedulePosts(mediaId) {
  logPhase(4, 'running');
  
  try {
    // Create posts for multiple platforms
    const platforms = ['linkedin', 'twitter', 'facebook', 'instagram'];
    const scheduledPosts = [];
    
    for (const platform of platforms) {
      try {
        const postPayload = {
          content: `🚀 Cloudless.gr - Your AWS to Cloudflare Migration Partner\n\nWe help companies migrate from AWS to Cloudflare's global network, reducing costs by 60-80% while improving performance and security.\n\n#CloudMigration #Cloudflare #AWS #DevOps #CloudNative`,
          mediaIds: [mediaId],
          platforms: [platform],
          scheduledAt: new Date(Date.now() + 60000).toISOString(), // Schedule 1 minute from now
          timezone: 'Europe/Athens'
        };
        
        const cmd = `curl -X POST "${POSTIZ_API_URL}/api/posts" \
          -H "Authorization: Bearer ${POSTIZ_API_KEY}" \
          -H "Content-Type: application/json" \
          -d '${JSON.stringify(postPayload)}' \
          --max-time 30`;
        
        log(`Scheduling post for ${platform}...`);
        const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
        const postResponse = JSON.parse(result);
        
        scheduledPosts.push({
          platform,
          postId: postResponse.id,
          status: 'scheduled'
        });
        
        log(`  ✓ ${platform} post scheduled (ID: ${postResponse.id})`);
      } catch (platformError) {
        log(`  ✗ ${platform} failed: ${platformError.message}`, 'WARN');
        scheduledPosts.push({
          platform,
          status: 'failed',
          error: platformError.message
        });
      }
    }
    
    logPhase(4, 'completed', `- ${scheduledPosts.filter(p => p.status === 'scheduled').length}/${platforms.length} platforms scheduled`);
    return scheduledPosts;
  } catch (error) {
    logPhase(4, 'failed', `- ${error.message}`);
    throw error;
  }
}

// Cleanup function
function cleanup() {
  const tempDir = './temp';
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      log('Cleaned up temporary files');
    } catch (e) {
      log(`Cleanup warning: ${e.message}`, 'WARN');
    }
  }
}

// Main pipeline execution
async function runPipeline() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  OpenShorts + Postiz Video-to-Social Pipeline               ║');
  console.log('║  Cloudless.gr - Automated Content Pipeline                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Pre-flight checks
  log('Pre-flight checks...');
  
  if (!POSTIZ_API_KEY) {
    log('ERROR: POSTIZ_API_KEY environment variable is not set', 'ERROR');
    log('Please set it: export POSTIZ_API_KEY="your-api-key"', 'ERROR');
    process.exit(1);
  }
  log('✓ POSTIZ_API_KEY is set');
  
  // Test connectivity
  try {
    const openshortsHealth = await makeRequest(`${OPENSHORTS_API_URL}/health`, { timeout: 5000 });
    log(`✓ OpenShorts connectivity: ${openshortsHealth.status === 200 ? 'OK' : 'WARNING'}`);
  } catch (e) {
    log(`⚠ OpenShorts connectivity check failed: ${e.message}`, 'WARN');
  }
  
  try {
    const postizHealth = await makeRequest(`${POSTIZ_API_URL}/health`, { timeout: 5000 });
    log(`✓ Postiz connectivity: ${postizHealth.status === 200 ? 'OK' : 'WARNING'}`);
  } catch (e) {
    log(`⚠ Postiz connectivity check failed: ${e.message}`, 'WARN');
  }
  
  console.log('');
  
  const pipelineStart = Date.now();
  let jobId, videoUrl, videoPath, mediaId, scheduledPosts;
  
  try {
    // Execute pipeline phases
    jobId = await triggerRender();
    videoUrl = await pollCompletion(jobId);
    videoPath = await downloadVideo(videoUrl);
    mediaId = await uploadToPostiz(videoPath);
    scheduledPosts = await schedulePosts(mediaId);
    
    const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(2);
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  PIPELINE COMPLETED SUCCESSFULLY                             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    log(`Total duration: ${totalDuration}s`);
    log(`Render Job ID: ${jobId}`);
    log(`Video URL: ${videoUrl}`);
    log(`Media ID: ${mediaId}`);
    log(`Posts scheduled: ${scheduledPosts.filter(p => p.status === 'scheduled').length}`);
    
    // Show scheduled posts summary
    scheduledPosts.forEach(post => {
      if (post.status === 'scheduled') {
        log(`  ✓ ${post.platform} - Post ID: ${post.postId}`);
      } else {
        log(`  ✗ ${post.platform} - ${post.error}`);
      }
    });
    
    cleanup();
    process.exit(0);
    
  } catch (error) {
    const totalDuration = ((Date.now() - pipelineStart) / 1000).toFixed(2);
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  PIPELINE FAILED                                             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    log(`Failed after ${totalDuration}s`, 'ERROR');
    log(`Error: ${error.message}`, 'ERROR');
    
    // Print phase summary
    console.log('');
    log('Phase Summary:');
    phases.forEach((phase, i) => {
      const statusIcon = phase.status === 'completed' ? '✓' : 
                         phase.status === 'failed' ? '✗' : 
                         phase.status === 'running' ? '⟳' : '○';
      const duration = phase.startTime && phase.endTime 
        ? ` (${((phase.endTime - phase.startTime) / 1000).toFixed(2)}s)`
        : '';
      log(`  ${statusIcon} Phase ${i + 1}: ${phase.name} [${phase.status}]${duration}`);
    });
    
    cleanup();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, cleaning up...', 'WARN');
  cleanup();
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, cleaning up...', 'WARN');
  cleanup();
  process.exit(143);
});

// Run the pipeline
runPipeline().catch(error => {
  log(`Unhandled error: ${error.message}`, 'ERROR');
  cleanup();
  process.exit(1);
});