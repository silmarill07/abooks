// script.js
class AudioBookPlayer {
    constructor() {
        this.book = null;
        this.currentChapterIndex = 0;
        this.isPlaying = false;
        this.audio = new Audio();
        this.isDragging = false;
        this.durationsLoaded = 0;
        this.totalDuration = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadBook();
    }

    setupEventListeners() {
        // Аудио события
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.onAudioEnd());
        
        // Кнопки управления
        document.addEventListener('click', (e) => {
            if (e.target.closest('#playBtn')) this.togglePlay();
            if (e.target.closest('#prevBtn')) this.prevChapter();
            if (e.target.closest('#nextBtn')) this.nextChapter();
            if (e.target.closest('#rewindBack')) this.rewind(-10);
            if (e.target.closest('#rewindForward')) this.rewind(10);
            if (e.target.closest('#homeBtn')) this.showBookList();
        });
        
        // Скорость воспроизведения
        document.addEventListener('change', (e) => {
            if (e.target.id === 'speedInput') this.setSpeed(e.target.value);
        });
        
        // Фокус на поле скорости для мобильных
        document.addEventListener('focus', (e) => {
            if (e.target.id === 'speedInput') {
                e.target.select();
            }
        }, true);
        
        // Ждем загрузки DOM для прогресс бара
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupProgressBarEvents());
        } else {
            this.setupProgressBarEvents();
        }
    }

    setupProgressBarEvents() {
        // Обработчики для прогресс бара
        const progressHandle = document.getElementById('progressHandle');
        const progressBar = document.getElementById('progressBar');
        
        if (progressHandle && progressBar) {
            // Начало перетаскивания
            progressHandle.addEventListener('mousedown', (e) => this.startDrag(e));
            progressHandle.addEventListener('touchstart', (e) => this.startDrag(e));
            
            // Перетаскивание
            document.addEventListener('mousemove', (e) => this.drag(e));
            document.addEventListener('touchmove', (e) => this.drag(e));
            
            // Окончание перетаскивания
            document.addEventListener('mouseup', () => this.stopDrag());
            document.addEventListener('touchend', () => this.stopDrag());
        }
        
        // Клик по прогресс бару
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                if (!this.isDragging) this.seek(e);
            });
        }
    }

    startDrag(e) {
        this.isDragging = true;
        e.preventDefault();
        e.stopPropagation();
        
        // Немедленное обновление позиции
        this.updatePositionOnDrag(e);
    }

    drag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this.updatePositionOnDrag(e);
    }

    updatePositionOnDrag(e) {
        const progressBar = document.getElementById('progressBar');
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        let clientX;
        
        if (e.type === 'touchmove' || e.type === 'touchstart') {
            clientX = e.touches ? e.touches[0].clientX : e.clientX;
        } else {
            clientX = e.clientX;
        }
        
        const offsetX = clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        
        // Обновляем прогресс
        const progress = document.getElementById('progress');
        if (progress) {
            progress.style.width = `${percent}%`;
        }
        
        // Устанавливаем время воспроизведения
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
            const currentTimeEl = document.getElementById('currentTime');
            if (currentTimeEl) {
                currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
            }
            this.updateRemainingTime();
        }
    }

    stopDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.saveCurrentProgress();
        }
    }

    // Загрузка книги
    async loadBook() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Загрузка книги...</p></div>';
        }
        
        try {
            // Проверяем, есть ли сохраненная книга
            const savedBookId = localStorage.getItem('currentBookId');
            
            if (savedBookId) {
                // Ищем сохраненную книгу
                const savedBook = books.find(book => book.id === savedBookId);
                if (savedBook) {
                    this.book = savedBook;
                    this.processBook();
                    return;
                }
            }
            
            // Если нет сохраненной книги, показываем список всех книг
            this.showBookList();
        } catch (error) {
            console.error('Ошибка загрузки книги:', error);
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Ошибка загрузки книги</h3>
                        <p>Не удалось загрузить книгу.</p>
                    </div>
                `;
            }
        }
    }

    // Показ списка всех книг
    showBookList() {
        // Удаляем сохраненную книгу при возврате к списку
        localStorage.removeItem('currentBookId');
        
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;
        
        let booksHTML = '';
        
        books.forEach(book => {
            booksHTML += `
                <div class="book-card" data-book-id="${book.id}">
                    <div class="book-cover">
                        <img src="${book.cover}" alt="${book.title}">
                    </div>
                    <div class="book-title">${book.title}</div>
                </div>
            `;
        });
        
        mainContent.innerHTML = `
            <div class="books-list-container">
                <div class="books-grid">
                    ${booksHTML}
                </div>
            </div>
        `;
        
        // Обновляем хедер для списка книг
        this.updateHeaderForBookList();
        
        // Добавляем обработчики кликов по книгам
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const bookId = card.getAttribute('data-book-id');
                const selectedBook = books.find(book => book.id === bookId);
                if (selectedBook) {
                    this.book = selectedBook;
                    // Сохраняем выбранную книгу
                    localStorage.setItem('currentBookId', bookId);
                    this.processBook();
                }
            });
        });
    }

    // Обновление хедера для списка книг
    updateHeaderForBookList() {
        const header = document.querySelector('header');
        if (header) {
            header.innerHTML = `
                <div class="logo">
                    <i class="fas fa-book-reader"></i>
                    <h1>Аудиокниги</h1>
                </div>
            `;
        }
    }

    // Обновление хедера для плеера
    updateHeaderForPlayer() {
        const header = document.querySelector('header');
        if (header) {
            header.innerHTML = `
                <button class="home-btn" id="homeBtn" title="К списку книг">
                    <i class="fas fa-home"></i>
                </button>
                <div class="logo">
                    <i class="fas fa-book-reader"></i>
                    <h1>Аудиокниги</h1>
                </div>
            `;
            if (document.getElementById('homeBtn')) {
                document.getElementById('homeBtn').addEventListener('click', () => this.showBookList());
            }
        }
    }

    // Обработка выбранной книги
    processBook() {
        // Преобразуем аудиофайлы в главы
        this.book.chapters = this.book.audioFiles.map((file, index) => ({
            title: file.title || `Глава ${index + 1}`,
            duration: null, // Будет определено позже
            file: file.file
        }));
        
        setTimeout(() => {
            this.showBook();
            this.loadDurations();
        }, 500);
    }

    // Загрузка длительности для всех глав
    loadDurations() {
        this.durationsLoaded = 0;
        this.totalDuration = 0;
        
        this.book.chapters.forEach((chapter, index) => {
            this.getDuration(chapter.file, index);
        });
    }

    // Получение длительности аудиофайла
    getDuration(file, index) {
        const tempAudio = new Audio();
        tempAudio.src = file;
        
        tempAudio.addEventListener('loadedmetadata', () => {
            this.book.chapters[index].duration = tempAudio.duration;
            this.durationsLoaded++;
            this.totalDuration += tempAudio.duration;
            
            // Обновляем отображение длительности в плейлисте
            this.updatePlaylistDuration(index);
            
            // Если все длительности загружены, обновляем общее время
            if (this.durationsLoaded === this.book.chapters.length) {
                this.updateRemainingTime();
                this.updateCurrentChapterDuration();
            }
            
            // Очищаем ресурсы
            tempAudio.remove();
        });
        
        tempAudio.addEventListener('error', () => {
            this.book.chapters[index].duration = 0;
            this.durationsLoaded++;
            
            // Обновляем отображение длительности в плейлисте
            this.updatePlaylistDuration(index);
            
            // Если все длительности загружены, обновляем общее время
            if (this.durationsLoaded === this.book.chapters.length) {
                this.updateRemainingTime();
                this.updateCurrentChapterDuration();
            }
            
            // Очищаем ресурсы
            tempAudio.remove();
        });
    }

    // Обновление отображения длительности в плейлисте
    updatePlaylistDuration(index) {
        const playlistItems = document.querySelectorAll('.playlist-item');
        if (playlistItems[index] && this.book.chapters[index].duration !== null) {
            const timeElement = playlistItems[index].querySelector('.playlist-item-time');
            if (timeElement) {
                timeElement.textContent = this.formatTime(this.book.chapters[index].duration);
            }
        }
    }

    // Обновление времени до окончания
    updateRemainingTime() {
        if (this.totalDuration > 0) {
            // Вычисляем прослушанное время
            let listenedTime = 0;
            for (let i = 0; i < this.currentChapterIndex; i++) {
                listenedTime += this.book.chapters[i].duration || 0;
            }
            listenedTime += this.audio.currentTime;
            
            // Вычисляем оставшееся время
            const remainingTime = this.totalDuration - listenedTime;
            const remainingTimeEl = document.getElementById('remainingTime');
            if (remainingTimeEl) {
                remainingTimeEl.textContent = this.formatTime(remainingTime);
            }
        }
    }

    // Обновление длительности текущей главы
    updateCurrentChapterDuration() {
        if (this.book.chapters[this.currentChapterIndex].duration) {
            const durationEl = document.getElementById('duration');
            if (durationEl) {
                durationEl.textContent = this.formatTime(this.book.chapters[this.currentChapterIndex].duration);
            }
        }
    }

showBook() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    mainContent.innerHTML = `
    <div class="player-bg" style="background-image:url('${this.book.cover}');">
        <div class="bg-blur" style="background-image:url('${this.book.cover}');"></div>
        
        <!-- Основной контейнер для анимации -->
        <div id="playerControls" class="player-controls-container">
            <div id="playerBlock" class="audio-player centered">
                <h2>${this.book.title}</h2>
                <div class="player-title">${this.book.chapters[0].title}</div>
                <div class="speed-row">
                    <label for="speedInput">Швидкість:</label>
                    <input type="number" id="speedInput" class="speed-input" min="0.1" max="3" step="0.01" value="1.00">
                </div>
                <div class="progress-container">
                    <div class="progress-bar" id="progressBar">
                        <div class="progress" id="progress">
                            <div class="progress-handle" id="progressHandle"></div>
                        </div>
                    </div>
                    <div class="time-info">
                        <span id="currentTime">00:00</span>
                        <span id="duration">00:00</span>
                    </div>
                </div>
                <div class="controls">
                    <button class="control-btn" id="rewindBack" title="Назад на 10 сек"><i class="fa fa-fast-backward" aria-hidden="true"></i></button>
                    <button class="control-btn" id="prevBtn" title="Попередній файл"><i class="fas fa-step-backward"></i></button>
                    <button class="control-btn play-btn" id="playBtn"><i class="fas fa-play"></i></button>
                    <button class="control-btn" id="nextBtn" title="Наступний файл"><i class="fas fa-step-forward"></i></button>
                    <button class="control-btn" id="rewindForward" title="Вперед на 10 сек"><i class="fa fa-fast-forward" aria-hidden="true"></i></button>
                </div>
                <div class="remaining-time-container">
                    <span class="remaining-label">Залишилось:</span>
                    <span class="remaining-value" id="remainingTime">--:--</span>
                </div>
                <div class="playlist-toggle-row">
                    <button id="togglePlaylistBtn" class="playlist-toggle-btn-blur" title="Показати список файлів">
                        <i class="fas fa-list"></i>
                        <span class="playlist-toggle-text">Список файлів</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="playlist" id="playlistPanel">
            <div class="playlist-items" id="playlistItems"></div>
        </div>
    </div>
`;

    this.updateHeaderForPlayer();
    this.renderPlaylist();
    this.loadChapterWithSavedProgress();

    setTimeout(() => {
        this.setupPlaylistToggle();
        this.setupProgressBarEvents();
    }, 100);
}

// Упрощенный метод setupPlaylistToggle():
setupPlaylistToggle() {
    const panel = document.getElementById('playlistPanel');
    const controlsContainer = document.getElementById('playerControls');
    const toggleBtn = document.getElementById('togglePlaylistBtn');
    
    if (!panel || !controlsContainer || !toggleBtn) return;
    
    let isPlaylistVisible = false;
    
    toggleBtn.addEventListener('click', () => {
        if (!isPlaylistVisible) {
            // Показываем плейлист
            toggleBtn.classList.add('active');
            controlsContainer.classList.add('controls-top');
            
            // Показываем плейлист после перемещения контролов
            setTimeout(() => {
                panel.classList.add('show');
            }, 200);
            
            isPlaylistVisible = true;
        } else {
            // Скрываем плейлист
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
            
            // Возвращаем контролы в центр после скрытия плейлиста
            setTimeout(() => {
                controlsContainer.classList.remove('controls-top');
            }, 300);
            
            isPlaylistVisible = false;
        }
    });

    // Закрытие при клике вне области
    document.addEventListener('click', (e) => {
        if (isPlaylistVisible && 
            !panel.contains(e.target) && 
            !toggleBtn.contains(e.target) &&
            !controlsContainer.contains(e.target)) {
            
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
            
            setTimeout(() => {
                controlsContainer.classList.remove('controls-top');
            }, 300);
            
            isPlaylistVisible = false;
        }
    });
}

renderPlaylist() {
    const playlistItems = document.getElementById('playlistItems');
    if (!playlistItems) return;

    playlistItems.innerHTML = '';

    this.book.chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = `playlist-item${index === this.currentChapterIndex ? ' active' : ''}`;
        item.innerHTML = `
            <div class="playlist-item-left">
                <span class="playlist-item-number">${index + 1}</span>
                <span class="playlist-item-title">${chapter.title}</span>
            </div>
            <span class="playlist-item-time">${chapter.duration ? this.formatTime(chapter.duration) : '00:00'}</span>
        `;
        
        // Добавляем обработчик клика с небольшой задержкой для лучшего UX
        item.addEventListener('click', () => {
            // Добавляем визуальный отклик
            item.style.transform = 'scale(0.98)';
            setTimeout(() => {
                item.style.transform = '';
                this.loadChapter(index);
            }, 100);
        });
        
        playlistItems.appendChild(item);
    });
}

    // Загрузка главы с восстановлением сохраненного прогресса
    loadChapterWithSavedProgress() {
        // Получаем сохраненную главу и время
        const savedChapter = localStorage.getItem(`book-${this.book.id}-last-chapter`);
        const savedTime = localStorage.getItem(`book-${this.book.id}-last-time`);
        const savedSpeed = localStorage.getItem(`book-${this.book.id}-speed`);
        
        let chapterIndex = 0;
        let startTime = 0;
        
        if (savedChapter !== null) {
            chapterIndex = parseInt(savedChapter);
            if (chapterIndex >= this.book.chapters.length) {
                chapterIndex = 0; // Если глава выходит за пределы, начинаем с первой
            }
        }
        
        if (savedTime !== null) {
            startTime = parseFloat(savedTime);
        }
        
        this.currentChapterIndex = chapterIndex;
        
        // Загружаем главу
        const chapter = this.book.chapters[chapterIndex];
        this.audio.src = chapter.file;
        this.audio.load();
        
        // Устанавливаем время воспроизведения
        this.audio.currentTime = startTime;
        
        // Устанавливаем скорость воспроизведения
        if (savedSpeed !== null) {
            // Используем сохраненную скорость
            const speedValue = parseFloat(savedSpeed);
            if (speedValue >= 0.1 && speedValue <= 3) {
                this.audio.playbackRate = speedValue;
                if (document.getElementById('speedInput')) {
                    document.getElementById('speedInput').value = speedValue.toFixed(2);
                }
            }
        } else {
            // Используем значение из input поля (если оно отличается от значения по умолчанию)
            setTimeout(() => {
                const speedInput = document.getElementById('speedInput');
                if (speedInput) {
                    const inputValue = parseFloat(speedInput.value);
                    if (!isNaN(inputValue) && inputValue !== 1.0 && inputValue >= 0.1 && inputValue <= 3) {
                        this.audio.playbackRate = inputValue;
                    }
                }
            }, 100);
        }
        
        // Обновляем UI
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            if (i === chapterIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        document.querySelector('.player-title').textContent = `Зараз грає: ${chapter.title}`;
        
        // Если длительность уже загружена, обновляем отображение
        if (chapter.duration) {
            document.getElementById('duration').textContent = this.formatTime(chapter.duration);
        }
        
        // Обновляем оставшееся время
        this.updateRemainingTime();
    }

loadChapter(index) {
        this.saveCurrentProgress();

        this.currentChapterIndex = index;
        const chapter = this.book.chapters[index];

        // Сохраняем текущую скорость перед загрузкой новой главы
        const currentSpeed = this.audio.playbackRate;

        // Загружаем новую главу
        this.audio.src = chapter.file;
        this.audio.load();
        this.audio.currentTime = 0;

        // Восстанавливаем скорость после загрузки новой главы
        this.audio.playbackRate = currentSpeed;

        // Обновляем UI
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Проверяем, существует ли элемент перед изменением
        const playerTitleEl = document.querySelector('.player-title');
        if (playerTitleEl) {
            playerTitleEl.textContent = `Зараз грає: ${chapter.title}`;
        }

        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = chapter.duration ? this.formatTime(chapter.duration) : '00:00';
        }

        this.updateRemainingTime();

        if (this.isPlaying) {
            this.audio.play();
        }
    }

    // Сохранение текущего прогресса
    saveCurrentProgress() {
        if (this.book && this.currentChapterIndex >= 0) {
            // Сохраняем номер текущей главы
            localStorage.setItem(
                `book-${this.book.id}-last-chapter`, 
                this.currentChapterIndex.toString()
            );
            
            // Сохраняем текущее время воспроизведения
            localStorage.setItem(
                `book-${this.book.id}-last-time`, 
                this.audio.currentTime.toString()
            );
            
            // Сохраняем скорость воспроизведения
            localStorage.setItem(
                `book-${this.book.id}-speed`, 
                this.audio.playbackRate.toString()
            );
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
            document.getElementById('playBtn').innerHTML = '<i class="fas fa-play"></i>';
        } else {
            this.audio.play();
            document.getElementById('playBtn').innerHTML = '<i class="fas fa-pause"></i>';
        }
        this.isPlaying = !this.isPlaying;
        this.saveCurrentProgress();
    }

    prevChapter() {
        if (this.currentChapterIndex > 0) {
            this.loadChapter(this.currentChapterIndex - 1);
        }
    }

    nextChapter() {
        if (this.currentChapterIndex < this.book.chapters.length - 1) {
            this.loadChapter(this.currentChapterIndex + 1);
        }
    }

    // Перемотка на заданное количество секунд
    rewind(seconds) {
        if (this.audio.duration) {
            const newTime = this.audio.currentTime + seconds;
            this.audio.currentTime = Math.max(0, Math.min(newTime, this.audio.duration));
            this.saveCurrentProgress();
            this.updateRemainingTime();
        }
    }

    seek(e) {
        const progressBar = document.getElementById('progressBar');
        if (!progressBar) return;
        
        const rect = progressBar.getBoundingClientRect();
        const offsetX = e.offsetX || (e.touches ? e.touches[0].clientX - rect.left : 0);
        const percent = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
        
        // Обновляем прогресс
        const progress = document.getElementById('progress');
        if (progress) {
            progress.style.width = `${percent}%`;
        }
        
        // Устанавливаем время воспроизведения
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
            this.saveCurrentProgress();
            this.updateRemainingTime();
            
            const currentTimeEl = document.getElementById('currentTime');
            if (currentTimeEl) {
                currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
            }
        }
    }

    setSpeed(speed) {
        const speedValue = parseFloat(speed);
        if (speedValue >= 0.1 && speedValue <= 3) {
            this.audio.playbackRate = speedValue;
            // Сохраняем скорость
            if (this.book) {
                localStorage.setItem(
                    `book-${this.book.id}-speed`, 
                    speedValue.toString()
                );
            }
        } else {
            document.getElementById('speedInput').value = '1.00';
            this.audio.playbackRate = 1.0;
        }
    }

    updateDuration() {
        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.audio.duration);
        }
        
        // Обновляем длительность в списке глав
        if (this.book && this.currentChapterIndex >= 0) {
            this.book.chapters[this.currentChapterIndex].duration = this.audio.duration;
            this.updatePlaylistItem(this.currentChapterIndex);
        }
    }

    updatePlaylistItem(index) {
        const playlistItems = document.querySelectorAll('.playlist-item');
        if (playlistItems[index]) {
            const timeElement = playlistItems[index].querySelector('.playlist-item-time');
            if (timeElement && this.book.chapters[index].duration) {
                timeElement.textContent = this.formatTime(this.book.chapters[index].duration);
            }
        }
    }

    updateProgress() {
        if (!this.isDragging) {
            const progress = document.getElementById('progress');
            if (progress && this.audio.duration) {
                const percent = (this.audio.currentTime / this.audio.duration) * 100;
                progress.style.width = `${percent}%`;
            }
        }
        
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
        
        // Обновляем оставшееся время
        this.updateRemainingTime();
        
        // Периодически сохраняем прогресс (каждые 5 секунд)
        if (Math.floor(this.audio.currentTime) % 5 === 0) {
            this.saveCurrentProgress();
        }
    }

    onAudioEnd() {
        // Сохраняем прогресс завершенной главы
        this.saveCurrentProgress();
        
        if (this.currentChapterIndex < this.book.chapters.length - 1) {
            this.loadChapter(this.currentChapterIndex + 1);
        } else {
            this.isPlaying = false;
            if (document.getElementById('playBtn')) {
                document.getElementById('playBtn').innerHTML = '<i class="fas fa-play"></i>';
            }
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours.toString()}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.player = new AudioBookPlayer();
});

// Сохраняем прогресс перед закрытием страницы
window.addEventListener('beforeunload', () => {
    if (window.player) {
        window.player.saveCurrentProgress();
    }
});

function setFullHeight() {
  const el = document.querySelector('.main-content');
  if (el) {
    el.style.minHeight = window.innerHeight + 'px';
  }
}
window.addEventListener('resize', setFullHeight);
window.addEventListener('orientationchange', setFullHeight);
setFullHeight();