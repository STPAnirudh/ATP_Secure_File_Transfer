import uvicorn
from backend.app.config import HTTP_HOST, HTTP_PORT

if __name__ == "__main__":
    print(f"Starting ATP Server on http://{HTTP_HOST}:{HTTP_PORT}...")
    uvicorn.run("backend.app.main:app", host=HTTP_HOST, port=HTTP_PORT, reload=False)
