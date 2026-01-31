// JavaScript для страницы истории

document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const historyTableBody = document.getElementById('historyTableBody');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const historyTableCard = document.getElementById('historyTableCard');
    const emptyHistoryCard = document.getElementById('emptyHistoryCard');
    const errorAlert = document.getElementById('errorAlert');
    const recordsCount = document.getElementById('recordsCount');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    
    // Фильтры
    const filterType = document.getElementById('filterType');
    const filterSort = document.getElementById('filterSort');
    const clearFilters = document.getElementById('clearFilters');
    
    // Модальные окна
    const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    
    // Переменные состояния
    let currentPage = 1;
    const recordsPerPage = 10;
    let totalRecords = 0;
    let allRecords = [];
    let filteredRecords = [];
    let recordToDelete = null;
    
    // Инициализация
    loadHistory();
    setupEventListeners();
    
    // Функция загрузки истории
    async function loadHistory() {
        try {
            showLoading(true);
            
            const response = await fetch('/api/history?limit=1000');
            if (!response.ok) throw new Error('Ошибка загрузки истории');
            
            allRecords = await response.json();
            totalRecords = allRecords.length;
            
            applyFilters();
            updateDisplay();
            
        } catch (error) {
            showError('Не удалось загрузить историю: ' + error.message);
        } finally {
            showLoading(false);
        }
    }
    
    // Функция применения фильтров
    function applyFilters() {
        let filtered = [...allRecords];
        
        // Фильтр по типу
        if (filterType.value !== 'all') {
            filtered = filtered.filter(record => record.file_type === filterType.value);
        }
        
        // Сортировка
        switch (filterSort.value) {
            case 'oldest':
                filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                break;
            case 'most_cups':
                filtered.sort((a, b) => (b.objects_count || 0) - (a.objects_count || 0));
                break;
            case 'least_cups':
                filtered.sort((a, b) => (a.objects_count || 0) - (b.objects_count || 0));
                break;
            default: // newest
                filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        filteredRecords = filtered;
        currentPage = 1; // Сбрасываем на первую страницу
    }
    
    // Функция обновления отображения
    function updateDisplay() {
        const totalFiltered = filteredRecords.length;
        
        // Обновляем счетчик записей
        recordsCount.textContent = `${totalFiltered} записей`;
        
        if (totalFiltered === 0) {
            historyTableCard.classList.add('d-none');
            emptyHistoryCard.classList.remove('d-none');
            return;
        }
        
        emptyHistoryCard.classList.add('d-none');
        historyTableCard.classList.remove('d-none');
        
        // Рассчитываем пагинацию
        const totalPages = Math.ceil(totalFiltered / recordsPerPage);
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = Math.min(startIndex + recordsPerPage, totalFiltered);
        const pageRecords = filteredRecords.slice(startIndex, endIndex);
        
        // Обновляем информацию о пагинации
        paginationInfo.textContent = `Показано ${startIndex + 1}-${endIndex} из ${totalFiltered} записей`;
        
        // Обновляем таблицу
        renderTable(pageRecords);
        
        // Обновляем элементы пагинации
        renderPaginationControls(totalPages);
    }
    
    // Функция рендеринга таблицы
    function renderTable(records) {
        historyTableBody.innerHTML = '';
        
        records.forEach(record => {
            const row = document.createElement('tr');
            
            // Форматирование даты
            const date = new Date(record.timestamp);
            const formattedDate = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Иконка типа файла
            const typeIcon = record.file_type === 'image' 
                ? '<i class="bi bi-image text-primary"></i>' 
                : '<i class="bi bi-play-circle text-success"></i>';
            
            // Количество чашек
            const cupCount = record.average_count !== null && record.average_count !== undefined
                ? `${record.average_count.toFixed(1)} (сред.)`
                : record.objects_count;
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="file-icon me-2">${typeIcon}</span>
                        <span class="filename-truncate">${record.filename}</span>
                    </div>
                </td>
                <td>
                    <span class="badge ${record.file_type === 'image' ? 'bg-primary' : 'bg-success'}">
                        ${record.file_type === 'image' ? 'Изображение' : 'Видео'}
                    </span>
                </td>
                <td>
                    <span class="badge bg-warning text-dark">
                        <i class="bi bi-cup-hot"></i> ${cupCount}
                    </span>
                </td>
                <td>${record.processing_time.toFixed(2)}с</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary view-details" data-id="${record.id}">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-record" data-id="${record.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            historyTableBody.appendChild(row);
        });
        
        // Добавляем обработчики событий для кнопок
        addTableEventListeners();
    }
    
    // Функция рендеринга элементов пагинации
    function renderPaginationControls(totalPages) {
        paginationControls.innerHTML = '';
        
        // Кнопка "Назад"
        const prevButton = document.createElement('button');
        prevButton.className = 'btn btn-outline-primary btn-sm';
        prevButton.innerHTML = '<i class="bi bi-chevron-left"></i>';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updateDisplay();
            }
        });
        paginationControls.appendChild(prevButton);
        
        // Номера страниц
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                updateDisplay();
            });
            paginationControls.appendChild(pageButton);
        }
        
        // Кнопка "Вперед"
        const nextButton = document.createElement('button');
        nextButton.className = 'btn btn-outline-primary btn-sm';
        nextButton.innerHTML = '<i class="bi bi-chevron-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updateDisplay();
            }
        });
        paginationControls.appendChild(nextButton);
    }
    
    // Функция добавления обработчиков событий для таблицы
    function addTableEventListeners() {
        // Кнопки просмотра деталей
        document.querySelectorAll('.view-details').forEach(button => {
            button.addEventListener('click', async (e) => {
                const recordId = e.currentTarget.dataset.id;
                await showRecordDetails(recordId);
            });
        });
        
        // Кнопки удаления
        document.querySelectorAll('.delete-record').forEach(button => {
            button.addEventListener('click', (e) => {
                const recordId = e.currentTarget.dataset.id;
                confirmDeleteRecord(recordId);
            });
        });
    }
    
    // Функция показа деталей записи
    async function showRecordDetails(recordId) {
        try {
            const response = await fetch(`/api/history?limit=1000`);
            if (!response.ok) throw new Error('Ошибка загрузки данных');
            
            const records = await response.json();
            const record = records.find(r => r.id === parseInt(recordId));
            
            if (!record) {
                throw new Error('Запись не найдена');
            }
            
            // Форматируем дату
            const date = new Date(record.timestamp);
            const formattedDate = date.toLocaleDateString('ru-RU', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // Создаем содержимое модального окна
            let detailsContent = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>Основная информация</h6>
                        <table class="table table-sm">
                            <tr>
                                <td><strong>ID:</strong></td>
                                <td>${record.id}</td>
                            </tr>
                            <tr>
                                <td><strong>Файл:</strong></td>
                                <td>${record.filename}</td>
                            </tr>
                            <tr>
                                <td><strong>Тип:</strong></td>
                                <td>
                                    <span class="badge ${record.file_type === 'image' ? 'bg-primary' : 'bg-success'}">
                                        ${record.file_type === 'image' ? 'Изображение' : 'Видео'}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td><strong>Дата:</strong></td>
                                <td>${formattedDate}</td>
                            </tr>
                            <tr>
                                <td><strong>Время обработки:</strong></td>
                                <td>${record.processing_time.toFixed(2)} секунд</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Результаты детекции</h6>
                        <table class="table table-sm">
                            <tr>
                                <td><strong>Количество чашек:</strong></td>
                                <td>
                                    <span class="badge bg-warning text-dark">
                                        ${record.average_count !== null && record.average_count !== undefined 
                                            ? `${record.average_count.toFixed(1)} (среднее)` 
                                            : record.objects_count}
                                    </span>
                                </td>
                            </tr>
            `;
            
            // Дополнительная информация для видео
            if (record.file_type === 'video' && record.frame_stats) {
                const frameCount = record.frame_stats.length;
                const counts = record.frame_stats.map(f => f.count);
                const minCount = Math.min(...counts);
                const maxCount = Math.max(...counts);
                
                detailsContent += `
                            <tr>
                                <td><strong>Проанализировано кадров:</strong></td>
                                <td>${frameCount}</td>
                            </tr>
                            <tr>
                                <td><strong>Мин. в кадре:</strong></td>
                                <td>${minCount}</td>
                            </tr>
                            <tr>
                                <td><strong>Макс. в кадре:</strong></td>
                                <td>${maxCount}</td>
                            </tr>
                `;
            }
            
            detailsContent += `
                        </table>
                    </div>
                </div>
            `;
            
            // Добавляем ссылки на файлы если они есть
            if (record.result_image_path) {
                detailsContent += `
                    <div class="mt-3">
                        <h6>Результат обработки</h6>
                        <a href="/results/${record.result_image_path.split('/').pop()}" 
                           target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-image"></i> Просмотреть результат
                        </a>
                        <a href="/uploads/${record.filename}" 
                           target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                            <i class="bi bi-download"></i> Исходный файл
                        </a>
                    </div>
                `;
            } else if (record.result_video_path) {
                detailsContent += `
                    <div class="mt-3">
                        <h6>Результат обработки</h6>
                        <a href="/results/${record.result_video_path.split('/').pop()}" 
                           target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-play-circle"></i> Смотреть видео
                        </a>
                        <a href="/uploads/${record.filename}" 
                           target="_blank" class="btn btn-sm btn-outline-secondary ms-2">
                            <i class="bi bi-download"></i> Исходный файл
                        </a>
                    </div>
                `;
            }
            
            document.getElementById('modalBodyContent').innerHTML = detailsContent;
            detailsModal.show();
            
        } catch (error) {
            showError('Не удалось загрузить детали записи: ' + error.message);
        }
    }
    
    // Функция подтверждения удаления
    function confirmDeleteRecord(recordId) {
        recordToDelete = recordId;
        deleteModal.show();
    }
    
    // Функция удаления записи
    async function deleteRecord() {
        if (!recordToDelete) return;
        
        try {
            const response = await fetch(`/api/history/${recordToDelete}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Ошибка удаления записи');
            
            // Удаляем запись из локального массива
            allRecords = allRecords.filter(record => record.id !== parseInt(recordToDelete));
            
            // Применяем фильтры и обновляем отображение
            applyFilters();
            updateDisplay();
            
            // Показываем уведомление об успехе
            showNotification('Запись успешно удалена', 'success');
            
        } catch (error) {
            showError('Не удалось удалить запись: ' + error.message);
        } finally {
            recordToDelete = null;
            deleteModal.hide();
        }
    }
    
    // Функция настройки обработчиков событий
    function setupEventListeners() {
        // Фильтры
        filterType.addEventListener('change', () => {
            applyFilters();
            updateDisplay();
        });
        
        filterSort.addEventListener('change', () => {
            applyFilters();
            updateDisplay();
        });
        
        clearFilters.addEventListener('click', () => {
            filterType.value = 'all';
            filterSort.value = 'newest';
            applyFilters();
            updateDisplay();
        });
        
        // Кнопка подтверждения удаления
        document.getElementById('confirmDeleteBtn').addEventListener('click', deleteRecord);
    }
    
    // Вспомогательные функции
    function showLoading(show) {
        if (show) {
            loadingIndicator.classList.remove('d-none');
            historyTableCard.classList.add('d-none');
            emptyHistoryCard.classList.add('d-none');
            errorAlert.classList.add('d-none');
        } else {
            loadingIndicator.classList.add('d-none');
        }
    }
    
    function showError(message) {
        errorAlert.classList.remove('d-none');
        document.getElementById('errorMessage').textContent = message;
    }
    
    function showNotification(message, type = 'success') {
        // Создаем уведомление Bootstrap
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        // Автоматически скрываем через 3 секунды
        setTimeout(() => {
            alert.remove();
        }, 3000);
    }
});
