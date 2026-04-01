#!/usr/bin/env python3
"""
Python bridge script for uploading audio files to Modal.run from Unity.
REQUIRES: pip install requests
Place this file in your Unity project root directory.
"""

import sys
import json
import os
import time

try:
    import requests
    from requests.adapters import HTTPAdapter
    from requests.packages.urllib3.util.retry import Retry
    from requests.packages.urllib3.exceptions import InsecureRequestWarning
    requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
except ImportError:
    print(json.dumps({
        "error": "requests module not installed. Run: pip install requests",
        "success": False
    }))
    sys.exit(1)

def create_retry_session():
    """Create a requests session with retry logic."""
    session = requests.Session()
    retry = Retry(
        total=3,
        read=3,
        connect=3,
        backoff_factor=0.3,
        status_forcelist=(500, 502, 504)
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session

def test_endpoint(api_url):
    """Test what the endpoint expects."""
    try:
        session = create_retry_session()
        
        # Try GET first to see what it says
        print(f"Testing GET request to: {api_url}", file=sys.stderr)
        response = session.get(api_url, timeout=10, verify=False)
        print(f"GET Response status: {response.status_code}", file=sys.stderr)
        print(f"GET Response: {response.text}", file=sys.stderr)
        
        return {
            "get_status": response.status_code,
            "get_response": response.text
        }
    except Exception as e:
        return {"error": str(e)}

def upload_audio(file_path, api_url):
    """Upload audio file to Modal.run API and return the chart data."""
    
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}", "success": False}
    
    try:
        # Get file size
        file_size = os.path.getsize(file_path)
        print(f"Uploading file: {file_path} ({file_size / 1024 / 1024:.2f} MB)", file=sys.stderr)
        
        # Create session with retry logic
        session = create_retry_session()
        
        # Open and upload the file
        with open(file_path, 'rb') as audio_file:
            files = {'audio_file': (os.path.basename(file_path), audio_file, 'audio/mpeg')}
            
            print(f"Sending request to: {api_url}", file=sys.stderr)
            print("This may take several minutes for large files...", file=sys.stderr)
            
            start_time = time.time()
            
            # Try with verify=False first (SSL issues)
            try:
                response = session.post(
                    api_url,
                    files=files,
                    timeout=900,
                    verify=False,
                    allow_redirects=True  # Follow redirects
                )
            except requests.exceptions.SSLError:
                print("SSL error with verify=False, trying with system CA bundle...", file=sys.stderr)
                # If that fails, try with verify=True
                response = session.post(
                    api_url,
                    files=files,
                    timeout=900,
                    verify=True,
                    allow_redirects=True
                )
            
            elapsed = time.time() - start_time
            
            print(f"Response received after {elapsed:.1f} seconds", file=sys.stderr)
            print(f"Response status: {response.status_code}", file=sys.stderr)
            print(f"Response headers: {dict(response.headers)}", file=sys.stderr)
            
            if response.status_code == 200:
                chart_data = response.text
                print(f"Received {len(chart_data)} bytes of chart data", file=sys.stderr)
                
                # Show preview of response
                preview = chart_data[:200] if len(chart_data) > 200 else chart_data
                print(f"Response preview: {preview}...", file=sys.stderr)
                
                return {
                    "success": True,
                    "chart_data": chart_data,
                    "status_code": response.status_code,
                    "elapsed_time": elapsed
                }
            else:
                error_msg = response.text[:500] if response.text else "No response body"
                print(f"Error response: {error_msg}", file=sys.stderr)
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {error_msg}",
                    "status_code": response.status_code
                }
                
    except requests.exceptions.Timeout:
        return {"error": "Request timeout - processing took too long (>15 min)", "success": False}
    except requests.exceptions.ConnectionError as e:
        error_details = str(e)
        print(f"Connection error details: {error_details}", file=sys.stderr)
        
        # Check if it's specifically an SSL error
        if "SSL" in error_details or "ssl" in error_details.lower():
            return {
                "error": f"SSL/TLS handshake failed. This might be a Windows SSL issue. Error: {error_details}",
                "success": False,
                "suggestion": "Try: pip install --upgrade certifi or update Python"
            }
        return {"error": f"Connection error: {error_details}", "success": False}
    except requests.exceptions.RequestException as e:
        return {"error": f"Request error: {type(e).__name__}: {str(e)}", "success": False}
    except Exception as e:
        return {"error": f"Unexpected error: {type(e).__name__}: {str(e)}", "success": False}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python upload_to_modal.py <audio_file_path> [api_url]",
            "success": False
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    # Special test mode to check API endpoints
    if audio_path == "test":
        api_url = sys.argv[2] if len(sys.argv) > 2 else "https://ultrarapid--combined-audio-analysis-v1-fastapi-app.modal.run"
        print("Testing API endpoints...", file=sys.stderr)
        
        # Test health endpoint
        result = test_endpoint(f"{api_url}/health")
        print(f"Health check: {result}", file=sys.stderr)
        
        # Test API info
        result = test_endpoint(f"{api_url}/api/info")
        print(f"API info: {result}", file=sys.stderr)
        
        print(json.dumps({"test": "completed"}))
        sys.exit(0)
    
    api_url = sys.argv[2] if len(sys.argv) > 2 else "https://ultrarapid--combined-audio-analysis-v1-fastapi-app.modal.run/api/analyze"
    
    result = upload_audio(audio_path, api_url)
    
    # Output JSON result to stdout (Unity will read this)
    print(json.dumps(result))
    
    sys.exit(0 if result.get("success") else 1)