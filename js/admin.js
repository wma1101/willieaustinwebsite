(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */

  let siteData = null;
  let homepageData = null;
  let aboutData = null;
  let editorialsIndex = {}; // key -> data
  let collectionsIndex = {}; // key -> data
  let currentSection = 'dashboard';
  let pendingDeleteFn = null;
  let hasUnsaved = false;
  let editorialBodyBlocks = []; // temp blocks for modal

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

    // Show section
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
    const streamCount = (homepageData.stream || []).length;
    const studioCount = (homepageData.studio_content || []).length;
    const editorialCount = Object.keys(editorialsIndex).length;
    const collectionCount = Object.keys(collectionsIndex).length;
    const tickerCount = (siteData.ticker || []).length;

    stats.innerHTML = `
      <div class="stat-card"><div class="stat-value">${streamCount}</div><div class="stat-label">Stream Items</div></div>
      <div class="stat-card"><div class="stat-value">${studioCount}</div><div class="stat-label">Studio Items</div></div>
      <div class="stat-card"><div class="stat-value">${editorialCount}</div><div class="stat-label">Editorials</div></div>
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
     EDITORIALS
     ============================================ */

  function renderArticles() {
    const container = $('articles-list');
    const keys = Object.keys(editorialsIndex);

    if (keys.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-feather-alt"></i><p>No articles yet.</p></div>';
      return;
    }

    container.innerHTML = keys.map(key => {
      const ed = editorialsIndex[key];
      return `
        <div class="content-item">
          <div class="content-item__image">
            ${ed.hero_image ? `<img src="${esc(ed.hero_image)}" alt="">` : ''}
          </div>
          <div class="content-item__body">
            <div class="content-item__meta">${esc(ed.category || 'Editorial')} &mdash; ${esc(ed.date)} &mdash; ${esc(ed.read_time || '')}</div>
            <div class="content-item__title">${esc(ed.title)}</div>
            <div class="content-item__excerpt">${esc((ed.body && ed.body[0]) ? ed.body[0].text : '')}</div>
          </div>
          <div class="content-item__actions">
            <button class="btn-icon" onclick="adminPanel.openEditorialModal('${esc(key)}')" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="adminPanel.deleteEditorial('${esc(key)}')" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  }

  function openEditorialModal(key) {
    if (key) {
      const ed = editorialsIndex[key];
      setVal('editorial-edit-key', key);
      setVal('editorial-title', ed.title || '');
      setVal('editorial-category', ed.category || 'Editorial');
      setVal('editorial-author', ed.author || 'Willie Austin');
      setVal('editorial-date', ed.date || '');
      setVal('editorial-readtime', ed.read_time || '');
      setVal('editorial-tags', (ed.tags || []).join(', '));
      setVal('editorial-hero', ed.hero_image || '');
      editorialBodyBlocks = (ed.body || []).slice();
      $('editorial-modal-title').textContent = 'Edit Article';
    } else {
      setVal('editorial-edit-key', '');
      setVal('editorial-title', '');
      setVal('editorial-category', 'Editorial');
      setVal('editorial-author', 'Willie Austin');
      setVal('editorial-date', '');
      setVal('editorial-readtime', '');
      setVal('editorial-tags', '');
      setVal('editorial-hero', '');
      editorialBodyBlocks = [];
      $('editorial-modal-title').textContent = 'New Article';
    }
    renderEditorialBlocks();
    showModal('editorial-modal');
  }

  function renderEditorialBlocks() {
    const container = $('editorial-body-blocks');
    if (editorialBodyBlocks.length === 0) {
      container.innerHTML = '<p style="font-size:0.75rem;color:var(--admin-text-muted);">No body blocks yet. Add paragraphs, headings, images, or pullquotes.</p>';
      return;
    }

    container.innerHTML = '<div class="block-list">' + editorialBodyBlocks.map((block, i) => {
      let preview = '';
      if (block.type === 'paragraph') preview = truncate(block.text, 80);
      else if (block.type === 'heading') preview = block.text;
      else if (block.type === 'image') preview = block.src || '(no image)';
      else if (block.type === 'pullquote') preview = '"' + truncate(block.text, 60) + '"';

      return `
        <div class="block-item">
          <span class="block-type">${esc(block.type)}</span>
          <span class="block-content">${esc(preview)}</span>
          <div class="block-actions">
            <button class="btn-icon" onclick="adminPanel.editEditorialBlock(${i})" title="Edit"><i class="fas fa-pen" style="font-size:0.7rem;"></i></button>
            <button class="btn-icon danger" onclick="adminPanel.removeEditorialBlock(${i})" title="Remove"><i class="fas fa-times" style="font-size:0.7rem;"></i></button>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function addEditorialBlock(type) {
    let block;
    if (type === 'paragraph') block = { type: 'paragraph', text: '' };
    else if (type === 'heading') block = { type: 'heading', text: '' };
    else if (type === 'image') block = { type: 'image', layout: 'wide', src: '', caption: '' };
    else if (type === 'pullquote') block = { type: 'pullquote', text: '' };
    editorialBodyBlocks.push(block);
    editEditorialBlock(editorialBodyBlocks.length - 1);
  }

  function editEditorialBlock(i) {
    const block = editorialBodyBlocks[i];
    if (block.type === 'paragraph') {
      const text = prompt('Paragraph text:', block.text);
      if (text !== null) block.text = text;
      const dropcap = confirm('Use dropcap?');
      block.dropcap = dropcap;
    } else if (block.type === 'heading') {
      const text = prompt('Heading text:', block.text);
      if (text !== null) block.text = text;
    } else if (block.type === 'image') {
      const src = prompt('Image path:', block.src);
      if (src !== null) block.src = src;
      const layout = prompt('Layout (wide or full-bleed):', block.layout || 'wide');
      if (layout !== null) block.layout = layout;
      const caption = prompt('Caption (optional):', block.caption);
      if (caption !== null) block.caption = caption;
    } else if (block.type === 'pullquote') {
      const text = prompt('Pullquote text:', block.text);
      if (text !== null) block.text = text;
      const attr = prompt('Attribution (optional):', block.attribution || '');
      if (attr !== null) block.attribution = attr;
    }
    renderEditorialBlocks();
  }

  function removeEditorialBlock(i) {
    editorialBodyBlocks.splice(i, 1);
    renderEditorialBlocks();
  }

  function saveEditorial() {
    const title = val('editorial-title');
    if (!title) { showToast('Title is required', 'error'); return; }

    const key = val('editorial-edit-key') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    editorialsIndex[key] = {
      category: val('editorial-category'),
      title: title,
      author: val('editorial-author'),
      date: val('editorial-date'),
      read_time: val('editorial-readtime'),
      hero_image: val('editorial-hero'),
      tags: val('editorial-tags').split(',').map(t => t.trim()).filter(Boolean),
      body: editorialBodyBlocks.slice()
    };

    saveToStorage('editorial_' + key, editorialsIndex[key]);
    closeModal('editorial-modal');
    renderArticles();
    renderDashboard();
    showToast('Article saved!', 'success');
  }

  function deleteEditorial(key) {
    pendingDeleteFn = () => {
      delete editorialsIndex[key];
      localStorage.removeItem(STORAGE_PREFIX + 'editorial_' + key);
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
    const items = siteData.ticker || [];
    const container = $('ticker-list');
    container.innerHTML = items.map((text, i) => `
      <div class="ticker-item">
        <input type="text" class="form-control" value="${esc(text)}" onchange="adminPanel.updateTicker(${i}, this.value)">
        <button class="btn-icon danger" onclick="adminPanel.deleteTicker(${i})" title="Remove"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  function addTicker() {
    if (!siteData.ticker) siteData.ticker = [];
    siteData.ticker.push('');
    renderTicker();
    // Focus the new input
    const inputs = document.querySelectorAll('#ticker-list input');
    if (inputs.length) inputs[inputs.length - 1].focus();
    markUnsaved();
  }

  function updateTicker(i, value) {
    siteData.ticker[i] = value;
    markUnsaved();
  }

  function deleteTicker(i) {
    siteData.ticker.splice(i, 1);
    renderTicker();
    markUnsaved();
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

    for (const key of Object.keys(editorialsIndex)) {
      downloadJSON('editorial-' + key + '.json', editorialsIndex[key]);
    }

    for (const key of Object.keys(collectionsIndex)) {
      downloadJSON('collection-' + key + '.json', collectionsIndex[key]);
    }

    showToast('All JSON files exported!', 'success');
    markSaved();
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

    // Editorials
    openEditorialModal,
    saveEditorial,
    deleteEditorial,
    addEditorialBlock,
    editEditorialBlock,
    removeEditorialBlock,

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
    updateTicker,
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

})();
