// Brain Visualization with D3.js and Anime.js

const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#viz-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Simulation setup
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(d => d.vitality * 20 + 5));

// Data storage
let nodes = [];
let links = [];

// Mock Data Generator (Replace with API call later)
function generateMockData() {
    const sectors = ['healthcare', 'finance', 'retail', 'tech'];
    const newNodes = [];

    for (let i = 0; i < 5; i++) {
        const sector = sectors[Math.floor(Math.random() * sectors.length)];
        newNodes.push({
            id: `mem-${Date.now()}-${i}`,
            group: sector,
            vitality: Math.random() * 0.5 + 0.5, // 0.5 - 1.0
            type: Math.random() > 0.8 ? 'L3' : 'L2'
        });
    }
    return newNodes;
}

// Initial Population
nodes = generateMockData();
updateViz();

// Periodic Updates (Simulating real-time activity)
setInterval(() => {
    // Add new nodes
    if (nodes.length < 50) {
        const newBatch = generateMockData();
        nodes.push(...newBatch);

        // Link to existing nodes of same sector
        newBatch.forEach(node => {
            const target = nodes.find(n => n !== node && n.group === node.group);
            if (target) {
                links.push({ source: node.id, target: target.id });
            }
        });
    }

    // Decay Vitality
    nodes.forEach(n => {
        n.vitality *= 0.99; // Decay
        if (Math.random() > 0.9) n.vitality = Math.min(1, n.vitality + 0.2); // Random reinforcement
    });

    // Prune dead nodes
    nodes = nodes.filter(n => n.vitality > 0.2);
    links = links.filter(l => nodes.find(n => n.id === l.source.id) && nodes.find(n => n.id === l.target.id));

    updateStats();
    updateViz();
}, 2000);

function updateViz() {
    // Links
    const link = svg.selectAll(".link")
        .data(links, d => d.source.id + "-" + d.target.id);

    link.enter().append("line")
        .attr("class", "link")
        .attr("stroke", "#334155")
        .attr("stroke-width", 1)
        .attr("opacity", 0.5)
        .merge(link);

    link.exit().remove();

    // Nodes
    const node = svg.selectAll(".node")
        .data(nodes, d => d.id);

    const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.append("circle")
        .attr("r", 0) // Start small for animation
        .attr("fill", d => getColor(d.group))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);

    // Anime.js entry animation
    anime({
        targets: nodeEnter.select("circle").nodes(),
        r: d => d.vitality * 15 + 5,
        scale: [0, 1],
        duration: 1000,
        easing: 'easeOutElastic(1, .8)'
    });

    // Update existing nodes (vitality changes)
    node.select("circle")
        .transition().duration(500)
        .attr("r", d => d.vitality * 15 + 5)
        .attr("opacity", d => d.vitality);

    node.exit().transition().duration(500)
        .attr("opacity", 0)
        .remove();

    simulation.nodes(nodes).on("tick", ticked);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        nodeEnter.merge(node)
            .attr("transform", d => `translate(${d.x},${d.y})`);
    }
}

function getColor(group) {
    const colors = {
        healthcare: '#ef4444', // Red
        finance: '#22c55e',    // Green
        retail: '#eab308',     // Yellow
        tech: '#3b82f6'        // Blue
    };
    return colors[group] || '#94a3b8';
}

// Drag functions
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

function updateStats() {
    document.getElementById('active-memories').innerText = nodes.length;
    const avgVitality = nodes.reduce((sum, n) => sum + n.vitality, 0) / nodes.length;
    document.getElementById('avg-vitality').innerText = Math.round(avgVitality * 100) + '%';

    // Mock Mesh Stats
    document.getElementById('local-hits').innerText = Math.floor(Math.random() * 1000);
    document.getElementById('global-failovers').innerText = Math.floor(Math.random() * 50);

    // Mock Swarm Stats
    document.getElementById('active-swarms').innerText = Math.floor(Math.random() * 3);
}
