import net from 'net';
import chalk from 'chalk';

/**
 * Checks if a port is in use
 * @param port The port to check
 * @returns Promise that resolves to true if the port is available, false if in use
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Port is in use
      } else {
        // Some other error occurred, assume port is available
        resolve(true);
      }
    });
    
    server.once('listening', () => {
      // Close the server immediately and resolve with true (port is available)
      server.close(() => {
        resolve(true);
      });
    });
    
    // Try to listen on the port
    server.listen(port);
  });
}

/**
 * Checks if we can connect to a port that's in use (implies a server is running there)
 * @param port The port to try to connect to
 * @returns Promise that resolves to true if connection successful, false otherwise
 */
export async function canConnectToPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    
    client.once('connect', () => {
      client.destroy();
      resolve(true); // Successfully connected, server is running
    });
    
    client.once('error', () => {
      client.destroy();
      resolve(false); // Failed to connect
    });
    
    client.connect(port, '127.0.0.1');
    
    // Add timeout to avoid hanging
    setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 1000);
  });
}

/**
 * Waits until a server is running on the specified port
 * @param port The port to check
 * @param maxAttempts Maximum number of attempts to check
 * @param intervalMs Time between attempts in milliseconds
 * @returns Promise that resolves when server is detected or rejects after max attempts
 */
export async function waitForServerOnPort(port: number, maxAttempts: number = 10, intervalMs: number = 500): Promise<boolean> {
  console.error(chalk.yellow(`Waiting for server on port ${port}...`));
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const canConnect = await canConnectToPort(port);
    if (canConnect) {
      console.error(chalk.green(`Server detected on port ${port}`));
      return true;
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  console.error(chalk.red(`Timed out waiting for server on port ${port}`));
  return false;
}
