document.addEventListener('DOMContentLoaded', function() {
    const openBookBtn = document.getElementById('openBookBtn');
    const bookContainer = document.getElementById('bookContainer');
    const pages = document.querySelectorAll('.page');
    const backCover = document.querySelector('.back-cover');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const narratorBtn = document.getElementById('narratorBtn');
    const voiceSelect = document.getElementById('voiceSelect');
    
    let currentPage = 0;
    let isAnimating = false;

    const FLIP_MS = 1250;

    let narratorEnabled = false;
    let isSpeaking = false;
    const browserTtsSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    let currentAudio = null;
    let currentAudioUrl = null;
    let lastNarratedText = '';
    let selectedVoiceId = '';

    // Helper to get API base URL for Replit (detect if hostname ends with .replit.app)
    function getApiBaseUrl() {
        if (window.location.hostname.endsWith('.replit.app')) {
            // Replit serves the API on the same host but with the server port
            // We'll use the same host; Replit proxies requests correctly
            return '';
        }
        return '';
    }

    // Give pages a subtle thickness stack in 3D.
    pages.forEach((page, index) => {
        const remaining = pages.length - index;
        page.style.setProperty('--z', `${remaining * 0.9}px`);
    });

    function getCurrentReadableElement() {
        if (bookContainer.classList.contains('hidden')) return null;

        const page = pages[currentPage] || null;
        if (page && !page.classList.contains('flipped')) return page;

        // If all pages flipped, read the back cover
        if (currentPage >= pages.length) return backCover;

        return null;
    }

    function getReadableText(el) {
        if (!el) return '';
        const content = el.querySelector('.page-content');
        if (!content) return '';

        const title = content.querySelector('h2')?.textContent?.trim() || '';
        const paragraphs = Array.from(content.querySelectorAll('p'))
            .map(p => p.textContent.trim())
            .filter(Boolean);

        return [title, ...paragraphs].filter(Boolean).join('.\n');
    }

    function stopNarration() {
        if (browserTtsSupported) {
            window.speechSynthesis.cancel();
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.src = '';
            currentAudio = null;
        }

        if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
            currentAudioUrl = null;
        }

        isSpeaking = false;
    }

    async function narrateCurrentPage() {
        const el = getCurrentReadableElement();
        const text = getReadableText(el);
        if (!text) return;

        if (text === lastNarratedText && isSpeaking) return;
        lastNarratedText = text;

        stopNarration();

        try {
            isSpeaking = true;

            const resp = await fetch(`${getApiBaseUrl()}/api/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text, voiceId: selectedVoiceId || undefined })
            });

            if (!resp.ok) {
                throw new Error(`TTS failed: ${resp.status}`);
            }

            const blob = await resp.blob();
            currentAudioUrl = URL.createObjectURL(blob);
            currentAudio = new Audio(currentAudioUrl);

            currentAudio.onended = () => {
                isSpeaking = false;
            };

            currentAudio.onerror = () => {
                isSpeaking = false;
            };

            await currentAudio.play();
        } catch (e) {
            isSpeaking = false;
            if (browserTtsSupported) {
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 0.95;
                utter.pitch = 1.0;
                utter.volume = 1.0;

                utter.onstart = () => {
                    isSpeaking = true;
                };

                utter.onend = () => {
                    isSpeaking = false;
                };

                utter.onerror = () => {
                    isSpeaking = false;
                };

                window.speechSynthesis.speak(utter);
            }
        }
    }
    
    openBookBtn.addEventListener('click', function() {
        openBookBtn.style.display = 'none';
        bookContainer.classList.remove('hidden');
        setTimeout(() => {
            bookContainer.style.opacity = '1';

            if (narratorEnabled) {
                narrateCurrentPage();
            }
        }, 10);
    });

    fullscreenBtn.addEventListener('click', async function() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (e) {
            // Ignore (browser may block fullscreen without user gesture)
        }
        syncFullscreenButton();
    });

    document.addEventListener('fullscreenchange', syncFullscreenButton);

    function syncFullscreenButton() {
        const on = Boolean(document.fullscreenElement);
        fullscreenBtn.textContent = on ? 'Exit Fullscreen' : 'Fullscreen';
        fullscreenBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    syncFullscreenButton();

    narratorBtn.addEventListener('click', function() {
        narratorEnabled = !narratorEnabled;
        narratorBtn.textContent = narratorEnabled ? 'Narrator: On' : 'Narrator: Off';
        narratorBtn.setAttribute('aria-pressed', narratorEnabled ? 'true' : 'false');

        if (narratorEnabled) {
            narrateCurrentPage();
        } else {
            stopNarration();
        }
    });

    async function loadVoices() {
        if (!voiceSelect) return;
        try {
            const resp = await fetch(`${getApiBaseUrl()}/api/voices`);
            if (!resp.ok) throw new Error(`voices failed: ${resp.status}`);
            const data = await resp.json();
            const voices = Array.isArray(data?.voices) ? data.voices : [];

            voiceSelect.innerHTML = '';
            if (!voices.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No voices found';
                voiceSelect.appendChild(opt);
                voiceSelect.disabled = true;
                return;
            }

            voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voice_id;
                opt.textContent = v.name;
                voiceSelect.appendChild(opt);
            });

            const preferredNames = ['adam', 'antoni', 'josh', 'sam', 'matt', 'daniel', 'brian'];
            const best = voices.find(v => preferredNames.some(n => (v.name || '').toLowerCase().includes(n))) || voices[0];
            selectedVoiceId = best.voice_id;
            voiceSelect.value = selectedVoiceId;
            voiceSelect.disabled = false;
        } catch (e) {
            voiceSelect.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Voices unavailable';
            voiceSelect.appendChild(opt);
            voiceSelect.disabled = true;
        }
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            selectedVoiceId = voiceSelect.value || '';
            if (narratorEnabled) {
                narrateCurrentPage();
            }
        });
    }

    loadVoices();
    
    pages.forEach((page, index) => {
        page.addEventListener('click', function(e) {
            if (isAnimating) return;
            
            if (!page.classList.contains('flipped')) {
                flipPage(page, index, e);
            }
        });

        page.addEventListener('mousemove', function(e) {
            if (page.classList.contains('flipped')) return;
            const rect = page.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            const curl = (y - 0.5) * 14;
            const curlx = (0.5 - x) * 10;
            const lift = Math.max(0, (x - 0.55)) * 18;
            page.style.setProperty('--curl', `${curl}deg`);
            page.style.setProperty('--curlx', `${curlx}deg`);
            page.style.setProperty('--lift', `${lift}px`);
            page.style.setProperty('--press', `${Math.min(1, Math.max(0, (x - 0.35) * 1.2))}`);
        });
    });
    
    backCover.addEventListener('click', function() {
        if (isAnimating) return;
        closeBook();
    });
    
    function flipPage(page, index, e) {
        isAnimating = true;

        if (e) {
            const rect = page.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            // Curl direction: click upper half bends upward, lower half bends downward.
            const curl = (y - 0.5) * 18;

            // CurlX: adds a subtle 3D "cupping" across the sheet width.
            const curlx = (0.5 - x) * 14;

            // Lift increases if you click closer to the outer edge.
            const lift = Math.max(0, (x - 0.45)) * 26;

            page.style.setProperty('--curl', `${curl}deg`);
            page.style.setProperty('--curlx', `${curlx}deg`);
            page.style.setProperty('--lift', `${lift}px`);
            page.style.setProperty('--press', `${Math.min(1, Math.max(0.15, x))}`);
        }
        
        page.classList.add('flipping');
        
        setTimeout(() => {
            page.classList.remove('flipping');
            page.classList.add('flipped');
            currentPage = index + 1;

            page.style.setProperty('--press', '0');
            
            if (currentPage === pages.length) {
                setTimeout(() => {
                    backCover.style.transform = 'rotateY(-180deg)';
                }, 100);
            }
            
            isAnimating = false;

            if (narratorEnabled) {
                narrateCurrentPage();
            }
        }, FLIP_MS);
    }
    
    function closeBook() {
        isAnimating = true;

        stopNarration();
        
        backCover.style.transform = 'rotateY(0deg)';
        
        setTimeout(() => {
            const flippedPages = document.querySelectorAll('.page.flipped');
            flippedPages.forEach((page, index) => {
                setTimeout(() => {
                    page.classList.remove('flipped');
                }, index * 100);
            });
            
            setTimeout(() => {
                currentPage = 0;
                isAnimating = false;
                
                setTimeout(() => {
                    bookContainer.style.opacity = '0';
                    setTimeout(() => {
                        bookContainer.classList.add('hidden');
                        openBookBtn.style.display = 'block';
                    }, 500);
                }, 1000);
            }, flippedPages.length * 100 + FLIP_MS);
        }, 300);
    }
    
    document.addEventListener('keydown', function(e) {
        if (bookContainer.classList.contains('hidden')) return;
        
        if (e.key === 'ArrowRight' || e.key === ' ') {
            const nextPage = pages[currentPage];
            if (nextPage && !nextPage.classList.contains('flipped')) {
                flipPage(nextPage, currentPage);
            }
        } else if (e.key === 'ArrowLeft') {
            if (currentPage > 0) {
                const prevPage = pages[currentPage - 1];
                if (prevPage.classList.contains('flipped')) {
                    isAnimating = true;
                    prevPage.classList.remove('flipped');

                    setTimeout(() => {
                        currentPage--;
                        isAnimating = false;
                    }, FLIP_MS);
                }
            }
        } else if (e.key === 'Escape') {
            closeBook();
        } else if (e.key.toLowerCase() === 'n') {
            narratorBtn.click();
        }
    });
    
    const book = document.querySelector('.book');
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;
    
    book.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('page') || e.target.classList.contains('back-cover')) return;
        
        isDragging = true;
        startX = e.clientX;
        book.classList.add('is-dragging');
        book.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const rotation = Math.max(-30, Math.min(30, deltaX * 0.1));
        book.style.transform = `rotateY(${rotation}deg)`;
    });
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            book.classList.remove('is-dragging');
            book.style.cursor = 'grab';
            
            setTimeout(() => {
                book.style.transform = '';
            }, 300);
        }
    });
});
