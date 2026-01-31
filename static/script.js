// Основной файл JavaScript для веб-интерфейса

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация переменных
    let mediaStream = null;
    let currentResultId = null;
    
    // Загружаем статистику системы
    loadSystemStats();
    
    // Обработчик загрузки изображения
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('imageFile');
            const uploadBtn = document.getElementById('uploadBtn');
            const spinner = document.getElementById('uploadSpinner');
            
            if (!fileInput.files[0]) {
                alert('Пожалуйста, выберите файл');
                return;
            }
            
            // Показываем спиннер
            uploadBtn.disabled = true;
            spinner.classList.remove('d-none');
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            try {
                const response = await fetch('/api/upload/image/', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Сохраняем ID результата
                    currentResultId = result.record_id;
                    
                    // Показываем результат
                    showImageResult(result);
                    
                    // Обновляем статистику
                    loadSystemStats();
                } else {
                    alert('Ошибка обработки: ' + (result.detail || 'Неизвестная ошибка'));
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при загрузке файла');
            } finally {
                // Скрываем спиннер
                uploadBtn.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }
    
    // Обработчик загрузки видео
    const videoForm = document.getElementById('videoForm');
    if (videoForm) {
        videoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('videoFile');
            const videoBtn = document.getElementById('videoBtn');
            const spinner = document.getElementById('videoSpinner');
            
            if (!fileInput.files[0]) {
                alert('Пожалуйста, выберите видеофайл');
                return;
            }
            
            videoBtn.disabled = true;
            spinner.classList.remove('d-none');
            
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            
            try {
                const response = await fetch('/api/upload/video/', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showVideoResult(result);
                    loadSystemStats();
                } else {
                    alert('Ошибка обработки видео: ' + (result.detail || 'Неизвестная ошибка'));
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при обработке видео');
            } finally {
                videoBtn.disabled = false;
                spinner.classList.add('d-none');
            }
        });
    }
    
    // Функция для отображения результатов изображения
    function showImageResult(result) {
        const resultSection = document.getElementById('resultSection');
        const resultImage = document.getElementById('resultImage');
        const resultStats = document.getElementById('resultStats');
        
        // Обновляем статистику
        resultStats.innerHTML = `
            <h5>Результаты детекции</h5>
            <p>Обнаружено чашек: <strong>${result.objects_count}</strong></p>
            <p>Время обработки: <strong>${result.processing_time.toFixed(2)} секунд</strong></p>
            <p>Файл: <strong>${result.filename}</strong></p>
        `;
        
        // Показываем изображение
        resultImage.src = result.result_image_url;
        resultImage.alt = `Обнаружено ${result.objects_count} чашек`;
        
        // Показываем секцию с результатами
        resultSection.classList.remove('d-none');
        
        // Прокручиваем к результатам
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Функция для отображения результатов видео
    function showVideoResult(result) {
        const videoResultSection = document.getElementById('videoResultSection');
        const resultVideo = document.getElementById('resultVideo');
        const videoStats = document.getElementById('videoStats');
        
        // Обновляем статистику
        videoStats.innerHTML = `
            <h5>Результаты анализа видео</h5>
            <p>Среднее количество чашек в кадре: <strong>${result.average_count.toFixed(1)}</strong></p>
            <p>Минимальное: <strong>${result.min_count}</strong> | Максимальное: <strong>${result.max_count}</strong></p>
            <p>Время обработки: <strong>${result.processing_time.toFixed(2)} секунд</strong></p>
            <p>Файл: <strong>${result.filename}</strong></p>
        `;
        
        // Показываем видео
        if (result.result_video_path) {
            resultVideo.src = `/results/${result.result_video_path.split('/').pop()}`;
        }
        
        // Показываем секцию с результатами
        videoResultSection.classList.remove('d-none');
        videoResultSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Функция для сохранения результата
    window.saveResult = function() {
        if (!currentResultId) {
            alert('Нет результата для сохранения');
            return;
        }
        
        // Здесь можно добавить логику для сохранения результата
        alert('Результат сохранен в истории!');
    };
    
    // Функция для обновления статуса камеры
    function updateCameraStatus(message) {
        const cameraStats = document.getElementById('cameraStats');
        if (cameraStats) {
            cameraStats.innerHTML = `<div class="alert alert-info">${message}</div>`;
        }
    }
    
    // Функция для загрузки статистики системы
    async function loadSystemStats() {
        try {
            const response = await fetch('/api/history?limit=1000');
            const records = await response.json();
            
            // Вычисляем статистику
            const totalProcessed = records.length;
            const totalCups = records.reduce((sum, record) => sum + (record.objects_count || 0), 0);
            const avgTime = records.length > 0 
                ? (records.reduce((sum, record) => sum + (record.processing_time || 0), 0) / records.length).toFixed(2)
                : 0;
            
            // Обновляем DOM
            document.getElementById('totalProcessed').textContent = totalProcessed;
            document.getElementById('totalCups').textContent = totalCups;
            document.getElementById('avgTime').textContent = avgTime + 's';
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }
    
    // Инициализация закладок Bootstrap
    const triggerTabList = document.querySelectorAll('#myTab button');
    triggerTabList.forEach(triggerEl => {
        const tabTrigger = new bootstrap.Tab(triggerEl);
        triggerEl.addEventListener('click', event => {
            event.preventDefault();
            tabTrigger.show();
        });
    });

    // === Работа с веб-камерой и WebSocket для подсчета чашек ===
    const startCameraBtn = document.getElementById('startCameraBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const webcamStream = document.getElementById('webcamStream');
    const cupCountElement = document.getElementById('cupCount');

    let streamActive = false;
    let websocket = null;

    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', startCameraStream);
    }

    if (stopCameraBtn) {
        stopCameraBtn.addEventListener('click', stopCameraStream);
    }

    function startCameraStream() {
        try {
            console.log("Запуск потока с камеры...");
            
            // Запускаем MJPEG поток
            webcamStream.src = '/api/camera/stream';
            
            // Подключаемся к WebSocket для получения количества чашек
            connectWebSocket();
            
            // Обновляем UI
            startCameraBtn.disabled = true;
            stopCameraBtn.disabled = false;
            streamActive = true;
            
            console.log("Поток камеры запущен, WebSocket подключен");
            
        } catch (error) {
            console.error('Ошибка запуска камеры:', error);
            alert('Ошибка при запуске камеры: ' + error.message);
            stopCameraStream();
        }
    }

    function connectWebSocket() {
        // Создаем WebSocket соединение
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/cup-count`;
        
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function() {
            console.log('WebSocket подключен');
        };
        
        websocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'cup_count') {
                    // Обновляем счетчик чашек
                    cupCountElement.textContent = data.count;
                    
                    // Добавляем анимацию при изменении
                    if (parseInt(cupCountElement.textContent) !== data.count) {
                        cupCountElement.classList.add('pulse');
                        setTimeout(() => {
                            cupCountElement.classList.remove('pulse');
                        }, 300);
                    }
                }
            } catch (error) {
                console.error('Ошибка обработки WebSocket сообщения:', error);
            }
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket ошибка:', error);
        };
        
        websocket.onclose = function() {
            console.log('WebSocket отключен');
            // Пытаемся переподключиться через 2 секунды если камера еще активна
            if (streamActive) {
                setTimeout(connectWebSocket, 2000);
            }
        };
    }

    function stopCameraStream() {
        console.log("Остановка потока...");
        
        // Останавливаем MJPEG поток
        webcamStream.src = '';
        
        // Закрываем WebSocket соединение
        if (websocket) {
            websocket.close();
            websocket = null;
        }
        
        // Обновляем UI
        startCameraBtn.disabled = false;
        stopCameraBtn.disabled = true;
        streamActive = false;
        
        // Сбрасываем счетчик
        cupCountElement.textContent = '0';
        
        // Останавливаем камеру на сервере
        fetch('/api/camera/stop').catch(console.error);
        
        console.log("Поток камеры остановлен");
    }

    // Останавливаем поток при закрытии вкладки
    window.addEventListener('beforeunload', function() {
        if (streamActive) {
            stopCameraStream();
        }
    });

    // Останавливаем поток при скрытии вкладки
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && streamActive) {
            stopCameraStream();
        }
    });

    // Останавливаем поток при переходе на другую вкладку
    document.addEventListener('DOMContentLoaded', function() {
        const cameraTab = document.getElementById('camera-tab');
        if (cameraTab) {
            cameraTab.addEventListener('shown.bs.tab', function(event) {
                // Автоматически запускать камеру при переходе (опционально)
                // startCameraStream();
            });
            
            cameraTab.addEventListener('hidden.bs.tab', function(event) {
                // Останавливаем поток при уходе с вкладки
                if (streamActive) {
                    stopCameraStream();
                }
            });
        }
    });
});