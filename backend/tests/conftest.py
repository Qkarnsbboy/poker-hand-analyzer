# Lets the tests import main.py and models.py from the backend folder.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
