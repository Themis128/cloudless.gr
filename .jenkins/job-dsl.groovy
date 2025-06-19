// Jenkins Job DSL Script for Cloudless.gr
pipelineJob('cloudless-gr-e2e-pipeline') {
    description('End-to-end testing pipeline for Cloudless.gr Nuxt application')

    definition {
        cpsScm {
            scm {
                git {
                    remote {
                        url('https://github.com/yourusername/cloudless.gr.git')
                        credentials('github-credentials-id') // Configure in Jenkins
                    }
                    branches('*/application', '*/develop')
                    scriptPath('Jenkinsfile')
                }
            }
        }
    }

    // Trigger configuration
    triggers {
        scm('H/2 * * * *') // Poll every 2 minutes

        // GitHub webhook trigger
        githubPush()

        // Generic webhook trigger
        genericTrigger {
            genericVariables {
                genericVariable {
                    key('ref')
                    value('$.ref')
                }
                genericVariable {
                    key('repository')
                    value('$.repository.name')
                }
                genericVariable {
                    key('pusher')
                    value('$.pusher.name')
                }
            }

            causeString('Triggered by GitHub webhook - Repository: $repository, Branch: $ref, Pusher: $pusher')
            token('cloudless-gr-webhook-token')
            printContributedVariables(true)
            printPostContent(true)

            regexpFilterText('$ref')
            regexpFilterExpression('refs/heads/(application|develop)')
        }
    }

    // Build properties
    properties {
        buildDiscarder {
            strategy {
                logRotator {
                    numToKeepStr('10')
                    daysToKeepStr('30')
                    artifactNumToKeepStr('5')
                    artifactDaysToKeepStr('14')
                }
            }
        }

        githubProjectProperty {
            projectUrlStr('https://github.com/yourusername/cloudless.gr')
        }

        parameters {
            stringParam('BRANCH', 'application', 'Branch to build')
            booleanParam('SKIP_TESTS', false, 'Skip running tests')
            choiceParam('ENVIRONMENT', ['test', 'staging', 'production'], 'Target environment')
        }
    }
}

// Create a multibranch pipeline for automatic branch detection
multibranchPipelineJob('cloudless-gr-multibranch') {
    description('Multibranch pipeline for Cloudless.gr - automatically detects branches with Jenkinsfile')

    branchSources {
        github {
            id('cloudless-gr-github')
            repoOwner('yourusername')
            repository('cloudless.gr')
            credentialsId('github-credentials-id')

            traits {
                gitHubBranchDiscovery {
                    strategyId(1) // Exclude branches that are also filed as PRs
                }
                gitHubPullRequestDiscovery {
                    strategyId(1) // Merging the pull request with the current target branch revision
                }
                gitHubForkDiscovery {
                    strategyId(1) // Merging the pull request with the current target branch revision
                    trust {
                        gitHubTrustPermissions()
                    }
                }
            }
        }
    }

    factory {
        workflowBranchProjectFactory {
            scriptPath('Jenkinsfile')
        }
    }

    triggers {
        periodicFolderTrigger {
            interval('5m')
        }
    }

    orphanedItemStrategy {
        discardOldItems {
            numToKeep(5)
        }
    }
}
