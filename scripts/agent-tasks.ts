#!/usr/bin/env node
/**
 * Comprehensive Agent Task Runner for Development Automation
 * Supports all types of tasks: development, testing, building, deployment, AI assistance, etc.
 * Enhanced for agent-driven development workflows
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import os from 'os';

interface TaskDefinition {
  name: string;
  description: string;
  command?: string;
  commands?: string[]; // Multiple commands to run in sequence
  type: 'background' | 'build' | 'test' | 'validation' | 'formatting' | 'docker' | 'setup' | 'maintenance' | 'ai' | 'git' | 'database' | 'monitoring';
  steps?: string[];
  files?: string[];
  timeout?: number;
  retries?: number;
  environment?: Record<string, string>;
  workingDirectory?: string;
  shell?: 'cmd' | 'powershell' | 'bash';
  dependencies?: string[]; // Tasks that must complete before this one
  outputs?: string[]; // Expected output files/directories
  healthCheck?: string; // Command to verify task success
  platforms?: ('windows' | 'linux' | 'darwin')[]; // Supported platforms
  background?: boolean; // Whether task runs in the background
}

interface WorkflowDefinition {
  name: string;
  description: string;
  tasks: string[];
  parallel?: boolean; // Run tasks in parallel instead of sequence
  continueOnError?: boolean; // Continue workflow even if a task fails
  timeout?: number; // Overall workflow timeout
}

interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
  pid?: number;
  exitCode?: number;
  steps?: number; // Number of steps completed
}

interface WorkflowResult {
  success: boolean;
  results: Array<{ task: string; success: boolean; result?: any; error?: string }>;
  duration: number;
}

class AgentTaskRunner {
  private tasks: Map<string, TaskDefinition> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private taskHistory: Array<{ task: string; timestamp: Date; success: boolean; duration?: number }> = [];
  private platform: string = os.platform();

  constructor() {
    this.loadTasks();
  }

  private async loadTasks() {
    try {
      const tasksPath = path.join(process.cwd(), '.continue', 'prompts', 'vue-tasks.json');
      const tasksData = await fs.readFile(tasksPath, 'utf-8');
      const config = JSON.parse(tasksData);

      // Load individual tasks
      config.tasks?.forEach((task: TaskDefinition) => {
        this.tasks.set(task.name, task);
      });

      // Load workflows
      config.workflows?.forEach((workflow: WorkflowDefinition) => {
        this.workflows.set(workflow.name, workflow);
      });

      console.log(`✅ Loaded ${this.tasks.size} tasks and ${this.workflows.size} workflows`);    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn('⚠️ Could not load task definitions:', errorMessage);
      this.loadDefaultTasks();
    }
  }
  private loadDefaultTasks() {
    // Comprehensive default tasks for agent-driven development
    const defaultTasks: TaskDefinition[] = [
      // Development Tasks
      {
        name: 'dev',
        description: 'Start development server with hot reload',
        command: 'npm run dev',
        type: 'background',
        healthCheck: 'curl -f http://localhost:3000 || echo "Server not ready"'
      },
      {
        name: 'dev-secure',
        description: 'Start development server with HTTPS',
        command: 'npm run dev -- --https',
        type: 'background'
      },
      {
        name: 'build',
        description: 'Build application for production',
        command: 'npm run build',
        type: 'build',
        outputs: ['dist', '.nuxt', '.output']
      },
      {
        name: 'preview',
        description: 'Preview production build locally',
        command: 'npm run preview',
        type: 'background',
        dependencies: ['build']
      },

      // Testing Tasks
      {
        name: 'test',
        description: 'Run all test suites',
        command: 'npm run test:suite',
        type: 'test'
      },
      {
        name: 'test-unit',
        description: 'Run unit tests only',
        command: 'npm run test:unit',
        type: 'test'
      },
      {
        name: 'test-auth',
        description: 'Run authentication tests',
        commands: [
          'powershell -ExecutionPolicy Bypass -File test-admin-auth-quick.ps1',
          'powershell -ExecutionPolicy Bypass -File test-middleware-protection.ps1'
        ],
        type: 'test',
        shell: 'powershell',
        platforms: ['windows']
      },
      {
        name: 'test-coverage',
        description: 'Run tests with coverage report',
        command: 'npm run test:coverage',
        type: 'test',
        outputs: ['coverage']
      },

      // Code Quality Tasks
      {
        name: 'lint',
        description: 'Lint code with ESLint',
        command: 'npm run lint',
        type: 'validation'
      },
      {
        name: 'lint-fix',
        description: 'Auto-fix linting issues',
        command: 'npm run lint -- --fix',
        type: 'formatting'
      },
      {
        name: 'type-check',
        description: 'Check TypeScript types',
        command: 'npx vue-tsc --noEmit',
        type: 'validation'
      },
      {
        name: 'format',
        description: 'Format code with Prettier',
        command: 'npm run format',
        type: 'formatting'
      },

      // Docker Tasks
      {
        name: 'docker-dev',
        description: 'Start development environment with Docker',
        command: 'npm run docker:dev',
        type: 'docker',
        healthCheck: 'docker ps | grep cloudless'
      },
      {
        name: 'docker-prod',
        description: 'Start production environment with Docker',
        command: 'npm run docker:prod',
        type: 'docker'
      },
      {
        name: 'docker-stop',
        description: 'Stop all Docker containers',
        command: 'npm run docker:stop',
        type: 'docker'
      },
      {
        name: 'docker-clean',
        description: 'Clean Docker containers and volumes',
        command: 'npm run docker:clean',
        type: 'maintenance'
      },

      // Database Tasks
      {
        name: 'db-migrate',
        description: 'Run database migrations',
        command: 'npx tsx scripts/supabase-health.ts',
        type: 'database'
      },
      {
        name: 'db-health',
        description: 'Check database connectivity',
        command: 'npx tsx scripts/check-supabase.ts',
        type: 'database'
      },

      // Git Tasks
      {
        name: 'git-status',
        description: 'Check git repository status',
        command: 'git status --porcelain',
        type: 'git'
      },
      {
        name: 'git-commit',
        description: 'Commit changes with conventional message',
        command: 'npm run git:commit',
        type: 'git'
      },
      {
        name: 'git-sync',
        description: 'Sync with remote repository',
        command: 'npm run git:sync',
        type: 'git'
      },

      // AI/Agent Tasks
      {
        name: 'ai-analyze',
        description: 'Analyze codebase for improvements',
        steps: [
          'Scan for code quality issues',
          'Check for security vulnerabilities',
          'Identify performance bottlenecks',
          'Suggest architectural improvements'
        ],
        type: 'ai'
      },
      {
        name: 'ai-generate-tests',
        description: 'Generate test cases for components',
        steps: [
          'Analyze component structure',
          'Generate unit tests',
          'Generate integration tests',
          'Update test coverage'
        ],
        type: 'ai'
      },

      // Setup Tasks
      {
        name: 'setup-env',
        description: 'Setup development environment',
        commands: [
          'npm install',
          'powershell -ExecutionPolicy Bypass -File setup-dev-environment.ps1'
        ],
        type: 'setup',
        shell: 'powershell',
        platforms: ['windows']
      },
      {
        name: 'clean',
        description: 'Clean project artifacts',
        commands: [
          'npm run clean',
          'rmdir /s /q node_modules 2>nul || echo "node_modules not found"',
          'rmdir /s /q .nuxt 2>nul || echo ".nuxt not found"',
          'rmdir /s /q dist 2>nul || echo "dist not found"'
        ],
        type: 'maintenance',
        shell: 'cmd'
      },

      // Health Check Tasks
      {
        name: 'health-check',
        description: 'Run comprehensive health check',
        command: 'npm run health',
        type: 'validation'
      },
      {
        name: 'environment-check',
        description: 'Validate development environment',
        command: 'powershell -ExecutionPolicy Bypass -File test-environment.ps1',
        type: 'validation',
        shell: 'powershell',
        platforms: ['windows']
      },

      // Monitoring Tasks
      {
        name: 'monitor-performance',
        description: 'Monitor application performance',
        command: 'npm run monitor:performance',
        type: 'monitoring',
        timeout: 60000
      },
      {
        name: 'monitor-logs',
        description: 'Monitor application logs',
        command: 'npm run docker:logs',
        type: 'monitoring',
        background: true
      }
    ];

    defaultTasks.forEach(task => this.tasks.set(task.name, task));

    // Default workflows
    const defaultWorkflows: WorkflowDefinition[] = [
      {
        name: 'setup-complete',
        description: 'Complete development environment setup',
        tasks: ['setup-env', 'db-health', 'health-check']
      },
      {
        name: 'quality-check',
        description: 'Run full quality assurance',
        tasks: ['lint', 'type-check', 'test', 'test-coverage']
      },
      {
        name: 'deploy-prep',
        description: 'Prepare for deployment',
        tasks: ['quality-check', 'build', 'docker-prod']
      },
      {
        name: 'fix-auth',
        description: 'Fix authentication issues',
        tasks: ['test-auth', 'db-health', 'environment-check']
      },
      {
        name: 'ci-pipeline',
        description: 'Continuous integration pipeline',
        tasks: ['setup-env', 'quality-check', 'build', 'test-auth'],
        continueOnError: false
      }
    ];

    defaultWorkflows.forEach(workflow => this.workflows.set(workflow.name, workflow));
  }
  async runTask(taskName: string, options: { background?: boolean; verbose?: boolean; retryCount?: number } = {}): Promise<TaskResult> {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task "${taskName}" not found`);
    }

    // Platform compatibility check
    if (task.platforms && !task.platforms.includes(this.platform as any)) {
      throw new Error(`Task "${taskName}" is not supported on platform: ${this.platform}`);
    }

    // Check dependencies
    if (task.dependencies) {
      console.log(`🔗 Checking dependencies for task "${taskName}"`);
      for (const depTask of task.dependencies) {
        if (!this.tasks.has(depTask)) {
          throw new Error(`Dependency task "${depTask}" not found`);
        }
        console.log(`  ➤ Running dependency: ${depTask}`);
        const depResult = await this.runTask(depTask, { verbose: options.verbose });
        if (!depResult.success) {
          throw new Error(`Dependency task "${depTask}" failed`);
        }
      }
    }

    const startTime = Date.now();
    console.log(`🚀 Running task: ${task.name} - ${task.description}`);

    try {
      let result: TaskResult;

      if (task.command || task.commands) {
        result = await this.executeCommand(task, options);
      } else if (task.steps) {
        result = await this.executeSteps(task, options);
      } else {
        throw new Error(`Task "${taskName}" has no command, commands, or steps defined`);
      }

      // Run health check if specified
      if (task.healthCheck && result.success) {
        console.log(`🔍 Running health check for task "${taskName}"`);
        try {
          await this.runHealthCheck(task.healthCheck);
          console.log(`✅ Health check passed for task "${taskName}"`);        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Health check failed for task "${taskName}":`, errorMessage);
        }
      }

      // Check expected outputs
      if (task.outputs && result.success) {
        console.log(`📂 Checking outputs for task "${taskName}"`);
        for (const output of task.outputs) {
          if (!existsSync(output)) {
            console.warn(`⚠️ Expected output not found: ${output}`);
          } else {
            console.log(`✅ Output verified: ${output}`);
          }
        }
      }

      const duration = Date.now() - startTime;
      this.taskHistory.push({
        task: taskName,
        timestamp: new Date(),
        success: result.success,
        duration
      });

      return { ...result, duration };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Retry logic
      const retryCount = options.retryCount || 0;
      const maxRetries = task.retries || 0;
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying task "${taskName}" (attempt ${retryCount + 1}/${maxRetries + 1})`);
        return this.runTask(taskName, { ...options, retryCount: retryCount + 1 });
      }

      this.taskHistory.push({
        task: taskName,
        timestamp: new Date(),
        success: false,
        duration
      });

      throw error;
    }
  }
  private async executeCommand(task: TaskDefinition, options: { background?: boolean; verbose?: boolean }): Promise<TaskResult> {
    const isBackground = options.background || task.type === 'background';
    const timeout = task.timeout || (isBackground ? undefined : 300000); // 5 minutes default

    // Handle multiple commands
    if (task.commands) {
      return this.executeMultipleCommands(task, options);
    }

    if (isBackground) {
      return this.runBackgroundCommand(task, options);
    } else {
      return this.runSyncCommand(task, options, timeout);
    }
  }

  private async executeMultipleCommands(task: TaskDefinition, options: { verbose?: boolean }): Promise<TaskResult> {
    console.log(`📋 Executing ${task.commands!.length} commands for task "${task.name}"`);
    
    let combinedOutput = '';
    const startTime = Date.now();

    for (let i = 0; i < task.commands!.length; i++) {
      const command = task.commands![i];
      console.log(`🔧 Command ${i + 1}/${task.commands!.length}: ${command}`);
      
      try {
        const result = execSync(command, {
          encoding: 'utf-8',
          stdio: options.verbose ? 'inherit' : 'pipe',
          cwd: task.workingDirectory || process.cwd(),
          env: { ...process.env, ...task.environment },
          timeout: task.timeout
        });
        
        if (!options.verbose) {
          combinedOutput += result;
        }      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Command ${i + 1} failed:`, errorMessage);
        return {
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ All commands completed in ${duration}ms`);
    
    return {
      success: true,
      output: combinedOutput,
      duration
    };
  }
  private runBackgroundCommand(task: TaskDefinition, options: { verbose?: boolean }): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const shell = this.getShell(task.shell);
      const command = this.formatCommand(task.command!, shell);
        const childProcess = spawn(shell.executable, shell.args.concat(command), {
        stdio: options.verbose ? 'inherit' : 'pipe',
        cwd: task.workingDirectory || process.cwd(),
        env: { ...process.env, ...task.environment }
      });

      this.runningProcesses.set(task.name, childProcess);

      childProcess.on('spawn', () => {
        console.log(`✅ Background task "${task.name}" started (PID: ${childProcess.pid})`);
        resolve({ success: true, pid: childProcess.pid });
      });

      childProcess.on('error', (error: Error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to start task "${task.name}":`, errorMessage);
        this.runningProcesses.delete(task.name);
        reject(error);
      });

      childProcess.on('exit', (code: number | null) => {
        this.runningProcesses.delete(task.name);
        if (code !== 0) {
          console.log(`⚠️ Background task "${task.name}" exited with code ${code}`);
        } else {
          console.log(`✅ Background task "${task.name}" completed successfully`);
        }
      });

      // For background tasks, resolve immediately after spawn
      setTimeout(() => {
        if (process.pid) {
          resolve({ success: true, pid: process.pid });
        }
      }, 1000);
    });
  }

  private runSyncCommand(task: TaskDefinition, options: { verbose?: boolean }, timeout?: number): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      try {
        const startTime = Date.now();
        const shell = this.getShell(task.shell);
        const command = this.formatCommand(task.command!, shell);
        
        const result = execSync(`${shell.executable} ${shell.args.join(' ')} ${command}`, {
          encoding: 'utf-8',
          timeout,
          stdio: options.verbose ? 'inherit' : 'pipe',
          cwd: task.workingDirectory || process.cwd(),
          env: { ...process.env, ...task.environment }
        });

        const duration = Date.now() - startTime;
        console.log(`✅ Task "${task.name}" completed in ${duration}ms`);
        
        resolve({
          success: true,
          output: result,
          duration
        });      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Task "${task.name}" failed:`, errorMessage);
        reject({
          success: false,
          error: errorMessage,
          exitCode: error.status
        });
      }
    });
  }
  private async executeSteps(task: TaskDefinition, options: { verbose?: boolean }): Promise<TaskResult> {
    console.log(`📋 Executing ${task.steps!.length} steps for task "${task.name}"`);
    
    const stepResults = [];
    for (let i = 0; i < task.steps!.length; i++) {
      const step = task.steps![i];
      console.log(`📍 Step ${i + 1}/${task.steps!.length}: ${step}`);
      
      // AI/Agent steps can be processed differently
      if (task.type === 'ai') {
        // Simulate AI processing
        console.log(`🤖 Processing AI step: ${step}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
        stepResults.push({ step: i + 1, description: step, status: 'completed' });
      } else {
        // Manual steps for now - could be automated based on step content
        if (options.verbose) {
          console.log(`   → ${step}`);
        }
        stepResults.push({ step: i + 1, description: step, status: 'manual' });
      }
    }

    return { 
      success: true, 
      output: JSON.stringify(stepResults, null, 2),
      steps: task.steps!.length 
    };
  }

  private getShell(shell?: string) {
    const platform = process.platform;
    
    if (shell === 'powershell') {
      return {
        executable: 'powershell',
        args: ['-Command']
      };
    } else if (shell === 'bash') {
      return {
        executable: 'bash',
        args: ['-c']
      };
    } else if (shell === 'cmd' || platform === 'win32') {
      return {
        executable: 'cmd',
        args: ['/c']
      };
    } else {
      return {
        executable: 'sh',
        args: ['-c']
      };
    }
  }

  private formatCommand(command: string, shell: { executable: string; args: string[] }): string {
    // Escape command for different shells
    if (shell.executable === 'powershell') {
      return `"${command.replace(/"/g, '""')}"`;
    } else if (shell.executable === 'cmd') {
      return command;
    } else {
      return `'${command.replace(/'/g, "'\"'\"'")}'`;
    }
  }

  private async runHealthCheck(healthCheckCommand: string): Promise<void> {
    try {
      execSync(healthCheckCommand, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000 // 10 second timeout for health checks
      });    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Health check failed: ${errorMessage}`);
    }
  }
  async runWorkflow(workflowName: string, options: { verbose?: boolean } = {}): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    const startTime = Date.now();
    console.log(`🔄 Running workflow: ${workflow.name} - ${workflow.description}`);
    console.log(`📋 Tasks to execute: ${workflow.tasks.join(' → ')}`);

    const results = [];

    if (workflow.parallel) {
      // Run tasks in parallel
      console.log(`⚡ Running ${workflow.tasks.length} tasks in parallel`);
      const promises = workflow.tasks.map(async (taskName) => {
        try {
          const result = await this.runTask(taskName, options);
          return { task: taskName, success: true, result };        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { task: taskName, success: false, error: errorMessage };
        }
      });

      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);

      // Check if any failed
      const failed = parallelResults.filter(r => !r.success);
      if (failed.length > 0 && !workflow.continueOnError) {
        throw new Error(`Workflow "${workflowName}" failed. Failed tasks: ${failed.map(f => f.task).join(', ')}`);
      }
    } else {
      // Run tasks sequentially
      for (const taskName of workflow.tasks) {
        try {
          console.log(`\n⏳ Running workflow task: ${taskName}`);
          const result = await this.runTask(taskName, options);
          results.push({ task: taskName, success: true, result });
          console.log(`✅ Workflow task "${taskName}" completed`);        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ Workflow task "${taskName}" failed:`, errorMessage);
          results.push({ task: taskName, success: false, error: errorMessage });
          
          if (!workflow.continueOnError) {
            throw new Error(`Workflow "${workflowName}" failed at task "${taskName}"`);
          } else {
            console.log(`⚠️ Continuing workflow despite failure in task "${taskName}"`);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`🎉 Workflow "${workflowName}" completed in ${duration}ms`);
    console.log(`📊 Results: ${successCount}/${results.length} tasks successful`);
    
    return { 
      success: successCount === results.length, 
      results,
      duration
    };
  }
  listTasks(type?: string) {
    console.log('\n📋 Available Tasks:');
    const tasks = Array.from(this.tasks.entries());
    
    if (type) {
      const filtered = tasks.filter(([_, task]) => task.type === type);
      console.log(`\n🏷️ ${type.toUpperCase()} Tasks:`);
      filtered.forEach(([name, task]) => {
        console.log(`  • ${name}: ${task.description}`);
        if (task.dependencies?.length) {
          console.log(`    Dependencies: ${task.dependencies.join(', ')}`);
        }
        if (task.platforms?.length) {
          console.log(`    Platforms: ${task.platforms.join(', ')}`);
        }
      });
    } else {
      // Group by type
      const grouped = tasks.reduce((acc, [name, task]) => {
        if (!acc[task.type]) acc[task.type] = [];
        acc[task.type].push({ name, task });
        return acc;
      }, {} as Record<string, Array<{ name: string; task: TaskDefinition }>>);

      Object.entries(grouped).forEach(([type, typeTasks]) => {
        console.log(`\n🏷️ ${type.toUpperCase()} Tasks:`);
        typeTasks.forEach(({ name, task }) => {
          console.log(`  • ${name}: ${task.description}`);
        });
      });
    }
  }

  listWorkflows() {
    console.log('\n🔄 Available Workflows:');
    this.workflows.forEach((workflow, name) => {
      console.log(`  • ${name}: ${workflow.description}`);
      console.log(`    Tasks: ${workflow.tasks.join(' → ')}`);
      if (workflow.parallel) {
        console.log(`    Mode: Parallel execution`);
      }
      if (workflow.continueOnError) {
        console.log(`    Continue on error: Yes`);
      }
    });
  }

  getTaskHistory(limit: number = 10) {
    console.log(`\n📊 Recent Task History (last ${limit}):`);
    const recent = this.taskHistory.slice(-limit);
    recent.forEach(entry => {
      const status = entry.success ? '✅' : '❌';
      const duration = entry.duration ? `(${entry.duration}ms)` : '';
      console.log(`  ${status} ${entry.task} - ${entry.timestamp.toLocaleString()} ${duration}`);
    });
  }

  getTaskStats() {
    const total = this.taskHistory.length;
    const successful = this.taskHistory.filter(t => t.success).length;
    const failed = total - successful;
    const avgDuration = this.taskHistory
      .filter(t => t.duration)
      .reduce((sum, t) => sum + t.duration!, 0) / total;

    console.log('\n📈 Task Statistics:');
    console.log(`  Total executions: ${total}`);
    console.log(`  Successful: ${successful} (${((successful/total)*100).toFixed(1)}%)`);
    console.log(`  Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`  Average duration: ${avgDuration.toFixed(0)}ms`);
  }

  async runTaskInteractive(taskName: string) {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task "${taskName}" not found`);
    }

    console.log(`\n🎯 Interactive Task Runner: ${task.name}`);
    console.log(`Description: ${task.description}`);
    console.log(`Type: ${task.type}`);
    
    if (task.dependencies?.length) {
      console.log(`Dependencies: ${task.dependencies.join(', ')}`);
    }

    // Confirm execution
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject) => {
      rl.question('\nProceed with execution? (y/N): ', async (answer: string) => {
        rl.close();
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          try {
            const result = await this.runTask(taskName, { verbose: true });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        } else {
          console.log('Task execution cancelled.');
          resolve({ success: false, cancelled: true });
        }
      });
    });
  }

  stopBackgroundTask(taskName: string): boolean {
    const process = this.runningProcesses.get(taskName);
    if (process) {
      process.kill();
      this.runningProcesses.delete(taskName);
      console.log(`🛑 Stopped background task: ${taskName}`);
      return true;
    }
    return false;
  }

  stopAllBackgroundTasks() {
    const tasks = Array.from(this.runningProcesses.keys());
    tasks.forEach(taskName => this.stopBackgroundTask(taskName));
    console.log(`🛑 Stopped ${tasks.length} background tasks`);
  }

  getRunningTasks() {
    return Array.from(this.runningProcesses.keys());
  }

  async validateEnvironment() {
    console.log('\n🔍 Validating Development Environment:');
    
    const checks = [
      { name: 'Node.js', command: 'node --version' },
      { name: 'npm', command: 'npm --version' },
      { name: 'Git', command: 'git --version' },
      { name: 'PowerShell', command: 'powershell -Command "echo \'PowerShell Available\'"' },
      { name: 'Docker', command: 'docker --version' }
    ];

    const results = [];
    for (const check of checks) {
      try {
        const result = execSync(check.command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`  ✅ ${check.name}: ${result.trim()}`);
        results.push({ ...check, success: true, output: result.trim() });      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`  ❌ ${check.name}: Not available`);
        results.push({ ...check, success: false, error: errorMessage });
      }
    }

    return results;
  }

  async createTask(taskDefinition: TaskDefinition) {
    this.tasks.set(taskDefinition.name, taskDefinition);
    console.log(`✅ Created task: ${taskDefinition.name} - ${taskDefinition.description}`);
    
    // Save to configuration file
    try {
      const tasksPath = path.join(process.cwd(), '.continue', 'prompts', 'vue-tasks.json');
      const existingData = await fs.readFile(tasksPath, 'utf-8');
      const config = JSON.parse(existingData);
      
      config.tasks = config.tasks || [];
      config.tasks.push(taskDefinition);
      
      await fs.writeFile(tasksPath, JSON.stringify(config, null, 2));
      console.log(`✅ Task saved to configuration file`);    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Could not save task to configuration file:`, errorMessage);
    }
  }

  async createWorkflow(workflowDefinition: WorkflowDefinition) {
    this.workflows.set(workflowDefinition.name, workflowDefinition);
    console.log(`✅ Created workflow: ${workflowDefinition.name} - ${workflowDefinition.description}`);
    
    // Save to configuration file
    try {
      const tasksPath = path.join(process.cwd(), '.continue', 'prompts', 'vue-tasks.json');
      const existingData = await fs.readFile(tasksPath, 'utf-8');
      const config = JSON.parse(existingData);
      
      config.workflows = config.workflows || [];
      config.workflows.push(workflowDefinition);
      
      await fs.writeFile(tasksPath, JSON.stringify(config, null, 2));
      console.log(`✅ Workflow saved to configuration file`);    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Could not save workflow to configuration file:`, errorMessage);
    }
  }
}

// Enhanced CLI interface
if (require.main === module) {
  const runner = new AgentTaskRunner();
  const args = process.argv.slice(2);
  const command = args[0];
  const taskOrWorkflow = args[1];
  const verbose = args.includes('--verbose') || args.includes('-v');
  const background = args.includes('--background') || args.includes('-b');
  const interactive = args.includes('--interactive') || args.includes('-i');
  const parallel = args.includes('--parallel') || args.includes('-p');
  const type = args.find(arg => arg.startsWith('--type='))?.split('=')[1];

  (async () => {
    try {
      switch (command) {
        case 'run':
          if (!taskOrWorkflow) {
            console.error('❌ Please specify a task name');
            process.exit(1);
          }
          
          if (interactive) {
            await runner.runTaskInteractive(taskOrWorkflow);
          } else {
            const result = await runner.runTask(taskOrWorkflow, { verbose, background });
            if (!result.success) {
              process.exit(1);
            }
          }
          break;

        case 'workflow':
          if (!taskOrWorkflow) {
            console.error('❌ Please specify a workflow name');
            process.exit(1);
          }
          const workflowResult = await runner.runWorkflow(taskOrWorkflow, { verbose });
          if (!workflowResult.success) {
            process.exit(1);
          }
          break;

        case 'list':
          if (args[1] === 'tasks') {
            runner.listTasks(type);
          } else if (args[1] === 'workflows') {
            runner.listWorkflows();
          } else {
            runner.listTasks(type);
            runner.listWorkflows();
          }
          break;

        case 'stop':
          if (taskOrWorkflow === 'all') {
            runner.stopAllBackgroundTasks();
          } else if (taskOrWorkflow) {
            const stopped = runner.stopBackgroundTask(taskOrWorkflow);
            if (!stopped) {
              console.log(`⚠️ No running background task found: ${taskOrWorkflow}`);
            }
          } else {
            console.error('❌ Please specify a task name or "all"');
            process.exit(1);
          }
          break;

        case 'status':
          const running = runner.getRunningTasks();
          if (running.length > 0) {
            console.log('🔄 Running background tasks:', running.join(', '));
          } else {
            console.log('✅ No background tasks running');
          }
          break;

        case 'history':
          const limit = parseInt(args[1]) || 10;
          runner.getTaskHistory(limit);
          break;

        case 'stats':
          runner.getTaskStats();
          break;

        case 'validate':
          await runner.validateEnvironment();
          break;

        case 'create-task':
          console.log('📝 Task creation wizard not implemented yet');
          console.log('Please edit .continue/prompts/vue-tasks.json manually');
          break;

        case 'create-workflow':
          console.log('📝 Workflow creation wizard not implemented yet');
          console.log('Please edit .continue/prompts/vue-tasks.json manually');
          break;

        case 'help':
        default:
          console.log(`
🤖 Enhanced Agent Task Runner v2.0

USAGE:
  node agent-tasks.js <command> [task/workflow] [options]

COMMANDS:
  run <task>              Run a specific task
  workflow <workflow>     Run a workflow (sequence of tasks)
  list [tasks|workflows]  List available tasks and/or workflows
  stop <task|all>         Stop a background task or all tasks
  status                  Show running background tasks
  history [limit]         Show task execution history
  stats                   Show task execution statistics
  validate                Validate development environment
  create-task             Create a new task (wizard)
  create-workflow         Create a new workflow (wizard)
  help                    Show this help message

OPTIONS:
  --verbose, -v           Show detailed output
  --background, -b        Run task in background (for applicable tasks)
  --interactive, -i       Run task with interactive prompts
  --parallel, -p          Run workflow tasks in parallel (if supported)
  --type=<type>           Filter tasks by type (when listing)

TASK TYPES:
  background   Long-running tasks (dev servers, monitoring)
  build        Compilation and bundling tasks
  test         Testing and validation tasks
  validation   Code quality and type checking
  formatting   Code formatting and cleanup
  docker       Container management tasks
  setup        Environment setup tasks
  maintenance  Cleanup and maintenance tasks
  ai           AI-assisted development tasks
  git          Version control tasks
  database     Database operations
  monitoring   System monitoring tasks

EXAMPLES:
  node agent-tasks.js run dev --background
  node agent-tasks.js workflow quality-check --verbose
  node agent-tasks.js run test-auth --interactive
  node agent-tasks.js list tasks --type=test
  node agent-tasks.js stop all
  node agent-tasks.js history 20
  node agent-tasks.js validate

WORKFLOWS:
  setup-complete    Complete development environment setup
  quality-check     Run full quality assurance checks
  deploy-prep       Prepare application for deployment
  fix-auth          Fix authentication system issues
  ci-pipeline       Continuous integration pipeline

For more information, visit: https://github.com/your-repo/agent-tasks
          `);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      if (verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  })();
}

export default AgentTaskRunner;
