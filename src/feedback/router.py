import os
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import create_client, Client
from .schemas import FeedbackModel, FeedbackResponse
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(
  prefix="/v1/feedback",
  tags=["feedback"],
  responses={404: {"description": "Not found"}}
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)


@router.post('/',response_model=FeedbackResponse,
  responses={
    400: {"description": "Invalid feedback data"}
  }
)
def submit_feedback(feedback: FeedbackModel):
  try:
    response = supabase.table("feedback").insert({ **feedback.dict() }).execute()

    return FeedbackResponse(
      status="success",
      message="Feedback created successfully"
    )

  except Exception as e:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail=str(e)
    )
  