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

});
