from typing import Any, List, Dict, Optional, Literal
from pydantic import BaseModel

class FormResultsResponse(BaseModel):
  status: Literal["success", "error"]
  data: Any | None = None
  message: str | None = None

class OptionSchema(BaseModel):
    value: str
    label: str

class RuleSchema(BaseModel):
    required: Any
    minLength: Any = None
    maxLength: Any = None
    min: Any = None
    max: Any = None
    pattern: Any = None

class Result(BaseModel):
  count: int | None
  total: int | None
  responses: List[str] | None
  url: str

class QuestionSchema(BaseModel):
  id: str
  name: str
  type: str
  title: str
  description: str
  options: Optional[List[OptionSchema]] = None
  result: Result
  rules: RuleSchema | None

class StepSchema(BaseModel):
  id: str
  questions: List[QuestionSchema]

#[TODO]
class FormResultsSchema(BaseModel):
  id: str
  steps: List[StepSchema]
