#!/usr/bin/env python3
import time
import logging
from swarm_sdk import SwarmNode
from lyve_transcoder import LyveTranscoder

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('swarm-transcoder')

class SwarmTranscoder(LyveTranscoder):
    def __init__(self):
        super().__init__()
        self.swarm = SwarmNode(agent_id='transcoder-agent-1', capabilities=['transcode_video'])
        
        # Setup handlers
        self.swarm.on('task', self.handle_task)
        
    def run_agent(self):
        logger.info("🐝 Swarm Transcoder Agent starting...")
        self.swarm.join()
        
        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Stopping agent...")

    def handle_task(self, task):
        """Handle incoming swarm task"""
        if task.get('type') != 'transcode_video':
            return
            
        task_id = task.get('id')
        logger.info(f"👀 Spotted task {task_id}")
        
        # In a real agent, we might check CPU load here
        bid_score = 0.95 
        
        # Place bid
        self.swarm.bid_for_task(task_id, bid_score)
        
        # For this MVP, we are cheating: 
        # We assume if we bid, we get it immediately (self-assignment)
        # OR the Requester would send an "ASSIGN" message.
        # But looking at the current protocol, the Worker usually bids and waits.
        # However, to keep it compatible with the previous behavior (Process immediately),
        # let's just DO IT for now if we are the only one.
        # Ideally: Requester -> Task -> Worker -> Bid -> Requester -> Assign -> Worker -> Result
        # Current Protocol: Requester -> Task -> Worker -> Answer
        
        # Let's assume we just do it.
        try:
            logger.info(f"🎬 Starting processing for {task_id}")
            
            # Map Swarm task payload to LyveTranscoder job format
            # Payload likely contains { input_bucket, input_key... }
            job_data = task.get('payload', {})
            job_data['id'] = task_id # Ensure ID matches
            
            # Use parent class method to do the heavy lifting
            self.process_job(job_data)
            
            # The process_job method updates Redis status.
            # We should also emit Swarm result.
            # We can override notify_status or just emit here.
            
            # Since process_job doesn't return the output (it notifies internally),
            # we might want to capture it. 
            # But notify_status writes to Redis hash. 
            # Let's rely on notify_status side effect? 
            # No, let's look at `process_job` in lyve_transcoder.py. 
            # It calls `self.notify_status(job_id, 'complete', outputs=outputs)`.
            
            # Implementation Detail:
            # We could override `notify_status` to ALSO send swarm result!
            pass
            
        except Exception as e:
            logger.error(f"Failed to process task: {e}")
            self.swarm.submit_result(task_id, {'error': str(e)}, status='failure')

    def notify_status(self, job_id: str, status: str, outputs: list = None, error: str = None):
        """Override to also send Swarm result"""
        # Call original (updates Redis hash, webhook)
        super().notify_status(job_id, status, outputs, error)
        
        # Send Swarm result
        msg_status = 'success' if status == 'complete' else 'failure'
        result_payload = {'outputs': outputs, 'error': error}
        self.swarm.submit_result(job_id, result_payload, status=msg_status)


if __name__ == '__main__':
    agent = SwarmTranscoder()
    agent.run_agent()
