import React, { useState } from 'react';
import { UniversalSearch } from '../../components/ui/UniversalSearch';
import { Button } from '../../components/ui/Button';
import { SNIPPET_CATEGORIES, SNIPPETS, snippetCode } from './snippetCatalog';
import { SNIPPET_ICONS } from './snippetIcons';
import './SearchDesignPage.scss';

export function SearchDesignPage() {
  const [category, setCategory] = useState('search');
  const [filter, setFilter] = useState('');
  const [queries, setQueries] = useState({});
  const [selected, setSelected] = useState('search-outlined');
  const [tab, setTab] = useState('jsx');
  const [copied, setCopied] = useState('');
  const [clicked, setClicked] = useState('');
  const [options, setOptions] = useState({ search: { showIcon: true, iconName: 'Search', showKeyboardHint: true }, buttons: { showIcon: true, iconName: 'Plus', iconOnly: false } });
  const currentOptions = options[category];
  const Icon = SNIPPET_ICONS[currentOptions.iconName];
  const changeOption = (key, value) => { setOptions(previous => ({ ...previous, [category]: { ...previous[category], [key]: value } })); setCopied(''); };
  const snippet = SNIPPETS.find(item => item.id === selected);
  const matches = SNIPPETS.filter(item => item.category === category && `${item.title} ${item.id} ${item.description}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const code = snippetCode(snippet, tab, options[snippet.category]);
  return <div className="search-design-page">
    <header><span className="search-design-page__eyebrow">SNIPPET LIBRARY</span><h1>Component snippets</h1><p>Browse components on the left. Inspect and copy their code on the right.</p></header>
    <div className="search-design-page__layout">
      <aside className="search-design-page__categories" aria-label="Component categories"><span className="search-design-page__eyebrow">COMPONENTS</span>{SNIPPET_CATEGORIES.map(item => <Button key={item.id} variant={category === item.id ? 'primary' : 'outline'} size="sm" aria-pressed={category === item.id} onClick={() => {
          setCategory(item.id); setSelected(SNIPPETS.find(snippet => snippet.category === item.id).id); setFilter(''); setCopied(''); setClicked('');
        }}>{item.label}<span className="search-design-page__count">{SNIPPETS.filter(snippet => snippet.category === item.id).length}</span></Button>)}</aside>
      <section className="search-design-page__previews" aria-label="Component snippet previews">
        <UniversalSearch preview value={filter} onChange={setFilter} label="Find a component snippet" placeholder={`Search ${category} snippets...`} />
        <fieldset className="search-design-page__options"><legend>Preview options</legend>
          <label><input type="checkbox" checked={currentOptions.showIcon} onChange={e => changeOption('showIcon', e.target.checked)} />Show icon</label>
          <label className="search-design-page__icon-picker"><span>Lucide icon</span><select aria-label="Select Lucide icon" disabled={!currentOptions.showIcon} value={currentOptions.iconName} onChange={e => changeOption('iconName', e.target.value)}>{Object.keys(SNIPPET_ICONS).map(name => <option key={name}>{name}</option>)}</select><Icon size={18} aria-hidden="true" /></label>
          {category === 'search' ? <label><input type="checkbox" checked={currentOptions.showKeyboardHint} onChange={e => changeOption('showKeyboardHint', e.target.checked)} />Show keyboard hint</label> : <label><span>Button content</span><select aria-label="Button content" disabled={!currentOptions.showIcon} value={currentOptions.showIcon && currentOptions.iconOnly ? 'icon-only' : 'text'} onChange={e => changeOption('iconOnly', e.target.value === 'icon-only')}><option value="text">{currentOptions.showIcon ? 'Icon with text' : 'Text only'}</option><option value="icon-only">Icon only</option></select></label>}
        </fieldset>
        {matches.map(item => <article key={item.id} className={`search-design-page__card ${selected === item.id ? 'is-selected' : ''}`}>
          <div className="search-design-page__card-heading"><h2>{item.title}</h2><code>{item.id}</code></div><p>{item.description}</p>
          {item.category === 'search' ? <UniversalSearch preview id={`preview-${item.id}`} variant={item.variant} shortcut="k" icon={Icon} showIcon={currentOptions.showIcon} showKeyboardHint={currentOptions.showKeyboardHint}
            label={`Preview ${item.title.toLowerCase()}`} placeholder="Search employees..." value={queries[item.id] || ''}
            onChange={value => setQueries(previous => ({ ...previous, [item.id]: value }))} /> : <div className="search-design-page__button-preview"><Button variant={item.variant} icon={currentOptions.showIcon ? Icon : undefined} iconOnly={currentOptions.showIcon && currentOptions.iconOnly} aria-label={item.variant === 'danger' ? 'Delete' : 'Continue'} onClick={() => setClicked(item.id)}>{currentOptions.showIcon && currentOptions.iconOnly ? null : item.variant === 'danger' ? 'Delete' : 'Continue'}</Button>{clicked === item.id && <small role="status">Preview clicked</small>}</div>}
          <Button className="search-design-page__select" variant={selected === item.id ? 'primary' : 'outline'} size="sm" aria-pressed={selected === item.id}
            onClick={() => { setSelected(item.id); setCopied(''); }}>{selected === item.id ? 'Viewing code' : 'View code'}</Button>
        </article>)}
        {!matches.length && <p role="status">No snippets found in this category. Try another search.</p>}
      </section>
      <section className="search-design-page__code-panel search-design-page__card" aria-label="Selected snippet code">
        <div className="search-design-page__card-heading"><h2>{snippet.title}</h2><Button variant="outline" size="sm" onClick={async () => {
          try { await navigator.clipboard.writeText(code); setCopied('Copied'); } catch { setCopied('Select the code below to copy it manually.'); }
        }}>Copy code</Button></div>
        <p>Snippet ID: <code>{selected}</code></p>
        <div className="search-design-page__tabs" role="group" aria-label="Code language">{['jsx', 'scss'].map(language => <Button key={language} variant={tab === language ? 'primary' : 'outline'} size="sm" aria-pressed={tab === language} onClick={() => { setTab(language); setCopied(''); }}>{language.toUpperCase()}</Button>)}</div>
        <pre tabIndex={0} aria-label={`${tab.toUpperCase()} source`}><code>{code}</code></pre>
        <span role="status">{copied}</span>
        <p className="search-design-page__note">Edit <code>{snippet.category === 'search' ? 'src/components/ui/UniversalSearch.scss' : 'src/styles/components.scss'}</code> to adjust the design. Share the snippet ID and where you want to use it.</p>
      </section>
    </div>
  </div>;
}
