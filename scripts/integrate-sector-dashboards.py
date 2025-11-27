#!/usr/bin/env python3
"""
Integrate Sector Dashboard API into all 10 sector HTML files
"""

import os
import re

DASHBOARDS_DIR = '../public/dashboards'
SECTORS = ['finance', 'legal', 'education', 'ecommerce', 'enterprise', 'developer', 'datascience', 'government', 'general']

def integrate_dashboard(filepath, sector):
    """Integrate API into a single dashboard file"""
    print(f"Processing {sector}.html...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already integrated
    if 'sector-dashboard-api.js' in content:
        print(f"  ✓ {sector}.html already has API script")
    else:
        # Add API script after viz library
        content = content.replace(
            '<script src="/js/visualizations/agentcache-viz.js"></script>',
            '<script src="/js/visualizations/agentcache-viz.js"></script>\n  \n  <!-- Sector Dashboard API Integration -->\n  <script src="/js/sector-dashboard-api.js"></script>'
        )
        print(f"  ✓ Added API script to {sector}.html")
    
    # Check if API initialization exists
    if f"new SectorDashboardAPI('{sector}')" in content:
        print(f"  ✓ {sector}.html already has API initialization")
    else:
        # Add API initialization after lucide.createIcons()
        init_pattern = r"(lucide\.createIcons\(\);)"
        init_replacement = f"""\\1\n\n    // Initialize API integration\n    const dashboardAPI = new SectorDashboardAPI('{sector}');\n    let liveDataLoaded = false;"""
        content = re.sub(init_pattern, init_replacement, content, count=1)
        print(f"  ✓ Added API initialization to {sector}.html")
    
    # Update DOMContentLoaded event listener to async and call API
    if 'liveDataLoaded = await dashboardAPI.initialize()' in content:
        print(f"  ✓ {sector}.html already has async initialization")
    else:
        # Find and update DOMContentLoaded
        dom_pattern = r"document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{"
        dom_replacement = "document.addEventListener('DOMContentLoaded', async () => {\n      // Try to load live data first\n      liveDataLoaded = await dashboardAPI.initialize();\n      \n      // If live data failed, fall back to simulated data\n      if (!liveDataLoaded) {\n        console.warn('[{sector}] Live data unavailable, using simulated data');\n      }\n      ".replace('{sector}', sector.capitalize())
        
        if re.search(dom_pattern, content):
            content = re.sub(dom_pattern, dom_replacement, content, count=1)
            print(f"  ✓ Updated DOMContentLoaded in {sector}.html")
        else:
            print(f"  ⚠ Could not find DOMContentLoaded pattern in {sector}.html")
    
    # Update refreshDashboard function
    if 'dashboardAPI.refresh(timeRange)' in content:
        print(f"  ✓ {sector}.html already has API refresh")
    else:
        # Find refreshDashboard function and update it
        refresh_pattern = r"function refreshDashboard\(\)\s*\{[^}]*\}"
        
        new_refresh = f"""function refreshDashboard() {{
      const btn = event.target.closest('button');
      btn.disabled = true;
      
      // Show refresh animation
      anime({{
        targets: btn.querySelector('svg'),
        rotate: '1turn',
        duration: 800,
        easing: 'easeInOutQuad'
      }});
      
      // If live data is available, refresh from API
      if (liveDataLoaded && dashboardAPI) {{
        const timeRange = document.getElementById('timeRange').value;
        dashboardAPI.refresh(timeRange).then(() => {{
          btn.disabled = false;
        }});
      }} else {{
        // Otherwise use simulated data
        console.log('[{sector.capitalize()} Dashboard] Refreshing simulated data...');
        setTimeout(() => {{
          btn.disabled = false;
        }}, 800);
      }}
    }}"""
        
        if re.search(refresh_pattern, content, re.DOTALL):
            content = re.sub(refresh_pattern, new_refresh, content, count=1, flags=re.DOTALL)
            print(f"  ✓ Updated refreshDashboard in {sector}.html")
        else:
            print(f"  ⚠ Could not find refreshDashboard function in {sector}.html")
    
    # Write updated content
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✅ Completed {sector}.html\n")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dashboards_dir = os.path.join(script_dir, DASHBOARDS_DIR)
    
    print("=" * 60)
    print("Sector Dashboard API Integration")
    print("=" * 60)
    print(f"Dashboards directory: {dashboards_dir}\n")
    
    for sector in SECTORS:
        filepath = os.path.join(dashboards_dir, f"{sector}.html")
        
        if not os.path.exists(filepath):
            print(f"❌ {filepath} not found, skipping...")
            continue
        
        try:
            integrate_dashboard(filepath, sector)
        except Exception as e:
            print(f"❌ Error processing {sector}.html: {e}\n")
    
    print("=" * 60)
    print("✅ Integration complete!")
    print("=" * 60)

if __name__ == '__main__':
    main()
