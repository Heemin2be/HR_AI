from database import engine, Base
from models import *

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("All tables dropped. Restart the server to recreate them.")
