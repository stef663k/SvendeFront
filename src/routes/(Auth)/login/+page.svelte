<script lang="ts">
    import {goto} from '$app/navigation';
    import {api, API_BASE, setAccessToken} from '$lib';
    let email = "";
    let password = "";

    const API_BASE_LOCAL = API_BASE;

    async function handleLogin() {
                const response = await api(`/api/Auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        console.log('login status: ', response.status);
        if (response.ok) {
            const data = await response.json().catch(() => null);
            if(data?.token) {
                setAccessToken(data.token);
            }
            goto('/dashboard');
        } else {
            console.error('login failed: ', await response.text().catch(() => ''));
        }
    }    
</script>
<h1>Agora</h1>

<div class=card>
    <p class="muted">Sign in to you account</p>
    <form on:submit|preventDefault={handleLogin}>
        <label>
            <span>Email</span>
            <input type="email"placeholder="your@email.com" bind:value={email} required />
        </label>
        <label>
            <span>Password</span>
            <input type="password"placeholder="********" bind:value={password} required />
        </label>
        <button type="submit">Sign in</button>
    </form>
    <p class="muted small">
        Don't have an account? <a href="/register">Register</a>
    </p>
</div>

<style>
    .card {
        width: 100%;
        max-width: 26.25rem; /* 420px */
        background: var(--card-bg);
        border-radius: 16px;
        padding: 1.75rem;
        box-shadow: 0 0.625rem 1.875rem rgba(2, 6, 23, 0.08);
        border: 1px solid var(--card-border);
        color: var(--text);
    }
    h1 {
        margin: 0 0 4px;
        font-size: 1.5rem;
        font-weight: 1000;
        letter-spacing: -0.01em;
    }
    .muted { color: var(--muted); margin: 0 0 1.25rem; }
    .small { font-size: 0.875rem; }
    form { display: grid; gap: 0.875rem; }
    label { display: grid; gap: 0.375rem; }
    input {
        padding: 0.75rem 0.875rem;
        border: 1px solid var(--input-border);
        border-radius: 10px;
        font-size: 1rem;
        outline: none;
        background: var(--card-bg);
        color: var(--text);
    }
    input:focus { border-color: var(--primary-from); box-shadow: 0 0 0 0.25rem var(--focus); }
    button {
        margin-top: 0.375rem;
        padding: 0.75rem 0.875rem;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--primary-from), var(--primary-to));
        color: white;
        border: none;
        font-weight: 600;
        cursor: pointer;
    }
    button:hover { filter: brightness(0.98); }
</style>