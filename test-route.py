#!/usr/bin/env python3
"""Test the tile route by starting the backend server and making a request."""
import subprocess
import time
import requests
import sys
import os

os.chdir('E:\\BST_lab\\greenproject\\greenway-backend')

# Start the backend server
print("Starting backend server...")
server_process = subprocess.Popen(
    [sys.executable, '-m', 'subprocess', 'python3 -c "import subprocess; subprocess.run([\'node\', \'src/index.js\'])"'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Actually, let's try running node directly
server_process = subprocess.Popen(
    ['node', 'src/index.js'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

# Wait for server to start
print("Waiting for server to start...")
time.sleep(5)

try:
    # Test the route
    print("\nTesting route: http://127.0.0.1:3001/api/tiles/gaode/8/1/1/1")
    response = requests.get('http://127.0.0.1:3001/api/tiles/gaode/8/1/1/1', timeout=10)
    
    print("\n=== RESULT ===")
    print(f"HTTP Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
    print("===============\n")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    # Kill the server process
    print("Stopping server...")
    server_process.terminate()
    try:
        server_process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server_process.kill()
