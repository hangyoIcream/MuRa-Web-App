/**
 * APP STATE & CONFIGURATION
 */
const state = {
    verses: [],        // Processed verses
    favorites: [],     // Array of verse IDs
    isDarkMode: false,
    searchQuery: '',
    currentPage: 1,
    itemsPerPage: 1101,
    currentRoute: 'home' // 'home', 'favorites', 'detail'
};

// Define all available verse IDs to load
// UPDATED: Now includes IDs 1 through 10
//const ALL_VERSE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]; 
const ALL_VERSE_IDS = Array.from({ length: 1101 }, (_, i) => i + 1);

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    // Start data loading process
    initData(); 
});

/**
 * DATA PROCESSING & LOADING (Uses Fetch to load individual JSON files)
 */
async function initData() {
    console.log("Starting data initialization and JSON fetching...");
    
    // 1. Load Favorites from localStorage
    const savedFavs = localStorage.getItem('kagga_favs');
    if (savedFavs) state.favorites = JSON.parse(savedFavs);
    
    // 2. Fetch all JSON files concurrently
    const fetchPromises = ALL_VERSE_IDS.map(id => 
        // UPDATED FETCH URL: Added '.0' to match the actual file names (e.g., verse_1.0.json)
        fetch(`data/verse_${id}.0.json`)
            .then(res => {
                if (!res.ok) {
                    // This error will now be more accurate if a file is still missing
                    throw new Error(`Failed to load verse ${id} with status ${res.status}`);
                }
                return res.json();
            })
    );

    try {
        // Wait for all fetches to complete
        const allVerseLines = await Promise.all(fetchPromises);
        
        // Flatten the array of arrays (since each JSON is an array of lines)
        const rawData = allVerseLines.flat();

        // 3. Group lines into Verses
        const grouped = {};
        rawData.forEach(record => {
            // Note: The original JSON data structure uses 'verse_number' which is often a float (1.0)
            // Using Math.floor ensures we get a clean integer ID for the app logic
            const vNum = Math.floor(record.verse_number);
            if (!grouped[vNum]) {
                grouped[vNum] = {
                    id: vNum,
                    chapter: record.chapter,
                    lines: []
                };
            }
            grouped[vNum].lines.push(record);
        });

        // 4. Sort lines and convert to array
        state.verses = Object.values(grouped).map(verse => {
            verse.lines.sort((a, b) => (a.line_number || 0) - (b.line_number || 0));
            return verse;
        }).sort((a, b) => a.id - b.id);

        console.log(`Successfully loaded and processed ${state.verses.length} verses.`);
        
        // 5. Start Routing after successful data load
        handleRouting(); 

    } catch (error) {
        console.error("Critical Error: Failed to load verses due to network or CORS issue.", error);
        document.getElementById('app-container').innerHTML = `
            <div class="text-center mt-20 p-8 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg shadow-md">
                <h3 class="text-xl font-bold mb-3">Data Load Error</h3>
                <p class="text-lg">Could not load verse data. This is often caused by trying to load local JSON files (using <code>fetch</code>) without a web server.</p>
                <p class="mt-2 text-sm">Please open <code>index.html</code> using a local server (like "Live Server").</p>
                <p class="mt-4 text-xs font-mono">${error.message}</p>
            </div>
        `;
    }
}


/**
 * THEME HANDLING
 */
function initTheme() {
    const savedTheme = localStorage.getItem('kagga_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        setTheme(true);
    } else {
        setTheme(false);
    }
}

function setTheme(isDark) {
    state.isDarkMode = isDark;
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    
    if (isDark) {
        html.classList.add('dark');
        localStorage.setItem('kagga_theme', 'dark');
        if(icon) icon.setAttribute('data-lucide', 'sun');
        if(text) text.textContent = 'Light Mode';
    } else {
        html.classList.remove('dark');
        localStorage.setItem('kagga_theme', 'light');
        if(icon) icon.setAttribute('data-lucide', 'moon');
        if(text) text.textContent = 'Dark Mode';
    }
    // Re-render icons dynamically after theme change
    if(window.lucide) lucide.createIcons(); 
}

/**
 * ROUTING (Hash Based)
 */
window.addEventListener('hashchange', handleRouting);

