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

    // 5. Image Slider Logic
    const sliders = document.querySelectorAll('.slider-container');
    
    sliders.forEach(container => {
        const slider = container.querySelector('.slider');
        const btnPrev = container.querySelector('.slider-btn.prev');
        const btnNext = container.querySelector('.slider-btn.next');

        if (slider && btnPrev && btnNext) {
            btnPrev.addEventListener('click', () => {
                slider.scrollBy({ left: -slider.offsetWidth, behavior: 'smooth' });
            });

            btnNext.addEventListener('click', () => {
                slider.scrollBy({ left: slider.offsetWidth, behavior: 'smooth' });
            });
        }
    });

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

    const typewriterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                if (!element.classList.contains('typed')) {
                    element.classList.add('typed');
                    
                    // Filter to only animate characters inside the currently visible language
                    // This prevents double waiting time for bilingual text
                    const isEnglish = document.body.classList.contains('lang-en');
                    const chars = element.querySelectorAll('.char');
                    
                    let delay = 0;
                    chars.forEach(char => {
                        const parentLangZh = char.closest('.lang-zh');
                        const parentLangEn = char.closest('.lang-en');
                        
                        // If it's inside a language span that is currently hidden, show it instantly to be ready for toggling
                        if ((isEnglish && parentLangZh) || (!isEnglish && parentLangEn)) {
                            char.style.opacity = '1';
                        } else {
                            // Animate visible characters
                            setTimeout(() => {
                                char.style.opacity = '1';
                            }, delay);
                            // Adjust speed based on Chinese vs English (English needs faster typing per char to match reading speed)
                            const isChineseChar = /[\u4e00-\u9fa5]/.test(char.textContent);
                            delay += isChineseChar ? 30 : 15;
                        }
                    });
                }
            }
        });
    }, { threshold: 0.1 });

    typewriters.forEach(tw => {
        typewriterObserver.observe(tw);
    });

});
