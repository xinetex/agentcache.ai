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
import re
from typing import Dict, List, Optional
from datetime import datetime, timezone
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
        watermark = job.get('watermark')  # Optional: "A1::UID::SID"
        metadata = job.get('metadata') or {}
        
        if not input_key:
            self.notify_status(job_id, 'failed', error='Missing input_key')
            return

        outputs = []
        commands = []
        
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # 1. Download source
                input_path = os.path.join(tmpdir, 'source.mp4')
                self.update_phase(job_id, 'running', 'downloading', 8, metadata=metadata)
                logger.info(f"⬇️  Downloading: s3://{input_bucket}/{input_key}")
                self.s3.download_file(input_bucket, input_key, input_path)
                source_probe = self.run_ffprobe(input_path)
                self.update_phase(job_id, 'running', 'probing', 14, probe=source_probe)
                
                # 2. Transcode each profile to HLS
                for index, profile in enumerate(ladder):
                    profile_name = profile['name']
                    variant_dir = os.path.join(tmpdir, profile_name)
                    os.makedirs(variant_dir, exist_ok=True)
                    
                    output_playlist = os.path.join(variant_dir, "playlist.m3u8")
                    
                    progress = 20 + int((index / max(len(ladder), 1)) * 52)
                    self.update_phase(job_id, 'running', f'encoding:{profile_name}', progress)
                    logger.info(f"🎬 Encoding {profile_name} (HLS)...")
                    command = self.encode(input_path, output_playlist, profile, watermark, variant_dir)
                    commands.append({'profile': profile_name, 'argv': command})
                    
                    # 3. Upload segments and playlist to Lyve
                    # Structure: transcoded/job_id/1080p/playlist.m3u8
                    #            transcoded/job_id/1080p/segment_000.ts
                    
                    base_prefix = f"{output_prefix}/{profile_name}"
                    
                    for filename in os.listdir(variant_dir):
                        file_path = os.path.join(variant_dir, filename)
                        file_key = f"{base_prefix}/{filename}"
                        
                        content_type = 'application/x-mpegURL' if filename.endswith('.m3u8') else 'video/MP2T'
                        
                        logger.info(f"⬆️  Uploading: s3://{output_bucket}/{file_key}")
                        self.s3.upload_file(
                            file_path,
                            output_bucket,
                            file_key,
                            ExtraArgs={'ContentType': content_type}
                        )
                    
                    outputs.append({
                        'profile': profile_name,
                        'key': f"{base_prefix}/playlist.m3u8",
                        'url': f"{LYVE_ENDPOINT}/{output_bucket}/{base_prefix}/playlist.m3u8"
                    })
                
                # 4. Generate HLS Master Manifest
                self.update_phase(job_id, 'running', 'publishing', 88)
                manifest_key = f"{output_prefix}/master.m3u8"
                manifest_content = self.generate_hls_manifest(outputs, output_prefix)
                self.s3.put_object(
                    Bucket=output_bucket,
                    Key=manifest_key,
                    Body=manifest_content,
                    ContentType='application/x-mpegURL'
                )
                outputs.append({'profile': 'master', 'key': manifest_key})

                validation = self.validate_hls_outputs(tmpdir, outputs, manifest_content)
                provenance = {
                    'engine': 'agentcache-media-engine',
                    'worker': 'lyve_transcoder.py',
                    'ffmpegVersion': self.get_ffmpeg_version(),
                    'source': {
                        'bucket': input_bucket,
                        'key': input_key,
                    },
                    'output': {
                        'bucket': output_bucket,
                        'prefix': output_prefix,
                    },
                    'profileId': metadata.get('profileId'),
                    'cacheKey': metadata.get('cacheKey'),
                    'commands': commands,
                    'completedAt': self.now_iso(),
                }
                
            # Success
            logger.info(f"✅ Job {job_id} complete: {len(outputs)} outputs")
            self.notify_status(
                job_id,
                'complete',
                outputs=outputs,
                phase='complete',
                progress=100,
                validation=validation,
                provenance=provenance,
                probe=source_probe
            )
            
        except Exception as e:
            logger.error(f"❌ Job {job_id} failed: {e}")
            self.notify_status(job_id, 'failed', phase='failed', progress=0, error=str(e))

    def encode(self, input_path: str, output_path: str, profile: Dict, watermark: Optional[str] = None, variant_dir: str = None):
        """Run FFmpeg encoding for a single profile (HLS)"""
        
        # Build filter chain
        filters = [f"scale=-2:{profile['height']}"]
        
        if watermark:
            safe_text = watermark.replace(':', '\\:').replace("'", "")
            filters.append(f"drawtext=text='{safe_text}':fontsize=24:fontcolor=white@0.01:x=10:y=10")
            
        filter_str = ','.join(filters)

        # Output segment pattern
        segment_filename = os.path.join(variant_dir, "segment_%03d.ts") if variant_dir else "segment_%03d.ts"

        cmd = [
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-profile:v', 'high' if profile['height'] >= 720 else 'main',
            '-level', '4.1' if profile['height'] >= 1080 else '3.1',
            '-vf', filter_str,
            '-b:v', profile['bitrate'],
            '-maxrate', profile['bitrate'],
            '-bufsize', self.double_bitrate(profile['bitrate']),
            '-g', '60',  # Keyframe interval (2s at 30fps)
            '-keyint_min', '60', # Enforce consistent GOP for HLS
            '-sc_threshold', '0', # Disable scene cut detection for consistent segments
            '-c:a', 'aac',
            '-b:a', profile['audio_bitrate'],
            '-f', 'hls',
            '-hls_time', '6',
            '-hls_playlist_type', 'vod',
            '-hls_segment_filename', segment_filename,
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"FFmpeg error: {result.stderr[:500]}")

        return cmd

    def double_bitrate(self, bitrate: str) -> str:
        match = re.match(r'^(\d+(?:\.\d+)?)([kKmM])$', str(bitrate).strip())
        if not match:
            return bitrate

        value = float(match.group(1)) * 2
        unit = match.group(2)
        if value.is_integer():
            value = int(value)

        return f"{value}{unit}"

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
                # Roku requires RESOLUTION and BANDWIDTH.
                # Path should be relative to the master playlist (e.g., "1080p/playlist.m3u8")
                # output['key'] is full path like "prefix/1080p/playlist.m3u8"
                # We need just "1080p/playlist.m3u8" if master is at "prefix/master.m3u8"
                
                # Assuming output['key'] starts with prefix/
                relative_path = output['key'].split('/')[-2] + '/' + output['key'].split('/')[-1]
                
                lines.append(f'#EXT-X-STREAM-INF:BANDWIDTH={bw},RESOLUTION={res.get(output["profile"], "1280x720")}')
                lines.append(relative_path)
        
        return '\n'.join(lines)

    def now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_ffmpeg_version(self) -> str:
        try:
            result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.splitlines()[0]
        except Exception:
            pass
        return 'ffmpeg version unavailable'

    def run_ffprobe(self, path: str) -> Dict:
        try:
            result = subprocess.run(
                [
                    'ffprobe',
                    '-v', 'error',
                    '-print_format', 'json',
                    '-show_format',
                    '-show_streams',
                    path
                ],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0 and result.stdout:
                return json.loads(result.stdout)
            return {'error': result.stderr[:500]}
        except Exception as e:
            return {'error': str(e)}

    def validate_hls_outputs(self, tmpdir: str, outputs: List[Dict], manifest_content: str) -> Dict:
        checks = []

        master_ok = '#EXTM3U' in manifest_content and '#EXT-X-STREAM-INF' in manifest_content
        checks.append({
            'id': 'master-manifest',
            'label': 'Master manifest declares HLS variants',
            'status': 'passed' if master_ok else 'failed'
        })

        variant_outputs = [output for output in outputs if output.get('profile') != 'master']
        for output in variant_outputs:
            profile = output.get('profile')
            variant_dir = os.path.join(tmpdir, profile)
            playlist_path = os.path.join(variant_dir, 'playlist.m3u8')
            segments = [name for name in os.listdir(variant_dir)] if os.path.exists(variant_dir) else []
            segment_count = len([name for name in segments if name.endswith('.ts')])
            playlist_ok = os.path.exists(playlist_path) and segment_count > 0

            checks.append({
                'id': f'{profile}-playlist',
                'label': f'{profile} playlist and segments exist',
                'status': 'passed' if playlist_ok else 'failed',
                'segmentCount': segment_count
            })

        return {
            'status': 'passed' if all(check['status'] == 'passed' for check in checks) else 'failed',
            'target': 'HLS VOD',
            'checkedAt': self.now_iso(),
            'checks': checks
        }

    def update_phase(
        self,
        job_id: str,
        status: str,
        phase: str,
        progress: int,
        metadata: Dict = None,
        probe: Dict = None
    ):
        mapping = {
            'status': status,
            'phase': phase,
            'progress': str(progress),
            'updated_at': self.now_iso(),
        }

        if metadata:
            mapping.update({
                'profile_id': metadata.get('profileId') or '',
                'profile_name': metadata.get('profileName') or '',
                'cache_key': metadata.get('cacheKey') or '',
                'source_fingerprint': metadata.get('sourceFingerprint') or '',
                'plan': json.dumps(metadata.get('plan')) if metadata.get('plan') else '',
            })

        if probe:
            mapping['probe'] = json.dumps(probe)

        self.redis.hset(f"job:{job_id}", mapping=mapping)

    def notify_status(
        self,
        job_id: str,
        status: str,
        outputs: List = None,
        error: str = None,
        phase: str = None,
        progress: int = None,
        validation: Dict = None,
        provenance: Dict = None,
        probe: Dict = None
    ):
        """Store job status in Redis and optionally call webhook"""
        status_data = {
            'job_id': job_id,
            'status': status,
            'timestamp': time.time(),
            'outputs': outputs or [],
            'error': error
        }
        
        existing = self.redis.hgetall(f"job:{job_id}") or {}

        # Store in Redis
        self.redis.hset(f"job:{job_id}", mapping={
            'status': status,
            'phase': phase or status,
            'progress': str(progress if progress is not None else (100 if status == 'complete' else 0)),
            'outputs': json.dumps(outputs or []),
            'error': error or '',
            'validation': json.dumps(validation or {}),
            'provenance': json.dumps(provenance or {}),
            'probe': json.dumps(probe or {}),
            'updated_at': self.now_iso()
        })
        self.redis.expire(f"job:{job_id}", 86400 * 7)  # 7 days TTL

        cache_key = existing.get('cache_key') or (provenance or {}).get('cacheKey')
        if status == 'complete' and cache_key and outputs:
            self.redis.setex(
                f"transcodecache:v1:{cache_key}:outputs",
                86400 * 30,
                json.dumps(outputs)
            )
        
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
