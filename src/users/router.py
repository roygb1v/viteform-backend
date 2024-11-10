import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
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


@router.post('/',response_model=UserResponse,
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
  
  