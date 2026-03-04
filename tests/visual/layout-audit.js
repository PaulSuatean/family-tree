const { expect } = require('@playwright/test');

async function collectLayoutAudit(page, options = {}) {
  const result = await page.evaluate((config) => {
    const {
      alignmentScopes = [],
      alignmentTolerance = 10,
      containmentChecks = [],
      edgeAlignmentChecks = [],
      ignoreSelectors = [],
      maxIssues = 10,
      overflowTolerance = 2,
      overlapScopes = [],
      overlapTolerance = 12
    } = config;

    const ignoredTags = new Set([
      'BR',
      'DEFS',
      'HEAD',
      'LINE',
      'LINK',
      'META',
      'NOSCRIPT',
      'PATH',
      'SCRIPT',
      'STOP',
      'STYLE',
      'TITLE'
    ]);

    function isVisible(el) {
      if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false;
      if (ignoreSelectors.some((selector) => el.matches?.(selector) || el.closest?.(selector))) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function describe(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = Array.from(el.classList || []).slice(0, 3).map((name) => `.${name}`).join('');
      return `${tag}${id}${classes}`;
    }

    function buildSelector(el) {
      if (!(el instanceof Element)) return '';
      if (el.id) return `#${el.id}`;

      const segments = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        const parent = current.parentElement;
        if (!parent) break;
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        const index = sameTagSiblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
        if (current.id) {
          segments.unshift(`#${current.id}`);
          break;
        }
      }

      return segments.join(' > ');
    }

    function rectSummary(rect) {
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        width: Math.round(rect.width)
      };
    }

    function isOverlayPositioned(el) {
      const position = window.getComputedStyle(el).position;
      return position === 'absolute' || position === 'fixed';
    }

    function elementSummary(el, rect) {
      return {
        element: describe(el),
        rect: rectSummary(rect),
        selector: buildSelector(el)
      };
    }

    const overflowIssues = [];
    const scrollingRoot = document.scrollingElement || document.documentElement;
    const hasDocumentOverflow = scrollingRoot.scrollWidth > window.innerWidth + overflowTolerance;

    if (hasDocumentOverflow) {
      overflowIssues.push({
        element: 'document',
        rect: {
          left: 0,
          right: Math.round(scrollingRoot.scrollWidth),
          width: Math.round(scrollingRoot.scrollWidth)
        },
        reason: `Page scroll width is ${Math.round(scrollingRoot.scrollWidth)}px while viewport is ${window.innerWidth}px`
      });

      const elements = Array.from(document.querySelectorAll('body *'));
      for (const el of elements) {
        if (overflowIssues.length >= maxIssues) break;
        if (ignoredTags.has(el.tagName)) continue;
        if (!isVisible(el)) continue;
        if (isOverlayPositioned(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.right <= window.innerWidth + overflowTolerance) continue;

        overflowIssues.push({
          ...elementSummary(el, rect),
          reason: `Element extends outside viewport width ${window.innerWidth}px`
        });
      }
    }

    const overlapIssues = [];
    for (const scopeSelector of overlapScopes) {
      if (overlapIssues.length >= maxIssues) break;
      const scope = document.querySelector(scopeSelector);
      if (!scope || !isVisible(scope)) continue;

      const candidates = Array.from(scope.children)
        .filter((child) => !ignoredTags.has(child.tagName))
        .filter(isVisible)
        .filter((child) => !isOverlayPositioned(child));

      for (let index = 0; index < candidates.length; index += 1) {
        if (overlapIssues.length >= maxIssues) break;
        const first = candidates[index];
        const firstRect = first.getBoundingClientRect();

        for (let innerIndex = index + 1; innerIndex < candidates.length; innerIndex += 1) {
          if (overlapIssues.length >= maxIssues) break;
          const second = candidates[innerIndex];
          const secondRect = second.getBoundingClientRect();

          const overlapWidth = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
          const overlapHeight = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
          if (overlapWidth <= overlapTolerance || overlapHeight <= overlapTolerance) continue;

          overlapIssues.push({
            a: elementSummary(first, firstRect),
            b: elementSummary(second, secondRect),
            scope: scopeSelector
          });
        }
      }
    }

    const alignmentIssues = [];
    for (const scopeSelector of alignmentScopes) {
      if (alignmentIssues.length >= maxIssues) break;
      const scope = document.querySelector(scopeSelector);
      if (!scope || !isVisible(scope)) continue;

      const candidates = Array.from(scope.children)
        .filter((child) => !ignoredTags.has(child.tagName))
        .filter(isVisible)
        .filter((child) => !isOverlayPositioned(child))
        .map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            el: child,
            rect,
            centerY: rect.top + rect.height / 2,
            height: rect.height
          };
        })
        .sort((a, b) => a.rect.top - b.rect.top);

      const rows = [];
      for (const candidate of candidates) {
        const row = rows.find((entry) => {
          const overlapsVertically = Math.min(entry.bottom, candidate.rect.bottom) - Math.max(entry.top, candidate.rect.top) > 12;
          const centerDistance = Math.abs(entry.centerY - candidate.centerY);
          return overlapsVertically || centerDistance <= Math.max(18, Math.min(entry.averageHeight, candidate.height) * 0.3);
        });

        if (!row) {
          rows.push({
            averageHeight: candidate.height,
            centerY: candidate.centerY,
            bottom: candidate.rect.bottom,
            items: [candidate],
            top: candidate.rect.top
          });
          continue;
        }

        row.items.push(candidate);
        row.top = Math.min(row.top, candidate.rect.top);
        row.bottom = Math.max(row.bottom, candidate.rect.bottom);
        row.centerY = row.items.reduce((sum, item) => sum + item.centerY, 0) / row.items.length;
        row.averageHeight = row.items.reduce((sum, item) => sum + item.height, 0) / row.items.length;
      }

      for (const row of rows) {
        if (alignmentIssues.length >= maxIssues) break;
        if (row.items.length < 2) continue;

        const centerValues = row.items.map((item) => item.centerY);
        const heightValues = row.items.map((item) => item.height);
        const centerSpread = Math.max(...centerValues) - Math.min(...centerValues);
        const heightSpread = Math.max(...heightValues) - Math.min(...heightValues);

        if (centerSpread <= alignmentTolerance) continue;
        if (heightSpread > Math.max(24, row.averageHeight * 0.35)) continue;

        alignmentIssues.push({
          axis: 'row',
          centerSpread: Math.round(centerSpread),
          items: row.items.map((item) => elementSummary(item.el, item.rect)),
          scope: scopeSelector
        });
      }
    }

    const edgeAlignmentIssues = [];
    for (const check of edgeAlignmentChecks) {
      if (edgeAlignmentIssues.length >= maxIssues) break;
      const minWidth = Number(check.minViewportWidth || 0);
      const maxWidth = Number(check.maxViewportWidth || Number.POSITIVE_INFINITY);
      if (window.innerWidth < minWidth || window.innerWidth > maxWidth) continue;

      const first = document.querySelector(check.selectorA);
      const second = document.querySelector(check.selectorB);
      if (!first || !second || !isVisible(first) || !isVisible(second)) continue;

      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      const edge = check.edge || 'bottom';
      const tolerance = Number(check.tolerance || alignmentTolerance);
      const firstValue = firstRect[edge];
      const secondValue = secondRect[edge];
      const delta = Math.abs(firstValue - secondValue);

      if (delta <= tolerance) continue;

      edgeAlignmentIssues.push({
        delta: Math.round(delta),
        edge,
        expected: check.description || `${check.selectorA} and ${check.selectorB} should align on ${edge}`,
        first: elementSummary(first, firstRect),
        second: elementSummary(second, secondRect)
      });
    }

    const containmentIssues = [];
    for (const check of containmentChecks) {
      if (containmentIssues.length >= maxIssues) break;
      const minWidth = Number(check.minViewportWidth || 0);
      const maxWidth = Number(check.maxViewportWidth || Number.POSITIVE_INFINITY);
      if (window.innerWidth < minWidth || window.innerWidth > maxWidth) continue;

      const container = document.querySelector(check.containerSelector);
      const subject = document.querySelector(check.subjectSelector);
      if (!container || !subject || !isVisible(container) || !isVisible(subject)) continue;

      const containerRect = container.getBoundingClientRect();
      const subjectRect = subject.getBoundingClientRect();
      const tolerance = Number(check.tolerance || 0);
      const edges = Array.isArray(check.edges) && check.edges.length ? check.edges : ['top', 'right', 'bottom', 'left'];

      for (const edge of edges) {
        if (containmentIssues.length >= maxIssues) break;

        let delta = 0;
        if (edge === 'top') {
          delta = containerRect.top - subjectRect.top;
        } else if (edge === 'left') {
          delta = containerRect.left - subjectRect.left;
        } else if (edge === 'right') {
          delta = subjectRect.right - containerRect.right;
        } else if (edge === 'bottom') {
          delta = subjectRect.bottom - containerRect.bottom;
        } else {
          continue;
        }

        if (delta <= tolerance) continue;

        containmentIssues.push({
          container: elementSummary(container, containerRect),
          edge,
          expected: check.description || `${check.subjectSelector} should stay inside ${check.containerSelector} on ${edge}`,
          subject: elementSummary(subject, subjectRect),
          delta: Math.round(delta)
        });
      }
    }

    return {
      alignmentIssues,
      containmentIssues,
      edgeAlignmentIssues,
      issueCount: overflowIssues.length + overlapIssues.length + alignmentIssues.length + edgeAlignmentIssues.length + containmentIssues.length,
      overflowIssues,
      overlapIssues,
      viewport: {
        height: window.innerHeight,
        width: window.innerWidth
      }
    };
  }, options);

  return result;
}

