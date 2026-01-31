import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Используем SQLite для простоты
SQLALCHEMY_DATABASE_URL = "sqlite:///./coffee_counter.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class DetectionRecord(Base):
    """Модель для хранения истории обработки"""
    __tablename__ = "detection_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_type = Column(String)  # 'image' или 'video'
    objects_count = Column(Integer)
    average_count = Column(Float, nullable=True)  # Для видео
    processing_time = Column(Float)
    detections = Column(JSON)  # Детальная информация о детекциях
    result_image_path = Column(String, nullable=True)
    result_video_path = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "file_type": self.file_type,
            "objects_count": self.objects_count,
            "average_count": self.average_count,
            "processing_time": self.processing_time,
            "timestamp": self.timestamp.isoformat(),
            "detections_count": len(self.detections) if self.detections else 0
        }
