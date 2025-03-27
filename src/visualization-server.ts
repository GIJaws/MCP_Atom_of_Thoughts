import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Atom {
    atomId: string;
    content: string;
    atomType: 'premise' | 'reasoning' | 'hypothesis' | 'verification' | 'conclusion';
    dependencies: string[];
    confidence: number;
    isVerified: boolean;
    depth?: number;
    created: number;
}

export class VisualizationServer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;
    private port: number;
    private atoms: Record<string, Atom> = {};
    private atomOrder: string[] = [];

    constructor(port: number = 3000) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server);

        // Set up express routes
        this.setupRoutes();

        // Set up socket.io
        this.setupSocketIO();
    }

    private setupRoutes() {
        // Serve static files from the 'public' directory
        this.app.use(express.static(path.join(__dirname, '../public')));

        // Create the visualization HTML page dynamically
        this.app.get('/', (req, res) => {
            res.send(this.generateHTML());
        });

        // API endpoint to get all atoms
        this.app.get('/api/atoms', (req, res) => {
            const atomsArray = Object.values(this.atoms);
            res.json({
                atoms: atomsArray,
                atomOrder: this.atomOrder
            });
        });
    }

    private setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.error(chalk.green('Visualization client connected'));

            // Send current atoms to the newly connected client
            socket.emit('atoms-update', {
                atoms: Object.values(this.atoms),
                atomOrder: this.atomOrder
            });
        });
    }

    // Update atoms data
    public updateAtom(atom: Atom) {
        this.atoms[atom.atomId] = atom;

        // Add to order if it's new
        if (!this.atomOrder.includes(atom.atomId)) {
            this.atomOrder.push(atom.atomId);
        }

        // Emit update to all connected clients
        this.io.emit('atom-update', atom);
        this.io.emit('atoms-order', this.atomOrder);
    }

    // Start the server
    public start() {
        this.server.listen(this.port, () => {
            console.error(chalk.green(`Visualization server running at http://localhost:${this.port}`));
        });
    }

    // Generate HTML for the visualization page
    private generateHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Atom of Thoughts Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100vh;
            background-color: #f5f5f5;
        }
        #header {
            background-color: #333;
            color: white;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #graph {
            flex-grow: 1;
            width: 100%;
            background-color: white;
        }
        .node {
            cursor: pointer;
        }
        .link {
            stroke: #999;
            stroke-opacity: 0.6;
            stroke-width: 2;
        }
        .node text {
            font-size: 12px;
            pointer-events: none;
        }
        .node-details {
            position: absolute;
            right: 20px;
            top: 70px;
            width: 300px;
            background-color: white;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: none;
            max-height: 80vh;
            overflow-y: auto;
        }
        .confidence-bar {
            height: 10px;
            background-color: #eee;
            margin-top: 5px;
            border-radius: 5px;
            overflow: hidden;
        }
        .confidence-fill {
            height: 100%;
            background-color: #4CAF50;
        }
        .atom-type {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            color: white;
            font-size: 12px;
            margin-bottom: 5px;
        }
        .atom-premise { background-color: #2196F3; }
        .atom-reasoning { background-color: #4CAF50; }
        .atom-hypothesis { background-color: #FFC107; }
        .atom-verification { background-color: #9C27B0; }
        .atom-conclusion { background-color: #F44336; }
        .verified-badge {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div id="header">
        <h1>Atom of Thoughts Visualization</h1>
        <div>
            <span id="atoms-count">0 atoms</span>
        </div>
    </div>
    <div id="graph"></div>
    <div class="node-details" id="node-details">
        <h3 id="detail-id"></h3>
        <span id="detail-type" class="atom-type"></span>
        <span id="detail-verified" class="verified-badge">Verified</span>
        <div>
            <strong>Confidence:</strong>
            <div class="confidence-bar">
                <div class="confidence-fill" id="detail-confidence-fill"></div>
            </div>
            <span id="detail-confidence-value"></span>
        </div>
        <div>
            <strong>Depth:</strong> <span id="detail-depth"></span>
        </div>
        <div>
            <strong>Dependencies:</strong> <span id="detail-dependencies"></span>
        </div>
        <p id="detail-content"></p>
    </div>
    
    <script>
        // Global variables
        let atoms = {};
        let atomOrder = [];
        let nodes = [];
        let links = [];
        let simulation;
        let svg;
        let width = window.innerWidth;
        let height = window.innerHeight - 60; // Subtract header height
        
        // Connect to Socket.IO server
        const socket = io();
        
        // Initialize D3 visualization
        function initVisualization() {
            svg = d3.select("#graph")
                .append("svg")
                .attr("width", width)
                .attr("height", height);
            
            // Create arrow marker for directed links
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 20)
                .attr("refY", 0)
                .attr("orient", "auto")
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .append("path")
                .attr("d", "M0,-5L10,0L0,5")
                .attr("fill", "#999");
            
            // Initialize the force simulation
            simulation = d3.forceSimulation()
                .force("link", d3.forceLink().id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .on("tick", ticked);
            
            // Fetch initial data
            fetchAtoms();
        }
        
        // Fetch atoms data from the server
        function fetchAtoms() {
            fetch('/api/atoms')
                .then(response => response.json())
                .then(data => {
                    atoms = data.atoms.reduce((obj, atom) => {
                        obj[atom.atomId] = atom;
                        return obj;
                    }, {});
                    atomOrder = data.atomOrder;
                    updateVisualization();
                })
                .catch(error => console.error('Error fetching atoms:', error));
        }
        
        // Update the visualization with new data
        function updateVisualization() {
            // Update atoms count display
            document.getElementById('atoms-count').textContent = Object.keys(atoms).length + ' atoms';
            
            // Create nodes and links arrays for D3
            nodes = Object.values(atoms).map(atom => ({
                id: atom.atomId,
                type: atom.atomType,
                confidence: atom.confidence,
                isVerified: atom.isVerified,
                depth: atom.depth || 0
            }));
            
            links = [];
            Object.values(atoms).forEach(atom => {
                atom.dependencies.forEach(depId => {
                    if (atoms[depId]) {
                        links.push({
                            source: depId,
                            target: atom.atomId
                        });
                    }
                });
            });
            
            // Update the visualization
            updateGraph();
        }
        
        // Update the D3 graph with new nodes and links
        function updateGraph() {
            // Remove existing elements
            svg.selectAll(".link").remove();
            svg.selectAll(".node").remove();
            
            // Create links
            const link = svg.selectAll(".link")
                .data(links)
                .enter()
                .append("line")
                .attr("class", "link")
                .attr("marker-end", "url(#arrowhead)");
            
            // Create nodes
            const node = svg.selectAll(".node")
                .data(nodes)
                .enter()
                .append("g")
                .attr("class", "node")
                .call(d3.drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended))
                .on("click", showNodeDetails);
            
            // Add circles to nodes
            node.append("circle")
                .attr("r", 15)
                .style("fill", d => getColorForType(d.type))
                .style("stroke", d => d.isVerified ? "#4CAF50" : "#999")
                .style("stroke-width", d => d.isVerified ? 3 : 1);
            
            // Add text labels to nodes
            node.append("text")
                .attr("dy", 25)
                .attr("text-anchor", "middle")
                .text(d => d.id);
            
            // Update the simulation
            simulation.nodes(nodes);
            simulation.force("link").links(links);
            simulation.alpha(1).restart();
        }
        
        // Update on tick
        function ticked() {
            svg.selectAll(".link")
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            svg.selectAll(".node")
                .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
        }
        
        // Helper functions for D3 drag behavior
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        // Show details for a node
        function showNodeDetails(event, d) {
            const atom = atoms[d.id];
            if (!atom) return;
            
            const details = document.getElementById('node-details');
            document.getElementById('detail-id').textContent = atom.atomId;
            
            const typeEl = document.getElementById('detail-type');
            typeEl.textContent = atom.atomType.toUpperCase();
            typeEl.className = 'atom-type atom-' + atom.atomType;
            
            const verifiedBadge = document.getElementById('detail-verified');
            verifiedBadge.style.display = atom.isVerified ? 'inline-block' : 'none';
            
            document.getElementById('detail-confidence-fill').style.width = (atom.confidence * 100) + '%';
            document.getElementById('detail-confidence-value').textContent = (atom.confidence * 100).toFixed(0) + '%';
            document.getElementById('detail-depth').textContent = atom.depth !== undefined ? atom.depth : 'N/A';
            document.getElementById('detail-dependencies').textContent = atom.dependencies.length ? atom.dependencies.join(', ') : 'None';
            document.getElementById('detail-content').textContent = atom.content;
            
            details.style.display = 'block';
        }
        
        // Get color for atom type
        function getColorForType(type) {
            switch (type) {
                case 'premise': return '#2196F3';
                case 'reasoning': return '#4CAF50';
                case 'hypothesis': return '#FFC107';
                case 'verification': return '#9C27B0';
                case 'conclusion': return '#F44336';
                default: return '#999';
            }
        }
        
        // Handle socket.io events
        socket.on('atoms-update', data => {
            data.atoms.forEach(atom => {
                atoms[atom.atomId] = atom;
            });
            atomOrder = data.atomOrder;
            updateVisualization();
        });
        
        socket.on('atom-update', atom => {
            atoms[atom.atomId] = atom;
            updateVisualization();
        });
        
        socket.on('atoms-order', newOrder => {
            atomOrder = newOrder;
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            width = window.innerWidth;
            height = window.innerHeight - 60;
            
            d3.select("#graph svg")
                .attr("width", width)
                .attr("height", height);
            
            simulation.force("center", d3.forceCenter(width / 2, height / 2));
            simulation.alpha(0.3).restart();
        });
        
        // Hide node details when clicking elsewhere
        document.getElementById('graph').addEventListener('click', event => {
            if (event.target.tagName === 'svg' || event.target.id === 'graph') {
                document.getElementById('node-details').style.display = 'none';
            }
        });
        
        // Initialize visualization on page load
        window.onload = initVisualization;
    </script>
</body>
</html>
    `;
    }
}