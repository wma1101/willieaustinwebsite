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
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage save failed for', key, e);
      if (key === 'imageStore') showToast('Storage full — image kept in memory only', 'error');
    }
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

    // Clear old image store from localStorage to free space
    try { localStorage.removeItem(STORAGE_PREFIX + 'imageStore'); } catch (e) {}
    imageStore = {};

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
     HOMEPAGE EDITOR — WYSIWYG
     ============================================ */

  function renderHomepage() {
    var cover = homepageData.cover || {};

    // Cover image
    renderHpCoverImage(cover.image);

    // Cover title
    var titleEl = $('hp-cover-title');
    if (titleEl) titleEl.innerText = cover.title || '';

    // Headlines
    renderCoverHeadlines();

    // Featured
    renderFeaturedItems();

    // Stream
    renderStreamItems();

    // Studio
    renderStudioItems();

    // Quote
    var quoteEl = $('hp-quote');
    if (quoteEl) quoteEl.textContent = homepageData.personal_quote || '';
  }

  function renderHpCoverImage(imgPath) {
    var src = resolveImageSrc(imgPath || '');
    var img = $('hp-cover-img');
    var placeholder = $('hp-cover-placeholder');
    var actions = $('hp-cover-actions');
    if (src) {
      img.src = src;
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

  function clearHpImage(type) {
    if (type === 'cover') {
      if (!homepageData.cover) homepageData.cover = {};
      homepageData.cover.image = '';
      renderHpCoverImage('');
      markUnsaved();
    }
  }

  // Helper: image zone HTML for homepage cards
  function hpImgZone(target, imgSrc) {
    var safeSrc = imgSrc ? (imgSrc.indexOf('data:') === 0 ? imgSrc : esc(imgSrc)) : '';
    return '<div class="hp-img-zone"' +
      ' ondragover="adminPanel.preventDragDefault(event)"' +
      ' ondragenter="adminPanel.preventDragDefault(event)"' +
      ' ondrop="adminPanel.handleDrop(event,\'' + target + '\')">' +
      (safeSrc ? '<img src="' + safeSrc + '" alt="">' : '') +
      '<div class="hp-img-overlay' + (imgSrc ? '' : ' empty') + '" onclick="adminPanel.triggerUpload(\'' + target + '\')">' +
      '<i class="fas fa-camera"></i>' +
      '</div></div>';
  }

  // Generic field update handler
  function onHpInput(section, index, field, value) {
    if (section === 'featured') {
      if (homepageData.featured && homepageData.featured[index]) homepageData.featured[index][field] = value;
    } else if (section === 'stream') {
      if (homepageData.stream && homepageData.stream[index]) homepageData.stream[index][field] = value;
    } else if (section === 'studio') {
      if (homepageData.studio_content && homepageData.studio_content[index]) homepageData.studio_content[index][field] = value;
    }
    markUnsaved();
  }

  function onHpDuoInput(streamIdx, subIdx, field, value) {
    if (homepageData.stream && homepageData.stream[streamIdx] && homepageData.stream[streamIdx].items) {
      homepageData.stream[streamIdx].items[subIdx][field] = value;
    }
    markUnsaved();
  }

  function onHpHeadlineInput(i, field, value) {
    if (homepageData.cover && homepageData.cover.headlines && homepageData.cover.headlines[i]) {
      homepageData.cover.headlines[i][field] = value;
    }
    markUnsaved();
  }

  // Apply uploaded image to homepage target
  function applyHpUpload(target, path) {
    // target format: hp-cover, hp-featured-N, hp-stream-N, hp-duo-N-M, hp-studio-N
    var parts = target.split('-');
    if (parts[1] === 'cover') {
      if (!homepageData.cover) homepageData.cover = {};
      homepageData.cover.image = path;
      renderHpCoverImage(path);
    } else if (parts[1] === 'featured') {
      var idx = parseInt(parts[2]);
      if (homepageData.featured && homepageData.featured[idx]) {
        homepageData.featured[idx].image = path;
        renderFeaturedItems();
      }
    } else if (parts[1] === 'stream') {
      var idx = parseInt(parts[2]);
      if (homepageData.stream && homepageData.stream[idx]) {
        homepageData.stream[idx].image = path;
        renderStreamItems();
      }
    } else if (parts[1] === 'duo') {
      var si = parseInt(parts[2]);
      var di = parseInt(parts[3]);
      if (homepageData.stream && homepageData.stream[si] && homepageData.stream[si].items) {
        homepageData.stream[si].items[di].image = path;
        renderStreamItems();
      }
    } else if (parts[1] === 'studio') {
      var idx = parseInt(parts[2]);
      if (homepageData.studio_content && homepageData.studio_content[idx]) {
        homepageData.studio_content[idx].image = path;
        renderStudioItems();
      }
    }
  }

  function clearHpItemImage(section, index, subIndex) {
    if (section === 'featured') {
      if (homepageData.featured && homepageData.featured[index]) homepageData.featured[index].image = '';
      renderFeaturedItems();
    } else if (section === 'stream') {
      if (homepageData.stream && homepageData.stream[index]) homepageData.stream[index].image = '';
      renderStreamItems();
    } else if (section === 'duo') {
      if (homepageData.stream && homepageData.stream[index] && homepageData.stream[index].items) {
        homepageData.stream[index].items[subIndex].image = '';
      }
      renderStreamItems();
    } else if (section === 'studio') {
      if (homepageData.studio_content && homepageData.studio_content[index]) homepageData.studio_content[index].image = '';
      renderStudioItems();
    }
    markUnsaved();
  }

  // --- Cover Headlines ---

  function renderCoverHeadlines() {
    var headlines = (homepageData.cover || {}).headlines || [];
    var container = $('hp-headlines');
    if (!container) return;

    if (headlines.length === 0) {
      container.innerHTML = '<div class="hp-empty">No headlines yet.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < headlines.length; i++) {
      var h = headlines[i];
      html += '<div class="hp-headline-card">' +
        '<div class="hp-headline-fields">' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(h.tag || '') + '" placeholder="Tag" oninput="adminPanel.onHpHeadlineInput(' + i + ',\'tag\',this.value)">' +
        '<input type="text" class="hp-field hp-field-title" value="' + esc(h.text || '') + '" placeholder="Headline text" oninput="adminPanel.onHpHeadlineInput(' + i + ',\'text\',this.value)">' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(h.href || '') + '" placeholder="Link (e.g. collection.html)" oninput="adminPanel.onHpHeadlineInput(' + i + ',\'href\',this.value)">' +
        '</div>' +
        '<div class="hp-card-actions">' +
        (i > 0 ? '<button onclick="adminPanel.moveCoverHeadline(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>' : '') +
        (i < headlines.length - 1 ? '<button onclick="adminPanel.moveCoverHeadline(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>' : '') +
        '<button class="danger" onclick="adminPanel.deleteCoverHeadline(' + i + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div></div>';
    }
    container.innerHTML = html;
  }

  function addCoverHeadline() {
    if (!homepageData.cover) homepageData.cover = {};
    if (!homepageData.cover.headlines) homepageData.cover.headlines = [];
    homepageData.cover.headlines.push({ tag: 'New', text: '', href: '#' });
    renderCoverHeadlines();
    markUnsaved();
  }

  function moveCoverHeadline(i, dir) {
    var arr = homepageData.cover.headlines;
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    renderCoverHeadlines();
    markUnsaved();
  }

  function deleteCoverHeadline(i) {
    pendingDeleteFn = function() {
      homepageData.cover.headlines.splice(i, 1);
      renderCoverHeadlines();
      markUnsaved();
    };
    showModal('confirm-modal');
  }

  // --- Featured Items ---

  function renderFeaturedItems() {
    var items = homepageData.featured || [];
    var container = $('hp-featured');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div class="hp-empty">No featured items yet.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var imgSrc = resolveImageSrc(item.image || '');
      var target = 'hp-featured-' + i;
      html += '<div class="hp-visual-card">' +
        '<div class="hp-card-bar">' +
        '<span class="hp-card-badge">Featured' + (item.lead ? ' &bull; Lead' : '') + '</span>' +
        '<div class="hp-card-actions">' +
        (i > 0 ? '<button onclick="adminPanel.moveFeaturedItem(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>' : '') +
        (i < items.length - 1 ? '<button onclick="adminPanel.moveFeaturedItem(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>' : '') +
        '<button class="danger" onclick="adminPanel.deleteFeaturedItem(' + i + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div></div>' +
        '<div class="hp-card-content">' +
        hpImgZone(target, imgSrc) +
        '<div class="hp-card-fields">' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(item.category || '') + '" placeholder="Category" oninput="adminPanel.onHpInput(\'featured\',' + i + ',\'category\',this.value)">' +
        '<input type="text" class="hp-field hp-field-title" value="' + esc(item.title || '') + '" placeholder="Title" oninput="adminPanel.onHpInput(\'featured\',' + i + ',\'title\',this.value)">' +
        '<textarea class="hp-field" placeholder="Excerpt" rows="2" oninput="adminPanel.onHpInput(\'featured\',' + i + ',\'excerpt\',this.value)">' + esc(item.excerpt || '') + '</textarea>' +
        '<div class="hp-field-row">' +
        '<input type="text" class="hp-field" value="' + esc(item.href || '') + '" placeholder="Link" oninput="adminPanel.onHpInput(\'featured\',' + i + ',\'href\',this.value)">' +
        '<input type="text" class="hp-field" value="' + esc(item.cta || '') + '" placeholder="CTA text" oninput="adminPanel.onHpInput(\'featured\',' + i + ',\'cta\',this.value)">' +
        '</div>' +
        '<label class="hp-checkbox"><input type="checkbox"' + (item.lead ? ' checked' : '') + ' onchange="adminPanel.onHpInput(\'featured\',' + i + ',\'lead\',this.checked)"> Lead item</label>' +
        '</div></div></div>';
    }
    container.innerHTML = html;
  }

  function addFeaturedItem() {
    if (!homepageData.featured) homepageData.featured = [];
    homepageData.featured.push({ category: '', title: '', excerpt: '', href: '', image: '', cta: '', lead: false });
    renderFeaturedItems();
    markUnsaved();
  }

  function moveFeaturedItem(i, dir) {
    var arr = homepageData.featured;
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    renderFeaturedItems();
    markUnsaved();
  }

  function deleteFeaturedItem(i) {
    pendingDeleteFn = function() {
      homepageData.featured.splice(i, 1);
      renderFeaturedItems();
      markUnsaved();
    };
    showModal('confirm-modal');
  }

  // --- Stream Items ---

  function renderStreamItems() {
    var items = homepageData.stream || [];
    var container = $('hp-stream');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div class="hp-empty">No stream items yet.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html += renderStreamCard(item, i, items.length);
    }
    container.innerHTML = html;
  }

  function renderStreamCard(item, i, total) {
    var actions = '<div class="hp-card-actions">' +
      (i > 0 ? '<button onclick="adminPanel.moveStreamItem(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>' : '') +
      (i < total - 1 ? '<button onclick="adminPanel.moveStreamItem(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>' : '') +
      '<button class="danger" onclick="adminPanel.deleteStreamItem(' + i + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
      '</div>';

    if (item.type === 'feature') {
      var imgSrc = resolveImageSrc(item.image || '');
      return '<div class="hp-visual-card">' +
        '<div class="hp-card-bar"><span class="hp-card-badge feature">Feature</span>' + actions + '</div>' +
        '<div class="hp-card-content">' +
        hpImgZone('hp-stream-' + i, imgSrc) +
        '<div class="hp-card-fields">' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(item.category || '') + '" placeholder="Category" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'category\',this.value)">' +
        '<input type="text" class="hp-field hp-field-title" value="' + esc(item.title || '') + '" placeholder="Title" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'title\',this.value)">' +
        '<textarea class="hp-field" placeholder="Excerpt" rows="2" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'excerpt\',this.value)">' + esc(item.excerpt || '') + '</textarea>' +
        '<div class="hp-field-row">' +
        '<input type="text" class="hp-field" value="' + esc(item.date || '') + '" placeholder="Date" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'date\',this.value)">' +
        '<input type="text" class="hp-field" value="' + esc(item.source || '') + '" placeholder="Source" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'source\',this.value)">' +
        '</div></div></div></div>';
    }

    if (item.type === 'duo') {
      var items2 = item.items || [{}, {}];
      var duoHtml = '<div class="hp-visual-card">' +
        '<div class="hp-card-bar"><span class="hp-card-badge duo">Duo</span>' + actions + '</div>' +
        '<div class="hp-duo-wrap">';
      for (var d = 0; d < 2; d++) {
        var sub = items2[d] || {};
        var subSrc = resolveImageSrc(sub.image || '');
        duoHtml += '<div class="hp-duo-item">' +
          '<div class="hp-duo-label">Item ' + (d + 1) + '</div>' +
          '<div class="hp-card-content">' +
          hpImgZone('hp-duo-' + i + '-' + d, subSrc) +
          '<div class="hp-card-fields">' +
          '<input type="text" class="hp-field hp-field-sm" value="' + esc(sub.category || '') + '" placeholder="Category" oninput="adminPanel.onHpDuoInput(' + i + ',' + d + ',\'category\',this.value)">' +
          '<input type="text" class="hp-field hp-field-title" value="' + esc(sub.title || '') + '" placeholder="Title" oninput="adminPanel.onHpDuoInput(' + i + ',' + d + ',\'title\',this.value)">' +
          '<textarea class="hp-field" placeholder="Excerpt" rows="2" oninput="adminPanel.onHpDuoInput(' + i + ',' + d + ',\'excerpt\',this.value)">' + esc(sub.excerpt || '') + '</textarea>' +
          '<div class="hp-field-row">' +
          '<input type="text" class="hp-field" value="' + esc(sub.date || '') + '" placeholder="Date" oninput="adminPanel.onHpDuoInput(' + i + ',' + d + ',\'date\',this.value)">' +
          '<input type="text" class="hp-field" value="' + esc(sub.source || '') + '" placeholder="Source" oninput="adminPanel.onHpDuoInput(' + i + ',' + d + ',\'source\',this.value)">' +
          '</div></div></div></div>';
      }
      duoHtml += '</div></div>';
      return duoHtml;
    }

    if (item.type === 'quote') {
      return '<div class="hp-visual-card hp-quote-card">' +
        '<div class="hp-card-bar"><span class="hp-card-badge quote">Quote</span>' + actions + '</div>' +
        '<div class="hp-quote-body">' +
        '<i class="fas fa-quote-left hp-quote-icon"></i>' +
        '<textarea class="hp-field hp-field-quote" placeholder="Quote text..." rows="2" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'text\',this.value)">' + esc(item.text || '') + '</textarea>' +
        '</div></div>';
    }

    if (item.type === 'stat') {
      return '<div class="hp-visual-card hp-stat-card">' +
        '<div class="hp-card-bar"><span class="hp-card-badge stat">Stat</span>' + actions + '</div>' +
        '<div class="hp-stat-body">' +
        '<textarea class="hp-field" placeholder="Stat text..." rows="2" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'text\',this.value)">' + esc(item.text || '') + '</textarea>' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(item.source || '') + '" placeholder="Source" oninput="adminPanel.onHpInput(\'stream\',' + i + ',\'source\',this.value)">' +
        '</div></div>';
    }

    return '';
  }

  function addStreamItem(type) {
    if (!homepageData.stream) homepageData.stream = [];
    var newItem;
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
    renderStreamItems();
    markUnsaved();
  }

  function deleteStreamItem(i) {
    pendingDeleteFn = function() {
      homepageData.stream.splice(i, 1);
      renderStreamItems();
      markUnsaved();
    };
    showModal('confirm-modal');
  }

  function moveStreamItem(i, dir) {
    var arr = homepageData.stream;
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    renderStreamItems();
    markUnsaved();
  }

  // --- Studio Items ---

  function renderStudioItems() {
    var items = homepageData.studio_content || [];
    var container = $('hp-studio');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div class="hp-empty">No studio items yet.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var imgSrc = resolveImageSrc(item.image || '');
      html += '<div class="hp-visual-card">' +
        '<div class="hp-card-bar">' +
        '<span class="hp-card-badge studio">Studio</span>' +
        '<div class="hp-card-actions">' +
        (i > 0 ? '<button onclick="adminPanel.moveStudioItem(' + i + ',-1)" title="Move up"><i class="fas fa-chevron-up"></i></button>' : '') +
        (i < items.length - 1 ? '<button onclick="adminPanel.moveStudioItem(' + i + ',1)" title="Move down"><i class="fas fa-chevron-down"></i></button>' : '') +
        '<button class="danger" onclick="adminPanel.deleteStudioItem(' + i + ')" title="Delete"><i class="fas fa-trash"></i></button>' +
        '</div></div>' +
        '<div class="hp-card-content">' +
        hpImgZone('hp-studio-' + i, imgSrc) +
        '<div class="hp-card-fields">' +
        '<input type="text" class="hp-field hp-field-sm" value="' + esc(item.category || '') + '" placeholder="Category" oninput="adminPanel.onHpInput(\'studio\',' + i + ',\'category\',this.value)">' +
        '<input type="text" class="hp-field hp-field-title" value="' + esc(item.title || '') + '" placeholder="Title" oninput="adminPanel.onHpInput(\'studio\',' + i + ',\'title\',this.value)">' +
        '<textarea class="hp-field" placeholder="Excerpt" rows="2" oninput="adminPanel.onHpInput(\'studio\',' + i + ',\'excerpt\',this.value)">' + esc(item.excerpt || '') + '</textarea>' +
        '<div class="hp-field-row">' +
        '<input type="text" class="hp-field" value="' + esc(item.date || '') + '" placeholder="Date" oninput="adminPanel.onHpInput(\'studio\',' + i + ',\'date\',this.value)">' +
        '<input type="text" class="hp-field" value="' + esc(item.href || '') + '" placeholder="Link" oninput="adminPanel.onHpInput(\'studio\',' + i + ',\'href\',this.value)">' +
        '</div></div></div></div>';
    }
    container.innerHTML = html;
  }

  function addStudioItem() {
    if (!homepageData.studio_content) homepageData.studio_content = [];
    homepageData.studio_content.push({ category: '', title: '', excerpt: '', date: '', href: '', image: '' });
    renderStudioItems();
    markUnsaved();
  }

  function moveStudioItem(i, dir) {
    var arr = homepageData.studio_content;
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    renderStudioItems();
    markUnsaved();
  }

  function deleteStudioItem(i) {
    pendingDeleteFn = function() {
      homepageData.studio_content.splice(i, 1);
      renderStudioItems();
      markUnsaved();
    };
    showModal('confirm-modal');
  }

  // --- Save Homepage ---

  function saveHomepage() {
    homepageData.cover = homepageData.cover || {};
    // Read contenteditable fields
    var titleEl = $('hp-cover-title');
    if (titleEl) homepageData.cover.title = titleEl.innerText;
    var quoteEl = $('hp-quote');
    if (quoteEl) homepageData.personal_quote = quoteEl.textContent;
    // Everything else already synced via oninput
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

      // Store in memory only (not localStorage — too large)
      imageStore[path] = dataUrl;

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
      } else if (typeof pendingUploadTarget === 'string' && pendingUploadTarget.indexOf('hp-') === 0) {
        applyHpUpload(pendingUploadTarget, path);
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

      if (target === 'hero') {
        setVal('editor-hero', path);
        renderHero();
      } else if (typeof target === 'number') {
        if (editorialBodyBlocks[target]) {
          editorialBodyBlocks[target].src = path;
          renderWysiwygBody();
        }
      } else if (typeof target === 'string' && target.indexOf('hp-') === 0) {
        applyHpUpload(target, path);
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

  function clearStorage() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(STORAGE_PREFIX) === 0) keys.push(k);
    }
    for (var j = 0; j < keys.length; j++) localStorage.removeItem(keys[j]);
    showToast('Storage cleared — reload to see original content', 'success');
  }

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

    // Homepage — WYSIWYG
    saveHomepage,
    clearHpImage,
    clearHpItemImage,
    onHpInput,
    onHpDuoInput,
    onHpHeadlineInput,
    addCoverHeadline,
    moveCoverHeadline,
    deleteCoverHeadline,
    addFeaturedItem,
    moveFeaturedItem,
    deleteFeaturedItem,
    addStreamItem,
    deleteStreamItem,
    moveStreamItem,
    addStudioItem,
    moveStudioItem,
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
    clearStorage,
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
