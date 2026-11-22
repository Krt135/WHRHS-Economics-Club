// Reading aids for the long-form views (Weekly Feature and Perspectives articles,
// Academy lessons):
//   - a thin reading-progress bar along the top of the viewport
//   - a "back to top" button that appears after scrolling
//   - tags a "Works Cited" / "References" section so style.css can format it
// Each view is rendered by its own page's script, so this watches the DOM rather
// than hooking into them.
(function () {
    var view = document.getElementById('viewArticle') || document.getElementById('viewLesson');
    var body = document.getElementById('articleBody') || document.getElementById('lessonBody');
    if (!view || !body) return;
    var CONTENT_SEL = '.article-content, .lesson-content';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="reading-progress-fill"></span>';
    document.body.appendChild(bar);

    var toTop = document.createElement('button');
    toTop.type = 'button';
    toTop.className = 'back-to-top';
    toTop.setAttribute('aria-label', 'Back to top');
    toTop.innerHTML = '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>';
    toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    document.body.appendChild(toTop);

    var SHOW_TO_TOP_AFTER = 600;
    var ticking = false;

    function update() {
        ticking = false;
        var open = view.classList.contains('active');
        bar.classList.toggle('is-visible', open);
        toTop.classList.toggle('is-visible', open && window.scrollY > SHOW_TO_TOP_AFTER);
        if (!open) return;

        // Progress is measured through the essay text itself, with the "reading
        // line" at mid-screen: 0% as the text reaches it, 100% as the text ends.
        var content = body.querySelector(CONTENT_SEL) || body;
        var top = content.getBoundingClientRect().top + window.scrollY;
        var height = content.offsetHeight || 1;
        var p = (window.scrollY + window.innerHeight * 0.5 - top) / height;
        p = Math.min(1, Math.max(0, p));
        bar.firstChild.style.setProperty('--progress', p.toFixed(4));
    }

    function schedule() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    // Works Cited / References: headings are free text in a rich-text editor, so
    // CSS can't find them. Tag the heading and everything after it.
    var CITED = /^(works cited|references|bibliography|sources|citations)\s*:?$/i;
    function tagWorksCited() {
        var content = body.querySelector(CONTENT_SEL);
        if (!content || content.dataset.citedTagged === '1') return;
        content.dataset.citedTagged = '1';

        var kids = Array.prototype.slice.call(content.children);
        for (var i = 0; i < kids.length; i++) {
            var text = (kids[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (text.length > 0 && text.length < 30 && CITED.test(text)) {
                kids[i].classList.add('works-cited-heading');
                for (var j = i + 1; j < kids.length; j++) kids[j].classList.add('works-cited-entry');
                break;
            }
        }
    }

    // Each time a page re-renders the article, tag it and reset the bar.
    new MutationObserver(function () {
        tagWorksCited();
        schedule();
    }).observe(body, { childList: true });

    // The list <-> article switch is a class change on #viewArticle.
    new MutationObserver(schedule).observe(view, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    tagWorksCited();
    schedule();
})();
