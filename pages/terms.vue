<template>
  <div class="terms-container">
    <h1 class="page-title">Terms & Privacy Policy</h1>

    <div class="content-panel">
      <div class="tabs">
        <button
          :class="['tab-button', { active: activeTab === 'terms' }]"
          @click="activeTab = 'terms'"
        >
          Terms of Service
        </button>
        <button
          :class="['tab-button', { active: activeTab === 'privacy' }]"
          @click="activeTab = 'privacy'"
        >
          Privacy Policy
        </button>
      </div>

      <div class="tab-content">
        <div v-if="activeTab === 'terms'" class="terms-content">
          <h2>Terms of Service</h2>
          <p class="last-updated">Last updated: May 15, 2025</p>

          <div class="section">
            <h3>1. Introduction</h3>
            <p>
              Welcome to Cloudless.gr ("Company", "we", "our", "us"). These Terms of Service
              ("Terms", "Terms of Service") govern your use of our website located at cloudless.gr
              (together or individually "Service") operated by Cloudless.
            </p>
            <p>
              Our Privacy Policy also governs your use of our Service and explains how we collect,
              safeguard and disclose information that results from your use of our web pages.
            </p>
            <p>
              Your agreement with us includes these Terms and our Privacy Policy ("Agreements"). You
              acknowledge that you have read and understood Agreements, and agree to be bound by
              them.
            </p>
          </div>

          <div class="section">
            <h3>2. Communications</h3>
            <p>
              By using our Service, you agree to subscribe to newsletters, marketing or promotional
              materials and other information we may send. However, you may opt out of receiving
              any, or all, of these communications from us by following the unsubscribe link or by
              emailing us at info@cloudless.gr.
            </p>
          </div>

          <div class="section">
            <h3>3. Purchases</h3>
            <p>
              If you wish to purchase any product or service made available through Service
              ("Purchase"), you may be asked to supply certain information relevant to your Purchase
              including but not limited to, your credit or debit card number, your card's expiration
              date, your billing address, and your shipping information.
            </p>
            <p>
              You represent and warrant that: (i) you have the legal right to use any card(s) or
              other payment method(s) in connection with any Purchase; and that (ii) the information
              you supply to us is true, correct and complete.
            </p>
          </div>

          <div class="section">
            <h3>4. Content</h3>
            <p>
              Our Service allows you to post, link, store, share and otherwise make available
              certain information, text, graphics, videos, or other material ("Content"). You are
              responsible for the Content that you post on or through Service, including its
              legality, reliability, and appropriateness.
            </p>
            <p>
              By posting Content on or through Service, You represent and warrant that: (i) Content
              is yours and/or you have the right to use it and the right to grant us the rights and
              license as provided in these Terms, and (ii) that the posting of your Content on or
              through Service does not violate the privacy rights, publicity rights, copyrights,
              contract rights or any other rights of any person or entity.
            </p>
          </div>

          <div class="section">
            <h3>5. Prohibited Uses</h3>
            <p>
              You may use Service only for lawful purposes and in accordance with Terms. You agree
              not to use Service:
            </p>
            <ul>
              <li>
                In any way that violates any applicable national or international law or regulation.
              </li>
              <li>
                For the purpose of exploiting, harming, or attempting to exploit or harm minors in
                any way by exposing them to inappropriate content or otherwise.
              </li>
              <li>
                To transmit, or procure the sending of, any advertising or promotional material,
                including any "junk mail", "chain letter," "spam," or any other similar
                solicitation.
              </li>
              <li>
                To impersonate or attempt to impersonate Company, a Company employee, another user,
                or any other person or entity.
              </li>
              <li>
                In any way that infringes upon the rights of others, or in any way is illegal,
                threatening, fraudulent, or harmful, or in connection with any unlawful, illegal,
                fraudulent, or harmful purpose or activity.
              </li>
            </ul>
          </div>

          <div class="section">
            <h3>6. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, in no event shall the Company or
              its suppliers be liable for any special, incidental, indirect, or consequential
              damages whatsoever (including, but not limited to, damages for loss of profits, loss
              of data or other information, for business interruption, for personal injury, loss of
              privacy arising out of or in any way related to the use of or inability to use the
              Service, third-party software and/or third-party hardware used with the Service, or
              otherwise in connection with any provision of this Terms), even if the Company or any
              supplier has been advised of the possibility of such damages and even if the remedy
              fails of its essential purpose.
            </p>
          </div>
        </div>

        <div v-if="activeTab === 'privacy'" class="privacy-content">
          <h2>Privacy Policy</h2>
          <p class="last-updated">Last updated: May 15, 2025</p>

          <div class="section">
            <h3>1. Information We Collect</h3>
            <p>
              We collect several different types of information for various purposes to provide and
              improve our Service to you.
            </p>

            <h4>Types of Data Collected</h4>
            <h5>Personal Data</h5>
            <p>
              While using our Service, we may ask you to provide us with certain personally
              identifiable information that can be used to contact or identify you ("Personal
              Data"). Personally identifiable information may include, but is not limited to:
            </p>
            <ul>
              <li>Email address</li>
              <li>First name and last name</li>
              <li>Phone number</li>
              <li>Address, State, Province, ZIP/Postal code, City</li>
              <li>Cookies and Usage Data</li>
            </ul>

            <h5>Usage Data</h5>
            <p>
              We may also collect information on how the Service is accessed and used ("Usage
              Data"). This Usage Data may include information such as your computer's Internet
              Protocol address (e.g. IP address), browser type, browser version, the pages of our
              Service that you visit, the time and date of your visit, the time spent on those
              pages, unique device identifiers and other diagnostic data.
            </p>

            <h5>Tracking & Cookies Data</h5>
            <p>
              We use cookies and similar tracking technologies to track the activity on our Service
              and hold certain information.
            </p>
            <p>
              Cookies are files with a small amount of data which may include an anonymous unique
              identifier. Cookies are sent to your browser from a website and stored on your device.
              Tracking technologies also used are beacons, tags, and scripts to collect and track
              information and to improve and analyze our Service.
            </p>
          </div>

          <div class="section">
            <h3>2. Use of Data</h3>
            <p>Cloudless uses the collected data for various purposes:</p>
            <ul>
              <li>To provide and maintain our Service</li>
              <li>To notify you about changes to our Service</li>
              <li>
                To allow you to participate in interactive features of our Service when you choose
                to do so
              </li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information so that we can improve our Service</li>
              <li>To monitor the usage of our Service</li>
              <li>To detect, prevent and address technical issues</li>
            </ul>
          </div>

          <div class="section">
            <h3>3. Transfer Of Data</h3>
            <p>
              Your information, including Personal Data, may be transferred to — and maintained on —
              computers located outside of your state, province, country or other governmental
              jurisdiction where the data protection laws may differ from those of your
              jurisdiction.
            </p>
            <p>
              If you are located outside Greece and choose to provide information to us, please note
              that we transfer the data, including Personal Data, to Greece and process it there.
            </p>
            <p>
              Your consent to this Privacy Policy followed by your submission of such information
              represents your agreement to that transfer.
            </p>
          </div>

          <div class="section">
            <h3>4. Security of Data</h3>
            <p>
              The security of your data is important to us, but remember that no method of
              transmission over the Internet, or method of electronic storage is 100% secure. While
              we strive to use commercially acceptable means to protect your Personal Data, we
              cannot guarantee its absolute security.
            </p>
          </div>

          <div class="section">
            <h3>5. Your Data Protection Rights Under GDPR</h3>
            <p>
              If you are a resident of the European Economic Area (EEA), you have certain data
              protection rights. Cloudless aims to take reasonable steps to allow you to correct,
              amend, delete, or limit the use of your Personal Data.
            </p>
            <p>In certain circumstances, you have the following data protection rights:</p>
            <ul>
              <li>The right to access, update or to delete the information we have on you.</li>
              <li>
                The right of rectification. You have the right to have your information rectified if
                that information is inaccurate or incomplete.
              </li>
              <li>
                The right to object. You have the right to object to our processing of your Personal
                Data.
              </li>
              <li>
                The right of restriction. You have the right to request that we restrict the
                processing of your personal information.
              </li>
              <li>
                The right to data portability. You have the right to be provided with a copy of your
                Personal Data in a structured, machine-readable and commonly used format.
              </li>
              <li>
                The right to withdraw consent. You also have the right to withdraw your consent at
                any time where Cloudless relied on your consent to process your personal
                information.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';

  const activeTab = ref<'terms' | 'privacy'>('terms');
</script>

<style scoped>
  .terms-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .page-title {
    font-size: 2.25rem;
    margin-bottom: 2rem;
    color: #1e40af;
    text-align: center;
    font-weight: 700;
  }

  .content-panel {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    border: 1px solid rgba(219, 234, 254, 0.6);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
  }

  .tab-button {
    flex: 1;
    padding: 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: #64748b;
    transition: all 0.2s;
    font-size: 1.1rem;
  }

  .tab-button:hover {
    color: #1e40af;
  }

  .tab-button.active {
    color: #1e40af;
    border-bottom: 3px solid #1e40af;
  }

  .tab-content {
    padding: 2rem;
    max-height: 80vh;
    overflow-y: auto;
  }

  .terms-content h2,
  .privacy-content h2 {
    font-size: 1.75rem;
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: #1e40af;
  }

  .last-updated {
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 2rem;
    font-style: italic;
  }

  .section {
    margin-bottom: 2rem;
  }

  .section h3 {
    font-size: 1.35rem;
    margin-bottom: 1rem;
    color: #334155;
  }

  .section h4 {
    font-size: 1.2rem;
    margin: 1.5rem 0 0.75rem;
    color: #334155;
  }

  .section h5 {
    font-size: 1rem;
    margin: 1rem 0 0.5rem;
    color: #334155;
  }

  .section p {
    margin-bottom: 1rem;
    line-height: 1.6;
    color: #334155;
  }

  .section ul {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }

  .section li {
    margin-bottom: 0.5rem;
    line-height: 1.6;
    color: #334155;
  }

  @media (max-width: 640px) {
    .tab-content {
      padding: 1.5rem;
    }

    .tabs {
      flex-direction: column;
    }

    .tab-button {
      border-bottom: 1px solid #e2e8f0;
    }

    .tab-button.active {
      border-bottom: 1px solid #e2e8f0;
      border-left: 3px solid #1e40af;
    }
  }
</style>
