import os
from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Dict
from pydantic import BaseModel

class UpdateUserSchema(BaseModel):
    password: str

load_dotenv()

router = APIRouter(
    prefix="/v1/email",
    tags=["email"],
    responses={
        404: {"description": "Email not found"},
        500: {"description": "Internal server error"}
    }
)

# Move these to environment setup/config file
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

# /v1/auth/reset-password-email
@router.get('/')
async def reset_password_email(email: str):
    try:
        # 1. Sends an email to the recipient with the access token
        response = supabase.auth.reset_password_email(email, {
          "redirect_to": "http://localhost:5173/password/update"
        })

        return {"success": True}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
