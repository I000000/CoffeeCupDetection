# Coffee Cup Detection System

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)
![YOLOv8](https://img.shields.io/badge/YOLOv8-8.0-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

Система автоматической детекции и подсчета кофейных чашек с использованием компьютерного зрения и веб-интерфейса в реальном времени.

## Технологии

**Backend:**
- **FastAPI** - высокопроизводительный веб-фреймворк
- **YOLOv8 (Ultralytics)** - модель компьютерного зрения
- **OpenCV** - обработка изображений и видео
- **SQLAlchemy** - работа с базой данных
- **WebSocket** - коммуникация в реальном времени

**Frontend:**
- **Bootstrap 5** - адаптивный дизайн
- **JavaScript** - интерактивность
- **Chart.js** - визуализация данных

**База данных:**
- **SQLite** - легковесная база данных

**Отчетность:**
- **Pandas** - анализ данных
- **ReportLab** - генерация PDF
- **OpenPyXL** - работа с Excel

## Установка

### 1. Клонирование репозитория
```bash
git clone https://github.com/I000000/CoffeeCupDetection.git
```

### 2. Создание виртуального окружения
```bash
# Для Windows
python -m venv venv
venv\Scripts\activate
```

```bash
# Для Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 4. Запуск приложения

```bash
python main.py
```

Приложение будет доступно по адресу: http://localhost:8000

