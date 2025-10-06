import requests
import sys

# The URL of our running FastAPI backend
BACKEND_URL = "http://localhost:8000/get-audio-url"

# A standard, public YouTube video to test with
TEST_YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

def run_integration_test():
    """
    Calls the live backend server to ensure it's running and responding correctly.
    """
    print("--- Running Integration Health Check ---")
    print(f"Attempting to connect to backend at: {BACKEND_URL}")

    try:
        response = requests.post(BACKEND_URL, json={"url": TEST_YOUTUBE_URL}, timeout=30)

        if response.status_code == 200:
            print("✅ SUCCESS: Backend responded with 200 OK.")
            data = response.json()
            if "audioUrl" in data and data["audioUrl"]:
                print("✅ SUCCESS: Response contains a valid 'audioUrl'.")
                print("Integration test passed!")
                sys.exit(0)
            else:
                print("❌ FAILURE: Response did not contain a valid 'audioUrl'.")
                print(f"Response JSON: {data}")
                sys.exit(1)
        else:
            print(f"❌ FAILURE: Backend responded with status code {response.status_code}.")
            print(f"Response: {response.text}")
            sys.exit(1)

    except requests.exceptions.ConnectionError:
        print("\n❌ FAILURE: Could not connect to the backend.")
        print("Please ensure the FastAPI server is running in a separate terminal:")
        print("  uvicorn main:app --reload")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ FAILURE: An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_integration_test()
