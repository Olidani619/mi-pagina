/* ==========================================================================
       CONFIGURACIÓN
       ========================================================================== */
    const CONFIG = {
      particleCount: window.innerWidth < 600 ? 28 : 48,
      notesSymbols: ['♪', '♫', '♬', '♩', '𝄞', '✧', '✦'],
      colors: ['#F8BBD0', '#EFA3BD', '#D96B9B', '#D8B978', '#FFFFFF']
    };

    const STATE = {
      activeModal: null,
      giftOpened: false,
      lastGlissandoKey: null,
      songPlaying: false,
      quotePlaying: false
    };

    /* ==========================================================================
       SINTETIZADOR DE AUDIO (WEB AUDIO API - 100% PURO, SIN DEPENDENCIAS)
       ========================================================================== */
    class RomanticSoundEngine {
      constructor() {
        this.ctx = null;
        this.isAmbientPlaying = false;
        this.ambientTimer = null;
        this.ambientStep = 0;
        this.pausedForVideo = false;

        // Progresión romántica arpegiada para la melodía ambiental de fondo
        // Notas suaves y etéreas que evocan una cajita de música romántica
        this.ambientMelody = [
          349.23, // F4
          440.00, // A4
          523.25, // C5
          659.25, // E5
          523.25, // C5
          440.00, // A4
          329.63, // E4
          392.00, // G4
          493.88, // B4
          587.33, // D5
          493.88, // B4
          392.00, // G4
          293.66, // D4
          349.23, // F4
          440.00, // A4
          523.25, // C5
          440.00, // A4
          349.23, // F4
          261.63, // C4
          329.63, // E4
          392.00, // G4
          523.25, // C5
          392.00, // G4
          329.63  // E4
        ];
      }

      initContext() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            this.ctx = new AudioContext();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      }

      // Generación de tono suave tipo Rhodes/Celesta para las teclas del piano
      playPianoKey(freq = 440, volume = 0.35) {
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = 1.3;

        // Oscilador fundamental dulce
        const oscMain = this.ctx.createOscillator();
        const gainMain = this.ctx.createGain();

        // Oscilador armónico triangular para textura cálida de piano
        const oscHarm = this.ctx.createOscillator();
        const gainHarm = this.ctx.createGain();

        // Filtro paso bajo suave para calidez acústica
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(320, now + duration);

        oscMain.type = 'sine';
        oscMain.frequency.setValueAtTime(freq, now);

        oscHarm.type = 'triangle';
        oscHarm.frequency.setValueAtTime(freq * 2, now); // Primer armónico

        // Envolvente de volumen (Attack suave y decay sedoso)
        gainMain.gain.setValueAtTime(0.001, now);
        gainMain.gain.linearRampToValueAtTime(volume, now + 0.02);
        gainMain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        gainHarm.gain.setValueAtTime(0.001, now);
        gainHarm.gain.linearRampToValueAtTime(volume * 0.35, now + 0.015);
        gainHarm.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7);

        // Conectar rutas de audio
        oscMain.connect(gainMain);
        oscHarm.connect(gainHarm);

        gainMain.connect(filter);
        gainHarm.connect(filter);

        filter.connect(this.ctx.destination);

        oscMain.start(now);
        oscHarm.start(now);

        oscMain.stop(now + duration);
        oscHarm.stop(now + duration);
      }

      // Arpegio mágico ascendente para la revelación del regalo
      playMagicalGlissando() {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, index) => {
          setTimeout(() => {
            this.playPianoKey(freq, 0.28);
          }, index * 85);
        });
      }

      // Control de la melodía de fondo
      startAmbient() {
        this.initContext();
        if (!this.ctx) return;
        this.isAmbientPlaying = true;
        this.pausedForVideo = false;

        const playNextNote = () => {
          if (!this.isAmbientPlaying) return;
          const freq = this.ambientMelody[this.ambientStep % this.ambientMelody.length];
          this.playPianoKey(freq, 0.12); // Volumen muy suave para acompañamiento
          this.ambientStep++;
          this.ambientTimer = setTimeout(playNextNote, 620);
        };

        playNextNote();
      }

      stopAmbient() {
        this.isAmbientPlaying = false;
        if (this.ambientTimer) {
          clearTimeout(this.ambientTimer);
          this.ambientTimer = null;
        }
      }

      toggleAmbient() {
        if (this.isAmbientPlaying) {
          this.stopAmbient();
          return false;
        } else {
          this.startAmbient();
          return true;
        }
      }

      pauseForVideo() {
        if (this.isAmbientPlaying) {
          this.stopAmbient();
          this.pausedForVideo = true;
        }
      }

      resumeAfterVideo() {
        if (this.pausedForVideo) {
          this.pausedForVideo = false;
          this.startAmbient();
          return true;
        }
        return false;
      }
    }

    const soundEngine = new RomanticSoundEngine();

    /* ==========================================================================
       CANVAS DE PARTÍCULAS LUMINOSAS, NOTAS Y PÉTALOS
       ========================================================================== */
    class ParticleScene {
      constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.animate();
      }

      resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
      }

      initParticles() {
        this.particles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
          this.particles.push(this.createParticle());
        }
      }

      createParticle() {
        const isNote = Math.random() > 0.55;
        return {
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: isNote ? Math.random() * 12 + 10 : Math.random() * 4.5 + 2,
          speedY: -(Math.random() * 0.55 + 0.2),
          speedX: (Math.random() - 0.5) * 0.4,
          opacity: Math.random() * 0.6 + 0.25,
          color: CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)],
          isNote: isNote,
          symbol: CONFIG.notesSymbols[Math.floor(Math.random() * CONFIG.notesSymbols.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 0.02
        };
      }

      animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.particles.forEach((p) => {
          p.y += p.speedY;
          p.x += p.speedX;
          p.rotation += p.rotationSpeed;

          // Si la partícula sube más allá de la pantalla, reiniciar abajo
          if (p.y < -25) {
            p.y = this.height + 15;
            p.x = Math.random() * this.width;
          }
          if (p.x < -25) p.x = this.width + 15;
          if (p.x > this.width + 25) p.x = -15;

          this.ctx.save();
          this.ctx.globalAlpha = p.opacity;
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rotation);

          if (p.isNote) {
            this.ctx.font = `${p.size}px serif`;
            this.ctx.fillStyle = p.color;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(p.symbol, 0, 0);
          } else {
            // Círculo luminoso suave tipo bokeh o pétalo
            this.ctx.beginPath();
            this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color;
            this.ctx.fill();
          }

          this.ctx.restore();
        });

        requestAnimationFrame(() => this.animate());
      }
    }

    /* ==========================================================================
       FUNCIONES JAVASCRIPT: NAVEGACIÓN, MODALES Y EFECTOS
       ========================================================================== */
    function showMainScreen() {
      const welcomeScreen = document.getElementById('screen-welcome');
      const mainScreen = document.getElementById('screen-main');
      const homeBackBtn = document.getElementById('btn-home-back');

      welcomeScreen.style.opacity = '0';
      welcomeScreen.style.transform = 'translateY(-20px)';

      setTimeout(() => {
        welcomeScreen.classList.add('hidden');
        mainScreen.classList.add('active');
        homeBackBtn.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 500);
    }

    function showWelcomeScreen() {
      const welcomeScreen = document.getElementById('screen-welcome');
      const mainScreen = document.getElementById('screen-main');
      const homeBackBtn = document.getElementById('btn-home-back');

      closeCurrentModal();

      mainScreen.classList.remove('active');
      homeBackBtn.style.display = 'none';

      setTimeout(() => {
        welcomeScreen.classList.remove('hidden');
        welcomeScreen.style.opacity = '1';
        welcomeScreen.style.transform = 'translateY(0)';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300);
    }

    function updateSongCardUI(isPlaying) {
      const vinyl = document.getElementById('melody-vinyl');
      const soundwave = document.getElementById('melody-soundwave');
      const btnIcon = document.getElementById('btn-toggle-song-icon');
      const btnText = document.getElementById('btn-toggle-song-text');
      const btn = document.getElementById('btn-toggle-song');

      if (!vinyl || !soundwave || !btnIcon || !btnText || !btn) return;

      if (isPlaying) {
        vinyl.classList.remove('paused');
        soundwave.classList.remove('paused');
        btnIcon.textContent = '⏹';
        btnText.textContent = 'Detener';
        btn.classList.add('playing');
        btn.setAttribute('aria-label', 'Detener melodía');
      } else {
        vinyl.classList.add('paused');
        soundwave.classList.add('paused');
        btnIcon.textContent = '▶';
        btnText.textContent = 'Reproducir';
        btn.classList.remove('playing');
        btn.setAttribute('aria-label', 'Reproducir melodía');
      }
    }

    function updateQuoteCardUI(isPlaying) {
      const vinyl = document.getElementById('quote-vinyl');
      const soundwave = document.getElementById('quote-soundwave');
      const btnIcon = document.getElementById('btn-toggle-quote-icon');
      const btnText = document.getElementById('btn-toggle-quote-text');
      const btn = document.getElementById('btn-toggle-quote-song');

      if (!vinyl || !soundwave || !btnIcon || !btnText || !btn) return;

      if (isPlaying) {
        vinyl.classList.remove('paused');
        soundwave.classList.remove('paused');
        btnIcon.textContent = '⏹';
        btnText.textContent = 'Detener';
        btn.classList.add('playing');
        btn.setAttribute('aria-label', 'Detener melodía');
      } else {
        vinyl.classList.add('paused');
        soundwave.classList.add('paused');
        btnIcon.textContent = '▶';
        btnText.textContent = 'Reproducir';
        btn.classList.remove('playing');
        btn.setAttribute('aria-label', 'Reproducir melodía');
      }
    }

    function openModal(modalId) {
      closeCurrentModal();

      const modal = document.getElementById(modalId);
      if (!modal) return;

      STATE.activeModal = modal;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';

    }

    function closeCurrentModal() {
      if (!STATE.activeModal) return;

      const wasSongModal = STATE.activeModal.id === 'modal-song';
      const wasQuoteModal = STATE.activeModal.id === 'modal-melody-quote';
      STATE.activeModal.classList.remove('active');

      // Si cerramos el modal 1, pausar y detener reproducción
      if (wasSongModal) {
        const audio = document.getElementById('song-audio');
        audio.pause();
        audio.currentTime = 0;
        STATE.songPlaying = false;
        updateSongCardUI(false);

        const resumed = soundEngine.resumeAfterVideo();
        if (resumed) {
          updateAudioButtonUI(true);
        }
      }

      // Si cerramos el modal 4, pausar y detener reproducción
      if (wasQuoteModal) {
        const audio = document.getElementById('quote-audio');
        audio.pause();
        audio.currentTime = 0;
        STATE.quotePlaying = false;
        updateQuoteCardUI(false);

        const resumed = soundEngine.resumeAfterVideo();
        if (resumed) {
          updateAudioButtonUI(true);
        }
      }

      document.body.style.overflow = '';
      STATE.activeModal = null;
    }

    function updateAudioButtonUI(isPlaying) {
      const btn = document.getElementById('btn-audio-toggle');
      const icon = document.getElementById('audio-icon');
      if (isPlaying) {
        icon.textContent = '🎶';
        btn.classList.add('playing');
        btn.setAttribute('aria-label', 'Pausar melodía ambiental');
      } else {
        icon.textContent = '🎵';
        btn.classList.remove('playing');
        btn.setAttribute('aria-label', 'Activar melodía ambiental');
      }
    }

    // Efecto visual de notas musicales flotando al pulsar teclas
    function spawnFloatingNote(element) {
      const rect = element.getBoundingClientRect();
      const noteEl = document.createElement('div');
      noteEl.className = 'floating-note';
      const symbols = ['♪', '♫', '♬', '♩', '✨', '💖'];
      noteEl.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      
      const randomOffsetX = (Math.random() - 0.5) * 24;
      noteEl.style.left = `${rect.left + rect.width / 2 + randomOffsetX}px`;
      noteEl.style.top = `${rect.top}px`;

      document.body.appendChild(noteEl);

      setTimeout(() => {
        noteEl.remove();
      }, 1200);
    }

    // Efecto de celebración con corazones, destellos y notas al abrir el regalo
    function launchGiftCelebration(originX, originY) {
      const symbols = ['🌸', '✨', '💖', '♪', '♫', '⭐', '🌷', '💕', '𝄞'];
      for (let i = 0; i < 48; i++) {
        const particle = document.createElement('div');
        particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        particle.style.position = 'fixed';
        particle.style.left = `${originX}px`;
        particle.style.top = `${originY}px`;
        particle.style.fontSize = `${Math.random() * 16 + 14}px`;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '150';
        particle.style.transition = 'all 1.4s cubic-bezier(0.16, 1, 0.3, 1)';
        particle.style.opacity = '1';

        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 160 + 60;
        const destX = Math.cos(angle) * velocity;
        const destY = Math.sin(angle) * velocity - 45;

        requestAnimationFrame(() => {
          particle.style.transform = `translate(${destX}px, ${destY}px) rotate(${Math.random() * 360}deg)`;
          particle.style.opacity = '0';
        });

        setTimeout(() => particle.remove(), 1500);
      }
    }

    function resetGiftBox() {
      const giftBox = document.getElementById('interactive-gift');
      const giftLid = document.getElementById('gift-lid');
      const giftPrompt = document.getElementById('gift-prompt');
      const surpriseFinalMsg = document.getElementById('surprise-final-msg');

      STATE.giftOpened = false;
      giftLid.style.transform = '';
      giftLid.style.opacity = '1';
      giftBox.style.display = 'block';
      giftPrompt.style.display = 'block';
      surpriseFinalMsg.classList.remove('active');
    }

    /* ==========================================================================
       EVENTOS
       ========================================================================== */
    document.addEventListener('DOMContentLoaded', () => {
      // Iniciar partículas luminosas en el canvas
      new ParticleScene('particles-canvas');

      // Botón "Descubrir mi sorpresa"
      const btnDiscover = document.getElementById('btn-discover');
      btnDiscover.addEventListener('click', () => {
        soundEngine.initContext();
        soundEngine.playPianoKey(523.25, 0.4); // Do agudo
        showMainScreen();
      });

      // Botones para volver al inicio
      document.getElementById('btn-back-welcome').addEventListener('click', showWelcomeScreen);
      document.getElementById('btn-home-back').addEventListener('click', showWelcomeScreen);

      // Botón flotante de audio ambiental
      const btnAudio = document.getElementById('btn-audio-toggle');
      btnAudio.addEventListener('click', () => {
        const isPlaying = soundEngine.toggleAmbient();
        updateAudioButtonUI(isPlaying);
      });

      // Teclado Musical: Tocar tecla individual
      const keyboard = document.getElementById('interactive-keyboard');
      const keys = keyboard.querySelectorAll('button[data-freq]');

      function triggerKey(keyElement) {
        if (!keyElement) return;
        const freq = parseFloat(keyElement.getAttribute('data-freq'));
        soundEngine.playPianoKey(freq, 0.35);
        spawnFloatingNote(keyElement);
        keyElement.classList.add('active');
        setTimeout(() => keyElement.classList.remove('active'), 220);
      }

      keys.forEach((key) => {
        key.addEventListener('mousedown', (e) => {
          e.preventDefault();
          triggerKey(key);
        });
      });

      // Soporte de Glissando táctil (deslizar el dedo sobre el teclado en móviles)
      let isTouchingKeyboard = false;

      keyboard.addEventListener('touchstart', (e) => {
        isTouchingKeyboard = true;
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const keyBtn = target ? target.closest('button[data-freq]') : null;
        if (keyBtn) {
          STATE.lastGlissandoKey = keyBtn;
          triggerKey(keyBtn);
        }
      }, { passive: true });

      keyboard.addEventListener('touchmove', (e) => {
        if (!isTouchingKeyboard) return;
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const keyBtn = target ? target.closest('button[data-freq]') : null;

        if (keyBtn && keyBtn !== STATE.lastGlissandoKey) {
          STATE.lastGlissandoKey = keyBtn;
          triggerKey(keyBtn);
        }
      }, { passive: true });

      const endTouch = () => {
        isTouchingKeyboard = false;
        STATE.lastGlissandoKey = null;
      };
      keyboard.addEventListener('touchend', endTouch);
      keyboard.addEventListener('touchcancel', endTouch);

      // Apertura de Modales desde los 5 botones
      const expButtons = document.querySelectorAll('.exp-card-btn[data-modal]');
      expButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetModal = btn.getAttribute('data-modal');
          soundEngine.playPianoKey(392.00, 0.25);
          openModal(targetModal);
        });
      });

      // Cierre de Modales
      const modals = document.querySelectorAll('.modal-overlay');
      modals.forEach((modal) => {
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCurrentModal();
          });
        }

        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeCurrentModal();
          }
        });
      });

      // Teclado físico para ordenadores (PC / Mac) y tecla Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeCurrentModal();
          return;
        }

        // Si hay un modal abierto o se presionan teclas con modificadores, no tocar notas
        if (STATE.activeModal || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;

        const keyChar = e.key.toLowerCase();
        const matchingKey = document.querySelector(`button[data-key="${keyChar}"]`);
        if (matchingKey) {
          triggerKey(matchingKey);
        }
      });

      // Modal 2: Apertura del sobre de la carta digital
      const envelope = document.getElementById('letter-envelope');
      const letterContent = document.getElementById('letter-content');

      envelope.addEventListener('click', () => {
        soundEngine.playPianoKey(440.00, 0.3);
        envelope.classList.add('opened');
        letterContent.classList.add('visible');
      });

      // Modal 1: Control interactivo de la canción "Una canción para ti"
      const btnToggleSong = document.getElementById('btn-toggle-song');
      const songAudio = document.getElementById('song-audio');
      if (btnToggleSong) {
        btnToggleSong.addEventListener('click', () => {
          if (STATE.songPlaying) {
            songAudio.pause();
            songAudio.currentTime = 0;
            STATE.songPlaying = false;
            updateSongCardUI(false);
          } else {
            // Reproducir en respuesta al gesto del usuario y pausar la melodía ambiental
            soundEngine.pauseForVideo();
            updateAudioButtonUI(false);
            songAudio.currentTime = 0;
            STATE.songPlaying = true;
            updateSongCardUI(true);
            songAudio.play().catch((error) => {
              STATE.songPlaying = false;
              updateSongCardUI(false);
              const resumed = soundEngine.resumeAfterVideo();
              updateAudioButtonUI(resumed);
              console.error('No se pudo reproducir Bella y Bestia.mpeg:', error);
            });
          }
        });
      }

      // Modal 4: Control interactivo de "Si fueras una canción"
      const btnToggleQuote = document.getElementById('btn-toggle-quote-song');
      const quoteAudio = document.getElementById('quote-audio');
      if (btnToggleQuote) {
        btnToggleQuote.addEventListener('click', () => {
          if (STATE.quotePlaying) {
            quoteAudio.pause();
            quoteAudio.currentTime = 0;
            STATE.quotePlaying = false;
            updateQuoteCardUI(false);
          } else {
            // Reproducir en respuesta al gesto del usuario y pausar la melodía ambiental
            soundEngine.pauseForVideo();
            updateAudioButtonUI(false);
            quoteAudio.currentTime = 0;
            STATE.quotePlaying = true;
            updateQuoteCardUI(true);
            quoteAudio.play().catch((error) => {
              STATE.quotePlaying = false;
              updateQuoteCardUI(false);
              const resumed = soundEngine.resumeAfterVideo();
              updateAudioButtonUI(resumed);
              console.error('No se pudo reproducir Ofelia.mpeg:', error);
            });
          }
        });
      }

      // Modal 3: Volteo de tarjetas 3D
      const flipCards = document.querySelectorAll('.flip-card');
      flipCards.forEach((card) => {
        const toggleFlip = () => {
          card.classList.toggle('flipped');
          soundEngine.playPianoKey(493.88, 0.25);
        };

        card.addEventListener('click', toggleFlip);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFlip();
          }
        });
      });

      // Modal 5: Apertura de la caja de regalo sorpresa (Clímax)
      const giftBox = document.getElementById('interactive-gift');
      const giftLid = document.getElementById('gift-lid');
      const giftPrompt = document.getElementById('gift-prompt');
      const surpriseFinalMsg = document.getElementById('surprise-final-msg');
      const btnReopenGift = document.getElementById('btn-reopen-gift');

      giftBox.addEventListener('click', () => {
        if (STATE.giftOpened) return;
        STATE.giftOpened = true;

        // Animación de la tapa desprendiéndose
        giftLid.style.transform = 'translateY(-65px) rotate(-22deg)';
        giftLid.style.opacity = '0';

        // Arpegio mágico de arpa/piano
        soundEngine.playMagicalGlissando();

        // Lanzar partículas desde el centro del regalo
        const rect = giftBox.getBoundingClientRect();
        launchGiftCelebration(rect.left + rect.width / 2, rect.top + rect.height / 3);

        setTimeout(() => {
          giftBox.style.display = 'none';
          giftPrompt.style.display = 'none';
          surpriseFinalMsg.classList.add('active');
        }, 650);
      });

      btnReopenGift.addEventListener('click', () => {
        resetGiftBox();
      });
    });
