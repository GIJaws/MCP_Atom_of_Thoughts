import { ChildProcess, fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { isPortAvailable, canConnectToPort, waitForServerOnPort } from './port-checker.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProcessInfo {
  process: ChildProcess;
  name: string;
}

// Define the type for our argv object
interface ArgvOptions {
  visualize: boolean;
  port: number;
  [key: string]: unknown;
}

// Parse command line arguments - these will be passed to both processes
const argv = yargs(hideBin(process.argv))
  .option('visualize', {
    alias: 'v',
    description: 'Start the visualization server',
    type: 'boolean',
    default: false
  })
  .option('port', {
    alias: 'p',
    description: 'Port for the visualization server',
    type: 'number',
    default: 3000
  })
  .help()
  .alias('help', 'h')
  .parse() as ArgvOptions;

// Array to hold all child processes for cleanup
const processes: ProcessInfo[] = [];

// Function to handle cleanup on exit
function cleanup() {
  console.error(chalk.yellow('Shutting down all processes...'));

  processes.forEach(p => {
    try {
      if (!p.process.killed) {
        p.process.kill();
        console.error(chalk.yellow(`Terminated ${p.name} process`));
      }
    } catch (err) {
      console.error(chalk.red(`Failed to kill ${p.name} process:`, err));
    }
  });

  process.exit(0);
}

// Register cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Launch the main MCP server
function launchMcpServer() {
  const serverPath = path.resolve(__dirname, './index.js');
  const mcpProcess = fork(serverPath, [], {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Pass --no-visualize to ensure the MCP server doesn't try to start visualization itself
      MCP_VISUALIZE: 'false'
    }
  });

  processes.push({ process: mcpProcess, name: 'MCP server' });

  mcpProcess.on('error', (err) => {
    console.error(chalk.red('Failed to start MCP server:', err));
    cleanup();
  });

  mcpProcess.on('exit', (code, signal) => {
    console.error(chalk.yellow(`MCP server exited with code ${code} and signal ${signal}`));
    // If MCP server exits, shut down everything
    cleanup();
  });

  return mcpProcess;
}

// Launch the visualization server if requested
async function launchVisualizationServer(): Promise<ChildProcess | null> {
  try {
    // Check if visualization server is already running
    const visPortAvailable = await isPortAvailable(argv.port);

    if (!visPortAvailable) {
      console.error(chalk.yellow(`Visualization server port ${argv.port} is already in use`));
      console.error(chalk.yellow('Will reuse the existing visualization server'));
      return null;
    }

    const visualizerPath = path.resolve(__dirname, './visualize.js');
    const visualizerProcess = fork(visualizerPath, [`--port=${argv.port}`], {
      stdio: 'inherit'
    });

    processes.push({ process: visualizerProcess, name: 'Visualization server' });

    visualizerProcess.on('error', (err) => {
      console.error(chalk.red('Failed to start visualization server:', err));
      // Don't shut down everything if visualization fails
    });

    visualizerProcess.on('exit', (code, signal) => {
      console.error(chalk.yellow(`Visualization server exited with code ${code} and signal ${signal}`));
      // Don't shut down everything if visualization exits
    });

    // Wait a moment for the visualization server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    return visualizerProcess;
  } catch (error) {
    console.error(chalk.red('Error launching visualization server:'), error);
    return null;
  }
}

// Main function
async function main() {
  console.error(chalk.green('🚀 Launching Atom of Thoughts'));

  // Always start the MCP server
  const mcpProcess = await launchMcpServer();

  if (!mcpProcess) {
    console.error(chalk.yellow('Using existing MCP server instance'));
  }

  // Start visualization server if requested
  if (argv.visualize) {
    console.error(chalk.green('🧠 Starting visualization server'));
    const visualizerProcess = await launchVisualizationServer();

    if (!visualizerProcess) {
      console.error(chalk.yellow('Using existing visualization server instance'));
    } else {
      console.error(chalk.green(`✨ Visualization available at http://localhost:${argv.port}`));
    }
  }

  console.error(chalk.green('✅ All processes started'));
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red("Fatal error:", error));
  cleanup();
});
