from fastapi import FastAPI, HTTPException, UploadFile, File, Response
from fastapi.responses import RedirectResponse, FileResponse
from langserve import add_routes
from coach_bennett import chain as coach_bennett_chain
from openai import OpenAI
from pathlib import Path
import shutil

app = FastAPI()
client = OpenAI()

@app.get("/")
async def redirect_root_to_docs():
    return RedirectResponse("/docs")

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