function assertLayoutAudit(result) {
  expect.soft(
    result.overflowIssues,
    [
      `Horizontal overflow detected at ${result.viewport.width}x${result.viewport.height}.`,
      ...result.overflowIssues.map((issue) => `${issue.element}: ${issue.reason}`)
    ].join('\n')
  ).toEqual([]);

  expect.soft(
    result.overlapIssues,
    [
      `Unexpected sibling overlap detected at ${result.viewport.width}x${result.viewport.height}.`,
      ...result.overlapIssues.map((issue) => `${issue.scope}: ${issue.a.element} overlaps ${issue.b.element}`)
    ].join('\n')
  ).toEqual([]);

  expect.soft(
    result.alignmentIssues,
    [
      `Potential row misalignment detected at ${result.viewport.width}x${result.viewport.height}.`,
      ...result.alignmentIssues.map((issue) => {
        const names = issue.items.map((item) => item.element).join(', ');
        return `${issue.scope}: center spread ${issue.centerSpread}px across ${names}`;
      })
    ].join('\n')
  ).toEqual([]);

  expect.soft(
    result.edgeAlignmentIssues,
    [
      `Expected section edge alignment is off at ${result.viewport.width}x${result.viewport.height}.`,
      ...result.edgeAlignmentIssues.map((issue) => `${issue.expected} (delta ${issue.delta}px)`)
    ].join('\n')
  ).toEqual([]);

  expect.soft(
    result.containmentIssues,
    [
      `Expected nested layout containment is off at ${result.viewport.width}x${result.viewport.height}.`,
      ...result.containmentIssues.map((issue) => `${issue.expected} (delta ${issue.delta}px)`)
    ].join('\n')
  ).toEqual([]);
}

module.exports = {
  assertLayoutAudit,
  collectLayoutAudit
};
