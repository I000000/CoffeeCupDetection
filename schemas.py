from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class DetectionRecordBase(BaseModel):
    filename: str
    file_type: str
    objects_count: int
    processing_time: float


class DetectionRecordCreate(DetectionRecordBase):
    detections: Optional[List[Dict[str, Any]]] = None
    result_image_path: Optional[str] = None
    result_video_path: Optional[str] = None


class DetectionRecord(DetectionRecordBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    report_type: str  # 'pdf' / 'excel'
