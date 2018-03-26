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
    public static readonly SCHEME = 'l2h-live-preview'

    private context: vscode.ExtensionContext
    private _onDidChange: vscode.EventEmitter<vscode.Uri>
    private generator: any

    public constructor(context: vscode.ExtensionContext) {
        this.context = context
        this._onDidChange = new vscode.EventEmitter<vscode.Uri>()
        this.generator = new htmlGenerator({
            hyphenate: false,
            styles: [
                // include from correct path
                vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'katex', 'dist', 'katex.min.css')).toString(),
                vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', 'latex.js', 'dist', 'css', 'article.css')).toString(),
                // local changes
                vscode.Uri.file(path.join(this.context.extensionPath, 'resources/fix.css')).toString(),
            ]
        })
    }

    public get onDidChange() {
        return this._onDidChange.event
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
            if (1) { // TODO: switch settings.json
                const output = path.join(path.dirname(doc.fileName), path.basename(doc.fileName, path.extname(doc.fileName)) + '.html')
                fs.writeFileSync(output, dom.outerHTML)
            }

            // to HTML source
            return dom.outerHTML
        } catch (err) {
            return null
        }
    }

    // open preview tab
    public open(editor: vscode.TextEditor): void {
        vscode.commands.executeCommand('vscode.previewHtml',
            editor.document.uri.with({ scheme: LivePreviewProvider.SCHEME }),
            vscode.ViewColumn.Two,
            `Live preview for ${path.relative(vscode.workspace.rootPath || '', editor.document.uri.fsPath)}`)
    }

    public update(editor: vscode.TextEditor): void {
        this._onDidChange.fire(editor.document.uri.with({ scheme: LivePreviewProvider.SCHEME }))
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // check extension
    const isTeX = (uri: vscode.Uri): boolean => [ 'tex', 'ltx', 'latex' ].some(ext => uri.fsPath.endsWith(ext))

    // enable preview provider
    const previewProvider = new LivePreviewProvider(context)
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(LivePreviewProvider.SCHEME, previewProvider))

    // add command
    context.subscriptions.push(vscode.commands.registerCommand('l2h-live.openPreview', () => {
        if (vscode.window.activeTextEditor && isTeX(vscode.window.activeTextEditor.document.uri)) {
            previewProvider.open(vscode.window.activeTextEditor)
        }
    }))

    // add content modification listeners
    const onDocumentChanged = () => {
        if (vscode.window.activeTextEditor && isTeX(vscode.window.activeTextEditor.document.uri))
        {
            previewProvider.update(vscode.window.activeTextEditor)
        }
    }
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(e => onDocumentChanged()),
        vscode.window.onDidChangeTextEditorSelection(e => onDocumentChanged())
    )
}

// this method is called when your extension is deactivated
export function deactivate() {
}