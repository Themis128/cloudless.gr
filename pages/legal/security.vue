<template>
  <v-container class="legal-page" fluid>
    <div class="page-header mb-8">
      <v-row justify="center">
        <v-col cols="12" md="8">
          <h1 class="text-h2 font-weight-bold primary--text text-center mb-4">
            Security Policy
          </h1>
          <p class="text-subtitle-1 text-center text-grey-darken-1 mb-4">
            Last updated: {{ lastUpdated }}
          </p>
          <v-divider />
        </v-col>
      </v-row>
    </div>

    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6">
          <div class="legal-content">
            <section class="mb-8">
              <h2 class="text-h4 mb-4">Our Commitment to Security</h2>
              <p class="text-body-1 mb-4">
                At Cloudless, we take the security of our platform and your data seriously. This Security Policy outlines the measures we implement to protect your information and maintain the integrity of our services.
              </p>
              <p class="text-body-1">
                We continuously monitor, assess, and improve our security practices to ensure we meet industry standards and best practices.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Data Protection Measures</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Encryption</h3>
                <ul class="text-body-1 mb-4">
                  <li><strong>Data in Transit:</strong> All data transmitted between your device and our servers is encrypted using TLS 1.3</li>
                  <li><strong>Data at Rest:</strong> All stored data is encrypted using AES-256 encryption</li>
                  <li><strong>Database Encryption:</strong> Our databases use transparent data encryption (TDE)</li>
                  <li><strong>Backup Encryption:</strong> All backups are encrypted using industry-standard encryption methods</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Access Controls</h3>
                <ul class="text-body-1 mb-4">
                  <li>Multi-factor authentication (MFA) required for all administrative accounts</li>
                  <li>Role-based access control (RBAC) to limit data access based on job requirements</li>
                  <li>Regular access reviews and automated account deprovisioning</li>
                  <li>Principle of least privilege enforced across all systems</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Network Security</h3>
                <ul class="text-body-1 mb-4">
                  <li>Web Application Firewall (WAF) protection</li>
                  <li>DDoS protection and mitigation</li>
                  <li>Network segmentation and isolation</li>
                  <li>Regular vulnerability scanning and penetration testing</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Infrastructure Security</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Cloud Security</h3>
                <p class="text-body-1 mb-4">
                  Our infrastructure is hosted on industry-leading cloud providers that maintain:
                </p>
                <ul class="text-body-1 mb-4">
                  <li>SOC 2 Type II compliance</li>
                  <li>ISO 27001 certification</li>
                  <li>Physical security controls for data centers</li>
                  <li>Environmental monitoring and controls</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Application Security</h3>
                <ul class="text-body-1 mb-4">
                  <li>Secure software development lifecycle (SSDLC)</li>
                  <li>Regular security code reviews</li>
                  <li>Automated security testing in CI/CD pipelines</li>
                  <li>Third-party security audits and assessments</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Container Security</h3>
                <ul class="text-body-1 mb-4">
                  <li>Container image scanning for vulnerabilities</li>
                  <li>Runtime security monitoring</li>
                  <li>Immutable infrastructure practices</li>
                  <li>Least-privilege container configurations</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Compliance and Certifications</h2>
              <p class="text-body-1 mb-4">
                We maintain compliance with various industry standards and regulations:
              </p>
              
              <v-row class="mb-4">
                <v-col cols="12" md="6">
                  <v-card variant="outlined" class="pa-4 h-100">
                    <h4 class="text-h6 mb-3">Current Certifications</h4>
                    <ul class="text-body-2">
                      <li>SOC 2 Type II</li>
                      <li>ISO 27001:2013</li>
                      <li>GDPR Compliance</li>
                      <li>CCPA Compliance</li>
                    </ul>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card variant="outlined" class="pa-4 h-100">
                    <h4 class="text-h6 mb-3">Industry Standards</h4>
                    <ul class="text-body-2">
                      <li>NIST Cybersecurity Framework</li>
                      <li>OWASP Top 10</li>
                      <li>PCI DSS (for payment processing)</li>
                      <li>HIPAA (where applicable)</li>
                    </ul>
                  </v-card>
                </v-col>
              </v-row>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Incident Response</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">24/7 Security Monitoring</h3>
                <p class="text-body-1 mb-4">
                  Our Security Operations Center (SOC) provides round-the-clock monitoring of our systems and infrastructure to detect and respond to potential security incidents.
                </p>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Incident Response Process</h3>
                <ol class="text-body-1 mb-4">
                  <li><strong>Detection:</strong> Automated monitoring and alerting systems</li>
                  <li><strong>Assessment:</strong> Rapid evaluation of incident severity and impact</li>
                  <li><strong>Containment:</strong> Immediate actions to limit the scope of the incident</li>
                  <li><strong>Investigation:</strong> Thorough analysis to understand the root cause</li>
                  <li><strong>Recovery:</strong> Restoration of normal operations and services</li>
                  <li><strong>Post-Incident:</strong> Review and improvement of security measures</li>
                </ol>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Communication</h3>
                <p class="text-body-1 mb-4">
                  In the event of a security incident that may affect your data or our services:
                </p>
                <ul class="text-body-1 mb-4">
                  <li>We will notify affected users within 72 hours of discovering the incident</li>
                  <li>Updates will be provided through our status page and direct communication</li>
                  <li>We will work with law enforcement and regulatory bodies as required</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Employee Security</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Background Checks</h3>
                <p class="text-body-1 mb-4">
                  All employees with access to customer data undergo comprehensive background checks appropriate to their role and level of access.
                </p>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Security Training</h3>
                <ul class="text-body-1 mb-4">
                  <li>Regular security awareness training for all employees</li>
                  <li>Specialized training for security and development teams</li>
                  <li>Phishing simulation exercises</li>
                  <li>Annual security certifications and assessments</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Access Management</h3>
                <ul class="text-body-1 mb-4">
                  <li>Unique user accounts for each employee</li>
                  <li>Regular access reviews and updates</li>
                  <li>Immediate access revocation upon termination</li>
                  <li>Segregation of duties for critical operations</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Vulnerability Management</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Regular Assessments</h3>
                <ul class="text-body-1 mb-4">
                  <li>Quarterly penetration testing by third-party security firms</li>
                  <li>Continuous vulnerability scanning of all systems</li>
                  <li>Annual security audits and assessments</li>
                  <li>Bug bounty program for responsible disclosure</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Patch Management</h3>
                <ul class="text-body-1 mb-4">
                  <li>Critical security patches applied within 24 hours</li>
                  <li>Regular updates to all systems and software</li>
                  <li>Automated patch management where possible</li>
                  <li>Change management process for all updates</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Data Backup and Recovery</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Backup Strategy</h3>
                <ul class="text-body-1 mb-4">
                  <li>Automated daily backups of all critical data</li>
                  <li>Geographically distributed backup storage</li>
                  <li>Point-in-time recovery capabilities</li>
                  <li>Regular backup testing and validation</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Disaster Recovery</h3>
                <ul class="text-body-1 mb-4">
                  <li>Comprehensive disaster recovery plan</li>
                  <li>Regular disaster recovery testing</li>
                  <li>Multi-region infrastructure for high availability</li>
                  <li>Recovery Time Objective (RTO) of 4 hours</li>
                  <li>Recovery Point Objective (RPO) of 1 hour</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Responsible Disclosure</h2>
              <p class="text-body-1 mb-4">
                We encourage the responsible disclosure of security vulnerabilities. If you discover a security issue:
              </p>
              
              <v-card variant="outlined" class="pa-4 mb-4">
                <h4 class="text-h6 mb-3">Reporting Security Issues</h4>
                <ul class="text-body-1">
                  <li>
                    Email: <a href="mailto:security@cloudless.dev" class="text-primary">security@cloudless.dev</a>
                  </li>
                  <li>
                    PGP Key: Available on our website for encrypted communications
                  </li>
                  <li>
                    Response Time: We aim to acknowledge reports within 24 hours
                  </li>
                </ul>
              </v-card>

              <div class="mb-4">
                <h4 class="text-h6 mb-3">What to Include</h4>
                <ul class="text-body-1 mb-4">
                  <li>Detailed description of the vulnerability</li>
                  <li>Steps to reproduce the issue</li>
                  <li>Potential impact assessment</li>
                  <li>Any relevant screenshots or proof-of-concept</li>
                </ul>
              </div>

              <div class="mb-4">
                <h4 class="text-h6 mb-3">What We Promise</h4>
                <ul class="text-body-1">
                  <li>We will not pursue legal action for good faith security research</li>
                  <li>We will work with you to understand and resolve the issue promptly</li>
                  <li>We will acknowledge your contribution (with your permission)</li>
                  <li>We may offer a bounty for qualifying vulnerabilities</li>
                </ul>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Third-Party Security</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Vendor Assessment</h3>
                <p class="text-body-1 mb-4">
                  All third-party vendors and service providers undergo security assessments before integration:
                </p>
                <ul class="text-body-1 mb-4">
                  <li>Security questionnaires and due diligence</li>
                  <li>Contractual security requirements</li>
                  <li>Regular security reviews and audits</li>
                  <li>Data processing agreements (DPA) where applicable</li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Supply Chain Security</h3>
                <ul class="text-body-1 mb-4">
                  <li>Dependency scanning for known vulnerabilities</li>
                  <li>Software bill of materials (SBOM) tracking</li>
                  <li>Regular updates to third-party components</li>
                  <li>Secure development practices for all integrations</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 class="text-h4 mb-4">Contact Us</h2>
              <p class="text-body-1 mb-4">
                For questions about our security practices or to report security concerns:
              </p>
              <v-card variant="outlined" class="pa-4">
                <ul class="text-body-1 list-style-none">
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-shield-check</v-icon>
                    Security Team: <a href="mailto:security@cloudless.dev" class="text-primary">security@cloudless.dev</a>
                  </li>
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-email</v-icon>
                    General: <a href="mailto:privacy@cloudless.dev" class="text-primary">privacy@cloudless.dev</a>
                  </li>
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-web</v-icon>
                    Website: <a href="https://cloudless.dev" class="text-primary" target="_blank">cloudless.dev</a>
                  </li>
                  <li>
                    <v-icon class="mr-2">mdi-map-marker</v-icon>
                    Address: 123 Tech Street, San Francisco, CA 94102, USA
                  </li>
                </ul>
              </v-card>
            </section>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const lastUpdated = 'January 20, 2024'
</script>

<style scoped>
.legal-page {
  max-width: 1200px;
  margin: 0 auto;
}

.legal-content {
  line-height: 1.7;
}

.legal-content h2 {
  color: rgb(var(--v-theme-primary));
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 8px;
}

.legal-content h3 {
  color: rgb(var(--v-theme-secondary));
}

.legal-content ul {
  padding-left: 1.5rem;
}

.legal-content ol {
  padding-left: 1.5rem;
}

.legal-content li {
  margin-bottom: 0.5rem;
}

.list-style-none {
  list-style: none;
  padding-left: 0;
}

.h-100 {
  height: 100%;
}
</style>
