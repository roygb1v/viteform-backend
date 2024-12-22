import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from supabase import create_client, Client
from .schemas import UserModel, UserResponse
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(
  prefix="/v1/users",
  tags=["users"],
  responses={404: {"description": "Not found"}}
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)


@router.post('/signup',response_model=UserResponse,
  responses={
    400: {"description": "Invalid user data"}
  }
)
def register_user(user: UserModel):
  try:
    response = supabase.auth.sign_up(
      {
          "email": user.email,
          "password": user.password,
          "options": { "data": {"first_name": user.name} },
      })

    return UserResponse(
      status="success",
      message="User created successfully"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )

@router.post("/login", response_model=UserResponse,
  responses={
    400: {"description": "Invalid user data"},
    500: {"description": "Server error"}
  }
)
def login(user: UserModel):
  try:
    response = supabase.auth.sign_in_with_password(
    {"email": user.email, "password": user.password}
)

    if not user:
      raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Incorrect email or password"
      )
  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )
  
  return UserResponse(
    status="success",
    data=response,
    message="Login successful"
  )


@router.post("/logout", response_model=UserResponse,
  responses={
    400: {"description": "Invalid user data"},
    500: {"description": "Server error"}
  }
)
def logout(request: Request):
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
      user = supabase.auth.sign_out(jwt)

      return UserResponse(
          status="success",
          data=user,
          message="success"
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)}
        )


@router.get("/me", response_model=UserResponse,
  responses={
    400: {"description": "Invalid user data"},
    500: {"description": "Server error"}
  }
)
def get_user(request: Request):
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
        
        return UserResponse(
          status="success",
          data=user,
          message="success"
        )

    except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)}
            )
