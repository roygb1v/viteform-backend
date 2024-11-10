from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from forms.router import router as forms_router
from users.router import router as users_router
from feedback.router import router as feedback_router

app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.include_router(forms_router)
# app.include_router(users_router)
# app.include_router(feedback_router)

@app.get("/")
def root():
  return { "message": "Health endpoint all checks ok" }