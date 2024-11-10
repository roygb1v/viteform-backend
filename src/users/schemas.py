from pydantic import BaseModel
from typing import Literal, Any

class UserResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None

class UserModel(BaseModel):
  name: str
  email: str
  password: str
