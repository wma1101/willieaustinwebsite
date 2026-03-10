/* Content Loader — Willie Austin Website
   Fetches JSON content files and renders page content dynamically.
   Edit the files in /content/ to update the site.

   JSON files:
   - content/site.json         → Nav, footer, ticker (all pages)
   - content/homepage.json     → Cover, featured, stream, studio content
   - content/collection-nocturne.json → Collection lookbook
   - content/editorial-new-silhouette.json → Editorial article
   - content/about.json        → Profile page
*/

const Content = (() => {
  // Detect current page
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  const page = filename === 'editorial.html' ? 'articles'
    : filename === 'article.html' ? 'article'
    : path.includes('editorial') ? 'editorial'
    : path.includes('collection') ? 'collection'
    : path.includes('about') ? 'about'
    : path.includes('game') ? 'game'
    : 'index';

  // Check localStorage for admin edits, then fall back to JSON file
  function getFromStorage(key) {
    try {
      const raw = localStorage.getItem('wa_' + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Fetch a JSON file, return parsed data or null on error
  async function load(file, storageKey) {
    // Check localStorage first (admin panel saves here)
    if (storageKey) {
      const stored = getFromStorage(storageKey);
      if (stored) return stored;
    }

    // Check inline embedded data first (always works, no network needed)
    if (window.__CONTENT_DATA__ && window.__CONTENT_DATA__[file]) {
      console.log('[Content] Using inline data for', file);
      return window.__CONTENT_DATA__[file];
    }

    // Try fetch
    try {
      const res = await fetch('content/' + file);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[Content] Fetch failed for', file, e.message);
    }

    console.warn('[Content] Could not load', file);
    return null;
  }

  // Helper: set text content of first matching element
  function setText(selector, text, parent) {
    const el = (parent || document).querySelector(selector);
    if (el && text != null) el.textContent = text;
  }

  // Helper: set innerHTML of first matching element
  function setHTML(selector, html, parent) {
    const el = (parent || document).querySelector(selector);
    if (el && html != null) el.innerHTML = html;
  }

  // Helper: build an img tag with fallback
  function imgTag(src, alt, extra) {
    return `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" ${extra || ''}>`;
  }

  // Generate article URL — dedicated pages get their own URL, others use article.html?id=slug
  function articleUrl(item) {
    if (item.href && item.href.startsWith('editorial-')) return item.href;
    if (item.href && item.href.startsWith('collection')) return item.href;
    if (item.href && item.href === 'about.html') return item.href;
    const slug = (item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return 'article.html?id=' + slug;
  }

  // HTML-escape
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── SITE-WIDE (nav, footer, ticker) ───

  async function renderSite(data) {
    if (!data) return;

    // Update masthead logo
    const logo = document.querySelector('.masthead__logo');
    if (logo) logo.textContent = data.site_name || 'WILLIE AUSTIN';

    // Update nav links
    const nav = document.querySelector('.masthead__nav');
    if (nav && data.nav) {
      nav.innerHTML = data.nav.map(item => {
        const isActive = (page === 'index' && (item.id === 'latest' || item.id === 'stream'))
          || (page === item.id)
          || (item.href === window.location.pathname.split('/').pop());
        const accent = item.accent ? ' nav-link--play' : '';
        const hover = item.accent ? ' data-hover-sound' : '';
        return `<a href="${esc(item.href)}" class="nav-link${isActive ? ' active' : ''}${accent}"${hover}>${esc(item.label)}</a>`;
      }).join('\n');
    }

    // Update footer links
    const footerLinks = document.querySelector('.footer__links');
    if (footerLinks && data.footer_links) {
      const bored = footerLinks.querySelector('.easter-egg-link');
      footerLinks.innerHTML = data.footer_links.map(item =>
        `<a href="${esc(item.href)}">${esc(item.label)}</a>`
      ).join('\n');
      // Re-add the easter egg if it existed
      if (bored) footerLinks.appendChild(bored);
    }

    // Update ticker
    const marquee = document.querySelector('.marquee__inner');
    if (marquee && data.ticker) {
      const items = data.ticker.concat(data.ticker); // duplicate for seamless scroll
      marquee.innerHTML = items.map(t =>
        `<span class="marquee__text">${t}</span><span class="marquee__separator">&bull;</span>`
      ).join('\n');
    }

    // Update visitor counter
    if (data.visitor_count) {
      const counter = document.getElementById('visitor-count');
      if (counter) counter.textContent = data.visitor_count;
    }

    // Update footer tagline
    if (data.tagline) {
      const tagEl = document.querySelector('.footer__inner .caption');
      if (tagEl) tagEl.textContent = data.tagline;
    }

    // Update footer contact email
    if (data.email) {
      const contactLink = document.querySelector('.footer__contact a[href^="mailto:"]');
      if (contactLink) {
        contactLink.href = `mailto:${data.email}`;
        contactLink.textContent = data.email;
      }
    }
  }

  // ─── HOMEPAGE (Vogue-style) ───

  async function renderHomepage(data) {
    console.log('[Content] renderHomepage called, data:', !!data);
    if (!data) return;

    // Cover
    if (data.cover) {
      const c = data.cover;
      if (c.title) {
        const titleEl = document.querySelector('.cover__title');
        if (titleEl) titleEl.innerHTML = c.title.replace(/\n/g, '<br>');
      }
      if (c.image) {
        const img = document.querySelector('.cover__image img');
        if (img) img.src = c.image;
      }
      if (c.headlines) {
        const container = document.querySelector('.cover__headlines');
        if (container) {
          container.innerHTML = c.headlines.map(h =>
            `<a href="${esc(h.href)}" class="cover__headline-item">
              <span class="cover__headline-tag">${esc(h.tag)}</span>
              <span class="cover__headline-text">${esc(h.text)}</span>
            </a>`
          ).join('\n');
        }
      }
    }

    // Build all articles into a flat array for the stream
    const allItems = [];
    if (data.featured) {
      data.featured.forEach(item => allItems.push(item));
    }
    if (data.stream) {
      data.stream.forEach(block => {
        if (block.type === 'feature') allItems.push(block);
        else if (block.type === 'duo' && block.items) block.items.forEach(i => allItems.push(i));
      });
    }
    if (data.studio_content) {
      data.studio_content.forEach(item => allItems.push(item));
    }

    // Deduplicate by title
    const seen = new Set();
    const items = allItems.filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    // Render the stream
    const streamEl = document.getElementById('stream');
    console.log('[Content] Stream element:', !!streamEl, 'Items:', items.length);
    if (!streamEl || !items.length) return;

    let html = '';
    let idx = 0;

    // --- HERO FEATURE (first item, full-width) ---
    if (items[idx]) {
      const item = items[idx];
      const href = articleUrl(item);
      html += `
        <a href="${esc(href)}" class="vogue-hero reveal">
          <div class="vogue-hero__img">
            <img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">
          </div>
          <div class="vogue-hero__text">
            <span class="vogue-rubric">${esc(item.category)}</span>
            <h2 class="vogue-hero__title">${esc(item.title)}</h2>
            ${item.source ? `<span class="vogue-byline">via ${esc(item.source)}</span>` : ''}
          </div>
        </a>`;
      idx++;
    }

    // --- ASYMMETRIC GRID: 1 large + 2 small ---
    if (items.length > idx + 2) {
      const big = items[idx];
      const sm1 = items[idx + 1];
      const sm2 = items[idx + 2];
      html += `
        <div class="vogue-asym reveal">
          <a href="${esc(articleUrl(big))}" class="vogue-asym__big">
            <div class="vogue-card__img"><img src="${esc(big.image)}" alt="${esc(big.title)}" loading="lazy"></div>
            <span class="vogue-rubric">${esc(big.category)}</span>
            <h3 class="vogue-card__title">${esc(big.title)}</h3>
            ${big.source ? `<span class="vogue-byline">via ${esc(big.source)}</span>` : ''}
          </a>
          <div class="vogue-asym__side">
            <a href="${esc(articleUrl(sm1))}" class="vogue-asym__small">
              <div class="vogue-card__img"><img src="${esc(sm1.image)}" alt="${esc(sm1.title)}" loading="lazy"></div>
              <span class="vogue-rubric">${esc(sm1.category)}</span>
              <h3 class="vogue-card__title">${esc(sm1.title)}</h3>
              ${sm1.source ? `<span class="vogue-byline">via ${esc(sm1.source)}</span>` : ''}
            </a>
            <a href="${esc(articleUrl(sm2))}" class="vogue-asym__small">
              <div class="vogue-card__img"><img src="${esc(sm2.image)}" alt="${esc(sm2.title)}" loading="lazy"></div>
              <span class="vogue-rubric">${esc(sm2.category)}</span>
              <h3 class="vogue-card__title">${esc(sm2.title)}</h3>
              ${sm2.source ? `<span class="vogue-byline">via ${esc(sm2.source)}</span>` : ''}
            </a>
          </div>
        </div>`;
      idx += 3;
    }

    // --- 3-COLUMN GRID ---
    if (items.length > idx + 2) {
      html += `<div class="vogue-grid-3 reveal">`;
      for (let i = 0; i < 3 && idx < items.length; i++, idx++) {
        const item = items[idx];
        html += `
          <a href="${esc(articleUrl(item))}" class="vogue-card">
            <div class="vogue-card__img"><img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy"></div>
            <span class="vogue-rubric">${esc(item.category)}</span>
            <h3 class="vogue-card__title">${esc(item.title)}</h3>
            ${item.source ? `<span class="vogue-byline">via ${esc(item.source)}</span>` : ''}
          </a>`;
      }
      html += `</div>`;
    }

    // --- FULL-WIDTH FEATURE ---
    if (items[idx]) {
      const item = items[idx];
      html += `
        <a href="${esc(articleUrl(item))}" class="vogue-full reveal">
          <div class="vogue-full__img">
            <img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">
          </div>
          <div class="vogue-full__text">
            <span class="vogue-rubric">${esc(item.category)}</span>
            <h2 class="vogue-full__title">${esc(item.title)}</h2>
            ${item.source ? `<span class="vogue-byline">via ${esc(item.source)}</span>` : ''}
          </div>
        </a>`;
      idx++;
    }

    // --- ASYMMETRIC REVERSE: 2 small + 1 large ---
    if (items.length > idx + 2) {
      const sm1 = items[idx];
      const sm2 = items[idx + 1];
      const big = items[idx + 2];
      html += `
        <div class="vogue-asym vogue-asym--reverse reveal">
          <div class="vogue-asym__side">
            <a href="${esc(articleUrl(sm1))}" class="vogue-asym__small">
              <div class="vogue-card__img"><img src="${esc(sm1.image)}" alt="${esc(sm1.title)}" loading="lazy"></div>
              <span class="vogue-rubric">${esc(sm1.category)}</span>
              <h3 class="vogue-card__title">${esc(sm1.title)}</h3>
              ${sm1.source ? `<span class="vogue-byline">via ${esc(sm1.source)}</span>` : ''}
            </a>
            <a href="${esc(articleUrl(sm2))}" class="vogue-asym__small">
              <div class="vogue-card__img"><img src="${esc(sm2.image)}" alt="${esc(sm2.title)}" loading="lazy"></div>
              <span class="vogue-rubric">${esc(sm2.category)}</span>
              <h3 class="vogue-card__title">${esc(sm2.title)}</h3>
              ${sm2.source ? `<span class="vogue-byline">via ${esc(sm2.source)}</span>` : ''}
            </a>
          </div>
          <a href="${esc(articleUrl(big))}" class="vogue-asym__big">
            <div class="vogue-card__img"><img src="${esc(big.image)}" alt="${esc(big.title)}" loading="lazy"></div>
            <span class="vogue-rubric">${esc(big.category)}</span>
            <h3 class="vogue-card__title">${esc(big.title)}</h3>
            ${big.source ? `<span class="vogue-byline">via ${esc(big.source)}</span>` : ''}
          </a>
        </div>`;
      idx += 3;
    }

    // --- Remaining items as 3-column grids ---
    while (idx < items.length) {
      const chunk = items.slice(idx, idx + 3);
      html += `<div class="vogue-grid-3 reveal">`;
      chunk.forEach(item => {
        html += `
          <a href="${esc(articleUrl(item))}" class="vogue-card">
            <div class="vogue-card__img"><img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy"></div>
            <span class="vogue-rubric">${esc(item.category)}</span>
            <h3 class="vogue-card__title">${esc(item.title)}</h3>
            ${item.source ? `<span class="vogue-byline">via ${esc(item.source)}</span>` : ''}
          </a>`;
      });
      html += `</div>`;
      idx += chunk.length;
    }

    streamEl.innerHTML = html;
  }

  // ─── COLLECTION PAGE ───

  async function renderCollection(data) {
    if (!data) return;

    // Hero
    setText('.collection-hero__season', data.season);
    setText('.collection-hero__title', data.title);
    setText('.collection-hero__desc', data.description);
    if (data.hero_image) {
      const heroImg = document.querySelector('.collection-hero__image img');
      if (heroImg) heroImg.src = data.hero_image;
    }

    // Update page title
    if (data.title && data.season) {
      document.title = `${data.title} — ${data.season} | WILLIE AUSTIN`;
    }

    // Lookbook body
    const lookbook = document.querySelector('.lookbook');
    if (!lookbook || !data.looks) return;

    let html = '';
    let noteIndex = 0;

    data.looks.forEach(look => {
      if (look.layout === 'single') {
        html += `
          <div class="lookbook__section reveal">
            ${look.number ? `<span class="look-number">${esc(look.number)}</span>` : ''}
            <div class="spread spread--single">
              <img src="${esc(look.image)}" alt="${esc(look.number || 'Fashion look')}" loading="lazy" class="placeholder-img">
            </div>
          </div>`;
        // Insert designer note after this look if available
        if (data.designer_notes && data.designer_notes[noteIndex] != null) {
          const noteText = data.designer_notes[noteIndex];
          const paragraphs = noteText.split('\n\n');
          html += `
            <div class="lookbook__notes reveal">
              ${paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}
            </div>`;
          noteIndex++;
        }
      } else if (look.layout === 'pair') {
        html += `
          <div class="lookbook__section reveal">
            ${look.number ? `<span class="look-number">${esc(look.number)}</span>` : ''}
            <div class="spread spread--pair">
              ${look.images.map(img => `<img src="${esc(img)}" alt="${esc(look.number || 'Fashion look')}" loading="lazy" class="placeholder-img">`).join('\n')}
            </div>
          </div>`;
      } else if (look.layout === 'full-bleed') {
        html += `
          <div class="lookbook__full-bleed reveal">
            <img src="${esc(look.image)}" alt="Full bleed editorial shot" loading="lazy" class="placeholder-img">
          </div>`;
        // Insert designer note after full-bleed
        if (data.designer_notes && data.designer_notes[noteIndex] != null) {
          const noteText = data.designer_notes[noteIndex];
          const paragraphs = noteText.split('\n\n');
          html += `
            <div class="lookbook__notes reveal">
              ${paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}
            </div>`;
          noteIndex++;
        }
      } else if (look.layout === 'asymmetric' || look.layout === 'asymmetric-reverse') {
        html += `
          <div class="lookbook__section reveal">
            ${look.number ? `<span class="look-number">${esc(look.number)}</span>` : ''}
            <div class="spread spread--${esc(look.layout)}">
              ${look.images.map(img => `<img src="${esc(img)}" alt="${esc(look.number || 'Fashion look')}" loading="lazy" class="placeholder-img">`).join('\n')}
            </div>
          </div>`;
      }
    });

    // Any remaining designer notes
    while (data.designer_notes && noteIndex < data.designer_notes.length) {
      const noteText = data.designer_notes[noteIndex];
      const paragraphs = noteText.split('\n\n');
      html += `
        <div class="lookbook__notes reveal">
          ${paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}
        </div>`;
      noteIndex++;
    }

    // Credits
    if (data.credits) {
      html += `
        <div class="collection-credits reveal">
          <h3>Credits</h3>
          <dl>
            ${Object.entries(data.credits).map(([key, val]) =>
              `<dt>${esc(key)}</dt><dd>${esc(val)}</dd>`
            ).join('\n')}
          </dl>
        </div>`;
    }

    lookbook.innerHTML = html;
  }

  // ─── EDITORIAL PAGE ───

  async function renderEditorial(data) {
    if (!data) return;

    // Hero
    setText('.article-hero__category', data.category);
    setText('.article-hero__title', data.title);
    if (data.hero_image) {
      const heroImg = document.querySelector('.article-hero__image img');
      if (heroImg) heroImg.src = data.hero_image;
    }

    // Meta
    const meta = document.querySelector('.article-hero__meta');
    if (meta) {
      meta.innerHTML = `
        <span>By ${esc(data.author)}</span>
        <span>${esc(data.date)}</span>
        <span>${esc(data.read_time)}</span>`;
    }

    // Update page title
    if (data.title) {
      document.title = `${data.title} | WILLIE AUSTIN`;
    }

    // Article body
    const grid = document.querySelector('.editorial-grid');
    if (grid && data.body) {
      grid.innerHTML = data.body.map(block => {
        switch (block.type) {
          case 'paragraph':
            return block.dropcap
              ? `<p class="drop-cap">${esc(block.text)}</p>`
              : `<p>${esc(block.text)}</p>`;
          case 'heading':
            return `<h2>${esc(block.text)}</h2>`;
          case 'image':
            const cls = block.layout === 'full-bleed' ? 'image-full' : 'image-wide';
            return `
              <div class="${cls} reveal">
                <img src="${esc(block.src)}" alt="${esc(block.caption || '')}" loading="lazy" style="width:100%;object-fit:cover;">
                ${block.caption ? `<p class="image-caption">${esc(block.caption)}</p>` : ''}
              </div>`;
          case 'pullquote':
            return `
              <blockquote class="pull-quote">
                ${esc(block.text)}
                ${block.attribution ? `<cite>${esc(block.attribution)}</cite>` : ''}
              </blockquote>`;
          default:
            return '';
        }
      }).join('\n');
    }

    // Dual read section
    if (data.dual_read) {
      const dualSection = document.querySelector('.dual-read');
      if (dualSection) {
        const dr = data.dual_read;
        dualSection.innerHTML = `
          <div class="dual-read__text reveal">
            <h2>${esc(dr.title)}</h2>
            ${dr.paragraphs.map(p => `<p>${esc(p)}</p>`).join('\n')}
          </div>
          <div class="dual-read__images">
            ${dr.images.map(src => `<img class="reveal" src="${esc(src)}" alt="Making of — process documentation" loading="lazy" style="object-fit:cover;width:100%;">`).join('\n')}
          </div>`;
      }
    }

    // Gallery
    if (data.gallery) {
      const track = document.querySelector('.horizontal-gallery__track');
      const counter = document.querySelector('.horizontal-gallery__counter');
      if (track) {
        track.innerHTML = data.gallery.map(panel =>
          `<div class="horizontal-gallery__panel">
            <img src="${esc(panel.image)}" alt="${esc(panel.caption || '')}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
            ${panel.caption ? `<p class="panel-caption">${esc(panel.caption)}</p>` : ''}
          </div>`
        ).join('\n');
      }
      if (counter) {
        counter.textContent = `01 / ${String(data.gallery.length).padStart(2, '0')}`;
      }
    }

    // Tags
    if (data.tags) {
      const tagsContainer = document.querySelector('.article-footer__tags');
      if (tagsContainer) {
        tagsContainer.innerHTML = data.tags.map(tag =>
          `<a href="#" class="article-tag">${esc(tag)}</a>`
        ).join('\n');
      }
    }

    // Date in footer
    if (data.date) {
      const footerDate = document.querySelector('.article-footer time');
      if (footerDate) footerDate.textContent = data.date;
    }
  }

  // ─── ABOUT PAGE ───

  async function renderAbout(data) {
    if (!data) return;

    // Hero
    setText('.profile-hero__label', data.label);
    setText('.profile-hero__name', data.name);
    setText('.profile-hero__subtitle', data.subtitle);
    if (data.hero_image) {
      const heroImg = document.querySelector('.profile-hero__image img');
      if (heroImg) heroImg.src = data.hero_image;
    }

    // Facts sidebar
    if (data.facts) {
      const factsEl = document.querySelector('.profile-facts dl');
      if (factsEl) {
        factsEl.innerHTML = Object.entries(data.facts).map(([key, val]) =>
          `<dt>${esc(key)}</dt><dd>${key === 'Philosophy' ? `"${esc(val)}"` : esc(val)}</dd>`
        ).join('\n');
      }
    }

    // Body
    const grid = document.querySelector('.profile-body .editorial-grid');
    if (grid && data.body) {
      // We need to preserve the facts sidebar — it sits inside the grid
      const factsAside = document.querySelector('.profile-facts');
      let factsHTML = factsAside ? factsAside.outerHTML : '';
      let factsInserted = false;

      grid.innerHTML = data.body.map((block, i) => {
        let html = '';
        switch (block.type) {
          case 'paragraph':
            html = block.dropcap
              ? `<p class="drop-cap">${esc(block.text)}</p>`
              : `<p>${esc(block.text)}</p>`;
            break;
          case 'image':
            const cls = block.layout === 'full-bleed' ? 'image-full' : 'image-wide';
            html = `
              <div class="${cls} reveal">
                <img src="${esc(block.src)}" alt="" loading="lazy">
              </div>`;
            break;
          default:
            break;
        }
        // Insert facts sidebar after the 2nd paragraph (same position as original)
        if (!factsInserted && i === 1 && factsHTML) {
          html += factsHTML;
          factsInserted = true;
        }
        return html;
      }).join('\n');

      // If facts weren't inserted, append them
      if (!factsInserted && factsHTML) {
        grid.innerHTML += factsHTML;
      }
    }

    // Contact sign-off
    if (data.contact) {
      const signoff = document.querySelector('.profile-signoff');
      if (signoff) {
        signoff.innerHTML = `
          <p>${esc(data.contact.text)}</p>
          <a href="mailto:${esc(data.contact.email)}">${esc(data.contact.email)}</a>`;
      }
    }
  }

  // ─── ARTICLES PAGE ───

  function parseArticleDate(str) {
    if (!str) return 0;
    // "March 7, 2026" or "March 2026" or "January 2026"
    const d = new Date(str);
    if (!isNaN(d)) return d.getTime();
    // Try adding day 1 for month-only dates
    const withDay = new Date(str.replace(/(\w+)\s+(\d{4})/, '$1 1, $2'));
    if (!isNaN(withDay)) return withDay.getTime();
    return 0;
  }

  function formatMonthYear(timestamp) {
    if (!timestamp) return 'Undated';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function extractArticles(data) {
    if (!data) return [];
    const articles = [];

    // From featured
    if (data.featured) {
      data.featured.forEach(item => {
        articles.push({
          category: item.category || '',
          title: item.title || '',
          excerpt: item.excerpt || '',
          date: item.date || 'March 2026',
          href: item.href || '#',
          image: item.image || '',
          source: item.source || null
        });
      });
    }

    // From stream — flatten duos, skip quotes/stats
    if (data.stream) {
      data.stream.forEach(block => {
        if (block.type === 'feature') {
          articles.push({
            category: block.category || '',
            title: block.title || '',
            excerpt: block.excerpt || '',
            date: block.date || '',
            href: block.href || '#',
            image: block.image || '',
            source: block.source || null
          });
        } else if (block.type === 'duo' && block.items) {
          block.items.forEach(item => {
            articles.push({
              category: item.category || '',
              title: item.title || '',
              excerpt: item.excerpt || '',
              date: item.date || '',
              href: item.href || '#',
              image: item.image || '',
              source: item.source || null
            });
          });
        }
      });
    }

    // From studio_content
    if (data.studio_content) {
      data.studio_content.forEach(item => {
        articles.push({
          category: item.category || '',
          title: item.title || '',
          excerpt: item.excerpt || '',
          date: item.date || '',
          href: item.href || '#',
          image: item.image || '',
          source: item.source || null
        });
      });
    }

    // Deduplicate by title
    const seen = new Set();
    const unique = articles.filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    // Parse dates and sort newest first
    unique.forEach(a => { a._sortDate = parseArticleDate(a.date); });
    unique.sort((a, b) => b._sortDate - a._sortDate);

    return unique;
  }

  function renderArticles(data) {
    if (!data) return;

    const articles = extractArticles(data);
    const grid = document.getElementById('articles-grid');
    const filtersEl = document.getElementById('articles-filters');
    const noResults = document.getElementById('articles-no-results');
    if (!grid) return;

    // Collect unique categories
    const categories = [...new Set(articles.map(a => a.category))].sort();

    // Render filter buttons
    if (filtersEl) {
      filtersEl.innerHTML = `<button class="filter-btn active" data-filter="all">All</button>` +
        categories.map(cat =>
          `<button class="filter-btn" data-filter="${esc(cat.toLowerCase())}">${esc(cat)}</button>`
        ).join('');
    }

    // Group articles by month/year for date headings
    let currentGroup = '';
    let html = '';

    articles.forEach(a => {
      const group = formatMonthYear(a._sortDate);
      if (group !== currentGroup) {
        currentGroup = group;
        html += `<div class="articles-date-group">${esc(group)}</div>`;
      }

      const dateLine = a.date + (a.source ? ` &mdash; via ${esc(a.source)}` : '');
      const cardHref = articleUrl(a);

      html += `
        <article class="article-card reveal" data-category="${esc(a.category.toLowerCase())}" data-search="${esc((a.title + ' ' + a.excerpt + ' ' + a.category).toLowerCase())}">
          <a href="${esc(cardHref)}" class="article-card__link">
            <div class="article-card__image hover-scale">
              <img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">
            </div>
            <div class="article-card__content">
              <span class="category-tag">${esc(a.category)}</span>
              <h2 class="article-card__title">${esc(a.title)}</h2>
              <p class="article-card__excerpt">${esc(a.excerpt)}</p>
              <time class="article-card__date">${dateLine}</time>
            </div>
          </a>
        </article>`;
    });

    grid.innerHTML = html;

    // Wire up search and filter
    let activeFilter = 'all';
    const searchInput = document.getElementById('articles-search');

    function applyFilters() {
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
      let visibleCount = 0;

      grid.querySelectorAll('.article-card').forEach(card => {
        const matchCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
        const matchSearch = !query || card.dataset.search.includes(query);

        if (matchCategory && matchSearch) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      // Show/hide date group headings based on visible cards after them
      grid.querySelectorAll('.articles-date-group').forEach(heading => {
        let next = heading.nextElementSibling;
        let hasVisible = false;
        while (next && !next.classList.contains('articles-date-group')) {
          if (next.classList.contains('article-card') && next.style.display !== 'none') {
            hasVisible = true;
            break;
          }
          next = next.nextElementSibling;
        }
        heading.style.display = hasVisible ? '' : 'none';
      });

      // No results message
      if (noResults) {
        noResults.hidden = visibleCount > 0;
      }
    }

    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }

    // Filter buttons
    if (filtersEl) {
      filtersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFilters();
      });
    }
  }

  // ─── INIT ───

  async function init() {
    // Always load site-wide content
    const siteData = await load('site.json', 'site');
    renderSite(siteData);

    // Load page-specific content
    if (page === 'index') {
      const homeData = await load('homepage.json', 'homepage');
      renderHomepage(homeData);
    } else if (page === 'articles') {
      const articlesData = await load('homepage.json', 'homepage');
      renderArticles(articlesData);
    } else if (page === 'collection') {
      const collData = await load('collection-nocturne.json', 'collection_nocturne');
      renderCollection(collData);
    } else if (page === 'editorial') {
      const editFile = filename.includes('midnight-wool') ? 'editorial-midnight-wool.json' : 'editorial-new-silhouette.json';
      const editKey = filename.includes('midnight-wool') ? 'editorial_midnight-wool' : 'editorial_new-silhouette';
      const editData = await load(editFile, editKey);
      renderEditorial(editData);
    } else if (page === 'about') {
      const aboutData = await load('about.json', 'about');
      renderAbout(aboutData);
    }

    // Re-initialize reveal animations for newly rendered elements
    if (typeof Reveal !== 'undefined' && Reveal.refresh) {
      Reveal.refresh();
    }

    // Re-initialize image fallbacks for newly rendered elements
    if (typeof ImageFallback !== 'undefined' && ImageFallback.init) {
      ImageFallback.init();
    }

    console.log('[Content] Loaded and rendered from JSON.');
  }

  return { init };
})();
