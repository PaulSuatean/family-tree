/*
  Shared helpers for calendar/text rendering in the tree viewer.
  Extracted from main.js to keep utility logic isolated.
*/

(function () {
  function getDaysInMonth(year, monthIdx) {
    return new Date(year, monthIdx + 1, 0).getDate();
  }

  function getFirstDayOffset(year, monthIdx) {
    // JS getDay: 0 Sun, 1 Mon ... -> shift so Monday is 0
    const jsDay = new Date(year, monthIdx, 1).getDay();
    return (jsDay + 6) % 7;
  }

  function formatCount(total, singularWord, pluralWord) {
    const singular = String(singularWord || 'birthday');
    const plural = String(pluralWord || 'birthdays');
    const word = total === 1 ? singular : plural;
    return `${total} ${word}`;
  }

  function shouldExcludeFromCalendar(name, excludedNames) {
    if (!excludedNames || typeof excludedNames.has !== 'function') return false;
    return excludedNames.has(String(name || '').toLowerCase());
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createBirthdayStripController(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const birthdayMonthsEl = opts.birthdayMonthsEl || null;
    const birthdayTooltip = opts.birthdayTooltip || null;
    const personLookup = opts.personLookup instanceof Map ? opts.personLookup : new Map();
    const openModal = typeof opts.openModal === 'function' ? opts.openModal : function () {};
    const placeholderDataUrl = typeof opts.placeholderDataUrl === 'string' ? opts.placeholderDataUrl : '';
    const escape = typeof opts.escapeHtml === 'function' ? opts.escapeHtml : escapeHtml;
    const monthsMeta = Array.isArray(opts.monthsMeta) ? opts.monthsMeta : [];
    const weekdayLabels = Array.isArray(opts.weekdayLabels) && opts.weekdayLabels.length === 7
      ? opts.weekdayLabels
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const formatCount = typeof opts.formatCount === 'function'
      ? opts.formatCount
      : function formatCountFallback(total) { return String(total); };
    const getDays = typeof opts.getDaysInMonth === 'function' ? opts.getDaysInMonth : getDaysInMonth;
    const getOffset = typeof opts.getFirstDayOffset === 'function' ? opts.getFirstDayOffset : getFirstDayOffset;
    const collectBirthdays = typeof opts.collectBirthdays === 'function'
      ? opts.collectBirthdays
      : function collectBirthdaysFallback() { return Array.from({ length: 12 }, () => ({})); };
    const mobileQuery = opts.mobileQuery || null;
    const calendarSection = opts.calendarSection || null;

    let calendarOpen = false;
    let activeTooltipCell = null;
    let mobileListenerAttached = false;

    function hideBirthdayTooltip() {
      if (!birthdayTooltip) return;
      activeTooltipCell = null;
      birthdayTooltip.classList.remove('show');
      birthdayTooltip.hidden = true;
    }

    function showBirthdayTooltip(cell) {
      if (!birthdayTooltip || !cell) return;
      const names = (cell.dataset.names || '').split('||').filter(Boolean);
      if (!names.length) return;
      const dateLabel = cell.dataset.dateLabel || '';
      activeTooltipCell = cell;
      birthdayTooltip.innerHTML = [
        '<div class="tooltip-date">' + dateLabel + '</div>',
        '<ul class="tooltip-list">',
        names.map((name) => '<li>' + escape(name) + '</li>').join(''),
        '</ul>'
      ].join('');
      birthdayTooltip.hidden = false;
      birthdayTooltip.classList.add('show');

      const rect = cell.getBoundingClientRect();
      const tipRect = birthdayTooltip.getBoundingClientRect();
      const top = Math.max(8, rect.top - tipRect.height - 10);
      const left = Math.min(
        window.innerWidth - tipRect.width - 8,
        Math.max(8, rect.left + rect.width / 2 - tipRect.width / 2)
      );
      birthdayTooltip.style.top = top + 'px';
      birthdayTooltip.style.left = left + 'px';
    }

    function getCalendarColumnCount() {
      if (!birthdayMonthsEl) return 1;
      const raw = Number.parseInt(getComputedStyle(birthdayMonthsEl).getPropertyValue('--month-cols'), 10);
      return Number.isFinite(raw) && raw > 0 ? raw : 1;
    }

    function normalizeMonthCardOrder() {
      if (!birthdayMonthsEl) return [];
      const cards = Array.from(birthdayMonthsEl.querySelectorAll('.month-card'));
      cards
        .sort((a, b) => Number(a.dataset.renderIndex || 0) - Number(b.dataset.renderIndex || 0))
        .forEach((card) => birthdayMonthsEl.appendChild(card));
      return Array.from(birthdayMonthsEl.querySelectorAll('.month-card'));
    }

    function updateExpandedMonthPlacement() {
      if (!birthdayMonthsEl) return;
      const orderedCards = normalizeMonthCardOrder();
      orderedCards.forEach((card) => card.classList.remove('expand-left'));

      const cols = getCalendarColumnCount();
      if (cols <= 1) return;

      const expanded = birthdayMonthsEl.querySelector('.month-card.expanded');
      if (!expanded) return;

      const cards = Array.from(birthdayMonthsEl.querySelectorAll('.month-card'));
      const idx = cards.indexOf(expanded);
      if (idx <= 0) return;

      const isLastColumn = ((idx + 1) % cols) === 0;
      if (!isLastColumn) return;

      birthdayMonthsEl.insertBefore(expanded, cards[idx - 1]);
      expanded.classList.add('expand-left');
    }

    function createMonthDetails(detailsId, total, monthBucket) {
      const details = document.createElement('div');
      details.className = 'month-details';
      details.id = detailsId;
      details.setAttribute('aria-hidden', 'true');
      if (total === 0) {
        const empty = document.createElement('div');
        empty.className = 'month-empty';
        empty.textContent = 'Nicio aniversare';
        details.appendChild(empty);
      } else {
        const list = document.createElement('ul');
        list.className = 'month-list';
        const days = Object.keys(monthBucket)
          .map((day) => Number(day))
          .sort((a, b) => a - b);
        days.forEach((day) => {
          const names = monthBucket[day] || [];
          if (!names.length) return;
          const li = document.createElement('li');
          const dayLabel = document.createElement('span');
          dayLabel.className = 'month-day';
          dayLabel.textContent = String(day).padStart(2, '0');
          const namesLabel = document.createElement('span');
          namesLabel.className = 'month-names';
          namesLabel.textContent = names.join(', ');
          li.appendChild(dayLabel);
          li.appendChild(namesLabel);
          list.appendChild(li);
        });
        details.appendChild(list);
      }
      return details;
    }

    function createDayCell(day, monthBucket, meta, idx, currentMonthIdx, currentDay) {
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      const names = monthBucket[day] || [];
      if (names.length) {
        cell.classList.add('has-birthday');
        cell.dataset.names = names.join('||');
        cell.dataset.dateLabel = meta.long + ' ' + String(day).padStart(2, '0');
      }
      if (idx === currentMonthIdx && day === currentDay) {
        cell.classList.add('today');
      }

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = day;
      cell.appendChild(num);

      const labelDay = String(day).padStart(2, '0');
      cell.title = names.length
        ? meta.long + ' ' + labelDay + ': ' + names.join(', ')
        : meta.long + ' ' + labelDay;

      if (names.length) {
        cell.addEventListener('mouseenter', (event) => showBirthdayTooltip(event.currentTarget));
        cell.addEventListener('mouseleave', hideBirthdayTooltip);
        cell.addEventListener('click', (event) => {
          event.stopPropagation();
          const personName = names[0];
          const person = names.length === 1 ? personLookup.get(personName) : null;
          if (person) {
            hideBirthdayTooltip();
            openModal({
              name: person.name,
              image: person.image || placeholderDataUrl,
              birthday: person.birthday
            });
            return;
          }
          const isActive = birthdayTooltip
            && birthdayTooltip.classList.contains('show')
            && activeTooltipCell === event.currentTarget;
          if (isActive) {
            hideBirthdayTooltip();
          } else {
            showBirthdayTooltip(event.currentTarget);
          }
        });
      }
      return cell;
    }

    function render(data) {
      if (!birthdayMonthsEl) return;
      const buckets = collectBirthdays(data);
      const now = new Date();
      const currentMonthIdx = now.getMonth();
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();
      birthdayMonthsEl.innerHTML = '';

      monthsMeta.forEach((meta, idx) => {
        const monthBucket = buckets[idx] || {};
        const total = Object.keys(monthBucket).length;

        const card = document.createElement('article');
        card.className = 'month-card';
        if (idx === currentMonthIdx) card.classList.add('current');
        card.dataset.monthIndex = idx;
        card.dataset.renderIndex = idx;

        const detailsId = 'month-details-' + idx;
        const head = document.createElement('button');
        head.type = 'button';
        head.className = 'month-head';
        head.setAttribute('aria-expanded', 'false');
        head.setAttribute('aria-controls', detailsId);
        const title = document.createElement('span');
        title.className = 'month-title';
        title.textContent = meta.long;
        const expandIcon = document.createElement('span');
        expandIcon.className = 'month-expand-icon';
        expandIcon.textContent = '+';
        head.appendChild(title);
        head.appendChild(expandIcon);
        card.appendChild(head);

        const count = document.createElement('div');
        count.className = 'month-count';
        count.textContent = formatCount(total);
        card.appendChild(count);

        const body = document.createElement('div');
        body.className = 'month-body';

        const weekdayRow = document.createElement('div');
        weekdayRow.className = 'weekday-row';
        weekdayLabels.forEach((abbr) => {
          const el = document.createElement('div');
          el.textContent = abbr;
          weekdayRow.appendChild(el);
        });
        body.appendChild(weekdayRow);

        const grid = document.createElement('div');
        grid.className = 'month-grid';
        const daysInMonth = getDays(currentYear, idx);
        const offset = getOffset(currentYear, idx);
        for (let i = 0; i < offset; i++) {
          const pad = document.createElement('div');
          pad.className = 'day-cell pad';
          grid.appendChild(pad);
        }
        for (let day = 1; day <= daysInMonth; day++) {
          grid.appendChild(createDayCell(day, monthBucket, meta, idx, currentMonthIdx, currentDay));
        }
        body.appendChild(grid);
        card.appendChild(body);

        const details = createMonthDetails(detailsId, total, monthBucket);
        card.appendChild(details);

        head.addEventListener('click', () => {
          const isExpanded = card.classList.toggle('expanded');
          details.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
          head.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
          expandIcon.textContent = isExpanded ? '-' : '+';
          if (isExpanded && birthdayMonthsEl) {
            birthdayMonthsEl.querySelectorAll('.month-card.expanded').forEach((other) => {
              if (other === card) return;
              other.classList.remove('expanded');
              const otherDetails = other.querySelector('.month-details');
              if (otherDetails) otherDetails.setAttribute('aria-hidden', 'true');
              const otherHead = other.querySelector('.month-head');
              if (otherHead) otherHead.setAttribute('aria-expanded', 'false');
              const otherIcon = other.querySelector('.month-expand-icon');
              if (otherIcon) otherIcon.textContent = '+';
            });
          }
          updateExpandedMonthPlacement();
        });
        birthdayMonthsEl.appendChild(card);
      });
    }

    function applyMobileState() {
      if (!birthdayMonthsEl) return;
      const mobileShowAll = !!(mobileQuery && mobileQuery.matches);
      birthdayMonthsEl.classList.toggle('mobile-show-all', mobileShowAll);
      birthdayMonthsEl.classList.remove('mobile-carousel');
      if (calendarSection) calendarSection.classList.toggle('calendar-full', mobileShowAll);
      birthdayMonthsEl.querySelectorAll('.month-card').forEach((card) => card.classList.remove('active'));
      updateExpandedMonthPlacement();
      hideBirthdayTooltip();
    }

    function setupCarouselControls() {
      if (!birthdayMonthsEl) return;
      applyMobileState();
      if (mobileListenerAttached) return;
      if (!mobileQuery || typeof mobileQuery.addEventListener !== 'function') return;
      mobileListenerAttached = true;
      mobileQuery.addEventListener('change', applyMobileState);
    }

    function scrollCalendarToCurrentMonth() {
      if (!birthdayMonthsEl) return;
      const current = birthdayMonthsEl.querySelector('.month-card.current');
      if (!current) return;
      const sectionRect = birthdayMonthsEl.getBoundingClientRect();
      const cardRect = current.getBoundingClientRect();
      const target = cardRect.top - sectionRect.top + birthdayMonthsEl.scrollTop - 8;
      birthdayMonthsEl.scrollTop = Math.max(0, target);
    }

    function queueCalendarScroll() {
      if (!birthdayMonthsEl) return;
      if (birthdayMonthsEl.classList.contains('mobile-carousel')) return;
      requestAnimationFrame(() => {
        if (!calendarOpen) return;
        scrollCalendarToCurrentMonth();
      });
    }

    function setCalendarOpen(open) {
      calendarOpen = open === true;
      if (!calendarOpen) {
        hideBirthdayTooltip();
        return;
      }
      applyMobileState();
      queueCalendarScroll();
    }

    return {
      render,
      updateExpandedMonthPlacement,
      hideBirthdayTooltip,
      setCalendarOpen,
      setupCarouselControls
    };
  }

  window.AncestrioCalendarUtils = window.AncestrioCalendarUtils || {};
  window.AncestrioCalendarUtils.getDaysInMonth = getDaysInMonth;
  window.AncestrioCalendarUtils.getFirstDayOffset = getFirstDayOffset;
  window.AncestrioCalendarUtils.formatCount = formatCount;
  window.AncestrioCalendarUtils.shouldExcludeFromCalendar = shouldExcludeFromCalendar;
  window.AncestrioCalendarUtils.escapeHtml = escapeHtml;
  window.AncestrioCalendarUtils.createBirthdayStripController = createBirthdayStripController;
})();
