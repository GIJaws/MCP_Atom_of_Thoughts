import { WebSocketServer as WSServer } from 'ws';
import chalk from 'chalk';
import { isPortAvailable } from './port-checker.js';

// Define WebSocket server for communication with visualization
export class WebSocketServer {
  private wss: WSServer;
  private clients: Set<any> = new Set();
  private port: number;

  constructor(port: number = 8090) {
    this.port = port;
    // We'll initialize the WebSocket server in the init method
    this.wss = null as unknown as WSServer;
    
    this.wss.on('connection', (ws) => {
      console.error(chalk.green('Visualization client connected to WebSocket'));
      this.clients.add(ws);
      
      ws.on('close', () => {
        console.error(chalk.yellow('Visualization client disconnected'));
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error(chalk.red('WebSocket error:'), error);
        this.clients.delete(ws);
      });
    });
    
    this.wss.on('listening', () => {
      console.error(chalk.green(`WebSocket server running on port ${this.port}`));
    });
    
    this.wss.on('error', (error) => {
      console.error(chalk.red('WebSocket server error:'), error);
    });
  }

  /**
   * Initialize the WebSocket server, checking if port is available first
   * @returns Promise that resolves to true if server started successfully, false if port in use
   */
  public async init(): Promise<boolean> {
    try {
      // Check if port is available
      const portAvailable = await isPortAvailable(this.port);
      if (!portAvailable) {
        console.error(chalk.yellow(`WebSocket server port ${this.port} is already in use.`));
        console.error(chalk.yellow('This likely means another MCP server is already running.'));
        console.error(chalk.yellow('Will attempt to reuse the existing WebSocket server.'));
        return false;
      }
      
      // Port is available, create WebSocket server
      this.wss = new WSServer({ port: this.port });
      
      this.wss.on('connection', (ws) => {
        console.error(chalk.green('Visualization client connected to WebSocket'));
        this.clients.add(ws);
        
        ws.on('close', () => {
          console.error(chalk.yellow('Visualization client disconnected'));
          this.clients.delete(ws);
        });
        
        ws.on('error', (error) => {
          console.error(chalk.red('WebSocket error:'), error);
          this.clients.delete(ws);
        });
      });
      
      this.wss.on('listening', () => {
        console.error(chalk.green(`WebSocket server running on port ${this.port}`));
      });
      
      this.wss.on('error', (error) => {
        console.error(chalk.red('WebSocket server error:'), error);
      });
      
      return true;
    } catch (error) {
      console.error(chalk.red('Failed to initialize WebSocket server:'), error);
      return false;
    }
  }

  // Send a message to all connected clients
  public sendMessage(type: string, data: any): void {
    if (this.clients.size === 0) {
      return; // No connected clients
    }
    
    const message = JSON.stringify({
      type,
      data
    });
    
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  // Close the WebSocket server
  public close(): void {
    if (this.wss) {
      this.wss.close();
    }
  }
}
