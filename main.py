import os
import shutil
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, File, UploadFile, Request, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse

from model_loader import (
    predict_image,
    predict_video,
    generate_camera_frames,
    stop_camera,
    get_current_cup_count,
    set_cup_count_callback
)
from database import SessionLocal, engine, Base
import crud
from report_generator import generate_excel_report, generate_pdf_report

# Создаем папки если их нет
os.makedirs("uploads", exist_ok=True)
os.makedirs("results", exist_ok=True)
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

# Инициализация FastAPI
app = FastAPI(
    title="Coffee Cup Counter API",
    description="API для автоматического подсчета кофейных чашек",
    version="1.0.0"
)

# Монтируем статические файлы и шаблоны
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Создаем таблицы в БД
Base.metadata.create_all(bind=engine)

# Список активных WebSocket соединений
active_connections: List[WebSocket] = []


async def broadcast_cup_count(count: int):
    """Отправить количество чашек всем подключенным клиентам"""
    message = json.dumps({"type": "cup_count", "count": count})
    for connection in active_connections:
        try:
            await connection.send_text(message)
        except:
            pass


# Устанавливаем callback для отправки данных через WebSocket
set_cup_count_callback(broadcast_cup_count)


# Зависимость для получения сессии БД
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# WebSocket endpoint для получения количества чашек в реальном времени
@app.websocket("/ws/cup-count")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    try:
        # Отправляем текущее количество при подключении
        current_count = get_current_cup_count()
        await websocket.send_json({"type": "cup_count", "count": current_count})

        # Держим соединение открытым
        while True:
            # Ждем любые сообщения от клиента (можно использовать для управления)
            data = await websocket.receive_text()
            # Можно обрабатывать команды от клиента здесь
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.remove(websocket)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Главная страница с загрузкой файлов"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/upload/image/")
async def upload_image(
        file: UploadFile = File(...),
        db: Session = Depends(get_db)
):
    """API для загрузки изображения и детекции чашек"""

    # Генерируем уникальное имя файла
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/{unique_filename}"

    # Сохраняем файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Запускаем предсказание
    try:
        result = predict_image(file_path)

        # Сохраняем результат в БД
        db_record = crud.create_detection_record(
            db=db,
            filename=unique_filename,
            file_type="image",
            objects_count=result["objects_count"],
            processing_time=result["processing_time"],
            detections=result["detections"],
            result_image_path=result["result_image_path"]
        )

        # Возвращаем результат
        return {
            "success": True,
            "filename": unique_filename,
            "objects_count": result["objects_count"],
            "processing_time": result["processing_time"],
            "detections": result["detections"],
            "result_image_url": f"/results/{Path(result['result_image_path']).name}",
            "record_id": db_record.id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки: {str(e)}")


@app.post("/api/upload/video/")
async def upload_video(
        file: UploadFile = File(...),
        db: Session = Depends(get_db)
):
    """API для загрузки видео и подсчета чашек по кадрам"""

    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/{unique_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        result = predict_video(file_path)

        db_record = crud.create_detection_record(
            db=db,
            filename=unique_filename,
            file_type="video",
            objects_count=result["average_count"],
            processing_time=result["processing_time"],
            detections=result["frame_stats"],
            result_video_path=result.get("result_video_path")
        )

        return {
            "success": True,
            "filename": unique_filename,
            "average_count": result["average_count"],
            "min_count": result["min_count"],
            "max_count": result["max_count"],
            "processing_time": result["processing_time"],
            "frame_stats": result["frame_stats"],
            "record_id": db_record.id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки: {str(e)}")


@app.get("/api/camera/stream")
async def camera_stream():
    """Потоковое видео с веб-камеры и детекцией в реальном времени"""

    # Используем генератор из model_loader
    return StreamingResponse(
        generate_camera_frames(camera_id=0, conf_threshold=0.5),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/camera/stop")
async def stop_camera_endpoint():
    """Остановить камеру"""
    stop_camera()
    return {"status": "camera stopped"}


@app.get("/api/history")
async def get_history(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """Получить историю обработок"""
    records = crud.get_detection_records(db, skip=skip, limit=limit)
    return records


@app.delete("/api/history/{record_id}")
async def delete_history_record(
        record_id: int,
        db: Session = Depends(get_db)
):
    """Удалить запись из истории"""
    success = crud.delete_detection_record(db, record_id)
    return {"success": success}


@app.get("/api/report/excel")
async def download_excel_report(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: Session = Depends(get_db)
):
    """Сгенерировать и скачать отчет в Excel"""
    records = crud.get_records_by_date(db, start_date, end_date)
    report_path = generate_excel_report(records)

    return FileResponse(
        report_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"coffee_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    )


@app.get("/api/report/pdf")
async def download_pdf_report(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: Session = Depends(get_db)
):
    """Сгенерировать и скачать отчет в PDF"""
    records = crud.get_records_by_date(db, start_date, end_date)
    report_path = generate_pdf_report(records)

    return FileResponse(
        report_path,
        media_type="application/pdf",
        filename=f"coffee_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    )


@app.get("/history", response_class=HTMLResponse)
async def history_page(request: Request, db: Session = Depends(get_db)):
    """Страница с историей запросов"""
    records = crud.get_detection_records(db, limit=50)
    return templates.TemplateResponse("history.html", {
        "request": request,
        "records": records
    })


@app.get("/report", response_class=HTMLResponse)
async def report_page(request: Request):
    """Страница генерации отчетов"""
    return templates.TemplateResponse("report.html", {"request": request})


@app.get("/results/{filename}")
async def get_result(filename: str):
    """Получить обработанное изображение/видео"""
    file_path = f"results/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Файл не найден")


@app.get("/uploads/{filename}")
async def get_upload(filename: str):
    """Получить оригинальный файл"""
    file_path = f"uploads/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Файл не найден")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