function handleRouting() {
    const hash = window.location.hash;
    const title = document.getElementById('page-title');
    const menuBtn = document.getElementById('menu-btn');
    const backBtn = document.getElementById('back-btn');
    const searchContainer = document.getElementById('search-container');
    const mobileSearchBtn = document.getElementById('mobile-search-toggle');

    // Reset Scroll and UI elements
    window.scrollTo(0, 0);
    menuBtn.classList.remove('hidden');
    backBtn.classList.add('hidden');
    // Keep search visible by default, hiding only in detail
    searchContainer.style.display = 'block'; 
    mobileSearchBtn.style.display = 'block';

    if (hash.startsWith('#verse/')) {
        // Detail Page
        const id = parseInt(hash.split('/')[1]);
        state.currentRoute = 'detail';
        renderDetail(id);
        title.textContent = `Verse ${id}`;
        menuBtn.classList.add('hidden');
        backBtn.classList.remove('hidden');
        searchContainer.style.display = 'none';
        mobileSearchBtn.style.display = 'none';
    } else if (hash === '#favorites') {
        // Favorites Page
        state.currentRoute = 'favorites';
        title.textContent = 'ಮೆಚ್ಚಿನವುಗಳು'; // Favorites
        renderList(true);
        // Custom back button to go to home from favorites
        backBtn.classList.remove('hidden');
        backBtn.onclick = () => window.location.hash = ''; 
        menuBtn.classList.add('hidden');
    } else {
        // Home Page
        state.currentRoute = 'home';
        title.textContent = 'Mudduramana Manasu';
        state.currentPage = 1; // Reset pagination
        renderList(false);
        backBtn.classList.add('hidden');
        menuBtn.classList.remove('hidden');
    }
    
    // Refresh icons on the page
    if(window.lucide) lucide.createIcons();
}

/**
 * RENDERING LOGIC
 */
function renderList(onlyFavorites) {
    const container = document.getElementById('app-container');
    // Clear content only if not appending (i.e., not a subsequent page load)
    if (state.currentPage === 1 || state.searchQuery) {
        container.innerHTML = '';
    }

    // Filter
    let displayData = state.verses;
    if (onlyFavorites) {
        displayData = displayData.filter(v => state.favorites.includes(v.id));
    }

    // Search Filter
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        displayData = displayData.filter(v => {
            const rawText = v.lines.map(l => 
                (l.kannada_original || '') + 
                (l.english_transliteration || '') + 
                (l.english_translation || '')
            ).join(' ').toLowerCase();
            return rawText.includes(q) || (v.chapter || '').toLowerCase().includes(q) || v.id.toString().includes(q);
        });
    }

    // Pagination Slice
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const limit = start + state.itemsPerPage;
    const slicedData = state.searchQuery ? displayData : displayData.slice(0, limit);

    if (slicedData.length === 0) {
        container.innerHTML = `<div class="text-center mt-20 text-gray-500">No verses found.</div>`;
        return;
    }

    // If searching, display all results. If paginating, only show the new items.
    const renderData = state.searchQuery ? slicedData : slicedData.slice(start);

    if (state.searchQuery && state.currentPage === 1) {
        // If searching, re-render everything
        container.innerHTML = '';
        slicedData.forEach(verse => {
            container.appendChild(createVerseCard(verse));
        });
    } else {
         // Standard pagination: append new items
        renderData.forEach(verse => {
            container.appendChild(createVerseCard(verse));
        });
    }


    // Handle Load More trigger
    // Only show "Load More" if not searching and we haven't loaded everything
    if (!state.searchQuery && slicedData.length < displayData.length) {
        
        // Remove existing load more placeholder if it exists
        const oldLoadMore = document.getElementById('load-more-placeholder');
        if (oldLoadMore) oldLoadMore.remove();

        const loadMore = document.createElement('div');
        loadMore.id = 'load-more-placeholder';
        loadMore.className = 'py-8 text-center text-gray-400 text-sm';
        loadMore.innerText = 'Loading more...';
        container.appendChild(loadMore);
        
        // Intersection Observer for Infinite Scroll
        const observer = new IntersectionObserver((entries) => {
            if(entries[0].isIntersecting) {
                observer.unobserve(loadMore); // Stop observing before updating
                state.currentPage++;
                renderList(onlyFavorites); // Re-render with more items (appends)
            }
        }, {
            rootMargin: '0px 0px 100px 0px'
        });
        observer.observe(loadMore);
    } else if (!state.searchQuery && slicedData.length === displayData.length && displayData.length > state.itemsPerPage) {
        // All data loaded message
        const oldLoadMore = document.getElementById('load-more-placeholder');
        if (oldLoadMore) oldLoadMore.remove();
        
        const endMessage = document.createElement('div');
        endMessage.className = 'py-8 text-center text-gray-500 text-xs';
        endMessage.innerText = '— End of Verses —';
        container.appendChild(endMessage);
    }
}

