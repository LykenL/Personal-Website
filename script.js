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

    // ==========================================
    // 8. Supabase Guestbook System
    // ==========================================
    const SUPABASE_URL = 'https://gybsybwibbeulzcpcmoq.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_pDG7jhUoENrQ8x3oAOqjxA_1_tyL39m';

    const guestbookForm = document.getElementById('guestbook-form');
    const messagesContainer = document.getElementById('guestbook-messages');
    const messageCountBadge = document.getElementById('gb-count');
    const submitBtn = document.getElementById('gb-submit-btn');
    const statusText = document.getElementById('gb-status');

    let sb = null;
    if (window.supabase) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatTime(isoStr) {
        if (!isoStr) return '';
        try {
            const date = new Date(isoStr);
            const now = new Date();
            const diffSec = Math.floor((now - date) / 1000);
            const isZh = !document.body.classList.contains('lang-en');

            if (diffSec < 60) return isZh ? '刚刚' : 'Just now';
            if (diffSec < 3600) {
                const mins = Math.floor(diffSec / 60);
                return isZh ? `${mins} 分钟前` : `${mins}m ago`;
            }
            if (diffSec < 86400) {
                const hours = Math.floor(diffSec / 3600);
                return isZh ? `${hours} 小时前` : `${hours}h ago`;
            }
            if (diffSec < 2592000) {
                const days = Math.floor(diffSec / 86400);
                return isZh ? `${days} 天前` : `${days}d ago`;
            }
            return date.toLocaleDateString();
        } catch (e) {
            return isoStr;
        }
    }

    async function loadMessages() {
        if (!sb || !messagesContainer) return;

        try {
            const { data, error } = await sb
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.warn('Supabase fetch messages error:', error);
                const isZh = !document.body.classList.contains('lang-en');
                messagesContainer.innerHTML = `
                    <div class="gb-empty">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>${isZh ? '暂未连接到数据表，请先在 Supabase 运行建表脚本' : 'Database table not found. Please run SQL script in Supabase.'}</span>
                    </div>
                `;
                if (messageCountBadge) messageCountBadge.textContent = isZh ? '0 条留言' : '0 messages';
                return;
            }

            const isZh = !document.body.classList.contains('lang-en');
            const count = data ? data.length : 0;
            if (messageCountBadge) {
                messageCountBadge.textContent = isZh ? `${count} 条留言` : `${count} ${count === 1 ? 'message' : 'messages'}`;
            }

            if (!data || data.length === 0) {
                messagesContainer.innerHTML = `
                    <div class="gb-empty">
                        <i class="fa-regular fa-comment-dots"></i>
                        <span>${isZh ? '目前还没有留言，成为第一个留下足迹的人吧！' : 'No messages yet. Be the first to say hi!'}</span>
                    </div>
                `;
                return;
            }

            messagesContainer.innerHTML = data.map(msg => {
                const nickname = escapeHtml(msg.nickname || '访客');
                const content = escapeHtml(msg.content || '');
                const time = formatTime(msg.created_at);
                const initial = nickname.charAt(0).toUpperCase();

                return `
                    <div class="message-item">
                        <div class="message-meta">
                            <div class="message-author">
                                <div class="author-avatar">${initial}</div>
                                <span class="author-name">${nickname}</span>
                            </div>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-text">${content}</div>
                    </div>
                `;
            }).join('');

        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    if (guestbookForm && sb) {
        guestbookForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nicknameInput = document.getElementById('gb-nickname');
            const contentInput = document.getElementById('gb-content');
            const isZh = !document.body.classList.contains('lang-en');

            const nickname = nicknameInput.value.trim();
            const content = contentInput.value.trim();

            if (!nickname || !content) return;

            submitBtn.disabled = true;
            const originalBtnHtml = submitBtn.innerHTML;
            submitBtn.innerHTML = `
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span>${isZh ? '正在发送...' : 'Sending...'}</span>
            `;
            statusText.className = 'form-status';
            statusText.textContent = '';

            try {
                const { error } = await sb
                    .from('messages')
                    .insert([{ nickname, content }]);

                if (error) {
                    throw error;
                }

                statusText.className = 'form-status success';
                statusText.textContent = isZh ? '留言成功！🎉' : 'Message posted! 🎉';
                nicknameInput.value = '';
                contentInput.value = '';

                // Reload message list
                await loadMessages();

                setTimeout(() => {
                    statusText.textContent = '';
                }, 4000);

            } catch (err) {
                console.error('Submit message error:', err);
                statusText.className = 'form-status error';
                statusText.textContent = isZh ? '发送失败，请检查数据库权限设置' : 'Failed to send. Please check database permissions.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });

        // Initial fetch
        loadMessages();
    }

});
