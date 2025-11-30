/**
 * Professional Response Data Viewer
 * Smart data parser + adaptive visual rendering
 */

class ResponseDataParser {
  /**
   * Detect data type and extract key information
   */
  static parse(data) {
    if (this.isGeoLocation(data)) return this.parseGeoLocation(data);
    if (this.isCryptoPrice(data)) return this.parseCryptoPrice(data);
    if (this.isWeatherData(data)) return this.parseWeather(data);
    if (this.isFDADrug(data)) return this.parseFDADrug(data);
    if (this.isCountryData(data)) return this.parseCountry(data);
    if (this.isPokemon(data)) return this.parsePokemon(data);
    if (this.isImageData(data)) return this.parseImage(data);
    
    return { type: 'generic', data };
  }
  
  static isGeoLocation(data) {
    return data && (data.ip || data.latitude || data.city || data.country_name);
  }
  
  static parseGeoLocation(data) {
    return {
      type: 'geolocation',
      hero: {
        flag: this.getCountryFlag(data.country_code || data.country),
        title: data.city || 'Unknown Location',
        subtitle: [data.region, data.country_name].filter(Boolean).join(', ')
      },
      stats: [
        { label: 'Coordinates', value: `${data.latitude}°N, ${data.longitude}°W`, icon: '📍' },
        { label: 'Timezone', value: data.timezone || data.utc_offset, icon: '🕐' },
        { label: 'ISP', value: data.org || data.isp || 'Unknown', icon: '🌐' },
        { label: 'IP Address', value: data.ip, icon: '🔢' }
      ],
      rawData: data
    };
  }
  
  static isCryptoPrice(data) {
    return data && (data.bitcoin || data.ethereum || (data.id && data.current_price));
  }
  
  static parseCryptoPrice(data) {
    // CoinGecko API format
    const coins = [];
    for (const [key, value] of Object.entries(data)) {
      if (value.usd) {
        coins.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          symbol: key.toUpperCase(),
          price: value.usd,
          change24h: value.usd_24h_change || 0
        });
      }
    }
    
    const mainCoin = coins[0] || {};
    
    return {
      type: 'crypto',
      hero: {
        icon: this.getCryptoIcon(mainCoin.symbol),
        title: `$${mainCoin.price?.toLocaleString()}`,
        subtitle: mainCoin.name
      },
      stats: coins.map(coin => ({
        label: coin.name,
        value: `$${coin.price.toLocaleString()}`,
        change: coin.change24h,
        icon: this.getCryptoIcon(coin.symbol)
      })),
      rawData: data
    };
  }
  
  static isWeatherData(data) {
    return data && (data.current || data.current_weather || data.temperature_2m);
  }
  
  static parseWeather(data) {
    const current = data.current || data.current_weather || data;
    const temp = current.temperature_2m || current.temperature || current.temp;
    
    return {
      type: 'weather',
      hero: {
        icon: this.getWeatherIcon(current.weathercode || current.weather_code),
        title: `${Math.round(temp)}°F`,
        subtitle: 'Current Temperature'
      },
      stats: [
        { label: 'Wind Speed', value: `${current.wind_speed_10m || current.windspeed || 0} mph`, icon: '💨' },
        { label: 'Humidity', value: `${current.relative_humidity_2m || current.humidity || 0}%`, icon: '💧' },
        { label: 'Conditions', value: this.getWeatherDescription(current.weathercode), icon: '☁️' }
      ],
      rawData: data
    };
  }
  
  static isFDADrug(data) {
    return data && data.results && Array.isArray(data.results) && data.results[0]?.patient;
  }
  
  static parseFDADrug(data) {
    const result = data.results[0] || {};
    const drug = result.patient?.drug?.[0] || {};
    const drugName = drug.medicinalproduct || drug.openfda?.brand_name?.[0] || 'Unknown Drug';
    
    return {
      type: 'fda_drug',
      hero: {
        icon: '💊',
        title: drugName,
        subtitle: 'FDA Adverse Event Report'
      },
      stats: [
        { label: 'Report Date', value: result.receivedate || 'N/A', icon: '📅' },
        { label: 'Serious', value: result.serious === '1' ? 'Yes' : 'No', icon: '⚠️' },
        { label: 'Patient Age', value: result.patient?.patientonsetage || 'N/A', icon: '👤' }
      ],
      badge: { text: 'HIPAA Compliant', variant: 'success' },
      rawData: data
    };
  }
  
  static isCountryData(data) {
    return Array.isArray(data) && data[0]?.name && data[0]?.capital;
  }
  
  static parseCountry(data) {
    const country = Array.isArray(data) ? data[0] : data;
    
    return {
      type: 'country',
      hero: {
        flag: country.flags?.svg || country.flag,
        title: country.name?.common || country.name,
        subtitle: country.capital?.[0] || 'Capital'
      },
      stats: [
        { label: 'Population', value: country.population?.toLocaleString() || 'N/A', icon: '👥' },
        { label: 'Region', value: country.region, icon: '🌍' },
        { label: 'Currency', value: this.getCurrencyName(country.currencies), icon: '💰' }
      ],
      rawData: data
    };
  }
  
  static isPokemon(data) {
    return data && data.name && data.abilities && data.sprites;
  }
  
  static parsePokemon(data) {
    return {
      type: 'pokemon',
      hero: {
        image: data.sprites?.front_default,
        title: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        subtitle: `#${data.id} • ${data.types?.map(t => t.type.name).join(', ')}`
      },
      stats: [
        { label: 'Height', value: `${data.height / 10}m`, icon: '📏' },
        { label: 'Weight', value: `${data.weight / 10}kg`, icon: '⚖️' },
        { label: 'Abilities', value: data.abilities.length, icon: '⚡' }
      ],
      rawData: data
    };
  }
  
  static isImageData(data) {
    return Array.isArray(data) && data[0]?.url && (data[0]?.url.includes('cat') || data[0]?.url.includes('image'));
  }
  
  static parseImage(data) {
    const image = Array.isArray(data) ? data[0] : data;
    
    return {
      type: 'image',
      hero: {
        image: image.url,
        title: 'Random Image',
        subtitle: image.id || 'Media CDN Demo'
      },
      stats: [
        { label: 'Width', value: `${image.width || 'N/A'}px`, icon: '↔️' },
        { label: 'Height', value: `${image.height || 'N/A'}px`, icon: '↕️' }
      ],
      rawData: data
    };
  }
  
  // Helper functions
  static getCountryFlag(code) {
    if (!code) return '🌍';
    const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }
  
  static getCryptoIcon(symbol) {
    const icons = { BTC: '₿', ETH: 'Ξ', ADA: '₳' };
    return icons[symbol] || '💰';
  }
  
  static getWeatherIcon(code) {
    if (!code) return '🌤️';
    if (code <= 3) return '☀️';
    if (code <= 48) return '☁️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    return '⛈️';
  }
  
  static getWeatherDescription(code) {
    if (!code) return 'Clear';
    if (code <= 3) return 'Clear to Partly Cloudy';
    if (code <= 48) return 'Cloudy';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    return 'Stormy';
  }
  
  static getCurrencyName(currencies) {
    if (!currencies) return 'N/A';
    const curr = Object.values(currencies)[0];
    return curr?.name || curr?.symbol || 'N/A';
  }
}