function createVerseCard(verse) {
    const isFav = state.favorites.includes(verse.id);
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-kagga-darkCard shadow-sm rounded-xl p-4 mb-3 flex items-start gap-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 dark:border-gray-800 animate-fade-in';
    
    // Preview Text (4 lines)
    const textPreview = verse.lines.slice(0, 4).map(l => l.kannada_original).join('<br>');

    card.innerHTML = `
        <div class="text-2xl font-bold text-gray-300 dark:text-gray-600 font-sans min-w-[2rem] text-center mt-1">${verse.id}</div>
        <div class="flex-1">
            <p class="text-gray-800 dark:text-gray-200 font-kannada text-lg leading-relaxed">${textPreview}</p>
        </div>
        <button class="fav-btn p-2 -mr-2 -mt-2 z-10" data-id="${verse.id}">
            <i data-lucide="heart" class="w-5 h-5 transition-colors duration-300 ${isFav ? 'fill-kagga-orange text-kagga-orange' : 'text-gray-400'}"></i>
        </button>
    `;

    // Click to Navigate
    card.onclick = (e) => {
        // If clicked heart, don't navigate
        if(e.target.closest('.fav-btn')) return;
        window.location.hash = `#verse/${verse.id}`;
    };

    // Favorite Click
    const favBtn = card.querySelector('.fav-btn');
    favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(verse.id);
        const icon = favBtn.querySelector('i');
        const newStatus = state.favorites.includes(verse.id);
        
        // Toggle icon visual
        icon.classList.toggle('fill-kagga-orange', newStatus);
        icon.classList.toggle('text-kagga-orange', newStatus);
        icon.classList.toggle('text-gray-400', !newStatus);
        
        // Add pop animation
        icon.parentElement.classList.add('heart-pop');
        setTimeout(() => icon.parentElement.classList.remove('heart-pop'), 300);
        
        // If on favorites page and unfavorited, remove card immediately
        if(state.currentRoute === 'favorites' && !newStatus) {
            // Remove with a quick fade out animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(-10px)';
            setTimeout(() => card.remove(), 300);
        }
        
        // Re-render favorites list if filtering is active and something changed
        if(state.currentRoute === 'favorites') {
             // A slight delay ensures the animation can start before the list re-renders if necessary
             setTimeout(() => renderList(true), 350); 
        }
    };

    return card;
}

function renderDetail(id) {
    const container = document.getElementById('app-container');
    const verse = state.verses.find(v => v.id === id);
    
    if (!verse) {
        container.innerHTML = '<div class="text-center mt-10">Verse not found</div>';
        return;
    }

    const isFav = state.favorites.includes(verse.id);

    container.innerHTML = `
        <div class="bg-white dark:bg-kagga-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in">
            <div class="bg-orange-50 dark:bg-gray-800/50 p-4 flex justify-between items-center border-b border-orange-100 dark:border-gray-700">
                <div>
                    <span class="text-xs font-bold text-kagga-orange uppercase tracking-wider">Verse ${verse.id}</span>
                    <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 font-kannada">${verse.chapter}</h2>
                </div>
                <div class="flex gap-2">
                     <button id="detail-fav-btn" class="p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm">
                        <i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-kagga-orange text-kagga-orange' : 'text-gray-400'}"></i>
                     </button>
                     <button id="detail-share-btn" class="p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm">
                        <i data-lucide="share-2" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>
                     </button>
                </div>
            </div>

            <div class="p-6 space-y-8">
                <div class="space-y-2">
                    <h3 class="text-xs uppercase text-gray-400 font-bold">Original</h3>
                    <p class="font-kannada text-2xl leading-loose text-gray-900 dark:text-gray-100">
                        ${verse.lines.map(l => `<span class="block">${l.kannada_original || '---'}</span>`).join('')}
                    </p>
                </div>

                <div class="space-y-2">
                    <h3 class="text-xs uppercase text-gray-400 font-bold">Transliteration</h3>
                    <p class="font-sans text-lg italic text-gray-600 dark:text-gray-400">
                         ${verse.lines.map(l => `<span class="block">${l.english_transliteration || '---'}</span>`).join('')}
                    </p>
                </div>

                <div class="space-y-2">
                    <h3 class="text-xs uppercase text-gray-400 font-bold">Translation</h3>
                    <p class="font-sans text-lg text-gray-700 dark:text-gray-300">
                         ${verse.lines.map(l => `<span>${l.english_translation || '---'} </span>`).join('')}
                    </p>
                </div>
            </div>
        </div>
    `;

    // Handle Detail Fav Click
    const detailFavBtn = document.getElementById('detail-fav-btn');
    detailFavBtn.onclick = () => {
        toggleFavorite(verse.id);
        const icon = detailFavBtn.querySelector('i');
        const newStatus = state.favorites.includes(verse.id);
        icon.classList.toggle('fill-kagga-orange', newStatus);
        icon.classList.toggle('text-kagga-orange', newStatus);
        icon.classList.toggle('text-gray-400', !newStatus);
    };

    // Handle Share Button
    document.getElementById('detail-share-btn').onclick = () => {
        const text = `Verse ${verse.id}: ${verse.lines.map(l => l.kannada_original).join(' / ')}`;
        shareApp(text);
    };
    
    // Refresh icons
    if(window.lucide) lucide.createIcons();
}

