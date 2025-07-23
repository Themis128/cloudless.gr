const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class DashboardServer {
    constructor(port = 3001) {
        this.port = port;
        this.wss = null;
        this.server = null;
        this.clients = new Set();
        this.testProcess = null;
        this.isRunning = false;
    }

    start() {
        console.log('🚀 Starting Visual Test Dashboard Server...');
        
        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                // Serve the dashboard HTML
                const dashboardPath = path.join(__dirname, 'visual-dashboard.html');
                fs.readFile(dashboardPath, (err, data) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading dashboard');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data);
                });
            } else if (req.url === '/api/status') {
                // API endpoint for status
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    isRunning: this.isRunning,
                    clients: this.clients.size,
                    timestamp: new Date().toISOString()
                }));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        this.wss = new WebSocket.Server({ server: this.server });

        this.wss.on('connection', (ws) => {
            console.log('🔗 New client connected');
            this.clients.add(ws);

            // Send initial status
            ws.send(JSON.stringify({
                type: 'status',
                data: {
                    isRunning: this.isRunning,
                    timestamp: new Date().toISOString()
                }
            }));

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔌 Client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });

        this.server.listen(this.port, '192.168.0.23', () => {
            console.log(`✅ Dashboard server running on http://192.168.0.23:${this.port}`);
            console.log(`📊 Open your browser to http://192.168.0.23:${this.port} to view the dashboard`);
            console.log(`🌐 Network accessible from other devices on 192.168.0.0/24`);
        });
    }

    handleMessage(ws, data) {
        switch (data.action) {
            case 'start_tests':
                this.startTests(data.options);
                break;
            case 'stop_tests':
                this.stopTests();
                break;
            case 'pause_tests':
                this.pauseTests();
                break;
            case 'get_status':
                this.sendStatus(ws);
                break;
            default:
                console.log('Unknown message type:', data.action);
        }
    }

    startTests(options = {}) {
        if (this.isRunning) {
            this.broadcast({
                type: 'error',
                message: 'Tests already running'
            });
            return;
        }

        this.isRunning = true;
        this.broadcast({
            type: 'test_suite_start',
            timestamp: new Date().toISOString()
        });

        console.log('🧪 Starting Playwright tests...');

        // Build the test command
        let command = 'npx';
        let args = ['playwright', 'test', 'tests/visual-test-runner.spec.js'];

        if (options.headed) {
            args.push('--headed');
        }

        if (options.slow) {
            args.push('--timeout=60000');
        }

        if (options.debug) {
            args.push('--headed', '--timeout=0', '--debug');
        }

        args.push('--reporter=json');

        // Start the test process
        this.testProcess = spawn(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let output = '';

        this.testProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            
            // Parse Playwright JSON output
            this.parsePlaywrightOutput(chunk);
            
            // Broadcast raw output
            this.broadcast({
                type: 'log',
                level: 'info',
                message: chunk.trim()
            });
        });

        this.testProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            this.broadcast({
                type: 'log',
                level: 'error',
                message: chunk.trim()
            });
        });

        this.testProcess.on('close', (code) => {
            console.log(`🧪 Test process exited with code ${code}`);
            this.isRunning = false;
            
            this.broadcast({
                type: 'test_suite_complete',
                code: code,
                timestamp: new Date().toISOString()
            });

            // Parse final results
            this.parseFinalResults(output);
        });

        this.testProcess.on('error', (error) => {
            console.error('Test process error:', error);
            this.broadcast({
                type: 'error',
                message: `Test process error: ${error.message}`
            });
            this.isRunning = false;
        });
    }

    parsePlaywrightOutput(output) {
        try {
            // Look for JSON lines in the output
            const lines = output.split('\n');
            
            for (const line of lines) {
                if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
                    try {
                        const data = JSON.parse(line);
                        this.handlePlaywrightEvent(data);
                    } catch (e) {
                        // Not valid JSON, skip
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing Playwright output:', error);
        }
    }

    handlePlaywrightEvent(event) {
        switch (event.type) {
            case 'test_start':
                this.broadcast({
                    type: 'test_start',
                    testName: event.testName || event.title,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'test_end':
                this.broadcast({
                    type: 'test_complete',
                    testName: event.testName || event.title,
                    success: event.status === 'passed',
                    error: event.error || null,
                    duration: event.duration,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'step_start':
                this.broadcast({
                    type: 'test_progress',
                    testName: event.testName || 'Unknown',
                    progress: event.progress || 0,
                    step: event.step,
                    timestamp: new Date().toISOString()
                });
                break;

            case 'screenshot':
                this.broadcast({
                    type: 'screenshot',
                    path: event.path,
                    caption: event.caption || 'Screenshot',
                    timestamp: new Date().toISOString()
                });
                break;
        }
    }

    parseFinalResults(output) {
        try {
            // Extract test results from the output
            const results = {
                total: 0,
                passed: 0,
                failed: 0,
                duration: 0
            };

            // Look for result patterns in the output
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('passed') && line.includes('failed')) {
                    const match = line.match(/(\d+) passed.*?(\d+) failed/);
                    if (match) {
                        results.passed = parseInt(match[1]);
                        results.failed = parseInt(match[2]);
                        results.total = results.passed + results.failed;
                    }
                }
            }

            this.broadcast({
                type: 'final_results',
                results: results,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error parsing final results:', error);
        }
    }

    stopTests() {
        if (this.testProcess) {
            console.log('⏹️ Stopping tests...');
            this.testProcess.kill('SIGTERM');
            this.isRunning = false;
            
            this.broadcast({
                type: 'test_suite_stopped',
                timestamp: new Date().toISOString()
            });
        }
    }

    pauseTests() {
        if (this.testProcess) {
            console.log('⏸️ Pausing tests...');
            this.testProcess.kill('SIGSTOP');
            
            this.broadcast({
                type: 'test_suite_paused',
                timestamp: new Date().toISOString()
            });
        }
    }

    sendStatus(ws) {
        ws.send(JSON.stringify({
            type: 'status',
            data: {
                isRunning: this.isRunning,
                clients: this.clients.size,
                timestamp: new Date().toISOString()
            }
        }));
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    stop() {
        console.log('🛑 Stopping dashboard server...');
        
        if (this.testProcess) {
            this.testProcess.kill('SIGTERM');
        }
        
        if (this.wss) {
            this.wss.close();
        }
        
        if (this.server) {
            this.server.close();
        }
    }
}

// Create and start the server
const dashboard = new DashboardServer(3001);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    dashboard.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    dashboard.stop();
    process.exit(0);
});

// Start the server
dashboard.start();

module.exports = DashboardServer; 