#!/usr/bin/env python3
"""
Check the status of a transcoding job
"""
import redis
import json
import os
import sys

REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_URL')

if not REDIS_URL:
    print("❌ Error: REDIS_URL not set")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python3 test_status.py <job_id>")
    print("\nExample: python3 test_status.py test_job_001")
    sys.exit(1)

job_id = sys.argv[1]

try:
    r = redis.from_url(REDIS_URL, decode_responses=True)
    
    # Get job status
    status = r.hgetall(f"job:{job_id}")
    
    if not status:
        print(f"❌ Job not found: {job_id}")
        
        # Show available jobs
        keys = r.keys("job:*")
        if keys:
            print(f"\nAvailable jobs ({len(keys)}):")
            for key in keys[:10]:
                job_id_only = key.replace('job:', '')
                job_status = r.hget(key, 'status')
                print(f"  - {job_id_only}: {job_status}")
        sys.exit(1)
    
    # Pretty print status
    print(f"\n📊 Job Status: {job_id}")
    print("=" * 60)
    print(f"Status:     {status.get('status', 'unknown')}")
    print(f"Updated At: {status.get('updated_at', 'N/A')}")
    
    if status.get('error'):
        print(f"\n❌ Error: {status['error']}")
    
    if status.get('outputs'):
        outputs = json.loads(status['outputs'])
        print(f"\n✅ Outputs ({len(outputs)}):")
        for output in outputs:
            print(f"  - {output.get('profile', 'unknown')}: {output.get('key', 'N/A')}")
    
    print("=" * 60)
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
