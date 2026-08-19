import fs from 'node:fs'

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8')
  const after = transform(before)
  if (after !== before) fs.writeFileSync(path, after)
}

for (const path of ['extension/sidepanel.html', 'extension/workspace.html']) {
  update(path, html => {
    html = html.replace(/\s*<link rel="stylesheet" href="workspace-tools-v085\.css">/g, '')
    html = html.replace(/\s*<script type="module" src="workspace-tools-v085\.js"><\/script>/g, '')
    if (!html.includes('nav-v086.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="nav-v086.css">\n</head>')
    if (!html.includes('workspace-tools-v086.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="workspace-tools-v086.css">\n</head>')
    if (!html.includes('workspace-tools-v086.js')) html = html.replace('</body>', '  <script type="module" src="workspace-tools-v086.js"></script>\n</body>')
    return html
  })
}

update('extension/manifest.json', text => {
  const manifest = JSON.parse(text)
  manifest.version = '0.86.0'
  manifest.description = 'AI-powered reseller workspace with stable Scout, interactive Shortlist and Saved Leads, Analyse, explainable ratings and Lead Finder foundations.'
  return JSON.stringify(manifest, null, 2) + '\n'
})

update('package.json', text => {
  const pkg = JSON.parse(text)
  pkg.version = '0.86.0'
  return JSON.stringify(pkg, null, 2) + '\n'
})
