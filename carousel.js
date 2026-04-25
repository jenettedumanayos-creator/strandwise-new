/**
 * Shared Carousel Manager
 * Maintains carousel state across page transitions
 */

const CAROUSEL_IMAGES = [
    'img/carousel/business1.jpg',
    'img/carousel/business2.jpg',
    'img/carousel/cooking.jpg',
    'img/carousel/ict1.jpg',
    'img/carousel/ict2.jpg',
    'img/carousel/lab.jpg',
    'img/carousel/school.jpg',
    'img/carousel/stem1.jpg',
    'img/carousel/stem2.jpg',
    'img/carousel/stem3.jpg'
];

function getCarouselState() {
    try {
        const state = sessionStorage.getItem('carouselState');
        if (state) {
            return JSON.parse(state);
        }
    } catch (_err) {
        // Ignore parse errors
    }
    return {
        activeSlideIndex: 0,
        imageIndex: 0,
        startTime: Date.now()
    };
}

function saveCarouselState(state) {
    sessionStorage.setItem('carouselState', JSON.stringify(state));
}

function initCarousel(selector = '.carousel', numSlides = 2) {
    const carousel = document.querySelector(selector);
    if (!carousel) return;

    // Support both .carousel-slide and .auth-carousel-slide classes
    let slides = carousel.querySelectorAll('.carousel-slide, .auth-carousel-slide');
    
    // If no slides found with classes, try to find all direct children divs
    if (slides.length === 0) {
        slides = carousel.querySelectorAll(':scope > div');
    }
    
    if (slides.length === 0) return;

    // Get or initialize carousel state
    let state = getCarouselState();
    
    // Calculate elapsed time and adjust indices based on time passed
    const elapsedMs = Date.now() - state.startTime;
    const elapsedCycles = Math.floor(elapsedMs / 5000);
    
    state.activeSlideIndex = (state.activeSlideIndex + elapsedCycles) % slides.length;
    state.imageIndex = (state.imageIndex + elapsedCycles) % CAROUSEL_IMAGES.length;
    state.startTime = Date.now();

    // Set initial images based on restored state
    slides.forEach((slide, idx) => {
        const imageIdx = (state.imageIndex - state.activeSlideIndex + idx + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length;
        slide.style.backgroundImage = `url('${CAROUSEL_IMAGES[imageIdx]}')`;
        slide.classList.toggle('is-active', idx === state.activeSlideIndex);
    });

    // Rotate carousel every 5 seconds
    const carouselInterval = setInterval(() => {
        const nextSlideIndex = (state.activeSlideIndex + 1) % slides.length;
        const outgoingSlide = slides[state.activeSlideIndex];
        const incomingSlide = slides[nextSlideIndex];

        incomingSlide.style.backgroundImage = `url('${CAROUSEL_IMAGES[state.imageIndex]}')`;
        state.imageIndex = (state.imageIndex + 1) % CAROUSEL_IMAGES.length;

        outgoingSlide.classList.remove('is-active');
        incomingSlide.classList.add('is-active');

        state.activeSlideIndex = nextSlideIndex;
        
        // Save state for next page
        saveCarouselState(state);
    }, 5000);

    // Save state on page unload/navigation
    window.addEventListener('beforeunload', () => {
        saveCarouselState(state);
    });

    return carouselInterval;
}
