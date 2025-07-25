<template>
  <div class="codegen-container">
    <div class="codegen-header">
      <h1>Code Generation Tools</h1>
      <p class="header-description">
        Powerful AI-assisted code generation tools to accelerate your development workflow 
        and boost productivity with intelligent code suggestions and automation.
      </p>
    </div>

    <div class="tools-grid">
      <div class="tool-card featured">
        <div class="tool-header">
          <div class="tool-icon">🤖</div>
          <div class="tool-info">
            <h3>AI Code Assistant</h3>
            <span class="tool-status">Available</span>
          </div>
        </div>
        <p class="tool-description">
          Intelligent code completion and generation powered by advanced language models. 
          Get context-aware suggestions for functions, components, and entire modules.
        </p>
        <div class="tool-features">
          <span class="feature">Multi-language support</span>
          <span class="feature">Context-aware</span>
          <span class="feature">Real-time suggestions</span>
        </div>
        <button class="tool-button primary">
          Try AI Assistant
        </button>
      </div>

      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-icon">⚡</div>
          <div class="tool-info">
            <h3>Component Generator</h3>
            <span class="tool-status">Available</span>
          </div>
        </div>
        <p class="tool-description">
          Generate Vue.js, React, and other framework components with proper structure, 
          styling, and functionality based on your specifications.
        </p>
        <div class="tool-features">
          <span class="feature">Vue.js Components</span>
          <span class="feature">React Components</span>
          <span class="feature">Custom Templates</span>
        </div>
        <button class="tool-button">
          Generate Components
        </button>
      </div>

      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-icon">🗄️</div>
          <div class="tool-info">
            <h3>API Generator</h3>
            <span class="tool-status">Available</span>
          </div>
        </div>
        <p class="tool-description">
          Automatically generate REST API endpoints, database models, and documentation 
          from schemas or existing database structures.
        </p>
        <div class="tool-features">
          <span class="feature">REST APIs</span>
          <span class="feature">Database Models</span>
          <span class="feature">Auto Documentation</span>
        </div>
        <button class="tool-button">
          Create APIs
        </button>
      </div>

      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-icon">🎨</div>
          <div class="tool-info">
            <h3>CSS Generator</h3>
            <span class="tool-status">Available</span>
          </div>
        </div>
        <p class="tool-description">
          Generate optimized CSS styles, animations, and responsive layouts with 
          modern design patterns and best practices.
        </p>
        <div class="tool-features">
          <span class="feature">Tailwind CSS</span>
          <span class="feature">CSS Animations</span>
          <span class="feature">Responsive Design</span>
        </div>
        <button class="tool-button">
          Style Generator
        </button>
      </div>

      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-icon">🧪</div>
          <div class="tool-info">
            <h3>Test Generator</h3>
            <span class="tool-status">Coming Soon</span>
          </div>
        </div>
        <p class="tool-description">
          Automatically generate comprehensive unit tests, integration tests, 
          and end-to-end test suites for your applications.
        </p>
        <div class="tool-features">
          <span class="feature">Unit Tests</span>
          <span class="feature">Integration Tests</span>
          <span class="feature">E2E Tests</span>
        </div>
        <button class="tool-button disabled" disabled>
          Coming Soon
        </button>
      </div>

      <div class="tool-card">
        <div class="tool-header">
          <div class="tool-icon">📚</div>
          <div class="tool-info">
            <h3>Documentation Generator</h3>
            <span class="tool-status">Coming Soon</span>
          </div>
        </div>
        <p class="tool-description">
          Generate comprehensive documentation from your code comments, 
          API definitions, and project structure automatically.
        </p>
        <div class="tool-features">
          <span class="feature">API Docs</span>
          <span class="feature">Code Comments</span>
          <span class="feature">Interactive Docs</span>
        </div>
        <button class="tool-button disabled" disabled>
          Coming Soon
        </button>
      </div>
    </div>

    <div class="demo-section">
      <h2>See it in Action</h2>
      <p>Experience our code generation tools with live examples and interactive demos.</p>
      
      <div class="demo-grid">
        <div class="demo-card">
          <h3>Interactive Code Demo</h3>
          <p>Try our AI code assistant in a live coding environment.</p>
          <NuxtLink to="/responsive-demo" class="demo-link">
            View Demo →
          </NuxtLink>
        </div>
        
        <div class="demo-card">
          <h3>Component Library</h3>
          <p>Browse generated components and see the code behind them.</p>
          <button class="demo-link" disabled>
            Coming Soon
          </button>
        </div>
        
        <div class="demo-card">
          <h3>API Playground</h3>
          <p>Test generated APIs and explore their capabilities.</p>
          <button class="demo-link" disabled>
            Coming Soon
          </button>
        </div>
      </div>
    </div>

    <div class="pricing-section">
      <h2>Pricing Plans</h2>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3>Free</h3>
          <div class="price">$0<span>/month</span></div>
          <ul class="features-list">
            <li>✅ Basic code completion</li>
            <li>✅ 50 generations/month</li>
            <li>✅ Community support</li>
            <li>❌ Advanced AI features</li>
          </ul>
          <button class="pricing-button">
            Get Started
          </button>
        </div>
        
        <div class="pricing-card featured">
          <div class="featured-badge">Most Popular</div>
          <h3>Pro</h3>
          <div class="price">$29<span>/month</span></div>
          <ul class="features-list">
            <li>✅ Advanced AI assistance</li>
            <li>✅ Unlimited generations</li>
            <li>✅ Custom templates</li>
            <li>✅ Priority support</li>
          </ul>
          <button class="pricing-button primary">
            Start Free Trial
          </button>
        </div>
        
        <div class="pricing-card">
          <h3>Team</h3>
          <div class="price">$99<span>/month</span></div>
          <ul class="features-list">
            <li>✅ Everything in Pro</li>
            <li>✅ Team collaboration</li>
            <li>✅ Custom integrations</li>
            <li>✅ Dedicated support</li>
          </ul>
          <button class="pricing-button">
            Contact Sales
          </button>
        </div>
      </div>
    </div>

    <div class="cta-section">
      <h2>Ready to Boost Your Productivity?</h2>
      <p>Join thousands of developers who are already using our code generation tools to build better software faster.</p>
      <div class="cta-buttons">
        <button class="cta-button primary">
          Start Free Trial
        </button>
        <NuxtLink to="/contact" class="cta-button secondary">
          Contact Sales
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'
// Set page meta
definePageMeta({
  layout: 'default'
});
</script>

