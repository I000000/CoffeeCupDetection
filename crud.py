from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from database import DetectionRecord


def create_detection_record(
    db: Session,
    filename: str,
    file_type: str,
    objects_count: int,
    processing_time: float,
    detections: Optional[List[dict]] = None,
    result_image_path: Optional[str] = None,
    result_video_path: Optional[str] = None,
    average_count: Optional[float] = None
):
    """Создать запись о детекции"""
    db_record = DetectionRecord(
        filename=filename,
        file_type=file_type,
        objects_count=objects_count,
        average_count=average_count,
        processing_time=processing_time,
        detections=detections or [],
        result_image_path=result_image_path,
        result_video_path=result_video_path
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_detection_records(db: Session, skip: int = 0, limit: int = 100):
    """Получить записи детекций"""
    return db.query(DetectionRecord) \
        .order_by(DetectionRecord.timestamp.desc()) \
        .offset(skip) \
        .limit(limit) \
        .all()


def get_records_by_date(
    db: Session,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Получить записи за определенный период"""
    query = db.query(DetectionRecord)

    if start_date:
        # Преобразуем строку в datetime
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(DetectionRecord.timestamp >= start)
        except ValueError:
            pass  # Можно добавить логирование ошибки

    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(DetectionRecord.timestamp <= end)
        except ValueError:
            pass

    return query.order_by(DetectionRecord.timestamp.desc()).all()


def delete_detection_record(db: Session, record_id: int):
    """Удалить запись детекции"""
    record = db.query(DetectionRecord).filter(DetectionRecord.id == record_id).first()
    if record:
        db.delete(record)
        db.commit()
        return True
    return False
