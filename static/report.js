// JavaScript для страницы отчетов

document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const reportForm = document.getElementById('reportForm');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const previewBtn = document.getElementById('previewBtn');
    const previewCard = document.getElementById('previewCard');
    const previewContent = document.getElementById('previewContent');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    // Статистика
    const totalRecords = document.getElementById('totalRecords');
    const totalCups = document.getElementById('totalCups');
    const imageCount = document.getElementById('imageCount');
    const videoCount = document.getElementById('videoCount');
    const recentRecords = document.getElementById('recentRecords');
    
    // Инициализация
    loadStatistics();
    loadRecentRecords();
    setupDatePickers();
    setupEventListeners();
    
    // Загрузка статистики
    async function loadStatistics() {
        try {
            const response = await fetch('/api/history?limit=1000');
            const records = await response.json();
            
            // Вычисляем статистику
            const images = records.filter(r => r.file_type === 'image');
            const videos = records.filter(r => r.file_type === 'video');
            const totalCupsCount = records.reduce((sum, r) => sum + (r.objects_count || 0), 0);
            
            // Обновляем DOM
            totalRecords.textContent = records.length;
            totalCups.textContent = totalCupsCount;
            imageCount.textContent = images.length;
            videoCount.textContent = videos.length;
            
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }
    
    // Загрузка последних записей
    async function loadRecentRecords() {
        try {
            const response = await fetch('/api/history?limit=5');
            const records = await response.json();
            
            recentRecords.innerHTML = '';
            
            records.forEach(record => {
                const date = new Date(record.timestamp);
                const formattedDate = date.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const typeIcon = record.file_type === 'image' 
                    ? '<i class="bi bi-image text-primary"></i>' 
                    : '<i class="bi bi-play-circle text-success"></i>';
                
                const listItem = document.createElement('a');
                listItem.className = 'list-group-item list-group-item-action';
                listItem.href = '#';
                listItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <div class="d-flex align-items-center">
                            <span class="me-2">${typeIcon}</span>
                            <span class="filename-truncate" style="max-width: 150px;">${record.filename}</span>
                        </div>
                        <small class="text-muted">${formattedDate}</small>
                    </div>
                    <div class="mt-1">
                        <span class="badge bg-warning text-dark">
                            <i class="bi bi-cup-hot"></i> ${record.objects_count}
                        </span>
                        <span class="badge bg-secondary ms-1">${record.processing_time.toFixed(2)}с</span>
                    </div>
                `;
                
                recentRecords.appendChild(listItem);
            });
            
        } catch (error) {
            console.error('Ошибка загрузки последних записей:', error);
        }
    }
    
    // Настройка календарей
    function setupDatePickers() {
        // Устанавливаем максимальную дату как сегодня
        const today = new Date().toISOString().split('T')[0];
        if (startDate) startDate.max = today;
        if (endDate) endDate.max = today;
        
        // При изменении начальной даты ограничиваем конечную
        if (startDate) {
            startDate.addEventListener('change', function() {
                if (endDate && this.value) {
                    endDate.min = this.value;
                }
            });
        }
        
        // При изменении конечной даты ограничиваем начальную
        if (endDate) {
            endDate.addEventListener('change', function() {
                if (startDate && this.value) {
                    startDate.max = this.value;
                }
            });
        }
    }
    
    // Настройка обработчиков событий
    function setupEventListeners() {
        // Генерация отчета
        reportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await generateReport();
        });
        
        // Предварительный просмотр
        previewBtn.addEventListener('click', async function() {
            await generatePreview();
        });
    }
    
    // Генерация отчета
    async function generateReport() {
        try {
            // Получаем параметры
            const reportType = document.querySelector('input[name="reportType"]:checked').value;
            const params = new URLSearchParams();
            
            if (startDate.value) params.append('start_date', startDate.value);
            if (endDate.value) params.append('end_date', endDate.value);
            
            // Показываем индикатор загрузки
            const originalText = generateReportBtn.innerHTML;
            generateReportBtn.disabled = true;
            generateReportBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Генерация...';
            
            // Определяем URL в зависимости от типа отчета
            let url = `/api/report/${reportType}`;
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            // Запускаем скачивание
            window.location.href = url;
            
            // Восстанавливаем кнопку через 3 секунды (примерное время генерации)
            setTimeout(() => {
                generateReportBtn.disabled = false;
                generateReportBtn.innerHTML = originalText;
            }, 3000);
            
        } catch (error) {
            console.error('Ошибка генерации отчета:', error);
            alert('Ошибка при генерации отчета: ' + error.message);
            generateReportBtn.disabled = false;
            generateReportBtn.innerHTML = '<i class="bi bi-file-earmark-plus"></i> Сгенерировать отчет';
        }
    }
    
    // Генерация предварительного просмотра
    async function generatePreview() {
        try {
            // Получаем параметры
            const params = new URLSearchParams();
            
            if (startDate.value) params.append('start_date', startDate.value);
            if (endDate.value) params.append('end_date', endDate.value);
            
            // Показываем индикатор загрузки
            const originalText = previewBtn.innerHTML;
            previewBtn.disabled = true;
            previewBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Загрузка...';
            
            // Загружаем данные
            const url = `/api/history?${params.toString()}`;
            const response = await fetch(url);
            const records = await response.json();
            
            // Генерируем предпросмотр
            renderPreview(records);
            
            // Показываем карточку с предпросмотром
            previewCard.classList.remove('d-none');
            
        } catch (error) {
            console.error('Ошибка генерации предпросмотра:', error);
            alert('Ошибка при загрузке данных: ' + error.message);
        } finally {
            // Восстанавливаем кнопку
            previewBtn.disabled = false;
            previewBtn.innerHTML = originalText;
        }
    }
    
    // Рендеринг предпросмотра
    function renderPreview(records) {
        if (records.length === 0) {
            previewContent.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i>
                    Нет данных для выбранного периода
                </div>
            `;
            return;
        }
        
        // Вычисляем статистику
        const images = records.filter(r => r.file_type === 'image');
        const videos = records.filter(r => r.file_type === 'video');
        const totalCupsCount = records.reduce((sum, r) => sum + (r.objects_count || 0), 0);
        const avgProcessingTime = records.length > 0 
            ? (records.reduce((sum, r) => sum + r.processing_time, 0) / records.length).toFixed(2)
            : 0;
        
        // Формируем HTML
        let html = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="text-primary">${records.length}</h5>
                            <p class="small text-muted mb-0">Всего записей</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="text-success">${totalCupsCount}</h5>
                            <p class="small text-muted mb-0">Всего чашек</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="text-info">${images.length}</h5>
                            <p class="small text-muted mb-0">Изображений</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="text-warning">${videos.length}</h5>
                            <p class="small text-muted mb-0">Видео</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-secondary">
                <i class="bi bi-info-circle"></i>
                Среднее время обработки: <strong>${avgProcessingTime} секунд</strong>
            </div>
            
            <h6>Последние записи периода:</h6>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Файл</th>
                            <th>Тип</th>
                            <th>Чашек</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Добавляем первые 5 записей
        records.slice(0, 5).forEach(record => {
            const date = new Date(record.timestamp);
            const formattedDate = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <tr>
                    <td>${formattedDate}</td>
                    <td>${record.filename}</td>
                    <td>
                        <span class="badge ${record.file_type === 'image' ? 'bg-primary' : 'bg-success'}">
                            ${record.file_type === 'image' ? 'Изображение' : 'Видео'}
                        </span>
                    </td>
                    <td>${record.objects_count}</td>
                    <td>${record.processing_time.toFixed(2)}с</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="alert alert-warning mt-3">
                <i class="bi bi-exclamation-triangle"></i>
                <small>
                    Это предварительный просмотр. Полный отчет будет содержать все записи выбранного периода.
                    ${records.length > 5 ? `Всего записей в периоде: ${records.length}` : ''}
                </small>
            </div>
        `;
        
        previewContent.innerHTML = html;
    }
});