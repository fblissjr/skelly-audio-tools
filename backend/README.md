# BOB the Skelly - Backend

This directory contains the Python FastAPI server that provides backend services for the main application.

## Running the Server

1.  Create a virtual environment: `uv venv`
2.  Activate it: `source .venv/bin/activate`
3.  Install dependencies: `uv pip install -r requirements.txt`
4.  Run the server: `uvicorn main:app --reload --host 0.0.0.0`

## API Documentation

This server uses FastAPI, which automatically generates interactive API documentation using the OpenAPI standard.

Once the server is running, you can access the documentation at the following endpoints:

*   **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
*   **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
