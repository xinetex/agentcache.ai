#!/usr/bin/env python3
"""
Quick test script to submit a transcoding job
"""
import redis
import json
import os
import sys

# Get Redis URL from environment
REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_URL')

if not REDIS_URL:
    print("❌ Error: REDIS_URL or UPSTASH_REDIS_URL environment variable not set")
    print("\nExample:")
    print("export REDIS_URL='redis://default:PASSWORD@HOST:PORT'")
    sys.exit(1)

try:
    r = redis.from_url(REDIS_URL, decode_responses=True)
    
    # Test connection
    r.ping()
    print("✅ Connected to Redis")
    
    # Get test video key from args or use default
    input_key = sys.argv[1] if len(sys.argv) > 1 else 'audio1/2816/test-video.mp4'
    
    job = {
        'id': f'test_job_{int(os.time.time()) if hasattr(os, "time") else "001"}',
        'input_bucket': 'jettydata-prod',
        'input_key': input_key,
        'output_bucket': 'jettydata-prod',
        'output_prefix': f'transcoded/test_{input_key.split("/")[-1].split(".")[0]}',
        'ladder': [
            {'name': '720p', 'height': 720, 'bitrate': '4M', 'audio_bitrate': '128k'},
            {'name': '480p', 'height': 480, 'bitrate': '2M', 'audio_bitrate': '96k'},
        ]
    }
    
    # Submit job
    r.lpush('transcode_jobs', json.dumps(job))
    
    print(f"✅ Job submitted: {job['id']}")
    print(f"   Input:  s3://jettydata-prod/{input_key}")
    print(f"   Output: s3://jettydata-prod/{job['output_prefix']}/")
    print(f"\nMonitor with: redis-cli -u $REDIS_URL HGETALL 'job:{job['id']}'")
    
except redis.exceptions.ConnectionError as e:
    print(f"❌ Redis connection failed: {e}")
    print("\nCheck your REDIS_URL environment variable")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
