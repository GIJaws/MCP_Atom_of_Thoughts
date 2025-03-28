// src/visualize.ts
import { VisualizationServer } from './visualization-server.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { isPortAvailable } from './port-checker.js';

const argv = yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'number',
        default: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
    })
    .parseSync();

async function main() {
    try {
        // Check if port is already in use
        const portAvailable = await isPortAvailable(argv.port);
        if (!portAvailable) {
            console.error(chalk.yellow(`Port ${argv.port} is already in use.`));
            console.error(chalk.yellow('Another visualization server is likely running.'));
            console.error(chalk.yellow('This process will exit to avoid conflicts.'));
            process.exit(0); // Exit gracefully
        }

        const server = new VisualizationServer(argv.port);
        const started = await server.start();
        
        if (!started) {
            console.error(chalk.red('Failed to start visualization server'));
            process.exit(1);
        }
        
        // Add cleanup handlers
        const cleanup = async () => {
            console.error(chalk.yellow('Shutting down visualization server...'));
            await server.stop();
            process.exit(0);
        };
        
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
    } catch (err) {
        console.error(chalk.red(`Visualization server failed: ${(err as Error).message}`));
        process.exit(1);
    }
}

main().catch(err => {
    console.error(chalk.red(`Fatal error: ${err.message}`));
    process.exit(1);
});
