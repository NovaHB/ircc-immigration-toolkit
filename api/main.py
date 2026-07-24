import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admissions, candidates

load_dotenv()

app = FastAPI(title="IRCC Immigration Toolkit API")

# Comma-separated list supported so Netlify + local Vite can both call the API.
# Example: https://ircc-immigration-toolkit.netlify.app,http://localhost:5173
frontend_urls = [
    u.strip()
    for u in os.environ.get("FRONTEND_URL", "http://localhost:5173").split(",")
    if u.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_urls,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admissions.router)
app.include_router(candidates.router)


@app.get("/")
def health_check():
    return {"status": "ok"}
