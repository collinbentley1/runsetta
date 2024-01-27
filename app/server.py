from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Form
from fastapi.responses import RedirectResponse, FileResponse, JSONResponse
from langserve import add_routes
from pydantic import BaseModel  # Import BaseModel from pydantic
from coach_bennett import chain as coach_bennett_chain
from openai import OpenAI
from pathlib import Path
import shutil
import requests
import os
from dotenv import load_dotenv

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

app = FastAPI()
client = OpenAI()

@app.get("/")
async def redirect_root_to_docs():
    return RedirectResponse("/docs")

class TokenRequestForm(BaseModel):
    code: str = None
    refresh_token: str = None

@app.post("/api/token")
async def token_swap(form_data: TokenRequestForm):
    if not form_data.code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    auth_response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "authorization_code",
            "code": form_data.code,
            "redirect_uri": "hypercoach://spotify-login-callback",
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        },
    )

    if auth_response.status_code != 200:
        raise HTTPException(status_code=auth_response.status_code, detail="Spotify token exchange failed")

    return JSONResponse(content=auth_response.json())

@app.post("/api/refresh_token")
async def token_refresh(form_data: TokenRequestForm):
    if not form_data.refresh_token:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    auth_response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": form_data.refresh_token,
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        },
    )

    if auth_response.status_code != 200:
        raise HTTPException(status_code=auth_response.status_code, detail="Spotify token refresh failed")

    return JSONResponse(content=auth_response.json())

class AudioRequest(BaseModel):
    input_text: str

@app.post("/audio")
async def text_to_speech(audio_request: AudioRequest):
    input_text = audio_request.input_text
    try:
        response = client.audio.speech.create(
            model="tts-1-hd",
            voice="alloy",
            input=input_text,
            response_format="aac"
        )
        speech_file_path = Path(__file__).parent / "speech.aac"
        response.stream_to_file(speech_file_path)

        return FileResponse(speech_file_path, media_type="audio/aac", filename="speech.aac")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Langchain template routes
add_routes(app, coach_bennett_chain, path="/coach-bennett")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)