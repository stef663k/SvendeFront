<script lang="ts">
import { goto } from '$app/navigation';
import { api } from '$lib';

let firstName = '';
let lastName = '';
let email = '';
let password = '';
let confirmPassword = '';


async function handleRegister() {
    const response = await api(`/api/User`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            isActive: true,
            roles: ['User']
        })
    });
    if (response.ok) {
        goto('/login');
    } else {
        console.error('Register failed', await response.text().catch(() => ''));
    }
}
</script>

<div class="card">
    <h1>Create account</h1>
    <p class="muted">Fill in your details to get started</p>
    <form on:submit|preventDefault={handleRegister}>
        <div class="grid">
            <label>
                <span>First name</span>
                <input type="text" placeholder="First name" bind:value={firstName} required>
            </label>
            <label>
                <span>Last name</span>
                <input type="text" placeholder="Last name" bind:value={lastName} required>
            </label>
        </div>
        <label>
            <span>Email</span>
            <input type="email" placeholder="you@example.com" bind:value={email} required>
        </label>
        <div class="grid">
            <label>
                <span>Password</span>
                <input type="password" placeholder="••••••••" bind:value={password} required>
            </label>
            <label>
                <span>Confirm Password</span>
                <input type="password" placeholder="••••••••" bind:value={confirmPassword} required>
            </label>
        </div>
        
        <button type="submit">Create account</button>
    </form>
    <p class="muted small">Already have an account? <a href="/login">Login</a></p>
    
</div>

<style>
    .card {
        width: 100%;
        max-width: 40rem; /* 640px */
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
        font-weight: 700;
        letter-spacing: -0.01em;
    }
    .muted { color: var(--muted); margin: 0 0 1.25rem; }
    .small { font-size: 0.875rem; }
    form { display: grid; gap: 0.875rem; }
    .grid { display: grid; gap: 0.875rem; grid-template-columns: 1fr; }
    @media (min-width: 40rem) { .grid { grid-template-columns: 1fr 1fr; } }
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


