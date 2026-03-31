// i18n.js — Lightweight internationalization module
// Supports: zh-TW, zh-CN, en, de

const I18n = (() => {
    const SUPPORTED_LANGS = ['zh-TW', 'zh-CN', 'en', 'de'];
    const LANG_LABELS = {
        'zh-TW': '繁體中文',
        'zh-CN': '简体中文',
        'en': 'English',
        'de': 'Deutsch'
    };
    const STORAGE_KEY = 'mounjaro_lang';

    let currentLang = 'zh-TW';
    let translations = {};
    let onChangeCallbacks = [];

    function detectLang() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

        const browserLang = navigator.language || navigator.userLanguage || '';
        if (browserLang.startsWith('zh')) {
            return browserLang.includes('CN') || browserLang.includes('Hans') ? 'zh-CN' : 'zh-TW';
        }
        if (browserLang.startsWith('de')) return 'de';
        if (browserLang.startsWith('en')) return 'en';
        return 'zh-TW';
    }

    async function loadTranslations(lang) {
        try {
            const resp = await fetch(`locales/${lang}.json`);
            if (!resp.ok) throw new Error(`Failed to load ${lang}`);
            translations = await resp.json();
            currentLang = lang;
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) {
            console.warn(`i18n: Could not load ${lang}, falling back to zh-TW`, e);
            if (lang !== 'zh-TW') {
                await loadTranslations('zh-TW');
            }
        }
    }

    // Get translation by dot-notation key, e.g. "doses.title"
    // Supports {placeholder} replacement via params object
    function t(key, params) {
        const parts = key.split('.');
        let value = translations;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return key; // fallback: return key itself
            }
        }
        if (typeof value === 'string' && params) {
            return value.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
        }
        return value;
    }

    function getCurrentLang() {
        return currentLang;
    }

    function getSupportedLangs() {
        return SUPPORTED_LANGS;
    }

    function getLangLabel(lang) {
        return LANG_LABELS[lang] || lang;
    }

    function onChange(cb) {
        onChangeCallbacks.push(cb);
    }

    async function setLang(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        await loadTranslations(lang);
        // Update html lang attribute
        document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : lang === 'zh-TW' ? 'zh-TW' : lang;
        onChangeCallbacks.forEach(cb => cb(lang));
    }

    async function init() {
        const lang = detectLang();
        await loadTranslations(lang);
        document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : lang === 'zh-TW' ? 'zh-TW' : lang;
    }

    return { init, t, setLang, getCurrentLang, getSupportedLangs, getLangLabel, onChange };
})();
