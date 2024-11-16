import os
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .forms.router import router as forms_router
from .users.router import router as users_router
from .feedback.router import router as feedback_router
from .preview.router import router as preview_router
from .results.router import router as results_router
from .constants import PUBLIC_PATHS
from supabase import create_client, Client
from dotenv import load_dotenv
load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def check_authorization_header(request: Request, call_next):
    path = request.url.path.split('/')
    if path[-1]:
        path = path[-1]
    else:
        path= path[-2]

    if path in PUBLIC_PATHS:
        return await call_next(request)

    auth_header = request.headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid authorization format. Use 'Bearer <token>'"}
        )

    jwt = auth_header.replace('Bearer ', '')

    if not jwt:
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid JWT token"}
        )

    try:
        user = supabase.auth.get_user(jwt)

        if not user:
            return JSONResponse(
                status_code=400,
                content={"detail": "Bad request"}
            )
        
        response = await call_next(request)
        return response

    except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)}
            )


app.include_router(forms_router)
app.include_router(results_router)
app.include_router(users_router)
app.include_router(feedback_router)
app.include_router(preview_router)

@app.get("/")
def root():
  return { "message": "Health endpoint all checks ok" }