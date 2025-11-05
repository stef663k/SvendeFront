<script lang="ts">
    import { goto } from '$app/navigation';
    import { api, API_BASE } from '$lib';
    import { onMount, tick } from 'svelte';
    import { browser } from '$app/environment';

    let firstName: string = '';
    let currentUserId: string = '';
    let currentUserName: string = '';
    let isAdmin: boolean = false;
    let newPost: string = '';
    let posts: any[] = [];
    let isLoadingFeed = true;
    let expandedComments: Record<string, boolean> = {};
    let postIdToComments: Record<string, any[]> = {};
    let postIdToLoading: Record<string, boolean> = {};
    let postIdToNewComment: Record<string, string> = {};
    let postIdToPosting: Record<string, boolean> = {};
    let userIdToName: Record<string, string> = {};
    let showDebug: boolean = true;
    function hasAdminRole(roles: any): boolean {
        if (!roles) return false;
        const items = Array.isArray(roles) ? roles : [roles];
        for (const r of items) {
            const name = typeof r === 'string' ? r : (r?.name || r?.role || r?.roleName || r?.normalizedName || '');
            if (typeof name === 'string' && name.toLowerCase().includes('admin')) return true;
        }
        return false;
    }

    function getCookieLocal(name: string): string | null {
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
        } catch {}
        return null;
    }

    function deriveAdminFromToken(): boolean {
        try {
            const t = getCookieLocal('auth_token');
            if (!t) return false;
            const payloadRaw = t.split('.')[1] || '';
            const json = atob(payloadRaw.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json || '{}');
            const roles: any[] = ([] as any[]).concat(payload?.role || payload?.roles || []);
            return roles.join(',').toLowerCase().includes('admin');
        } catch { return false; }
    }

    function deriveFromToken(): void {
        try {
            const t = getCookieLocal('auth_token');
            if (!t) return;
            const payloadRaw = t.split('.')[1] || '';
            const json = atob(payloadRaw.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(json || '{}');
            const id = payload?.sub || payload?.nameid || payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || '';
            if (!currentUserId && id) currentUserId = String(id);
            if (!isAdmin) {
                const roles: any[] = ([] as any[]).concat(payload?.role || payload?.roles || []);
                if (roles.join(',').toLowerCase().includes('admin')) isAdmin = true;
            }
        } catch {}
    }


    onMount(async () => {
        if (!browser) return;
        deriveFromToken();
        await tick();
      
        const res = await api('/api/Auth/session');
        if (!res.ok) {
            console.warn('session not ok; redirecting to login');
            goto('/login');
            return;
        }
        const data = await res.json().catch(() => null);
        firstName = data?.user?.firstName || data?.user?.email || '';
        currentUserId = data?.user?.userId || data?.user?.id || data?.userId || data?.id || '';
        currentUserName = [data?.user?.firstName, data?.user?.lastName].filter(Boolean).join(' ').trim();
        isAdmin = Boolean(
            data?.user?.isAdmin || data?.isAdmin ||
            hasAdminRole(data?.user?.roles) || hasAdminRole(data?.roles) ||
            hasAdminRole(data?.user?.role) || hasAdminRole(data?.user?.roleName)
        );
        if (!isAdmin) isAdmin = deriveAdminFromToken();
        await tick();

        try {
            console.log('session user roles:', {
                roles_user: data?.user?.roles,
                roles_root: data?.roles,
                role_user: data?.user?.role,
                roleName_user: data?.user?.roleName,
                isAdmin,
                currentUserId
            });
        } catch {}
        if (data?.token) {
            const { setAccessToken } = await import('$lib');
            setAccessToken(data.token);
        }


        try {
            const allRes = await api('/api/Post?skip=0&take=20');
            if (allRes.ok) {
                posts = (await allRes.json().catch(() => []))?.map((p: any) => normalizeAuthor(p)) ?? [];
            } else {
                const feedRes = await api('/api/Post/feed?skip=0&take=20');
                if (feedRes.ok) posts = (await feedRes.json().catch(() => []))?.map((p: any) => normalizeAuthor(p)) ?? [];
            }
            posts = [...posts];
            for (const p of posts) {
                const uid = getUserIdFrom(p);
                if (uid) void resolveUserName(uid);
            }

            try {
                const sample = posts?.[0];
                if (sample) {
                    console.log('delete-visibility-debug', {
                        postId: sample.postId || sample.id,
                        postUserId: getUserIdFrom(sample),
                        currentUserId,
                        isAdmin,
                        canDelete: canDeleteEntity(sample)
                    });
                }
            } catch {}
        } finally {
            isLoadingFeed = false;
        }
    });

    async function exportMyData() {
        try {
            if (!currentUserId) return;
            const res = await api(`/api/User/${encodeURIComponent(currentUserId)}/data-export`);
            if (!res.ok) {
                console.error('Data export failed', await res.text().catch(() => ''));
                return;
            }
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/plain' });
            let filename = `user-data-${currentUserId}.txt`;
            const cd = res.headers.get('content-disposition') || '';
            const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
            const pickedRaw = decodeURIComponent(match?.[1] || match?.[2] || '');
            if (pickedRaw) {
                const withoutQuotes = pickedRaw.replace(/^\"|\"$/g, '');
                filename = withoutQuotes.replace(/\.[^.]+$/, '.txt');
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export error', err);
        }
    }

    async function handleLogout() {
        try {
            await api('/api/Auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout request failed', err);
        } finally {
            goto('/login');
        }
    }

    async function createPost() {
        const content = newPost.trim();
        if (!content) return;
        const res = await api('/api/Post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            const created = await res.json().catch(() => null);
            if (created) posts = [created, ...posts];
            newPost = '';
        } else {
            console.error('Create post failed', await res.text().catch(() => ''));
        }
    }

    function timeAgo(input: string | number | Date | undefined): string {
        const d = input ? new Date(input) : new Date();
        const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
        const intervals: [number, Intl.RelativeTimeFormatUnit][] = [
            [60, 'second'],
            [60, 'minute'],
            [24, 'hour'],
            [7, 'day'],
            [4.34524, 'week'],
            [12, 'month'],
            [Number.POSITIVE_INFINITY, 'year']
        ];
        let duration = seconds;
        let unit: Intl.RelativeTimeFormatUnit = 'second';
        let i = 0;
        let prev = 1;
        for (const [amount, u] of intervals) {
            if (Math.abs(duration) < amount) { unit = u; break; }
            duration /= amount; i++; prev = amount;
        }
        return rtf.format(-Math.round(duration), unit);
    }

    function userNameFrom(entity: any): string {
        if (!entity) return 'Unknown';
        const base = entity.user ?? entity.author ?? entity;
        const pick = (v: any) => (typeof v === 'string' && v.trim().length ? v.trim() : '');
        const tryKeys = (obj: any, keys: string[]) => {
            for (const k of keys) {
                const val = pick(obj?.[k]);
                if (val) return val;
            }
            return '';
        };
        const direct = tryKeys(base, ['userName', 'username', 'fullName', 'name']);
        if (direct) return direct;
        const first = pick(base?.firstName);
        const last = pick(base?.lastName);
        const combined = `${first} ${last}`.trim();
        if (combined) return combined;
        const email = pick(base?.email) || tryKeys(entity, ['authorEmail', 'createdByEmail']);
        if (email) return email;
        const id = entity.userId || entity.authorId || entity.createdById || base?.userId || base?.id;
        return id ? String(id) : 'Unknown';
    }

    async function toggleComments(postId: string) {
        expandedComments[postId] = !expandedComments[postId];
        if (!expandedComments[postId]) return;
        if (postIdToComments[postId]) return;
        postIdToLoading[postId] = true;
        try {
            const res = await api(`/api/Comment?postId=${encodeURIComponent(postId)}&skip=0&take=50`);
            if (res.ok) {
                postIdToComments[postId] = (await res.json().catch(() => []))?.map((c: any) => normalizeAuthor(c)) ?? [];
                for (const c of postIdToComments[postId]) {
                    const uid = getUserIdFrom(c);
                    if (uid) void resolveUserName(uid);
                }
            } else {
                postIdToComments[postId] = [];
            }
        } finally {
            postIdToLoading[postId] = false;
        }
    }

    async function submitComment(postId: string) {
        const text = (postIdToNewComment[postId] || '').trim();
        if (!text) return;
        expandedComments[postId] = true;
        if (!postIdToComments[postId]) postIdToComments[postId] = [];
        postIdToPosting[postId] = true;
        try {
            const res = await api('/api/Comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, content: text })
            });
            if (res.ok) {
                postIdToNewComment[postId] = '';
                try {
                    postIdToLoading[postId] = true;
                    const refresh = await api(`/api/Comment?postId=${encodeURIComponent(postId)}&skip=0&take=50`);
                    if (refresh.ok) {
                        postIdToComments[postId] = (await refresh.json().catch(() => postIdToComments[postId] || []))?.map((c: any) => normalizeAuthor(c)) ?? (postIdToComments[postId] || []);
                        for (const c of postIdToComments[postId]) {
                            const uid = getUserIdFrom(c);
                            if (uid) void resolveUserName(uid);
                        }
                    }
                } finally {
                    postIdToLoading[postId] = false;
                }
            } else {
                console.error('Create comment failed', await res.text().catch(() => ''));
            }
        } finally {
            postIdToPosting[postId] = false;
        }
    }

    function getUserIdFrom(e: any): string | null {
        if (!e) return null;
        if (e.authorId) return String(e.authorId);
        if (e.authorUserId) return String(e.authorUserId);
        if (e.createdByUserId) return String(e.createdByUserId);
        if (e.createdById) return String(e.createdById);
        if (e.ownerId) return String(e.ownerId);
        if (e.userId) return String(e.userId);
        const base = e.user ?? e.author ?? e;
        if (base?.authorId) return String(base.authorId);
        if (base?.authorUserId) return String(base.authorUserId);
        if (base?.createdByUserId) return String(base.createdByUserId);
        if (base?.createdById) return String(base.createdById);
        if (base?.ownerId) return String(base.ownerId);
        if (base?.userId) return String(base.userId);
        for (const [k, v] of Object.entries(e)) if ((/userId$/i.test(k) || /authorId$/i.test(k) || /createdBy(Id|UserId)$/i.test(k) || /ownerId$/i.test(k)) && v) return String(v);
        for (const [k, v] of Object.entries(base)) if ((/userId$/i.test(k) || /authorId$/i.test(k) || /createdBy(Id|UserId)$/i.test(k) || /ownerId$/i.test(k)) && v) return String(v);
        return null;
    }

    function normalizeAuthor(e: any): any {
        if (!e) return e;
        if (!e.authorId) {
            e.authorId = e.authorId ?? e.userId ?? e?.author?.userId ?? e?.user?.userId ?? e.createdById ?? e.createdByUserId ?? null;
        }
        return e;
    }

    async function resolveUserName(userId: string) {
        if (userIdToName[userId]) return;
        try {
            let res = await api(`/api/User/${encodeURIComponent(userId)}`);
            if (!res.ok) {
                let alt = await api(`/api/User/${encodeURIComponent(userId)}/public`);
                if (!alt.ok && alt.status === 401) {
                    try {
                        const plain = await fetch(`${API_BASE}/api/User/${encodeURIComponent(userId)}/public`, { credentials: 'omit' });
                        if (plain.ok) alt = plain as any;
                    } catch {}
                }
                if (!alt.ok) return;
                res = alt;
            }
            const u = await (res as Response).json().catch(() => null);
            if (!u) return;
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || String(userId);
            userIdToName = { ...userIdToName, [userId]: name };
        } catch {}
    }

    function displayNameFromCache(entity: any): string {
        const uid = getUserIdFrom(entity);
        if (uid) {
            if (userIdToName[uid]) return userIdToName[uid];
            if (uid === currentUserId && currentUserName) return currentUserName;
        }
        const base = entity?.user ?? entity?.author ?? entity;
        const first = (base?.firstName || '').toString().trim();
        const last = (base?.lastName || '').toString().trim();
        const combined = `${first} ${last}`.trim();
        return combined || 'Unknown';
    }

    function isOwner(entity: any): boolean {
        const uid = getUserIdFrom(entity);
        return !!uid && !!currentUserId && String(uid) === String(currentUserId);
    }

    function canDeleteEntity(entity: any): boolean {
        return isAdmin || isOwner(entity);
    }

    async function deletePost(postId: string) {
        if (!postId) return;
        try {
            const res = await api(`/api/Post/${encodeURIComponent(postId)}`, { method: 'DELETE' });
            if (res.status === 204) {
                posts = posts.filter(p => (p.postId || p.id) !== postId);
                delete expandedComments[postId];
                delete postIdToComments[postId];
                delete postIdToLoading[postId];
                delete postIdToNewComment[postId];
                delete postIdToPosting[postId];
                return;
            }
            if (res.status === 403) {
                console.warn("You don't have permission to delete this post");
                return;
            }
            if (res.status === 404) {
                console.warn('Post already deleted or not found');
                // Ensure UI reflects it
                posts = posts.filter(p => (p.postId || p.id) !== postId);
                return;
            }
            console.error('Delete post failed', await res.text().catch(() => ''));
        } catch (err) {
            console.error('Delete post error', err);
        }
    }

    async function deleteComment(commentId: string, parentPostId?: string) {
        if (!commentId) return;
        try {
            const res = await api(`/api/Comment/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
            if (res.status === 204) {
                if (parentPostId && postIdToComments[parentPostId]) {
                    postIdToComments[parentPostId] = postIdToComments[parentPostId].filter(c => (c.commentId || c.id) !== commentId);
                }
                return;
            }
            if (res.status === 403) {
                console.warn("You don't have permission to delete this comment");
                return;
            }
            if (res.status === 404) {
                console.warn('Comment already deleted or not found');
                if (parentPostId && postIdToComments[parentPostId]) {
                    postIdToComments[parentPostId] = postIdToComments[parentPostId].filter(c => (c.commentId || c.id) !== commentId);
                }
                return;
            }
            console.error('Delete comment failed', await res.text().catch(() => ''));
        } catch (err) {
            console.error('Delete comment error', err);
        }
    }

</script>

<div class="page-header">
    <h1>Agora</h1>
</div>

<button class="logout-top ghost" onclick={handleLogout}>Logout</button>

<div class="card">
    <div class="row">
        <button class="ghost" type="button" onclick={exportMyData} disabled={!currentUserId}>Export my data</button>
    </div>
{#if firstName}
        <p class="muted">Welcome, <strong>{firstName}</strong></p>
    {/if}
    <div class="row" style="margin-top:0.25rem;">
        <div class="muted small" style="flex:1;">
            {#if currentUserId}
                {#if showDebug}
                    Debug: userId={currentUserId} · isAdmin={isAdmin ? 'yes' : 'no'}
                {/if}
            {/if}
        </div>
        <button class="ghost" type="button" onclick={() => showDebug = !showDebug}>{showDebug ? 'Hide' : 'Show'} debug</button>
    </div>
    <div class="grid">
        <div class="tile inputtile">
            <div class="compose-body">
                <textarea
                    class="input"
                    placeholder="Write something..."
                    bind:value={newPost}
                    rows={newPost.length > 60 ? 4 : 2}
                ></textarea>
                <div class="actions">
                    {#if newPost.length > 0}
                        <button class="ghost" type="button" onclick={() => (newPost = '')}>Cancel</button>
                    {/if}
                    <button class="primary" type="button" onclick={createPost} disabled={!newPost.trim().length}>Post</button>
                </div>
            </div>
        </div>
        <div class="feed">
            {#if isLoadingFeed}
                <div class="tile"><div class="skeleton" style="height: 3rem;"></div></div>
                <div class="tile"><div class="skeleton" style="height: 5rem;"></div></div>
            {:else}
                {#if posts.length === 0}
                    <div class="tile"><p class="muted">No posts yet. Follow users or create your first post.</p></div>
                {:else}
                    {#each posts as post}
                        <div class="tile post" class:expanded={expandedComments[post.postId || post.id]}>
                            <div class="post-header">
                                <div class="post-meta">
                                    <strong>{displayNameFromCache(post)}</strong>
                                    <span class="muted small">{timeAgo(post.createdAt ?? post.created)}</span>
                                </div>
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <button class="ghost" type="button" onclick={() => toggleComments(post.postId || post.id)}>Comments</button>
                                    {#if canDeleteEntity(post)}
                                        <button class="ghost" type="button" onclick={() => deletePost(post.postId || post.id)}>Delete</button>
                                    {/if}
                                </div>
                            </div>
                            {#if showDebug}
                                <span class="muted small" style="display:block;">uid={getUserIdFrom(post)} · me={currentUserId} · admin={isAdmin ? 'y' : 'n'} · canDelete={canDeleteEntity(post) ? 'y' : 'n'}</span>
                            {/if}
                            <div class="post-body">{post.content ?? post.text ?? ''}</div>
                            <div class="comment-editor">
                                <textarea
                                    class="input"
                                    rows={2}
                                    placeholder="Write a comment..."
                                    bind:value={postIdToNewComment[post.postId || post.id]}
                                ></textarea>
                                <div class="comment-actions">
                                    <button class="ghost" type="button" onclick={() => postIdToNewComment[post.postId || post.id] = ''} disabled={!((postIdToNewComment[post.postId || post.id]||'').trim().length)}>Clear</button>
                                    <button class="primary" type="button" onclick={() => submitComment(post.postId || post.id)} disabled={postIdToPosting[post.postId || post.id] || !((postIdToNewComment[post.postId || post.id]||'').trim().length)}>Send</button>
                                </div>
                            </div>
                            {#if expandedComments[post.postId || post.id]}
                                <div class="comments">
                                    {#if postIdToLoading[post.postId || post.id]}
                                        <div class="skeleton" style="height: 2rem;"></div>
                                    {:else}
                                        {#if (postIdToComments[post.postId || post.id] || []).length === 0}
                                            <p class="muted">No comments</p>
                                        {:else}
                                    {#each postIdToComments[post.postId || post.id] as c}
                                                <div class="comment-row">
                                                    <div class="comment-author" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                                                        <strong>{displayNameFromCache(c)}</strong>
                                                        {#if canDeleteEntity(c)}
                                                            <button class="ghost" type="button" onclick={() => deleteComment(c.commentId || c.id, post.postId || post.id)}>Delete</button>
                                                        {/if}
                                                    </div>
                                                    <div class="comment-body">{c.content ?? c.text ?? ''}</div>
                                                    {#if showDebug}
                                                        <span class="muted small" style="display:block;">c.uid={getUserIdFrom(c)} · me={currentUserId} · admin={isAdmin ? 'y' : 'n'} · canDelete={canDeleteEntity(c) ? 'y' : 'n'}</span>
                                                    {/if}
                                                </div>
                                            {/each}
                                        {/if}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
{/if}
        </div>
    </div>
</div>

{#if showDebug}
    <div class="debug-overlay">
        <div>me={currentUserId || 'n/a'} · admin={isAdmin ? 'y' : 'n'}</div>
    </div>
{/if}

<style>
    .page-header {
        width: 100%;
        display: flex;
        justify-content: center;
        margin-bottom: 0.75rem;
    }
    .logout-top {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
    }
    .debug-overlay {
        position: fixed;
        left: 1rem;
        bottom: 1rem;
        background: var(--card-bg);
        border: 1px solid var(--ghost-border);
        padding: 0.5rem 0.75rem;
        border-radius: 0.5rem;
        color: var(--muted);
        z-index: 1000;
    }
    .card {
        width: 100%;
        max-width: 60rem; /* 960px */
        background: var(--card-bg);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 0.625rem 1.875rem rgba(2, 6, 23, 0.08);
        border: 1px solid var(--card-border);
        color: var(--text);
    }
    .row { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        gap: 0.75rem; }
    h1 { 
        margin: 0; 
        font-size: 1.5rem; 
        letter-spacing: -0.01em; 
        font-weight: 700;
    }
    .muted { 
        color: var(--muted); 
    }
    .grid { 
        display: grid; 
        gap: 0.875rem; 
        grid-template-columns: 1fr; 
        margin-top: 1.125rem; 
    }
    @media (min-width: 45rem) { 
        .grid { grid-template-columns: 1fr 1fr; } 
    }
    .feed { display: contents; }
    .tile { 
        padding: 1rem; 
        border: 0.0625rem solid var(--ghost-border); 
        border-radius: 0.75rem; 
        background: var(--tile-bg); 
    }
    .tile.post { grid-column: 1 / -1; }
    .tile.inputtile { 
        grid-column: 1 / -1; 
        position: relative; 
        padding: 1rem;
    }
    .compose-body { 
        position: relative; 
        padding-bottom: 3.75rem;
    }
    .input {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        padding: 0.75rem 0.875rem;
        border: 0.0625rem solid var(--input-border);
        border-radius: 0.625rem;
        background: var(--card-bg);
        color: var(--text);
        font: inherit;
        display: block;
    }
    .input:focus { 
        outline: none; border-color: var(--primary-from);
         box-shadow: 0 0 0 0.25rem var(--focus); 
        }
    .actions { 
        position: absolute; 
        right: 1rem; 
        bottom: 0.5rem; 
        display: flex; 
        gap: 0.5rem;
     }
    .ghost {
         background: transparent; 
         border: 0.0625rem solid var(--ghost-border); 
         color: var(--text); 
         border-radius: 0.625rem; 
         padding: 0.625rem 0.75rem; 
         cursor: pointer; 
         font-weight: 600;
     }
    .ghost:hover { 
        filter: brightness(0.98); }
    .primary {
        border: none;
        border-radius: 0.625rem;
        padding: 0.625rem 0.875rem;
        background: linear-gradient(135deg, var(--primary-from), var(--primary-to));
        color: #fff;
        cursor: pointer;
        font-weight: 700;
    }
    .primary:disabled { 
        opacity: 0.6; 
        cursor: not-allowed; 
    }
    .skeleton { 
        background: linear-gradient(90deg, rgba(148,163,184,0.15), rgba(148,163,184,0.35), rgba(148,163,184,0.15)); 
        background-size: 200% 100%; 
        animation: shimmer 1.4s infinite; 
        border-radius: 0.5rem;
    }
    @keyframes shimmer {
         from { background-position: 200% 0; } to { background-position: -200% 0; } 
    }
    .post-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .post-meta { display: flex; gap: 0.5rem; align-items: baseline; }
    .post-body { margin-bottom: 0.75rem; }
    .comments { 
        margin-top: 0.5rem; 
        display: grid; 
        grid-template-columns: 1fr; 
        gap: 0.5rem; 
    }
    .comment-row {
        width: 100%;
        background: var(--card-bg);
        border: 0.0625rem solid var(--ghost-border);
        border-radius: 0.5rem;
        padding: 0.75rem 0.875rem;
    }
    .comment-author { 
        font-size: 0.9rem; 
        margin-bottom: 0.25rem; 
        color: var(--muted); 
    }
    .comment-body { 
        white-space: pre-wrap; 
    }
    .comment-editor { 
        margin-top: 0.5rem; 
    }
    .comment-editor .input { margin-bottom: 0.5rem; }
    .comment-actions { 
        display: flex; 
        gap: 0.5rem; 
        justify-content: flex-end; 
        margin-top: 0.5rem; 
    }
</style>