/**
 * Response Viewer Component
 */
class ResponseViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentData = null;
    this.currentMode = 'visual'; // visual, raw, table
  }
  
  render(data, metadata = {}) {
    this.currentData = data;
    const parsed = ResponseDataParser.parse(data);
    
    this.container.innerHTML = `
      <div class="response-viewer ${metadata.hit ? 'cache-hit' : 'cache-miss'}">
        ${this.renderHeader(parsed, metadata)}
        ${this.renderModeToggle()}
        <div class="response-content">
          ${this.currentMode === 'visual' ? this.renderVisual(parsed) : ''}
          ${this.currentMode === 'raw' ? this.renderRaw(data) : ''}
          ${this.currentMode === 'table' ? this.renderTable(data) : ''}
        </div>
      </div>
    `;
    
    this.attachEventListeners();
    
    // Trigger animation
    if (metadata.hit) {
      setTimeout(() => {
        this.container.querySelector('.response-viewer')?.classList.add('animate-in');
      }, 10);
    }
  }
  
  renderHeader(parsed, metadata) {
    const typeLabels = {
      geolocation: '📍 Geolocation',
      crypto: '₿ Cryptocurrency',
      weather: '🌤️ Weather Data',
      fda_drug: '💊 FDA Drug Database',
      country: '🌍 Country Info',
      pokemon: '🎮 Pokémon',
      image: '🖼️ Media',
      generic: '📄 Data'
    };
    
    return `
      <div class="response-header">
        <div class="response-type-badge">
          <span class="badge-text">${typeLabels[parsed.type]}</span>
        </div>
        
        <div class="response-meta">
          <span class="meta-item ${metadata.hit ? 'hit' : 'miss'}">
            <span class="meta-dot"></span>
            ${metadata.hit ? 'CACHE HIT' : 'CACHE MISS'}
          </span>
          <span class="meta-item">${metadata.latency || 0}ms</span>
          <span class="meta-item">$${(metadata.cost || 0).toFixed(4)}</span>
        </div>
      </div>
    `;
  }
  
  renderModeToggle() {
    return `
      <div class="view-mode-toggle">
        <button class="mode-btn ${this.currentMode === 'visual' ? 'active' : ''}" data-mode="visual">
          <svg class="mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span>Visual</span>
        </button>
        <button class="mode-btn ${this.currentMode === 'raw' ? 'active' : ''}" data-mode="raw">
          <svg class="mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>Raw JSON</span>
        </button>
        <button class="mode-btn ${this.currentMode === 'table' ? 'active' : ''}" data-mode="table">
          <svg class="mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Table</span>
        </button>
      </div>
    `;
  }
  
  renderVisual(parsed) {
    switch (parsed.type) {
      case 'geolocation':
      case 'country':
        return this.renderHeroLayout(parsed);
      case 'crypto':
        return this.renderCryptoLayout(parsed);
      case 'weather':
        return this.renderWeatherLayout(parsed);
      case 'pokemon':
      case 'image':
        return this.renderImageLayout(parsed);
      default:
        return this.renderGenericLayout(parsed);
    }
  }
  
  renderHeroLayout(parsed) {
    return `
      <div class="response-hero">
        <div class="hero-primary">
          <div class="hero-title-group">
            <span class="hero-icon">${parsed.hero.flag || parsed.hero.icon}</span>
            <h1 class="hero-title">${parsed.hero.title}</h1>
          </div>
          <p class="hero-subtitle">${parsed.hero.subtitle}</p>
        </div>
        
        ${parsed.badge ? `<div class="hero-badge badge-${parsed.badge.variant}">${parsed.badge.text}</div>` : ''}
        
        <div class="hero-stats">
          ${parsed.stats.map(stat => `
            <div class="stat-card">
              <span class="stat-icon">${stat.icon}</span>
              <div class="stat-content">
                <span class="stat-label">${stat.label}</span>
                <span class="stat-value">${stat.value}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  renderCryptoLayout(parsed) {
    return `
      <div class="response-hero crypto">
        <div class="crypto-primary">
          <span class="crypto-icon">${parsed.hero.icon}</span>
          <div>
            <h1 class="crypto-price">${parsed.hero.title}</h1>
            <p class="crypto-name">${parsed.hero.subtitle}</p>
          </div>
        </div>
        
        <div class="crypto-grid">
          ${parsed.stats.map(stat => `
            <div class="crypto-card">
              <div class="crypto-card-header">
                <span class="crypto-card-icon">${stat.icon}</span>
                <span class="crypto-card-name">${stat.label}</span>
              </div>
              <div class="crypto-card-price">${stat.value}</div>
              ${stat.change ? `
                <div class="crypto-card-change ${stat.change > 0 ? 'positive' : 'negative'}">
                  ${stat.change > 0 ? '↗' : '↘'} ${Math.abs(stat.change).toFixed(2)}%
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  renderWeatherLayout(parsed) {
    return this.renderHeroLayout(parsed);
  }
  
  renderImageLayout(parsed) {
    return `
      <div class="response-hero image">
        ${parsed.hero.image ? `
          <div class="hero-image-container">
            <img src="${parsed.hero.image}" alt="${parsed.hero.title}" class="hero-image" />
          </div>
        ` : ''}
        <div class="hero-image-info">
          <h2 class="hero-image-title">${parsed.hero.title}</h2>
          <p class="hero-image-subtitle">${parsed.hero.subtitle}</p>
          ${parsed.stats.map(stat => `
            <span class="image-stat">${stat.icon} ${stat.label}: ${stat.value}</span>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  renderGenericLayout(parsed) {
    return this.renderTable(parsed.data);
  }
  
  renderRaw(data) {
    return `
      <div class="response-raw">
        <pre class="json-viewer"><code>${JSON.stringify(data, null, 2)}</code></pre>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(data)}, null, 2))">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    `;
  }
  
  renderTable(data) {
    const flatData = this.flattenObject(data);
    
    return `
      <div class="response-table">
        ${Object.entries(flatData).map(([key, value]) => `
          <div class="table-row">
            <span class="table-key">${key}</span>
            <span class="table-value" data-type="${typeof value}">${this.formatValue(value)}</span>
            <button class="table-copy" onclick="navigator.clipboard.writeText('${String(value).replace(/'/g, "\\'")}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }
  
  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  
  attachEventListeners() {
    this.container.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentMode = btn.dataset.mode;
        this.render(this.currentData, {}); // Re-render with new mode
      });
    });
  }
}

// Export for use in studio-v2.html
if (typeof window !== 'undefined') {
  window.ResponseViewer = ResponseViewer;
  window.ResponseDataParser = ResponseDataParser;
}
