<template>
  <div class="contact-container">
    <div class="contact-content">
      <h1 class="contact-title">Contact Us</h1>
      <p class="contact-subtitle">Have a question or want to work with us? Get in touch!</p>

      <form class="contact-form">
        <div class="form-group">
          <label for="name">Full Name</label>
          <input type="text" id="name" placeholder="Enter your full name" class="form-input" />
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            type="email"
            id="email"
            placeholder="Enter your email address"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="subject">Subject</label>
          <input type="text" id="subject" placeholder="What's this about?" class="form-input" />
        </div>

        <div class="form-group">
          <label for="message">Message</label>
          <textarea
            id="message"
            rows="5"
            placeholder="Tell us what you need"
            class="form-textarea"
          ></textarea>
        </div>

        <button type="submit" class="submit-button">Send Message</button>
      </form>

      <div class="contact-info">
        <div class="info-item"><strong>Email:</strong> contact@cloudless.gr</div>
        <div class="info-item"><strong>Location:</strong> Athens, Greece</div>
        <div class="info-item"><strong>Working Hours:</strong> 9:00 AM - 6:00 PM EET</div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Contact form logic can be added here
const handleSubmit = () => {
  // Form submission logic
  console.log('Form submitted');
};
</script>

<style scoped>
.contact-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem 1rem;
  min-height: 80vh;
}

.contact-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 2.5rem;
  max-width: 650px;
  width: 100%;
}

.contact-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.5rem;
  text-align: center;
}

.contact-subtitle {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  text-align: center;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 1rem;
  font-weight: 500;
  color: #475569;
}

.form-input,
.form-textarea {
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.submit-button {
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  margin-top: 1rem;
  text-align: center;
}

.submit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.contact-info {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  font-size: 1rem;
  color: #475569;
}

@media (max-width: 640px) {
  .contact-content {
    padding: 1.5rem;
  }

  .contact-title {
    font-size: 1.75rem;
  }
}
</style>
