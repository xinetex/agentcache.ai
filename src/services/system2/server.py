
import http.server
import socketserver
import json
import time

PORT = 8085

class AoTHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/reason':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                prompt = data.get('prompt', '')
                
                # --- Atom of Thoughts (AoT) Logic Simulation ---
                # In a full production deployment, this would load the AoT model
                # and perform the Markov Chain reasoning.
                # Here we simulate the "Atomic State" contraction and expansion.
                
                print(f"[System2] Received prompt: {prompt[:50]}...")
                
                reasoning_trace = []
                
                # Step 1: Decompose (Simulated)
                reasoning_trace.append({
                    "step": 1,
                    "action": "Decomposition",
                    "thought": "This problem is complex. Breaking it down into atomic states.",
                    "atomic_state": "analyzing_complexity"
                })
                
                # Step 2: Reason (Simulated)
                reasoning_trace.append({
                    "step": 2,
                    "action": "Reasoning",
                    "thought": f"Analyzing '{prompt}'. This requires deep logical inference regarding constraints and historical context.",
                    "atomic_state": "inferring_logic"
                })
                
                # Step 3: Contract (Simulated)
                reasoning_trace.append({
                    "step": 3,
                    "action": "Contraction",
                    "thought": "Compressing reasoning chain into final solution state.",
                    "atomic_state": "solution_ready"
                })
                
                response = {
                    "status": "success",
                    "engine": "Atom of Thoughts (v0.1-proto)",
                    "trace": reasoning_trace,
                    "final_answer": f"Analysis complete for: {prompt}. Solution derived via 3 atomic states."
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {"error": str(e)}
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    print(f"Starting System 2 (AoT) Server on port {PORT}...")
    with ReusableTCPServer(("", PORT), AoTHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down System 2 Server...")
            httpd.server_close()