/**
 * ACTIONS & UTILS
 */
function toggleFavorite(id) {
    const index = state.favorites.indexOf(id);
    if (index === -1) {
        state.favorites.push(id);
    } else {
        state.favorites.splice(index, 1);
    }
    localStorage.setItem('kagga_favs', JSON.stringify(state.favorites));
}

function setupEventListeners() {
    // Drawer Toggles
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const openBtn = document.getElementById('menu-btn');
    const closeBtn = document.getElementById('close-drawer-btn');

    const openDrawer = () => {
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        drawer.classList.remove('-translate-x-full');
    };
    
    const closeDrawer = () => {
        overlay.classList.add('opacity-0');
        drawer.classList.add('-translate-x-full');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    };

    openBtn.onclick = openDrawer;
    closeBtn.onclick = closeDrawer;
    overlay.onclick = closeDrawer;

    // Search Inputs
    const handleSearch = (e) => {
        state.searchQuery = e.target.value;
        // Sync both search bars
        document.getElementById('search-input').value = state.searchQuery;
        document.getElementById('mobile-search-input').value = state.searchQuery;
        
        state.currentPage = 1;
        // Only re-render if on home or favorites
        if(state.currentRoute !== 'detail') renderList(state.currentRoute === 'favorites');
    };

    document.getElementById('search-input').oninput = handleSearch;
    document.getElementById('mobile-search-input').oninput = handleSearch;

    // Mobile Search Toggle
    const mobileSearchToggle = document.getElementById('mobile-search-toggle');
    const mobileSearchBar = document.getElementById('mobile-search-bar');
    mobileSearchToggle.onclick = () => {
        mobileSearchBar.classList.toggle('hidden');
        if(!mobileSearchBar.classList.contains('hidden')) {
            document.getElementById('mobile-search-input').focus();
        }
    };

    // Nav Heart (Favorites)
    document.getElementById('nav-fav-btn').onclick = () => {
        window.location.hash = '#favorites';
    };

    // Back Button (Logic varies by history)
    document.getElementById('back-btn').onclick = () => {
        // Use browser history for detail pages, custom hash change for favorites page
        if (state.currentRoute === 'favorites') {
             window.location.hash = ''; // Go to home
        } else {
             window.history.back();
        }
    };

    // Theme Toggle
    document.getElementById('theme-toggle').onclick = () => {
        setTheme(!state.isDarkMode);
    };
}

// Global Share function (Web Share API)
window.shareApp = (text) => {
    const shareData = {
        title: 'Mudduramana Manasu',
        text: text || 'Read the wisdom of K. C. Shivappa in this Mudduramana Manasu App!',
        url: window.location.href
    };
    if (navigator.share) {
        navigator.share(shareData);
    } else {
        // Fallback for browsers without Web Share API
        console.log(`Share: "${shareData.text}" at ${shareData.url}`);
    }
};