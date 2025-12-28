#!/usr/bin/env python3
"""
Lyve Transcoder Worker
A lightweight video transcoding service for AgentCache.ai

Uses:
- Redis (Upstash) for job queue
- FFmpeg for transcoding
- Lyve Cloud S3 for storage
"""

import os
import json
import time
import tempfile
import subprocess
import logging
from typing import Dict, List, Optional
import redis
import boto3
from botocore.config import Config

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger('lyve-transcoder')

# Configuration
REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_URL')
LYVE_ENDPOINT = os.environ.get('LYVE_ENDPOINT', 'https://s3.us-west-1.lyvecloud.seagate.com')
LYVE_ACCESS_KEY = os.environ.get('LYVE_ACCESS_KEY') or os.environ.get('LYVE_CLOUD_ACCESS_KEY')
LYVE_SECRET_KEY = os.environ.get('LYVE_SECRET_KEY') or os.environ.get('LYVE_CLOUD_SECRET_KEY')
LYVE_BUCKET = os.environ.get('LYVE_BUCKET', 'jettydata-prod')
QUEUE_NAME = os.environ.get('QUEUE_NAME', 'transcode_jobs')
WEBHOOK_URL = os.environ.get('WEBHOOK_URL')  # Optional: notify on completion

# Encoding ladder (ABR profiles)
DEFAULT_LADDER = [
    {'name': '1080p', 'height': 1080, 'bitrate': '8M', 'audio_bitrate': '192k'},
    {'name': '720p', 'height': 720, 'bitrate': '4M', 'audio_bitrate': '128k'},
    {'name': '480p', 'height': 480, 'bitrate': '2M', 'audio_bitrate': '96k'},
    {'name': '360p', 'height': 360, 'bitrate': '800k', 'audio_bitrate': '64k'},
]


