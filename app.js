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
const btnClearLocalSearch = document.getElementById('btn-clear-local-search');
const apiSearchInput = document.getElementById('api-search-input');
const btnClearApiSearch = document.getElementById('btn-clear-api-search');
const apiResultsBox = document.getElementById('api-results');
const sortSelect = document.getElementById('sort-select');
const bookModal = document.getElementById('book-modal');
const ratingInput = document.getElementById('rating-Input');
const ratingDisplay = document.getElementById('rating-display');
const readMonthSelect = document.getElementById('book-read-month');
const readYearSelect = document.getElementById('book-read-year');

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

document.addEventListener('DOMContentLoaded', () => {
  const currentYear = new Date().getFullYear();
  document.getElementById('current-year-label').textContent = currentYear;
  initYearSelector(currentYear);
  initInteractiveStars();
  migrateAndUnifySavedGenres();
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

// CLASIFICADOR INTELIGENTE QUE UNIFICA SUBGÉNEROS EN GRANDES GRUPOS
function unifyGenre(rawGenre, title = '', author = '') {
  const text = `${rawGenre || ''} ${title || ''} ${author || ''}`.toLowerCase();
  const g = (rawGenre || '').toLowerCase().trim();

  if (
    g.includes('ciencia ficción') || g.includes('ciencia ficcion') ||
    g.includes('science fiction') || g.includes('sci-fi') ||
    g.includes('distop') || g.includes('dystop') ||
    g.includes('cyberpunk') || g.includes('espacial') || g.includes('space')
  ) {
    return 'Ciencia Ficción';
  }

  if (
    g.includes('misterio') || g.includes('mystery') ||
    g.includes('suspense') || g.includes('thriller') ||
    g.includes('negra') || g.includes('polic') ||
    g.includes('detective') || g.includes('crimen') || g.includes('crime') ||
    g.includes('intriga')
  ) {
    return 'Misterio y Suspense';
  }

  if (
    g.includes('clásico') || g.includes('clasico') ||
    g.includes('classic') ||
    text.includes('dostoyevski') || text.includes('dostoevsky')
  ) {
    return 'Clásicos';
  }

  if (
    g.includes('fantasía') || g.includes('fantasia') ||
    g.includes('fantasy') || g.includes('magia') || g.includes('épica')
  ) {
    return 'Fantasía';
  }

  if (
    g.includes('historia') || g.includes('history') ||
    g.includes('biograf') || g.includes('memorias') ||
    g.includes('histórica') || g.includes('historica')
  ) {
    return 'Historia y Biografía';
  }

  if (
    g.includes('ensayo') || g.includes('filosof') || g.includes('philosophy') ||
    g.includes('psicolog') || g.includes('psychology') ||
    g.includes('econom') || g.includes('business') || g.includes('empresa') ||
    g.includes('divulgación') || g.includes('ciencia') || g.includes('science') ||
    g.includes('desarrollo') || g.includes('self-help') || g.includes('no ficción') ||
    g.includes('nonfiction')
  ) {
    return 'Ensayo y No Ficción';
  }

  return 'Ficción y Narrativa';
}

// Migrar libros ya guardados para que sus categorías queden unificadas
function migrateAndUnifySavedGenres() {
  let changed = false;
  books.forEach(b => {
    const unified = unifyGenre(b.genre, b.title, b.author);
    if (b.genre !== unified) {
      b.genre = unified;
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem('ios_books_db', JSON.stringify(books));
  }
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

// GENERADOR DE ESTRELLAS VECTORIALES (Siempre dibuja las 5 estrellas)
function renderStarsIconsHTML(rating) {
  const num = parseFloat(rating);
  if (!num || num <= 0) return '';
  let html = '';

  for (let i = 1; i <= 5; i++) {
    if (num >= i) {
      // Estrella entera rellena
      html += `<svg class="mini-star-svg" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="#FF9F0A" stroke="#FF9F0A" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    } else if (num >= i - 0.5) {
      // Media estrella rellena (mitad izquierda)
      html += `<svg class="mini-star-svg" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="url(#ios-half-star)" stroke="#FF9F0A" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    } else {
      // Estrella vacía (hasta completar las 5)
      html += `<svg class="mini-star-svg" viewBox="0 0 24 24"><path d="${STAR_PATH}" fill="none" stroke="#C7C7CC" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    }
  }
  return html;
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
  const coverHtml = b.cover
    ? `<img src="${b.cover}" alt="${b.title}" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="cover-placeholder"><div class="cover-placeholder-title">${b.title}</div><div class="cover-placeholder-author">${b.author}</div></div>`;

  const metaLine = b.status === 'wishlist'
    ? (b.pages ? `<div class="book-author-grid">${b.pages} págs.</div>` : '')
    : (b.rating > 0 ? `<div class="book-rating-grid">${renderStarsIconsHTML(b.rating)}</div>` : '');

  const dateLine = (b.status === 'read' && b.readDate)
    ? `<div class="book-date-grid">${formatYearMonth(b.readDate)}</div>` : '';

  return `
    <div class="book-card-grid" onclick="openEditModal('${b.id}')">
      <div class="cover-wrapper">${coverHtml}</div>
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
      b.author.toLowerCase().includes(query)
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
        <h3>No hay libros aquí</h3>
        <p>Añade un libro con el botón <b>＋</b> o sube tu archivo Excel con <b>↑</b></p>
      </div>`;
    return;
  }

  if (viewMode === 'grid') {
    booksContainer.innerHTML = filtered.map(b => createBookCardGridHTML(b)).join('');
  } else {
    booksContainer.innerHTML = filtered.map(b => {
      let rightInfo = '';
      if (b.status === 'wishlist') {
        rightInfo = b.pages ? `<span style="font-size:13px;font-weight:600;color:var(--text-secondary)">${b.pages} p.</span>` : '';
      } else {
        const starsHtml = b.rating > 0 ? `<div class="book-rating-grid">${renderStarsIconsHTML(b.rating)}</div>` : '';
        const dateStr = (b.status === 'read' && b.readDate) ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">${formatYearMonth(b.readDate)}</div>` : '';
        rightInfo = `${starsHtml}${dateStr}`;
      }

      return `
        <div class="book-row-list" onclick="openEditModal('${b.id}')">
          ${b.cover ? `<img src="${b.cover}" referrerpolicy="no-referrer" class="list-thumb" />` : `<div class="list-thumb"></div>`}
          <div class="list-info">
            <div class="list-title">${b.title}</div>
            <div class="list-sub">${b.author}</div>
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

// REINICIO TOTAL DE BUSCADORES
function resetApiSearch() {
  clearTimeout(searchTimeout);
  apiSearchInput.value = '';
  lastSearchResults = [];
  apiResultsBox.innerHTML = '';
  apiResultsBox.classList.add('hidden');
  btnClearApiSearch.classList.add('hidden');
}

function resetLocalSearch() {
  localSearchInput.value = '';
  btnClearLocalSearch.classList.add('hidden');
}

// MOTOR DE BÚSQUEDA HÍBRIDO EN ESPAÑOL
async function fetchSpanishBookCandidates(query) {
  const results = [];

  const [appleRes, googleRes, olRes] = await Promise.allSettled([
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=es&media=ebook&entity=ebook&limit=5`).then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=es&maxResults=5`).then(r => r.json()),
    fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=title,author_name,number_of_pages_median,cover_i&limit=5`).then(r => r.json())
  ]);

  let fallbackPages = null;
  if (googleRes.status === 'fulfilled' && googleRes.value?.items) {
    const withPages = googleRes.value.items.find(i => i.volumeInfo?.pageCount > 0);
    if (withPages) fallbackPages = withPages.volumeInfo.pageCount;
  }
  if (!fallbackPages && olRes.status === 'fulfilled' && olRes.value?.docs) {
    const withPages = olRes.value.docs.find(d => d.number_of_pages_median > 0);
    if (withPages) fallbackPages = withPages.number_of_pages_median;
  }

  if (appleRes.status === 'fulfilled' && appleRes.value?.results) {
    appleRes.value.results.forEach(item => {
      const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x600bb') : '';
      const rawGenre = Array.isArray(item.genres) ? item.genres.find(g => g !== 'Libros') || '' : '';
      results.push({
        title: item.trackName || '',
        author: item.artistName || '',
        pages: fallbackPages || '',
        genre: unifyGenre(rawGenre, item.trackName, item.artistName),
        cover
      });
    });
  }

  if (googleRes.status === 'fulfilled' && googleRes.value?.items) {
    googleRes.value.items.forEach(item => {
      const info = item.volumeInfo || {};
      let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
      if (cover) cover = cover.replace('http://', 'https://').replace('&edge=curl', '');

      const exists = results.some(r => r.title.toLowerCase() === (info.title || '').toLowerCase());
      if (!exists && info.title) {
        const authorName = info.authors ? info.authors.join(', ') : 'Autor desconocido';
        results.push({
          title: info.title,
          author: authorName,
          pages: info.pageCount || fallbackPages || '',
          genre: unifyGenre(info.categories ? info.categories[0] : '', info.title, authorName),
          cover
        });
      } else if (exists && info.pageCount) {
        const match = results.find(r => r.title.toLowerCase() === info.title.toLowerCase());
        if (match && !match.pages) match.pages = info.pageCount;
      }
    });
  }

  if (results.length === 0 && olRes.status === 'fulfilled' && olRes.value?.docs) {
    olRes.value.docs.forEach(doc => {
      const authorName = doc.author_name ? doc.author_name.join(', ') : 'Autor desconocido';
      results.push({
        title: doc.title || 'Sin título',
        author: authorName,
        pages: doc.number_of_pages_median || '',
        genre: unifyGenre('', doc.title, authorName),
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : ''
      });
    });
  }

  return results.slice(0, 6);
}

async function searchBooksOnline(query) {
  if (query.trim().length < 2) {
    apiResultsBox.classList.add('hidden');
    return;
  }

  try {
    lastSearchResults = await fetchSpanishBookCandidates(query);
    // Si el usuario ya borró el input mientras cargaba, no mostrar resultados
    if (apiSearchInput.value.trim().length < 2 || lastSearchResults.length === 0) {
      apiResultsBox.classList.add('hidden');
      return;
    }

    apiResultsBox.innerHTML = lastSearchResults.map((item, idx) => `
      <div class="api-item" onclick="selectSearchResult(${idx})">
        ${item.cover ? `<img src="${item.cover}" referrerpolicy="no-referrer" />` : `<div style="width:34px;height:52px;background:#ddd;border-radius:3px;flex-shrink:0"></div>`}
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${item.author} ${item.pages ? `· ${item.pages} págs.` : ''}</div>
        </div>
      </div>
    `).join('');

    apiResultsBox.classList.remove('hidden');
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
  document.getElementById('book-genre').value = unifyGenre(data.genre, data.title, data.author);
  document.getElementById('book-cover-url').value = data.cover || '';

  const previewImg = document.getElementById('preview-cover');
  if (data.cover) {
    previewImg.src = data.cover;
    previewImg.classList.remove('hidden');
  } else {
    previewImg.classList.add('hidden');
  }

  // Dejar el texto en el buscador con el botón X visible por si quiere borrarlo de golpe, pero cerrar el desplegable
  apiResultsBox.classList.add('hidden');

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
  ratingDisplay.innerHTML = currentRating > 0
    ? renderStarsIconsHTML(currentRating)
    : `<span style="font-size:12px;color:var(--text-secondary);font-weight:600">Sin nota</span>`;

  const svgs = document.querySelectorAll('#star-touch-container .star-svg');
  svgs.forEach((svg, idx) => {
    const starNum = idx + 1;
    let fillType = 'empty';
    if (currentRating >= starNum) fillType = 'full';
    else if (currentRating >= starNum - 0.5) fillType = 'half';

    if (fillType === 'full') {
      svg.innerHTML = `<path d="${STAR_PATH}" fill="#FF9F0A" stroke="#FF9F0A" stroke-width="1.5" stroke-linejoin="round"/>`;
    } else if (fillType === 'half') {
      svg.innerHTML = `<path d="${STAR_PATH}" fill="url(#ios-half-star)" stroke="#FF9F0A" stroke-width="1.5" stroke-linejoin="round"/>`;
    } else {
      svg.innerHTML = `<path d="${STAR_PATH}" fill="none" stroke="#AEAEB2" stroke-width="1.5" stroke-linejoin="round"/>`;
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
}

function setCurrentMonthYearDefault() {
  const now = new Date();
  readMonthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
  readYearSelect.value = String(now.getFullYear());
}

function closeBookModal() {
  resetApiSearch();
  document.getElementById('cover-picker-box').classList.add('hidden');
  bookModal.classList.add('hidden');
}

function openNewBookModal() {
  resetApiSearch();
  document.getElementById('editing-book-id').value = '';
  document.getElementById('modal-title').textContent = 'Nuevo libro';
  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-pages').value = '';
  document.getElementById('book-genre').value = 'Ficción y Narrativa';
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

  resetApiSearch();
  document.getElementById('editing-book-id').value = b.id;
  document.getElementById('modal-title').textContent = 'Editar libro';
  document.getElementById('book-title').value = b.title;
  document.getElementById('book-author').value = b.author;
  document.getElementById('book-pages').value = b.pages || '';
  document.getElementById('book-genre').value = unifyGenre(b.genre, b.title, b.author);
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
  // Cambiar entre Leídos, Por leer y DNF reiniciando el buscador local
  document.querySelectorAll('#library-controls .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#library-controls .segment').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      resetLocalSearch();
      updateSortOptions();
      renderLibrary();
    });
  });

  document.getElementById('btn-view-toggle').addEventListener('click', () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    renderLibrary();
  });

  // Buscador de la biblioteca con botón X
  localSearchInput.addEventListener('input', () => {
    btnClearLocalSearch.classList.toggle('hidden', localSearchInput.value.length === 0);
    renderLibrary();
  });

  btnClearLocalSearch.addEventListener('click', () => {
    resetLocalSearch();
    renderLibrary();
    localSearchInput.focus();
  });

  sortSelect.addEventListener('change', renderLibrary);

  // Cambio de pestañas inferiores
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

  // Abrir y cerrar modal (Cancelar o tocar fondo reinicia siempre el buscador)
  document.getElementById('btn-add-book').addEventListener('click', openNewBookModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeBookModal);
  bookModal.addEventListener('click', (e) => {
    if (e.target === bookModal) closeBookModal();
  });

  document.getElementById('btn-change-cover').addEventListener('click', openCoverPicker);

  document.querySelectorAll('#modal-status-control .segment').forEach(btn => {
    btn.addEventListener('click', () => setModalStatus(btn.dataset.status));
  });

  // Buscador online del modal con botón X
  apiSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    btnClearApiSearch.classList.toggle('hidden', val.length === 0);
    clearTimeout(searchTimeout);
    if (val.trim().length < 2) {
      apiResultsBox.classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(() => searchBooksOnline(val), 280);
  });

  btnClearApiSearch.addEventListener('click', () => {
    resetApiSearch();
    apiSearchInput.focus();
  });

  // Guardar libro
  document.getElementById('btn-save-book').addEventListener('click', async () => {
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    if (!title || !author) return alert('Introduce al menos el título y el autor.');

    const editId = document.getElementById('editing-book-id').value;
    let pagesVal = parseInt(document.getElementById('book-pages').value) || null;
    let coverVal = document.getElementById('book-cover-url').value;
    let genreVal = document.getElementById('book-genre').value;

    if (!coverVal || !pagesVal) {
      const candidates = await fetchSpanishBookCandidates(`${title} ${author}`);
      if (candidates[0]) {
        if (!coverVal && candidates[0].cover) coverVal = candidates[0].cover;
        if (!pagesVal && candidates[0].pages) pagesVal = parseInt(candidates[0].pages) || null;
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
      genre: unifyGenre(genreVal, title, author),
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
    closeBookModal();
  });

  // Eliminar libro
  document.getElementById('btn-delete-book').addEventListener('click', () => {
    const editId = document.getElementById('editing-book-id').value;
    if (editId && confirm('¿Eliminar este libro de tu biblioteca?')) {
      books = books.filter(b => b.id !== editId);
      saveToStorage();
      closeBookModal();
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
      'Categoría': b.genre || ''
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

    const rawGenre = row['Categoría'] || row['Género'] || row['Genero'] || '';

    const newBook = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      author: String(author).trim(),
      status,
      rating,
      pages: parseInt(row['Páginas'] || row['Paginas'] || 0) || null,
      genre: unifyGenre(rawGenre, title, author),
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
        if (candidates[0].genre) b.genre = unifyGenre(candidates[0].genre, b.title, b.author);
      }
      saveToStorage();
      await new Promise(r => setTimeout(r, 380));
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
    const unified = unifyGenre(b.genre, b.title, b.author);
    genreCounts[unified] = (genreCounts[unified] || 0) + 1;
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
  const genres = [...new Set(books.filter(b => b.status === 'wishlist' && b.genre).map(b => unifyGenre(b.genre, b.title, b.author)))];
  select.innerHTML = `<option value="all">Todas las categorías</option>` + genres.map(g => `<option value="${g}">${g}</option>`).join('');
  if (genres.includes(currentVal)) select.value = currentVal;
}