<style scoped>
.codegen-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.codegen-header {
  text-align: center;
  margin-bottom: 4rem;
}

.codegen-header h1 {
  font-size: 3rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.header-description {
  font-size: 1.2rem;
  color: #64748b;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.6;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.tool-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.tool-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.tool-card.featured {
  border: 2px solid #2563eb;
  position: relative;
}

.tool-card.featured::before {
  content: "Featured";
  position: absolute;
  top: -10px;
  left: 1rem;
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tool-icon {
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eff6ff;
  border-radius: 50%;
}

.tool-info h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.25rem;
}

.tool-status {
  font-size: 0.875rem;
  color: #059669;
  background-color: #ecfdf5;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.tool-description {
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.tool-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.feature {
  background-color: #eff6ff;
  color: #2563eb;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.tool-button {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.tool-button.primary {
  background-color: #1e40af;
  color: white;
}

.tool-button.primary:hover {
  background-color: #1e3a8a;
}

.tool-button:not(.primary):not(.disabled) {
  background-color: #f8fafc;
  color: #1e40af;
  border: 1px solid #e2e8f0;
}

.tool-button:not(.primary):not(.disabled):hover {
  background-color: #f1f5f9;
}

.tool-button.disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.demo-section,
.pricing-section {
  margin-bottom: 4rem;
  text-align: center;
}

.demo-section h2,
.pricing-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.demo-section p {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.demo-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2rem;
}

.demo-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 0.75rem;
}

.demo-card p {
  color: #64748b;
  margin-bottom: 1.5rem;
}

.demo-link {
  color: #2563eb;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  transition: all 0.2s ease;
}

.demo-link:hover:not(:disabled) {
  background-color: #f1f5f9;
  border-color: #2563eb;
}

.demo-link:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.pricing-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2rem;
  position: relative;
  text-align: center;
}

.pricing-card.featured {
  border: 2px solid #2563eb;
  transform: scale(1.05);
}

.featured-badge {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pricing-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 1rem;
}

.price {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1.5rem;
}

.price span {
  font-size: 1rem;
  font-weight: 400;
  color: #64748b;
}

.features-list {
  list-style: none;
  padding: 0;
  margin-bottom: 2rem;
  text-align: left;
}

.features-list li {
  padding: 0.5rem 0;
  color: #374151;
}

.pricing-button {
  width: 100%;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.pricing-button.primary {
  background-color: #1e40af;
  color: white;
}

.pricing-button.primary:hover {
  background-color: #1e3a8a;
}

.pricing-button:not(.primary) {
  background-color: #f8fafc;
  color: #1e40af;
  border: 1px solid #e2e8f0;
}

.pricing-button:not(.primary):hover {
  background-color: #f1f5f9;
}

.cta-section {
  text-align: center;
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 3rem 2rem;
}

.cta-section h2 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 1rem;
}

.cta-section p {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
}

.cta-button {
  padding: 0.75rem 2rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  display: inline-block;
}

.cta-button.primary {
  background-color: #1e40af;
  color: white;
  border: none;
}

.cta-button.primary:hover {
  background-color: #1e3a8a;
}

.cta-button.secondary {
  background-color: transparent;
  color: #1e40af;
  border: 2px solid #1e40af;
}

.cta-button.secondary:hover {
  background-color: #1e40af;
  color: white;
}

@media (max-width: 768px) {
  .codegen-header h1 {
    font-size: 2.5rem;
  }
  
  .tools-grid,
  .demo-grid,
  .pricing-grid {
    grid-template-columns: 1fr;
  }
  
  .pricing-card.featured {
    transform: none;
  }
  
  .cta-buttons {
    flex-direction: column;
  }
  
  .cta-button {
    width: 100%;
    max-width: 300px;
  }
}
</style>
