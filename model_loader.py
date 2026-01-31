import cv2
import numpy as np
from ultralytics import YOLO
import time
import asyncio
from typing import Dict, Any, Callable, Optional
from pathlib import Path
import threading


class ModelLoader:
    """Класс для загрузки и использования модели YOLO"""

    def __init__(self, model_path: str = "models/best.pt"):
        self.model_path = model_path
        self.model = None
        self.load_model()
        self.camera = None
        self.is_running = False

        # Переменные для подсчета чашек
        self.current_cup_count = 0
        self.cup_count_callback = None
        self.lock = threading.Lock()

    def load_model(self):
        """Загрузить модель YOLO"""
        print(f"Загрузка модели из {self.model_path}...")
        self.model = YOLO(self.model_path)
        print("Модель успешно загружена!")

    def set_cup_count_callback(self, callback: Callable[[int], None]):
        """Установить callback для отправки количества чашек"""
        self.cup_count_callback = callback

    def update_cup_count(self, count: int):
        """Обновить количество чашек и отправить через callback"""
        with self.lock:
            self.current_cup_count = count

        # Отправляем через callback если он установлен
        if self.cup_count_callback:
            # Запускаем в отдельном потоке, чтобы не блокировать детекцию
            def send_count():
                asyncio.run(self.cup_count_callback(count))

            # Используем threading для асинхронной отправки
            thread = threading.Thread(target=send_count, daemon=True)
            thread.start()

    def get_current_cup_count(self) -> int:
        """Получить текущее количество чашек"""
        with self.lock:
            return self.current_cup_count

    def predict_image(self, image_path: str, conf_threshold: float = 0.5) -> Dict[str, Any]:
        """Обработать одно изображение"""
        start_time = time.time()

        # Выполняем предсказание
        results = self.model.predict(
            source=image_path,
            conf=conf_threshold,
            save=False,
            verbose=False
        )

        # Обрабатываем результаты
        detections = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = box.conf[0].cpu().numpy()
                    cls = int(box.cls[0].cpu().numpy())

                    detections.append({
                        "bbox": [float(x1), float(y1), float(x2), float(y2)],
                        "confidence": float(conf),
                        "class": cls
                    })

        # Аннотируем изображение
        annotated_img = results[0].plot()

        # Сохраняем результат
        result_filename = f"result_{Path(image_path).stem}.jpg"
        result_path = f"results/{result_filename}"
        cv2.imwrite(result_path, annotated_img)

        processing_time = time.time() - start_time

        return {
            "objects_count": len(detections),
            "detections": detections,
            "processing_time": processing_time,
            "result_image_path": result_path
        }

    def predict_video(self, video_path: str, conf_threshold: float = 0.5) -> Dict[str, Any]:
        """Обработать видео файл"""
        start_time = time.time()

        # Открываем видео
        cap = cv2.VideoCapture(video_path)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        frame_stats = []
        frame_results = []

        # Обрабатываем каждый N-ый кадр для скорости
        frame_skip = max(1, int(fps / 2))  # 2 кадра в секунду

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_skip == 0:
                # Обрабатываем кадр
                results = self.model.predict(
                    source=frame,
                    conf=conf_threshold,
                    save=False,
                    verbose=False
                )

                detections = []
                for result in results:
                    if result.boxes is not None:
                        detections.extend([
                            {
                                "bbox": box.xyxy[0].cpu().numpy().tolist(),
                                "confidence": float(box.conf[0].cpu().numpy()),
                                "class": int(box.cls[0].cpu().numpy())
                            }
                            for box in result.boxes
                        ])

                frame_stats.append({
                    "frame": frame_idx,
                    "time": frame_idx / fps,
                    "count": len(detections),
                    "detections": detections
                })

                # Аннотируем кадр
                if results[0].boxes is not None:
                    annotated_frame = results[0].plot()
                    frame_results.append(annotated_frame)

            frame_idx += 1

        cap.release()

        # Сохраняем обработанное видео
        if frame_results:
            result_video_path = f"results/result_{Path(video_path).stem}.mp4"
            height, width = frame_results[0].shape[:2]

            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(result_video_path, fourcc, fps / frame_skip, (width, height))

            for frame in frame_results:
                out.write(frame)
            out.release()
        else:
            result_video_path = None

        # Анализируем статистику
        counts = [stat["count"] for stat in frame_stats]

        processing_time = time.time() - start_time

        return {
            "average_count": np.mean(counts) if counts else 0,
            "min_count": np.min(counts) if counts else 0,
            "max_count": np.max(counts) if counts else 0,
            "frame_stats": frame_stats,
            "processing_time": processing_time,
            "result_video_path": result_video_path
        }

    def generate_frames(self, camera_id: int = 0, conf_threshold: float = 0.5):
        """
        Генератор для потоковой обработки видео с веб-камеры.
        Возвращает кадры в формате JPEG для MJPEG потока.
        """
        # Открываем камеру
        self.camera = cv2.VideoCapture(camera_id)

        if not self.camera.isOpened():
            print(f"Камера {camera_id} не доступна, пробуем ID 1...")
            self.camera = cv2.VideoCapture(1)

        if not self.camera.isOpened():
            print("Не удалось открыть ни одну камеру!")
            # Создаем кадр с ошибкой
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, "Camera Error", (200, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            # Кодируем в JPEG
            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' +
                   frame_bytes + b'\r\n')
            return

        print(f"Камера успешно открыта (ID={camera_id})")

        # Устанавливаем параметры
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.camera.set(cv2.CAP_PROP_FPS, 30)

        self.is_running = True

        try:
            while self.is_running:
                ret, frame = self.camera.read()
                if not ret:
                    print("Не удалось получить кадр с камеры")
                    break

                try:
                    # Детекция объектов на кадре
                    results = self.model.predict(
                        source=frame,
                        conf=conf_threshold,
                        save=False,
                        verbose=False,
                        device='cpu'  # Используйте 'cuda' если есть GPU
                    )

                    # Подсчитываем количество чашек
                    cup_count = 0
                    if results and results[0].boxes is not None:
                        cup_count = len(results[0].boxes)

                        # Обновляем количество чашек для WebSocket
                        self.update_cup_count(cup_count)

                        # Рисуем bounding boxes
                        annotated_frame = results[0].plot()

                        # Добавляем счетчик на кадр
                        cv2.putText(annotated_frame, f"Cups: {cup_count}",
                                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                                    1, (0, 255, 0), 2)
                    else:
                        annotated_frame = frame
                        self.update_cup_count(0)  # Обновляем 0 чашек

                    # Кодируем в JPEG
                    _, buffer = cv2.imencode('.jpg', annotated_frame)
                    frame_bytes = buffer.tobytes()

                except Exception as e:
                    print(f"Ошибка детекции: {e}")
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_bytes = buffer.tobytes()
                    self.update_cup_count(0)

                # Формируем часть MJPEG потока
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' +
                       frame_bytes + b'\r\n')

                # Небольшая задержка для контроля FPS
                time.sleep(0.03)

        except Exception as e:
            print(f"Ошибка в генераторе кадров: {e}")
        finally:
            self.stop_camera()

    def stop_camera(self):
        """Остановить камеру"""
        self.is_running = False
        if self.camera is not None:
            self.camera.release()
            self.camera = None
            print("Камера остановена")
        # Сбрасываем счетчик при остановке камеры
        self.update_cup_count(0)


# Создаем глобальный экземпляр загрузчика модели
model_instance = ModelLoader("models/best.pt")


# Функции для импорта
def predict_image(image_path: str, conf_threshold: float = 0.5) -> Dict[str, Any]:
    return model_instance.predict_image(image_path, conf_threshold)


def predict_video(video_path: str, conf_threshold: float = 0.5) -> Dict[str, Any]:
    return model_instance.predict_video(video_path, conf_threshold)


def generate_camera_frames(camera_id: int = 0, conf_threshold: float = 0.5):
    """Генератор кадров для MJPEG потока"""
    return model_instance.generate_frames(camera_id, conf_threshold)


def stop_camera():
    """Остановить камеру"""
    return model_instance.stop_camera()


def get_current_cup_count() -> int:
    """Получить текущее количество чашек"""
    return model_instance.get_current_cup_count()


def set_cup_count_callback(callback):
    """Установить callback для отправки количества чашек"""
    return model_instance.set_cup_count_callback(callback)