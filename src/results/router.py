import os
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client
from .schemas import FormResultsResponse
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(
  prefix="/v1/results",
  tags=["results"],
  responses={404: {"description": "Not found"}}
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

@router.get("/",
  response_model=FormResultsResponse,
  responses={
    404: {"description": "Form not found"},
    400: {"description": "Invalid form data"}
  }
)
def get_form(id: str) -> FormResultsResponse:
  try:
    response = supabase.table("form_configs").select("*").eq("id", id).limit(1).execute()
    if not response.data:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Form with id {form_config.id} not found"
      )
    
    return FormResultsResponse(
      status="success",
      data=response.data,
      message="Successfully retrieved form"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )