let books = JSON.parse(localStorage.getItem('ios_books_db')) || [];
let yearlyGoal = parseInt(localStorage.getItem('ios_yearly_goal')) || 15;
let currentStatus = 'read';
let viewMode = 'grid';
let modalStatus = 'read';
let currentRating = 0;
let searchTimeout = null;
let lastSearchResults = [];

const booksContainer = document.getElementById('books-container');
const discoverResultsContainer = document.getElementById('discover-results-container');
const localSearchInput = document.getElementById('local-search');
const sortSelect = document.getElementById('sort-select');
const bookModal = document.getElementById('book-modal');
const ratingInput = document.getElementById('rating-Input');
const ratingDisplay = document.getElementById('rating-display');
const readMonthSelect = document.getElementById('book-read-month');
const readYearSelect = document.getElementById('book-read-year');

document.addEventListener('DOMContentLoaded', () => {
  const currentYear = new Date().getFullYear();
  document.getElementById('current-year-label').textContent = currentYear;
  initYearSelector(currentYear);
  initInteractiveStars();
  setupEventListeners();
  updateSortOptions();
  refreshAllViews();
  repairMissingCoversAndPages();
});

function initYearSelector(currentYear) {
  let html = '';
  for (let y = currentYear; y >= 2000; y--) {
    html += `<option value="${y}">${y}</option>`;
  }
  readYearSelect.innerHTML = html;
}

function saveToStorage() {
  localStorage.setItem('ios_books_db', JSON.stringify(books));
  refreshAllViews();
}

function refreshAllViews() {
  renderLibrary();
  updateGenreFilterOptions();
  renderDiscoverResults();
  renderStats();
}

// Traducir géneros habituales de Google Books al español
function normalizeGenre(rawGenre) {
  if (!rawGenre) return '';
  const g = rawGenre.trim();
  const map = {
    'Fiction': 'Ficción',
    'Science Fiction': 'Ciencia Ficción',
    'Juvenile Fiction': 'Narrativa Juvenil',
    'Mystery & Detective': 'Novela Negra',
    'Thrillers': 'Suspense',
    'Fantasy': 'Fantasía',
    'Biography & Autobiography': 'Biografía',
    'History': 'Historia',
    'Business & Economics': 'Empresa y Economía',
    'Psychology': 'Psicología',
    'Philosophy': 'Filosofía',
    'Self-Help': 'Desarrollo Personal',
    'Libros': ''
  };
  return map[g] !== undefined ? map[g] : g;
}

function formatStarsText(rating) {
  const num = parseFloat(rating);
  if (!num || num <= 0) return '';
  const full = Math.floor(num);
  const half = num % 1 !== 0 ? '½' : '';
  return `${'★'.repeat(full)}${half} ${num.toFixed(1)}`;
}

function formatYearMonth(yyyyMm) {
  if (!yyyyMm || !yyyyMm.includes('-')) return '';
  const [y, m] = yyyyMm.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(m, 10) - 1] || ''} ${y}`;
}

function updateSortOptions() {
  const val = sortSelect.value;
  if (currentStatus === 'wishlist') {
    sortSelect.innerHTML = `
      <option value="recent">Recientes</option>
      <option value="title">Título</option>
      <option value="author">Autor</option>
      <option value="pages">Páginas</option>
    `;
  } else {
    sortSelect.innerHTML = `
      <option value="recent">Recientes</option>
      <option value="rating">Mejor nota</option>
      <option value="title">Título</option>
      <option value="author">Autor</option>
      <option value="pages">Páginas</option>
    `;
  }
  sortSelect.value = Array.from(sortSelect.options).some(o => o.value === val) ? val : 'recent';
}

function createBookCardGridHTML(b) {
  const sagaBadge = b.saga ? `<span class="badge-top">${b.saga}${b.sagaNum ? ' #' + b.sagaNum : ''}</span>` : '';
  const coverHtml = b.cover
    ? `<img src="${b.cover}" alt="${b.title}" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="cover-placeholder"><div class="cover-placeholder-title">${b.title}</div><div class="cover-placeholder-author">${b.author}</div></div>`;

  const metaLine = b.status === 'wishlist'
    ? (b.pages ? `<div class="book-author-grid">${b.pages} págs.</div>` : '')
    : (b.rating > 0 ? `<div class="book-rating-grid">${formatStarsText(b.rating)}</div>` : '');

  const dateLine = (b.status === 'read' && b.readDate)
    ? `<div class="book-date-grid">${formatYearMonth(b.readDate)}</div>` : '';

  return `
    <div class="book-card-grid" onclick="openEditModal('${b.id}')">
      <div class="cover-wrapper">${coverHtml}${sagaBadge}</div>
      <div class="book-title-grid">${b.title}</div>
      <div class="book-author-grid">${b.author}</div>
      ${metaLine}
      ${dateLine}
    </div>
  `;
}

function renderLibrary() {
  const query = localSearchInput.value.toLowerCase().trim();
  const sortBy = sortSelect.value;

  let filtered = books.filter(b => b.status === currentStatus);

  if (query) {
    filtered = filtered.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      (b.saga && b.saga.toLowerCase().includes(query))
    );
  }

  filtered.sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'author') return a.author.localeCompare(b.author);
    if (sortBy === 'pages') return (b.pages || 0) - (a.pages || 0);
    return b.createdAt - a.createdAt;
  });

  booksContainer.className = viewMode === 'grid' ? 'books-grid' : 'books-list';

  if (filtered.length === 0) {
    booksContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg></div>
        <h3>Tu estantería está vacía</h3>
        <p>Añade un libro con el botón <b>＋</b> o sube tu archivo Excel con <b>↑</b></p>
      </div>`;
    return;
  }

  if (viewMode === 'grid') {
    booksContainer.innerHTML = filtered.map(b => createBookCardGridHTML(b)).join('');
  } else {
    booksContainer.innerHTML = filtered.map(b => {
      const sagaText = b.saga ? ` · ${b.saga}${b.sagaNum ? ' #' + b.sagaNum : ''}` : '';
      let rightInfo = '';
      if (b.status === 'wishlist') {
        rightInfo = b.pages ? `<span style="color:var(--text-secondary)">${b.pages} p.</span>` : '';
      } else {
        const star = b.rating > 0 ? `${b.rating.toFixed(1)} ★` : '';
        const dateStr = (b.status === 'read' && b.readDate) ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${formatYearMonth(b.readDate)}</div>` : '';
        rightInfo = `<div>${star}${dateStr}</div>`;
      }

      return `
        <div class="book-row-list" onclick="openEditModal('${b.id}')">
          ${b.cover ? `<img src="${b.cover}" referrerpolicy="no-referrer" class="list-thumb" />` : `<div class="list-thumb"></div>`}
          <div class="list-info">
            <div class="list-title">${b.title}</div>
            <div class="list-sub">${b.author}${sagaText}</div>
          </div>
          <div class="list-meta">${rightInfo}</div>
        </div>
      `;
    }).join('');
  }
}

function renderDiscoverResults() {
  const activePills = Array.from(document.querySelectorAll('#decide-length .pill.active')).map(btn => btn.dataset.length);
  const selectedGenre = document.getElementById('decide-genre').value;

  let pool = books.filter(b => b.status === 'wishlist');

  if (activePills.length > 0 && activePills.length < 3) {
    pool = pool.filter(b => {
      const p = parseInt(b.pages) || 0;
      if (!p) return false;
      const isShort = activePills.includes('short') && p < 250;
      const isMedium = activePills.includes('medium') && p >= 250 && p <= 450;
      const isLong = activePills.includes('long') && p > 450;
      return isShort || isMedium || isLong;
    });
  }

  if (selectedGenre !== 'all') pool = pool.filter(b => b.genre === selectedGenre);

  document.getElementById('discover-count').textContent = `${pool.length} ${pool.length === 1 ? 'libro' : 'libros'}`;

  if (pool.length === 0) {
    discoverResultsContainer.innerHTML = `<div class="empty-state" style="padding:32px 20px"><p style="margin:0">Ningún libro en "Por leer" coincide con estos filtros.</p></div>`;
    return;
  }
  discoverResultsContainer.innerHTML = pool.map(b => createBookCardGridHTML(b)).join('');
}

// MOTOR DE BÚSQUEDA HÍBRIDO EN ESPAÑOL (Apple Books España + Google Books ES + Open Library)
async function fetchSpanishBookCandidates(query) {
  const results = [];

  const [appleRes, googleRes, olRes] = await Promise.allSettled([
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=es&media=ebook&entity=ebook&limit=5`).then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=es&maxResults=5`).then(r => r.json()),
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,number_of_pages_median,cover_i&limit=5`).then(r => r.json())
  ]);

  // Extraer páginas de respaldo de Open Library y Google Books
  let fallbackPages = null;
  if (googleRes.status === 'fulfilled' && googleRes.value?.items) {
    const withPages = googleRes.value.items.find(i => i.volumeInfo?.pageCount > 0);
    if (withPages) fallbackPages = withPages.volumeInfo.pageCount;
  }
  if (!fallbackPages && olRes.status === 'fulfilled' && olRes.value?.docs) {
    const withPages = olRes.value.docs.find(d => d.number_of_pages_median > 0);
    if (withPages) fallbackPages = withPages.number_of_pages_median;
  }

  // 1. Apple Books España (Portadas oficiales en español de alta calidad, nunca bloquea)
  if (appleRes.status === 'fulfilled' && appleRes.value?.results) {
    appleRes.value.results.forEach(item => {
      const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x600bb') : '';
      const rawGenre = Array.isArray(item.genres) ? item.genres.find(g => g !== 'Libros') || '' : '';
      results.push({
        title: item.trackName || '',
        author: item.artistName || '',
        pages: fallbackPages || '',
        genre: normalizeGenre(rawGenre),
        cover
      });
    });
  }

  // 2. Google Books en Español
  if (googleRes.status === 'fulfilled' && googleRes.value?.items) {
    googleRes.value.items.forEach(item => {
      const info = item.volumeInfo || {};
      let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
      if (cover) cover = cover.replace('http://', 'https://').replace('&edge=curl', '');

      const exists = results.some(r => r.title.toLowerCase() === (info.title || '').toLowerCase());
      if (!exists && info.title) {
        results.push({
          title: info.title,
          author: info.authors ? info.authors.join(', ') : 'Autor desconocido',
          pages: info.pageCount || fallbackPages || '',
          genre: normalizeGenre(info.categories ? info.categories[0] : ''),
          cover
        });
      } else if (exists && info.pageCount) {
        const match = results.find(r => r.title.toLowerCase() === info.title.toLowerCase());
        if (match && !match.pages) match.pages = info.pageCount;
      }
    });
  }

  // 3. Open Library si los anteriores no devolvieron nada
  if (results.length === 0 && olRes.status === 'fulfilled' && olRes.value?.docs) {
    olRes.value.docs.forEach(doc => {
      results.push({
        title: doc.title || 'Sin título',
        author: doc.author_name ? doc.author_name.join(', ') : 'Autor desconocido',
        pages: doc.number_of_pages_median || '',
        genre: '',
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : ''
      });
    });
  }

  return results.slice(0, 6);
}

async function searchBooksOnline(query) {
  const resultsBox = document.getElementById('api-results');
  if (query.trim().length < 2) {
    resultsBox.classList.add('hidden');
    return;
  }

  try {
    lastSearchResults = await fetchSpanishBookCandidates(query);
    if (lastSearchResults.length === 0) {
      resultsBox.classList.add('hidden');
      return;
    }

    resultsBox.innerHTML = lastSearchResults.map((item, idx) => `
      <div class="api-item" onclick="selectSearchResult(${idx})">
        ${item.cover ? `<img src="${item.cover}" referrerpolicy="no-referrer" />` : `<div style="width:34px;height:52px;background:#ddd;border-radius:3px;flex-shrink:0"></div>`}
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${item.author} ${item.pages ? `· ${item.pages} págs.` : ''}</div>
        </div>
      </div>
    `).join('');

    resultsBox.classList.remove('hidden');
  } catch (err) {
    console.error('Error buscando libros:', err);
  }
}

window.selectSearchResult = async function(idx) {
  const data = lastSearchResults[idx];
  if (!data) return;

  document.getElementById('book-title').value = data.title;
  document.getElementById('book-author').value = data.author;
  document.getElementById('book-pages').value = data.pages || '';
  document.getElementById('book-genre').value = data.genre || '';
  document.getElementById('book-cover-url').value = data.cover || '';

  const previewImg = document.getElementById('preview-cover');
  if (data.cover) {
    previewImg.src = data.cover;
    previewImg.classList.remove('hidden');
  } else {
    previewImg.classList.add('hidden');
  }

  document.getElementById('api-results').classList.add('hidden');
  document.getElementById('api-search-input').value = '';

  // Si aún faltan las páginas exactas, las busca en segundo plano por título
  if (!data.pages) {
    const pages = await fetchPageCountFallback(data.title, data.author);
    if (pages) document.getElementById('book-pages').value = pages;
  }
};

async function fetchPageCountFallback(title, author) {
  try {
    const q = `${title} ${author || ''}`.trim();
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=number_of_pages_median&limit=3`);
    const data = await res.json();
    const docWithPages = (data.docs || []).find(d => d.number_of_pages_median > 0);
    if (docWithPages) return docWithPages.number_of_pages_median;
  } catch (e) {}
  return null;
}

// Buscador visual de portadas alternativas dentro del modal
async function openCoverPicker() {
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const pickerBox = document.getElementById('cover-picker-box');

  if (!title) return alert('Escribe primero el título del libro.');

  pickerBox.innerHTML = `<span style="grid-column:1/-1;font-size:12px;color:var(--text-secondary);text-align:center">Buscando portadas en español...</span>`;
  pickerBox.classList.remove('hidden');

  const candidates = await fetchSpanishBookCandidates(`${title} ${author}`);
  const covers = candidates.map(c => c.cover).filter(Boolean);

  if (covers.length === 0) {
    pickerBox.innerHTML = `<span style="grid-column:1/-1;font-size:12px;color:var(--text-secondary);text-align:center">No se encontraron más portadas.</span>`;
    return;
  }

  pickerBox.innerHTML = covers.map(url => `
    <img src="${url}" referrerpolicy="no-referrer" class="cover-picker-item" onclick="setPickedCover('${url}')" />
  `).join('');
}

window.setPickedCover = function(url) {
  document.getElementById('book-cover-url').value = url;
  const previewImg = document.getElementById('preview-cover');
  previewImg.src = url;
  previewImg.classList.remove('hidden');
  document.getElementById('cover-picker-box').classList.add('hidden');
};

function initInteractiveStars() {
  const container = document.getElementById('star-touch-container');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'star-svg');
    svg.addEventListener('click', (e) => {
      const rect = svg.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isHalf = clickX < rect.width / 2;
      setRatingValue(isHalf ? i - 0.5 : i);
    });
    container.appendChild(svg);
  }
  document.getElementById('btn-clear-rating').addEventListener('click', () => setRatingValue(0));
  setRatingValue(0);
}

function setRatingValue(val) {
  currentRating = parseFloat(val) || 0;
  ratingInput.value = currentRating;
  ratingDisplay.textContent = currentRating > 0 ? `${currentRating.toFixed(1)} ★` : 'Sin nota';

  const svgs = document.querySelectorAll('#star-touch-container .star-svg');
  svgs.forEach((svg, idx) => {
    const starNum = idx + 1;
    const gradId = `half-grad-${starNum}`;
    let fillType = 'empty';
    if (currentRating >= starNum) fillType = 'full';
    else if (currentRating >= starNum - 0.5) fillType = 'half';

    const pathD = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

    if (fillType === 'full') {
      svg.innerHTML = `<path d="${pathD}" fill="#FF9F0A" stroke="#FF9F0A" stroke-width="1.5" stroke-linejoin="round"/>`;
    } else if (fillType === 'half') {
      svg.innerHTML = `<defs><linearGradient id="${gradId}"><stop offset="50%" stop-color="#FF9F0A"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><path d="${pathD}" fill="url(#${gradId})" stroke="#FF9F0A" stroke-width="1.5" stroke-linejoin="round"/>`;
    } else {
      svg.innerHTML = `<path d="${pathD}" fill="none" stroke="#AEAEB2" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
  });
}

function setModalStatus(status) {
  modalStatus = status;
  document.querySelectorAll('#modal-status-control .segment').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  const isRead = status === 'read';
  const isWishlist = status === 'wishlist';

  document.getElementById('rating-group').classList.toggle('hidden', isWishlist);
  document.getElementById('read-date-group').classList.toggle('hidden', !isRead);
  document.getElementById('wishlist-extras').classList.toggle('hidden', !isWishlist);
}

function setCurrentMonthYearDefault() {
  const now = new Date();
  readMonthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
  readYearSelect.value = String(now.getFullYear());
}

function openNewBookModal() {
  document.getElementById('editing-book-id').value = '';
  document.getElementById('modal-title').textContent = 'Nuevo libro';
  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-pages').value = '';
  document.getElementById('book-genre').value = '';
  document.getElementById('book-saga').value = '';
  document.getElementById('book-saga-num').value = '';
  document.getElementById('book-recommended').value = '';
  document.getElementById('book-cover-url').value = '';
  document.getElementById('preview-cover').classList.add('hidden');
  document.getElementById('cover-picker-box').classList.add('hidden');
  document.getElementById('btn-delete-book').classList.add('hidden');

  setCurrentMonthYearDefault();
  setModalStatus(currentStatus);
  setRatingValue(0);
  bookModal.classList.remove('hidden');
}

window.openEditModal = function(id) {
  const b = books.find(item => item.id === id);
  if (!b) return;

  document.getElementById('editing-book-id').value = b.id;
  document.getElementById('modal-title').textContent = 'Editar libro';
  document.getElementById('book-title').value = b.title;
  document.getElementById('book-author').value = b.author;
  document.getElementById('book-pages').value = b.pages || '';
  document.getElementById('book-genre').value = b.genre || '';
  document.getElementById('book-saga').value = b.saga || '';
  document.getElementById('book-saga-num').value = b.sagaNum || '';
  document.getElementById('book-recommended').value = b.recommendedBy || '';
  document.getElementById('book-cover-url').value = b.cover || '';
  document.getElementById('cover-picker-box').classList.add('hidden');

  if (b.readDate && b.readDate.includes('-')) {
    const [y, m] = b.readDate.split('-');
    readYearSelect.value = y;
    readMonthSelect.value = m;
  } else {
    setCurrentMonthYearDefault();
  }

  const previewImg = document.getElementById('preview-cover');
  if (b.cover) {
    previewImg.src = b.cover;
    previewImg.classList.remove('hidden');
  } else {
    previewImg.classList.add('hidden');
  }

  setModalStatus(b.status);
  setRatingValue(b.rating || 0);
  document.getElementById('btn-delete-book').classList.remove('hidden');
  bookModal.classList.remove('hidden');
};

function setupEventListeners() {
  document.querySelectorAll('#library-controls .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#library-controls .segment').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      updateSortOptions();
      renderLibrary();
    });
  });

  document.getElementById('btn-view-toggle').addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    renderLibrary();
  });

  localSearchInput.addEventListener('input', renderLibrary);
  sortSelect.addEventListener('change', renderLibrary);

  document.querySelectorAll('.ios-tabbar .tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ios-tabbar .tab-item').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById(`tab-${target}`).classList.add('active');

      const titles = { library: 'Biblioteca', decide: 'Descubrir', stats: 'Estadísticas' };
      document.getElementById('screen-title').textContent = titles[target];
      document.getElementById('library-controls').classList.toggle('hidden', target !== 'library');

      if (target === 'decide') renderDiscoverResults();
    });
  });

  document.querySelectorAll('#decide-length .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      renderDiscoverResults();
    });
  });

  document.getElementById('decide-genre').addEventListener('change', renderDiscoverResults);

  document.getElementById('btn-add-book').addEventListener('click', openNewBookModal);
  document.getElementById('btn-close-modal').addEventListener('click', () => bookModal.classList.add('hidden'));
  document.getElementById('btn-change-cover').addEventListener('click', openCoverPicker);

  document.querySelectorAll('#modal-status-control .segment').forEach(btn => {
    btn.addEventListener('click', () => setModalStatus(btn.dataset.status));
  });

  document.getElementById('api-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchBooksOnline(e.target.value), 300);
  });

  document.getElementById('btn-save-book').addEventListener('click', async () => {
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    if (!title || !author) return alert('Introduce al menos el título y el autor.');

    const editId = document.getElementById('editing-book-id').value;
    let pagesVal = parseInt(document.getElementById('book-pages').value) || null;
    let coverVal = document.getElementById('book-cover-url').value;
    let genreVal = document.getElementById('book-genre').value.trim();

    // Si el usuario escribió a mano sin clicar en el buscador, buscar portada y páginas automáticamente
    if (!coverVal || !pagesVal) {
      const candidates = await fetchSpanishBookCandidates(`${title} ${author}`);
      if (candidates[0]) {
        if (!coverVal && candidates[0].cover) coverVal = candidates[0].cover;
        if (!pagesVal && candidates[0].pages) pagesVal = parseInt(candidates[0].pages) || null;
        if (!genreVal && candidates[0].genre) genreVal = candidates[0].genre;
      }
    }

    const readDate = modalStatus === 'read' ? `${readYearSelect.value}-${readMonthSelect.value}` : '';

    const bookData = {
      id: editId || crypto.randomUUID(),
      title,
      author,
      status: modalStatus,
      rating: modalStatus === 'wishlist' ? 0 : currentRating,
      pages: pagesVal,
      genre: genreVal,
      saga: document.getElementById('book-saga').value.trim(),
      sagaNum: document.getElementById('book-saga-num').value.trim(),
      recommendedBy: document.getElementById('book-recommended').value.trim(),
      cover: coverVal,
      readDate,
      createdAt: editId ? (books.find(b => b.id === editId)?.createdAt || Date.now()) : Date.now()
    };

    if (editId) {
      books = books.map(b => b.id === editId ? bookData : b);
    } else {
      books.unshift(bookData);
    }

    saveToStorage();
    bookModal.classList.add('hidden');
  });

  document.getElementById('btn-delete-book').addEventListener('click', () => {
    const editId = document.getElementById('editing-book-id').value;
    if (editId && confirm('¿Eliminar este libro de tu biblioteca?')) {
      books = books.filter(b => b.id !== editId);
      saveToStorage();
      bookModal.classList.add('hidden');
    }
  });

  document.getElementById('btn-import-excel').addEventListener('click', () => {
    document.getElementById('excel-file-input').click();
  });
  document.getElementById('excel-file-input').addEventListener('change', handleExcelImport);

  document.getElementById('btn-export-excel').addEventListener('click', () => {
    if (books.length === 0) return alert('No hay libros para exportar.');
    const estadoMap = { read: 'Leído', wishlist: 'Por leer', dnf: 'DNF' };
    const rows = books.map(b => ({
      'Título': b.title,
      'Autor': b.author,
      'Estado': estadoMap[b.status] || 'Leído',
      'Nota': b.rating || '',
      'Mes/Año': b.readDate ? formatYearMonth(b.readDate) : '',
      'Páginas': b.pages || '',
      'Género': b.genre || '',
      'Saga': b.saga || '',
      'Nº': b.sagaNum || '',
      'Recomendado por': b.recommendedBy || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Biblioteca');
    XLSX.writeFile(wb, `Mi_Biblioteca_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  document.getElementById('btn-edit-goal').addEventListener('click', () => {
    const newGoal = prompt('¿Cuántos libros te propones leer este año?', yearlyGoal);
    if (newGoal && !isNaN(newGoal) && parseInt(newGoal) > 0) {
      yearlyGoal = parseInt(newGoal);
      localStorage.setItem('ios_yearly_goal', yearlyGoal);
      renderStats();
    }
  });
}

async function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet);

  if (rows.length === 0) return alert('El archivo Excel está vacío.');

  const addedBooks = [];

  rows.forEach(row => {
    const title = row['Título'] || row['Titulo'] || row['Libro'] || row['Title'] || Object.values(row)[0];
    const author = row['Autor'] || row['Author'] || Object.values(row)[1] || 'Desconocido';
    const rawState = String(row['Estado'] || row['Leído'] || '').toLowerCase();
    const rating = parseFloat(row['Nota'] || row['Valoración'] || row['Estrellas'] || 0) || 0;

    if (!title) return;

    let status = 'read';
    if (rawState.includes('por leer') || rawState.includes('pendiente') || rawState === 'no') status = 'wishlist';
    if (rawState.includes('dnf') || rawState.includes('abandonado')) status = 'dnf';

    const newBook = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      author: String(author).trim(),
      status,
      rating,
      pages: parseInt(row['Páginas'] || row['Paginas'] || 0) || null,
      genre: row['Género'] || row['Genero'] || '',
      saga: row['Saga'] || '',
      sagaNum: row['Nº'] || '',
      recommendedBy: '',
      cover: '',
      readDate: '',
      createdAt: Date.now()
    };

    books.push(newBook);
    addedBooks.push(newBook);
  });

  saveToStorage();
  event.target.value = '';
  enrichImportedBooks(addedBooks);
}

// Reparar automáticamente libros que se quedaron sin portada o páginas
async function repairMissingCoversAndPages() {
  const missing = books.filter(b => !b.cover || !b.pages);
  if (missing.length > 0) {
    enrichImportedBooks(missing);
  }
}

async function enrichImportedBooks(bookList) {
  const banner = document.getElementById('sync-banner');
  const syncText = document.getElementById('sync-text');
  banner.classList.remove('hidden');

  for (let i = 0; i < bookList.length; i++) {
    const b = bookList[i];
    syncText.textContent = `Completando datos (${i + 1}/${bookList.length}): ${b.title}...`;
    try {
      const q = `${b.title} ${b.author !== 'Desconocido' ? b.author : ''}`;
      const candidates = await fetchSpanishBookCandidates(q);
      if (candidates[0]) {
        if (!b.cover && candidates[0].cover) b.cover = candidates[0].cover;
        if (!b.pages && candidates[0].pages) b.pages = parseInt(candidates[0].pages) || null;
        if (!b.genre && candidates[0].genre) b.genre = candidates[0].genre;
      }
      saveToStorage();
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.warn('Error completando:', b.title);
    }
  }

  banner.classList.add('hidden');
  saveToStorage();
}

function renderStats() {
  const readBooks = books.filter(b => b.status === 'read');
  const dnfBooks = books.filter(b => b.status === 'dnf');

  const totalRead = readBooks.length;
  const totalPages = readBooks.reduce((acc, b) => acc + (parseInt(b.pages) || 0), 0);
  const ratedBooks = readBooks.filter(b => b.rating > 0);
  const avgRating = ratedBooks.length
    ? (ratedBooks.reduce((acc, b) => acc + b.rating, 0) / ratedBooks.length).toFixed(1)
    : '0.0';

  const totalAttempted = totalRead + dnfBooks.length;
  const dnfRate = totalAttempted > 0 ? Math.round((dnfBooks.length / totalAttempted) * 100) : 0;

  document.getElementById('stat-total-read').textContent = totalRead;
  document.getElementById('stat-total-pages').textContent = totalPages.toLocaleString('es-ES');
  document.getElementById('stat-avg-rating').textContent = avgRating;
  document.getElementById('stat-dnf-rate').textContent = `${dnfRate}%`;

  const pct = Math.min(100, Math.round((totalRead / yearlyGoal) * 100));
  document.getElementById('goal-subtitle').textContent = `${totalRead} de ${yearlyGoal} libros completados (${pct}%)`;
  document.getElementById('goal-progress-fill').style.width = `${pct}%`;

  const authorCounts = {};
  readBooks.forEach(b => {
    authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
  });
  renderRanking('top-authors-list', authorCounts, 'libros');

  const genreCounts = {};
  readBooks.forEach(b => {
    if (b.genre) genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
  });
  renderRanking('top-genres-list', genreCounts, 'libros');
}

function renderRanking(containerId, countObj, unit) {
  const entries = Object.entries(countObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const el = document.getElementById(containerId);
  if (entries.length === 0) {
    el.innerHTML = `<span style="font-size:13px;color:var(--text-secondary)">Sin datos suficientes.</span>`;
    return;
  }
  el.innerHTML = entries.map(([name, count]) => `
    <div class="ranking-item">
      <span style="font-weight:500">${name}</span>
      <span style="font-weight:600;color:var(--text-secondary)">${count} ${unit}</span>
    </div>
  `).join('');
}

function updateGenreFilterOptions() {
  const select = document.getElementById('decide-genre');
  const currentVal = select.value;
  const genres = [...new Set(books.filter(b => b.status === 'wishlist' && b.genre).map(b => b.genre))];
  select.innerHTML = `<option value="all">Todos los géneros</option>` + genres.map(g => `<option value="${g}">${g}</option>`).join('');
  if (genres.includes(currentVal)) select.value = currentVal;
}