class LyveTranscoder:
    def __init__(self):
        # Redis connection
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info(f"✅ Connected to Redis")

        # S3 client for Lyve Cloud
        self.s3 = boto3.client(
            's3',
            endpoint_url=LYVE_ENDPOINT,
            aws_access_key_id=LYVE_ACCESS_KEY,
            aws_secret_access_key=LYVE_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-west-1'
        )
        logger.info(f"✅ Connected to Lyve Cloud: {LYVE_ENDPOINT}")

    def run(self):
        """Main processing loop"""
        logger.info("🚀 Lyve Transcoder started. Waiting for jobs...")
        
        while True:
            try:
                # Pop job from queue (blocking with timeout)
                result = self.redis.brpop(QUEUE_NAME, timeout=5)
                
                if not result:
                    continue  # No job, loop again
                
                _, job_data = result
                job = json.loads(job_data)
                
                logger.info(f"📥 Processing job: {job.get('id', 'unknown')}")
                self.process_job(job)
                
            except KeyboardInterrupt:
                logger.info("Shutting down...")
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                time.sleep(1)

    def process_job(self, job: Dict):
        """Process a single transcoding job"""
        job_id = job.get('id', str(time.time()))
        input_bucket = job.get('input_bucket', LYVE_BUCKET)
        input_key = job.get('input_key')
        output_bucket = job.get('output_bucket', LYVE_BUCKET)
        output_prefix = job.get('output_prefix', f"transcoded/{job_id}")
        ladder = job.get('ladder', DEFAULT_LADDER)
        
        if not input_key:
            self.notify_status(job_id, 'failed', error='Missing input_key')
            return

        outputs = []
        
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # 1. Download source
                input_path = os.path.join(tmpdir, 'source.mp4')
                logger.info(f"⬇️  Downloading: s3://{input_bucket}/{input_key}")
                self.s3.download_file(input_bucket, input_key, input_path)
                
                # 2. Transcode each profile
                for profile in ladder:
                    output_name = f"{profile['name']}.mp4"
                    output_path = os.path.join(tmpdir, output_name)
                    
                    logger.info(f"🎬 Encoding {profile['name']}...")
                    self.encode(input_path, output_path, profile)
                    
                    # 3. Upload to Lyve
                    output_key = f"{output_prefix}/{output_name}"
                    logger.info(f"⬆️  Uploading: s3://{output_bucket}/{output_key}")
                    self.s3.upload_file(
                        output_path,
                        output_bucket,
                        output_key,
                        ExtraArgs={'ContentType': 'video/mp4'}
                    )
                    
                    outputs.append({
                        'profile': profile['name'],
                        'key': output_key,
                        'url': f"{LYVE_ENDPOINT}/{output_bucket}/{output_key}"
                    })
                
                # 4. Generate HLS manifest (optional)
                manifest_key = f"{output_prefix}/master.m3u8"
                manifest_content = self.generate_hls_manifest(outputs, output_prefix)
                self.s3.put_object(
                    Bucket=output_bucket,
                    Key=manifest_key,
                    Body=manifest_content,
                    ContentType='application/x-mpegURL'
                )
                outputs.append({'profile': 'hls', 'key': manifest_key})
                
            # Success
            logger.info(f"✅ Job {job_id} complete: {len(outputs)} outputs")
            self.notify_status(job_id, 'complete', outputs=outputs)
            
        except Exception as e:
            logger.error(f"❌ Job {job_id} failed: {e}")
            self.notify_status(job_id, 'failed', error=str(e))

    def encode(self, input_path: str, output_path: str, profile: Dict):
        """Run FFmpeg encoding for a single profile"""
        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-profile:v', 'high' if profile['height'] >= 720 else 'main',
            '-level', '4.1' if profile['height'] >= 1080 else '3.1',
            '-vf', f"scale=-2:{profile['height']}",
            '-b:v', profile['bitrate'],
            '-maxrate', profile['bitrate'],
            '-bufsize', str(int(profile['bitrate'].rstrip('Mk')) * 2) + 'M',
            '-g', '60',  # Keyframe interval
            '-keyint_min', '30',
            '-c:a', 'aac',
            '-b:a', profile['audio_bitrate'],
            '-movflags', '+faststart',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr[:500]}")

    def generate_hls_manifest(self, outputs: List[Dict], prefix: str) -> str:
        """Generate HLS master playlist"""
        lines = ['#EXTM3U', '#EXT-X-VERSION:3']
        
        bandwidth_map = {
            '1080p': 8000000,
            '720p': 4000000,
            '480p': 2000000,
            '360p': 800000
        }
        
        for output in outputs:
            if output['profile'] in bandwidth_map:
                bw = bandwidth_map[output['profile']]
                res = {'1080p': '1920x1080', '720p': '1280x720', '480p': '854x480', '360p': '640x360'}
                lines.append(f'#EXT-X-STREAM-INF:BANDWIDTH={bw},RESOLUTION={res.get(output["profile"], "1280x720")}')
                lines.append(output['key'].split('/')[-1])
        
        return '\n'.join(lines)

    def notify_status(self, job_id: str, status: str, outputs: List = None, error: str = None):
        """Store job status in Redis and optionally call webhook"""
        status_data = {
            'job_id': job_id,
            'status': status,
            'timestamp': time.time(),
            'outputs': outputs or [],
            'error': error
        }
        
        # Store in Redis
        self.redis.hset(f"job:{job_id}", mapping={
            'status': status,
            'outputs': json.dumps(outputs or []),
            'error': error or '',
            'updated_at': str(time.time())
        })
        self.redis.expire(f"job:{job_id}", 86400 * 7)  # 7 days TTL
        
        # Webhook notification
        if WEBHOOK_URL:
            try:
                import requests
                requests.post(WEBHOOK_URL, json=status_data, timeout=5)
            except:
                pass  # Best effort


if __name__ == '__main__':
    if not REDIS_URL:
        logger.error("❌ REDIS_URL not set")
        exit(1)
    if not LYVE_ACCESS_KEY:
        logger.error("❌ LYVE_ACCESS_KEY not set")
        exit(1)
        
    worker = LyveTranscoder()
    worker.run()
