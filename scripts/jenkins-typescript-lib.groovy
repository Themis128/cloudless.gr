#!/usr/bin/env groovy

/**
 * Jenkins Shared Library for TypeScript Quality Gates
 * Usage: typeScriptQualityGate(maxErrors: 20, autoFix: true)
 */

def call(Map config = [:]) {
    // Default configuration
    def maxErrors = config.maxErrors ?: 20
    def autoFix = config.autoFix ?: true
    def failOnError = config.failOnError ?: false
    def detailed = config.detailed ?: true

    echo "🔍 Running TypeScript Quality Gate (maxErrors: ${maxErrors}, autoFix: ${autoFix})"

    script {
        try {
            // Run the enhanced TypeScript check
            def result = sh(
                script: "pwsh -File scripts/jenkins-typescript-check.ps1 -MaxErrors ${maxErrors} ${autoFix ? '-AutoFix' : ''} ${detailed ? '-Detailed' : ''}",
                returnStatus: true
            )

            // Parse results and update build info
            def buildInfo = parseTypeScriptResults()

            // Update build description and badges
            updateBuildMetadata(buildInfo)

            // Determine build status
            if (result != 0) {
                if (failOnError) {
                    error "TypeScript Quality Gate failed with ${buildInfo.finalErrors} errors"
                } else {
                    currentBuild.result = 'UNSTABLE'
                    echo "⚠️ TypeScript Quality Gate failed - Build marked as unstable"
                }
            } else {
                echo "✅ TypeScript Quality Gate passed"
            }

            return buildInfo

        } catch (Exception e) {
            echo "❌ TypeScript Quality Gate encountered an error: ${e.getMessage()}"
            if (failOnError) {
                throw e
            } else {
                currentBuild.result = 'UNSTABLE'
            }
        }
    }
}

def parseTypeScriptResults() {
    def buildInfo = [:]

    // Parse initial errors
    if (fileExists('typescript-initial.log')) {
        buildInfo.initialErrors = sh(
            script: 'grep "Found.*errors" typescript-initial.log | tail -1 | grep -o "[0-9]\\+" || echo "0"',
            returnStdout: true
        ).trim().toInteger()
    } else {
        buildInfo.initialErrors = 0
    }

    // Parse final errors (after auto-fix)
    if (fileExists('typescript-post-fix.log')) {
        buildInfo.finalErrors = sh(
            script: 'grep "Found.*errors" typescript-post-fix.log | tail -1 | grep -o "[0-9]\\+" || echo "0"',
            returnStdout: true
        ).trim().toInteger()
        buildInfo.autoFixApplied = true
    } else {
        buildInfo.finalErrors = buildInfo.initialErrors
        buildInfo.autoFixApplied = false
    }

    buildInfo.improvement = buildInfo.initialErrors - buildInfo.finalErrors

    return buildInfo
}

def updateBuildMetadata(buildInfo) {
    // Update build description
    if (buildInfo.autoFixApplied) {
        currentBuild.description = "TS Errors: ${buildInfo.initialErrors} → ${buildInfo.finalErrors}"
    } else {
        currentBuild.description = "TS Errors: ${buildInfo.finalErrors}"
    }

    // Add build badge
    def badgeColor = buildInfo.finalErrors == 0 ? "green" :
                    buildInfo.finalErrors < 10 ? "yellow" : "red"
    def badgeText = "TS: ${buildInfo.finalErrors}"

    if (buildInfo.improvement > 0) {
        badgeText += " (-${buildInfo.improvement})"
    }

    addShortText text: badgeText, color: badgeColor

    // Create trend data for plotting
    writeFile file: 'typescript-metrics.json', text: groovy.json.JsonBuilder([
        timestamp: new Date().getTime(),
        initialErrors: buildInfo.initialErrors,
        finalErrors: buildInfo.finalErrors,
        improvement: buildInfo.improvement,
        autoFixApplied: buildInfo.autoFixApplied
    ]).toString()
}
