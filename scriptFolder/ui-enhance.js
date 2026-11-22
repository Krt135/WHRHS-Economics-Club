// Keyboard support for clickable cards. Cards are <div onclick="..."> elements; the
// scripts that render them add role="link" and tabindex="0", and this makes the
// Enter key activate them the way it would a real link.
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var el = e.target;
    // Only the card itself: an inner button or input has its own keydown target.
    if (!el || el.nodeType !== 1 || el.getAttribute('role') !== 'link' || !el.hasAttribute('onclick')) return;
    e.preventDefault();
    el.click();
});
