/*
  Family Tree renderer

  Data format (family.json):
  {
    "name": "Root Person",
    "spouse": "Spouse Name", // optional
    "meta": "(years, note)",  // optional small text
    "children": [ { ... same shape ... } ]
  }

  The code treats each node as a couple with optional spouse and children.
*/

(function () {
  // Verify D3 is loaded
  if (typeof d3 === 'undefined') {
    console.error('D3 library not loaded!');
    document.body.innerHTML += '<div style="color:red; padding: 20px; font-size: 18px;">Error: D3 library failed to load. Please check your internet connection.</div>';
    return;
  }

  const svg = d3.select('#tree');
  
  // Verify SVG element exists
  if (svg.empty()) {
    console.error('SVG element #tree not found in DOM');
    document.body.innerHTML += '<div style="color:red; padding: 20px; font-size: 18px;">Error: SVG element not found in page.</div>';
    return;
  }

  const g = svg.append('g').attr('class', 'viewport');
  const defs = svg.append('defs');
  const personGradient = defs.append('linearGradient')
    .attr('id', 'personGradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '100%');
  personGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', 'var(--accent-2)')
    .attr('stop-opacity', 0.22);
  personGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', 'var(--accent)')
    .attr('stop-opacity', 0.22);
  // Transparent hit-surface so every touch/pointer reaches the zoom handler
  const hitRect = svg.insert('rect', ':first-child')
    .attr('class', 'zoom-hit-surface')
    .attr('fill', 'transparent')
    .attr('pointer-events', 'all');
  function resizeHitSurface() {
    const { width, height } = svg.node().getBoundingClientRect();
    hitRect.attr('width', width).attr('height', height);
  }
  resizeHitSurface();
  window.addEventListener('resize', resizeHitSurface);
  // Modal refs
  const modalEl = document.getElementById('photoModal');
  const modalImg = document.getElementById('modalImg');
  const modalName = document.getElementById('modalTitle');
  const modalDob = document.getElementById('modalDob');
  const modalExtendedInfo = document.getElementById('modalExtendedInfo');
  const modalClose = document.getElementById('modalClose');
  const helpModal = document.getElementById('helpModal');
  const helpClose = document.getElementById('helpClose');
  const birthdayMonthsEl = document.getElementById('birthdayMonths');
  const calendarSection = document.getElementById('birthdaySection');
  const topbar = document.querySelector('.topbar');
  const pageEl = document.querySelector('.page');
  const globeView = document.getElementById('globeView');
  const globeLegendEl = document.querySelector('.globe-legend');
  const globeSvgEl = document.getElementById('globeSvg');
  const globeTooltip = document.getElementById('globeTooltip');
  const viewToggleInputs = document.querySelectorAll('.tw-toggle input[name="view-toggle"]');
  const viewToggle = document.querySelector('.tw-toggle');
  let calendarOpen = false;
  const birthdayTooltip = document.getElementById('birthdayTooltip');
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const searchBtn = document.getElementById('searchBtn');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const viewerMoreBtn = document.getElementById('viewerMoreBtn');
  const viewerMoreMenu = document.getElementById('viewerMoreMenu');
  const helpBtn = document.getElementById('helpBtn');
  const shareTreeBtn = document.getElementById('shareTreeBtn');
  const shareTreeModal = document.getElementById('shareTreeModal');
  const shareModalLinkInput = document.getElementById('shareModalLinkInput');
  const shareCopyBtn = document.getElementById('shareCopyBtn');
  const shareModalHint = document.getElementById('shareModalHint');
  const shareModalClose = document.getElementById('closeShareModal');
  const shareConfirmBtn = document.getElementById('confirmShareBtn');
  const shareTreeNameEl = document.getElementById('shareTreeName');
  const orderPrintBtn = document.getElementById('orderPrintBtn');
  const statsKidsEl = document.getElementById('statsKids');
  const statsGrandkidsEl = document.getElementById('statsGrandkids');
  const statsGreatGrandkidsEl = document.getElementById('statsGreatGrandkids');
  const upcomingBtn = document.getElementById('upcomingBtn');
  const upcomingContainer = document.getElementById('upcomingContainer');
  const upcomingName = document.getElementById('upcomingName');
  const upcomingPrev = document.getElementById('upcomingPrev');
  const upcomingNext = document.getElementById('upcomingNext');
  const viewerOnboarding = document.getElementById('viewerOnboarding');
  const dismissViewerOnboardingBtn = document.getElementById('dismissViewerOnboardingBtn');
  const VIEWER_ONBOARDING_DISMISSED_KEY = 'ancestrio:viewer-onboarding:dismissed:v1';
  const personLookup = new Map();
  const personHierarchy = new Map(); // Store hierarchical info
  const mobileQuery = window.matchMedia('(max-width: 640px)');
  let externalUpcomingController = null;
  let externalEmptyStateController = null;

  const person = {
    width: 170,
    height: 120,
    hGap: 48, // gap between spouses (tripled)
  };
  const TREE_ZOOM_MIN = 0.05;
  const TREE_ZOOM_MAX = 8;
  const TREE_INITIAL_SCALE_CAP_DESKTOP = 0.86;
  const TREE_INITIAL_SCALE_CAP_MOBILE = 0.92;
  const TREE_INITIAL_SCALE_CAP_DEMO_DESKTOP = 0.79;
  const TREE_INITIAL_SCALE_CAP_DEMO_MOBILE = 0.85;
  const level = {
    vGap: 180, // vertical distance between generations (increased)
    hGap: 28,  // additional horizontal spacing
  };
  const baseCoupleWidth = person.width * 2 + person.hGap;
  const avatar = { r: 36, top: 10 };
  // i18n support - default to English, can be extended
  const i18n = {
    ro: {
      months: [
        { short: 'Ian', long: 'Ianuarie' },
        { short: 'Feb', long: 'Februarie' },
        { short: 'Mar', long: 'Martie' },
        { short: 'Apr', long: 'Aprilie' },
        { short: 'Mai', long: 'Mai' },
        { short: 'Iun', long: 'Iunie' },
        { short: 'Iul', long: 'Iulie' },
        { short: 'Aug', long: 'August' },
        { short: 'Sep', long: 'Septembrie' },
        { short: 'Oct', long: 'Octombrie' },
        { short: 'Noi', long: 'Noiembrie' },
        { short: 'Dec', long: 'Decembrie' }
      ],
      birthday: 'zi de naștere',
      birthdays: 'zile de naștere',
      today: 'Astăzi',
      tomorrow: 'Mâine',
      inDays: 'În {n} zile',
      openCalendar: 'Deschide calendarul',
      closeCalendar: 'Închide calendarul',
      noBirthdays: 'Nicio aniversare',
      hideNotification: 'Ascunde notificarea'
    },
    en: {
      months: [
        { short: 'Jan', long: 'January' },
        { short: 'Feb', long: 'February' },
        { short: 'Mar', long: 'March' },
        { short: 'Apr', long: 'April' },
        { short: 'May', long: 'May' },
        { short: 'Jun', long: 'June' },
        { short: 'Jul', long: 'July' },
        { short: 'Aug', long: 'August' },
        { short: 'Sep', long: 'September' },
        { short: 'Oct', long: 'October' },
        { short: 'Nov', long: 'November' },
        { short: 'Dec', long: 'December' }
      ],
      birthday: 'Birthday',
      birthdays: 'birthdays',
      today: 'Today',
      tomorrow: 'Tomorrow',
      inDays: 'In {n} days',
      openCalendar: 'Open Calendar',
      closeCalendar: 'Close Calendar',
      noBirthdays: 'No birthdays',
      hideNotification: 'Hide notification'
    }
  };

  const storedTreeLang = localStorage.getItem("tree-lang");
  const documentLang = (document.documentElement.lang || "").toLowerCase();
  const preferredTreeLang = storedTreeLang || (documentLang.startsWith("ro") ? "ro" : "en");
  const currentLang = Object.prototype.hasOwnProperty.call(i18n, preferredTreeLang) ? preferredTreeLang : "en";
  const t = i18n[currentLang] || i18n.en;
  const monthsMeta = t.months;
  const isRomanianUi = currentLang === "ro";
  const viewerUiText = isRomanianUi
    ? {
      lineageButton: "Genealogie",
      lineageTitleInactive: "Arată liniile de genealogie",
      lineageTitleActive: "Ascunde liniile de genealogie",
      emptyStateTitleSingular: (days) => `Zi de naștere în următoarele ${days} zile`,
      emptyStateTitlePlural: (days) => `Zile de naștere în următoarele ${days} zile`,
      emptyStateIntro: (days) => `Iată cine își sărbătorește ziua în următoarele ${days} zile:`,
      emptyStateHint: () => "Deschide calendarul pentru toate zilele de naștere.",
      emptyStateDismiss: () => "Am înțeles!"
    }
    : {
      lineageButton: "Lineage",
      lineageTitleInactive: "Show lineage lines",
      lineageTitleActive: "Hide lineage lines",
      emptyStateTitleSingular: (days) => `Birthday in the next ${days} days`,
      emptyStateTitlePlural: (days) => `Birthdays in the next ${days} days`,
      emptyStateIntro: (days) => `Here is who is celebrating in the next ${days} days:`,
      emptyStateHint: () => "Open the calendar to review every birthday in the tree.",
      emptyStateDismiss: () => "Continue"
    };
  const dnaHighlightNames = new Set(['ioan suatean', 'ana suatean']);
  const dnaSuppressNames = new Set(['f ioan suatean', 'ioan pintilie']);
  const calendarExcludeNames = new Set([
    'F Ioan Suătean',
    'M Ioan Suătean',
    'Ana Pintilie',
    'Ioan Pintilie'
  ].map((name) => name.toLowerCase()));

  const globeCountryAliases = {
    anglia: 'United Kingdom',
    austria: 'Austria',
    'bosnia&herzegovina': 'Bosnia and Herz.',
    'bosnia and herzegovina': 'Bosnia and Herz.',
    cehia: 'Czechia',
    croatia: 'Croatia',
    danemarca: 'Denmark',
    egipt: 'Egypt',
    franta: 'France',
    germania: 'Germany',
    grecia: 'Greece',
    italia: 'Italy',
    olanda: 'Netherlands',
    portugal: 'Portugal',
    rusia: 'Russia',
    'rusia/urss': 'Russia',
    spania: 'Spain',
    suedia: 'Sweden',
    sweeden: 'Sweden',
    uk: 'United Kingdom',
    ungaria: 'Hungary',
    usa: 'United States of America'
  };
  const globeMovedCountries = new Set(['Romania', 'United Kingdom', 'Hungary', 'Spain']);
  const demoGlobePeopleVisits = {
    Andreea: ['Egypt', 'Ungaria', 'Italia', 'Bosnia&Herzegovina', 'Portugal', 'Germany', 'USA', 'France'],
    Florin: ['Spania', 'Austria'],
    Ovidiu: ['Italia', 'Spania', 'France', 'Germania', 'Croatia', 'Austria', 'Grecia'],
    Miha: ['Grecia'],
    Ioana: ['Grecia'],
    Sergiu: ['Ungaria', 'Spania'],
    Razvan: ['Anglia', 'Spania', 'Ungaria'],
    Bogdan: ['Austria', 'India', 'Ungaria', 'Croatia', 'Germania'],
    Adi: ['Spania', 'Anglia'],
    Paul: ['Suedia', 'Danemarca', 'Olanda', 'Germania', 'Austria', 'Cehia', 'Ungaria', 'Grecia', 'Italia'],
    'Ioan Suatean': ['Rusia/URSS'],
    Emil: ['Ungaria', 'Italia', 'Grecia'],
    Emilia: ['Anglia', 'Spania'],
    Liviu: ['Ungaria'],
    Victoria: ['Austria', 'Ungaria', 'Grecia']
  };

  function requireFunction(candidate, label) {
    if (typeof candidate === 'function') {
      return candidate;
    }
    return function missingRequiredFunction() {
      throw new Error(`${label} is unavailable.`);
    };
  }

  const loadTreeData = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioDataLoader?.loadTreeData : null,
    'AncestrioDataLoader.loadTreeData'
  );
  const normalizeData = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioDataTransform?.normalizeData : null,
    'AncestrioDataTransform.normalizeData'
  );
  const thumbPath = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioDataTransform?.thumbPath : null,
    'AncestrioDataTransform.thumbPath'
  );
  const parseBirthday = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioMainUtils?.parseBirthday : null,
    'AncestrioMainUtils.parseBirthday'
  );
  const safe = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioMainUtils?.safe : null,
    'AncestrioMainUtils.safe'
  );
  const normalizeName = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioMainUtils?.normalizeName : null,
    'AncestrioMainUtils.normalizeName'
  );
  const readTags = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioMainUtils?.readTags : null,
    'AncestrioMainUtils.readTags'
  );
  const formatCalendarCount = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.formatCount : null,
    'AncestrioCalendarUtils.formatCount'
  );
  const shouldExcludeCalendarEntry = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.shouldExcludeFromCalendar : null,
    'AncestrioCalendarUtils.shouldExcludeFromCalendar'
  );
  const getCalendarDaysInMonth = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.getDaysInMonth : null,
    'AncestrioCalendarUtils.getDaysInMonth'
  );
  const getCalendarFirstDayOffset = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.getFirstDayOffset : null,
    'AncestrioCalendarUtils.getFirstDayOffset'
  );
  const escapeHtml = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.escapeHtml : null,
    'AncestrioCalendarUtils.escapeHtml'
  );
  const createBirthdayStripController = requireFunction(
    typeof window !== 'undefined' ? window.AncestrioCalendarUtils?.createBirthdayStripController : null,
    'AncestrioCalendarUtils.createBirthdayStripController'
  );

  const globeVisits = {};
  function buildGlobeVisits(peopleMap, options = {}) {
    const includeDefaultHome = options.includeDefaultHome === true;
    const useMovedTones = options.useMovedTones === true;
    const visits = {};

    if (includeDefaultHome) {
      visits.Romania = { people: ['Familia Suatean'], tone: 'home' };
    }

    Object.entries(peopleMap).forEach(([person, countries]) => {
      if (!Array.isArray(countries)) return;
      countries.forEach((country) => {
        const normalized = normalizeCountryName(country);
        if (!normalized) return;
        const isHome = normalized === 'Romania';
        const isMoved = useMovedTones && globeMovedCountries.has(normalized);
        const entry = visits[normalized] || { people: [], tone: isHome ? 'home' : (isMoved ? 'moved' : 'visited') };
        if (!entry.people.includes(person)) {
          entry.people.push(person);
        }
        if (isHome) {
          entry.tone = 'home';
        } else if (isMoved && entry.tone !== 'home') {
          entry.tone = 'moved';
        }
        visits[normalized] = entry;
      });
    });
    return visits;
  }

  function setGlobeVisits(nextVisits) {
    Object.keys(globeVisits).forEach((country) => delete globeVisits[country]);
    if (nextVisits && typeof nextVisits === 'object') {
      Object.entries(nextVisits).forEach(([country, info]) => {
        const normalizedCountry = normalizeCountryName(country);
        if (!normalizedCountry || !info || typeof info !== 'object') return;
        const people = Array.isArray(info.people)
          ? info.people.map((person) => String(person || '').trim()).filter(Boolean)
          : [];
        if (!people.length) return;
        const tone = info.tone === 'home' || info.tone === 'moved' ? info.tone : 'visited';
        globeVisits[normalizedCountry] = {
          people: Array.from(new Set(people)),
          tone
        };
      });
    }

    if (externalGlobeController && typeof externalGlobeController.setVisits === 'function') {
      externalGlobeController.setVisits(globeVisits);
    }
  }

  function readVisitedCountries(value) {
    if (Array.isArray(value)) {
      return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  function collectVisitedByPerson(treeData) {
    const visitedByPerson = new Map();
    const seen = new Set();

    const addVisited = (name, visited) => {
      const personName = String(name || '').trim();
      if (!personName) return;
      const countries = readVisitedCountries(visited);
      if (!countries.length) return;
      if (!visitedByPerson.has(personName)) {
        visitedByPerson.set(personName, new Set());
      }
      const bucket = visitedByPerson.get(personName);
      countries.forEach((country) => bucket.add(country));
    };

    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((entry) => walk(entry));
        return;
      }
      if (typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);

      if (Object.prototype.hasOwnProperty.call(node, 'Grandparent')) {
        addVisited(node.Grandparent, node.visited);
      }
      if (Object.prototype.hasOwnProperty.call(node, 'name')) {
        addVisited(node.name, node.visited);
      }

      if (Object.prototype.hasOwnProperty.call(node, 'spouseVisited') && typeof node.spouse === 'string') {
        addVisited(node.spouse, node.spouseVisited);
      }

      const spouseValue = node.spouse;
      if (Array.isArray(spouseValue)) {
        spouseValue.forEach((spouseEntry) => {
          if (spouseEntry && typeof spouseEntry === 'object') {
            addVisited(spouseEntry.name, spouseEntry.visited);
          }
        });
      } else if (spouseValue && typeof spouseValue === 'object') {
        addVisited(spouseValue.name, spouseValue.visited);
      }

      if (node.prevSpouse && typeof node.prevSpouse === 'object') {
        addVisited(node.prevSpouse.name, node.prevSpouse.visited);
      }

      Object.values(node).forEach((value) => {
        if (value && typeof value === 'object') {
          walk(value);
        }
      });
    };

    walk(treeData);
    return visitedByPerson;
  }

  function isDemoTreePage() {
    if (typeof window === 'undefined' || !window.location) return false;
    const pathname = String(window.location.pathname || '').toLowerCase();
    return pathname.endsWith('demo-tree.html');
  }

  function buildGlobeVisitsFromTreeData(treeData) {
    const visitedByPerson = collectVisitedByPerson(treeData);
    const peopleMap = {};
    visitedByPerson.forEach((countries, person) => {
      if (!countries || countries.size === 0) return;
      peopleMap[person] = Array.from(countries);
    });

    const hasVisitedCountries = Object.keys(peopleMap).length > 0;
    if (!hasVisitedCountries && isDemoTreePage()) {
      return buildGlobeVisits(demoGlobePeopleVisits, {
        includeDefaultHome: true,
        useMovedTones: true
      });
    }

    return buildGlobeVisits(peopleMap, {
      includeDefaultHome: false,
      useMovedTones: false
    });
  }
  const GLOBE_DATA_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

  const placeholderDataUrl = 'data:image/svg+xml;utf8,' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="%23d7dbe2"/>' +
    '<circle cx="32" cy="24" r="12" fill="%239aa3b2"/>' +
    '<rect x="16" y="38" width="32" height="16" rx="8" fill="%239aa3b2"/>' +
    '</svg>';

  // Zoom/Pan
  let zoomEndTimer = null;
  function setZooming(active) {
    if (!document.body) return;
    if (active) {
      if (zoomEndTimer) {
        clearTimeout(zoomEndTimer);
        zoomEndTimer = null;
      }
      document.body.classList.add('is-zooming');
      return;
    }
    if (zoomEndTimer) clearTimeout(zoomEndTimer);
    zoomEndTimer = setTimeout(() => {
      document.body.classList.remove('is-zooming');
      zoomEndTimer = null;
    }, 140);
  }
  const zoom = d3.zoom()
    .scaleExtent([TREE_ZOOM_MIN, TREE_ZOOM_MAX]) // Limit zoom bounds to prevent infinite zoom
    .wheelDelta((event) => {
      const base = event.deltaMode === 1 ? 0.02 : 0.002; // lines vs pixels
      return -event.deltaY * base;
    })
    .on('start', () => setZooming(true))
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    })
    .on('end', () => setZooming(false));
  svg.call(zoom);

  // Controls
  let dnaOn = false;
  let dnaGroup = null; // overlay for DNA lines
  function updateDNAVisibility() {
    if (dnaGroup) {
      // Use opacity instead of display for smoother transitions
      dnaGroup.style('opacity', dnaOn ? 1 : 0);
      dnaGroup.attr('pointer-events', dnaOn ? 'auto' : 'none');
    }
    d3.select('#tree').classed('dna-active', dnaOn);
  }
  const dnaBtn = document.getElementById('dnaBtn');
  if (dnaBtn) {
    updateDNAButtonText();
    dnaBtn.addEventListener('click', () => {
      dnaOn = !dnaOn;
      updateDNAVisibility();
      updateDNAButtonText();
    });
  }
  function updateDNAButtonText() {
    if (!dnaBtn) return;
    dnaBtn.textContent = viewerUiText.lineageButton;
    dnaBtn.setAttribute('aria-pressed', dnaOn ? 'true' : 'false');
    const title = dnaOn ? viewerUiText.lineageTitleActive : viewerUiText.lineageTitleInactive;
    dnaBtn.setAttribute('aria-label', title);
    dnaBtn.setAttribute('title', title);
  }
  const themeBtn = document.getElementById('themeBtn');
  window.AncestrioTheme?.initThemeToggle({
    button: themeBtn,
    iconWhenDark: 'dark_mode',
    iconWhenLight: 'light_mode',
    darkButtonClass: 'moon-icon',
    lightButtonClass: 'sun-icon',
    autoRefreshMs: 30 * 60 * 1000
  });
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetBtn = document.getElementById('resetBtn');
  function isGlobeActive() {
    return document.body.classList.contains('view-globe');
  }
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (isGlobeActive()) {
        adjustGlobeZoom(GLOBE_ZOOM_STEP);
      } else {
        smoothZoom(1.2);
      }
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (isGlobeActive()) {
        adjustGlobeZoom(-GLOBE_ZOOM_STEP);
      } else {
        smoothZoom(1 / 1.1);
      }
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (isGlobeActive()) {
        setGlobeZoom(GLOBE_ZOOM_DEFAULT);
      } else {
        fitTreeWhenVisible(getTreeDefaultPadding());
      }
    });
  }
  const focusBtn = document.getElementById('focusBtn');
  let focusModeActive = document.body.classList.contains('focus-mode');
  if (focusBtn) {
    focusBtn.setAttribute('aria-pressed', focusModeActive ? 'true' : 'false');
    updateFocusModeUI();
    focusBtn.addEventListener('click', () => {
      focusModeActive = !focusModeActive;
      document.body.classList.toggle('focus-mode', focusModeActive);
      focusBtn.setAttribute('aria-pressed', focusModeActive ? 'true' : 'false');
      updateFocusModeUI();
      requestAnimationFrame(updateViewToggleOffset);
      fitTreeWhenVisible(focusModeActive ? getTreeFocusPadding() : getTreeDefaultPadding());
      if (focusModeActive) setCalendarOpen(false);
    });
  }

  function updateFocusModeUI() {
    if (!focusBtn) return;
    const isActive = document.body.classList.contains('focus-mode');
    focusBtn.textContent = isActive ? 'Exit Focus' : 'Focus';
    const label = isActive ? 'Exit focus mode' : 'Enter focus mode';
    focusBtn.setAttribute('aria-label', label);
    focusBtn.setAttribute('title', label);
  }

  function setViewerMoreMenuOpen(isOpen) {
    if (!viewerMoreBtn || !viewerMoreMenu) return;
    const nextOpen = Boolean(isOpen);
    viewerMoreBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    viewerMoreMenu.hidden = !nextOpen;
    viewerMoreMenu.classList.toggle('is-open', nextOpen);
  }

  function isViewerMoreMenuOpen() {
    if (!viewerMoreMenu) return false;
    return !viewerMoreMenu.hidden;
  }

  function closeViewerMoreMenu() {
    setViewerMoreMenuOpen(false);
  }

  if (viewerMoreBtn && viewerMoreMenu) {
    viewerMoreBtn.addEventListener('click', () => {
      setViewerMoreMenuOpen(!isViewerMoreMenuOpen());
    });

    viewerMoreMenu.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a') : null;
      if (target) {
        closeViewerMoreMenu();
      }
    });

    document.addEventListener('click', (event) => {
      if (!isViewerMoreMenuOpen()) return;
      if (viewerMoreMenu.contains(event.target) || viewerMoreBtn.contains(event.target)) return;
      closeViewerMoreMenu();
    });
  }

  function setViewerOnboardingDismissed(value) {
    try {
      if (value) {
        localStorage.setItem(VIEWER_ONBOARDING_DISMISSED_KEY, '1');
      } else {
        localStorage.removeItem(VIEWER_ONBOARDING_DISMISSED_KEY);
      }
    } catch (_) {
      // Storage can be unavailable.
    }
  }

  function getViewerOnboardingDismissed() {
    try {
      return localStorage.getItem(VIEWER_ONBOARDING_DISMISSED_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function setupViewerOnboarding() {
    if (!viewerOnboarding) return;
    if (getViewerOnboardingDismissed()) {
      viewerOnboarding.hidden = true;
      return;
    }
    viewerOnboarding.hidden = false;
  }

  dismissViewerOnboardingBtn?.addEventListener('click', () => {
    setViewerOnboardingDismissed(true);
    if (viewerOnboarding) viewerOnboarding.hidden = true;
  });

  setupViewerOnboarding();

  // Upcoming birthday navigation
  if (upcomingPrev) {
    upcomingPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      externalUpcomingController?.previous?.();
    });
  }
  if (upcomingNext) {
    upcomingNext.addEventListener('click', (e) => {
      e.stopPropagation();
      externalUpcomingController?.next?.();
    });
  }
  if (upcomingBtn) {
    upcomingBtn.addEventListener('click', () => {
      externalUpcomingController?.openCurrent?.();
    });
  }

  let currentView = localStorage.getItem('tree-view') || 'tree';
  let calendarViewEnabled = true;
  let globeViewEnabled = true;
  const storeContextSource = isDemoTreePage() ? 'demo-tree' : 'tree';
  let storeTreeId = '';
  let storeTreeName = '';

  function sanitizeStoreText(value, maxLength = 160) {
    if (
      typeof window !== 'undefined' &&
      window.AncestrioStoreUtils &&
      typeof window.AncestrioStoreUtils.sanitizeText === 'function'
    ) {
      return window.AncestrioStoreUtils.sanitizeText(value, maxLength);
    }
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, Math.max(0, maxLength));
  }

  function sanitizeStoreTreeId(value) {
    if (
      typeof window !== 'undefined' &&
      window.AncestrioStoreUtils &&
      typeof window.AncestrioStoreUtils.sanitizeTreeId === 'function'
    ) {
      return window.AncestrioStoreUtils.sanitizeTreeId(value);
    }
    return sanitizeStoreText(value, 120).replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function sanitizeStoreProduct(value, fallback = 'paper-print') {
    if (
      typeof window !== 'undefined' &&
      window.AncestrioStoreUtils &&
      typeof window.AncestrioStoreUtils.sanitizeProduct === 'function'
    ) {
      return window.AncestrioStoreUtils.sanitizeProduct(value, fallback);
    }
    const normalized = sanitizeStoreText(value, 32).toLowerCase();
    const allowed = ['paper-print'];
    return allowed.includes(normalized) ? normalized : fallback;
  }

  function getStoreProductForView() {
    return 'paper-print';
  }

  function getTreeIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return sanitizeStoreTreeId(params.get('id'));
  }

  function maybeStoreTreeName(rawValue) {
    const candidate = sanitizeStoreText(rawValue, 160);
    if (!candidate) return;
    const lowered = candidate.toLowerCase();
    if (['loading...', 'tree not found', 'private tree', 'error loading tree'].includes(lowered)) return;
    storeTreeName = candidate;
  }

  function refreshStoreContext() {
    const treeIdFromUrl = getTreeIdFromUrl();
    if (treeIdFromUrl) {
      storeTreeId = treeIdFromUrl;
    }

    if (typeof window !== 'undefined') {
      maybeStoreTreeName(window.FIREBASE_TREE_NAME);
    }
    maybeStoreTreeName(document.getElementById('treeName')?.textContent || '');
  }

  function buildViewerStoreUrl(overrides = {}) {
    const payload = {
      product: sanitizeStoreProduct(overrides.product || getStoreProductForView(currentView)),
      source: storeContextSource,
      view: (overrides.view || currentView || 'tree'),
      treeId: sanitizeStoreTreeId(overrides.treeId || storeTreeId),
      treeName: sanitizeStoreText(overrides.treeName || storeTreeName, 160)
    };

    if (
      typeof window !== 'undefined' &&
      window.AncestrioStoreUtils &&
      typeof window.AncestrioStoreUtils.buildStoreUrl === 'function'
    ) {
      return window.AncestrioStoreUtils.buildStoreUrl(payload, { path: 'store.html' });
    }

    const params = new URLSearchParams();
    params.set('product', payload.product);
    params.set('source', payload.source);
    params.set('view', payload.view);
    if (payload.treeId) params.set('treeId', payload.treeId);
    if (payload.treeName) params.set('treeName', payload.treeName);
    return `store.html?${params.toString()}`;
  }

  function setShareButtonVisibility(visible) {
    if (!shareTreeBtn) return;
    shareTreeBtn.hidden = !visible;
    shareTreeBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      shareTreeBtn.removeAttribute('tabindex');
    } else {
      shareTreeBtn.setAttribute('tabindex', '-1');
    }
  }

  function isShareOwner() {
    const currentId = typeof window !== 'undefined' ? window.FIREBASE_CURRENT_USER_ID : '';
    const ownerId = typeof window !== 'undefined' ? window.FIREBASE_TREE_OWNER_ID : '';
    return !!(currentId && ownerId && currentId === ownerId);
  }

  function buildViewerShareUrl() {
    const shareTreeId = getTreeIdFromUrl();
    if (!shareTreeId) return '';
    if (window.AncestrioShareUtils && typeof window.AncestrioShareUtils.buildTreeShareUrl === 'function') {
      return window.AncestrioShareUtils.buildTreeShareUrl(shareTreeId, 'tree.html');
    }
    return `tree.html?id=${encodeURIComponent(shareTreeId)}`;
  }

  async function copyViewerShareLink(url) {
    if (window.AncestrioShareUtils && typeof window.AncestrioShareUtils.copyShareLink === 'function') {
      return window.AncestrioShareUtils.copyShareLink(url, {
        unavailableMessage: 'Share link is not available.',
        failureMessage: 'Unable to copy link. Please copy it manually.'
      });
    }
    notifyUser('Unable to copy link. Please copy it manually.', 'warning');
    return false;
  }

  async function makeTreePublicForShare(treeId) {
    if (!treeId || typeof firebase === 'undefined' || !firebase.firestore) {
      notifyUser('Sharing is not available right now.', 'warning');
      return false;
    }

    try {
      await firebase.firestore().collection('trees').doc(treeId).update({
        privacy: 'public',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.FIREBASE_TREE_PRIVACY = 'public';
      return true;
    } catch (error) {
      console.error('Failed to update privacy for sharing:', error);
      notifyUser('Failed to update privacy. Please try again.', 'error');
      return false;
    }
  }

  function refreshShareButtonVisibility() {
    const canShare = isShareOwner() && !!getTreeIdFromUrl();
    setShareButtonVisibility(canShare);
  }

  function updateShareModalSocialLinks(shareUrl, treeName, isPublic) {
    window.AncestrioShareUtils?.setSocialShareLinks?.({
      shareUrl,
      treeName,
      isPublic
    });
  }

  function getShareTreeName() {
    const nameFromFirebase = typeof window !== 'undefined' ? window.FIREBASE_TREE_NAME : '';
    if (nameFromFirebase && String(nameFromFirebase).trim()) return String(nameFromFirebase).trim();
    const nameEl = document.getElementById('treeName');
    if (nameEl && nameEl.textContent) return nameEl.textContent.trim();
    return 'this tree';
  }

  function updateShareModalUI() {
    if (!shareTreeModal) return;
    const shareUrl = buildViewerShareUrl();
    const isPublic = (typeof window !== 'undefined' ? window.FIREBASE_TREE_PRIVACY : 'private') === 'public';
    const treeName = getShareTreeName();

    if (shareTreeNameEl) shareTreeNameEl.textContent = treeName;
    if (shareModalLinkInput) {
      shareModalLinkInput.value = isPublic ? shareUrl : '';
      shareModalLinkInput.placeholder = isPublic ? '' : 'Make public to enable sharing';
    }
    if (shareCopyBtn) {
      shareCopyBtn.disabled = !isPublic || !shareUrl;
      shareCopyBtn.setAttribute('aria-disabled', (!isPublic || !shareUrl) ? 'true' : 'false');
    }
    if (shareConfirmBtn) {
      shareConfirmBtn.style.display = isPublic ? 'none' : 'inline-flex';
    }
    if (shareModalHint) {
      shareModalHint.textContent = isPublic
        ? 'Anyone with the link can view it. It is not listed.'
        : 'Make public to enable sharing. It is not listed.';
    }
    updateShareModalSocialLinks(shareUrl, treeName, isPublic);
  }

  function showShareModal() {
    if (!shareTreeModal) return;
    updateShareModalUI();
    shareTreeModal.classList.add('open');
    shareTreeModal.removeAttribute('hidden');
    shareTreeModal.style.display = 'flex';
    shareTreeModal.setAttribute('aria-hidden', 'false');
    syncScrollLock();
  }

  function hideShareModal() {
    if (!shareTreeModal) return;
    shareTreeModal.classList.remove('open');
    shareTreeModal.setAttribute('hidden', '');
    shareTreeModal.style.display = '';
    shareTreeModal.setAttribute('aria-hidden', 'true');
    syncScrollLock();
  }

  async function handleShareCopy() {
    const shareUrl = buildViewerShareUrl();
    const isPublic = (typeof window !== 'undefined' ? window.FIREBASE_TREE_PRIVACY : 'private') === 'public';
    if (!isPublic) {
      notifyUser('Make this tree public to share.', 'warning');
      return;
    }
    await copyViewerShareLink(shareUrl);
  }

  async function handleShareConfirm() {
    const shareTreeId = getTreeIdFromUrl();
    if (!shareTreeId) {
      notifyUser('Save your tree to share a link.', 'warning');
      return;
    }
    if (shareConfirmBtn) {
      shareConfirmBtn.disabled = true;
      shareConfirmBtn.textContent = 'Sharing...';
    }
    const updated = await makeTreePublicForShare(shareTreeId);
    if (updated) {
      updateShareModalUI();
      await copyViewerShareLink(buildViewerShareUrl());
    }
    if (shareConfirmBtn) {
      shareConfirmBtn.disabled = false;
      shareConfirmBtn.textContent = 'Make Public & Copy Link';
    }
  }

  const DEFAULT_VIEW_BACKGROUND = 'theme-default';
  const DEFAULT_VIEW_BUBBLE = 'bubble-classic';
  const VIEW_BACKGROUND_IDS = new Set([
    'theme-default',
    'parchment-classic',
    'parchment-vintage',
    'parchment-minimal',
    'parchment-photo'
  ]);
  const VIEW_BUBBLE_IDS = new Set([
    'bubble-classic',
    'bubble-heraldic',
    'bubble-ink',
    'bubble-soft'
  ]);
  const parseBooleanFlag = typeof AncUtils.parseBooleanFlag === 'function'
    ? AncUtils.parseBooleanFlag
    : function parseViewerFeatureFlagFallback(_value, fallback = true) { return fallback; };

  const sanitizeViewerStyleValue = AncUtils.sanitizeViewStyleValue;

  function resolveViewerSettings(source) {
    const calendarFlag = (source && Object.prototype.hasOwnProperty.call(source, 'enableCalendarDates'))
      ? source.enableCalendarDates
      : source?.enableBirthdays;
    const nested = (source && source.viewStyle && typeof source.viewStyle === 'object')
      ? source.viewStyle
      : null;

    return {
      enableCalendarDates: parseBooleanFlag(calendarFlag, true),
      enableGlobeCountries: parseBooleanFlag(source?.enableGlobeCountries, true),
      viewBackground: sanitizeViewerStyleValue(
        source?.viewBackground ?? source?.background ?? nested?.background,
        DEFAULT_VIEW_BACKGROUND,
        VIEW_BACKGROUND_IDS
      ),
      viewBubble: sanitizeViewerStyleValue(
        source?.viewBubble ?? source?.bubble ?? nested?.bubble,
        DEFAULT_VIEW_BUBBLE,
        VIEW_BUBBLE_IDS
      )
    };
  }

  function isViewEnabled(view) {
    if (view === 'calendar') return calendarViewEnabled;
    if (view === 'globe') return globeViewEnabled;
    return true;
  }

  function setViewToggleVisibility(view, isVisible) {
    const input = document.getElementById(`view-${view}`);
    const label = document.querySelector(`label[for="view-${view}"]`);
    if (input) {
      input.disabled = !isVisible;
      input.hidden = !isVisible;
      if (!isVisible) {
        input.checked = false;
      }
    }
    if (label) {
      label.style.display = isVisible ? '' : 'none';
    }
  }

  function applyTreeViewSettings(source) {
    const settings = resolveViewerSettings(source);
    calendarViewEnabled = settings.enableCalendarDates;
    globeViewEnabled = settings.enableGlobeCountries;
    setViewToggleVisibility('calendar', calendarViewEnabled);
    setViewToggleVisibility('globe', globeViewEnabled);
    if (viewToggle) {
      viewToggle.style.display = (calendarViewEnabled || globeViewEnabled) ? '' : 'none';
    }
    if (!isViewEnabled(currentView)) {
      currentView = 'tree';
    }
  }

  function applyTreeViewStyle(source) {
    const settings = resolveViewerSettings(source);
    const body = document.body;
    if (body) {
      body.setAttribute('data-view-bg', settings.viewBackground);
      body.setAttribute('data-view-bubble', settings.viewBubble);
    }
  }

  let externalGlobeController = null;
  const UPCOMING_WINDOW_DAYS = 10;
  const BIRTHDAY_POPUP_WINDOW_DAYS = 7;
  const GLOBE_REMOTE_THRESHOLD = 0.6;
  const GLOBE_VERTICAL_OFFSET = 34;
  const GLOBE_ROTATION_DEFAULT = -15;
  const GLOBE_TILT_DEFAULT = -18;
  const GLOBE_TILT_MIN = -60;
  const GLOBE_TILT_MAX = 60;
  const GLOBE_TILT_SPEED = 0.22;
  const GLOBE_ROTATE_SPEED = 0.3;
  const GLOBE_ZOOM_MIN = 0.9;
  const GLOBE_ZOOM_MAX = 2.56;
  const GLOBE_ZOOM_STEP = 0.12;
  const GLOBE_ZOOM_DEFAULT = 0.92;

  if (
    typeof window !== 'undefined' &&
    window.AncestrioGlobeUI &&
    typeof window.AncestrioGlobeUI.createGlobeController === 'function'
  ) {
    externalGlobeController = window.AncestrioGlobeUI.createGlobeController({
      globeSvgEl,
      globeLegendEl,
      globeTooltip,
      globeVisits,
      normalizeCountryName,
      isActiveView: () => document.body.classList.contains('view-globe'),
      onUnavailable: () => {
        if (currentView === 'globe') {
          setView('tree');
        }
      },
      dataUrl: GLOBE_DATA_URL,
      remoteThreshold: GLOBE_REMOTE_THRESHOLD,
      verticalOffset: GLOBE_VERTICAL_OFFSET,
      rotationDefault: GLOBE_ROTATION_DEFAULT,
      tiltDefault: GLOBE_TILT_DEFAULT,
      tiltMin: GLOBE_TILT_MIN,
      tiltMax: GLOBE_TILT_MAX,
      tiltSpeed: GLOBE_TILT_SPEED,
      rotateSpeed: GLOBE_ROTATE_SPEED,
      zoomMin: GLOBE_ZOOM_MIN,
      zoomMax: GLOBE_ZOOM_MAX,
      zoomStep: GLOBE_ZOOM_STEP,
      zoomDefault: GLOBE_ZOOM_DEFAULT
    });
  }

  function resetGlobeView() {
    if (externalGlobeController && typeof externalGlobeController.resetView === 'function') {
      externalGlobeController.resetView();
    }
  }

  function initGlobe() {
    if (externalGlobeController && typeof externalGlobeController.init === 'function') {
      return externalGlobeController.init();
    }
    return false;
  }

  function ensureGlobeVisible(tries = 60) {
    if (externalGlobeController && typeof externalGlobeController.ensureVisible === 'function') {
      externalGlobeController.ensureVisible(tries);
    }
  }

  function resizeGlobe() {
    if (externalGlobeController && typeof externalGlobeController.resize === 'function') {
      externalGlobeController.resize();
    }
  }

  function setGlobeZoom(nextZoom) {
    if (externalGlobeController && typeof externalGlobeController.setZoom === 'function') {
      externalGlobeController.setZoom(nextZoom);
    }
  }

  function adjustGlobeZoom(delta) {
    if (externalGlobeController && typeof externalGlobeController.adjustZoom === 'function') {
      externalGlobeController.adjustZoom(delta);
    }
  }

  function applyViewBodyClasses(view) {
    document.body.classList.remove('view-globe', 'view-calendar', 'view-tree');
    document.body.classList.add(`view-${view}`);
  }

  function updateViewToggleUI() {
    if (viewToggleInputs && viewToggleInputs.length) {
      viewToggleInputs.forEach((input) => {
        input.checked = input.value === currentView;
      });
    }
  }

  function setView(view) {
    const validViews = ['tree', 'calendar', 'globe'];
    const requestedView = validViews.includes(view) ? view : 'tree';
    const nextView = isViewEnabled(requestedView) ? requestedView : 'tree';
    currentView = nextView;
    applyViewBodyClasses(nextView);
    requestAnimationFrame(updateViewToggleOffset);
    if (globeView) globeView.setAttribute('aria-hidden', nextView === 'globe' ? 'false' : 'true');
    if (pageEl) pageEl.setAttribute('aria-hidden', nextView === 'globe' || nextView === 'calendar' ? 'true' : 'false');
    const birthdaySection = document.getElementById('birthdaySection');
    if (birthdaySection) birthdaySection.setAttribute('aria-hidden', nextView === 'calendar' ? 'false' : 'true');
    updateViewToggleUI();
    localStorage.setItem('tree-view', nextView);

    if (nextView === 'globe') {
      if (focusModeActive) {
        focusModeActive = false;
        document.body.classList.remove('focus-mode');
        focusBtn && focusBtn.setAttribute('aria-pressed', 'false');
        updateFocusModeUI();
      }
      setCalendarOpen(false);
      resetGlobeView();
      if (!initGlobe()) {
        console.warn('Globe view unavailable, falling back to tree view.');
        setView('tree');
        return;
      }
      requestAnimationFrame(() => ensureGlobeVisible(60));
    } else if (nextView === 'calendar') {
      if (focusModeActive) {
        focusModeActive = false;
        document.body.classList.remove('focus-mode');
        focusBtn && focusBtn.setAttribute('aria-pressed', 'false');
        updateFocusModeUI();
      }
      setCalendarOpen(true);
    } else {
      setCalendarOpen(false);
      requestAnimationFrame(() => {
        resizeHitSurface();
        if (!window._initialFitComplete) {
          fitTreeWhenVisible(getTreeDefaultPadding(), 60);
        }
      });
    }
  }

  if (viewToggleInputs && viewToggleInputs.length) {
    viewToggleInputs.forEach((input) => {
      input.addEventListener('change', () => setView(input.value));
    });
  }
  const birthdayStripController = createBirthdayStripController({
    birthdayMonthsEl,
    birthdayTooltip,
    personLookup,
    openModal,
    placeholderDataUrl,
    escapeHtml,
    monthsMeta,
    weekdayLabels: ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum'],
    formatCount: (total) => formatCalendarCount(total, t.birthday, t.birthdays),
    getDaysInMonth: getCalendarDaysInMonth,
    getFirstDayOffset: getCalendarFirstDayOffset,
    collectBirthdays,
    mobileQuery,
    calendarSection
  });
  applyTreeViewSettings(typeof window !== 'undefined' ? window.FIREBASE_TREE_SETTINGS : null);
  refreshStoreContext();
  refreshShareButtonVisibility();
  applyTreeViewStyle(typeof window !== 'undefined' ? window.FIREBASE_TREE_SETTINGS : null);
  setView(currentView);

  function isDemoOrPreviewTreeView() {
    return document.body.classList.contains('demo-tree-page') && !document.body.classList.contains('has-app-toolbar');
  }
  function getTreeDefaultPadding() {
    if (isDemoOrPreviewTreeView()) {
      return mobileQuery && mobileQuery.matches ? 22 : 46;
    }
    return mobileQuery && mobileQuery.matches ? 12 : 36;
  }
  function getTreeInitialScaleCap() {
    const isMobile = mobileQuery && mobileQuery.matches;
    if (isDemoOrPreviewTreeView()) {
      return isMobile ? TREE_INITIAL_SCALE_CAP_DEMO_MOBILE : TREE_INITIAL_SCALE_CAP_DEMO_DESKTOP;
    }
    return isMobile ? TREE_INITIAL_SCALE_CAP_MOBILE : TREE_INITIAL_SCALE_CAP_DESKTOP;
  }
  function getTreeVerticalPaddingBoost() {
    if (!isDemoOrPreviewTreeView()) return 0;
    return mobileQuery && mobileQuery.matches ? 12 : 20;
  }
  function getTreeFocusPadding() {
    return mobileQuery && mobileQuery.matches ? 60 : 70;
  }
  function getTreeVerticalBias(height) {
    if (!mobileQuery || !mobileQuery.matches) return 0;
    const base = -Math.min(90, height * 0.18);
    return calendarOpen ? (base - 72) : base;
  }
  function isOverlayVisible(element) {
    if (!element) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function getTreeViewportInsets() {
    const node = svg.node();
    if (!node) return { top: 0, bottom: 0, left: 0, right: 0 };
    const svgRect = node.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return { top: 0, bottom: 0, left: 0, right: 0 };

    const insets = { top: 0, bottom: 0, left: 0, right: 0 };
    const midpointY = svgRect.top + (svgRect.height / 2);
    const insetGap = 12;

    const getOverlapRect = (element) => {
      if (!isOverlayVisible(element)) return null;
      const rect = element.getBoundingClientRect();
      const overlapLeft = Math.max(svgRect.left, rect.left);
      const overlapRight = Math.min(svgRect.right, rect.right);
      const overlapTop = Math.max(svgRect.top, rect.top);
      const overlapBottom = Math.min(svgRect.bottom, rect.bottom);

      if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) return null;
      return { overlapLeft, overlapRight, overlapTop, overlapBottom };
    };

    const addVerticalInsetFromOverlay = (element) => {
      const overlap = getOverlapRect(element);
      if (!overlap) return;

      const overlapCenterY = (overlap.overlapTop + overlap.overlapBottom) / 2;
      if (overlapCenterY <= midpointY) {
        insets.top = Math.max(insets.top, overlap.overlapBottom - svgRect.top + insetGap);
      } else {
        insets.bottom = Math.max(insets.bottom, svgRect.bottom - overlap.overlapTop + insetGap);
      }
    };

    addVerticalInsetFromOverlay(document.querySelector('.app-header .brand-group'));
    addVerticalInsetFromOverlay(document.querySelector('.app-header .controls'));
    addVerticalInsetFromOverlay(viewToggle);
    if (searchBar && searchBar.classList.contains('show')) {
      addVerticalInsetFromOverlay(searchBar);
    }

    return insets;
  }
  function fitTreeWhenVisible(padding, tries = 40) {
    const node = svg.node();
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      if (tries <= 0) return;
      requestAnimationFrame(() => fitTreeWhenVisible(padding, tries - 1));
      return;
    }
    const bbox = g.node() ? g.node().getBBox() : null;
    if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width < 2 || bbox.height < 2) {
      if (tries <= 0) return;
      requestAnimationFrame(() => fitTreeWhenVisible(padding, tries - 1));
      return;
    }
    resizeHitSurface();
    fitToScreen(padding);
    window._initialFitComplete = true;
  }
  function smoothZoom(factor) {
    svg.transition().duration(250).call(zoom.scaleBy, factor);
  }
  function fitToScreen(padding = 40) {
    const bbox = g.node().getBBox();
    if (!isFinite(bbox.x) || !isFinite(bbox.y) || !isFinite(bbox.width) || !isFinite(bbox.height)) return;
    const w = svg.node().clientWidth;
    const h = svg.node().clientHeight;
    const insets = getTreeViewportInsets();
    const leftPadding = padding + insets.left;
    const rightPadding = padding + insets.right;
    const verticalBoost = getTreeVerticalPaddingBoost();
    const topPadding = padding + insets.top + verticalBoost;
    const bottomPadding = padding + insets.bottom + verticalBoost;
    const safeWidth = Math.max(1, w - leftPadding - rightPadding);
    const safeHeight = Math.max(1, h - topPadding - bottomPadding);
    const scale = Math.min(
      safeWidth / Math.max(bbox.width, 1),
      safeHeight / Math.max(bbox.height, 1)
    );
    const safeScale = Math.max(scale, 0.02);
    const initialCap = getTreeInitialScaleCap();
    const appliedScale = Math.min(safeScale, initialCap);
    const maxScale = Math.max(TREE_ZOOM_MAX, safeScale * 5);
    const centerX = leftPadding + (safeWidth / 2);
    const centerY = topPadding + (safeHeight / 2);
    const tx = centerX - (bbox.x + (bbox.width / 2)) * appliedScale;
    const ty = centerY - (bbox.y + (bbox.height / 2)) * appliedScale + getTreeVerticalBias(safeHeight);
    zoom.scaleExtent([TREE_ZOOM_MIN, maxScale]);
    const t = d3.zoomIdentity.translate(tx, ty).scale(appliedScale);
    svg.transition().duration(450).call(zoom.transform, t);
  }

  // Modal helpers
  function syncScrollLock() {
    const anyOpen = !!document.querySelector('.modal.open, .help-modal.open');
    document.body.classList.toggle('scroll-locked', anyOpen);
  }

  function openModal(info) {
    if (!modalEl) return;
    modalImg.src = info.image || '';
    modalName.textContent = info.name || '';

    // Birthday
    if (info.birthday && String(info.birthday).trim() !== '') {
      modalDob.textContent = `Birthday: ${info.birthday}`;
      modalDob.style.display = '';
    } else {
      modalDob.textContent = '';
      modalDob.style.display = 'none';
    }

    // Clear extended info - not needed
    if (modalExtendedInfo) {
      modalExtendedInfo.innerHTML = '';
    }

    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    syncScrollLock();
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    modalImg.src = '';
    syncScrollLock();
  }
  if (modalEl) {
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
  }
  if (modalClose) modalClose.addEventListener('click', closeModal);

  // Help Modal
  function openHelpModal() {
    if (!helpModal) return;
    helpModal.classList.add('open');
    helpModal.setAttribute('aria-hidden', 'false');
    syncScrollLock();
  }
  function closeHelpModal() {
    if (!helpModal) return;
    helpModal.classList.remove('open');
    helpModal.setAttribute('aria-hidden', 'true');
    syncScrollLock();
  }
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelpModal();
    });
  }
  if (helpClose) helpClose.addEventListener('click', closeHelpModal);
  if (helpBtn) helpBtn.addEventListener('click', openHelpModal);
  if (shareTreeBtn) {
    shareTreeBtn.addEventListener('click', () => {
      if (!isShareOwner()) {
        notifyUser('Only the owner can share this tree.', 'warning');
        return;
      }
      const shareTreeId = getTreeIdFromUrl();
      if (!shareTreeId) {
        notifyUser('Save your tree to share a link.', 'warning');
        return;
      }
      showShareModal();
    });
  }
  if (shareModalClose) shareModalClose.addEventListener('click', hideShareModal);
  if (shareTreeModal) {
    shareTreeModal.addEventListener('click', (event) => {
      if (event.target === shareTreeModal) hideShareModal();
    });
  }
  if (shareCopyBtn) shareCopyBtn.addEventListener('click', handleShareCopy);
  if (shareConfirmBtn) shareConfirmBtn.addEventListener('click', handleShareConfirm);
  if (orderPrintBtn) {
    orderPrintBtn.addEventListener('click', () => {
      if (isDemoTreePage()) {
        window.location.href = 'auth.html';
        return;
      }
      refreshStoreContext();
      window.location.href = buildViewerStoreUrl();
    });
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
        toggleSearch(false);
      }
      return;
    }

    switch(e.key) {
      case 'Escape':
        if (isViewerMoreMenuOpen()) {
          closeViewerMoreMenu();
        } else if (focusModeActive) {
          focusBtn.click();
        } else if (modalEl && modalEl.classList.contains('open')) {
          closeModal();
        } else if (shareTreeModal && shareTreeModal.classList.contains('open')) {
          hideShareModal();
        } else if (helpModal && helpModal.classList.contains('open')) {
          closeHelpModal();
        } else if (searchBar && searchBar.classList.contains('show')) {
          toggleSearch(false);
        }
        break;
      case 'f':
      case 'F':
        if (focusBtn) focusBtn.click();
        break;
      case 'l':
      case 'L':
        if (dnaBtn) dnaBtn.click();
        break;
      case 't':
      case 'T':
        if (themeBtn) themeBtn.click();
        break;
      case 's':
      case 'S':
      case '/':
        e.preventDefault();
        toggleSearch(true);
        break;
      case 'c':
      case 'C':
        setView('calendar');
        break;
      case '?':
        e.preventDefault();
        openHelpModal();
        break;
      case 'r':
      case 'R':
        if (document.getElementById('resetBtn')) document.getElementById('resetBtn').click();
        break;
      case '+':
      case '=':
        if (document.getElementById('zoomInBtn')) document.getElementById('zoomInBtn').click();
        break;
      case '-':
      case '_':
        if (document.getElementById('zoomOutBtn')) document.getElementById('zoomOutBtn').click();
        break;
    }
  });

  // Search functionality
  const externalSearchController =
    (typeof window !== 'undefined' &&
      window.AncestrioSearchUI &&
      typeof window.AncestrioSearchUI.createSearchController === 'function')
      ? window.AncestrioSearchUI.createSearchController({
          searchBar,
          searchInput,
          searchResults,
          personLookup,
          escapeHtml,
          openModal,
          placeholderDataUrl,
          mobileMediaQuery: '(max-width: 768px)',
          topbarSelector: '.topbar',
          noResultsText: 'No results found',
          birthdayLabel: 'Birthday'
        })
      : null;

  function toggleSearch(show) {
    externalSearchController?.toggleSearch?.(show);
  }

  function positionSearchBar() {
    externalSearchController?.positionSearchBar?.();
  }

  function performSearch(query) {
    externalSearchController?.performSearch?.(query);
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const isOpen = searchBar && searchBar.classList.contains('show');
      toggleSearch(!isOpen);
    });
  }
  if (searchClearBtn) searchClearBtn.addEventListener('click', () => toggleSearch(false));
  if (searchInput) {
    searchInput.addEventListener('input', (e) => performSearch(e.target.value));
  }
  window.addEventListener('resize', () => {
    closeViewerMoreMenu();
    if (searchBar && searchBar.classList.contains('show')) {
      positionSearchBar();
    }
    updateExpandedMonthPlacement();
    if (currentView === 'globe') {
      resizeGlobe();
    } else if (currentView === 'tree') {
      fitTreeWhenVisible(getTreeDefaultPadding(), 40);
    }
    requestAnimationFrame(updateViewToggleOffset);
  });
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(updateViewToggleOffset);
    if (currentView === 'tree') {
      fitTreeWhenVisible(getTreeDefaultPadding(), 40);
    }
  });
  window.addEventListener('load', () => {
    if (currentView === 'globe') {
      initGlobe();
      requestAnimationFrame(() => ensureGlobeVisible(60));
    }
  });

  // Load data from Firebase (if available) or rfamily.json.
  Promise.resolve()
    .then(() => loadTreeData())
    .then((data) => {
      if (!data) {
        throw new Error('Data is null or undefined');
      }

      setGlobeVisits(buildGlobeVisitsFromTreeData(data));

      if (typeof window !== 'undefined') {
        refreshStoreContext();
        refreshShareButtonVisibility();
        applyTreeViewSettings(window.FIREBASE_TREE_SETTINGS || null);
        applyTreeViewStyle(window.FIREBASE_TREE_SETTINGS || null);
        setView(currentView);
      }
      const normalized = normalizeData(data);
      renderBirthdayStrip(normalized);
      renderUpcomingBanner(normalized);
      updateStats(normalized);
      setupCarouselControls();
      render(normalized);
      showEmptyStateIfNeeded(normalized);
    })
    .catch((err) => {
      console.error('Failed to load data:', err);
      console.error('Stack:', err.stack);
      if (birthdayMonthsEl) {
        birthdayMonthsEl.textContent = 'Failed to load family data: ' + err.message;
      }
      g.append('text')
        .attr('x', 20)
        .attr('y', 30)
        .attr('fill', 'var(--error, #b5493d)')
        .text('Error: ' + (err.message || 'Failed to load data'));
    });

  function updateStats(data) {
    if (!statsKidsEl || !statsGrandkidsEl || !statsGreatGrandkidsEl) return;
    if (!data || !Array.isArray(data.children)) return;
    const kids = data.children.length;
    let grandkids = 0;
    let greatGrandkids = 0;
    data.children.forEach((child) => {
      const children = Array.isArray(child.children) ? child.children : [];
      grandkids += children.length;
      children.forEach((gchild) => {
        if (Array.isArray(gchild.children)) {
          greatGrandkids += gchild.children.length;
        }
      });
    });
    statsKidsEl.textContent = String(kids);
    statsGrandkidsEl.textContent = String(grandkids);
    statsGreatGrandkidsEl.textContent = String(greatGrandkids);
  }

  function renderBirthdayStrip(data) {
    birthdayStripController.render(data);
  }

  function updateExpandedMonthPlacement() {
    birthdayStripController.updateExpandedMonthPlacement();
  }

  function setCalendarOpen(open) {
    calendarOpen = open === true;
    birthdayStripController.setCalendarOpen(calendarOpen);
  }

  // Keep calendar closed unless the calendar view is selected.
  setCalendarOpen(false);

  function setupCarouselControls() {
    birthdayStripController.setupCarouselControls();
  }

  function shouldExcludeFromCalendar(name) {
    return shouldExcludeCalendarEntry(name, calendarExcludeNames);
  }

  function normalizeCountryName(name) {
    const raw = String(name || '');
    const trimmed = raw.replace(/[.,]+$/g, '').trim();
    if (!trimmed) return '';
    const key = trimmed
      .toLowerCase()
      .replace(/\s*&\s*/g, '&')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
    const alias = globeCountryAliases[key];
    return alias || trimmed;
  }
  // Generic tree traversal helper
  function traverseTree(data, callback) {
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      callback(node.name, node.birthday, node.image);
      callback(node.spouse, node.spouseBirthday, node.spouseImage);
      if (node.prevSpouse) callback(node.prevSpouse.name, node.prevSpouse.birthday, node.prevSpouse.image);
      if (node.parents) {
        callback(node.parents.name, node.parents.birthday, node.parents.image);
        callback(node.parents.spouse, node.parents.spouseBirthday, node.parents.spouseImage);
      }
      if (node.spouseParents) {
        callback(node.spouseParents.name, node.spouseParents.birthday, node.spouseParents.image);
        callback(node.spouseParents.spouse, node.spouseParents.spouseBirthday, node.spouseParents.spouseImage);
      }
      (node.children || []).forEach((child) => walk(child));
    }
    walk(data);
  }

  function getUpcomingBirthdays(data, windowDays = UPCOMING_WINDOW_DAYS) {
    if (!externalUpcomingController || typeof externalUpcomingController.getUpcomingBirthdays !== 'function') {
      return [];
    }
    return externalUpcomingController.getUpcomingBirthdays(data, windowDays);
  }

  function updateViewToggleOffset() {
    if (!viewToggle || !topbar) return;

    const rect = topbar.getBoundingClientRect();
    const spacing = 8;
    let top = Math.max(0, Math.round(rect.bottom + spacing));
    const featureBanner = document.querySelector('.feature-banner');
    if (featureBanner) {
      const bannerStyle = window.getComputedStyle(featureBanner);
      if (bannerStyle.display !== 'none' && bannerStyle.visibility !== 'hidden') {
        const bannerRect = featureBanner.getBoundingClientRect();
        top = Math.max(top, Math.round(bannerRect.bottom + spacing));
      }
    }
    document.documentElement.style.setProperty('--view-toggle-top', `${top}px`);
  }

  function renderUpcomingBanner(data) {
    externalUpcomingController?.renderUpcomingBanner?.(data);
  }

  function collectBirthdays(data) {
    personLookup.clear();
    personHierarchy.clear();
    const months = Array.from({ length: 12 }, () => ({}));

    function rememberPerson(name, birthday, image, metadata) {
      const key = (name || '').trim();
      if (!key) return;
      if (!personLookup.has(key)) {
        personLookup.set(key, { name: key, birthday: birthday || '', image: image || '', metadata: metadata });
      }
    }

    function add(name, birthday, image) {
      const label = safe(name).trim();
      if (!label) return;
      if (shouldExcludeFromCalendar(label)) {
        rememberPerson(label, birthday, image);
        return;
      }
      const parsed = parseBirthday(birthday);
      if (!parsed) return;
      rememberPerson(label, birthday, image);
      const bucket = months[parsed.month - 1];
      if (!bucket[parsed.day]) bucket[parsed.day] = [];
      bucket[parsed.day].push(label);
    }

    // Build hierarchy with relationships - improved version
    function buildHierarchy(node, generation = 0, parentNames = [], siblings = []) {
      if (!node) return;

      const recordPerson = (name, spouse, children, parents, sibs, gen) => {
        if (!name) return;
        const metadata = {
          generation: gen,
          spouse: spouse || null,
          children: children || [],
          parents: parents || [],
          siblings: sibs || []
        };
        personHierarchy.set(name, metadata);
        // Update personLookup with metadata
        if (personLookup.has(name)) {
          personLookup.get(name).metadata = metadata;
        }
      };

      // Get all children names for this node
      const childrenNames = (node.children || []).map(c => safe(c.name)).filter(Boolean);

      // Primary person
      if (node.name) {
        const primaryName = safe(node.name);
        recordPerson(primaryName, node.spouse, childrenNames, parentNames, siblings, generation);
      }

      // Spouse
      if (node.spouse) {
        const spouseName = safe(node.spouse);
        recordPerson(spouseName, node.name, childrenNames, [], siblings, generation);
      }

      // Previous spouse
      if (node.prevSpouse && node.prevSpouse.name) {
        const prevSpouseName = safe(node.prevSpouse.name);
        const prevChildren = childrenNames.filter((_, idx) => {
          const child = node.children[idx];
          return child && child.fromPrevSpouse;
        });
        recordPerson(prevSpouseName, node.name, prevChildren, [], [], generation);
      }

      // Process children with sibling info
      if (node.children && node.children.length > 0) {
        const currentParents = [safe(node.name), safe(node.spouse)].filter(Boolean);

        // Build sibling list for each child
        node.children.forEach((child, idx) => {
          const childSiblings = childrenNames.filter((name, i) => i !== idx);
          buildHierarchy(child, generation + 1, currentParents, childSiblings);
        });
      }

      // Handle parents and spouseParents from the data structure
      if (node.parents) {
        buildParentsHierarchy(node.parents, generation - 1);
      }
      if (node.spouseParents) {
        buildParentsHierarchy(node.spouseParents, generation - 1);
      }
    }

    function buildParentsHierarchy(parentsNode, generation) {
      if (!parentsNode) return;

      const parentName = safe(parentsNode.name);
      const parentSpouse = safe(parentsNode.spouse);

      if (parentName) {
        const metadata = {
          generation: generation,
          spouse: parentSpouse || null,
          children: [],
          parents: [],
          siblings: []
        };
        personHierarchy.set(parentName, metadata);
        if (personLookup.has(parentName)) {
          personLookup.get(parentName).metadata = metadata;
        }
      }

      if (parentSpouse) {
        const metadata = {
          generation: generation,
          spouse: parentName || null,
          children: [],
          parents: [],
          siblings: []
        };
        personHierarchy.set(parentSpouse, metadata);
        if (personLookup.has(parentSpouse)) {
          personLookup.get(parentSpouse).metadata = metadata;
        }
      }
    }

    traverseTree(data, add);
    buildHierarchy(data, 0, [], []);
    return months;
  }

  // Empty state overlay
  function showEmptyStateIfNeeded(data) {
    externalEmptyStateController?.showIfNeeded?.(data);
  }

  if (
    typeof window !== 'undefined' &&
    window.AncestrioUpcomingUI &&
    typeof window.AncestrioUpcomingUI.createUpcomingController === 'function'
  ) {
    externalUpcomingController = window.AncestrioUpcomingUI.createUpcomingController({
      upcomingBtn,
      upcomingContainer,
      upcomingName,
      upcomingPrev,
      upcomingNext,
      personLookup,
      openModal,
      placeholderDataUrl,
      parseBirthday,
      safe,
      traverseTree,
      monthsMeta,
      labels: {
        today: t.today,
        tomorrow: t.tomorrow,
        inDays: t.inDays
      },
      defaultWindowDays: UPCOMING_WINDOW_DAYS
    });
  }

  if (
    typeof window !== 'undefined' &&
    window.AncestrioEmptyStateUI &&
    typeof window.AncestrioEmptyStateUI.createEmptyStateController === 'function'
  ) {
    externalEmptyStateController = window.AncestrioEmptyStateUI.createEmptyStateController({
      getUpcomingBirthdays,
      parseBirthday,
      escapeHtml,
      monthsMeta,
      labels: {
        today: t.today,
        tomorrow: t.tomorrow,
        inDays: t.inDays,
        emptyStateTitleSingular: viewerUiText.emptyStateTitleSingular(BIRTHDAY_POPUP_WINDOW_DAYS),
        emptyStateTitlePlural: viewerUiText.emptyStateTitlePlural(BIRTHDAY_POPUP_WINDOW_DAYS),
        emptyStateIntro: viewerUiText.emptyStateIntro(BIRTHDAY_POPUP_WINDOW_DAYS),
        emptyStateHint: viewerUiText.emptyStateHint(),
        emptyStateDismiss: viewerUiText.emptyStateDismiss()
      },
      windowDays: BIRTHDAY_POPUP_WINDOW_DAYS,
      visitedStorageKey: 'tree-visited',
      document,
      storage: localStorage
    });
  }

  const externalTreeRenderer =
    (typeof window !== 'undefined' &&
      window.AncestrioTreeRenderer &&
      typeof window.AncestrioTreeRenderer.createTreeRenderer === 'function')
      ? window.AncestrioTreeRenderer.createTreeRenderer({
          g,
          defs,
          person,
          level,
          avatar,
          baseCoupleWidth,
          safe,
          readTags,
          normalizeName,
          dnaHighlightNames,
          dnaSuppressNames,
          thumbPath,
          placeholderDataUrl,
          openModal,
          setDnaGroup: (group) => { dnaGroup = group; },
          updateDNAVisibility,
          fitTreeWhenVisible,
          getTreeDefaultPadding
        })
      : null;

  function render(data) {
    if (externalTreeRenderer && typeof externalTreeRenderer.render === 'function') {
      externalTreeRenderer.render(data);
      return;
    }
    console.error('Tree renderer module is unavailable.');
  }

})();











