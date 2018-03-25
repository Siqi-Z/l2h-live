'use strict';
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

// load LaTeX.js
// @ts-ignore
global.window = require('svgdom')
// @ts-ignore
global.document = window.document
const htmlGenerator = require('../node_modules/latex.js/dist/html-generator').HtmlGenerator
const latexParser = require('../node_modules/latex.js/dist/latex-parser')

export class LivePreviewProvider implements vscode.TextDocumentContentProvider  {
    private context: vscode.ExtensionContext
    private generator: any

    public static readonly SCHEME = 'l2h-live-preview'

    public constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.generator = new htmlGenerator({
            hyphenate: false,
            styles: [
                // include from correct path
                vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'latex.js', 'dist', 'css/article.css')).toString(),
                // local changes
                vscode.Uri.file(path.join(this.context.extensionPath, 'resources/fix.css')).toString(),
            ]
        })
    }

    // implements renderer
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken) {
        try {
            // get source
            const doc = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath)
            if (!doc) {
                return null
            }

            // get DOM result
            this.generator.reset()
            const dom = latexParser.parse(doc.getText(), { generator: this.generator }).dom()

            // output as html
            if (0) { // TODO: switch settings.json
                const output = path.join(path.dirname(doc.fileName), path.basename(doc.fileName, path.extname(doc.fileName)) + '.html')
                fs.writeFileSync(output, dom.outerHTML)
            }

            // to HTML source
            return dom.outerHTML
        } catch (err) {
            return null
        }
    }

    // implements update event
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
    
    public get onDidChange() {
        return this._onDidChange.event
    }

    public update(uri: vscode.Uri): void {
        this._onDidChange.fire(uri)
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "l2h-live" is now active!')

    // check extension
    const isTeX = (uri: vscode.Uri): boolean => [ 'tex', 'ltx', 'latex' ].some(ext => uri.fsPath.endsWith(ext))

    // add command
    context.subscriptions.push(vscode.commands.registerCommand('l2h-live.openPreview', () => {
        // no active document selected
        if (!vscode.window.activeTextEditor)
        {
            return
        }

        // no TeX document
        if (!isTeX(vscode.window.activeTextEditor.document.uri)) {
            return
        }

        // open
        const uri = vscode.window.activeTextEditor.document.uri.with({scheme: LivePreviewProvider.SCHEME})
        vscode.commands.executeCommand('vscode.previewHtml',
            vscode.window.activeTextEditor.document.uri.with({scheme: LivePreviewProvider.SCHEME}),
            vscode.ViewColumn.Two,
            `Live preview for ${path.relative(vscode.workspace.rootPath || '', uri.fsPath)}`)
    }))

    // enable preview provider
    const previewProvider = new LivePreviewProvider(context)
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LivePreviewProvider.SCHEME, previewProvider))

    // add content modification listeners
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
        if (typeof e === 'undefined') {
            return
        }
        const active = vscode.window.activeTextEditor
        if (active && isTeX(active.document.uri))
        {
            previewProvider.update(active.document.uri.with({ scheme: LivePreviewProvider.SCHEME }))
        }
    }))
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        if (typeof e === 'undefined') {
            return
        }
        const active = vscode.window.activeTextEditor
        if (active && isTeX(active.document.uri))
        {
            previewProvider.update(active.document.uri.with({ scheme: LivePreviewProvider.SCHEME }))
        }
    }))
}

// this method is called when your extension is deactivated
export function deactivate() {
}