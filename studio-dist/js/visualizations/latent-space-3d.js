/**
 * Latent Space 3D Visualization
 * 
 * Three.js point cloud showing T5 autoencoder embeddings in latent space
 * - Each point = cached prompt embedding
 * - Color-coded by sector (Healthcare, Finance, IoT, etc.)
 * - Size = query frequency
 * - Lines connect semantically similar prompts
 * - Interactive rotation, zoom, click for details
 */

class LatentSpace3D {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }
    
    this.config = {
      width: options.width || this.container.clientWidth,
      height: options.height || this.container.clientHeight || 500,
      pointSize: options.pointSize || 3,
      similarityThreshold: options.similarityThreshold || 0.1,
      autoRotate: options.autoRotate !== undefined ? options.autoRotate : true,
      ...options
    };
    
    // Data storage
    this.points = []; // { id, position: [x,y,z], sector, frequency, embedding, prompt }
    this.connections = []; // { from, to, similarity }
    
    // Sector colors
    this.sectorColors = {
      FIN: 0x0ea5e9,    // Sky
      HC: 0x10b981,     // Emerald
      IOT: 0x8b5cf6,    // Purple
      ECOM: 0xf59e0b,   // Amber
      CDN: 0xec4899,    // Pink
      GAME: 0x06b6d4,   // Cyan
      SEC: 0xef4444,    // Red
      GEN: 0x64748b     // Slate
    };
    
    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.particleSystem = null;
    this.lineSystem = null;
    
    this.initialized = false;
    this.animationId = null;
  }
  
  /**
   * Initialize Three.js scene
   */
  init() {
    if (this.initialized) return;
    
    const { width, height } = this.config;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.Fog(0x0f172a, 50, 200);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );
    this.camera.position.set(0, 30, 80);
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Add orbit controls (if available via CDN)
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.autoRotate = this.config.autoRotate;
      this.controls.autoRotateSpeed = 0.5;
    }
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // Add directional lights
    const light1 = new THREE.DirectionalLight(0xffffff, 0.6);
    light1.position.set(50, 50, 50);
    this.scene.add(light1);
    
    const light2 = new THREE.DirectionalLight(0x0ea5e9, 0.3);
    light2.position.set(-50, -50, -50);
    this.scene.add(light2);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 20, 0x334155, 0x1e293b);
    gridHelper.position.y = -20;
    this.scene.add(gridHelper);
    
    // Add axes helper (subtle)
    const axesHelper = new THREE.AxesHelper(30);
    axesHelper.material.opacity = 0.3;
    axesHelper.material.transparent = true;
    this.scene.add(axesHelper);
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Add click interaction
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    
    this.initialized = true;
    this.animate();
  }
  
  /**
   * Add point to latent space
   */
  addPoint(data) {
    // Generate position from embedding (or mock 3D projection)
    const position = data.position || this.projectEmbedding(data.embedding);
    
    const point = {
      id: data.id || `point_${this.points.length}`,
      position: position,
      sector: data.sector || 'GEN',
      frequency: data.frequency || 1,
      embedding: data.embedding,
      prompt: data.prompt || ''
    };
    
    this.points.push(point);
    
    // Find connections to similar points
    if (data.embedding) {
      this.findConnections(point);
    }
    
    if (this.initialized) {
      this.updateVisualization();
    }
  }
  
  /**
   * Project high-dimensional embedding to 3D
   * In production, this would use UMAP/t-SNE, but for now we'll mock it
   */
  projectEmbedding(embedding) {
    if (!embedding || embedding.length < 3) {
      // Generate random position for demo
      return [
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      ];
    }
    
    // Simple projection: use first 3 dimensions (scaled)
    return [
      embedding[0] * 30,
      embedding[1] * 30,
      embedding[2] * 30
    ];
  }
  
  /**
   * Find connections to semantically similar points
   */
  findConnections(newPoint) {
    if (!newPoint.embedding) return;
    
    this.points.forEach(point => {
      if (point.id === newPoint.id || !point.embedding) return;
      
      const similarity = this.cosineSimilarity(newPoint.embedding, point.embedding);
      
      if (similarity > this.config.similarityThreshold) {
        this.connections.push({
          from: newPoint.id,
          to: point.id,
          similarity: similarity
        });
      }
    });
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Update visualization with current data
   */
  updateVisualization() {
    // Remove old particle system
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      this.particleSystem.material.dispose();
    }
    
    // Remove old line system
    if (this.lineSystem) {
      this.scene.remove(this.lineSystem);
      this.lineSystem.geometry.dispose();
      this.lineSystem.material.dispose();
    }
    
    if (this.points.length === 0) return;
    
    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const sizes = [];
    
    this.points.forEach(point => {
      positions.push(...point.position);
      
      const color = new THREE.Color(this.sectorColors[point.sector] || this.sectorColors.GEN);
      colors.push(color.r, color.g, color.b);
      
      sizes.push(this.config.pointSize * Math.sqrt(point.frequency));
    });
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    
    // Create particle material
    const material = new THREE.PointsMaterial({
      size: this.config.pointSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
    
    // Create connection lines
    this.createConnectionLines();
  }
  
  /**
   * Create lines connecting similar points
   */
  createConnectionLines() {
    if (this.connections.length === 0) return;
    
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = [];
    const lineColors = [];
    
    this.connections.forEach(conn => {
      const fromPoint = this.points.find(p => p.id === conn.from);
      const toPoint = this.points.find(p => p.id === conn.to);
      
      if (!fromPoint || !toPoint) return;
      
      linePositions.push(...fromPoint.position, ...toPoint.position);
      
      // Color based on similarity strength
      const opacity = conn.similarity;
      const color = new THREE.Color(0x0ea5e9);
      lineColors.push(color.r, color.g, color.b, opacity);
      lineColors.push(color.r, color.g, color.b, opacity);
    });
    
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.2
    });
    
    this.lineSystem = new THREE.LineSegments(lineGeometry, lineMaterial);
    this.scene.add(this.lineSystem);
  }
  
  /**
   * Animation loop
   */
  animate() {
    if (!this.initialized) return;
    
    this.animationId = requestAnimationFrame(() => this.animate());
    
    if (this.controls) {
      this.controls.update();
    }
    
    // Rotate particles slowly
    if (this.particleSystem && !this.controls?.autoRotate) {
      this.particleSystem.rotation.y += 0.001;
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Handle window resize
   */
  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  /**
   * Handle click to select point
   */
  onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    if (this.particleSystem) {
      const intersects = raycaster.intersectObject(this.particleSystem);
      if (intersects.length > 0) {
        const index = intersects[0].index;
        const point = this.points[index];
        this.onPointClick(point);
      }
    }
  }
  
  /**
   * Handle point click
   */
  onPointClick(point) {
    console.log('Point clicked:', point);
    // TODO: Show detail panel with prompt, sector, frequency, etc.
  }
  
  /**
   * Clear all points
   */
  clear() {
    this.points = [];
    this.connections = [];
    if (this.initialized) {
      this.updateVisualization();
    }
  }
  
  /**
   * Destroy visualization
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    this.initialized = false;
  }
  
  /**
   * Generate mock data for testing
   */
  generateMockData(count = 100) {
    const sectors = Object.keys(this.sectorColors);
    
    for (let i = 0; i < count; i++) {
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      
      // Generate clustered position based on sector
      const sectorOffset = sectors.indexOf(sector) * 20 - 60;
      const clusterSpread = 15;
      
      this.addPoint({
        id: `mock_${i}`,
        position: [
          sectorOffset + (Math.random() - 0.5) * clusterSpread,
          (Math.random() - 0.5) * clusterSpread,
          (Math.random() - 0.5) * clusterSpread
        ],
        sector: sector,
        frequency: Math.floor(Math.random() * 20) + 1,
        embedding: Array(8).fill(0).map(() => Math.random()),
        prompt: `Mock prompt ${i} for ${sector} sector`
      });
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LatentSpace3D;
}
