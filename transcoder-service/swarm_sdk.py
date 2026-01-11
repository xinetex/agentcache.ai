import os
import json
import time
import uuid
import threading
import logging
import redis
import hmac
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('swarm-sdk')

class SwarmNode:
    def __init__(self, agent_id=None, capabilities=None, redis_url=None):
        self.agent_id = agent_id or str(uuid.uuid4())
        self.capabilities = capabilities or []
        
        url = redis_url or os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_URL')
        if not url:
            raise ValueError("REDIS_URL is required")
            
        self.redis = redis.from_url(url, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        self.handlers = {} # event -> callback
        self.listening = False
        
        # Security
        self.secret_key = os.environ.get('SWARM_SECRET_KEY', 'default-insecure-dev-key')
        if self.secret_key == 'default-insecure-dev-key':
            logger.warning("⚠️  Using default SWARM_SECRET_KEY!")

    def join(self):
        """Subscribe to task channels"""
        self.pubsub.subscribe('swarm:tasks')
        self.pubsub.subscribe('swarm:results')
        
        # Start listener thread
        self.listening = True
        self.thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.thread.start()
        
        logger.info(f"[Swarm] Agent {self.agent_id} joined with capabilities: {self.capabilities}")

    def _listen_loop(self):
        logger.info("[Swarm] Listener thread started")
        for message in self.pubsub.listen():
            if not self.listening:
                break
                
            if message['type'] == 'message':
                channel = message['channel']
                data_str = message['data']
                try:
                    data = json.loads(data_str)
                    
                    if channel == 'swarm:tasks':
                        if self._verify_task(data):
                            self._emit('task', data)
                    elif channel == 'swarm:results':
                        self._emit('result', data)
                    elif ':bids' in channel:
                        self._emit('bid', data)
                        
                except json.JSONDecodeError:
                    logger.error(f"[Swarm] Failed to parse message: {data_str}")
                except Exception as e:
                    logger.error(f"[Swarm] Error processing message: {e}")

    def on(self, event, callback):
        """Register event handler"""
        self.handlers[event] = callback

    def _emit(self, event, data):
        if event in self.handlers:
            try:
                self.handlers[event](data)
            except Exception as e:
                logger.error(f"[Swarm] Error in handler for {event}: {e}")

    def _sign_task(self, task):
        """Generate HMAC signature for task"""
        # ID + TYPE + PAYLOAD(str) + TIMESTAMP + REQUESTER
        payload_str = json.dumps(task.get('payload', {}))
        data = f"{task['id']}:{task['type']}:{payload_str}:{task['timestamp']}:{task['requester']}"
        
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature

    def _verify_task(self, task):
        """Verify task signature and timestamp"""
        if 'signature' not in task:
            logger.warning(f"🛑 Dropped unsigned task: {task.get('id')}")
            return False
            
        expected = self._sign_task(task)
        if not hmac.compare_digest(expected, task['signature']):
            logger.warning(f"🛑 Dropped invalid signature: {task.get('id')}")
            return False
            
        # Replay protection (5 mins)
        if time.time() * 1000 - task['timestamp'] > 300000:
            logger.warning(f"🛑 Dropped expired task: {task.get('id')}")
            return False
            
        return True

    def broadcast_task(self, task_type, payload, priority=1):
        """Broadcast a task to the swarm"""
        task_id = str(uuid.uuid4())
        task = {
            'id': task_id,
            'type': task_type,
            'payload': payload,
            'priority': priority,
            'requester': self.agent_id,
            'timestamp': int(time.time() * 1000)
        }
        
        # Sign the task
        task['signature'] = self._sign_task(task)
        
        # Subscribe to bids BEFORE publishing (simple sync subscription)
        self.pubsub.subscribe(f"swarm:task:{task_id}:bids")
        
        self.redis.publish('swarm:tasks', json.dumps(task))
        self.redis.lpush('swarm:queue:pending', json.dumps(task))
        
        return task_id

    def bid_for_task(self, task_id, score):
        """Submit a bid for a task"""
        bid = {
            'taskId': task_id,
            'agentId': self.agent_id,
            'bidScore': score,
            'timestamp': time.time() * 1000
        }
        self.redis.publish(f"swarm:task:{task_id}:bids", json.dumps(bid))
        logger.info(f"[Swarm] Placed bid on {task_id} (score: {score})")

    def submit_result(self, task_id, result, status='success'):
        """Submit a result for a completed task"""
        res = {
            'taskId': task_id,
            'agentId': self.agent_id,
            'result': result,
            'status': status,
            'timestamp': time.time() * 1000
        }
        
        self.redis.publish('swarm:results', json.dumps(res))
        self.redis.setex(f"swarm:task:{task_id}:result", 3600, json.dumps(res))
        logger.info(f"[Swarm] Submitted result for {task_id}")

import json
import time
import uuid
import threading
import logging
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('swarm-sdk')

class SwarmNode:
    def __init__(self, agent_id=None, capabilities=None, redis_url=None):
        self.agent_id = agent_id or str(uuid.uuid4())
        self.capabilities = capabilities or []
        
        url = redis_url or os.environ.get('REDIS_URL') or os.environ.get('UPSTASH_REDIS_URL')
        if not url:
            raise ValueError("REDIS_URL is required")
            
        self.redis = redis.from_url(url, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        self.handlers = {} # event -> callback
        self.listening = False

    def join(self):
        """Subscribe to task channels"""
        self.pubsub.subscribe('swarm:tasks')
        self.pubsub.subscribe('swarm:results')
        
        # Start listener thread
        self.listening = True
        self.thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.thread.start()
        
        logger.info(f"[Swarm] Agent {self.agent_id} joined with capabilities: {self.capabilities}")

    def _listen_loop(self):
        logger.info("[Swarm] Listener thread started")
        for message in self.pubsub.listen():
            if not self.listening:
                break
                
            if message['type'] == 'message':
                channel = message['channel']
                data_str = message['data']
                try:
                    data = json.loads(data_str)
                    
                    if channel == 'swarm:tasks':
                        self._emit('task', data)
                    elif channel == 'swarm:results':
                        self._emit('result', data)
                    elif ':bids' in channel:
                        self._emit('bid', data)
                        
                except json.JSONDecodeError:
                    logger.error(f"[Swarm] Failed to parse message: {data_str}")
                except Exception as e:
                    logger.error(f"[Swarm] Error processing message: {e}")

    def on(self, event, callback):
        """Register event handler"""
        self.handlers[event] = callback

    def _emit(self, event, data):
        if event in self.handlers:
            try:
                self.handlers[event](data)
            except Exception as e:
                logger.error(f"[Swarm] Error in handler for {event}: {e}")

    def broadcast_task(self, task_type, payload, priority=1):
        """Broadcast a task to the swarm"""
        task_id = str(uuid.uuid4())
        task = {
            'id': task_id,
            'type': task_type,
            'payload': payload,
            'priority': priority,
            'requester': self.agent_id,
            'timestamp': time.time() * 1000
        }
        
        # Subscribe to bids BEFORE publishing (simple sync subscription)
        # Note: In a threaded listener, we need to add subscription dynamically
        self.pubsub.subscribe(f"swarm:task:{task_id}:bids")
        
        self.redis.publish('swarm:tasks', json.dumps(task))
        self.redis.lpush('swarm:queue:pending', json.dumps(task))
        
        return task_id

    def bid_for_task(self, task_id, score):
        """Submit a bid for a task"""
        bid = {
            'taskId': task_id,
            'agentId': self.agent_id,
            'bidScore': score,
            'timestamp': time.time() * 1000
        }
        self.redis.publish(f"swarm:task:{task_id}:bids", json.dumps(bid))
        logger.info(f"[Swarm] Placed bid on {task_id} (score: {score})")

    def submit_result(self, task_id, result, status='success'):
        """Submit a result for a completed task"""
        res = {
            'taskId': task_id,
            'agentId': self.agent_id,
            'result': result,
            'status': status,
            'timestamp': time.time() * 1000
        }
        
        self.redis.publish('swarm:results', json.dumps(res))
        self.redis.setex(f"swarm:task:{task_id}:result", 3600, json.dumps(res))
        logger.info(f"[Swarm] Submitted result for {task_id}")
