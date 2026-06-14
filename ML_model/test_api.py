import urllib.request
import json
import urllib.error

endpoints = [
    ("GET", "/api/health", None),
    ("GET", "/api/dashboard/overview", None),
    ("GET", "/api/dashboard/facility", None),
    ("GET", "/api/dashboard/workloads", None),
    ("GET", "/api/dashboard/grid", None),
    ("GET", "/api/dashboard/recommendation", None),
    ("POST", "/api/dashboard/simulate", {"action": "HYBRID"})
]

base_url = "http://localhost:8000"

for method, path, body in endpoints:
    url = base_url + path
    print(f"\n--- Testing {method} {url} ---")
    req = urllib.request.Request(url, method=method)
    req.add_header('Content-Type', 'application/json')
    if body:
        req.data = json.dumps(body).encode('utf-8')
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            data = response.read().decode('utf-8')
            print(f"Status Code: {status}")
            print(f"Response: {data[:500]}..." if len(data) > 500 else f"Response: {data}")
    except urllib.error.HTTPError as e:
        status = e.code
        data = e.read().decode('utf-8')
        print(f"Status Code: {status} (HTTPError)")
        print(f"Response: {data}")
    except Exception as e:
        print(f"Error: {e}")
