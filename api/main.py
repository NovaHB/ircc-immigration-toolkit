import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admissions

load_dotenv()

app = FastAPI(title="IRCC Immigration Toolkit API")

# Local Vite default is 5173; earlier sessions also used 2205.
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admissions.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
