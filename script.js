document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 100;

        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    };

    revealOnScroll();
    window.addEventListener('scroll', revealOnScroll);

    // 3. Smooth Scrolling for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 4. Language Toggle
    const langToggleBtn = document.getElementById('lang-toggle');
    const langLabel = document.getElementById('lang-label');
    
    langToggleBtn.addEventListener('click', () => {
        const body = document.body;
        if (body.classList.contains('lang-zh')) {
            // Switch to English
            body.classList.remove('lang-zh');
            body.classList.add('lang-en');
            langLabel.textContent = '中';
        } else {
            // Switch to Chinese
            body.classList.remove('lang-en');
            body.classList.add('lang-zh');
            langLabel.textContent = 'EN';
        }
    });

    // 5. Horizontal Photo Rail + Hobbies Scroll FX
    const hobbiesSection = document.getElementById('hobbies');
    const photoRail = document.getElementById('photo-rail');

    if (photoRail) {
        const track = photoRail.querySelector('.photo-track');
        const cards = Array.from(track.children);

        // Copy the first card as the loop anchor, then a full copy of the set after it.
        // Card #1 of the second set sits exactly one set-width (+gap) from the start,
        // so the rail wraps with zero visible jump.
        const anchor = cards[0].cloneNode(true);
        anchor.setAttribute('aria-hidden', 'true');
        track.appendChild(anchor);
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            track.appendChild(clone);
        });
        const allCards = Array.from(track.children);

        // ---- Tuning ----
        const AUTO_SPEED = 90;       // px/s of continuous auto-scroll
        const EASE = 0.14;           // how quickly we settle onto a target (per frame)
        const HOVER_SLOW = 0.45;     // auto-scroll multiplier while the pointer is over the rail

        let loopWidth = 0;
        let offset = 0;              // total distance travelled (px, always grows)
        let manualOffset = 0;        // extra distance added by the arrow buttons
        let lastFrame = performance.now();
        let hovered = false;
        let userPaused = false;
        let dragging = false, dragActive = false;
        let dragStartX = 0, dragStartY = 0, dragStartOffset = 0;

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
        const mod = (n, m) => ((n % m) + m) % m;
        const stepSize = () => cards[0].offsetWidth + 32;

        const measure = () => {
            loopWidth = allCards[cards.length].offsetLeft - allCards[0].offsetLeft;
        };

        const update = () => {
            const now = performance.now();
            const dt = Math.min((now - lastFrame) / 1000, 0.05);
            lastFrame = now;

            // Auto-scroll is always on unless the user explicitly paused it.
            // Hovering only slows it down slightly; leaving the rail resumes full speed.
            if (!userPaused && !dragging) {
                offset += AUTO_SPEED * (hovered ? HOVER_SLOW : 1) * dt;
            } else if (dragging) {
                offset = dragStartOffset;
            }

            // Settle onto the manual target so arrow clicks animate smoothly.
            offset += manualOffset * EASE;
            manualOffset -= manualOffset * EASE;

            track.style.setProperty('--rail-x', (-mod(offset, loopWidth)) + 'px');

            // Parallax: cards near the screen centre float up, edges sink.
            const vw = window.innerWidth;
            allCards.forEach(card => {
                const r = card.getBoundingClientRect();
                if (r.right < -100 || r.left > vw + 100) return;
                const centre = (r.left + r.width / 2 - vw / 2) / vw;   // ~-0.5..0.5
                card.style.setProperty('--card-y', (-centre * 14).toFixed(2) + 'px');
            });

            requestAnimationFrame(update);
        };

        // Hover: only a gentle slowdown, never a stop.
        photoRail.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'mouse') hovered = true;
        });
        photoRail.addEventListener('pointerleave', () => { hovered = false; });

        // ---- Drag / swipe: horizontal gestures scrub the rail ----
        photoRail.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartOffset = offset;
            dragging = true;
            dragActive = false;
        });

        photoRail.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (!dragActive && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
                dragActive = true;
                photoRail.setPointerCapture(e.pointerId);
            }
            if (!dragActive) return;
            offset = dragStartOffset - dx;
        });

        const endDrag = () => { dragging = false; dragActive = false; };
        photoRail.addEventListener('pointerup', endDrag);
        photoRail.addEventListener('pointercancel', endDrag);

        // ---- Controls ----
        const prevBtn = document.getElementById('rail-prev');
        const nextBtn = document.getElementById('rail-next');
        const pauseBtn = document.getElementById('rail-pause');

        const nudge = (dir) => { manualOffset += stepSize() * dir; };

        if (prevBtn) prevBtn.addEventListener('click', () => nudge(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => nudge(1));

        if (pauseBtn) {
            pauseBtn.dataset.paused = 'false';
            pauseBtn.addEventListener('click', () => {
                userPaused = pauseBtn.dataset.paused !== 'true';
                pauseBtn.dataset.paused = userPaused ? 'true' : 'false';
                pauseBtn.innerHTML = userPaused
                    ? '<i class="fa-solid fa-play"></i>'
                    : '<i class="fa-solid fa-pause"></i>';
                pauseBtn.setAttribute('aria-label', userPaused ? 'Resume auto-scroll' : 'Pause auto-scroll');
            });
        }

        measure();
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(measure, 200);
        });
        window.addEventListener('load', measure);
        requestAnimationFrame(update);
    }

    // Section-level scroll trigger: staggered header reveal.
    if (hobbiesSection && 'IntersectionObserver' in window) {
        const hobbiesObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, { threshold: 0.15 });
        hobbiesObserver.observe(hobbiesSection);
    } else if (hobbiesSection) {
        hobbiesSection.classList.add('in-view');
    }

    // 6. Contact Modal Logic
    const contactBtn = document.getElementById('contact-btn');
    const contactModal = document.getElementById('contact-modal');
    const closeModalBtn = document.querySelector('.close-modal');

    if (contactBtn && contactModal && closeModalBtn) {
        contactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            contactModal.classList.add('active');
        });

        closeModalBtn.addEventListener('click', () => {
            contactModal.classList.remove('active');
        });

        // Close when clicking outside the modal content
        contactModal.addEventListener('click', (e) => {
            if (e.target === contactModal) {
                contactModal.classList.remove('active');
            }
        });
    }

    // 7. LLM Typewriter Effect
    const typewriters = document.querySelectorAll('.typewriter');

    // ---- Typing speed tuning (milliseconds) ----
    // Per-character delay. Chinese characters are revealed more slowly than Latin ones
    // because a single glyph carries much more information.
    const CHAR_DELAY_ZH = 38;
    const CHAR_DELAY_EN = 13;
    // Extra hold after sentence-ending / clause punctuation, so pauses read naturally.
    const PUNCTUATION_PAUSE_ZH = 130;
    const PUNCTUATION_PAUSE_EN = 70;
    // Idle gap between two consecutive blocks (e.g. title -> description -> each bullet).
    const BLOCK_GAP = 160;
    // Small delay before the very first block of a group starts.
    const BLOCK_START_DELAY = 100;

    function wrapTextNodes(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let currentNode;
        while(currentNode = walker.nextNode()) {
            if (currentNode.nodeValue.trim() !== '') {
                textNodes.push(currentNode);
            }
        }
        
        textNodes.forEach(textNode => {
            const text = textNode.nodeValue;
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < text.length; i++) {
                if (text[i] === ' ' || text[i] === '\n' || text[i] === '\t') {
                    fragment.appendChild(document.createTextNode(text[i]));
                } else {
                    const charSpan = document.createElement('span');
                    charSpan.className = 'char';
                    charSpan.textContent = text[i];
                    charSpan.style.opacity = '0';
                    // Optional tiny scale or blur for a more dynamic LLM effect
                    charSpan.style.transition = 'opacity 0.05s ease-in';
                    fragment.appendChild(charSpan);
                }
            }
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    typewriters.forEach(tw => {
        wrapTextNodes(tw);
    });

    // Group typewriter blocks by the block they belong to (a project card, the hero,
    // the hobbies header...). Blocks inside one group are typed strictly top-to-bottom:
    // a block only starts once every block above it has finished.
    const GROUP_SELECTOR = '.project-card, .hobbies-header, .hero-content';
    const typewriterGroups = new Map();

    typewriters.forEach(tw => {
        const group = tw.closest(GROUP_SELECTOR) || tw.parentElement;
        if (!typewriterGroups.has(group)) {
            typewriterGroups.set(group, []);
        }
        typewriterGroups.get(group).push(tw);
    });

    const isEnglishMode = () => document.body.classList.contains('lang-en');

    // Per-character delay for one char, or 0 if the char belongs to the hidden language.
    function charDelay(char) {
        const isEnglish = isEnglishMode();
        const parentLangZh = char.closest('.lang-zh');
        const parentLangEn = char.closest('.lang-en');

        // Chars of the currently hidden language are revealed instantly, so that
        // toggling the language later shows complete text.
        if ((isEnglish && parentLangZh) || (!isEnglish && parentLangEn)) {
            return { hidden: true, delay: 0 };
        }

        const text = char.textContent;
        const isChineseChar = /[\u4e00-\u9fa5]/.test(text);
        let delay = isChineseChar ? CHAR_DELAY_ZH : CHAR_DELAY_EN;

        if (isChineseChar && /[，。！？；：、]/.test(text)) {
            delay += PUNCTUATION_PAUSE_ZH;
        } else if (!isChineseChar && /[.,!?;:]/.test(text)) {
            delay += PUNCTUATION_PAUSE_EN;
        }

        return { hidden: false, delay };
    }

    // Total time a block needs to finish typing, based on the current language.
    function blockDuration(element) {
        let elapsed = 0;
        element.querySelectorAll('.char').forEach(char => {
            elapsed += charDelay(char).delay;
        });
        return elapsed;
    }

    // Reveal one block char by char. Returns nothing; duration comes from blockDuration().
    function typeBlock(element) {
        const chars = element.querySelectorAll('.char');
        let delay = 0;

        chars.forEach(char => {
            const { hidden, delay: step } = charDelay(char);
            if (hidden) {
                char.style.opacity = '1';
                return;
            }
            setTimeout(() => {
                char.style.opacity = '1';
            }, delay);
            delay += step;
        });
    }

    const typewriterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const group = entry.target;
            typewriterObserver.unobserve(group);

            const blocks = typewriterGroups.get(group) || [];
            // DOM order == visual top-to-bottom order, so blocks queue up sequentially.
            let startAt = BLOCK_START_DELAY;

            blocks.forEach(block => {
                const blockStart = startAt;
                setTimeout(() => {
                    typeBlock(block);
                }, blockStart);
                startAt = blockStart + blockDuration(block) + BLOCK_GAP;
            });
        });
    }, { threshold: 0.1 });

    typewriterGroups.forEach((blocks, group) => {
        typewriterObserver.observe(group);
    });

});
