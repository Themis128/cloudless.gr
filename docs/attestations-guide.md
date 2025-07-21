# 🔐 GitHub Actions Attestations Guide

## 📋 What are Attestations?

### **Definition:**
Attestations are **cryptographic proofs** that provide verifiable evidence about your build process, including:
- **Build provenance** - Where and how the build was created
- **Supply chain security** - Verification of build integrity
- **Compliance** - Meeting security standards (SLSA, etc.)
- **Audit trail** - Complete build history

### **Benefits:**
- **🔒 Supply Chain Security** - Verify build integrity
- **📋 Compliance** - Meet enterprise security standards
- **🔍 Audit Trail** - Complete build history
- **🤝 Trust** - Cryptographic verification of builds
- **🚀 Enterprise Ready** - Meet SLSA and other security frameworks

## 🛠️ Implementation in Your Project

### **Current Attestation Setup:**

#### **1. Application Build Attestation:**
```yaml
- name: Generate build attestation
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: "cloudless.gr"
    subject-digest: "sha256:${{ hashFiles('.output/**') }}"
```

#### **2. Docker Build Attestation:**
```yaml
- name: Generate Docker build attestation
  if: steps.check-dockerfile.outputs.exists == 'true'
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ matrix.tag }}-test"
    subject-digest: "sha256:$(docker images ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ matrix.tag }}-test --format '{{.ID}}' 2>/dev/null | cut -d: -f2 || echo 'unknown')"
```

## 📊 Attestation Types

### **1. Build Provenance Attestations**
- **What**: Proof of how the build was created
- **When**: Generated after successful builds
- **Where**: Stored in GitHub's attestation registry

### **2. Supply Chain Security**
- **Source verification** - Git commit and branch
- **Build environment** - Runner and tools used
- **Dependencies** - Package versions and sources
- **Output verification** - Hash of build artifacts

### **3. Compliance Frameworks**
- **SLSA (Supply chain Levels for Software Artifacts)**
- **NIST Cybersecurity Framework**
- **ISO 27001**
- **SOC 2 Type II**

## 🔍 Viewing Attestations

### **In GitHub Actions:**
1. Go to your repository
2. Navigate to **Actions** → **Attestations**
3. View attestations for each build
4. Download attestation files

### **Attestation Content:**
```json
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "subject": [
    {
      "name": "cloudless.gr",
      "digest": {
        "sha256": "abc123..."
      }
    }
  ],
  "predicateType": "https://slsa.dev/provenance/v0.2",
  "predicate": {
    "buildType": "https://github.com/actions/runner",
    "builder": {
      "id": "https://github.com/actions/runner"
    },
    "invocation": {
      "configSource": {
        "uri": "git+https://github.com/your-repo.git",
        "digest": {
          "sha1": "commit-hash"
        },
        "entryPoint": ".github/workflows/complete-pipeline.yml"
      }
    }
  }
}
```

## 🚀 Advanced Attestation Features

### **1. Custom Attestation Types**
```yaml
- name: Generate custom attestation
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: "custom-artifact"
    subject-digest: "sha256:${{ hashFiles('dist/**') }}"
    # Add custom metadata
    custom-metadata: |
      {
        "security-scan": "passed",
        "vulnerabilities": "0",
        "compliance": "SLSA_LEVEL_2"
      }
```

### **2. Multiple Subject Attestations**
```yaml
- name: Generate multi-subject attestation
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: |
      cloudless.gr-app
      cloudless.gr-docs
      cloudless.gr-tests
    subject-digest: |
      sha256:${{ hashFiles('.output/**') }}
      sha256:${{ hashFiles('docs/**') }}
      sha256:${{ hashFiles('test-results/**') }}
```

### **3. Conditional Attestations**
```yaml
- name: Generate conditional attestation
  if: github.ref == 'refs/heads/main'
  uses: actions/attest-build-provenance@v2
  with:
    subject-name: "production-build"
    subject-digest: "sha256:${{ hashFiles('.output/**') }}"
```

## 📈 Attestation Best Practices

### **1. Security Considerations**
- **Verify attestations** before deployment
- **Store attestations** securely
- **Monitor attestation** generation
- **Validate attestation** signatures

### **2. Compliance Requirements**
- **SLSA Level 2+** - Use attestations for all builds
- **Enterprise policies** - Meet internal security standards
- **Regulatory compliance** - Industry-specific requirements
- **Audit trails** - Maintain complete build history

### **3. Performance Optimization**
- **Generate attestations** only for important builds
- **Use conditional logic** to avoid unnecessary attestations
- **Optimize subject digests** for large artifacts
- **Cache attestation** metadata where possible

## 🔧 Troubleshooting

### **Common Issues:**

#### **1. Attestation Generation Fails**
```yaml
# Ensure proper permissions
permissions:
  id-token: write  # Required for attestations
  contents: read
```

#### **2. Invalid Subject Digest**
```yaml
# Use correct hash format
subject-digest: "sha256:${{ hashFiles('path/to/artifacts/**') }}"
```

#### **3. Missing Attestations**
- Check if attestation step runs
- Verify permissions are set correctly
- Ensure build artifacts exist

### **Debug Commands:**
```bash
# Check attestation status
gh api repos/:owner/:repo/attestations

# Download attestation
gh api repos/:owner/:repo/attestations/:attestation_id

# Verify attestation
cosign verify-attestation attestation.json
```

## 🎯 Next Steps

### **Phase 1: Basic Implementation ✅**
- [x] Application build attestations
- [x] Docker build attestations
- [x] Basic security verification

### **Phase 2: Advanced Features**
- [ ] Custom attestation types
- [ ] Multi-subject attestations
- [ ] Conditional attestation logic
- [ ] Attestation verification workflows

### **Phase 3: Compliance & Security**
- [ ] SLSA Level 2+ compliance
- [ ] Enterprise security policies
- [ ] Automated attestation verification
- [ ] Security scanning integration

## 📚 Resources

### **Official Documentation:**
- [GitHub Actions Attestations](https://docs.github.com/en/actions/security-guides/using-openid-connect-with-reusable-workflows#using-attestations)
- [SLSA Framework](https://slsa.dev/)
- [In-toto Attestation Framework](https://in-toto.io/)

### **Tools & Libraries:**
- [Cosign](https://github.com/sigstore/cosign) - Attestation verification
- [SLSA Verifier](https://github.com/slsa-framework/slsa-verifier) - SLSA compliance
- [Sigstore](https://www.sigstore.dev/) - Security tools

### **Community:**
- [SLSA Community](https://slsa.dev/community)
- [Sigstore Community](https://www.sigstore.dev/community)
- [GitHub Security Lab](https://securitylab.github.com/) 