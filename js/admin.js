(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */

  let siteData = null;
  let homepageData = null;
  let aboutData = null;
  let articlesData = {}; // slug -> full article from articles.json
  let editorialsIndex = {}; // key -> data
  let collectionsIndex = {}; // key -> data
  let currentSection = 'dashboard';
  let pendingDeleteFn = null;
  let hasUnsaved = false;
  let editorialBodyBlocks = []; // temp blocks for modal
  let imageStore = {}; // path -> base64 data URL for uploaded images
  let pendingUploadTarget = null; // 'hero' or block index number

  const STORAGE_PREFIX = 'wa_';
  const CONTENT_FILES = {
    site: 'content/site.json',
    homepage: 'content/homepage.json',
    about: 'content/about.json'
  };
  const EDITORIAL_FILES = [
    { key: 'new-silhouette', file: 'content/editorial-new-silhouette.json' },
    { key: 'midnight-wool', file: 'content/editorial-midnight-wool.json' }
  ];
  const COLLECTION_FILES = [
    { key: 'nocturne', file: 'content/collection-nocturne.json' }
  ];

  /* ============================================
     HELPERS
     ============================================ */

  function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${esc(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showModal(id) {
    document.getElementById(id).classList.add('show');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('show');
  }

  function markUnsaved() {
    hasUnsaved = true;
    document.getElementById('unsaved-indicator').classList.remove('hidden');
  }

  function markSaved() {
    hasUnsaved = false;
    document.getElementById('unsaved-indicator').classList.add('hidden');
  }

  function saveToStorage(key, data) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    markUnsaved();
  }

  function getFromStorage(key) {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  }

  async function fetchJSON(path) {
    try {
      const res = await fetch(path + '?v=' + Date.now());
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to load:', path, e);
      return null;
    }
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function $(id) { return document.getElementById(id); }
  function val(id) { return $(id) ? $(id).value : ''; }
  function setVal(id, v) { if ($(id)) $(id).value = v || ''; }

  /* ============================================
     INIT
     ============================================ */

  async function init() {
    // Load data: localStorage first, then JSON files
    siteData = getFromStorage('site') || await fetchJSON(CONTENT_FILES.site) || {};
    homepageData = getFromStorage('homepage') || await fetchJSON(CONTENT_FILES.homepage) || {};
    aboutData = getFromStorage('about') || await fetchJSON(CONTENT_FILES.about) || {};

    // Load articles.json (full article content)
    articlesData = getFromStorage('articles') || await fetchJSON('content/articles.json') || {};

    // Load uploaded images store
    imageStore = getFromStorage('imageStore') || {};

    // Load editorials
    for (const ed of EDITORIAL_FILES) {
      editorialsIndex[ed.key] = getFromStorage('editorial_' + ed.key) || await fetchJSON(ed.file) || {};
    }

    // Load collections
    for (const col of COLLECTION_FILES) {
      collectionsIndex[col.key] = getFromStorage('collection_' + col.key) || await fetchJSON(col.file) || {};
    }

    setupNavigation();
    setupMobile();
    renderDashboard();
  }

  /* ============================================
     NAVIGATION
     ============================================ */

  function setupNavigation() {
    document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigate(link.dataset.section);
      });
    });
  }

  function navigate(sectionId) {
    currentSection = sectionId;

    // Update nav active state
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-nav a[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Hide all sections including article editor
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById('sec-' + sectionId);
    if (sec) sec.classList.add('active');

    // Load section data
    loadSection(sectionId);

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  }

  function loadSection(id) {
    switch (id) {
      case 'dashboard': renderDashboard(); break;
      case 'homepage': renderHomepage(); break;
      case 'articles': renderArticles(); break;
      case 'collections': renderCollections(); break;
      case 'about': renderAbout(); break;
      case 'site-settings': renderSiteSettings(); break;
    }
  }

  function setupMobile() {
    $('mobile-toggle').addEventListener('click', () => {
      $('sidebar').classList.toggle('open');
    });
  }

  /* ============================================
     DASHBOARD
     ============================================ */

  function renderDashboard() {
    const stats = $('dashboard-stats');
    const articleCount = Object.keys(articlesData).length;
    const editorialCount = Object.keys(editorialsIndex).length;
    const streamCount = (homepageData.stream || []).length;
    const studioCount = (homepageData.studio_content || []).length;
    const collectionCount = Object.keys(collectionsIndex).length;
    const tickerCount = (siteData.ticker || []).length;

    stats.innerHTML = `
      <div class="stat-card"><div class="stat-value">${articleCount}</div><div class="stat-label">News Articles</div></div>
      <div class="stat-card"><div class="stat-value">${editorialCount}</div><div class="stat-label">Editorials</div></div>
      <div class="stat-card"><div class="stat-value">${streamCount}</div><div class="stat-label">Stream Items</div></div>
      <div class="stat-card"><div class="stat-value">${studioCount}</div><div class="stat-label">Studio Items</div></div>
      <div class="stat-card"><div class="stat-value">${collectionCount}</div><div class="stat-label">Collections</div></div>
      <div class="stat-card"><div class="stat-value">${tickerCount}</div><div class="stat-label">Ticker Headlines</div></div>
    `;
  }

  /* ============================================
     HOMEPAGE EDITOR
     ============================================ */

  function renderHomepage() {
    const cover = homepageData.cover || {};

    // Cover
    setVal('cover-title', cover.title || '');
    setVal('cover-image', cover.image || '');
    renderCoverHeadlines();

    // Stream items
    renderStreamItems();

    // Studio content
    renderStudioItems();

    // Personal quote
    setVal('personal-quote', homepageData.personal_quote || '');
  }

  function renderCoverHeadlines() {
    const headlines = (homepageData.cover || {}).headlines || [];
    const container = $('cover-headlines');
    container.innerHTML = headlines.map((h, i) => `
      <div class="stream-editor-item" data-index="${i}">
        <div class="item-info">
          <div class="item-type">${esc(h.tag)}</div>
          <div class="item-title">${esc(h.text)}</div>
          <div class="item-excerpt">${esc(h.href)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon" onclick="adminPanel.editCoverHeadline(${i})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="adminPanel.deleteCoverHeadline(${i})" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function addCoverHeadline() {
    if (!homepageData.cover) homepageData.cover = {};
    if (!homepageData.cover.headlines) homepageData.cover.headlines = [];
    const tag = prompt('Tag (e.g. "New Collection"):');
    if (!tag) return;
    const text = prompt('Headline text:');
    if (!text) return;
    const href = prompt('Link (e.g. "collection.html"):') || '#';
    homepageData.cover.headlines.push({ tag, text, href });
    renderCoverHeadlines();
    markUnsaved();
  }

  function editCoverHeadline(i) {
    const h = homepageData.cover.headlines[i];
    const tag = prompt('Tag:', h.tag);
    if (tag === null) return;
    const text = prompt('Text:', h.text);
    if (text === null) return;
    const href = prompt('Link:', h.href);
    if (href === null) return;
    homepageData.cover.headlines[i] = { tag, text, href };
    renderCoverHeadlines();
    markUnsaved();
  }

  function deleteCoverHeadline(i) {
    homepageData.cover.headlines.splice(i, 1);
    renderCoverHeadlines();
    markUnsaved();
  }

  // --- Stream Items ---

  function renderStreamItems() {
    const items = homepageData.stream || [];
    const container = $('stream-items-list');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-stream"></i><p>No stream items yet.</p></div>';
      return;
    }

    container.innerHTML = items.map((item, i) => {
      let title = '', excerpt = '';
      if (item.type === 'feature') {
        title = item.title || '';
        excerpt = item.excerpt || '';
      } else if (item.type === 'duo') {
        const items2 = item.items || [];
        title = items2.map(d => d.title).join(' / ');
        excerpt = 'Duo block';
      } else if (item.type === 'quote') {
        title = '"' + truncate(item.text, 60) + '"';
        excerpt = 'Quote block';
      } else if (item.type === 'stat') {
        title = truncate(item.text, 60);
        excerpt = 'Stat block — ' + (item.source || '');
      }

      return `
        <div class="stream-editor-item">
          <div class="item-info">
            <div class="item-type">${esc(item.type)}</div>
            <div class="item-title">${esc(title)}</div>
            <div class="item-excerpt">${esc(excerpt)}</div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" onclick="adminPanel.editStreamItem(${i})" title="Edit"><i class="fas fa-pen"></i></button>
            ${i > 0 ? `<button class="btn-icon" onclick="adminPanel.moveStreamItem(${i},-1)" title="Move up"><i class="fas fa-arrow-up"></i></button>` : ''}
            ${i < items.length - 1 ? `<button class="btn-icon" onclick="adminPanel.moveStreamItem(${i},1)" title="Move down"><i class="fas fa-arrow-down"></i></button>` : ''}
            <button class="btn-icon danger" onclick="adminPanel.deleteStreamItem(${i})" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  }

  function addStreamItem(type) {
    if (!homepageData.stream) homepageData.stream = [];
    let newItem;
    if (type === 'feature') {
      newItem = { type: 'feature', category: '', title: '', excerpt: '', date: '', source: '', image: '' };
    } else if (type === 'duo') {
      newItem = { type: 'duo', items: [
        { category: '', title: '', excerpt: '', date: '', source: '', image: '' },
        { category: '', title: '', excerpt: '', date: '', source: '', image: '' }
      ]};
    } else if (type === 'quote') {
      newItem = { type: 'quote', text: '' };
    } else if (type === 'stat') {
      newItem = { type: 'stat', text: '', source: '' };
    }
    homepageData.stream.push(newItem);
    editStreamItem(homepageData.stream.length - 1);
    renderStreamItems();
    markUnsaved();
  }

  function editStreamItem(i) {
    const item = homepageData.stream[i];
    setVal('stream-edit-index', i);

    // Set type
    setVal('stream-type', item.type);
    toggleStreamFields();

    if (item.type === 'feature') {
      setVal('stream-category', item.category || '');
      setVal('stream-title', item.title || '');
      setVal('stream-excerpt', item.excerpt || '');
      setVal('stream-date', item.date || '');
      setVal('stream-source', item.source || '');
      setVal('stream-image', item.image || '');
    } else if (item.type === 'duo') {
      const items = item.items || [{}, {}];
      setVal('duo-1-category', items[0].category || '');
      setVal('duo-1-title', items[0].title || '');
      setVal('duo-1-excerpt', items[0].excerpt || '');
      setVal('duo-1-date', items[0].date || '');
      setVal('duo-1-source', items[0].source || '');
      setVal('duo-1-image', items[0].image || '');
      setVal('duo-2-category', items[1].category || '');
      setVal('duo-2-title', items[1].title || '');
      setVal('duo-2-excerpt', items[1].excerpt || '');
      setVal('duo-2-date', items[1].date || '');
      setVal('duo-2-source', items[1].source || '');
      setVal('duo-2-image', items[1].image || '');
    } else if (item.type === 'quote') {
      setVal('stream-quote-text', item.text || '');
    } else if (item.type === 'stat') {
      setVal('stream-stat-text', item.text || '');
      setVal('stream-stat-source', item.source || '');
    }

    $('stream-modal-title').textContent = 'Edit ' + item.type.charAt(0).toUpperCase() + item.type.slice(1);
    showModal('stream-modal');
  }

  function saveStreamItem() {
    const i = parseInt(val('stream-edit-index'));
    const type = val('stream-type');

    if (type === 'feature') {
      homepageData.stream[i] = {
        type: 'feature',
        category: val('stream-category'),
        title: val('stream-title'),
        excerpt: val('stream-excerpt'),
        date: val('stream-date'),
        source: val('stream-source'),
        image: val('stream-image')
      };
    } else if (type === 'duo') {
      homepageData.stream[i] = {
        type: 'duo',
        items: [
          { category: val('duo-1-category'), title: val('duo-1-title'), excerpt: val('duo-1-excerpt'), date: val('duo-1-date'), source: val('duo-1-source'), image: val('duo-1-image') },
          { category: val('duo-2-category'), title: val('duo-2-title'), excerpt: val('duo-2-excerpt'), date: val('duo-2-date'), source: val('duo-2-source'), image: val('duo-2-image') }
        ]
      };
    } else if (type === 'quote') {
      homepageData.stream[i] = { type: 'quote', text: val('stream-quote-text') };
    } else if (type === 'stat') {
      homepageData.stream[i] = { type: 'stat', text: val('stream-stat-text'), source: val('stream-stat-source') };
    }

    closeModal('stream-modal');
    renderStreamItems();
    markUnsaved();
    showToast('Stream item updated', 'success');
  }

  function deleteStreamItem(i) {
    pendingDeleteFn = () => {
      homepageData.stream.splice(i, 1);
      renderStreamItems();
      markUnsaved();
      showToast('Stream item deleted', 'success');
    };
    showModal('confirm-modal');
  }

  function moveStreamItem(i, dir) {
    const arr = homepageData.stream;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    renderStreamItems();
    markUnsaved();
  }

  function toggleStreamFields() {
    const type = val('stream-type');
    $('stream-fields-single').style.display = type === 'feature' ? 'block' : 'none';
    $('stream-fields-duo').style.display = type === 'duo' ? 'block' : 'none';
    $('stream-fields-quote').style.display = type === 'quote' ? 'block' : 'none';
    $('stream-fields-stat').style.display = type === 'stat' ? 'block' : 'none';
  }

  // --- Studio Items ---

  function renderStudioItems() {
    const items = homepageData.studio_content || [];
    const container = $('studio-items-list');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-palette"></i><p>No studio items yet.</p></div>';
      return;
    }

    container.innerHTML = items.map((item, i) => `
      <div class="content-item">
        <div class="content-item__image">
          ${item.image ? `<img src="${esc(item.image)}" alt="">` : ''}
        </div>
        <div class="content-item__body">
          <div class="content-item__meta">${esc(item.category)} &mdash; ${esc(item.date)}</div>
          <div class="content-item__title">${esc(item.title)}</div>
          <div class="content-item__excerpt">${esc(item.excerpt)}</div>
        </div>
        <div class="content-item__actions">
          <button class="btn-icon" onclick="adminPanel.editStudioItem(${i})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="adminPanel.deleteStudioItem(${i})" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function addStudioItem() {
    if (!homepageData.studio_content) homepageData.studio_content = [];
    homepageData.studio_content.push({ category: '', title: '', excerpt: '', date: '', href: '', image: '' });
    editStudioItem(homepageData.studio_content.length - 1);
  }

  function editStudioItem(i) {
    const item = homepageData.studio_content[i];
    setVal('studio-edit-index', i);
    setVal('studio-category', item.category || '');
    setVal('studio-title', item.title || '');
    setVal('studio-excerpt', item.excerpt || '');
    setVal('studio-date', item.date || '');
    setVal('studio-href', item.href || '');
    setVal('studio-image', item.image || '');
    showModal('studio-modal');
  }

  function saveStudioItem() {
    const i = parseInt(val('studio-edit-index'));
    homepageData.studio_content[i] = {
      category: val('studio-category'),
      title: val('studio-title'),
      excerpt: val('studio-excerpt'),
      date: val('studio-date'),
      href: val('studio-href'),
      image: val('studio-image')
    };
    closeModal('studio-modal');
    renderStudioItems();
    markUnsaved();
    showToast('Studio item updated', 'success');
  }

  function deleteStudioItem(i) {
    pendingDeleteFn = () => {
      homepageData.studio_content.splice(i, 1);
      renderStudioItems();
      markUnsaved();
      showToast('Studio item deleted', 'success');
    };
    showModal('confirm-modal');
  }

  // --- Save Homepage ---

  function saveHomepage() {
    homepageData.cover = homepageData.cover || {};
    homepageData.cover.title = val('cover-title');
    homepageData.cover.image = val('cover-image');
    homepageData.personal_quote = val('personal-quote');
    saveToStorage('homepage', homepageData);
    showToast('Homepage saved!', 'success');
    markSaved();
  }

  /* ============================================
     ARTICLES — Shopify-Style List + Visual Editor
     ============================================ */

  var allArticlesCache = [];
  var articleFilter = 'all';
  var selectedArticles = {};

  function buildArticlesCache() {
    allArticlesCache = [];

    // Articles from articles.json
    var slugs = Object.keys(articlesData);
    for (var s = 0; s < slugs.length; s++) {
      var slug = slugs[s];
      var a = articlesData[slug];
      allArticlesCache.push({
        key: slug, source: 'articles',
        title: a.title || '', category: a.category || 'News',
        date: a.date || '', author: a.author || '',
        read_time: a.read_time || '', image: a.image || '',
        dek: a.dek || '', bodyCount: (a.body || []).length,
        sourceLabel: a.source || ''
      });
    }

    // Editorials
    var edKeys = Object.keys(editorialsIndex);
    for (var e = 0; e < edKeys.length; e++) {
      var ek = edKeys[e];
      var ed = editorialsIndex[ek];
      allArticlesCache.push({
        key: ek, source: 'editorial',
        title: ed.title || '', category: ed.category || 'Editorial',
        date: ed.date || '', author: ed.author || '',
        read_time: ed.read_time || '', image: ed.hero_image || '',
        dek: '', bodyCount: (ed.body || []).length,
        sourceLabel: ''
      });
    }
  }

  function getFilteredArticles() {
    var searchVal = val('articles-search-input').toLowerCase();
    return allArticlesCache.filter(function(item) {
      // Filter by type
      if (articleFilter === 'news' && item.source !== 'articles') return false;
      if (articleFilter === 'editorial' && item.source !== 'editorial') return false;
      // Filter by search
      if (searchVal) {
        var haystack = (item.title + ' ' + item.category + ' ' + item.author + ' ' + item.dek + ' ' + item.date).toLowerCase();
        if (haystack.indexOf(searchVal) === -1) return false;
      }
      return true;
    });
  }

  function renderArticles() {
    buildArticlesCache();
    selectedArticles = {};
    renderArticlesTable();
  }

  function renderArticlesTable() {
    var items = getFilteredArticles();
    var tbody = $('articles-tbody');
    var emptyEl = $('articles-empty');
    var tableWrap = document.querySelector('.articles-table-wrap');
    var countEl = $('articles-count');

    // Count
    if (countEl) countEl.textContent = items.length + ' of ' + allArticlesCache.length + ' articles';

    if (allArticlesCache.length === 0) {
      if (tableWrap) tableWrap.style.display = 'none';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (tableWrap) tableWrap.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">No articles match your search.</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var isChecked = selectedArticles[item.key] ? ' checked' : '';
      var badgeClass = item.source === 'editorial' ? 'editorial' : 'news';
      var badgeLabel = item.source === 'editorial' ? 'Editorial' : (item.category || 'News');

      html += '<tr data-key="' + esc(item.key) + '" data-source="' + esc(item.source) + '" onclick="adminPanel.onArticleRowClick(event, \'' + esc(item.key) + '\', \'' + esc(item.source) + '\')">';

      // Checkbox
      html += '<td class="col-check"><input type="checkbox"' + isChecked + ' onclick="event.stopPropagation(); adminPanel.toggleSelectArticle(\'' + esc(item.key) + '\', this.checked)"></td>';

      // Image
      html += '<td class="col-image">';
      if (item.image) {
        html += '<img class="article-thumb" src="' + esc(item.image) + '" alt="" onerror="this.style.display=\'none\'">';
      } else {
        html += '<div class="article-thumb-placeholder"><i class="fas fa-image"></i></div>';
      }
      html += '</td>';

      // Title + dek
      html += '<td class="col-title"><div class="article-title-cell">';
      html += '<span class="article-title-text">' + esc(item.title) + '</span>';
      if (item.dek) html += '<span class="article-dek-text">' + esc(item.dek) + '</span>';
      html += '</div></td>';

      // Category
      html += '<td class="col-category"><span class="article-category-badge ' + badgeClass + '">' + esc(badgeLabel) + '</span></td>';

      // Author
      html += '<td class="col-author"><span class="article-author-text">' + esc(item.author || '—') + '</span></td>';

      // Date
      html += '<td class="col-date"><span class="article-date-text">' + esc(item.date || '—') + '</span></td>';

      // Actions
      html += '<td><div class="article-row-actions">';
      html += '<button onclick="event.stopPropagation(); adminPanel.openArticleEditor(\'' + esc(item.key) + '\', \'' + esc(item.source) + '\')" title="Edit"><i class="fas fa-pen"></i></button>';
      html += '<button class="danger" onclick="event.stopPropagation(); adminPanel.deleteArticle(\'' + esc(item.key) + '\', \'' + esc(item.source) + '\')" title="Delete"><i class="fas fa-trash-alt"></i></button>';
      html += '</div></td>';

      html += '</tr>';
    }

    tbody.innerHTML = html;
    updateBulkBar();
  }

  function onArticleRowClick(event, key, source) {
    // Don't open editor if clicking checkbox or action buttons
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.closest('.article-row-actions') || event.target.closest('.col-check')) return;
    openArticleEditor(key, source);
  }

  function filterArticles() {
    renderArticlesTable();
  }

  function setArticleFilter(filter, btn) {
    articleFilter = filter;
    // Update active chip
    var chips = document.querySelectorAll('.articles-filters .filter-chip');
    for (var c = 0; c < chips.length; c++) chips[c].classList.remove('active');
    if (btn) btn.classList.add('active');
    renderArticlesTable();
  }

  function toggleSelectArticle(key, checked) {
    if (checked) {
      selectedArticles[key] = true;
    } else {
      delete selectedArticles[key];
    }
    updateBulkBar();
  }

  function toggleSelectAll(checked) {
    var items = getFilteredArticles();
    selectedArticles = {};
    if (checked) {
      for (var i = 0; i < items.length; i++) selectedArticles[items[i].key] = true;
    }
    renderArticlesTable();
  }

  function updateBulkBar() {
    var count = Object.keys(selectedArticles).length;
    var existing = document.querySelector('.articles-bulk-bar');
    if (count === 0) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'articles-bulk-bar';
      var tableWrap = document.querySelector('.articles-table-wrap');
      if (tableWrap) tableWrap.parentNode.insertBefore(existing, tableWrap);
    }
    existing.innerHTML = '<span class="selected-count">' + count + ' selected</span>' +
      '<button class="btn btn-sm btn-danger" onclick="adminPanel.deleteSelectedArticles()"><i class="fas fa-trash-alt"></i> Delete selected</button>';
  }

  function deleteSelectedArticles() {
    var keys = Object.keys(selectedArticles);
    if (keys.length === 0) return;
    pendingDeleteFn = function() {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        // Find article in cache to know source
        var found = null;
        for (var j = 0; j < allArticlesCache.length; j++) {
          if (allArticlesCache[j].key === k) { found = allArticlesCache[j]; break; }
        }
        if (found && found.source === 'articles') {
          delete articlesData[k];
        } else if (found && found.source === 'editorial') {
          delete editorialsIndex[k];
          localStorage.removeItem(STORAGE_PREFIX + 'editorial_' + k);
        }
      }
      saveToStorage('articles', articlesData);
      selectedArticles = {};
      renderArticles();
      renderDashboard();
      showToast(keys.length + ' article(s) deleted', 'success');
    };
    showModal('confirm-modal');
  }

  /* --- WYSIWYG Article Editor --- */

  function openArticleEditor(key, source) {
    $('sec-articles').classList.remove('active');
    $('sec-article-editor').classList.add('active');

    if (key && source === 'articles') {
      var a = articlesData[key];
      setVal('editor-key', key);
      setVal('editor-source', 'articles');
      setVal('editor-category', a.category || 'News');
      setVal('editor-article-source', a.source || '');
      setVal('editor-readtime', a.read_time || '');
      setVal('editor-tags', '');
      setVal('editor-hero', a.image || '');
      // WYSIWYG fields
      $('wysiwyg-category').textContent = a.category || '';
      $('wysiwyg-title').textContent = a.title || '';
      $('wysiwyg-dek').textContent = a.dek || '';
      $('wysiwyg-author').textContent = a.author || '';
      $('wysiwyg-date').textContent = a.date || '';
      editorialBodyBlocks = (a.body || []).map(function(b) { return Object.assign({}, b); });
      $('editor-page-title').textContent = 'Edit Article';
    } else if (key && source === 'editorial') {
      var ed = editorialsIndex[key];
      if (!ed) return;
      setVal('editor-key', key);
      setVal('editor-source', 'editorial');
      setVal('editor-category', ed.category || 'Editorial');
      setVal('editor-article-source', '');
      setVal('editor-readtime', ed.read_time || '');
      setVal('editor-tags', (ed.tags || []).join(', '));
      setVal('editor-hero', ed.hero_image || '');
      $('wysiwyg-category').textContent = ed.category || '';
      $('wysiwyg-title').textContent = ed.title || '';
      $('wysiwyg-dek').textContent = '';
      $('wysiwyg-author').textContent = ed.author || 'Willie Austin';
      $('wysiwyg-date').textContent = ed.date || '';
      editorialBodyBlocks = (ed.body || []).map(function(b) { return Object.assign({}, b); });
      $('editor-page-title').textContent = 'Edit Editorial';
    } else {
      setVal('editor-key', '');
      setVal('editor-source', 'articles');
      setVal('editor-category', 'News');
      setVal('editor-article-source', '');
      setVal('editor-readtime', '');
      setVal('editor-tags', '');
      setVal('editor-hero', '');
      $('wysiwyg-category').textContent = '';
      $('wysiwyg-title').textContent = '';
      $('wysiwyg-dek').textContent = '';
      $('wysiwyg-author').textContent = '';
      $('wysiwyg-date').textContent = '';
      editorialBodyBlocks = [];
      $('editor-page-title').textContent = 'New Article';
    }

    renderHero();
    renderWysiwygBody();
    hideBlockMenu();
  }

  function closeArticleEditor() {
    $('sec-article-editor').classList.remove('active');
    $('sec-articles').classList.add('active');
    // Close drawer if open
    $('settings-drawer').classList.remove('open');
    $('drawer-overlay').classList.remove('open');
    renderArticles();
  }

  function toggleSettingsDrawer() {
    $('settings-drawer').classList.toggle('open');
    $('drawer-overlay').classList.toggle('open');
  }

  /* --- Image Upload System --- */

  function resolveImageSrc(path) {
    // If it's already a data URL, return it
    if (path && path.indexOf('data:') === 0) return path;
    // Check uploaded images store
    if (path && imageStore[path]) return imageStore[path];
    return path;
  }

  function triggerUpload(target) {
    pendingUploadTarget = target;
    $('image-upload-input').click();
  }

  function handleImageUpload(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.match('image.*')) {
      showToast('Please select an image file', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      // Generate a path
      var ext = file.name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].indexOf(ext) === -1) ext = 'jpg';
      var safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-').toLowerCase();
      var path = 'assets/images/news/' + safeName;

      // Store in image library
      imageStore[path] = dataUrl;
      saveToStorage('imageStore', imageStore);

      // Apply to the target
      if (pendingUploadTarget === 'hero') {
        setVal('editor-hero', path);
        renderHero();
      } else if (typeof pendingUploadTarget === 'number') {
        var idx = pendingUploadTarget;
        if (editorialBodyBlocks[idx]) {
          editorialBodyBlocks[idx].src = path;
          renderWysiwygBody();
        }
      }

      markUnsaved();
      showToast('Image uploaded: ' + safeName, 'success');
      pendingUploadTarget = null;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    input.value = '';
  }

  function handleDrop(e, target) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget) e.currentTarget.classList.remove('drag-over');
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.match('image.*')) return;

    pendingUploadTarget = target;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      var ext = file.name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].indexOf(ext) === -1) ext = 'jpg';
      var safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-').toLowerCase();
      var path = 'assets/images/news/' + safeName;

      imageStore[path] = dataUrl;
      saveToStorage('imageStore', imageStore);

      if (target === 'hero') {
        setVal('editor-hero', path);
        renderHero();
      } else if (typeof target === 'number') {
        if (editorialBodyBlocks[target]) {
          editorialBodyBlocks[target].src = path;
          renderWysiwygBody();
        }
      }

      markUnsaved();
      showToast('Image uploaded: ' + safeName, 'success');
    };
    reader.readAsDataURL(file);
  }

  function preventDragDefault(e) {
    e.preventDefault();
    e.stopPropagation();
    // Add visual feedback
    var dropZone = e.currentTarget;
    if (dropZone) {
      dropZone.classList.add('drag-over');
      clearTimeout(dropZone._dragLeaveTimer);
      dropZone._dragLeaveTimer = setTimeout(function() {
        dropZone.classList.remove('drag-over');
      }, 150);
    }
  }

  /* --- Hero Image --- */

  function renderHero() {
    var src = val('editor-hero');
    var displaySrc = resolveImageSrc(src);
    var img = $('wysiwyg-hero-img');
    var placeholder = $('wysiwyg-hero-placeholder');
    var actions = $('wysiwyg-hero-actions');
    if (displaySrc) {
      img.src = displaySrc;
      img.style.display = 'block';
      img.onerror = function() { img.style.display = 'none'; placeholder.style.display = ''; if (actions) actions.style.display = 'none'; };
      placeholder.style.display = 'none';
      if (actions) actions.style.display = '';
    } else {
      img.style.display = 'none';
      placeholder.style.display = '';
      if (actions) actions.style.display = 'none';
    }
  }

  function onHeroClick() {
    triggerUpload('hero');
  }

  function onHeroInput() {
    renderHero();
    markUnsaved();
  }

  function clearHeroImage() {
    setVal('editor-hero', '');
    renderHero();
    markUnsaved();
  }

  /* --- Render WYSIWYG Body Blocks --- */

  function renderWysiwygBody() {
    var container = $('wysiwyg-body');
    var html = '';

    for (var i = 0; i < editorialBodyBlocks.length; i++) {
      var block = editorialBodyBlocks[i];

      // Inserter between blocks
      if (i > 0) {
        html += '<div class="wysiwyg-inserter"><button onclick="adminPanel.insertBlockAt(' + i + ')" title="Insert block here"><i class="fas fa-plus"></i></button></div>';
      }

      html += '<div class="wysiwyg-block" data-index="' + i + '">';

      // Side toolbar
      html += '<div class="wysiwyg-block-toolbar">';
      if (i > 0) html += '<button onclick="adminPanel.moveBlock(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>';
      if (i < editorialBodyBlocks.length - 1) html += '<button onclick="adminPanel.moveBlock(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>';
      html += '<button class="danger" onclick="adminPanel.removeBlock(' + i + ')" title="Delete"><i class="fas fa-trash-alt"></i></button>';
      html += '</div>';

      if (block.type === 'paragraph') {
        var pText = block.text || '';
        if (block.dropcap && pText.length > 0) {
          html += '<div class="wysiwyg-block-paragraph" contenteditable="true" data-index="' + i + '" data-placeholder="Type your paragraph..." oninput="adminPanel.onWysiwygInput(this)"><span class="w-dropcap">' + esc(pText.charAt(0)) + '</span>' + esc(pText.slice(1)) + '</div>';
        } else {
          html += '<div class="wysiwyg-block-paragraph" contenteditable="true" data-index="' + i + '" data-placeholder="Type your paragraph..." oninput="adminPanel.onWysiwygInput(this)">' + esc(pText) + '</div>';
        }
        html += '<div class="wysiwyg-block-options"><label><input type="checkbox" data-index="' + i + '" ' + (block.dropcap ? 'checked' : '') + ' onchange="adminPanel.onDropcapToggle(this)"> Drop cap</label></div>';

      } else if (block.type === 'heading') {
        html += '<div class="wysiwyg-block-heading" contenteditable="true" data-index="' + i + '" data-placeholder="Section heading..." oninput="adminPanel.onWysiwygInput(this)">' + esc(block.text || '') + '</div>';

      } else if (block.type === 'pullquote') {
        html += '<div class="wysiwyg-block-pullquote" contenteditable="true" data-index="' + i + '" data-placeholder="Enter a quote..." oninput="adminPanel.onWysiwygInput(this)">' + esc(block.text || '') + '</div>';

      } else if (block.type === 'image') {
        var imgDisplay = resolveImageSrc(block.src);
        html += '<div class="wysiwyg-block-image" data-index="' + i + '" ondragover="adminPanel.preventDragDefault(event)" ondragenter="adminPanel.preventDragDefault(event)" ondrop="adminPanel.handleDrop(event,' + i + ')">';
        if (imgDisplay) {
          html += '<img src="' + esc(imgDisplay) + '" alt="" onerror="this.style.display=\'none\'">';
        } else {
          html += '<div class="wysiwyg-img-placeholder" onclick="adminPanel.triggerUpload(' + i + ')"><i class="fas fa-cloud-upload-alt" style="font-size:1.5rem;"></i><span>Click to upload or drag &amp; drop</span></div>';
        }
        html += '<div class="wysiwyg-img-actions">';
        html += '<button class="wysiwyg-img-action-btn" onclick="adminPanel.triggerUpload(' + i + ')" title="Upload image"><i class="fas fa-cloud-upload-alt"></i> Upload</button>';
        html += '<button class="wysiwyg-img-action-btn" onclick="adminPanel.onImgPathPrompt(' + i + ')" title="Enter URL or path"><i class="fas fa-link"></i> URL</button>';
        if (block.src) html += '<button class="wysiwyg-img-action-btn danger" onclick="adminPanel.clearBlockImage(' + i + ')" title="Remove image"><i class="fas fa-times"></i></button>';
        html += '</div>';
        html += '<div class="wysiwyg-caption" contenteditable="true" data-index="' + i + '" data-field="caption" data-placeholder="Caption (optional)" oninput="adminPanel.onCaptionInput(this)">' + esc(block.caption || '') + '</div>';
        html += '</div>';
      }

      html += '</div>'; // end .wysiwyg-block
    }

    container.innerHTML = html;
  }

  /* --- WYSIWYG Input Handlers --- */

  function onWysiwygInput(el) {
    var idx = parseInt(el.getAttribute('data-index'));
    var block = editorialBodyBlocks[idx];
    // Get text content (strip dropcap span if present)
    var text = el.textContent || '';
    block.text = text;
    markUnsaved();
  }

  function onDropcapToggle(el) {
    var idx = parseInt(el.getAttribute('data-index'));
    editorialBodyBlocks[idx].dropcap = el.checked;
    renderWysiwygBody();
    markUnsaved();
  }

  function onImgPathPrompt(idx) {
    var block = editorialBodyBlocks[idx];
    var src = prompt('Image path or URL:', block.src || '');
    if (src === null) return;
    block.src = src;
    renderWysiwygBody();
    markUnsaved();
  }

  function clearBlockImage(idx) {
    editorialBodyBlocks[idx].src = '';
    renderWysiwygBody();
    markUnsaved();
  }

  function onCaptionInput(el) {
    var idx = parseInt(el.getAttribute('data-index'));
    editorialBodyBlocks[idx].caption = el.textContent || '';
    markUnsaved();
  }

  /* --- Block Management --- */

  function addBlock(type) {
    var block;
    if (type === 'paragraph') block = { type: 'paragraph', text: '', dropcap: false };
    else if (type === 'heading') block = { type: 'heading', text: '' };
    else if (type === 'pullquote') block = { type: 'pullquote', text: '', attribution: '' };
    else if (type === 'image') block = { type: 'image', src: '', caption: '', layout: 'wide' };
    editorialBodyBlocks.push(block);
    hideBlockMenu();
    renderWysiwygBody();
    markUnsaved();

    // Focus the new block
    setTimeout(function() {
      var blocks = document.querySelectorAll('.wysiwyg-block');
      var last = blocks[blocks.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var editable = last.querySelector('[contenteditable=true]');
        if (editable) editable.focus();
      }
    }, 100);
  }

  function insertBlockAt(idx) {
    var type = prompt('Block type (paragraph, heading, pullquote, image):', 'paragraph');
    if (!type) return;
    type = type.toLowerCase().trim();
    var block;
    if (type === 'paragraph') block = { type: 'paragraph', text: '', dropcap: false };
    else if (type === 'heading') block = { type: 'heading', text: '' };
    else if (type === 'pullquote') block = { type: 'pullquote', text: '', attribution: '' };
    else if (type === 'image') block = { type: 'image', src: '', caption: '', layout: 'wide' };
    else { showToast('Unknown block type', 'error'); return; }
    editorialBodyBlocks.splice(idx, 0, block);
    renderWysiwygBody();
    markUnsaved();
  }

  function moveBlock(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= editorialBodyBlocks.length) return;
    var temp = editorialBodyBlocks[i];
    editorialBodyBlocks[i] = editorialBodyBlocks[j];
    editorialBodyBlocks[j] = temp;
    renderWysiwygBody();
    markUnsaved();
  }

  function removeBlock(i) {
    editorialBodyBlocks.splice(i, 1);
    renderWysiwygBody();
    markUnsaved();
  }

  function showBlockMenu() {
    $('block-menu').classList.toggle('open');
  }

  function hideBlockMenu() {
    var menu = $('block-menu');
    if (menu) menu.classList.remove('open');
  }

  /* --- Save from Editor --- */

  function saveArticleFromEditor() {
    // Read from WYSIWYG contenteditable fields
    var title = ($('wysiwyg-title').textContent || '').trim();
    if (!title) { showToast('Title is required', 'error'); return; }

    var dek = ($('wysiwyg-dek').textContent || '').trim();
    var author = ($('wysiwyg-author').textContent || '').trim();
    var date = ($('wysiwyg-date').textContent || '').trim();
    var category = ($('wysiwyg-category').textContent || '').trim() || val('editor-category');

    var source = val('editor-source') || 'articles';
    var key = val('editor-key') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Sync body blocks from contenteditable
    syncBlocksFromDOM();

    if (source === 'articles') {
      articlesData[key] = {
        title: title,
        category: category,
        date: date,
        source: val('editor-article-source'),
        author: author,
        read_time: val('editor-readtime'),
        image: val('editor-hero'),
        dek: dek,
        body: editorialBodyBlocks.map(function(b) { return Object.assign({}, b); })
      };
      saveToStorage('articles', articlesData);
    } else {
      editorialsIndex[key] = {
        category: category,
        title: title,
        author: author,
        date: date,
        read_time: val('editor-readtime'),
        hero_image: val('editor-hero'),
        tags: val('editor-tags').split(',').map(function(t) { return t.trim(); }).filter(Boolean),
        body: editorialBodyBlocks.map(function(b) { return Object.assign({}, b); })
      };
      saveToStorage('editorial_' + key, editorialsIndex[key]);
    }

    // Also sync category back to drawer
    setVal('editor-category', category);
    renderDashboard();
    showToast('Article saved!', 'success');
    markSaved();
  }

  function syncBlocksFromDOM() {
    // Read current text from contenteditable elements back into blocks
    var blockEls = document.querySelectorAll('.wysiwyg-block');
    for (var i = 0; i < blockEls.length; i++) {
      var idx = parseInt(blockEls[i].getAttribute('data-index'));
      if (isNaN(idx) || !editorialBodyBlocks[idx]) continue;
      var block = editorialBodyBlocks[idx];

      if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'pullquote') {
        var editable = blockEls[i].querySelector('[contenteditable=true]');
        if (editable) block.text = editable.textContent || '';
      } else if (block.type === 'image') {
        var captionEl = blockEls[i].querySelector('.wysiwyg-caption');
        if (captionEl) block.caption = captionEl.textContent || '';
        var srcInput = blockEls[i].querySelector('input[data-field="src"]');
        if (srcInput) block.src = srcInput.value || '';
      }
    }
  }

  function deleteArticle(key, source) {
    pendingDeleteFn = function() {
      if (source === 'articles') {
        delete articlesData[key];
        saveToStorage('articles', articlesData);
      } else {
        delete editorialsIndex[key];
        localStorage.removeItem(STORAGE_PREFIX + 'editorial_' + key);
      }
      renderArticles();
      renderDashboard();
      showToast('Article deleted', 'success');
    };
    showModal('confirm-modal');
  }

  /* ============================================
     COLLECTIONS
     ============================================ */

  function renderCollections() {
    const container = $('collections-list');
    const keys = Object.keys(collectionsIndex);

    if (keys.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-layer-group"></i><p>No collections yet.</p></div>';
      return;
    }

    container.innerHTML = keys.map(key => {
      const col = collectionsIndex[key];
      const lookCount = (col.looks || []).length;
      return `
        <div class="content-item">
          <div class="content-item__image">
            ${col.hero_image ? `<img src="${esc(col.hero_image)}" alt="">` : ''}
          </div>
          <div class="content-item__body">
            <div class="content-item__meta">${esc(col.season || '')} &mdash; ${lookCount} looks</div>
            <div class="content-item__title">${esc(col.title)}</div>
            <div class="content-item__excerpt">${esc(col.description)}</div>
          </div>
          <div class="content-item__actions">
            <button class="btn btn-sm btn-secondary" onclick="adminPanel.exportCollection('${esc(key)}')"><i class="fas fa-download"></i> Export</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function exportCollection(key) {
    const data = collectionsIndex[key];
    downloadJSON('collection-' + key + '.json', data);
    showToast('Collection exported', 'success');
  }

  /* ============================================
     ABOUT PAGE
     ============================================ */

  function renderAbout() {
    setVal('about-name', aboutData.name || '');
    setVal('about-label', aboutData.label || '');
    setVal('about-subtitle', aboutData.subtitle || '');
    setVal('about-hero', aboutData.hero_image || '');
    setVal('about-signoff', aboutData.contact_signoff || '');
    renderAboutFacts();
    renderAboutBody();
  }

  function renderAboutFacts() {
    const facts = aboutData.facts || [];
    const container = $('about-facts-list');
    container.innerHTML = facts.map((f, i) => `
      <div class="stream-editor-item" style="margin-bottom:0.5rem;">
        <div class="item-info">
          <div class="item-type">${esc(f.label)}</div>
          <div class="item-title">${esc(f.value)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon" onclick="adminPanel.editAboutFact(${i})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="adminPanel.deleteAboutFact(${i})" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function addAboutFact() {
    if (!aboutData.facts) aboutData.facts = [];
    const label = prompt('Fact label:');
    if (!label) return;
    const value = prompt('Fact value:');
    if (!value) return;
    aboutData.facts.push({ label, value });
    renderAboutFacts();
    markUnsaved();
  }

  function editAboutFact(i) {
    const f = aboutData.facts[i];
    const label = prompt('Label:', f.label);
    if (label === null) return;
    const value = prompt('Value:', f.value);
    if (value === null) return;
    aboutData.facts[i] = { label, value };
    renderAboutFacts();
    markUnsaved();
  }

  function deleteAboutFact(i) {
    aboutData.facts.splice(i, 1);
    renderAboutFacts();
    markUnsaved();
  }

  function renderAboutBody() {
    const body = aboutData.body || [];
    const container = $('about-body-list');
    container.innerHTML = '<div class="block-list">' + body.map((block, i) => {
      let preview = '';
      if (block.type === 'paragraph') preview = truncate(block.text, 80);
      else if (block.type === 'image') preview = block.src || '(no image)';

      return `
        <div class="block-item">
          <span class="block-type">${esc(block.type)}</span>
          <span class="block-content">${esc(preview)}</span>
          <div class="block-actions">
            <button class="btn-icon" onclick="adminPanel.editAboutBlock(${i})" title="Edit"><i class="fas fa-pen" style="font-size:0.7rem;"></i></button>
            <button class="btn-icon danger" onclick="adminPanel.deleteAboutBlock(${i})" title="Remove"><i class="fas fa-times" style="font-size:0.7rem;"></i></button>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function addAboutBlock(type) {
    if (!aboutData.body) aboutData.body = [];
    if (type === 'paragraph') {
      const text = prompt('Paragraph text:');
      if (!text) return;
      aboutData.body.push({ type: 'paragraph', text });
    } else if (type === 'image') {
      const src = prompt('Image path:');
      if (!src) return;
      const layout = prompt('Layout (wide or full-bleed):', 'wide');
      aboutData.body.push({ type: 'image', layout: layout || 'wide', src });
    }
    renderAboutBody();
    markUnsaved();
  }

  function editAboutBlock(i) {
    const block = aboutData.body[i];
    if (block.type === 'paragraph') {
      const text = prompt('Paragraph text:', block.text);
      if (text !== null) block.text = text;
    } else if (block.type === 'image') {
      const src = prompt('Image path:', block.src);
      if (src !== null) block.src = src;
    }
    renderAboutBody();
    markUnsaved();
  }

  function deleteAboutBlock(i) {
    aboutData.body.splice(i, 1);
    renderAboutBody();
    markUnsaved();
  }

  function saveAbout() {
    aboutData.name = val('about-name');
    aboutData.label = val('about-label');
    aboutData.subtitle = val('about-subtitle');
    aboutData.hero_image = val('about-hero');
    aboutData.contact_signoff = val('about-signoff');
    saveToStorage('about', aboutData);
    showToast('About page saved!', 'success');
    markSaved();
  }

  /* ============================================
     SITE SETTINGS
     ============================================ */

  function renderSiteSettings() {
    setVal('site-name', siteData.site_name || '');
    setVal('site-email', siteData.email || '');
    setVal('site-tagline', siteData.tagline || '');
    setVal('site-visitor-count', siteData.visitor_count || '');
    renderNavLinks();
    renderTicker();
  }

  function renderNavLinks() {
    const links = siteData.nav || [];
    const container = $('nav-links-list');
    container.innerHTML = links.map((link, i) => `
      <div class="stream-editor-item" style="margin-bottom:0.5rem;">
        <div class="item-info">
          <div class="item-title">${esc(link.label)}</div>
          <div class="item-excerpt">${esc(link.href)} ${link.accent ? '(accent)' : ''}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon" onclick="adminPanel.editNavLink(${i})" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="adminPanel.deleteNavLink(${i})" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  function addNavLink() {
    if (!siteData.nav) siteData.nav = [];
    const label = prompt('Link label:');
    if (!label) return;
    const href = prompt('Link URL:');
    if (!href) return;
    const id = label.toLowerCase().replace(/\s+/g, '-');
    const accent = confirm('Accent style? (for special links like "Play")');
    siteData.nav.push({ label, href, id, accent });
    renderNavLinks();
    markUnsaved();
  }

  function editNavLink(i) {
    const link = siteData.nav[i];
    const label = prompt('Label:', link.label);
    if (label === null) return;
    const href = prompt('URL:', link.href);
    if (href === null) return;
    const accent = confirm('Accent style?');
    siteData.nav[i] = { ...link, label, href, accent };
    renderNavLinks();
    markUnsaved();
  }

  function deleteNavLink(i) {
    siteData.nav.splice(i, 1);
    renderNavLinks();
    markUnsaved();
  }

  function renderTicker() {
    var items = siteData.ticker || [];
    var container = $('ticker-list');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:1.5rem;"><i class="fas fa-newspaper"></i><p>No ticker headlines yet.</p></div>';
      updateTickerPreview();
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      html += '<div class="ticker-editor-item">';
      html += '<span class="ticker-num">' + (i + 1) + '</span>';
      html += '<textarea data-index="' + i + '" oninput="adminPanel.onTickerInput(this)">' + esc(items[i]) + '</textarea>';
      html += '<div class="ticker-actions">';
      if (i > 0) html += '<button onclick="adminPanel.moveTicker(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>';
      if (i < items.length - 1) html += '<button onclick="adminPanel.moveTicker(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>';
      html += '<button class="danger" onclick="adminPanel.deleteTicker(' + i + ')" title="Delete"><i class="fas fa-trash-alt"></i></button>';
      html += '</div></div>';
    }
    container.innerHTML = html;

    // Auto-resize textareas
    var textareas = container.querySelectorAll('textarea');
    for (var t = 0; t < textareas.length; t++) {
      autoResizeTicker(textareas[t]);
    }

    updateTickerPreview();
  }

  function autoResizeTicker(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function onTickerInput(el) {
    var i = parseInt(el.getAttribute('data-index'));
    siteData.ticker[i] = el.value;
    autoResizeTicker(el);
    updateTickerPreview();
    markUnsaved();
  }

  function addTicker() {
    if (!siteData.ticker) siteData.ticker = [];
    siteData.ticker.push('');
    renderTicker();
    // Focus the new textarea
    var items = document.querySelectorAll('.ticker-editor-item textarea');
    if (items.length) {
      var last = items[items.length - 1];
      last.focus();
      last.closest('.ticker-editor-item').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    markUnsaved();
  }

  function moveTicker(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= siteData.ticker.length) return;
    var temp = siteData.ticker[i];
    siteData.ticker[i] = siteData.ticker[j];
    siteData.ticker[j] = temp;
    renderTicker();
    markUnsaved();
  }

  function deleteTicker(i) {
    siteData.ticker.splice(i, 1);
    renderTicker();
    markUnsaved();
  }

  function updateTickerPreview() {
    var scrollEl = $('ticker-preview-scroll');
    if (!scrollEl) return;
    var items = siteData.ticker || [];
    if (items.length === 0) {
      scrollEl.innerHTML = '<span style="color:var(--admin-text-muted);font-style:italic;">No headlines — add one below</span>';
      scrollEl.style.animation = 'none';
      return;
    }
    // Duplicate content for seamless scroll loop
    var sep = '<span class="ticker-sep">&bull;</span>';
    var line = items.map(function(t) { return esc(t || '(empty)'); }).join(sep);
    scrollEl.innerHTML = line + sep + line + sep;
    scrollEl.style.animation = 'tickerScroll ' + Math.max(15, items.length * 5) + 's linear infinite';
  }

  function saveSiteSettings() {
    siteData.site_name = val('site-name');
    siteData.email = val('site-email');
    siteData.tagline = val('site-tagline');
    siteData.visitor_count = val('site-visitor-count');
    // Also sync footer_links from nav
    siteData.footer_links = (siteData.nav || []).map(n => ({ label: n.label, href: n.href }));
    saveToStorage('site', siteData);
    showToast('Site settings saved!', 'success');
    markSaved();
  }

  /* ============================================
     SAVE CURRENT SECTION
     ============================================ */

  function saveCurrentSection() {
    if ($('sec-article-editor').classList.contains('active')) {
      saveArticleFromEditor();
      return;
    }
    switch (currentSection) {
      case 'homepage': saveHomepage(); break;
      case 'about': saveAbout(); break;
      case 'site-settings': saveSiteSettings(); break;
      default: showToast('Nothing to save on this page', ''); break;
    }
  }

  /* ============================================
     EXPORT
     ============================================ */

  function exportAll() {
    downloadJSON('site.json', siteData);
    downloadJSON('homepage.json', homepageData);
    downloadJSON('about.json', aboutData);
    downloadJSON('articles.json', articlesData);

    for (const key of Object.keys(editorialsIndex)) {
      downloadJSON('editorial-' + key + '.json', editorialsIndex[key]);
    }

    for (const key of Object.keys(collectionsIndex)) {
      downloadJSON('collection-' + key + '.json', collectionsIndex[key]);
    }

    // Export uploaded images
    var imgKeys = Object.keys(imageStore);
    if (imgKeys.length > 0) {
      exportUploadedImages();
    }

    showToast('All JSON files exported!', 'success');
    markSaved();
  }

  function exportUploadedImages() {
    var keys = Object.keys(imageStore);
    for (var i = 0; i < keys.length; i++) {
      var path = keys[i];
      var dataUrl = imageStore[path];
      var filename = path.split('/').pop();
      // Convert data URL to blob and download
      try {
        var parts = dataUrl.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var bstr = atob(parts[1]);
        var arr = new Uint8Array(bstr.length);
        for (var j = 0; j < bstr.length; j++) arr[j] = bstr.charCodeAt(j);
        var blob = new Blob([arr], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Failed to export image:', path, e);
      }
    }
    if (keys.length > 0) {
      showToast(keys.length + ' uploaded image(s) exported', 'success');
    }
  }

  /* ============================================
     CONFIRM DELETE
     ============================================ */

  function confirmDelete() {
    if (pendingDeleteFn) {
      pendingDeleteFn();
      pendingDeleteFn = null;
    }
    closeModal('confirm-modal');
  }

  /* ============================================
     PUBLIC API
     ============================================ */

  window.adminPanel = {
    navigate,
    closeModal,

    // Homepage
    saveHomepage,
    addCoverHeadline,
    editCoverHeadline,
    deleteCoverHeadline,
    addStreamItem,
    editStreamItem,
    saveStreamItem,
    deleteStreamItem,
    moveStreamItem,
    toggleStreamFields,
    addStudioItem,
    editStudioItem,
    saveStudioItem,
    deleteStudioItem,

    // Articles — Shopify-Style List
    filterArticles,
    setArticleFilter,
    onArticleRowClick,
    toggleSelectArticle,
    toggleSelectAll,
    deleteSelectedArticles,

    // Articles — WYSIWYG Editor
    openArticleEditor,
    closeArticleEditor,
    toggleSettingsDrawer,
    saveArticleFromEditor,
    deleteArticle,
    addBlock,
    insertBlockAt,
    moveBlock,
    removeBlock,
    showBlockMenu,
    hideBlockMenu,
    onWysiwygInput,
    onDropcapToggle,
    triggerUpload,
    handleImageUpload,
    handleDrop,
    preventDragDefault,
    onImgPathPrompt,
    clearBlockImage,
    onCaptionInput,
    onHeroClick,
    onHeroInput,
    clearHeroImage,

    // Collections
    exportCollection,

    // About
    saveAbout,
    addAboutFact,
    editAboutFact,
    deleteAboutFact,
    addAboutBlock,
    editAboutBlock,
    deleteAboutBlock,

    // Site Settings
    saveSiteSettings,
    addNavLink,
    editNavLink,
    deleteNavLink,
    addTicker,
    onTickerInput,
    moveTicker,
    deleteTicker,

    // Global
    saveCurrentSection,
    exportAll,
    confirmDelete
  };

  /* ============================================
     BOOT
     ============================================ */

  document.addEventListener('DOMContentLoaded', init);

  // Close block menu when clicking outside
  document.addEventListener('click', function(e) {
    var menu = $('block-menu');
    if (menu && menu.classList.contains('open')) {
      if (!e.target.closest('.wysiwyg-add-block')) {
        menu.classList.remove('open');
      }
    }
  });

})();
