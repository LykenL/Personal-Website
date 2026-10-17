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

    // 5. Horizontal Photo Rail
    const photoRail = document.getElementById('photo-rail');

    if (photoRail) {
        const track = photoRail.querySelector('.photo-track');
        const cards = Array.from(track.children);

        // Append an exact copy of the first card as the loop anchor, then a full copy
        // of the set after it (the rail is much longer than the viewport, so this
        // always fills the screen). Card #1 of that second set sits exactly
        // one-set-plus-one-gap away, so the loop wraps with zero visible jump.
        const anchor = cards[0].cloneNode(true);
        anchor.setAttribute('aria-hidden', 'true');
        track.appendChild(anchor);
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            track.appendChild(clone);
        });
        const allCards = Array.from(track.children);

        // Base distance covered per second, independent of photo count / screen size.
        const SPEED_PX_S = 45;
        const syncDuration = () => {
            // Measure the real layout distance from the first original card to the
            // anchor clone (index cards.length). That is the exact seam the loop must
            // travel, whatever the card widths and gap happen to be.
            const loop = allCards[cards.length].offsetLeft - allCards[0].offsetLeft;
            track.style.setProperty('--loop-offset', -loop + 'px');
            track.style.animationDuration = (loop / SPEED_PX_S) + 's';
        };
        syncDuration();
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(syncDuration, 200);
        });

        // Pointer drag / swipe scrubs the rail manually.
        const pauseBtn = document.getElementById('rail-pause');
        let dragging = false, startX = 0, startPaused = false;

        photoRail.addEventListener('pointerdown', (e) => {
            dragging = true;
            startX = e.clientX;
            startPaused = photoRail.classList.contains('is-paused');
            photoRail.classList.add('is-paused');
            photoRail.setPointerCapture(e.pointerId);
        });

        const endDrag = () => { dragging = false; };

        photoRail.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            const delta = e.clientX - startX;
            // Scrub the marquee offset by dragging: approximate with scroll position.
            endDrag();
            photoRail.style.transform = '';
            if (!startPaused) {
                photoRail.classList.remove('is-paused');
            }
            if (Math.abs(delta) > 40) {
                nudgeRail(delta > 0 ? -1 : 1);
            }
        });

        photoRail.addEventListener('pointercancel', endDrag);

        // Buttons: nudge one card width, pausing briefly so the move is visible.
        let nudgeTimeout;
        function nudgeRail(direction) {
            const step = (cards[0].offsetWidth + 24) * direction;
            photoRail.classList.add('is-paused');
            // Animate a manual offset on top of the paused animation.
            const current = getComputedStyle(track).transform;
            const matrix = current && current !== 'none' ? new DOMMatrixReadOnly(current) : new DOMMatrixReadOnly();
            const base = matrix.m41;
            track.style.transform = `translateX(${base + step}px)`;
            clearTimeout(nudgeTimeout);
            nudgeTimeout = setTimeout(() => {
                // Hand control back to the CSS animation, which wraps around.
                track.style.transform = '';
                if (pauseBtn && pauseBtn.dataset.paused !== 'true') {
                    photoRail.classList.remove('is-paused');
                }
            }, 700);
        }

        const prevBtn = document.getElementById('rail-prev');
        const nextBtn = document.getElementById('rail-next');
        if (prevBtn) prevBtn.addEventListener('click', () => nudgeRail(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => nudgeRail(1));

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                const paused = photoRail.classList.toggle('is-paused');
                pauseBtn.dataset.paused = paused ? 'true' : 'false';
                pauseBtn.innerHTML = paused
                    ? '<i class="fa-solid fa-play"></i>'
                    : '<i class="fa-solid fa-pause"></i>';
                pauseBtn.setAttribute('aria-label', paused ? 'Resume auto-scroll' : 'Pause auto-scroll');
            });
        }
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
