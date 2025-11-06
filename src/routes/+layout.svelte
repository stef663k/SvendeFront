<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	let theme = $state<'light' | 'dark'>('light');

	function applyTheme(next: 'light' | 'dark') {
		const root = document.documentElement;
		if (next === 'dark') root.classList.add('dark');
		else root.classList.remove('dark');
	}

	function initTheme() {
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') {
			theme = stored as any;
		} else {
			const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			theme = prefersDark ? 'dark' : 'light';
		}
		applyTheme(theme);
	}

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	}

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Svende</title>
</svelte:head>


<div class="app-shell">
	<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle theme">
		{theme === 'dark' ? '🌙' : '☀️'}
	</button>
	{@render children?.()}
</div>

<style>
	:root {
		--bg: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
		--text: #0f172a;
		--card-bg: #ffffff;
		--card-border: rgba(2, 6, 23, 0.08);
		--muted: #475569;
		--tile-bg: #fafafa;
		--input-border: #cbd5e1;
		--focus: rgba(99, 102, 241, 0.15);
		--primary-from: #6366f1;
		--primary-to: #8b5cf6;
		--ghost-border: #e2e8f0;
	}

	:global(.dark) {
		--bg: linear-gradient(135deg, #0b1220 0%, #111827 100%);
		--text: #e5e7eb;
		--card-bg: #0b1220;
		--card-border: rgba(148, 163, 184, 0.15);
		--muted: #cbd5e1;
		--tile-bg: #0f172a;
		--input-border: #334155;
		--focus: rgba(99, 102, 241, 0.25);
		--primary-from: #818cf8;
		--primary-to: #a78bfa;
		--ghost-border: #334155;
	}

	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
	}

	:global(body) {
		font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
		color: var(--text);
		background: var(--bg);
	}

	.app-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.theme-toggle {
		position: fixed;
		top: 1rem;
		right: 7rem;
		border: 1px solid var(--ghost-border);
		background: var(--card-bg);
		color: var(--text);
		border-radius: 999px;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
	}
	.theme-toggle:hover {
		filter: brightness(0.98);
	}
</style>
