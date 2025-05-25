<template>
  <div class="responsive-demo">
    <div class="info-panel">
      <h2 class="text-2xl font-bold mb-6">Responsive Design Demo</h2>
      
      <div class="stats-container">
        <div class="stat-box" :class="{ 'active': isMobile }">
          <h3>Mobile</h3>
          <div class="icon">📱</div>
          <div class="status">{{ isMobile ? 'Active' : 'Inactive' }}</div>
        </div>
        
        <div class="stat-box" :class="{ 'active': isTablet }">
          <h3>Tablet</h3>
          <div class="icon">📔</div>
          <div class="status">{{ isTablet ? 'Active' : 'Inactive' }}</div>
        </div>
        
        <div class="stat-box" :class="{ 'active': isDesktop }">
          <h3>Desktop</h3>
          <div class="icon">💻</div>
          <div class="status">{{ isDesktop ? 'Active' : 'Inactive' }}</div>
        </div>
        
        <div class="stat-box" :class="{ 'active': isLargeDesktop }">
          <h3>Large Desktop</h3>
          <div class="icon">🖥️</div>
          <div class="status">{{ isLargeDesktop ? 'Active' : 'Inactive' }}</div>
        </div>
      </div>
      
      <div class="screen-info">
        <div class="info-item">
          <span class="label">Screen Width:</span>
          <span class="value">{{ width }}px</span>
        </div>
        <div class="info-item">
          <span class="label">Screen Height:</span>
          <span class="value">{{ height }}px</span>
        </div>
        <div class="info-item">
          <span class="label">Orientation:</span>
          <span class="value">{{ isPortrait ? 'Portrait' : 'Landscape' }}</span>
        </div>
      </div>
      
      <div class="breakpoints-info">
        <h3 class="text-lg font-semibold mb-2">Breakpoints:</h3>
        <ul>
          <li>Mobile: &lt; {{ breakpoints.mobile }}px</li>
          <li>Tablet: {{ breakpoints.mobile }}px - {{ breakpoints.tablet - 1 }}px</li>
          <li>Desktop: {{ breakpoints.tablet }}px - {{ breakpoints.desktop - 1 }}px</li>
          <li>Large Desktop: ≥ {{ breakpoints.desktop }}px</li>
        </ul>
      </div>
    </div>
    
    <div class="demo-content">
      <div class="responsive-showcase">
        <div class="showcase-box mobile" :class="{ 'active': isMobile }">
          <div class="showcase-label">Mobile Content</div>
          <div class="showcase-content">
            <p>This content is optimized for mobile devices.</p>
            <div class="btn-container">
              <button class="showcase-btn">Click Me</button>
            </div>
          </div>
        </div>
        
        <div class="showcase-box tablet" :class="{ 'active': isTablet }">
          <div class="showcase-label">Tablet Content</div>
          <div class="showcase-content">
            <p>This content appears differently on tablet screens.</p>
            <div class="btn-container">
              <button class="showcase-btn">Primary</button>
              <button class="showcase-btn secondary">Secondary</button>
            </div>
          </div>
        </div>
        
        <div class="showcase-box desktop" :class="{ 'active': isDesktop || isLargeDesktop }">
          <div class="showcase-label">Desktop Content</div>
          <div class="showcase-content">
            <p>This content has additional features on desktop screens.</p>
            <div class="btn-container">
              <button class="showcase-btn">Primary</button>
              <button class="showcase-btn secondary">Secondary</button>
              <button class="showcase-btn tertiary">Tertiary</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useResponsive } from '~/composables/useResponsive'

// Get responsive utilities
const { 
  width, 
  height, 
  isMobile, 
  isTablet, 
  isDesktop, 
  isLargeDesktop, 
  isPortrait, 
  breakpoints 
} = useResponsive()
</script>

<style scoped>
.responsive-demo {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.info-panel {
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-box {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
}

.stat-box.active {
  background-color: #3b82f6;
  color: white;
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
}

.stat-box h3 {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.stat-box .icon {
  font-size: 2rem;
  margin: 0.5rem 0;
}

.stat-box .status {
  font-weight: 500;
  font-size: 0.875rem;
  opacity: 0.9;
}

.screen-info {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  font-weight: 500;
  color: #64748b;
}

.info-item .value {
  font-weight: 600;
}

.breakpoints-info {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
}

.breakpoints-info ul {
  list-style: none;
  padding: 0;
}

.breakpoints-info li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.breakpoints-info li:last-child {
  border-bottom: none;
}

.demo-content {
  margin-top: 1rem;
}

.responsive-showcase {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .responsive-demo {
    padding: 3rem;
  }
  
  .responsive-showcase {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

.showcase-box {
  border-radius: 8px;
  padding: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  opacity: 0.4;
  transform: scale(0.95);
  transition: all 0.3s ease;
}

.showcase-box.active {
  opacity: 1;
  transform: scale(1);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}

.showcase-label {
  background-color: #f1f5f9;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}

.showcase-content {
  padding: 1.5rem;
}

.btn-container {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.showcase-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  background-color: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.showcase-btn:hover {
  background-color: #2563eb;
}

.showcase-btn.secondary {
  background-color: #64748b;
}

.showcase-btn.secondary:hover {
  background-color: #475569;
}

.showcase-btn.tertiary {
  background-color: #f97316;
}

.showcase-btn.tertiary:hover {
  background-color: #ea580c;
}

.mobile.active .showcase-label {
  background-color: #fb7185;
  color: white;
}

.tablet.active .showcase-label {
  background-color: #60a5fa;
  color: white;
}

.desktop.active .showcase-label {
  background-color: #34d399;
  color: white;
}

@media (max-width: 767px) {
  .showcase-box:not(.active) {
    display: none;
  }
}
</style>