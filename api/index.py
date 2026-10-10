import os
import sys

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Initialize database directory for Vercel writable tmp if in serverless environment
if os.environ.get("VERCEL"):
    os.environ["HITCHSAFE_DB_PATH"] = "/tmp/hitchsafe.db"

from app.main import app
from app.database import init_db

# Ensure SQLite tables and seeds are initialized in serverless runtime
try:
    init_db()
except Exception as e:
    print(f"Serverless DB init note: {e}")
