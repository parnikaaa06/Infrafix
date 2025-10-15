import os
from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import shutil
import uuid

# Directories
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)

# FastAPI app
app = FastAPI(title="InfraFix API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Simple health check endpoint"""
    return {"status": "ok"}

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Accepts an image, saves it, applies mock AI processing, returns processed image"""
    try:
        # Save uploaded file to uploads/
        file_ext = Path(file.filename).suffix
        file_id = f"{uuid.uuid4().hex}{file_ext}"
        upload_path = UPLOAD_DIR / file_id

        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Open image with Pillow
        img = Image.open(upload_path)

        # ------------------------
        # Mock AI Processing
        # Replace this block with real AI inference
        # ------------------------
        processed_img = img.filter(ImageFilter.SHARPEN)  # Example: sharpen
        draw = ImageDraw.Draw(processed_img)
        font = None
        try:
            font = ImageFont.truetype("arial.ttf", 24)
        except:
            font = ImageFont.load_default()
        draw.text((10, 10), "InfraFix AI Preview", fill="red", font=font)
        # ------------------------

        processed_path = PROCESSED_DIR / file_id
        processed_img.save(processed_path)

        # Return processed file as response
        return FileResponse(
            processed_path,
            media_type="image/png",
            filename=f"processed_{file.filename}"
        )

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
