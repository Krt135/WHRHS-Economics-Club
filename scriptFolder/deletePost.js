import { app } from './app.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const auth = getAuth(app);
const db = getDatabase(app);

/**
 * Soft-deletes a post by moving it to deleted_posts/<id>
 * with metadata, then removing from its original node.
 *
 * @param {string} node  - e.g. 'discussions', 'perspectives', 'features', 'lessons'
 * @param {string} id    - the post's Firebase key
 */
export async function softDelete(node, id) {
    const user = auth.currentUser;
    const postRef = ref(db, `${node}/${id}`);
    const snap = await get(postRef);

    if (!snap.exists()) return;

    const postData = snap.val();

    // Write to deleted_posts with metadata
    await set(ref(db, `deleted_posts/${id}`), {
        ...postData,
        _deletedFrom: node,
        _deletedAt: Date.now(),
        _deletedBy: user ? (user.displayName || user.email) : 'unknown',
        _deletedById: user ? user.uid : null,
        _originalId: id
    });

    // Remove from original node
    await remove(postRef);
}
