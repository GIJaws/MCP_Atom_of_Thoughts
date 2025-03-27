// src/visualize.ts
import { VisualizationServer } from './visualization-server.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

const argv = yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'number',
        default: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
    })
    .parseSync();

try {
    const server = new VisualizationServer(argv.port);
    server.start();
    console.error(chalk.green(`Visualization server running on http://localhost:${argv.port}`));
} catch (err) {
    console.error(chalk.red(`Visualization server failed: ${(err as Error).message}`));
}
