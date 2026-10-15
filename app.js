let books = JSON.parse(localStorage.getItem('ios_books_db')) || [];
let yearlyGoal = parseInt(localStorage.getItem('ios_yearly_goal')) || 15;
let currentStatus = 'read';
let viewMode = 'grid';
let modalStatus = 'read';
let currentRating = 0;
let searchTimeout = null;

const booksContainer = document.getElementById('books-container');
const discoverResultsContainer = document.getElementById('discover-results-container');
const localSearchInput = document.getElementById('local-search');
const sortSelect = document.getElementById('sort-select');
const bookModal = document.getElementById('book-modal');
const ratingInput = document.getElementById('rating-Input');
const ratingDisplay = document.getElementById('rating-display');
const readDateInput = document.getElementById('book-read-date');

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-year-label').textContent = new Date().getFullYear();
  initInteractiveStars();
  setupEventListeners();
  updateSortOptions();
  refreshAllViews();
});

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

function formatStarsText(rating) {
  const num = parseFloat(rating);
  if (!num || num <= 0) return '';
  const full = Math.floor(num);
  const half = num % 1 !== 0 ? '½' : '';
  return `${'★'.repeat(full)}${half} ${num.toFixed(1)}`;
}

// Convertir "YYYY-MM" a "Mes AÑO"
function formatYearMonth(yyyyMm) {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Actualizar filtros dinámicos (No mostrar "Mejor nota" en "Por leer")
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
  if (Array.from(sortSelect.options).some(o => o.value === val)) {
    sortSelect.value = val;
  } else {
    sortSelect.value = 'recent';
  }
}

function createBookCardGridHTML(b) {
  const sagaBadge = b.saga ? `<span class="badge-top">${b.saga}${b.sagaNum ? ' #' + b.sagaNum : ''}</span>` : '';
  const coverHtml = b.cover
    ? `<img src="${b.cover}" alt="${b.title}" loading="lazy" />`
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
      b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query) || (b.saga && b.saga.toLowerCase().includes(query))
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
        const dateStr = b.readDate ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${formatYearMonth(b.readDate)}</div>` : '';
        rightInfo = `<div>${star}${dateStr}</div>`;
      }

      return `
        <div class="book-row-list" onclick="openEditModal('${b.id}')">
          ${b.cover ? `<img src="${b.cover}" class="list-thumb" />` : `<div class="list-thumb"></div>`}
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

// BÚSQUEDA GOOGLE BOOKS (Forzada en Español para mejores portadas y páginas automáticas)
async function searchBooksOnline(query) {
  const resultsBox = document.getElementById('api-results');
  if (query.length < 3) {
    resultsBox.classList.add('hidden');
    return;
  }
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=es&maxResults=6`);
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      resultsBox.classList.add('hidden');
      return;
    }
    resultsBox.innerHTML = data.items.map(item => {
      const info = item.volumeInfo;
      const title = (info.title || 'Sin título').replace(/"/g, '&quot;');
      const author = (info.authors ? info.authors.join(', ') : 'Autor desconocido').replace(/"/g, '&quot;');
      const pages = info.pageCount || '';
      const genre = info.categories ? info.categories[0] : '';
      let cover = '';
      if (info.imageLinks && info.imageLinks.thumbnail) {
        cover = info.imageLinks.thumbnail.replace('http:', 'https:');
      }

      return `
        <div class="api-item" onclick='fillBookFromApi(${JSON.stringify({ title, author, pages, genre, cover })})'>
          ${cover ? `<img src="${cover}" />` : `<div style="width:34px;height:52px;background:#ddd;border-radius:3px"></div>`}
          <div>
            <div style="font-size:14px;font-weight:600">${title}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${author} ${pages ? `· ${pages} págs.` : ''}</div>
          </div>
        </div>
      `;
    }).join('');
    resultsBox.classList.remove('hidden');
  } catch (err) {
    console.error('Error buscando libros:', err);
  }
}

window.fillBookFromApi = function(data) {
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
};

function initInteractiveStars() {
  const container = document.getElementById('star-touch-container');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'star-svg');
    svg.dataset.index = i;
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

// Establecer estado en el modal y mostrar/ocultar Fecha
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
  document.getElementById('btn-delete-book').classList.add('hidden');

  // Precargar fecha actual en el input
  const today = new Date();
  readDateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

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
  
  if (b.status === 'read' && b.readDate) {
    readDateInput.value = b.readDate;
  } else {
    const today = new Date();
    readDateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
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

  document.querySelectorAll('#modal-status-control .segment').forEach(btn => {
    btn.addEventListener('click', () => setModalStatus(btn.dataset.status));
  });

  document.getElementById('api-search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchBooksOnline(e.target.value), 350);
  });

  document.getElementById('btn-save-book').addEventListener('click', () => {
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    if (!title || !author) return alert('Introduce al menos el título y el autor.');

    const editId = document.getElementById('editing-book-id').value;
    const bookData = {
      id: editId || crypto.randomUUID(),
      title,
      author,
      status: modalStatus,
      rating: modalStatus === 'wishlist' ? 0 : currentRating,
      pages: parseInt(document.getElementById('book-pages').value) || null,
      genre: document.getElementById('book-genre').value.trim(),
      saga: document.getElementById('book-saga').value.trim(),
      sagaNum: document.getElementById('book-saga-num').value.trim(),
      recommendedBy: document.getElementById('book-recommended').value.trim(),
      cover: document.getElementById('book-cover-url').value,
      readDate: modalStatus === 'read' ? readDateInput.value : '',
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

async function enrichImportedBooks(importedList) {
  const banner = document.getElementById('sync-banner');
  const syncText = document.getElementById('sync-text');
  banner.classList.remove('hidden');

  for (let i = 0; i < importedList.length; i++) {
    const b = importedList[i];
    syncText.textContent = `Buscando portada (${i + 1}/${importedList.length}): ${b.title}...`;
    try {
      const q = `${b.title} ${b.author !== 'Desconocido' ? b.author : ''}`;
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=es&maxResults=1`);
      const data = await res.json();
      if (data.items && data.items[0]) {
        const info = data.items[0].volumeInfo;
        if (info.imageLinks && info.imageLinks.thumbnail) {
          b.cover = info.imageLinks.thumbnail.replace('http:', 'https:');
        }
        if (!b.pages && info.pageCount) b.pages = info.pageCount;
        if (!b.genre && info.categories) b.genre = info.categories[0];
      }
      await new Promise(r => setTimeout(r, 320));
    } catch (e) {
      console.warn('No se pudo autocompletar:', b.title);
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