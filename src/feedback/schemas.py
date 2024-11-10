from pydantic import BaseModel
from typing import Literal, Any

class FeedbackResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None

class FeedbackModel(BaseModel):
  name: str
  email: str
  topic: str
  message: str
